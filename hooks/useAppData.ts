
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { AppSettings } from '../services/settingsService'; 
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc, collection, query, writeBatch, arrayUnion, collectionGroup, getDocs } from 'firebase/firestore';

const initialVerbalTests: VerbalTests = Object.keys(VERBAL_BANKS).reduce((acc, bankKey) => {
  acc[bankKey] = Object.keys(VERBAL_CATEGORIES).reduce((catAcc, catKey) => {
    catAcc[catKey] = [];
    return catAcc;
  }, {} as { [category: string]: Test[] });
  return acc;
}, {} as VerbalTests);

const defaultGlobalSettings: AppSettings = {
    isQuantitativeEnabled: true,
    isVerbalEnabled: true,
    isReviewQuantitativeEnabled: true,
    isReviewVerbalEnabled: true,
};

export const getInitialData = (): AppData => ({
  tests: {
    quantitative: [],
    verbal: initialVerbalTests,
  },
  folders: {
    quantitative: [{ id: 'mistakes_quantitative', name: 'مجلد الأخطاء', questions: [] }],
    verbal: [{ id: 'mistakes_verbal', name: 'مجلد الأخطاء', questions: [] }],
  },
  reviewTests: {
    quantitative: [],
    verbal: [],
  },
  history: [],
  reviewedQuestionIds: {},
});

export const useAppData = (userId: string | null, isDevUser: boolean, isPreviewMode: boolean) => {
  const [globalTests, setGlobalTests] = useState<AppData['tests']>({
    quantitative: [],
    verbal: initialVerbalTests,
  });

  const [subcollectionQuestions, setSubcollectionQuestions] = useState<Record<string, Question[]>>({});
  const [settings, setSettings] = useState<AppSettings>(defaultGlobalSettings);
  const [userData, setUserData] = useState<Omit<AppData, 'tests'>>({
      folders: getInitialData().folders,
      history: [],
      reviewTests: { quantitative: [], verbal: [] },
      reviewedQuestionIds: {}
  });
  
  const [isLoading, setIsLoading] = useState(true);
  
  // LOAD GLOBAL TESTS - Only if user is logged in
  useEffect(() => {
    if (!userId) {
      setGlobalTests({
        quantitative: [],
        verbal: JSON.parse(JSON.stringify(initialVerbalTests))
      });
      return;
    }

    const q = query(collection(db, 'globalTests'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const newTestsStructure: AppData['tests'] = {
            quantitative: [],
            verbal: JSON.parse(JSON.stringify(initialVerbalTests))
        };

        querySnapshot.forEach((doc) => {
            const testData = { id: doc.id, ...doc.data() } as any;
            if (!testData.questions) testData.questions = [];
            if (testData.section === 'quantitative') {
                newTestsStructure.quantitative.push(testData);
            } else if (testData.section === 'verbal') {
                const { bankKey, categoryKey } = testData;
                if (bankKey && categoryKey && newTestsStructure.verbal[bankKey]?.[categoryKey]) {
                    newTestsStructure.verbal[bankKey][categoryKey].push(testData);
                }
            }
        });
        setGlobalTests(newTestsStructure);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Error fetching global tests:", error);
        }
    });

    return () => unsubscribe();
  }, [userId]);

  // Load Global Settings - Only if user is logged in
  useEffect(() => {
    if (!userId) return;

    const settingsUnsub = onSnapshot(doc(db, 'globalContent', 'settings'), (docSnap) => {
        if (docSnap.exists()) {
            setSettings(docSnap.data() as AppSettings);
        } else {
            setSettings(defaultGlobalSettings);
        }
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Settings listener error:", error);
        }
    });
    return () => settingsUnsub();
  }, [userId]);

  // Load User Data - Ensure ref is valid and user is logged in
  useEffect(() => {
    if (!userId) {
        setUserData({
             folders: getInitialData().folders,
             history: [],
             reviewTests: { quantitative: [], verbal: [] },
             reviewedQuestionIds: {}
        });
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    const docRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const loaded = docSnap.data();
            setUserData({
                folders: loaded.folders || getInitialData().folders,
                history: loaded.history || [],
                reviewTests: loaded.reviewTests || { quantitative: [], verbal: [] },
                reviewedQuestionIds: loaded.reviewedQuestionIds || {}
            });
        } else {
            // New user case or doc not created yet
            setUserData({
                folders: getInitialData().folders,
                history: [],
                reviewTests: { quantitative: [], verbal: [] },
                reviewedQuestionIds: {}
            });
        }
        setIsLoading(false);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Error loading user data:", error);
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const fetchTestQuestions = useCallback(async (testId: string) => {
      if (subcollectionQuestions[testId]) return;
      try {
          const qColl = collection(db, 'globalTests', testId, 'questions');
          const qSnap = await getDocs(qColl);
          const questions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          setSubcollectionQuestions(prev => ({ ...prev, [testId]: questions }));
      } catch (e) {
          console.error(`Error fetching questions for test ${testId}:`, e);
      }
  }, [subcollectionQuestions]);

  const data: AppData = useMemo(() => {
      const mergedTests = JSON.parse(JSON.stringify(globalTests));
      const mergeQuestionsForTest = (test: Test) => {
          const extraQuestions = subcollectionQuestions[test.id] || [];
          const qMap = new Map();
          (test.questions || []).forEach(q => qMap.set(q.id, q));
          extraQuestions.forEach(q => qMap.set(q.id, q));
          test.questions = Array.from(qMap.values());
          test.questions.sort((a: Question, b: Question) => (a.order || 0) - (b.order || 0));
      };
      mergedTests.quantitative.forEach((test: Test) => mergeQuestionsForTest(test));
      Object.keys(mergedTests.verbal).forEach(bank => {
          Object.keys(mergedTests.verbal[bank]).forEach(cat => {
              mergedTests.verbal[bank][cat].forEach((test: Test) => mergeQuestionsForTest(test));
          });
      });
      return { tests: mergedTests, ...userData };
  }, [globalTests, userData, subcollectionQuestions]);

  const updateGlobalSettings = async (newSettings: AppSettings) => {
      if (!isDevUser && !isPreviewMode) return; 
      setSettings(newSettings);
      try {
          await setDoc(doc(db, 'globalContent', 'settings'), newSettings, { merge: true });
      } catch (e) {
          console.error("Failed to save settings:", e);
      }
  };

  const saveUserSpecificData = async (updater: (draft: Omit<AppData, 'tests'>) => void) => {
      if (!userId) return;
      const newData = JSON.parse(JSON.stringify(userData));
      updater(newData);
      setUserData(newData);
      try {
          await setDoc(doc(db, 'users', userId), newData, { merge: true });
      } catch (e) {
          console.error("Failed to save user data:", e);
      }
  };

  const addTest = (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    if (!isDevUser) return '';
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTest: any = {
      id: testId,
      name: testName,
      questions: [],
      section,
      createdAt: new Date().toISOString()
    };
    if (sourceText) newTest.sourceText = sourceText;
    if (bankKey) newTest.bankKey = bankKey;
    if (categoryKey) newTest.categoryKey = categoryKey;
    setDoc(doc(db, 'globalTests', testId), newTest).catch(e => console.error("Add Test Failed:", e));
    return testId;
  };

  const addQuestionsToTest = async (section: Section, testId: string, newQuestions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    try {
        const batch = writeBatch(db);
        const questionsRef = collection(db, 'globalTests', testId, 'questions');
        const addedQuestions: Question[] = [];
        newQuestions.forEach(q => {
             const newDocRef = doc(questionsRef); 
             const questionWithId = { ...q, id: newDocRef.id };
             batch.set(newDocRef, questionWithId);
             addedQuestions.push(questionWithId as Question);
        });
        await batch.commit();
        setSubcollectionQuestions(prev => ({
            ...prev,
            [testId]: [...(prev[testId] || []), ...addedQuestions]
        }));
    } catch (e) {
        console.error("Add Questions Failed:", e);
    }
  };
  
  const updateQuestionAnswer = async (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => {
      if (!isDevUser) return;
      try {
          const testRef = doc(db, 'globalTests', testId);
          const testSnap = await getDoc(testRef);
          if (testSnap.exists()) {
              const testData = testSnap.data();
              const legacyIndex = testData.questions?.findIndex((q: Question) => q.id === questionId);
              if (legacyIndex !== undefined && legacyIndex > -1) {
                  const updatedQuestions = [...testData.questions];
                  updatedQuestions[legacyIndex].correctAnswer = newAnswer;
                  updatedQuestions[legacyIndex].isEdited = true;
                  await updateDoc(testRef, { questions: updatedQuestions });
              } else {
                  const qRef = doc(db, 'globalTests', testId, 'questions', questionId);
                  await updateDoc(qRef, { correctAnswer: newAnswer, isEdited: true });
                  setSubcollectionQuestions(prev => ({
                      ...prev,
                      [testId]: (prev[testId] || []).map(q => q.id === questionId ? { ...q, correctAnswer: newAnswer, isEdited: true } : q)
                  }));
              }
          }
      } catch (e) {
          console.error("Update Answer Failed:", e);
      }
  };
  
  const deleteTest = async (section: Section, testId: string, bankKey?: string, categoryKey?: string) => {
    try {
        const qColl = collection(db, 'globalTests', testId, 'questions');
        const qSnap = await getDocs(qColl);
        const BATCH_SIZE = 15;
        for (let i = 0; i < qSnap.docs.length; i += BATCH_SIZE) {
            const chunk = qSnap.docs.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        await deleteDoc(doc(db, 'globalTests', testId));
        setSubcollectionQuestions(prev => {
            const newState = { ...prev };
            delete newState[testId];
            return newState;
        });
    } catch(e) {
        console.error("Delete Test Failed:", e);
        throw e;
    }
  };

  const deleteTests = async (section: Section, testIds: string[]) => {
      try {
          for (const testId of testIds) {
             const qColl = collection(db, 'globalTests', testId, 'questions');
             const qSnap = await getDocs(qColl);
             const BATCH_SIZE = 3; 
             for (let i = 0; i < qSnap.docs.length; i += BATCH_SIZE) {
                 const chunk = qSnap.docs.slice(i, i + BATCH_SIZE);
                 const batch = writeBatch(db);
                 chunk.forEach(doc => batch.delete(doc.ref));
                 await batch.commit();
             }
             await deleteDoc(doc(db, 'globalTests', testId));
             setSubcollectionQuestions(prev => {
                const newState = { ...prev };
                delete newState[testId];
                return newState;
             });
          }
      } catch (e) {
          console.error("Bulk Delete Failed:", e);
          throw e; 
      }
  };
  
  const addQuestionsToReview = (section: Section, questions: Omit<FolderQuestion, 'id'>[]) => {
      if ((isDevUser && !isPreviewMode) || questions.length === 0) return;
      saveUserSpecificData(draft => {
          const REVIEW_TEST_MAX_QUESTIONS = 75;
          if (!draft.reviewTests) draft.reviewTests = { quantitative: [], verbal: [] };
          if (!draft.reviewedQuestionIds) draft.reviewedQuestionIds = {};
          const reviewTestsInSection = draft.reviewTests[section];
          const existingOriginalIds = new Set<string>();
          reviewTestsInSection.forEach((test: Test) => {
              test.questions.forEach(q => {
                  const fq = q as FolderQuestion;
                  if (fq.originalId) existingOriginalIds.add(fq.originalId);
              });
          });
          const uniqueQuestionsToAdd = questions.filter(q => q.originalId && !existingOriginalIds.has(q.originalId));
          if (uniqueQuestionsToAdd.length === 0) return;
          const newQuestionsWithIds = uniqueQuestionsToAdd.map(q => ({
              ...q,
              id: `q_review_${Date.now()}_${Math.random()}`
          }));
          let targetTest = reviewTestsInSection.length > 0 ? reviewTestsInSection[reviewTestsInSection.length - 1] : null;
          for (const questionToAdd of newQuestionsWithIds) {
              if (!targetTest || targetTest.questions.length >= REVIEW_TEST_MAX_QUESTIONS) {
                  const newTestNumber = reviewTestsInSection.length + 1;
                  targetTest = {
                      id: `review_${section}_${newTestNumber}_${Date.now()}`,
                      name: `مراجعة ${newTestNumber}`,
                      questions: []
                  };
                  draft.reviewTests[section].push(targetTest);
              }
              targetTest.questions.push(questionToAdd);
              draft.reviewedQuestionIds[questionToAdd.originalId || questionToAdd.id] = true;
          }
      });
  };

  const addAttemptToHistory = (attempt: Omit<TestAttempt, 'id'>) => {
    if ((isDevUser && !isPreviewMode) || attempt.testId.includes('review_')) return;
    const newAttempt: TestAttempt = { ...attempt, id: `attempt_${Date.now()}` };
    const questionsToReview: FolderQuestion[] = [];
    const answeredQuestions = new Map(attempt.answers.map(a => [a.questionId, a.answer]));
    attempt.questions.forEach((question, index) => {
        const userAnswer = answeredQuestions.get(question.id);
        const isCorrect = userAnswer && userAnswer.trim() === question.correctAnswer.trim();
        if (!isCorrect) {
            questionsToReview.push({
                ...question,
                originalId: question.id,
                userAnswer: userAnswer,
                addedDate: new Date().toISOString(),
                bankKey: attempt.bankKey,
                categoryKey: attempt.categoryKey,
                testName: attempt.testName,
                originalQuestionIndex: index,
                reviewType: 'mistake',
                sourceBank: attempt.bankKey ? VERBAL_BANKS[attempt.bankKey] : undefined,
                sourceSection: attempt.categoryKey ? VERBAL_CATEGORIES[attempt.categoryKey] : undefined,
                sourceTest: attempt.testName,
            });
        }
    });
    if (questionsToReview.length > 0) addQuestionsToReview(attempt.section, questionsToReview);
    saveUserSpecificData(draft => { draft.history.unshift(newAttempt); });
  };

  const createFolder = (section: Section, folderName: string): string => {
    if (isDevUser && !isPreviewMode) return '';
    const newFolder: Folder = { id: `folder_${Date.now()}`, name: folderName, questions: [] };
    saveUserSpecificData(draft => { draft.folders[section].push(newFolder); });
    return newFolder.id;
  };

  const deleteFolder = (section: Section, folderId: string) => {
    if ((isDevUser && !isPreviewMode) || folderId.startsWith('mistakes_')) return;
    saveUserSpecificData(draft => {
        draft.folders[section] = draft.folders[section].filter((folder: Folder) => folder.id !== folderId);
    });
  };

  const addQuestionToFolder = (section: Section, folderId: string, question: Question) => {
    if (isDevUser && !isPreviewMode) return;
    saveUserSpecificData(draft => {
        const folder = draft.folders[section].find((f: Folder) => f.id === folderId);
        if (folder && !folder.questions.some((q: Question) => q.id === question.id)) {
            const questionToAdd: FolderQuestion = { ...question, addedDate: new Date().toISOString() };
            folder.questions.push(questionToAdd);
        }
    });
  };
  
  const addDelayedQuestionToReview = (section: Section, question: Question, context: { bankKey?: string; categoryKey?: string, testName?: string, originalQuestionIndex?: number }) => {
      if (isDevUser && !isPreviewMode) return;
      const questionToAdd: Omit<FolderQuestion, 'id'> = {
          ...question,
          originalId: question.id,
          reviewType: 'delay',
          addedDate: new Date().toISOString(),
          ...context,
          sourceBank: context.bankKey ? VERBAL_BANKS[context.bankKey] : undefined,
          sourceSection: context.categoryKey ? VERBAL_CATEGORIES[context.categoryKey] : undefined,
          sourceTest: context.testName,
      };
      addQuestionsToReview(section, [questionToAdd]);
  };
    
  const addSpecialLawQuestionToReview = (section: Section, question: Question, context: { bankKey?: string; categoryKey?: string, testName?: string, originalQuestionIndex?: number }) => {
      if (isDevUser && !isPreviewMode) return;
      const questionToAdd: Omit<FolderQuestion, 'id'> = {
          ...question,
          originalId: question.id,
          reviewType: 'specialLaw',
          addedDate: new Date().toISOString(),
          ...context,
          sourceBank: context.bankKey ? VERBAL_BANKS[context.bankKey] : undefined,
          sourceSection: context.categoryKey ? VERBAL_CATEGORIES[context.categoryKey] : undefined,
          sourceTest: context.testName,
      };
      addQuestionsToReview(section, [questionToAdd]);
  };
    
  const deleteUserData = async (userKey?: string) => {
      if (!userKey) return;
      try {
          await deleteDoc(doc(db, 'users', userKey));
      } catch (e) {
          console.error("Failed to delete user data:", e);
      }
  };

  const reviewedQuestionIdsSet = useMemo(() => new Set(Object.keys(userData.reviewedQuestionIds || {})), [userData.reviewedQuestionIds]);

  return { 
    data, 
    settings,
    isLoading, 
    addTest, 
    addQuestionsToTest, 
    deleteTest, 
    deleteTests,
    updateQuestionAnswer,
    updateGlobalSettings,
    addAttemptToHistory, 
    createFolder, 
    addQuestionToFolder, 
    deleteFolder, 
    addQuestionsToReview, 
    deleteUserData, 
    addDelayedQuestionToReview, 
    addSpecialLawQuestionToReview, 
    reviewedQuestionIds: reviewedQuestionIdsSet,
    fetchTestQuestions 
  };
};
