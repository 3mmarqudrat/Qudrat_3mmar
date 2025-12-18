
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Test, UserAnswer, TestAttempt, Question, FolderQuestion, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, ClockIcon, CheckCircleIcon, XCircleIcon, BookmarkIcon, ChevronDownIcon, InfoIcon, FileTextIcon, EyeIcon, ZoomInIcon, StarIcon, LogOutIcon, BookOpenIcon, ArrowLeftIcon, BarChartIcon } from './Icons';

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
    isBookmarked: boolean;
    onToggleBookmark: () => void;
    isFlagButtonDisabled: boolean;
    onShowInfo: () => void;
    isReviewTest: boolean;
    isQuantitative: boolean;
    onZoomImage: (src: string) => void;
}> = ({ question, qNumber, isReviewMode, userAnswer, onSelectAnswer, isFlagged, onToggleFlag, isSpecialLaw, onToggleSpecialLaw, isBookmarked, onToggleBookmark, isFlagButtonDisabled, onShowInfo, isReviewTest, isQuantitative, onZoomImage }) => {
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
        <div className={`bg-surface rounded-xl border border-border overflow-hidden transition-all duration-300 ${isQuantitative ? 'shadow-2xl' : 'mb-4 shadow-md'}`}>
            <div 
                className={`flex justify-between items-center p-5 ${(!isQuantitative && (hasAnswered || isReviewMode)) ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={handleHeaderClick}
            >
                <div className="flex items-center gap-4 w-full overflow-hidden">
                     <div className="flex-shrink-0 flex items-center gap-1.5 bg-black/20 p-1.5 rounded-lg border border-zinc-700/50">
                        {isReviewTest && (
                            <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-2 rounded-md hover:bg-zinc-600 transition-colors" title="معلومات السؤال">
                                <InfoIcon className="w-5 h-5 text-sky-400"/>
                            </button>
                        )}
                        {!isReviewMode && !isReviewTest && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onToggleFlag(); }} disabled={isFlagButtonDisabled} className={`p-2 rounded-md transition-colors ${isFlagged ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-zinc-700 text-zinc-500'}`} title="تأجيل السؤال">
                                    <svg className={`w-5 h-5 ${isFlagged ? 'fill-current' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                        <line x1="4" y1="22" x2="4" y2="15"></line>
                                    </svg>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }} disabled={isFlagButtonDisabled} className={`p-2 rounded-md transition-colors ${isBookmarked ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-zinc-700 text-zinc-500'}`} title="إضافة للمراجعة اليدوية">
                                    <BookmarkIcon className="w-5 h-5" isFilled={isBookmarked} />
                                </button>
                                {isQuantitative && (
                                     <button onClick={(e) => { e.stopPropagation(); onToggleSpecialLaw(); }} disabled={isFlagButtonDisabled} className={`p-2 rounded-md transition-colors ${isSpecialLaw ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-zinc-700 text-zinc-500'}`} title="قانون خاص">
                                        <StarIcon className="w-5 h-5" isFilled={isSpecialLaw} />
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
                    <div className="p-5 border-t border-border bg-black/10">
                        {question.questionImage && (
                            <div className={`mb-8 flex justify-center relative group ${isQuantitative ? 'w-full' : ''}`}>
                                <img 
                                    src={question.questionImage} 
                                    alt="سؤال" 
                                    onClick={(e) => { e.stopPropagation(); onZoomImage(question.questionImage!); }}
                                    className={`rounded-xl border border-zinc-600 shadow-2xl transition-all ${isQuantitative ? 'w-full max-h-[80vh] object-contain bg-white p-2' : 'max-w-full max-h-72 cursor-zoom-in'}`} 
                                />
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <span className="bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20">
                                        <ZoomInIcon className="w-4 h-4" /> اضغط للتكبير الكامل
                                    </span>
                                </div>
                            </div>
                        )}
                        <div className={`grid gap-5 ${gridClass}`}>
                            {question.options.map((option, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => onSelectAnswer(option)} 
                                    disabled={isReviewMode}
                                    className={`w-full text-center p-5 rounded-xl border text-xl md:text-2xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${getOptionClass(option)} ${!isReviewMode && 'active:scale-[0.98] shadow-sm hover:shadow-md'}`}
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
                            <div className="mt-4 text-center p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                                <p className="font-bold text-red-400">لم يتم الإجابة على هذا السؤال أثناء الاختبار</p>
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
    onAddBookmarkReview?: (question: Question, qIndex: number) => void;
    reviewedQuestionIds?: Set<string>;
    onBackToSummary?: () => void;
    onBackToSection?: () => void;
}

export const TakeTestView: React.FC<TakeTestViewProps> = ({ test, onFinishTest, onBack, reviewAttempt, initialAnswers, initialElapsedTime, onStateChange, onAddDelayedReview, onAddSpecialLawReview, onAddBookmarkReview, reviewedQuestionIds = new Set(), onBackToSummary, onBackToSection }) => {
    const isReviewMode = !!reviewAttempt;
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>(initialAnswers || (reviewAttempt ? reviewAttempt.answers : []));
    const [elapsedTime, setElapsedTime] = useState(initialElapsedTime || 0);
    const [sessionFlaggedIds, setSessionFlaggedIds] = useState<Set<string>>(new Set());
    const [sessionSpecialLawIds, setSessionSpecialLawIds] = useState<Set<string>>(new Set());
    const [sessionBookmarkedIds, setSessionBookmarkedIds] = useState<Set<string>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0); 
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
        if (onAddBookmarkReview) {
             sessionBookmarkedIds.forEach(id => {
                if (reviewedQuestionIds.has(id)) return; 
                const q = test.questions.find(x => x.id === id);
                const idx = test.questions.findIndex(x => x.id === id);
                if (q) onAddBookmarkReview(q, idx);
            });
        }
    }, [sessionFlaggedIds, sessionSpecialLawIds, sessionBookmarkedIds, onAddDelayedReview, onAddSpecialLawReview, onAddBookmarkReview, test.questions, reviewedQuestionIds]);

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

    const handleToggleBookmark = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
        setSessionBookmarkedIds(prev => {
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
    const bookmarkedCount = sessionBookmarkedIds.size;
    const unansweredCount = totalQuestions - answeredCount;

    return (
        <div className="bg-bg min-h-screen flex flex-col">
             <header className="bg-surface/90 backdrop-blur-xl p-4 sticky top-0 z-40 border-b border-border shadow-lg">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={handleBackNavigation} className="p-2.5 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all hover:border-zinc-500">
                            <ArrowRightIcon className="w-5 h-5 text-text-muted"/>
                        </button>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-text truncate max-w-[180px] md:max-w-md" title={test.name}>{isReviewMode ? `مراجعة: ${test.name}` : test.name}</h1>
                            <p className="text-[10px] text-text-muted font-mono">{toArabic(totalQuestions)} سؤالاً</p>
                        </div>
                    </div>

                    {isReviewMode && (
                        <div className="hidden lg:flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-zinc-700/50">
                            {(['all', 'correct', 'incorrect', 'unanswered'] as const).map(f => (
                                <button key={f} onClick={() => setReviewFilter(f)} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${reviewFilter === f ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>
                                    {f === 'all' && 'الكل'} {f === 'correct' && 'صح'} {f === 'incorrect' && 'خطأ'} {f === 'unanswered' && 'متروك'}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="font-mono text-xl text-cyan-400 bg-black/40 px-4 py-2 rounded-xl border border-cyan-500/30 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-cyan-500/50" />
                        {formatTime(elapsedTime)}
                    </div>
                </div>
            </header>
            
            <div className="flex-grow flex overflow-hidden">
                {/* Redesigned Sidebar - More structured and visually organized */}
                <aside className="hidden lg:flex flex-col w-72 border-l border-border bg-surface/30 backdrop-blur-sm p-6 gap-8 flex-shrink-0">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChartIcon className="w-4 h-4 text-primary" />
                            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">إحصائيات مباشرة</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            {/* Stats Summary Cards */}
                            <div className="bg-zinc-800/80 p-4 rounded-2xl border border-zinc-700 flex items-center justify-between group hover:border-zinc-500 transition-colors shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                        <FileTextIcon className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-text-muted">الإجمالي</span>
                                </div>
                                <span className="text-xl font-black text-white">{toArabic(totalQuestions)}</span>
                            </div>

                            <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                        <CheckCircleIcon className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-emerald-500/70">تم الحل</span>
                                </div>
                                <span className="text-xl font-black text-emerald-400">{toArabic(answeredCount)}</span>
                            </div>

                            <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/20 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
                                        <XCircleIcon className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-red-500/70">متبقي</span>
                                </div>
                                <span className="text-xl font-black text-red-400">{toArabic(unansweredCount)}</span>
                            </div>

                            <div className="bg-yellow-500/5 p-4 rounded-2xl border border-yellow-500/20 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 border border-yellow-500/20">
                                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                    </div>
                                    <span className="text-xs font-bold text-yellow-500/70">مؤجل</span>
                                </div>
                                <span className="text-xl font-black text-yellow-400">{toArabic(flaggedCount)}</span>
                            </div>

                            <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                        <BookmarkIcon className="w-5 h-5" isFilled />
                                    </div>
                                    <span className="text-xs font-bold text-blue-500/70">مفضلة</span>
                                </div>
                                <span className="text-xl font-black text-blue-400">{toArabic(bookmarkedCount)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-4 border-t border-zinc-800 pt-6">
                            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">خريطة الأسئلة</h4>
                            <span className="text-[8px] text-zinc-500 font-mono">اضغط للانتقال</span>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-3">
                            <div className="grid grid-cols-5 gap-2 pb-6">
                                {test.questions.map((_, i) => {
                                    const isAns = userAnswers.some(a => a.questionId === test.questions[i].id);
                                    const isFlag = sessionFlaggedIds.has(test.questions[i].id);
                                    const isBook = sessionBookmarkedIds.has(test.questions[i].id);
                                    return (
                                        <button 
                                            key={i} 
                                            onClick={() => isQuantitative && setCurrentIndex(i)}
                                            className={`w-10 h-10 rounded-xl text-xs font-bold border transition-all relative flex items-center justify-center ${
                                                currentIndex === i ? 'border-primary ring-2 ring-primary/20 bg-primary/10 text-primary' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                                            } ${isFlag ? 'ring-1 ring-yellow-500/50' : ''} ${isBook ? 'ring-1 ring-blue-500/50' : ''}`}
                                        >
                                            {toArabic(i + 1)}
                                            {isAns && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-900"></div>}
                                            {(isFlag || isBook) && <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-yellow-500 rounded-full border border-zinc-900"></div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-10 bg-bg/50">
                    <div className="max-w-4xl mx-auto pb-32">
                        {isQuantitative && !isReviewMode ? (
                            /* Paginated View for Quantitative - Cleaner & Bigger */
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                                <div className="flex justify-between items-center bg-surface/50 p-4 rounded-2xl border border-zinc-700 shadow-xl backdrop-blur-md">
                                    <span className="text-xl font-black text-primary">السؤال {toArabic(currentIndex + 1)} <span className="text-zinc-500 font-normal">من {toArabic(totalQuestions)}</span></span>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full mb-1 ${userAnswers.some(a => a.questionId === currentQuestion.id) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
                                            <span className="text-[8px] text-zinc-500">محلول</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full mb-1 ${sessionFlaggedIds.has(currentQuestion.id) ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-700'}`}></div>
                                            <span className="text-[8px] text-zinc-500">مؤجل</span>
                                        </div>
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
                                    isBookmarked={sessionBookmarkedIds.has(currentQuestion.id)}
                                    onToggleBookmark={() => handleToggleBookmark(currentQuestion.id)}
                                    isFlagButtonDisabled={reviewedQuestionIds.has(currentQuestion.id)}
                                    onShowInfo={() => setInfoModalQuestion(currentQuestion as FolderQuestion)}
                                    isReviewTest={isReviewTest}
                                    isQuantitative={true}
                                    onZoomImage={(src) => setFullScreenImage(src)}
                                />

                                <div className="flex justify-between items-center gap-6 pt-10">
                                    <button 
                                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                        disabled={currentIndex === 0}
                                        className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-zinc-800 text-white rounded-2xl border border-zinc-700 disabled:opacity-20 hover:bg-zinc-700 transition-all active:scale-95 font-black text-lg shadow-lg"
                                    >
                                        <ArrowRightIcon className="w-6 h-6"/> السابق
                                    </button>
                                    
                                    {currentIndex === totalQuestions - 1 ? (
                                        <button 
                                            onClick={handleFinish} 
                                            className="flex-[1.5] py-5 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-500 shadow-2xl shadow-emerald-500/20 transform hover:scale-[1.02] active:scale-95 transition-all text-xl"
                                        >
                                            إرسال الاختبار
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                                            className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-primary text-white rounded-2xl hover:bg-primary-hover active:scale-95 transition-all font-black text-lg shadow-lg shadow-primary/20"
                                        >
                                            التالي <ArrowLeftIcon className="w-6 h-6"/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Classic List View for Verbal or Review */
                            <div className="space-y-6">
                                {filteredQuestions.map((q, idx) => {
                                    const origIdx = test.questions.findIndex(x => x.id === q.id);
                                    const { passage, cleanQuestion } = extractPassageAndQuestion(q.questionText);
                                    return (
                                        <div key={q.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {passage && (
                                                <div className="mb-6 mt-10 p-6 bg-zinc-800/80 rounded-2xl border-r-4 border-primary shadow-xl ring-1 ring-white/5">
                                                    <h3 className="text-primary font-black mb-4 flex items-center gap-3 text-xl border-b border-zinc-700/50 pb-3">
                                                        <BookOpenIcon className="w-6 h-6"/> نص القراءة: قطعة {toArabic(uniquePassages.indexOf(passage) + 1)}
                                                    </h3>
                                                    <div className="text-xl leading-relaxed text-slate-200 whitespace-pre-wrap font-medium">{passage}</div>
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
                                                isBookmarked={reviewedQuestionIds.has(q.id) || sessionBookmarkedIds.has(q.id)}
                                                onToggleBookmark={() => handleToggleBookmark(q.id)}
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
                                    <div className="mt-16 text-center">
                                        <button onClick={handleFinish} className="px-16 py-4 bg-primary text-white font-black text-xl rounded-2xl hover:bg-primary-hover transition-all shadow-2xl shadow-primary/30 transform hover:-translate-y-1 active:scale-95">إرسال وإنهاء الاختبار</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {isReviewMode && (
                <footer className="bg-surface/95 backdrop-blur-2xl p-5 sticky bottom-0 z-40 border-t border-border shadow-2xl">
                    <div className="container mx-auto flex justify-center items-center gap-6">
                         <button onClick={onBackToSummary} className="px-10 py-3 bg-blue-600 text-white font-black rounded-xl transition-all flex items-center gap-3 transform hover:scale-105 shadow-xl shadow-blue-500/30 active:scale-95">
                             <FileTextIcon className="w-5 h-5"/> عرض النتائج بالتفصيل
                         </button>
                         <button onClick={onBackToSection} className="px-10 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-500 transition-all flex items-center gap-3 shadow-xl shadow-red-500/30 active:scale-95">
                             <LogOutIcon className="w-5 h-5"/> إنهاء المراجعة
                         </button>
                    </div>
                </footer>
            )}
            
             {infoModalQuestion && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md px-4" onClick={() => setInfoModalQuestion(null)}>
                    <div className="bg-surface rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-border animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-6 text-primary border-b border-zinc-700 pb-2">مصدر السؤال</h3>
                        <div className="space-y-4 text-sm bg-black/20 p-4 rounded-xl">
                            <div className="flex justify-between items-center"><strong className="text-text-muted">البنك:</strong> <span>{infoModalQuestion.sourceBank || 'غير محدد'}</span></div>
                            <div className="flex justify-between items-center"><strong className="text-text-muted">القسم:</strong> <span>{infoModalQuestion.sourceSection || 'غير محدد'}</span></div>
                            <div className="flex justify-between items-center"><strong className="text-text-muted">الاختبار:</strong> <span>{infoModalQuestion.sourceTest || 'غير محدد'}</span></div>
                            <div className="flex justify-between items-center"><strong className="text-text-muted">الرقم الأصلي:</strong> <span>{infoModalQuestion.originalQuestionIndex !== undefined ? toArabic(infoModalQuestion.originalQuestionIndex + 1) : 'غير محدد'}</span></div>
                            <div className="flex justify-between items-center border-t border-zinc-700 pt-2"><strong className="text-text-muted">تاريخ الحفظ:</strong> <span className="text-[10px] text-zinc-400">{infoModalQuestion.addedDate ? new Date(infoModalQuestion.addedDate).toLocaleString('ar-SA') : 'غير محدد'}</span></div>
                        </div>
                         <button onClick={() => setInfoModalQuestion(null)} className="mt-8 w-full px-4 py-3 bg-zinc-700 text-white rounded-xl hover:bg-zinc-600 transition-colors font-bold shadow-lg">إغلاق</button>
                    </div>
                </div>
            )}
            
            {fullScreenImage && (
                 <div className="fixed inset-0 bg-black/98 flex flex-col items-center justify-center z-[100] backdrop-blur-xl cursor-zoom-out p-4" onClick={() => setFullScreenImage(null)}>
                    <div className="absolute top-6 right-6">
                        <button className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors border border-white/10">
                            <XCircleIcon className="w-8 h-8 text-white"/>
                        </button>
                    </div>
                    <div className="w-full h-full flex items-center justify-center">
                         <img src={fullScreenImage} alt="Full Screen Question" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                    </div>
                    <div className="absolute bottom-10 text-white/50 text-sm font-bold bg-black/40 px-6 py-2 rounded-full border border-white/10">
                        انقر في أي مكان للإغلاق
                    </div>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-md px-4">
                    <div className="bg-surface rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl border border-border animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <LogOutIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black mb-4">هل تريد مغادرة الاختبار؟</h2>
                        <p className="text-text-muted mb-8 leading-relaxed">تنبيـه: عند المغادرة الآن لن يتم حفظ تقدمك أو نتيجتك في هذا الاختبار.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setShowExitConfirm(false)} className="px-6 py-4 bg-zinc-800 text-slate-200 rounded-2xl hover:bg-zinc-700 transition-colors font-bold active:scale-95">إلغاء وتكملة</button>
                            <button onClick={handleConfirmExit} className="px-6 py-4 text-white rounded-2xl bg-red-600 hover:bg-red-700 transition-colors font-bold shadow-lg shadow-red-600/20 active:scale-95">نعم، خروج</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
