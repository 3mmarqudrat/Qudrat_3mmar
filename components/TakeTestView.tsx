
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Test, UserAnswer, TestAttempt, Question, FolderQuestion, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, ClockIcon, CheckCircleIcon, XCircleIcon, FlagIcon, ChevronDownIcon, InfoIcon, FileTextIcon, ZoomInIcon, StarIcon, LogOutIcon, BookOpenIcon, ArrowLeftIcon, BookmarkIcon } from './Icons';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${toArabic(String(minutes).padStart(2, '0'))}:${toArabic(String(seconds).padStart(2, '0'))}`;
};

// Helper to separate passage from question text
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
    innerRef?: React.Ref<HTMLDivElement>;
}> = ({ question, qNumber, isReviewMode, userAnswer, onSelectAnswer, isFlagged, onToggleFlag, isSpecialLaw, onToggleSpecialLaw, isBookmarked, onToggleBookmark, isFlagButtonDisabled, onShowInfo, isReviewTest, isQuantitative, onZoomImage, innerRef }) => {
    const hasAnswered = userAnswer !== undefined;
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleHeaderClick = () => {
        if (isQuantitative) return;
        if (hasAnswered || isReviewMode) {
            setIsCollapsed(!isCollapsed);
        }
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

    const gridClass = isQuantitative 
        ? 'grid-cols-4' 
        : 'grid-cols-1 sm:grid-cols-2';

    return (
        <div ref={innerRef} className={`bg-surface rounded-lg border border-border overflow-hidden transition-all ${isQuantitative ? 'shadow-2xl' : ''}`}>
            <div 
                className={`p-4 ${(!isQuantitative && (hasAnswered || isReviewMode)) ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={handleHeaderClick}
            >
                {isQuantitative ? (
                    /* Quantitative Layout: Right (Star), Middle (Bookmark), Left (Flag) */
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between w-full border-b border-zinc-700/50 pb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-bold text-text-muted select-none">{toArabic(qNumber)}.</span>
                                {!isReviewMode && !isReviewTest && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleSpecialLaw(); }} 
                                        className={`p-2 rounded-full hover:bg-zinc-600 transition-colors ${isSpecialLaw ? 'bg-purple-900/40' : ''}`}
                                        title="إضافة للقانون الخاص"
                                    >
                                        <StarIcon className={`w-6 h-6 ${isSpecialLaw ? 'text-purple-400 fill-current' : 'text-text-muted'}`} />
                                    </button>
                                )}
                            </div>

                            {!isReviewMode && !isReviewTest && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }} 
                                    className={`p-2 rounded-full hover:bg-zinc-600 transition-colors ${isBookmarked ? 'bg-blue-900/40' : ''}`}
                                    title="إضافة للمراجعة العامة"
                                >
                                    <BookmarkIcon className={`w-6 h-6 ${isBookmarked ? 'text-blue-400 fill-current' : 'text-text-muted'}`} />
                                </button>
                            )}

                            <div className="flex items-center gap-3">
                                {!isReviewMode && !isReviewTest && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleFlag(); }} 
                                        className={`p-2 rounded-full hover:bg-zinc-600 transition-colors ${isFlagged ? 'bg-yellow-900/40' : ''}`}
                                        title="تأجيل السؤال"
                                    >
                                        <FlagIcon className={`w-6 h-6 ${isFlagged ? 'text-yellow-400 fill-current' : 'text-text-muted'}`} />
                                    </button>
                                )}
                                {isReviewTest && (
                                    <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-2 rounded-full hover:bg-zinc-600 transition-colors" title="معلومات السؤال">
                                        <InfoIcon className="w-6 h-6 text-sky-400"/>
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="text-2xl font-semibold leading-relaxed text-right" style={{color: 'var(--color-gold)'}}>
                            {question.questionText}
                        </div>
                    </div>
                ) : (
                    /* Verbal Layout: Separate Flag and Bookmark buttons */
                    <div className="flex items-center gap-4 w-full overflow-hidden">
                         <div className="flex-shrink-0 flex items-center gap-2">
                            {isReviewTest && (
                                <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-2 rounded-full hover:bg-zinc-600 transition-colors" title="معلومات السؤال">
                                    <InfoIcon className="w-5 h-5 text-sky-400"/>
                                </button>
                            )}
                            {!isReviewMode && !isReviewTest && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }} disabled={isFlagButtonDisabled} className={`p-2 rounded-full hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isBookmarked ? 'bg-blue-900/40' : ''}`} title="إضافة للمراجعة">
                                        <BookmarkIcon className={`w-5 h-5 ${isBookmarked ? 'text-blue-400 fill-current' : 'text-text-muted'}`} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onToggleFlag(); }} disabled={isFlagButtonDisabled} className={`p-2 rounded-full hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isFlagged ? 'bg-yellow-900/40' : ''}`} title="تأجيل السؤال">
                                        <FlagIcon className={`w-5 h-5 ${isFlagged ? 'text-yellow-400 fill-current' : 'text-text-muted'}`} />
                                    </button>
                                </>
                            )}
                         </div>
                        <div className="w-full overflow-hidden">
                             <div className="text-xl font-semibold leading-relaxed text-right flex justify-between items-center gap-4" style={{color: 'var(--color-gold)'}}>
                                <div className="flex flex-col gap-1 w-full">
                                    <div className="flex justify-between items-start w-full">
                                         <span className="break-words w-full">
                                            <span className="text-text-muted select-none">{toArabic(qNumber)}. </span>
                                            {question.questionText}
                                         </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {(hasAnswered || isReviewMode) && (
                             <ChevronDownIcon className={`w-6 h-6 text-text-muted transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`} />
                        )}
                    </div>
                )}

                {question.questionImage && (
                    <div className="mt-6 flex justify-center relative group">
                        <img 
                            src={question.questionImage} 
                            alt="سؤال" 
                            onClick={(e) => { e.stopPropagation(); if(isQuantitative) onZoomImage(question.questionImage!); }}
                            className={`max-w-full rounded-lg border border-border transition-all ${isQuantitative ? 'max-h-[70vh] cursor-zoom-in hover:border-primary shadow-lg scale-[1.01]' : 'max-h-64'}`} 
                        />
                        {isQuantitative && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                    <ZoomInIcon className="w-3 h-3" /> تكبير
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div 
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isCollapsed 
                    ? 'grid-rows-[0fr] opacity-0' 
                    : 'grid-rows-[1fr] opacity-100'
                }`}
            >
                 <div className="overflow-hidden">
                    <div className="p-4 border-t border-border bg-black/10">
                        <div className={`grid gap-4 ${gridClass}`}>
                            {question.options.map((option, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => onSelectAnswer(option)} 
                                    disabled={isReviewMode}
                                    className={`w-full text-center p-4 rounded-lg border text-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 ${getOptionClass(option)} ${!isReviewMode && 'disabled:opacity-50'}`}
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
    const [sessionBookmarkIds, setSessionBookmarkIds] = useState<Set<string>>(new Set());
    const [infoModalQuestion, setInfoModalQuestion] = useState<FolderQuestion | null>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
    const [currentIdx, setCurrentIdx] = useState(0);
    const timerRef = useRef<number | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    
    const verbalQuestionRefs = useRef<(HTMLDivElement | null)[]>([]);

    const isReviewTest = test.id.includes('review_');
    const isQuantitative = useMemo(() => {
        return test.questions.length > 0 && !!test.questions[0].questionImage;
    }, [test]);

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
            sessionFlaggedIds.forEach(questionId => {
                if (reviewedQuestionIds.has(questionId)) return; 
                const question = test.questions.find(q => q.id === questionId);
                const qIndex = test.questions.findIndex(q => q.id === questionId);
                if (question) onAddDelayedReview(question, qIndex);
            });
            // Also treat bookmarks as delayed/review items if no specific bookmark handler exists
            sessionBookmarkIds.forEach(questionId => {
                 if (reviewedQuestionIds.has(questionId)) return;
                 const question = test.questions.find(q => q.id === questionId);
                 const qIndex = test.questions.findIndex(q => q.id === questionId);
                 if (question) onAddDelayedReview(question, qIndex);
            });
        }
        if (onAddSpecialLawReview) {
             sessionSpecialLawIds.forEach(questionId => {
                if (reviewedQuestionIds.has(questionId)) return; 
                const question = test.questions.find(q => q.id === questionId);
                const qIndex = test.questions.findIndex(q => q.id === questionId);
                if (question) onAddSpecialLawReview(question, qIndex);
            });
        }
    }, [sessionFlaggedIds, sessionSpecialLawIds, sessionBookmarkIds, onAddDelayedReview, onAddSpecialLawReview, test.questions, reviewedQuestionIds]);

    useEffect(() => {
        if (!isReviewMode) {
            timerRef.current = window.setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isReviewMode]);

    useEffect(() => {
        if (onStateChange) onStateChange(userAnswers, elapsedTime);
    }, [userAnswers, elapsedTime, onStateChange]);
    
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
            const newSet = new Set(prev);
            if (newSet.has(questionId)) newSet.delete(questionId);
            else newSet.add(questionId);
            return newSet;
        });
    };
    
    const handleToggleSpecialLaw = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
         setSessionSpecialLawIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) newSet.delete(questionId);
            else newSet.add(questionId);
            return newSet;
        });
    };

    const handleToggleBookmark = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
        setSessionBookmarkIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) newSet.delete(questionId);
            else newSet.add(questionId);
            return newSet;
        });
    }
    
    const handleFinish = () => {
        if(timerRef.current) clearInterval(timerRef.current);
        commitSessionFlagsToReview();
        onFinishTest(userAnswers, elapsedTime);
    }
    
    const handleConfirmExit = () => {
        if (onBack) onBack();
    };

    const stats = useMemo(() => {
        const solved = userAnswers.filter(a => a.answer && a.answer !== '').length;
        const total = test.questions.length;
        const flaggedCount = sessionFlaggedIds.size;
        // Remaining is total minus (solved + unique flagged/bookmarked that are not solved)
        // For simplicity, unsolved is just total - solved.
        return { solved, unsolved: total - solved, flagged: flaggedCount, total };
    }, [userAnswers, test.questions, sessionFlaggedIds]);

    const handleJumpToQuestion = (index: number) => {
        if (isQuantitative) {
            setCurrentIdx(index);
        } else {
            const target = verbalQuestionRefs.current[index];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    const filteredQuestions = useMemo(() => {
        if (!isReviewMode || reviewFilter === 'all' || !reviewAttempt) return test.questions;
        const answersMap = new Map(reviewAttempt.answers.map(a => [a.questionId, a.answer]));
        return test.questions.filter(q => {
            const userAnswer = answersMap.get(q.id);
            const isCorrect = userAnswer === q.correctAnswer;
            const isAnswered = userAnswer !== undefined && userAnswer !== '';
            switch (reviewFilter) {
                case 'correct': return isCorrect;
                case 'incorrect': return isAnswered && !isCorrect;
                case 'unanswered': return !isAnswered;
                default: return true;
            }
        });
    }, [test.questions, reviewFilter, isReviewMode, reviewAttempt]);

    const handleBackNavigation = () => {
        if (isReviewMode) {
             if(onBackToSummary) onBackToSummary();
        } else {
            setShowExitConfirm(true);
        }
    };
    
    const nextQuestion = () => {
        if (currentIdx < test.questions.length - 1) setCurrentIdx(prev => prev + 1);
    };

    const prevQuestion = () => {
        if (currentIdx > 0) setCurrentIdx(prev => prev - 1);
    };

    const displayedQuestions = isQuantitative ? [test.questions[currentIdx]] : filteredQuestions;
    let lastRenderedPassage: string | null = null;

    return (
        <div className="bg-bg min-h-screen flex flex-col overflow-hidden">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex justify-start items-center gap-3">
                         <button onClick={handleBackNavigation} className="p-2 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors">
                           <ArrowRightIcon className="w-5 h-5 text-text-muted"/>
                        </button>
                        <h1 className="text-lg md:text-xl font-bold text-text truncate max-w-[200px] md:max-w-md text-right" title={test.name}>{isReviewMode ? `مراجعة: ${test.name}` : test.name}</h1>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        {!isReviewMode && (
                             <div className="font-mono text-xl text-cyan-400 bg-black/40 px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] flex items-center gap-2">
                               <ClockIcon className="w-5 h-5"/> <span>{formatTime(elapsedTime)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            
            <div className="flex flex-row flex-grow overflow-hidden">
                {/* Advanced progress Sidebar with Optimized Circle Sizes */}
                <aside className="hidden lg:flex w-64 border-l border-border bg-surface/50 p-4 flex-col gap-6 flex-shrink-0 animate-in slide-in-from-right duration-300">
                    <h2 className="text-xl font-bold text-primary pb-2 border-b border-zinc-700">تقدم الاختبار</h2>
                    
                    <div className="grid grid-cols-3 gap-1">
                        <div className="bg-zinc-800 p-1.5 rounded border border-zinc-700 text-center">
                            <p className="text-[9px] text-text-muted">تم الحل</p>
                            <p className="text-base font-bold text-green-400">{toArabic(stats.solved)}</p>
                        </div>
                        <div className="bg-zinc-800 p-1.5 rounded border border-zinc-700 text-center">
                            <p className="text-[9px] text-text-muted">مؤجل</p>
                            <p className="text-base font-bold text-yellow-400">{toArabic(stats.flagged)}</p>
                        </div>
                        <div className="bg-zinc-800 p-1.5 rounded border border-zinc-700 text-center">
                            <p className="text-[9px] text-text-muted">متبقي</p>
                            <p className="text-base font-bold text-zinc-400">{toArabic(stats.unsolved)}</p>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-5 gap-2 px-1">
                            {test.questions.map((q, idx) => {
                                const isAnswered = userAnswers.find(a => a.questionId === q.id)?.answer;
                                const isFlagged = sessionFlaggedIds.has(q.id) || reviewedQuestionIds.has(q.id);
                                const isBookmarked = sessionBookmarkIds.has(q.id);
                                const isCurrent = isQuantitative && currentIdx === idx;

                                let btnClass = "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500";
                                if (isFlagged) {
                                    btnClass = "bg-yellow-600/40 border-yellow-500 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]";
                                } else if (isAnswered) {
                                    btnClass = "bg-green-600/40 border-green-500 text-green-400";
                                } else if (isBookmarked) {
                                    btnClass = "bg-blue-600/40 border-blue-500 text-blue-400";
                                }
                                
                                if (isCurrent) {
                                    btnClass += " ring-2 ring-primary ring-offset-2 ring-offset-bg scale-105";
                                }

                                return (
                                    <button 
                                        key={q.id}
                                        onClick={() => handleJumpToQuestion(idx)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-full border text-[11px] font-bold transition-all ${btnClass}`}
                                    >
                                        {toArabic(idx + 1)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div className="mt-auto space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> محلول</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> مؤجل</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-700"></span> متبقي</div>
                        </div>
                    </div>
                </aside>

                <main className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col items-center">
                    <div className="w-full max-w-5xl space-y-6">
                        {displayedQuestions.map((q, localIdx) => {
                            const originalIndex = test.questions.findIndex(origQ => origQ.id === q.id);
                            const { passage, cleanQuestion } = extractPassageAndQuestion(q.questionText);
                            let showPassage = false;
                            let passageNumber = 0;
                            if (passage && passage !== lastRenderedPassage) {
                                showPassage = true;
                                lastRenderedPassage = passage;
                                passageNumber = uniquePassages.indexOf(passage) + 1;
                            }
                            return (
                                <div 
                                    key={q.id} 
                                    className="animate-in fade-in zoom-in duration-300"
                                >
                                    {showPassage && (
                                        <div className="mb-6 mt-2 p-5 bg-zinc-800/80 rounded-lg border-r-4 border-primary shadow-md">
                                            <h3 className="text-primary font-bold mb-3 flex items-center gap-2 text-lg border-b border-zinc-700 pb-2">
                                                <BookOpenIcon className="w-5 h-5"/>
                                                قطعة {toArabic(passageNumber)}
                                            </h3>
                                            <div className="text-lg leading-loose text-slate-200 whitespace-pre-wrap pl-2 font-medium">
                                                {passage}
                                            </div>
                                        </div>
                                    )}
                                    <QuestionAccordion 
                                        innerRef={!isQuantitative ? (el => { verbalQuestionRefs.current[originalIndex] = el; }) : undefined}
                                        question={{...q, questionText: cleanQuestion}}
                                        qNumber={originalIndex + 1}
                                        isReviewMode={isReviewMode}
                                        userAnswer={userAnswers.find(a => a.questionId === q.id)?.answer}
                                        onSelectAnswer={(answer) => handleSelectAnswer(q.id, answer)}
                                        isFlagged={reviewedQuestionIds.has(q.id) || sessionFlaggedIds.has(q.id)}
                                        onToggleFlag={() => handleToggleFlag(q.id)}
                                        isSpecialLaw={reviewedQuestionIds.has(q.id) || sessionSpecialLawIds.has(q.id)}
                                        onToggleSpecialLaw={() => handleToggleSpecialLaw(q.id)}
                                        isBookmarked={sessionBookmarkIds.has(q.id)}
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

                        {isQuantitative && !isReviewMode && (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-zinc-800">
                                <button 
                                    onClick={prevQuestion} 
                                    disabled={currentIdx === 0}
                                    className="w-full md:w-auto px-10 py-3 bg-zinc-800 border border-zinc-700 text-text rounded-xl font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed group"
                                >
                                    <ArrowRightIcon className="w-6 h-6 transition-transform group-hover:translate-x-1" />
                                    <span>السابق</span>
                                </button>

                                <div className="text-zinc-500 font-bold text-lg order-last md:order-none">
                                    {toArabic(currentIdx + 1)} / {toArabic(test.questions.length)}
                                </div>

                                {currentIdx === test.questions.length - 1 ? (
                                    <button 
                                        onClick={handleFinish} 
                                        className="w-full md:w-auto px-12 py-3 bg-accent text-white font-bold rounded-xl hover:opacity-90 transition-all duration-200 hover:scale-105 text-lg transform shadow-xl shadow-accent/20 flex items-center justify-center gap-3"
                                    >
                                        <CheckCircleIcon className="w-6 h-6" />
                                        <span>إنهاء الاختبار</span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={nextQuestion} 
                                        className="w-full md:w-auto px-10 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 group shadow-lg shadow-primary/20"
                                    >
                                        <span>التالي</span>
                                        <ArrowLeftIcon className="w-6 h-6 transition-transform group-hover:-translate-x-1" />
                                    </button>
                                )}
                            </div>
                        )}

                        {!isQuantitative && !isReviewMode && (
                            <div className="mt-12 text-center pb-12">
                                <button onClick={handleFinish} className="px-16 py-4 bg-accent border-2 border-accent text-white font-bold rounded-2xl hover:opacity-90 transition-all duration-200 hover:scale-105 text-xl transform shadow-2xl shadow-accent/30 flex items-center gap-3 mx-auto">
                                     <CheckCircleIcon className="w-7 h-7" />
                                     <span>إنهاء الاختبار</span>
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {fullScreenImage && (
                 <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 backdrop-blur-sm cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
                    <div className="w-full h-full flex items-center justify-center p-4">
                         <img src={fullScreenImage} alt="Full Screen Question" className="max-w-full max-h-full object-contain animate-in zoom-in duration-300" />
                    </div>
                </div>
            )}

            {infoModalQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setInfoModalQuestion(null)}>
                    <div className="bg-surface rounded-lg p-6 m-4 max-w-sm w-full shadow-2xl border border-border animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-primary">مصدر السؤال</h3>
                        <div className="space-y-2 text-sm">
                            <p><strong className="text-text-muted">البنك:</strong> {infoModalQuestion.sourceBank || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">القسم:</strong> {infoModalQuestion.sourceSection || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">الاختبار الأصلي:</strong> {infoModalQuestion.sourceTest || 'غير محدد'}</p>
                        </div>
                         <button onClick={() => setInfoModalQuestion(null)} className="mt-6 w-full px-4 py-2 bg-zinc-600 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إغلاق</button>
                    </div>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
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
