
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Question, Section, Test, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, CheckCircleIcon, FileTextIcon, InfoIcon, SaveIcon, TrashIcon, XCircleIcon, SettingsIcon } from './Icons';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

interface ParsedQuestion extends Omit<Question, 'id' | 'correctAnswer'> {
    passage?: string;
}

const parseQuestionsFromText = (text: string): ParsedQuestion[] => {
    if (!text.trim()) return [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('*'));
    const questions: ParsedQuestion[] = [];
    const separatorIndices: number[] = [];
    lines.forEach((line, index) => {
        if (line === 'نقطة واحدة' || line === 'ليس هناك نقاط') {
            separatorIndices.push(index);
        }
    });
    if (separatorIndices.length === 0) return [];
    let lastBlockEndIndex = -1;
    let currentPassage: string | undefined = undefined;
    separatorIndices.forEach((sepIndex) => {
        if (sepIndex === 0) return;
        const questionLineIndex = sepIndex - 1;
        const questionText = lines[questionLineIndex];
        const potentialPassageLines = lines.slice(lastBlockEndIndex + 1, questionLineIndex);
        if (potentialPassageLines.length > 0) {
            currentPassage = potentialPassageLines.join('\n');
        } 
        const options: string[] = [];
        let currentOptionIndex = sepIndex + 1;
        const nextSepIndex = separatorIndices.find(idx => idx > sepIndex);
        const nextQuestionIndex = nextSepIndex ? nextSepIndex - 1 : lines.length;
        let maxOptions = 4;
        while (currentOptionIndex < lines.length && currentOptionIndex < nextQuestionIndex && options.length < maxOptions) { 
            options.push(lines[currentOptionIndex]);
            currentOptionIndex++;
        }
        lastBlockEndIndex = currentOptionIndex - 1;
        questions.push({ questionText, options, passage: currentPassage });
    });
    return questions;
};

interface VerbalManagementViewProps {
    data: AppData;
    onBack: () => void;
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => Promise<string>;
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => Promise<void>;
    onDeleteTest: (section: Section, testIds: string[], bankKey?: string, categoryKey?: string) => Promise<void>;
    onUpdateQuestionAnswer: (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => void;
}

const FORM_STATE_KEY = 'verbalManagementFormState';

const getInitialFormState = () => {
  try {
    const saved = localStorage.getItem(FORM_STATE_KEY);
    return saved ? JSON.parse(saved) : {
      selectedBank: Object.keys(VERBAL_BANKS)[0],
      selectedCategory: Object.keys(VERBAL_CATEGORIES)[0],
      testNumber: '',
      questionsText: '',
    };
  } catch {
    return {
      selectedBank: Object.keys(VERBAL_BANKS)[0],
      selectedCategory: Object.keys(VERBAL_CATEGORIES)[0],
      testNumber: '',
      questionsText: '',
    };
  }
};

export const VerbalManagementView: React.FC<VerbalManagementViewProps> = ({ data, onBack, onAddTest, onAddQuestionsToTest, onDeleteTest, onUpdateQuestionAnswer }) => {
    const [activeBank, setActiveBank] = useState<string | null>(Object.keys(VERBAL_BANKS)[0]);
    const [activeCategory, setActiveCategory] = useState<string | null>(Object.keys(VERBAL_CATEGORIES)[0]);
    const [formState, setFormState] = useState(getInitialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [correctAnswers, setCorrectAnswers] = useState<Record<number, string>>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string[] | null>(null);
    const [viewingSourceText, setViewingSourceText] = useState<string | null>(null);
    const [editingTest, setEditingTest] = useState<{ test: Test, bankKey: string, catKey: string } | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());

    useEffect(() => { localStorage.setItem(FORM_STATE_KEY, JSON.stringify(formState)); }, [formState]);
    const updateFormState = (updates: Partial<typeof formState>) => { setFormState(prev => ({ ...prev, ...updates })); };

    useEffect(() => {
        const handler = setTimeout(() => {
            if (formState.questionsText.trim()) {
                try {
                    const questions = parseQuestionsFromText(formState.questionsText);
                    setParsedQuestions(questions);
                    setCorrectAnswers({});
                    setFeedback(null);
                } catch (error: any) {
                    setParsedQuestions([]);
                    setFeedback({ type: 'error', message: error.message });
                }
            } else { setParsedQuestions([]); }
        }, 500);
        return () => { clearTimeout(handler); };
    }, [formState.questionsText]);

    const handleCorrectAnswerSelect = (qIndex: number, answer: string) => { setCorrectAnswers(prev => ({ ...prev, [qIndex]: answer })); };

    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        setFeedback(null);
        if (!formState.selectedBank || !formState.selectedCategory || !formState.testNumber.trim()) {
            setFeedback({ type: 'error', message: 'يرجى ملء الحقول.' });
            setIsSubmitting(false);
            return;
        }
        if (Object.keys(correctAnswers).length !== parsedQuestions.length) {
            setFeedback({ type: 'error', message: 'حدد إجابة لكل سؤال.' });
            setIsSubmitting(false);
            return;
        }
        try {
            const finalQuestions: Omit<Question, 'id'>[] = parsedQuestions.map((q, index) => {
                let finalQuestionText = q.questionText;
                if (q.passage) finalQuestionText = `**النص:**\n${q.passage}\n\n**السؤال:**\n${q.questionText}`;
                return { questionText: finalQuestionText, options: q.options, correctAnswer: correctAnswers[index] };
            });
            const testId = await onAddTest('verbal', `اختبار ${formState.testNumber.trim()}`, formState.selectedBank, formState.selectedCategory, formState.questionsText);
            await onAddQuestionsToTest('verbal', testId, finalQuestions);
            setFeedback({ type: 'success', message: `تمت الإضافة بنجاح.` });
            setFormState({ ...formState, testNumber: '', questionsText: '' });
            setParsedQuestions([]); setCorrectAnswers({});
        } catch (error: any) { setFeedback({ type: 'error', message: "حدث خطأ." }); } finally { setIsSubmitting(false); }
    };

    const testsToShow = useMemo(() => {
        if (activeBank && activeCategory) return data.tests.verbal[activeBank]?.[activeCategory] || [];
        return [];
    }, [activeBank, activeCategory, data.tests.verbal]);

    const toggleTestSelection = (id: string) => {
        setSelectedTestIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedTestIds.size === 0) return;
        if (!window.confirm(`هل أنت متأكد من حذف ${toArabic(selectedTestIds.size)} اختبارات نهائياً؟`)) return;
        setIsSubmitting(true);
        try {
            await onDeleteTest('verbal', Array.from(selectedTestIds));
            setSelectedTestIds(new Set());
            setIsSelectionMode(false);
        } catch (e) {
            alert("حدث خطأ أثناء الحذف.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-bg min-h-screen flex flex-col" dir="rtl">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center"><button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors"><ArrowRightIcon className="w-6 h-6 text-text-muted rotate-180"/></button><h1 className="text-xl md:text-2xl font-bold text-text mx-auto pr-4">إدارة القسم اللفظي</h1></div>
            </header>
            <div className="flex-grow container mx-auto flex flex-row overflow-hidden">
                <aside className="w-1/4 p-4 border-l border-border overflow-y-auto hidden md:block">
                    <nav className="space-y-1">{Object.entries(VERBAL_BANKS).map(([bankKey, bankName]) => (<div key={bankKey}><button onClick={() => setActiveBank(bankKey)} className={`w-full text-right p-3 rounded-lg font-bold text-lg transition-colors ${activeBank === bankKey ? 'bg-primary/20 text-primary' : 'hover:bg-surface'}`}>{bankName}</button>{activeBank === bankKey && (<div className="pr-4 mt-2 space-y-1 border-r-2 border-zinc-700">{Object.entries(VERBAL_CATEGORIES).map(([catKey, catName]) => { const testCount = data.tests.verbal[bankKey]?.[catKey]?.length || 0; return (<button key={catKey} onClick={() => setActiveCategory(catKey)} className={`w-full text-right p-2 rounded-md transition-colors text-base flex justify-between items-center ${activeCategory === catKey ? 'bg-zinc-700 font-semibold' : 'hover:bg-zinc-800'}`}><span>{catName}</span><span className="text-xs font-mono bg-zinc-600 px-2 py-0.5 rounded-full">{toArabic(testCount)}</span></button>) })}</div>)}</div>))}</nav>
                </aside>
                <main className="w-full md:w-3/4 p-4 md:p-6 overflow-y-auto space-y-8">
                    <div className="bg-surface p-6 rounded-lg border border-border">
                        <h2 className="text-2xl font-bold mb-4">إضافة اختبار</h2>
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="w-full lg:w-1/2 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select value={formState.selectedBank} onChange={e => updateFormState({ selectedBank: e.target.value })} className="bg-zinc-700 p-2 rounded">{Object.entries(VERBAL_BANKS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                                    <select value={formState.selectedCategory} onChange={e => updateFormState({ selectedCategory: e.target.value })} className="bg-zinc-700 p-2 rounded">{Object.entries(VERBAL_CATEGORIES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                                    <input type="text" value={formState.testNumber} onChange={e => updateFormState({ testNumber: e.target.value })} placeholder="رقم الاختبار" className="bg-zinc-700 p-2 rounded" />
                                </div>
                                <textarea value={formState.questionsText} onChange={e => updateFormState({ questionsText: e.target.value })} placeholder="الصق النص..." rows={10} className="w-full bg-zinc-700 p-3 rounded" />
                                {feedback && <div className="p-3 bg-zinc-800 text-sm font-bold text-primary">{feedback.message}</div>}
                            </div>
                            <div className="w-full lg:w-1/2">
                                {parsedQuestions.length > 0 ? (<div className="bg-zinc-900/50 p-4 rounded-lg h-full max-h-[600px] overflow-y-auto"><h3 className="font-bold mb-4">المعاينة ({toArabic(parsedQuestions.length)})</h3>{parsedQuestions.map((q, qidx) => (<div key={qidx} className="mb-4 bg-zinc-800 p-3 rounded-lg"><p className="font-bold mb-2">{toArabic(qidx+1)}. {q.questionText}</p>{q.options.map(o => (<label key={o} className={`block p-2 rounded mb-1 cursor-pointer ${correctAnswers[qidx] === o ? 'bg-accent/20 border-accent border' : ''}`}><input type="radio" name={`q-${qidx}`} checked={correctAnswers[qidx] === o} onChange={() => handleCorrectAnswerSelect(qidx, o)} className="hidden" /> {o}</label>))}</div>))}<button onClick={handleFinalSubmit} disabled={isSubmitting} className="w-full py-3 bg-accent text-bg font-black rounded-lg mt-4">{isSubmitting ? 'جاري الحفظ...' : 'حفظ نهائي'}</button></div>) : <div className="h-full bg-zinc-900/20 rounded flex items-center justify-center p-10 opacity-30 border-2 border-dashed">الصق الأسئلة لعرض المعاينة</div>}
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">الاختبارات المضافة ({toArabic(testsToShow.length)})</h2>
                            <div className="flex gap-2">
                                <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedTestIds(new Set()); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isSelectionMode ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-zinc-800 text-text hover:bg-zinc-700'}`}>{isSelectionMode ? 'إلغاء التحديد' : 'تحديد متعدد'}</button>
                                {isSelectionMode && <button onClick={handleDeleteSelected} disabled={selectedTestIds.size === 0 || isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 shadow-lg shadow-red-500/20">حذف المختار ({toArabic(selectedTestIds.size)})</button>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            {testsToShow.map(test => {
                                const isSelected = selectedTestIds.has(test.id);
                                return (
                                    <div key={test.id} 
                                        onClick={() => isSelectionMode && toggleTestSelection(test.id)}
                                        className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelectionMode ? (isSelected ? 'bg-red-900/10 border-red-500 shadow-md' : 'bg-surface border-border hover:border-red-500/30') : 'bg-surface border-border'}`}>
                                        <div className="flex items-center gap-3">
                                            {isSelectionMode && <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-red-600 border-red-600' : 'border-zinc-500 bg-zinc-800'}`}>{isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}</div>}
                                            <span className="font-bold">{test.name} <span className="text-xs text-text-muted mr-2">({toArabic(test.questions?.length || 0)} سؤال)</span></span>
                                        </div>
                                        {!isSelectionMode && (
                                            <div className="flex gap-4">
                                                <button onClick={(e) => { e.stopPropagation(); setViewingSourceText(test.sourceText || ''); }} className="text-primary hover:underline text-sm font-bold">عرض</button>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingTest({ test, bankKey: activeBank!, catKey: activeCategory! }); }} className="text-accent hover:underline text-sm font-bold">تعديل</button>
                                                <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm([test.id]); }} className="text-danger hover:scale-110 transition-transform"><TrashIcon className="w-5 h-5"/></button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {testsToShow.length === 0 && <div className="text-center py-10 opacity-30 italic">لا توجد اختبارات في هذا القسم حالياً.</div>}
                        </div>
                    </div>
                </main>
            </div>
            {editingTest && (<div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"><div className="bg-surface w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-xl border border-border"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black">تعديل إجابات {editingTest.test.name}</h3><button onClick={() => setEditingTest(null)} className="p-2 bg-zinc-800 rounded-full"><XCircleIcon /></button></div><div className="space-y-4">{editingTest.test.questions.map((q, idx) => (<div key={q.id} className="bg-zinc-800 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center"> <p className="flex-grow font-bold">{toArabic(idx+1)}. {q.questionText}</p><select value={q.correctAnswer} onChange={(e) => { const nqs = editingTest.test.questions.map(orig => orig.id === q.id ? {...orig, correctAnswer: e.target.value} : orig); setEditingTest({...editingTest, test: {...editingTest.test, questions: nqs}}); onUpdateQuestionAnswer('verbal', editingTest.test.id, q.id, e.target.value); }} className="bg-zinc-700 p-2 rounded min-w-[200px]">{q.options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>))}</div><button onClick={() => setEditingTest(null)} className="w-full py-4 bg-primary text-bg font-black rounded-xl mt-8">تم الانتهاء</button></div></div>)}
            {showDeleteConfirm && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><div className="bg-surface p-8 rounded-xl max-w-sm w-full text-center shadow-2xl border border-border"><h2 className="text-xl font-bold mb-4 text-danger">تأكيد الحذف</h2><p className="mb-6 opacity-80 font-bold">هل أنت متأكد من حذف الاختبار نهائياً؟</p><div className="flex gap-4 justify-center"><button onClick={() => setShowDeleteConfirm(null)} className="px-6 py-2 bg-zinc-700 rounded-lg font-bold">إلغاء</button><button onClick={async () => { await onDeleteTest('verbal', showDeleteConfirm); setShowDeleteConfirm(null); }} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/20">حذف نهائي</button></div></div></div>)}
            {viewingSourceText && <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setViewingSourceText(null)}><div className="bg-surface p-6 rounded-xl max-w-2xl w-full" onClick={e => e.stopPropagation()}><h3 className="font-bold mb-4 border-b border-border pb-2">النص الأصلي للاختبار</h3><textarea readOnly value={viewingSourceText} className="w-full h-96 bg-zinc-900 p-4 rounded-lg font-mono text-sm leading-relaxed" dir="rtl"></textarea></div></div>}
        </div>
    );
};
