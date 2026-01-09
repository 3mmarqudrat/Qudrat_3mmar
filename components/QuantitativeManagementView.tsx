import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowRightIcon, UploadCloudIcon, SaveIcon, SettingsIcon, FileTextIcon, PlayIcon, CheckCircleIcon, TrashIcon, MinusCircleIcon, PenIcon } from './Icons';
import { Question, Test, AppData, Section } from '../types';

declare const pdfjsLib: any;

interface QuantitativeManagementViewProps {
    onBack: () => void;
    onStartTest: (test: Test, returnTo?: string) => void;
    data: AppData;
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => string;
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => void;
    onUpdateQuestionAnswer: (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => void;
    onDeleteTests: (section: Section, testIds: string[]) => Promise<void>;
    processorQueue: any[]; 
    isProcessorWorking: boolean;
    onAddFilesToQueue: (files: File[], config: any) => void;
    onClearCompleted: () => void;
    onStopProcessing: () => void; 
    onSelectTest?: (testId: string) => void;
}

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

type ViewMode = 'upload' | 'calibrate' | 'details';
type CropMode = 'none' | 'question' | 'answer';

const STORAGE_KEY_CROP_CONFIG = 'quantitative_crop_config';
const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

export const QuantitativeManagementView: React.FC<QuantitativeManagementViewProps> = ({ 
    onBack, onStartTest, data, onUpdateQuestionAnswer, onDeleteTests,
    processorQueue, isProcessorWorking, onAddFilesToQueue, onClearCompleted, onStopProcessing, onSelectTest
}) => {
    
    const [cropConfig, setCropConfig] = useState<{ questionBox: CropBox | null, answerBox: CropBox | null }>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_CROP_CONFIG);
        return saved ? JSON.parse(saved) : { questionBox: null, answerBox: null };
    });

    const [viewMode, setViewMode] = useState<ViewMode>('upload');
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [currentCropMode, setCurrentCropMode] = useState<CropMode>('none');
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

    const getTestNumber = (name: string) => {
        const n = name.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
        const m = n.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
    };

    const sortedTests = useMemo(() => {
        return [...data.tests.quantitative].sort((a, b) => {
            const numA = getTestNumber(a.name);
            const numB = getTestNumber(b.name);
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
        });
    }, [data.tests.quantitative]);

    const selectedTest = useMemo(() => data.tests.quantitative.find(t => t.id === selectedTestId) || null, [data.tests.quantitative, selectedTestId]);

    useEffect(() => {
        if (selectedTestId && onSelectTest) onSelectTest(selectedTestId);
    }, [selectedTestId, onSelectTest]);

    const handleSaveConfig = () => {
        localStorage.setItem(STORAGE_KEY_CROP_CONFIG, JSON.stringify(cropConfig));
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    };

    const handleReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(2);
                const viewport = page.getViewport({ scale: 2.0 }); 
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                if (context) {
                    await page.render({ canvasContext: context, viewport: viewport } as any).promise;
                    setReferenceImage(canvas.toDataURL('image/jpeg', 1.0));
                }
            } catch (error) { alert('خطأ في معالجة الملف المرجعي'); }
        }
    };

    const drawCanvas = (ctx: CanvasRenderingContext2D | null, img: HTMLImageElement) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(img, 0, 0);
        
        if (cropConfig.questionBox) {
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
            ctx.strokeRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
            ctx.fillRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
        }
        if (cropConfig.answerBox) {
            ctx.strokeStyle = '#34d399'; ctx.lineWidth = 3;
            ctx.strokeRect(cropConfig.answerBox.x, cropConfig.answerBox.y, cropConfig.answerBox.width, cropConfig.answerBox.height);
            ctx.fillStyle = 'rgba(52, 211, 153, 0.1)';
            ctx.fillRect(cropConfig.answerBox.x, cropConfig.answerBox.y, cropConfig.answerBox.width, cropConfig.answerBox.height);
        }
    };

    useEffect(() => {
        if (viewMode === 'calibrate' && referenceImage && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = referenceImage;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                drawCanvas(ctx, img);
            };
        }
    }, [viewMode, referenceImage, cropConfig]);

    const startProcessing = () => {
        const savedConfig = localStorage.getItem(STORAGE_KEY_CROP_CONFIG);
        if (!savedConfig) { alert('يرجى ضبط مناطق القص وحفظها أولاً.'); return; }
        onAddFilesToQueue(stagedFiles, JSON.parse(savedConfig));
        setStagedFiles([]); 
    };

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
        if (!window.confirm(`هل أنت متأكد من حذف ${toArabic(selectedTestIds.size)} اختبارات؟`)) return;
        setIsDeleting(true);
        try {
            await onDeleteTests('quantitative', Array.from(selectedTestIds));
            setSelectedTestIds(new Set());
            setIsSelectionMode(false);
            if (selectedTestIds.has(selectedTestId || '')) setSelectedTestId(null);
        } catch (e) { alert("حدث خطأ"); } finally { setIsDeleting(false); }
    };

    return (
        <div className="bg-bg min-h-screen flex flex-col text-right" dir="rtl">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border shadow-lg">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={onBack} title="الرجوع للقائمة الرئيسية" className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                            <ArrowRightIcon className="w-6 h-6 text-text-muted rotate-180 md:rotate-0"/>
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-text mx-auto pr-4">إدارة القسم الكمي</h1>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setViewMode('calibrate')} className={`px-5 py-2 rounded-xl font-bold transition-all ${viewMode === 'calibrate' ? 'bg-primary text-white shadow-lg' : 'bg-zinc-700 text-slate-300'}`}>ضبط القص</button>
                        <button onClick={() => setViewMode('upload')} className={`px-5 py-2 rounded-xl font-bold transition-all ${viewMode === 'upload' ? 'bg-primary text-white shadow-lg' : 'bg-zinc-700 text-slate-300'}`}>رفع ملفات</button>
                    </div>
                </div>
            </header>

            <div className="flex flex-row h-[calc(100vh-80px)] overflow-hidden">
                <aside className="w-1/4 p-4 border-l border-border overflow-y-auto bg-surface/30">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-text-muted">الاختبارات ({toArabic(sortedTests.length)})</span>
                        <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="text-xs text-primary font-bold">{isSelectionMode ? 'إلغاء' : 'تحديد'}</button>
                    </div>
                    {isSelectionMode && (
                        <button onClick={handleDeleteSelected} disabled={selectedTestIds.size === 0 || isDeleting} className="w-full mb-4 py-2 bg-red-600 rounded-lg text-white font-bold text-sm">حذف المحدد</button>
                    )}
                    <div className="space-y-2">
                        {sortedTests.map(test => {
                            const totalQs = test.questions.length;
                            const unknownAns = test.questions.filter(q => q.correctAnswer === '?').length;
                            const editedAns = test.questions.filter(q => q.isEdited).length;
                            return (
                                <div key={test.id} 
                                    onClick={() => { if(!isSelectionMode) { setSelectedTestId(test.id); setViewMode('details'); } else toggleTestSelection(test.id); }}
                                    className={`p-3 rounded-lg border text-sm flex flex-col gap-1 transition-all cursor-pointer ${selectedTestId === test.id ? 'bg-primary/20 border-primary shadow-inner' : 'bg-surface border-zinc-700 hover:border-zinc-500'}`}>
                                    <div className="flex items-center justify-between gap-2 truncate font-bold text-right">
                                        <div className="flex items-center gap-2 truncate">
                                            {isSelectionMode && <div className={`w-4 h-4 rounded border flex-shrink-0 ${selectedTestIds.has(test.id) ? 'bg-primary border-primary' : 'border-zinc-500'}`}></div>}
                                            <span className="truncate">{test.name}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-0.5 text-[10px] text-text-muted mt-1 border-t border-zinc-700 pt-1">
                                        <div className="flex justify-between">
                                            <span>الأسئلة: {toArabic(totalQs)}</span>
                                            {unknownAns > 0 && <span className="text-amber-400 font-bold">مجهول: {toArabic(unknownAns)}</span>}
                                        </div>
                                        {editedAns > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-sky-400 flex items-center gap-1"><PenIcon className="w-2 h-2"/> معدل: {toArabic(editedAns)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex-grow p-6 overflow-y-auto bg-bg">
                    {viewMode === 'calibrate' ? (
                        <div className="space-y-4">
                            <div className="flex gap-4 items-center bg-surface p-4 rounded-2xl border border-border">
                                <label className="bg-zinc-800 px-6 py-2.5 rounded-xl cursor-pointer font-bold text-sm hover:bg-zinc-700 transition-colors">رفع ورقة معاينة<input type="file" accept="application/pdf" onChange={handleReferenceFileChange} className="hidden" /></label>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentCropMode('question')} className={`px-4 py-2 rounded-xl text-xs font-bold ${currentCropMode === 'question' ? 'bg-primary text-white' : 'bg-zinc-800'}`}>١. تحديد السؤال</button>
                                    <button onClick={() => setCurrentCropMode('answer')} className={`px-4 py-2 rounded-xl text-xs font-bold ${currentCropMode === 'answer' ? 'bg-success text-white' : 'bg-zinc-800'}`}>٢. تحديد الإجابة</button>
                                </div>
                                <button onClick={handleSaveConfig} className="bg-accent px-8 py-2.5 rounded-xl font-bold mr-auto shadow-lg shadow-accent/20">حفظ الإحداثيات</button>
                            </div>
                            <div className="bg-zinc-900 border border-border rounded-2xl p-4 overflow-auto flex justify-center shadow-inner min-h-[600px]">
                                {referenceImage ? (
                                    <div className="relative">
                                        <canvas ref={canvasRef} 
                                            onMouseDown={(e) => { if(currentCropMode==='none') return; const rect = canvasRef.current!.getBoundingClientRect(); setStartPos({x:e.clientX-rect.left, y:e.clientY-rect.top}); setIsDrawing(true); }}
                                            onMouseMove={(e) => { if(!isDrawing || !startPos) return; const rect = canvasRef.current!.getBoundingClientRect(); const ctx = canvasRef.current!.getContext('2d')!; const img = new Image(); img.src = referenceImage; drawCanvas(ctx, img); ctx.strokeStyle = currentCropMode==='question'?'#38bdf8':'#34d399'; ctx.strokeRect(startPos.x, startPos.y, (e.clientX-rect.left)-startPos.x, (e.clientY-rect.top)-startPos.y); }}
                                            onMouseUp={(e) => { if(!isDrawing || !startPos) return; const rect = canvasRef.current!.getBoundingClientRect(); const currentX = e.clientX-rect.left; const currentY = e.clientY-rect.top; const box = {x:Math.min(startPos.x, currentX), y:Math.min(startPos.y, currentY), width:Math.abs(currentX-startPos.x), height:Math.abs(currentY-startPos.y)}; setCropConfig(prev => currentCropMode==='question'?{...prev, questionBox:box}:{...prev, answerBox:box}); setIsDrawing(false); setStartPos(null); setCurrentCropMode('none'); }}
                                            className="cursor-crosshair bg-white" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-text-muted gap-4 opacity-50"><FileTextIcon className="w-20 h-20" /><p className="font-bold">يرجى رفع ملف PDF (صفحة ٢) للبدء بالضبط</p></div>
                                )}
                            </div>
                        </div>
                    ) : viewMode === 'upload' ? (
                        <div className="max-w-2xl mx-auto space-y-8 pt-10">
                            <div className="bg-surface p-12 rounded-3xl border-4 border-dashed border-zinc-700 text-center shadow-xl">
                                <UploadCloudIcon className="w-20 h-20 mx-auto text-primary mb-6" />
                                <h2 className="text-3xl font-bold mb-4">معالجة دفعية للملفات</h2>
                                <label className="inline-block bg-primary text-white px-10 py-4 rounded-2xl cursor-pointer font-bold text-lg hover:scale-105 transition-transform">اختيار ملفات PDF<input type="file" accept="application/pdf" multiple onChange={(e) => e.target.files && setStagedFiles(Array.from(e.target.files))} className="hidden" /></label>
                                {stagedFiles.length > 0 && <button onClick={startProcessing} className="w-full mt-8 py-4 bg-accent text-white rounded-2xl font-bold text-xl shadow-xl shadow-accent/20">بدء المعالجة والاستخراج</button>}
                            </div>
                            <div className="space-y-4">
                                {processorQueue.map(item => (
                                    <div key={item.id} className="bg-surface p-4 rounded-2xl border border-border shadow-md">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="truncate font-bold text-sm">{item.fileName}</span>
                                            <span className="font-bold text-primary">{item.status === 'completed' ? 'تم اكتمال الاختبار' : `${toArabic(item.progress)}%`}</span>
                                        </div>
                                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                            <div className="bg-primary h-full transition-all duration-300" style={{width: `${item.progress}%`}}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : selectedTest && (
                        <div className="max-w-4xl mx-auto space-y-8 pb-10">
                            <div className="flex justify-between items-center bg-surface p-8 rounded-2xl border border-border shadow-2xl">
                                <div className="text-right">
                                    <h2 className="text-4xl font-bold text-primary">{selectedTest.name}</h2>
                                    <p className="text-text-muted mt-2 text-lg">{toArabic(selectedTest.questions.length)} سؤال تم استخراجه</p>
                                </div>
                                <button onClick={() => onStartTest(selectedTest, 'quantitativeManagement')} className="bg-primary text-white px-10 py-4 rounded-xl font-bold hover:brightness-110 transition-all shadow-xl shadow-primary/20 text-lg border-2 border-primary/20">بدء معاينة الطلاب</button>
                            </div>
                            <div className="space-y-6 text-right">
                                {selectedTest.questions.map((q, idx) => (
                                    <div key={q.id} className="bg-surface p-6 rounded-2xl border border-border shadow-md">
                                        <div className="flex justify-between items-center mb-6">
                                            <span className="font-bold text-xl text-gold">سؤال رقم {toArabic(idx+1)} {q.isEdited && <span className="text-[10px] bg-sky-900/50 text-sky-400 px-2 py-0.5 rounded-full border border-sky-800 mr-2">معدل يدوياً</span>}</span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm font-bold text-text-muted">الإجابة:</span>
                                                <select 
                                                    value={q.correctAnswer} 
                                                    onChange={e => onUpdateQuestionAnswer('quantitative', selectedTest.id, q.id, e.target.value)} 
                                                    className={`bg-zinc-700 border-2 rounded-xl px-4 py-2 font-bold text-lg transition-colors cursor-pointer ${q.correctAnswer === '?' ? 'border-amber-500/50 text-amber-400' : 'border-zinc-600 text-accent'}`}
                                                >
                                                    {['?','أ','ب','ج','د'].map(o=><option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-2"><p className="text-xs font-bold text-text-muted opacity-50 uppercase">صورة السؤال</p><img src={q.questionImage} className="w-full rounded-xl border border-zinc-700 bg-white shadow-lg" /></div>
                                            <div className="space-y-2"><p className="text-xs font-bold text-text-muted opacity-50 uppercase">منطقة التحليل (للإجابة)</p><div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-center min-h-[150px] shadow-lg"><img src={q.verificationImage} className="max-h-32 object-contain" /></div></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};