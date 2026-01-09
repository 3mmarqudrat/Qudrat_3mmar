
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { AppSettings } from '../services/settingsService'; 
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc, collection, query, writeBatch, getDocs } from 'firebase/firestore';

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
    verbal: JSON.parse(JSON.stringify(initialVerbalTests))
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
  
  // الاستماع للاختبارات من السيرفر مع فحص الصلاحيات
  useEffect(() => {
    if (!userId || !auth.currentUser) {
      setIsLoading(false);
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
        setIsLoading(false);
    }, (error) => {
        // إذا كان الخطأ بسبب الصلاحيات، لا نعرض خطأ للمستخدم ولكن نوقف التحميل
        if (error.code === 'permission-denied') {
            console.debug("Firestore: الصلاحيات غير كافية حالياً.");
        } else {
            console.error("Snapshot error:", error);
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId || !auth.currentUser) return;
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
        }
    }, (error) => {
        if (error.code !== 'permission-denied') console.error("UserData Snapshot error:", error);
    });
    return () => unsubscribe();
  }, [userId]);

  const fetchTestQuestions = useCallback(async (testId: string) => {
      if (subcollectionQuestions[testId] || !auth.currentUser) return;
      try {
          const qSnap = await getDocs(collection(db, 'globalTests', testId, 'questions'));
          const questions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          setSubcollectionQuestions(prev => ({ ...prev, [testId]: questions }));
      } catch (e) {}
  }, [subcollectionQuestions]);

  const data: AppData = useMemo(() => {
      const mergedTests = JSON.parse(JSON.stringify(globalTests));
      const mergeQs = (test: Test) => {
          const extra = subcollectionQuestions[test.id] || [];
          const allQs = [...(test.questions || []), ...extra];
          const uniqueQs = Array.from(new Map(allQs.map(item => [item.id, item])).values());
          test.questions = uniqueQs.sort((a, b) => (a.order || 0) - (b.order || 0));
      };
      mergedTests.quantitative.forEach(mergeQs);
      Object.keys(mergedTests.verbal).forEach(b => 
        Object.keys(mergedTests.verbal[b]).forEach(c => 
            mergedTests.verbal[b][c].forEach(mergeQs)
        )
      );
      return { tests: mergedTests, ...userData };
  }, [globalTests, userData, subcollectionQuestions]);

  const addTest = (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    const currentUserId = auth.currentUser?.uid;
    if (!isDevUser || !currentUserId) return '';

    const testId = `test_${Date.now()}`;
    const testDoc: any = {
      creatorId: currentUserId,
      name: testName,
      section,
      createdAt: new Date().toISOString(),
      sourceText: sourceText || ''
    };
    if (bankKey) testDoc.bankKey = bankKey;
    if (categoryKey) testDoc.categoryKey = categoryKey;

    setGlobalTests(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        const newTestObj = { id: testId, questions: [], ...testDoc };
        if (section === 'quantitative') {
            next.quantitative.push(newTestObj);
        } else if (bankKey && categoryKey) {
            next.verbal[bankKey][categoryKey].push(newTestObj);
        }
        return next;
    });

    setDoc(doc(db, 'globalTests', testId), testDoc).catch(e => {
        console.error("Firebase Save Error:", e);
    });

    return testId;
  };

  const addQuestionsToTest = async (section: Section, testId: string, newQuestions: Omit<Question, 'id'>[]) => {
    const currentUserId = auth.currentUser?.uid;
    if (!isDevUser || !currentUserId) return;

    try {
        const batch = writeBatch(db);
        const added: Question[] = [];
        newQuestions.forEach((q, idx) => {
            const qRef = doc(collection(db, 'globalTests', testId, 'questions'));
            const qData = { 
                creatorId: currentUserId,
                ...q, 
                id: qRef.id, 
                order: q.order ?? idx 
            };
            batch.set(qRef, qData);
            added.push(qData as Question);
        });
        
        setSubcollectionQuestions(prev => ({ 
            ...prev, 
            [testId]: [...(prev[testId] || []), ...added] 
        }));

        await batch.commit();
    } catch (e) { 
        console.error("Add Questions Error:", e); 
    }
  };

  const updateQuestionAnswer = async (section: Section, testId: string, questionId: string, newAnswer: string) => {
      const currentUserId = auth.currentUser?.uid;
      if (!isDevUser || !currentUserId) return;
      try {
          const qRef = doc(db, 'globalTests', testId, 'questions', questionId);
          await updateDoc(qRef, { correctAnswer: newAnswer, isEdited: true, editorId: currentUserId });
          setSubcollectionQuestions(prev => ({
              ...prev,
              [testId]: (prev[testId] || []).map(q => q.id === questionId ? { ...q, correctAnswer: newAnswer, isEdited: true } : q)
          }));
      } catch (e) {}
  };

  const deleteTests = async (section: Section, testIds: string[]) => {
      if (!isDevUser || !auth.currentUser) return;
      
      setGlobalTests(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          if (section === 'quantitative') {
              next.quantitative = next.quantitative.filter((t: any) => !testIds.includes(t.id));
          } else {
              Object.keys(next.verbal).forEach(b => {
                  Object.keys(next.verbal[b]).forEach(c => {
                      next.verbal[b][c] = next.verbal[b][c].filter((t: any) => !testIds.includes(t.id));
                  });
              });
          }
          return next;
      });

      for (const id of testIds) {
          try {
              const qSnap = await getDocs(collection(db, 'globalTests', id, 'questions'));
              const batch = writeBatch(db);
              qSnap.forEach(d => batch.delete(d.ref));
              batch.delete(doc(db, 'globalTests', id));
              await batch.commit();
          } catch (e) {}
      }
  };

  const deleteTest = async (section: Section, testId: string) => {
    await deleteTests(section, [testId]);
  };

  const addAttemptToHistory = (attempt: Omit<TestAttempt, 'id'>) => {
    if (isDevUser && !isPreviewMode) return;
    if (!userId || !auth.currentUser) return;
    const newAttempt = { ...attempt, id: `att_${Date.now()}` };
    const newData = JSON.parse(JSON.stringify(userData));
    newData.history.unshift(newAttempt);
    setUserData(newData);
    setDoc(doc(db, 'users', userId), newData, { merge: true }).catch(e => console.error("History Save Error:", e));
  };

  const deleteUserData = async (uid: string) => {
    if (!isDevUser || !auth.currentUser) return;
    await deleteDoc(doc(db, 'users', uid));
  };

  const addDelayedQuestionToReview = (section: Section, q: Question, context: any) => {
    if (!userId || !auth.currentUser) return;
    const newQuestion: FolderQuestion = {
      ...q,
      originalId: q.id,
      addedDate: new Date().toISOString(),
      reviewType: 'delay',
      ...context
    };
    const newData = JSON.parse(JSON.stringify(userData));
    if (!newData.reviewTests[section][0]) {
        newData.reviewTests[section][0] = { id: `rev_${section}_1`, name: 'مراجعة 1', questions: [] };
    }
    newData.reviewTests[section][0].questions.push(newQuestion);
    setUserData(newData);
    setDoc(doc(db, 'users', userId), newData, { merge: true });
  };

  const addSpecialLawQuestionToReview = (section: Section, q: Question, context: any) => {
    if (!userId || !auth.currentUser) return;
    const newQuestion: FolderQuestion = {
      ...q,
      originalId: q.id,
      addedDate: new Date().toISOString(),
      reviewType: 'specialLaw',
      ...context
    };
    const newData = JSON.parse(JSON.stringify(userData));
    if (!newData.reviewTests[section][0]) {
        newData.reviewTests[section][0] = { id: `rev_${section}_1`, name: 'مراجعة 1', questions: [] };
    }
    newData.reviewTests[section][0].questions.push(newQuestion);
    setUserData(newData);
    setDoc(doc(db, 'users', userId), newData, { merge: true });
  };

  const reviewedQuestionIds = useMemo(() => {
    return new Set(Object.keys(userData.reviewedQuestionIds || {}));
  }, [userData.reviewedQuestionIds]);

  return { 
    data, settings, isLoading, 
    addTest, addQuestionsToTest, deleteTest, deleteTests, updateQuestionAnswer, 
    addAttemptToHistory, fetchTestQuestions, deleteUserData,
    addDelayedQuestionToReview, addSpecialLawQuestionToReview, reviewedQuestionIds
  };
};
