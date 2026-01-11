
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc, collection, query, writeBatch, getDocs, orderBy } from 'firebase/firestore';

const initialVerbalTests: VerbalTests = Object.keys(VERBAL_BANKS).reduce((acc, bankKey) => {
  acc[bankKey] = Object.keys(VERBAL_CATEGORIES).reduce((catAcc, catKey) => {
    catAcc[catKey] = [];
    return catAcc;
  }, {} as { [category: string]: Test[] });
  return acc;
}, {} as VerbalTests);

const initialQuantTests: Test[] = [];

export const getInitialData = (): AppData => ({
  tests: { quantitative: initialQuantTests, verbal: initialVerbalTests },
  folders: {
    quantitative: [{ id: 'mistakes_quantitative', name: 'مجلد الأخطاء', questions: [] }],
    verbal: [{ id: 'mistakes_verbal', name: 'مجلد الأخطاء', questions: [] }],
  },
  reviewTests: { quantitative: [], verbal: [] },
  history: [],
  reviewedQuestionIds: {},
});

export const useAppData = (userId: string | null, isDevUser: boolean, isPreviewMode: boolean) => {
  const [globalTests, setGlobalTests] = useState<AppData['tests']>({
    quantitative: initialQuantTests,
    verbal: JSON.parse(JSON.stringify(initialVerbalTests))
  });

  const [subcollectionQuestions, setSubcollectionQuestions] = useState<Record<string, Question[]>>({});
  const [userData, setUserData] = useState<Omit<AppData, 'tests'>>(getInitialData());
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }
    const q = query(collection(db, 'globalTests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const newTestsStructure: AppData['tests'] = {
            quantitative: [],
            verbal: JSON.parse(JSON.stringify(initialVerbalTests))
        };
        
        querySnapshot.forEach((doc) => {
            const testData = { id: doc.id, ...doc.data(), questions: [] } as any;
            if (testData.section === 'quantitative') {
                newTestsStructure.quantitative.push(testData);
            } else if (testData.section === 'verbal' && testData.bankKey && testData.categoryKey) {
                if (newTestsStructure.verbal[testData.bankKey]?.[testData.categoryKey]) {
                    newTestsStructure.verbal[testData.bankKey][testData.categoryKey].push(testData);
                }
            }
        });
        setGlobalTests(newTestsStructure);
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) {
            const loaded = docSnap.data();
            setUserData({
                folders: loaded.folders || getInitialData().folders,
                history: loaded.history || [],
                reviewTests: loaded.reviewTests || { quantitative: [], verbal: [] },
                reviewedQuestionIds: loaded.reviewedQuestionIds || {}
            });
        }
    });
    return () => unsubscribe();
  }, [userId]);

  const fetchTestQuestions = useCallback(async (testId: string) => {
      try {
          const qSnap = await getDocs(collection(db, 'globalTests', testId, 'questions'));
          const questions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          setSubcollectionQuestions(prev => ({ ...prev, [testId]: questions }));
      } catch (e) { console.error("Fetch Qs error:", e); }
  }, []);

  const data: AppData = useMemo(() => {
      const mergedTests = JSON.parse(JSON.stringify(globalTests));
      const mergeQs = (test: Test) => {
          const extra = subcollectionQuestions[test.id] || [];
          test.questions = extra.sort((a, b) => (a.order || 0) - (b.order || 0));
      };
      mergedTests.quantitative.forEach(mergeQs);
      Object.keys(mergedTests.verbal).forEach(b => 
        Object.keys(mergedTests.verbal[b]).forEach(c => 
            mergedTests.verbal[b][c].forEach(mergeQs)
        )
      );
      return { tests: mergedTests, ...userData };
  }, [globalTests, userData, subcollectionQuestions]);

  const addTest = async (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    if (!isDevUser) return '';
    const testId = `test_${Date.now()}`;
    const testDoc: any = { creatorId: auth.currentUser?.uid, name: testName, section, createdAt: new Date().toISOString(), sourceText: sourceText || '' };
    if (bankKey) testDoc.bankKey = bankKey;
    if (categoryKey) testDoc.categoryKey = categoryKey;
    await setDoc(doc(db, 'globalTests', testId), testDoc);
    return testId;
  };

  const addQuestionsToTest = async (section: Section, testId: string, newQuestions: Omit<Question, 'id'>[]) => {
    if (!isDevUser) return;
    const batch = writeBatch(db);
    const addedQuestions: Question[] = [];
    newQuestions.forEach((q, idx) => {
        const qRef = doc(collection(db, 'globalTests', testId, 'questions'));
        const qData = { ...q, id: qRef.id, order: q.order ?? idx };
        batch.set(qRef, qData);
        addedQuestions.push(qData as Question);
    });
    await batch.commit();
    setSubcollectionQuestions(prev => ({ ...prev, [testId]: addedQuestions }));
  };

  const updateQuestionAnswer = async (section: Section, testId: string, questionId: string, newAnswer: string) => {
      if (!isDevUser) return;
      try {
          const qRef = doc(db, 'globalTests', testId, 'questions', questionId);
          await updateDoc(qRef, { correctAnswer: newAnswer, isEdited: true });
          setSubcollectionQuestions(prev => {
              const current = prev[testId] || [];
              const updated = current.map(q => q.id === questionId ? { ...q, correctAnswer: newAnswer, isEdited: true } : q);
              return { ...prev, [testId]: updated };
          });
      } catch (e) { console.error(e); }
  };

  const deleteTests = async (section: Section, testIds: string[]) => {
      if (!isDevUser || testIds.length === 0) return;
      
      try {
          // استخدام Batch لتنفيذ عمليات الحذف بكفاءة
          for (const testId of testIds) {
              // 1. جلب كل الأسئلة التابعة لهذا الاختبار
              const questionsRef = collection(db, 'globalTests', testId, 'questions');
              const qSnap = await getDocs(questionsRef);
              
              const batch = writeBatch(db);
              
              // 2. إضافة عمليات حذف الأسئلة للـ Batch
              qSnap.forEach((questionDoc) => {
                  batch.delete(questionDoc.ref);
              });
              
              // 3. إضافة عملية حذف الاختبار نفسه للـ Batch
              batch.delete(doc(db, 'globalTests', testId));
              
              // 4. تنفيذ الحذف
              await batch.commit();
              
              // 5. تنظيف الذاكرة المحلية فوراً لضمان اختفاء الاختبار من الشاشة
              setSubcollectionQuestions(prev => {
                  const next = { ...prev };
                  delete next[testId];
                  return next;
              });
          }
          
          // تأكيد الحذف في الذاكرة المحلية للهيكل العام
          setGlobalTests(prev => {
              const next = { ...prev };
              if (section === 'quantitative') {
                  next.quantitative = next.quantitative.filter(t => !testIds.includes(t.id));
              } else {
                  // للقسم اللفظي، نحتاج للمرور عبر البنوك والأقسام
                  Object.keys(next.verbal).forEach(bank => {
                      Object.keys(next.verbal[bank]).forEach(cat => {
                          next.verbal[bank][cat] = next.verbal[bank][cat].filter(t => !testIds.includes(t.id));
                      });
                  });
              }
              return next;
          });

      } catch (error) {
          console.error("Critical Error in deleteTests:", error);
          alert("حدث خطأ أثناء محاولة الحذف من قاعدة البيانات. تأكد من صلاحيات المطور.");
      }
  };

  const addAttemptToHistory = async (attempt: TestAttempt) => {
    if (!userId || (isDevUser && !isPreviewMode)) return;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const currentData = userDoc.exists() ? userDoc.data() : { history: [], reviewTests: { quantitative: [], verbal: [] } };
    const updatedHistory = [attempt, ...(currentData.history || [])];
    const updatedReviewTests = JSON.parse(JSON.stringify(currentData.reviewTests || { quantitative: [], verbal: [] }));
    attempt.answers.forEach(ans => {
        const q = attempt.questions.find(q => q.id === ans.questionId);
        if (q && q.correctAnswer !== ans.answer) {
            const newQ: FolderQuestion = { ...q, originalId: q.id, addedDate: new Date().toISOString(), reviewType: 'mistake', testName: attempt.testName };
            if (!(updatedReviewTests[attempt.section] as any)[0]) (updatedReviewTests[attempt.section] as any)[0] = { id: `rev_${attempt.section}`, name: 'مراجعة', questions: [] };
            (updatedReviewTests[attempt.section] as any)[0].questions.unshift(newQ);
        }
    });
    await updateDoc(userRef, { history: updatedHistory, reviewTests: updatedReviewTests });
  };

  const addDelayedQuestionToReview = async (section: Section, q: Question, context: any) => {
    if (!userId) return;
    const newData = JSON.parse(JSON.stringify(userData));
    const newQuestion: FolderQuestion = { ...q, originalId: q.id, addedDate: new Date().toISOString(), reviewType: 'delay', ...context };
    if (!newData.reviewTests[section][0]) newData.reviewTests[section][0] = { id: `rev_${section}`, name: 'مراجعة', questions: [] };
    newData.reviewTests[section][0].questions.unshift(newQuestion);
    await setDoc(doc(db, 'users', userId), newData, { merge: true });
  };

  const addSpecialLawQuestionToReview = async (section: Section, q: Question, context: any) => {
    if (!userId) return;
    const newData = JSON.parse(JSON.stringify(userData));
    const newQuestion: FolderQuestion = { ...q, originalId: q.id, addedDate: new Date().toISOString(), reviewType: 'specialLaw', ...context };
    if (!newData.reviewTests[section][0]) newData.reviewTests[section][0] = { id: `rev_${section}`, name: 'مراجعة', questions: [] };
    newData.reviewTests[section][0].questions.unshift(newQuestion);
    if (!newData.reviewedQuestionIds) newData.reviewedQuestionIds = {};
    newData.reviewedQuestionIds[q.id] = true;
    await setDoc(doc(db, 'users', userId), newData, { merge: true });
  };

  return { data, isLoading, addTest, addQuestionsToTest, deleteTests, updateQuestionAnswer, addAttemptToHistory, fetchTestQuestions, deleteUserData: (u:string)=>deleteDoc(doc(db,'users',u)), addDelayedQuestionToReview, addSpecialLawQuestionToReview, reviewedQuestionIds: new Set(Object.keys(userData.reviewedQuestionIds || {})) };
};
