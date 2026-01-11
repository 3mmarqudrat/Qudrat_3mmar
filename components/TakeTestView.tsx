
import { Test, UserAnswer, TestAttempt, Question, FolderQuestion } from '../types';
import { ArrowRightIcon, CheckCircleIcon, XCircleIcon, FlagIcon, StarIcon, ClockIcon } from './Icons';
import React, { useState, useEffect, useRef, useMemo } from 'react';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${toArabic(String(minutes).padStart(2, '0'))}:${toArabic(String(seconds).padStart(2, '0'))}`;
};

interface TakeTestViewProps {
    test: Test;
    onFinishTest: (answers: UserAnswer[], elapsedTime: number) => void;
    onBack: () => void;
    reviewAttempt?: TestAttempt;
    initialAnswers?: UserAnswer[];
    initialElapsedTime?: number;
    onStateChange?: (answers: UserAnswer[], elapsedTime: number) => void;
    onAddDelayedReview?: (q: Question, idx: number) => void;
    onAddSpecialLawReview?: (q: Question, idx: number) => void;
    reviewedQuestionIds?: Set<string>;
    onBackToSummary?: () => void;
    onBackToSection?: () => void;
}

const QuestionAccordion: React.FC<{
    question: Question | FolderQuestion;
    qNumber: number;
    isReviewMode: boolean;
    userAnswer: string | undefined;
    onSelectAnswer: (answer: string) => void;
    onAddDelayedReview: () => void;
    onAddSpecialLawReview: () => void;
    isQuantitative: boolean;
    onZoomImage: (src: string) => void;
    isAlreadyLaw: boolean;
    isAlreadyDelayed: boolean;
}> = ({ question, qNumber, isReviewMode, userAnswer, onSelectAnswer, onAddDelayedReview, onAddSpecialLawReview, isQuantitative, onZoomImage, isAlreadyLaw, isAlreadyDelayed }) => {
    
    const getOptionClass = (option: string) => {
        if (!isReviewMode) {
             return userAnswer === option 
                ? 'bg-white text-zinc-950 font-black border-primary ring-2 ring-primary/40 shadow-md scale-[1.02] z-10' 
                : 'bg-zinc-800 border-zinc-700 text-slate-200 hover:bg-zinc-700 transition-all';
        }
        
        const isCorrect = option === question.correctAnswer;
        const isSelected = option === userAnswer;
        
        if (isCorrect) return 'bg-green-500 text-black font-black shadow-lg border-green-400';
        if (isSelected && !isCorrect) return 'bg-red-500 text-white font-black shadow-lg border-red-400';
        return 'bg-zinc-800 border-border opacity-40 text-slate-400';
    };

    if (!isQuantitative) {
        return (
            <div className="bg-surface rounded-lg border border-border overflow-hidden transition-all shadow-sm mb-4 w-full">
                <div className="p-4">
                    <div className="flex flex-col gap-3 items-start text-right w-full" dir="rtl">
                        <div className="flex items-center justify-between w-full border-b border-zinc-700/30 pb-2 mb-2">
                            <span className="text-sm font-bold text-text-muted">السؤال {toArabic(qNumber)}</span>
                            <div className="flex gap-2">
                                {!isReviewMode && (
                                    <button 
                                        onClick={onAddDelayedReview} 
                                        className={`p-1.5 rounded-full hover:bg-zinc-600 transition-all ${isAlreadyDelayed ? 'bg-yellow-600 shadow-md' : ''}`}
                                        title="تأجيل السؤال"
                                    >
                                        <FlagIcon className={`w-4 h-4 ${isAlreadyDelayed ? 'text-white' : 'text-text-muted'}`} />
                                    </button>
                                )}
                                {isReviewMode && !userAnswer && (
                                    <span className="text-red-400 text-[10px] font-bold px-2 py-1 bg-red-900/20 rounded-full">لم يحل</span>
                                )}
                            </div>
                        </div>
                        {/* محاذاة السؤال لليمين بالكامل */}
                        <div className="text-xl font-bold text-gold text-right leading-relaxed whitespace-pre-wrap w-full">
                            {question.questionText}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-black/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {question.options.map((option, index) => (
                            <button 
                                key={index} 
                                onClick={() => onSelectAnswer(option)} 
                                disabled={isReviewMode} 
                                className={`w-full text-right px-4 py-3 rounded-md border text-base font-bold transition-all ${getOptionClass(option)}`}
                            >
                                <span className="ml-2 opacity-50">{['أ', 'ب', 'ج', 'د'][index]}.</span> {option}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden transition-all shadow-2xl relative mb-6 w-full">
            <div className="p-5">
                <div className="flex flex-col gap-5 items-start text-right w-full" dir="rtl">
                    <div className="flex items-center justify-between w-full border-b border-zinc-700/50 pb-4">
                        <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-text-muted">{toArabic(qNumber)}.</span>
                            {!isReviewMode && (
                                <button 
                                    onClick={onAddSpecialLawReview} 
                                    className={`p-2.5 rounded-full hover:bg-zinc-600 transition-all duration-300 ${isAlreadyLaw ? 'bg-purple-600 shadow-[0_0_15px_purple]' : ''}`}
                                    title="إضافة للقوانين الخاصة"
                                >
                                    <StarIcon className={`w-7 h-7 ${isAlreadyLaw ? 'text-white fill-current' : 'text-text-muted'}`} />
                                </button>
                            )}
                        </div>
                        
                        {isReviewMode && !userAnswer && (
                            <div className="bg-red-950/50 text-red-400 border border-red-500/50 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                                لم يتم حل السؤال
                            </div>
                        )}

                        {!isReviewMode && (
                            <button 
                                onClick={onAddDelayedReview} 
                                className={`p-2.5 rounded-full hover:bg-zinc-600 transition-all duration-300 ${isAlreadyDelayed ? 'bg-yellow-600 shadow-[0_0_15px_orange]' : ''}`}
                                title="تأجيل السؤال للمراجعة"
                            >
                                <FlagIcon className={`w-7 h-7 ${isAlreadyDelayed ? 'text-white fill-current' : 'text-text-muted'}`} />
                            </button>
                        )}
                    </div>
                    {/* محاذاة السؤال لليمين بالكامل */}
                    <div className="text-2xl font-bold text-gold text-right leading-relaxed whitespace-pre-wrap w-full block">
                        {question.questionText}
                    </div>
                    {question.questionImage && (
                        <div className="flex justify-center w-full relative group">
                            <img 
                                src={question.questionImage} 
                                alt="سؤال" 
                                onClick={() => onZoomImage(question.questionImage!)} 
                                className="max-w-full rounded-2xl border border-zinc-700 cursor-zoom-in hover:border-primary transition-all shadow-xl bg-white" 
                            />
                        </div>
                    )}
                </div>
            </div>
            <div className="p-5 border-t border-border bg-black/20">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {question.options.map((option, index) => (
                        <button key={index} onClick={() => onSelectAnswer(option)} disabled={isReviewMode} className={`w-full text-center py-5 rounded-xl border text-xl font-black transition-all ${getOptionClass(option)}`}>{option}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const TakeTestView: React.FC<TakeTestViewProps> = ({ test, onFinishTest, onBack, reviewAttempt, initialAnswers, initialElapsedTime, onAddDelayedReview, onAddSpecialLawReview, reviewedQuestionIds, onBackToSection }) => {
    const isReviewMode = !!reviewAttempt;
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>(initialAnswers || (reviewAttempt ? reviewAttempt.answers : []));
    const [elapsedTime, setElapsedTime] = useState(initialElapsedTime || 0);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    
    const [sessionDelayed, setSessionDelayed] = useState<Set<string>>(new Set());

    const isQuantitative = useMemo(() => {
        if (test.questions.length === 0) return false;
        return test.section === 'quantitative' || !!test.questions[0].questionImage;
    }, [test]);

    useEffect(() => {
        if (!isReviewMode) {
            const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
            return () => clearInterval(timer);
        }
    }, [isReviewMode]);

    const handleSelectAnswer = (questionId: string, answer: string) => {
        if (isReviewMode) return;
        const newAnswers = [...userAnswers];
        const existingIdx = newAnswers.findIndex(a => a.questionId === questionId);
        if (existingIdx >= 0) {
            newAnswers[existingIdx] = { ...newAnswers[existingIdx], answer };
        } else {
            newAnswers.push({ questionId, answer });
        }
        setUserAnswers(newAnswers);
    };

    const displayedQuestions = isQuantitative ? [test.questions[currentIdx]] : test.questions;

    return (
        <div className="bg-bg min-h-screen flex flex-col overflow-hidden text-right" dir="rtl">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <button onClick={() => setShowExitConfirm(true)} className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors shadow-sm"><ArrowRightIcon className="w-6 h-6 text-text-muted rotate-180"/></button>
                    <h1 className="text-xl font-bold text-text truncate max-w-md">{test.name}</h1>
                    {!isReviewMode ? (
                        <div className="font-mono text-2xl text-cyan-400 bg-black/40 px-5 py-1.5 rounded-xl border border-cyan-500/30">{formatTime(elapsedTime)}</div>
                    ) : (
                        <div className="bg-zinc-700 px-4 py-1 rounded-full text-sm font-bold text-text-muted">وضع المراجعة</div>
                    )}
                </div>
            </header>
            <main className="flex-grow overflow-y-auto p-4 md:p-10 flex flex-col items-center custom-scrollbar">
                <div className="w-full max-w-5xl flex flex-col items-center">
                    {displayedQuestions.map((q) => {
                        const globalIdx = test.questions.findIndex(orig => orig.id === q.id);
                        const isAlreadyLaw = !!reviewedQuestionIds?.has(q.id);
                        const isAlreadyDelayed = sessionDelayed.has(q.id);
                        
                        return (
                            <QuestionAccordion 
                                key={q.id} 
                                question={q} 
                                qNumber={globalIdx + 1} 
                                isReviewMode={isReviewMode} 
                                userAnswer={userAnswers.find(a => a.questionId === q.id)?.answer} 
                                onSelectAnswer={(ans) => handleSelectAnswer(q.id, ans)}
                                onAddDelayedReview={() => {
                                    onAddDelayedReview?.(q, globalIdx);
                                    setSessionDelayed(prev => new Set(prev).add(q.id));
                                }}
                                onAddSpecialLawReview={() => onAddSpecialLawReview?.(q, globalIdx)}
                                isQuantitative={isQuantitative}
                                onZoomImage={setZoomImage}
                                isAlreadyLaw={isAlreadyLaw}
                                isAlreadyDelayed={isAlreadyDelayed}
                            />
                        );
                    })}
                    
                    {isQuantitative && (
                        <div className="flex items-center justify-between pt-12 border-t border-zinc-800 w-full pb-20 mt-4">
                            <button onClick={() => setCurrentIdx(p => Math.max(0, p-1))} disabled={currentIdx === 0} className="px-10 py-4 bg-zinc-100 text-black border border-zinc-300 rounded-xl font-black text-xl disabled:opacity-20 shadow-xl transition-all">السابق</button>
                            <span className="text-zinc-400 font-black text-2xl px-6 py-2 bg-black/20 rounded-full border border-zinc-800">{toArabic(currentIdx + 1)} / {toArabic(test.questions.length)}</span>
                            {currentIdx === test.questions.length - 1 ? (
                                !isReviewMode && (
                                    <button onClick={() => onFinishTest(userAnswers, elapsedTime)} className="px-10 py-4 bg-green-500 text-zinc-950 rounded-xl font-black text-xl shadow-2xl shadow-green-500/30 transition-all hover:brightness-110 active:scale-95">إنهاء الاختبار</button>
                                )
                            ) : (
                                <button onClick={() => setCurrentIdx(p => p+1)} className="px-10 py-4 bg-zinc-100 text-black border border-zinc-300 rounded-xl font-black text-xl shadow-xl transition-all">التالي</button>
                            )}
                        </div>
                    )}

                    {!isQuantitative && !isReviewMode && (
                        <div className="mt-12 text-center pb-20">
                            <button onClick={() => onFinishTest(userAnswers, elapsedTime)} className="px-20 py-5 bg-green-500 text-zinc-950 font-black rounded-3xl shadow-2xl shadow-green-500/40 text-2xl transition-all hover:scale-105 active:scale-95">إنهاء الاختبار</button>
                        </div>
                    )}
                </div>
            </main>

            {zoomImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-full object-contain rounded-lg border-2 border-white shadow-2xl" onClick={(e) => e.stopPropagation()} />
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] backdrop-blur-md">
                    <div className="bg-surface rounded-2xl p-8 m-4 max-sm w-full text-center border border-border shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4">{isReviewMode ? 'إنهاء المراجعة؟' : 'تأكيد الخروج'}</h2>
                        <div className="flex flex-col gap-4">
                            <button onClick={() => { if (isReviewMode && onBackToSection) onBackToSection(); else onBack(); }} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 shadow-lg"> {isReviewMode ? 'خروج من المراجعة' : 'خروج نهائي'} </button>
                            <button onClick={() => setShowExitConfirm(false)} className="w-full py-4 bg-zinc-700 text-slate-200 rounded-xl font-bold text-lg hover:bg-zinc-600">إكمال</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
