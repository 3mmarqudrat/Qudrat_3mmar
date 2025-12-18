
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Test, UserAnswer, TestAttempt, Question, FolderQuestion, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, ClockIcon, CheckCircleIcon, XCircleIcon, BookmarkIcon, ChevronDownIcon, InfoIcon, FileTextIcon, EyeIcon, ZoomInIcon, StarIcon, LogOutIcon, BookOpenIcon, ArrowLeftIcon } from './Icons';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${toArabic(String(minutes).padStart(2, '0'))}:${toArabic(String(seconds).padStart(2, '0'))}`;
};

const extractPassageAndQuestion = (fullText: string) => {
    const passageMarker = "**النص:**";
    const questionMarker = "**السؤال:**";
    if (fullText.includes(passageMarker) && fullText.includes(questionMarker)) {
        const parts = fullText.split(questionMarker);
        const passagePart = parts[0].replace(passageMarker, '').trim();
        const questionPart = parts[1].trim();
        return { passage: passagePart, cleanQuestion: questionPart };
    }
    return { passage: null, cleanQuestion: fullText };
};

const QuestionAccordion: React.FC<{
    question: Question | FolderQuestion;
    qNumber: number;
    isReviewMode: boolean;
    userAnswer: string | undefined;
    onSelectAnswer: (answer: string) => void;
    isFlagged: boolean;
    onToggleFlag: () => void;
    isSpecialLaw: boolean;
    onToggleSpecialLaw: () => void;
    isFlagButtonDisabled: boolean;
    onShowInfo: () => void;
    isReviewTest: boolean;
    isQuantitative: boolean;
    onZoomImage: (src: string) => void;
}> = ({ question, qNumber, isReviewMode, userAnswer, onSelectAnswer, isFlagged, onToggleFlag, isSpecialLaw, onToggleSpecialLaw, isFlagButtonDisabled, onShowInfo, isReviewTest, isQuantitative, onZoomImage }) => {
    const hasAnswered = userAnswer !== undefined;
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleHeaderClick = () => {
        if (isQuantitative) return;
        if (hasAnswered || isReviewMode) setIsCollapsed(!isCollapsed);
    };
    
    const getOptionClass = (option: string) => {
        if (!isReviewMode) {
             return userAnswer === option ? 'bg-sky-700 text-white ring-2 ring-sky-300 shadow-lg shadow-sky-500/20' : 'bg-surface hover:bg-zinc-700/50 border-zinc-700 hover:border-zinc-500';
        }
        const isCorrect = option === question.correctAnswer;
        const isSelected = option === userAnswer;
        if (isCorrect) return 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]';
        if (isSelected && !isCorrect) return 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]';
        return 'bg-zinc-800 border-border opacity-60';
    };

    const folderQuestion = question as FolderQuestion;
    const sourceSectionName = folderQuestion.sourceSection;
    const reviewType = folderQuestion.reviewType;

    const gridClass = isQuantitative ? 'grid-cols-4' : 'grid-cols-1 sm:grid-cols-2';

    return (
        <div className={`bg-surface rounded-lg border border-border overflow-hidden ${isQuantitative ? 'shadow-2xl' : ''}`}>
            <div 
                className={`flex justify-between items-center p-4 ${(!isQuantitative && (hasAnswered || isReviewMode)) ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={handleHeaderClick}
            >
                <div className="flex items-center gap-4 w-full overflow-hidden">
                     <div className="flex-shrink-0 flex items-center gap-2">
                        {isReviewTest && (
                            <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-2 rounded-full hover:bg-zinc-600 transition-colors" title="معلومات السؤال">
                                <InfoIcon className="w-5 h-5 text-sky-400"/>
                            </button>
                        )}
                        {!isReviewMode && !isReviewTest && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onToggleFlag(); }} disabled={isFlagButtonDisabled} className="p-2 rounded-full hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="تأجيل / إضافة للمراجعة">
                                    <svg className={`w-6 h-6 ${isFlagged ? 'text-yellow-400 fill-current' : 'text-zinc-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                        <line x1="4" y1="22" x2="4" y2="15"></line>
                                    </svg>
                                </button>
                                {isQuantitative && (
                                     <button onClick={(e) => { e.stopPropagation(); onToggleSpecialLaw(); }} disabled={isFlagButtonDisabled} className="p-2 rounded-full hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="إضافة السؤال لقانون خاص">
                                        <StarIcon className="w-5 h-5 text-purple-400" isFilled={isSpecialLaw} />
                                    </button>
                                )}
                            </>
                        )}
                     </div>
                    <div className="w-full overflow-hidden">
                         <div className="text-xl md:text-2xl font-bold leading-relaxed text-right flex justify-between items-center gap-4" style={{color: 'var(--color-gold)'}}>
                            <div className="flex flex-col gap-1 w-full">
                                <div className="flex justify-between items-start w-full">
                                     <span className="break-words w-full">
                                        <span className="text-text-muted select-none">{toArabic(qNumber)}. </span>
                                        {question.questionText}
                                    </span>
                                </div>
                                {isReviewMode && (
                                    <div className="mt-1 flex flex-wrap gap-4 items-center">
                                        <span className="text-sm font-bold text-success bg-green-900/30 px-2 py-1 rounded inline-block">الإجابة الصحيحة: {question.correctAnswer}</span>
                                        {question.verificationImage && (
                                            <div className="flex items-center gap-2 bg-zinc-900/50 px-2 py-1 rounded border border-zinc-700 max-w-full overflow-hidden">
                                                <span className="text-xs text-text-muted flex-shrink-0">المصدر:</span>
                                                <img src={question.verificationImage} alt="Answer Source" className="h-16 object-contain rounded-sm bg-white" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                             {isReviewTest && sourceSectionName && (
                                <div className="flex flex-col items-end gap-1 text-xs font-mono flex-shrink-0 hidden sm:flex">
                                    <span className="bg-zinc-700 text-cyan-400 px-2 py-1 rounded-md">{sourceSectionName}</span>
                                    {reviewType === 'mistake' && <span className="bg-red-900/70 text-red-300 px-2 py-1 rounded-md">(خطأ)</span>}
                                    {reviewType === 'delay' && <span className="bg-yellow-800/70 text-yellow-300 px-2 py-1 rounded-md">(تأخير)</span>}
                                    {reviewType === 'specialLaw' && <span className="bg-purple-900/70 text-purple-300 px-2 py-1 rounded-md">(قانون خاص)</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {!isQuantitative && (hasAnswered || isReviewMode) && (
                     <ChevronDownIcon className={`w-6 h-6 text-text-muted transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`} />
                )}
            </div>
            
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                 <div className="overflow-hidden">
                    <div className="p-4 border-t border-border bg-black/10">
                        {question.questionImage && (
                            <div className={`mb-6 flex justify-center relative group ${isQuantitative ? 'w-full' : ''}`}>
                                <img 
                                    src={question.questionImage} 
                                    alt="سؤال" 
                                    onClick={(e) => { e.stopPropagation(); onZoomImage(question.questionImage!); }}
                                    className={`rounded-lg border border-zinc-600 shadow-xl ${isQuantitative ? 'w-full max-h-[70vh] object-contain bg-white p-2' : 'max-w-full max-h-64 cursor-zoom-in'}`} 
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <span className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                        <ZoomInIcon className="w-3 h-3" /> تكبير
                                    </span>
                                </div>
                            </div>
                        )}
                        <div className={`grid gap-4 ${gridClass}`}>
                            {question.options.map((option, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => onSelectAnswer(option)} 
                                    disabled={isReviewMode}
                                    className={`w-full text-center p-5 rounded-lg border text-xl md:text-2xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${getOptionClass(option)} ${!isReviewMode && 'active:scale-95'}`}
                                >
                                    {isReviewMode && !isQuantitative && (
                                        <span className="inline-block flex-shrink-0">
                                            {option === question.correctAnswer && <CheckCircleIcon className="w-6 h-6 text-white"/>}
                                            {option === userAnswer && option !== question.correctAnswer && <XCircleIcon className="w-6 h-6 text-white"/>}
                                        </span>
                                    )}
                                    <span className="break-words">{option}</span>
                                </button>
                            ))}
                        </div>
                        {isReviewMode && userAnswer === undefined && (
                            <div className="mt-4 text-center p-3 bg-red-900/40 border border-red-700 rounded-md">
                                <p className="font-bold text-red-400">لم يتم حل السؤال</p>
                            </div>
                        )}
                     </div>
                 </div>
            </div>
        </div>
    )
}


interface TakeTestViewProps {
    test: Test;
    onFinishTest: (answers: UserAnswer[], duration: number) => void;
    onBack?: () => void;
    reviewAttempt?: TestAttempt;
    initialAnswers?: UserAnswer[];
    initialElapsedTime?: number;
    onStateChange?: (answers: UserAnswer[], time: number) => void;
    onAddDelayedReview?: (question: Question, qIndex: number) => void;
    onAddSpecialLawReview?: (question: Question, qIndex: number) => void;
    reviewedQuestionIds?: Set<string>;
    onBackToSummary?: () => void;
    onBackToSection?: () => void;
}

export const TakeTestView: React.FC<TakeTestViewProps> = ({ test, onFinishTest, onBack, reviewAttempt, initialAnswers, initialElapsedTime, onStateChange, onAddDelayedReview, onAddSpecialLawReview, reviewedQuestionIds = new Set(), onBackToSummary, onBackToSection }) => {
    const isReviewMode = !!reviewAttempt;
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>(initialAnswers || (reviewAttempt ? reviewAttempt.answers : []));
    const [elapsedTime, setElapsedTime] = useState(initialElapsedTime || 0);
    const [sessionFlaggedIds, setSessionFlaggedIds] = useState<Set<string>>(new Set());
    const [sessionSpecialLawIds, setSessionSpecialLawIds] = useState<Set<string>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0); // For Quantitative Pagination
    const [infoModalQuestion, setInfoModalQuestion] = useState<FolderQuestion | null>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
    const timerRef = useRef<number | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const isReviewTest = test.id.includes('review_');
    const isQuantitative = useMemo(() => test.questions.length > 0 && !!test.questions[0].questionImage, [test]);

    const uniquePassages = useMemo(() => {
        const passages: string[] = [];
        test.questions.forEach(q => {
             const { passage } = extractPassageAndQuestion(q.questionText);
             if (passage && !passages.includes(passage)) passages.push(passage);
        });
        return passages;
    }, [test.questions]);

    const commitSessionFlagsToReview = useCallback(() => {
        if (onAddDelayedReview) {
            sessionFlaggedIds.forEach(id => {
                if (reviewedQuestionIds.has(id)) return; 
                const q = test.questions.find(x => x.id === id);
                const idx = test.questions.findIndex(x => x.id === id);
                if (q) onAddDelayedReview(q, idx);
            });
        }
        if (onAddSpecialLawReview) {
             sessionSpecialLawIds.forEach(id => {
                if (reviewedQuestionIds.has(id)) return; 
                const q = test.questions.find(x => x.id === id);
                const idx = test.questions.findIndex(x => x.id === id);
                if (q) onAddSpecialLawReview(q, idx);
            });
        }
    }, [sessionFlaggedIds, sessionSpecialLawIds, onAddDelayedReview, onAddSpecialLawReview, test.questions, reviewedQuestionIds]);

    useEffect(() => {
        if (!isReviewMode) {
            timerRef.current = window.setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isReviewMode]);

    useEffect(() => { if (onStateChange) onStateChange(userAnswers, elapsedTime); }, [userAnswers, elapsedTime, onStateChange]);
    
    const handleSelectAnswer = (questionId: string, answer: string) => {
        if (isReviewMode) return;
        setUserAnswers(prev => {
            const existing = prev.find(a => a.questionId === questionId);
            if (existing) return prev.map(a => a.questionId === questionId ? { ...a, answer } : a);
            return [...prev, { questionId, answer }];
        });
        // In Quantitative, auto-advance could be a choice, but usually user wants to confirm
    };

    const handleToggleFlag = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
        setSessionFlaggedIds(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
            return next;
        });
    };
    
    const handleToggleSpecialLaw = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
         setSessionSpecialLawIds(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
            return next;
        });
    };
    
    const handleFinish = () => {
        if(timerRef.current) clearInterval(timerRef.current);
        commitSessionFlagsToReview();
        onFinishTest(userAnswers, elapsedTime);
    }
    
    const handleConfirmExit = () => { if (onBack) onBack(); };

    const reviewSummary = useMemo(() => {
        if (!isReviewMode || !reviewAttempt) return { all: 0, correct: 0, incorrect: 0, unanswered: 0 };
        const answersMap = new Map(reviewAttempt.answers.map(a => [a.questionId, a.answer]));
        let correct = 0, incorrect = 0;
        reviewAttempt.questions.forEach(q => {
            const ua = answersMap.get(q.id);
            if (ua) { if (ua === q.correctAnswer) correct++; else incorrect++; }
        });
        return { all: reviewAttempt.totalQuestions, correct, incorrect, unanswered: reviewAttempt.totalQuestions - (correct + incorrect) };
    }, [isReviewMode, reviewAttempt]);

    const filteredQuestions = useMemo(() => {
        if (!isReviewMode || reviewFilter === 'all' || !reviewAttempt) return test.questions;
        const answersMap = new Map(reviewAttempt.answers.map(a => [a.questionId, a.answer]));
        return test.questions.filter(q => {
            const ua = answersMap.get(q.id);
            if (reviewFilter === 'correct') return ua === q.correctAnswer;
            if (reviewFilter === 'incorrect') return ua && ua !== q.correctAnswer;
            if (reviewFilter === 'unanswered') return !ua;
            return true;
        });
    }, [test.questions, reviewFilter, isReviewMode, reviewAttempt]);

    const handleBackNavigation = () => { if (isReviewMode) { if(onBackToSummary) onBackToSummary(); } else setShowExitConfirm(true); };

    const currentQuestion = test.questions[currentIndex];
    const totalQuestions = test.questions.length;
    const answeredCount = userAnswers.length;
    const flaggedCount = sessionFlaggedIds.size;
    const unansweredCount = totalQuestions - answeredCount;

    return (
        <div className="bg-bg min-h-screen flex flex-col">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-40 border-b border-border shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={handleBackNavigation} className="p-2 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors">
                            <ArrowRightIcon className="w-5 h-5 text-text-muted"/>
                        </button>
                        <h1 className="text-lg md:text-xl font-bold text-text truncate max-w-[150px] md:max-w-md" title={test.name}>{isReviewMode ? `مراجعة: ${test.name}` : test.name}</h1>
                    </div>

                    {isReviewMode && (
                        <div className="hidden lg:flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-zinc-700/50">
                            {(['all', 'correct', 'incorrect', 'unanswered'] as const).map(f => (
                                <button key={f} onClick={() => setReviewFilter(f)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${reviewFilter === f ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-white'}`}>
                                    {f === 'all' && 'الكل'} {f === 'correct' && 'صح'} {f === 'incorrect' && 'خطأ'} {f === 'unanswered' && 'متروك'}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="font-mono text-lg text-cyan-400 bg-black/40 px-3 py-1.5 rounded-lg border border-cyan-500/30">
                        {formatTime(elapsedTime)}
                    </div>
                </div>
            </header>
            
            <div className="flex-grow flex overflow-hidden">
                {/* Stats Sidebar - Small and informative */}
                <aside className="hidden lg:flex flex-col w-64 border-l border-border bg-surface/50 p-6 gap-6 flex-shrink-0">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest">إحصائيات الاختبار</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700 flex flex-col items-center">
                                <span className="text-3xl font-bold text-white">{toArabic(totalQuestions)}</span>
                                <span className="text-xs text-text-muted mt-1">إجمالي الأسئلة</span>
                            </div>
                            <div className="bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30 flex flex-col items-center">
                                <span className="text-3xl font-bold text-emerald-400">{toArabic(answeredCount)}</span>
                                <span className="text-xs text-emerald-500/70 mt-1">تم الحل</span>
                            </div>
                            <div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30 flex flex-col items-center">
                                <span className="text-3xl font-bold text-red-400">{toArabic(unansweredCount)}</span>
                                <span className="text-xs text-red-500/70 mt-1">متبقي</span>
                            </div>
                            <div className="bg-yellow-900/20 p-4 rounded-xl border border-yellow-500/30 flex flex-col items-center">
                                <span className="text-3xl font-bold text-yellow-400">{toArabic(flaggedCount)}</span>
                                <span className="text-xs text-yellow-500/70 mt-1">مؤجل (مراجعة)</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Progress Dots for navigation if needed */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                        <h4 className="text-xs font-bold text-text-muted mb-3">خريطة الأسئلة</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {test.questions.map((_, i) => {
                                const isAns = userAnswers.some(a => a.questionId === test.questions[i].id);
                                const isFlag = sessionFlaggedIds.has(test.questions[i].id);
                                return (
                                    <button 
                                        key={i} 
                                        onClick={() => isQuantitative && setCurrentIndex(i)}
                                        className={`w-8 h-8 rounded text-[10px] font-bold border transition-colors ${
                                            currentIndex === i ? 'border-primary ring-2 ring-primary/30' : 'border-zinc-700'
                                        } ${isFlag ? 'bg-yellow-600/50' : isAns ? 'bg-emerald-600/50' : 'bg-zinc-800'}`}
                                    >
                                        {toArabic(i + 1)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                <main className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-8">
                    <div className="max-w-4xl mx-auto pb-24">
                        {isQuantitative && !isReviewMode ? (
                            /* Paginated View for Quantitative */
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex justify-between items-center bg-zinc-800/50 p-3 rounded-lg border border-zinc-700">
                                    <span className="text-sm font-bold text-text-muted">السؤال {toArabic(currentIndex + 1)} من {toArabic(totalQuestions)}</span>
                                    <div className="flex gap-2">
                                        <div className={`w-2 h-2 rounded-full ${userAnswers.some(a => a.questionId === currentQuestion.id) ? 'bg-emerald-500' : 'bg-zinc-600'}`}></div>
                                        {sessionFlaggedIds.has(currentQuestion.id) && <div className="w-2 h-2 rounded-full bg-yellow-500"></div>}
                                    </div>
                                </div>
                                
                                <QuestionAccordion 
                                    question={currentQuestion}
                                    qNumber={currentIndex + 1}
                                    isReviewMode={false}
                                    userAnswer={userAnswers.find(a => a.questionId === currentQuestion.id)?.answer}
                                    onSelectAnswer={(answer) => handleSelectAnswer(currentQuestion.id, answer)}
                                    isFlagged={sessionFlaggedIds.has(currentQuestion.id)}
                                    onToggleFlag={() => handleToggleFlag(currentQuestion.id)}
                                    isSpecialLaw={sessionSpecialLawIds.has(currentQuestion.id)}
                                    onToggleSpecialLaw={() => handleToggleSpecialLaw(currentQuestion.id)}
                                    isFlagButtonDisabled={reviewedQuestionIds.has(currentQuestion.id)}
                                    onShowInfo={() => setInfoModalQuestion(currentQuestion as FolderQuestion)}
                                    isReviewTest={isReviewTest}
                                    isQuantitative={true}
                                    onZoomImage={(src) => setFullScreenImage(src)}
                                />

                                <div className="flex justify-between items-center pt-8">
                                    <button 
                                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                        disabled={currentIndex === 0}
                                        className="flex items-center gap-2 px-6 py-3 bg-zinc-700 text-white rounded-lg disabled:opacity-30 hover:bg-zinc-600 transition-colors font-bold"
                                    >
                                        <ArrowRightIcon className="w-5 h-5"/> السابق
                                    </button>
                                    
                                    {currentIndex === totalQuestions - 1 ? (
                                        <button 
                                            onClick={handleFinish} 
                                            className="px-10 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 transform hover:scale-105 transition-all"
                                        >
                                            إنهاء الاختبار
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                                            className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-bold"
                                        >
                                            التالي <ArrowLeftIcon className="w-5 h-5"/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Classic List View for Verbal or Review */
                            <div className="space-y-4">
                                {filteredQuestions.map((q, idx) => {
                                    const origIdx = test.questions.findIndex(x => x.id === q.id);
                                    const { passage, cleanQuestion } = extractPassageAndQuestion(q.questionText);
                                    return (
                                        <div key={q.id}>
                                            {passage && (
                                                <div className="mb-4 mt-6 p-5 bg-zinc-800/80 rounded-lg border-r-4 border-primary shadow-md">
                                                    <h3 className="text-primary font-bold mb-3 flex items-center gap-2 text-lg border-b border-zinc-700 pb-2">
                                                        <BookOpenIcon className="w-5 h-5"/> قطعة {toArabic(uniquePassages.indexOf(passage) + 1)}
                                                    </h3>
                                                    <div className="text-lg leading-loose text-slate-200 whitespace-pre-wrap pl-2 font-medium">{passage}</div>
                                                </div>
                                            )}
                                            <QuestionAccordion 
                                                question={{...q, questionText: cleanQuestion}}
                                                qNumber={origIdx + 1}
                                                isReviewMode={isReviewMode}
                                                userAnswer={userAnswers.find(a => a.questionId === q.id)?.answer}
                                                onSelectAnswer={(answer) => handleSelectAnswer(q.id, answer)}
                                                isFlagged={reviewedQuestionIds.has(q.id) || sessionFlaggedIds.has(q.id)}
                                                onToggleFlag={() => handleToggleFlag(q.id)}
                                                isSpecialLaw={reviewedQuestionIds.has(q.id) || sessionSpecialLawIds.has(q.id)}
                                                onToggleSpecialLaw={() => handleToggleSpecialLaw(q.id)}
                                                isFlagButtonDisabled={reviewedQuestionIds.has(q.id)}
                                                onShowInfo={() => setInfoModalQuestion(q as FolderQuestion)}
                                                isReviewTest={isReviewTest}
                                                isQuantitative={isQuantitative}
                                                onZoomImage={(src) => setFullScreenImage(src)}
                                            />
                                        </div>
                                    );
                                })}
                                {!isReviewMode && (
                                    <div className="mt-12 text-center">
                                        <button onClick={handleFinish} className="px-12 py-3 bg-accent text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-xl shadow-accent/20">إنهاء الاختبار</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {isReviewMode && (
                <footer className="bg-surface/90 backdrop-blur-xl p-4 sticky bottom-0 z-40 border-t border-border shadow-2xl">
                    <div className="container mx-auto flex justify-center items-center gap-6">
                         <button onClick={onBackToSummary} className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 transform hover:scale-105 shadow-lg shadow-blue-500/20">
                             <FileTextIcon className="w-5 h-5"/> عرض النتائج
                         </button>
                         <button onClick={onBackToSection} className="px-8 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20">
                             <LogOutIcon className="w-5 h-5"/> المغادرة
                         </button>
                    </div>
                </footer>
            )}
            
             {infoModalQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setInfoModalQuestion(null)}>
                    <div className="bg-surface rounded-lg p-6 m-4 max-w-sm w-full shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-primary">مصدر السؤال</h3>
                        <div className="space-y-2 text-sm">
                            <p><strong className="text-text-muted">البنك:</strong> {infoModalQuestion.sourceBank || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">القسم:</strong> {infoModalQuestion.sourceSection || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">الاختبار الأصلي:</strong> {infoModalQuestion.sourceTest || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">رقم السؤال الأصلي:</strong> {infoModalQuestion.originalQuestionIndex !== undefined ? toArabic(infoModalQuestion.originalQuestionIndex + 1) : 'غير محدد'}</p>
                            <p><strong className="text-text-muted">تاريخ الإضافة للمراجعة:</strong> {infoModalQuestion.addedDate ? new Date(infoModalQuestion.addedDate).toLocaleString('ar-SA') : 'غير محدد'}</p>
                        </div>
                         <button onClick={() => setInfoModalQuestion(null)} className="mt-6 w-full px-4 py-2 bg-zinc-600 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إغلاق</button>
                    </div>
                </div>
            )}
            
            {fullScreenImage && (
                 <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[100] backdrop-blur-sm cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
                    <div className="w-full h-full flex items-center justify-center p-4">
                         <img src={fullScreenImage} alt="Full Screen Question" className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] backdrop-blur-sm">
                    <div className="bg-surface rounded-lg p-8 m-4 max-w-sm w-full text-center shadow-2xl border border-border">
                        <h2 className="text-xl font-bold mb-4">تأكيد الخروج</h2>
                        <p className="text-text-muted mb-6">هل أنت متأكد من رغبتك في الخروج؟ لن يتم حفظ هذه المحاولة.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowExitConfirm(false)} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إلغاء</button>
                            <button onClick={handleConfirmExit} className="px-6 py-2 text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors font-semibold">خروج</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
