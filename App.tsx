
import React, { useState, useEffect } from 'react';
import { useAppData } from './hooks/useAppData';
import { TakeTestView } from './components/TakeTestView';
import { AuthView } from './components/AuthView';
import { SummaryView } from './components/SummaryView';
import { VerbalManagementView } from './components/VerbalManagementView';
import { QuantitativeManagementView } from './components/QuantitativeManagementView';
import { AdminView } from './components/AdminView';
import { User, Test, Section, UserAnswer, VERBAL_BANKS, VERBAL_CATEGORIES } from './types';
import { authService } from './services/authService';
import { useQuantitativeProcessor } from './hooks/useQuantitativeProcessor';

/**
 * Main App Component
 * Manages global state, authentication, and routing between different views of the application.
 */
const App: React.FC = () => {
    // State management for navigation and test session
    const [user, setUser] = useState<User | null>(null);
    const [page, setPage] = useState<string>('auth');
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [currentTest, setCurrentTest] = useState<Test | null>(null);
    const [currentTestContext, setCurrentTestContext] = useState<{ bankKey?: string; categoryKey?: string }>({});
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [returnPath, setReturnPath] = useState<string | null>(null);
    const [lastAttempt, setLastAttempt] = useState<any>(null);

    // Initialize data hooks
    const { 
        data, 
        isLoading,
        addTest,
        addQuestionsToTest,
        deleteTest,
        deleteTests,
        updateQuestionAnswer,
        addAttemptToHistory,
        addQuestionsToReview,
        deleteUserData,
        addDelayedQuestionToReview,
        addSpecialLawQuestionToReview,
        reviewedQuestionIds,
        fetchTestQuestions
    } = useAppData(user?.uid || null, user?.isDeveloper || false, false);

    const { 
        queue: processorQueue, 
        isProcessing: isProcessorWorking, 
        addFilesToQueue, 
        clearCompleted, 
        cancelAll: onStopProcessing 
    } = useQuantitativeProcessor(addTest, addQuestionsToTest);

    // Handle Authentication status changes
    useEffect(() => {
        const unsub = authService.onAuthStateChanged((u) => {
            setUser(u);
            if (u) {
                setPage('home');
            } else {
                setPage('auth');
            }
        });
        return () => unsub();
    }, []);

    // Navigation helpers
    const navigate = (p: string, clearState: boolean = false) => {
        setPage(p);
        if (clearState) {
            setUserAnswers([]);
            setElapsedTime(0);
        }
    };

    const goBack = () => {
        setPage('home');
    };

    const handleFinishTest = (answers: UserAnswer[], duration: number) => {
        if (currentTest && selectedSection) {
            const score = answers.filter(a => {
                const q = currentTest.questions.find(qu => qu.id === a.questionId);
                return q && q.correctAnswer === a.answer;
            }).length;

            const attempt = {
                testId: currentTest.id,
                testName: currentTest.name,
                section: selectedSection,
                bankKey: currentTestContext.bankKey,
                categoryKey: currentTestContext.categoryKey,
                date: new Date().toISOString(),
                score,
                totalQuestions: currentTest.questions.length,
                answers,
                questions: currentTest.questions,
                durationSeconds: duration
            };
            
            addAttemptToHistory(attempt);
            setLastAttempt({ ...attempt, id: 'last' });
            setPage('summary');
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-bg flex items-center justify-center text-text">جاري التحميل...</div>;
    }

    return (
        <div className="min-h-screen bg-bg text-text">
            {page === 'auth' && (
                <AuthView 
                    onLoginSuccess={(u) => { setUser(u); setPage('home'); }} 
                    recentUser={null} 
                />
            )}
            
            {page === 'home' && (
                <div className="p-8 space-y-4">
                    <h1 className="text-3xl font-bold">مرحباً {user?.username}</h1>
                    <div className="flex flex-col gap-2 max-w-xs">
                        <button className="bg-primary p-2 rounded text-white" onClick={() => navigate('verbalManagement')}>إدارة القسم اللفظي</button>
                        <button className="bg-primary p-2 rounded text-white" onClick={() => navigate('quantitativeManagement')}>إدارة القسم الكمي</button>
                        {user?.isDeveloper && (
                            <button className="bg-accent p-2 rounded text-white" onClick={() => navigate('admin')}>إدارة المستخدمين</button>
                        )}
                        <button className="bg-red-600 p-2 rounded text-white" onClick={() => authService.logout()}>تسجيل الخروج</button>
                    </div>
                </div>
            )}

            {page === 'verbalManagement' && (
                <VerbalManagementView 
                    data={data}
                    onBack={goBack}
                    onAddTest={addTest}
                    onAddQuestionsToTest={addQuestionsToTest}
                    onDeleteTest={deleteTest}
                    onUpdateQuestionAnswer={updateQuestionAnswer}
                />
            )}

            {page === 'quantitativeManagement' && (
                <QuantitativeManagementView 
                    onBack={goBack}
                    onStartTest={(test) => { setCurrentTest(test); setSelectedSection('quantitative'); setPage('takeTest'); }}
                    data={data}
                    onAddTest={addTest}
                    onAddQuestionsToTest={addQuestionsToTest}
                    onUpdateQuestionAnswer={updateQuestionAnswer}
                    onDeleteTests={deleteTests}
                    processorQueue={processorQueue}
                    isProcessorWorking={isProcessorWorking}
                    onAddFilesToQueue={addFilesToQueue}
                    onClearCompleted={clearCompleted}
                    onStopProcessing={onStopProcessing}
                    onSelectTest={fetchTestQuestions}
                />
            )}

            {page === 'admin' && (
                <AdminView 
                    onBack={goBack}
                    onPreviewUser={() => {}}
                    onDeleteUser={deleteUserData}
                />
            )}

            {page === 'summary' && lastAttempt && (
                <SummaryView 
                    attempt={lastAttempt}
                    onBack={goBack}
                    onReview={() => setPage('takeTest')}
                    user={user!}
                    onLogout={() => authService.logout()}
                />
            )}

            {page === 'takeTest' && currentTest && (
                <TakeTestView 
                    test={currentTest} 
                    onFinishTest={handleFinishTest} 
                    onBack={() => { if (returnPath) navigate(returnPath, true); else goBack(); }}
                    initialAnswers={userAnswers}
                    initialElapsedTime={elapsedTime}
                    onStateChange={(answers, time) => { setUserAnswers(answers); setElapsedTime(time); }}
                    onAddDelayedReview={(q, qIndex) => selectedSection && addDelayedQuestionToReview(selectedSection, q, {bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, testName: currentTest.name, originalQuestionIndex: qIndex})}
                    onAddSpecialLawReview={(q, qIndex) => selectedSection && addSpecialLawQuestionToReview(selectedSection, q, {bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, testName: currentTest.name, originalQuestionIndex: qIndex})}
                    onAddBookmarkReview={(q, qIndex) => {
                         if (selectedSection) {
                            addQuestionsToReview(selectedSection, [{
                                ...q,
                                originalId: q.id,
                                reviewType: 'delay', // Using delay folder for manual bookmarks
                                addedDate: new Date().toISOString(),
                                bankKey: currentTestContext.bankKey,
                                categoryKey: currentTestContext.categoryKey,
                                testName: currentTest.name,
                                originalQuestionIndex: qIndex,
                                sourceBank: currentTestContext.bankKey ? VERBAL_BANKS[currentTestContext.bankKey] : undefined,
                                sourceSection: currentTestContext.categoryKey ? VERBAL_CATEGORIES[currentTestContext.categoryKey] : undefined,
                                sourceTest: currentTest.name,
                            }]);
                        }
                    }}
                    reviewedQuestionIds={reviewedQuestionIds}
                />
            )}
        </div>
    );
};

export default App;
