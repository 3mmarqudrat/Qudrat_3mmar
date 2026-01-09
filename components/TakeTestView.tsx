import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Test, UserAnswer, TestAttempt, Question, FolderQuestion, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, ClockIcon, CheckCircleIcon, XCircleIcon, FlagIcon, ChevronDownIcon, InfoIcon, FileTextIcon, ZoomInIcon, StarIcon, LogOutIcon, BookOpenIcon, ArrowLeftIcon, BookmarkIcon } from './Icons';

interface TakeTestViewProps {
    test: Test;
    onFinishTest: (answers: UserAnswer[], durationSeconds: number) => void;
    onBack: () => void;
    reviewAttempt?: TestAttempt;
    initialAnswers?: UserAnswer[];
    initialElapsedTime?: number;
    onStateChange?: (answers: UserAnswer[], time: number) => void;
    onAddDelayedReview?: (q: Question, qIndex: number) => void;
    onAddSpecialLawReview?: (q: Question, qIndex: number) => void;
    reviewedQuestionIds?: Set<string>;
    onBackToSummary?: () => void;
    onBackToSection?: () => void;
}

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${toArabic(String(minutes).padStart(2, '0'))}:${toArabic(String(seconds).padStart(2, '0'))}`;
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
        if (hasAnswered || isReviewMode) setIsCollapsed(!isCollapsed);
    };
    
    const getOptionClass = (option: string) => {
        if (!isReviewMode) {
             return userAnswer === option ? 'bg-primary text-slate-900 font-bold ring-4 ring-primary/40 shadow-xl scale-[1.02]' : 'bg-surface hover:bg-zinc-700/50 border-zinc-700 text-slate-200';
        }
        const isCorrect = option === question.correctAnswer;
        const isSelected = option === userAnswer;
        if (isCorrect) return 'bg-success text-slate-900 font-bold shadow-lg';
        if (isSelected && !isCorrect) return 'bg-danger text-white font-bold shadow-lg';
        return 'bg-zinc-800 border-border opacity-60 text-slate-400';
    };

    return (
        <div ref={innerRef} className="bg-surface rounded-2xl border border-border overflow-hidden transition-all shadow-2xl relative">
            <div className="p-5" onClick={handleHeaderClick}>
                <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between w-full border-b border-zinc-700/50 pb-4">
                        <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-text-muted">{toArabic(qNumber)}.</span>
                            {!isReviewMode && (
                                <div className="group relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleSpecialLaw(); }} 
                                        className={`p-2.5 rounded-full hover:bg-zinc-600 transition-colors ${isSpecialLaw ? 'bg-purple-900/40' : ''}`}
                                    >
                                        <StarIcon className={`w-7 h-7 ${isSpecialLaw ? 'text-purple-400 fill-current' : 'text-text-muted'}`} />
                                    </button>
                                    <span className="absolute bottom-full right-0 mb-2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-700 shadow-xl z-50">قانون خاص</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                             {!isReviewMode && (
                                <div className="group relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleFlag(); }} 
                                        className={`p-2.5 rounded-full hover:bg-zinc-600 transition-colors ${isFlagged ? 'bg-yellow-900/40' : ''}`}
                                    >
                                        <FlagIcon className={`w-7 h-7 ${isFlagged ? 'text-yellow-400 fill-current' : 'text-text-muted'}`} />
                                    </button>
                                    <span className="absolute bottom-full left-0 mb-2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-700 shadow-xl z-50">مراجعة لاحقاً</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="text-2xl font-bold text-gold text-right leading-relaxed">
                        {question.questionText}
                    </div>

                    {question.questionImage && (
                        <div className="flex justify-center relative group">
                            <img 
                                src={question.questionImage} 
                                alt="سؤال" 
                                onClick={() => onZoomImage(question.questionImage!)} 
                                className="max-w-full rounded-2xl border border-zinc-700 cursor-zoom-in hover:border-primary transition-all shadow-xl bg-white" 
                                title="اضغط لتكبير الصورة"
                            />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="p-5 border-t border-border bg-black/20">
                <div className={`grid gap-4 ${isQuantitative ? 'grid-cols-4' : 'grid-cols-2'}`}>
                    {question.options.map((option, index) => (
                        <button 
                            key={index} 
                            onClick={() => onSelectAnswer(option)} 
                            disabled={isReviewMode} 
                            className={`w-full text-center py-5 rounded-xl border text-xl font-bold transition-all ${getOptionClass(option)}`}
                            title={`اختيار الإجابة: ${option}`}
                        >
                            {option}
                        </button>
                    ))}
                </div>

                {isReviewMode && question.verificationImage && (
                    <div className="mt-8 pt-6 border-t border-zinc-700">
                        <p className="text-sm text-text-muted mb-4 font-bold">تأكيد الإجابة من المصدر:</p>
                        <div className="bg-white p-4 rounded-xl inline-block shadow-2xl border border-zinc-200">
                            <img src={question.verificationImage} alt="تأكيد" className="h-24 object-contain" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const TakeTestView: React.FC<TakeTestViewProps> = ({ test, onFinishTest, onBack, reviewAttempt, initialAnswers, initialElapsedTime, onStateChange, onAddDelayedReview, onAddSpecialLawReview, reviewedQuestionIds = new Set(), onBackToSummary, onBackToSection }) => {
    const isReviewMode = !!reviewAttempt;
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>(initialAnswers || (reviewAttempt ? reviewAttempt.answers : []));
    const [elapsedTime, setElapsedTime] = useState(initialElapsedTime || 0);
    const [sessionFlaggedIds, setSessionFlaggedIds] = useState<Set<string>>(new Set());
    const [sessionSpecialLawIds, setSessionSpecialLawIds] = useState<Set<string>>(new Set());
    const [sessionBookmarkIds, setSessionBookmarkIds] = useState<Set<string>>(new Set());
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const timerRef = useRef<number | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const isQuantitative = useMemo(() => test.questions.length > 0 && !!test.questions[0].questionImage, [test]);

    useEffect(() => {
        if (!isReviewMode) {
            timerRef.current = window.setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isReviewMode]);

    const handleSelectAnswer = (questionId: string, answer: string) => {
        if (isReviewMode) return;
        setUserAnswers(prev => {
            const existing = prev.find(a => a.questionId === questionId);
            if (existing) return prev.map(a => a.questionId === questionId ? { ...a, answer } : a);
            return [...prev, { questionId, answer }];
        });
    };

    const handleFinish = () => {
        if(timerRef.current) clearInterval(timerRef.current);
        onFinishTest(userAnswers, elapsedTime);
    };

    const displayedQuestions = isQuantitative ? [test.questions[currentIdx]] : test.questions;

    return (
        <div className="bg-bg min-h-screen flex flex-col overflow-hidden text-right" dir="rtl">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                         <button 
                            onClick={() => setShowExitConfirm(true)} 
                            className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors group relative" 
                            title="خروج من الاختبار والعودة للخلف"
                        >
                           <ArrowRightIcon className="w-6 h-6 text-text-muted rotate-180 md:rotate-0"/>
                           <span className="absolute -bottom-10 right-0 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-700 shadow-xl">خروج</span>
                        </button>
                        <h1 className="text-xl font-bold text-text truncate max-w-md hidden md:block">{test.name}</h1>
                    </div>
                    {!isReviewMode && (
                         <div className="font-mono text-2xl text-cyan-400 bg-black/40 px-5 py-1.5 rounded-xl border border-cyan-500/30 shadow-inner" title="وقت الاختبار المنقضي">
                            {formatTime(elapsedTime)}
                        </div>
                    )}
                </div>
            </header>
            
            <main className="flex-grow overflow-y-auto p-4 md:p-10 flex flex-col items-center custom-scrollbar">
                <div className="w-full max-w-5xl space-y-8">
                    {displayedQuestions.map((q) => (
                        <QuestionAccordion 
                            key={q.id}
                            question={q}
                            qNumber={test.questions.findIndex(orig => orig.id === q.id) + 1}
                            isReviewMode={isReviewMode}
                            userAnswer={userAnswers.find(a => a.questionId === q.id)?.answer}
                            onSelectAnswer={(ans) => handleSelectAnswer(q.id, ans)}
                            isFlagged={sessionFlaggedIds.has(q.id)}
                            onToggleFlag={() => setSessionFlaggedIds(prev => {
                                const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n;
                            })}
                            isSpecialLaw={sessionSpecialLawIds.has(q.id)}
                            onToggleSpecialLaw={() => setSessionSpecialLawIds(prev => {
                                const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n;
                            })}
                            isBookmarked={sessionBookmarkIds.has(q.id)}
                            onToggleBookmark={() => setSessionBookmarkIds(prev => {
                                const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n;
                            })}
                            isFlagButtonDisabled={false}
                            onShowInfo={() => {}}
                            isReviewTest={false}
                            isQuantitative={isQuantitative}
                            onZoomImage={setFullScreenImage}
                        />
                    ))}

                    {isQuantitative && !isReviewMode && (
                        <div className="flex items-center justify-between pt-12 border-t border-zinc-800 w-full pb-10">
                            <button 
                                onClick={() => setCurrentIdx(p => Math.max(0, p-1))} 
                                disabled={currentIdx === 0} 
                                className="px-12 py-4 bg-zinc-100 text-black border-2 border-zinc-300 rounded-2xl font-black text-xl hover:bg-white disabled:opacity-20 shadow-xl transition-all active:scale-95" 
                                title="الانتقال للسؤال السابق"
                            >
                                السابق
                            </button>
                            <span className="text-zinc-400 font-black text-2xl px-6 py-2 bg-black/20 rounded-full border border-zinc-800" title="تقدمك في الاختبار">
                                {toArabic(currentIdx + 1)} / {toArabic(test.questions.length)}
                            </span>
                            {currentIdx === test.questions.length - 1 ? (
                                <button 
                                    onClick={handleFinish} 
                                    className="px-14 py-4 bg-accent text-black font-black rounded-2xl shadow-2xl shadow-accent/40 text-xl hover:brightness-110 active:scale-95 transition-all border-b-4 border-emerald-600" 
                                    title="إنهاء المحاولة وحفظ نتيجتك"
                                >
                                    إنهاء الاختبار
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setCurrentIdx(p => p+1)} 
                                    className="px-14 py-4 bg-primary text-black font-black rounded-2xl shadow-2xl shadow-primary/40 text-xl hover:brightness-110 active:scale-95 transition-all border-b-4 border-blue-600" 
                                    title="الانتقال للسؤال التالي"
                                >
                                    التالي
                                </button>
                            )}
                        </div>
                    )}

                    {!isQuantitative && !isReviewMode && (
                        <div className="mt-16 text-center pb-16">
                            <button 
                                onClick={handleFinish} 
                                className="px-20 py-5 bg-accent text-black font-black rounded-3xl shadow-2xl shadow-accent/50 text-2xl hover:scale-105 active:scale-95 transition-all border-b-4 border-emerald-600" 
                                title="إنهاء المحاولة وحفظ نتيجتك الحالية"
                            >
                                إنهاء الاختبار
                            </button>
                        </div>
                    )}
                    
                    {isReviewMode && (
                         <div className="mt-16 text-center pb-16">
                            <button 
                                onClick={onBackToSummary} 
                                className="px-16 py-4 bg-primary text-black font-bold rounded-2xl text-xl hover:brightness-110 shadow-xl transition-all" 
                                title="العودة لشاشة النتيجة النهائية"
                            >
                                العودة للنتيجة
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {fullScreenImage && (
                 <div 
                    className="fixed inset-0 bg-black/98 flex items-center justify-center z-[100] p-1 cursor-zoom-out animate-in fade-in duration-300" 
                    onClick={() => setFullScreenImage(null)}
                    title="اضغط للإغلاق"
                >
                    <img src={fullScreenImage} alt="Zoom" className="max-w-[98vw] max-h-[98vh] object-contain shadow-2xl rounded-sm" />
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] backdrop-blur-md">
                    <div className="bg-surface rounded-3xl p-10 m-4 max-w-sm w-full text-center border border-border shadow-2xl">
                        <h2 className="text-2xl font-black mb-4 text-white">تأكيد الخروج</h2>
                        <p className="text-text-muted mb-10 text-lg">هل أنت متأكد؟ لن يتم حفظ تقدمك الحالي في هذا الاختبار.</p>
                        <div className="flex flex-col gap-4">
                            <button onClick={onBack} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20">خروج نهائي</button>
                            <button onClick={() => setShowExitConfirm(false)} className="w-full py-4 bg-zinc-700 text-slate-200 rounded-2xl font-bold text-lg hover:bg-zinc-600 transition-colors">إكمال الاختبار</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};