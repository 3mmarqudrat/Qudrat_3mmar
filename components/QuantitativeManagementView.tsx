
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowRightIcon, UploadCloudIcon, SaveIcon, SettingsIcon, FileTextIcon, PlayIcon, CheckCircleIcon, TrashIcon, MinusCircleIcon, PenIcon, XCircleIcon, ClockIcon, BookOpenIcon } from './Icons';
import { Question, Test, AppData, Section } from '../types';

declare const pdfjsLib: any;

interface QuantitativeManagementViewProps {
    onBack: () => void;
    onStartTest: (test: Test, returnTo?: string) => void;
    data: AppData;
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => Promise<string>;
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => Promise<void>;
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

const STORAGE_KEY_CROP_CONFIG = 'qudrat_crop_v3_stable';
const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

export const QuantitativeManagementView: React.FC<QuantitativeManagementViewProps> = ({ 
    onBack, onStartTest, data, onUpdateQuestionAnswer,
    processorQueue, onAddFilesToQueue, onSelectTest, onClearCompleted, onStopProcessing
}) => {
    
    const [cropConfig, setCropConfig] = useState<{ questionBox: CropBox | null, answerBox: CropBox | null }>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_CROP_CONFIG);
        return saved ? JSON.parse(saved) : { questionBox: null, answerBox: null };
    });

    const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('qudrat_last_view_mode') as ViewMode) || 'upload');
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [currentCropMode, setCurrentCropMode] = useState<CropMode>('none');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

    // تحميل جميع أسئلة الاختبارات فور دخول الصفحة لضمان ظهور الأرقام
    useEffect(() => {
        if (onSelectTest && data.tests.quantitative.length > 0) {
            data.tests.quantitative.forEach(test => {
                onSelectTest(test.id);
            });
        }
    }, [data.tests.quantitative.length]);

    useEffect(() => {
        localStorage.setItem('qudrat_last_view_mode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        if (cropConfig.questionBox || cropConfig.answerBox) {
            localStorage.setItem(STORAGE_KEY_CROP_CONFIG, JSON.stringify(cropConfig));
        }
    }, [cropConfig]);

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

    const handleSaveConfig = () => {
        if (!cropConfig.questionBox || !cropConfig.answerBox) {
            alert("يرجى تحديد المربعات أولاً.");
            return;
        }
        localStorage.setItem(STORAGE_KEY_CROP_CONFIG, JSON.stringify(cropConfig));
        alert("تم حفظ إحداثيات القص بنجاح.");
    };

    const handleReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(pdf.numPages > 1 ? 2 : 1);
                const viewport = page.getViewport({ scale: 2.0 }); 
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                if (context) {
                    await page.render({ canvasContext: context, viewport: viewport } as any).promise;
                    setReferenceImage(canvas.toDataURL('image/jpeg', 1.0));
                }
            } catch (error) { alert('خطأ في معالجة الملف'); }
        }
    };

    const drawCanvas = (ctx: CanvasRenderingContext2D | null, img: HTMLImageElement) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(img, 0, 0);
        if (cropConfig.questionBox) {
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4;
            ctx.strokeRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.fillRect(cropConfig.questionBox.x, cropConfig.questionBox.y, cropConfig.questionBox.width, cropConfig.questionBox.height);
        }
        if (cropConfig.answerBox) {
            ctx.strokeStyle = '#34d399'; ctx.lineWidth = 4;
            ctx.strokeRect(cropConfig.answerBox.x, cropConfig.answerBox.y, cropConfig.answerBox.width, cropConfig.answerBox.height);
            ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
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
        if (!savedConfig) { 
            alert('يجب ضبط القص أولاً.'); 
            setViewMode('calibrate');
            return; 
        }
        onAddFilesToQueue(stagedFiles, JSON.parse(savedConfig));
        setStagedFiles([]); 
    };

    return (
        <div className="bg-bg min-h-screen flex flex-col text-right" dir="rtl">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                            <ArrowRightIcon className="w-6 h-6 text-text-muted rotate-180"/>
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-text mx-auto pr-4">إدارة القسم الكمي</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setViewMode('calibrate')} className={`px-4 py-2 rounded-md transition-all ${viewMode === 'calibrate' ? 'bg-primary text-bg font-black' : 'bg-zinc-700 text-text-muted hover:bg-zinc-600'}`}>ضبط القص</button>
                        <button onClick={() => setViewMode('upload')} className={`px-4 py-2 rounded-md transition-all ${viewMode === 'upload' ? 'bg-primary text-bg font-black' : 'bg-zinc-700 text-text-muted hover:bg-zinc-600'}`}>رفع ملفات</button>
                    </div>
                </div>
            </header>

            <div className="flex-grow flex flex-row overflow-hidden h-[calc(100vh-70px)]">
                <aside className="w-1/4 p-4 border-l border-border overflow-y-auto bg-zinc-900/30 custom-scrollbar">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-lg text-primary">الاختبارات ({toArabic(sortedTests.length)})</h2>
                    </div>
                    <div className="space-y-2">
                        {sortedTests.map(test => {
                            const isActive = selectedTestId === test.id;
                            const questionCount = test.questions?.length || 0;
                            return (
                                <div key={test.id} 
                                    onClick={() => { setSelectedTestId(test.id); setViewMode('details'); if(onSelectTest) onSelectTest(test.id); }}
                                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer relative ${isActive ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10' : 'bg-surface border-border hover:border-zinc-500'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="truncate w-full"><p className={`truncate font-bold text-sm ${isActive ? 'text-primary' : 'text-text'}`}>{test.name}</p><div className="text-[10px] text-text-muted mt-1 font-bold">{toArabic(questionCount)} سؤال</div></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <main className="w-full md:w-3/4 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-bg/50">
                    {viewMode === 'calibrate' ? (
                        <div className="bg-surface p-6 rounded-xl border border-border shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-primary">معايرة مناطق القص</h2>
                                <button onClick={handleSaveConfig} className="bg-success text-bg px-8 py-3 rounded-lg font-black text-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-success/20"><SaveIcon className="w-5 h-5" /> حفظ التحديدات</button>
                            </div>
                            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-zinc-900/50 rounded-lg border border-border">
                                <label className="bg-zinc-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-zinc-600 transition-colors border border-zinc-600 font-bold text-sm">١. رفع ملف للمعاينة<input type="file" accept="application/pdf" onChange={handleReferenceFileChange} className="hidden" /></label>
                                <button onClick={() => setCurrentCropMode('question')} className={`px-4 py-2 rounded-lg transition-all border-2 font-bold text-sm ${currentCropMode === 'question' ? 'bg-primary text-bg border-primary' : 'bg-zinc-800 border-zinc-700 text-primary'}`}>٢. تحديد السؤال</button>
                                <button onClick={() => setCurrentCropMode('answer')} className={`px-4 py-2 rounded-lg transition-all border-2 font-bold text-sm ${currentCropMode === 'answer' ? 'bg-accent text-bg border-accent' : 'bg-zinc-800 border-zinc-700 text-accent'}`}>٣. تحديد الإجابة</button>
                            </div>
                            <div className="bg-zinc-950 rounded-xl p-4 overflow-auto max-h-[800px] border-2 border-zinc-800 relative shadow-inner">
                                {referenceImage ? <canvas ref={canvasRef} onMouseDown={(e) => { if(currentCropMode==='none') return; const rect = canvasRef.current!.getBoundingClientRect(); setStartPos({x:e.clientX-rect.left, y:e.clientY-rect.top}); setIsDrawing(true); }} onMouseMove={(e) => { if(!isDrawing || !startPos) return; const rect = canvasRef.current!.getBoundingClientRect(); const ctx = canvasRef.current!.getContext('2d')!; const img = new Image(); img.src = referenceImage; drawCanvas(ctx, img); ctx.strokeStyle = currentCropMode==='question'?'#38bdf8':'#34d399'; ctx.strokeRect(startPos.x, startPos.y, (e.clientX-rect.left)-startPos.x, (e.clientY-rect.top)-startPos.y); }} onMouseUp={(e) => { if(!isDrawing || !startPos) return; const rect = canvasRef.current!.getBoundingClientRect(); const currentX = e.clientX-rect.left; const currentY = e.clientY-rect.top; const box = {x:Math.min(startPos.x, currentX), y:Math.min(startPos.y, currentY), width:Math.abs(currentX-startPos.x), height:Math.abs(currentY-startPos.y)}; setCropConfig(prev => currentCropMode==='question'?{...prev, questionBox:box}:{...prev, answerBox:box}); setIsDrawing(false); setStartPos(null); setCurrentCropMode('none'); }} className="cursor-crosshair bg-white mx-auto shadow-2xl rounded-sm" /> : <div className="text-center py-32 text-text-muted flex flex-col items-center gap-4"><div className="p-6 bg-zinc-900 rounded-full"><FileTextIcon className="w-20 h-20 opacity-20"/></div><p className="text-xl font-bold opacity-50">ارفع ملفاً للبدء بالمعايرة.</p></div>}
                            </div>
                        </div>
                    ) : viewMode === 'upload' ? (
                        <div className="space-y-6">
                            <div className="bg-surface p-8 rounded-xl border border-border shadow-xl">
                                <h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2"><UploadCloudIcon /> رفع الاختبارات</h2>
                                <div className="p-16 border-2 border-dashed border-zinc-700 rounded-2xl text-center bg-zinc-900/30 hover:border-primary/50 transition-all group cursor-pointer relative overflow-hidden">
                                    <UploadCloudIcon className="w-20 h-20 mx-auto mb-6 text-zinc-600 group-hover:text-primary transition-colors duration-500" />
                                    <label className="bg-primary text-bg px-12 py-4 rounded-xl cursor-pointer font-black text-lg hover:brightness-110 transition-all inline-block shadow-xl relative z-10">اختر ملفات PDF<input type="file" accept="application/pdf" multiple onChange={(e) => e.target.files && setStagedFiles(Array.from(e.target.files))} className="hidden" /></label>
                                </div>
                                {stagedFiles.length > 0 && (
                                    <div className="mt-8 space-y-4">
                                        <h3 className="font-black text-lg border-b border-zinc-700 pb-3 flex justify-between"><span>الملفات المختارة ({toArabic(stagedFiles.length)})</span></h3>
                                        <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                            {stagedFiles.map((f, i) => <div key={i} className="flex justify-between items-center text-sm p-4 bg-zinc-800/80 rounded-xl border border-zinc-700 shadow-sm"><div className="flex items-center gap-3"><FileTextIcon className="text-primary w-5 h-5"/> <span className="font-bold">{f.name}</span></div><button onClick={() => setStagedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 hover:bg-danger/20 rounded-full transition-colors text-danger"><XCircleIcon className="w-5 h-5"/></button></div>)}
                                        </div>
                                        <button onClick={startProcessing} className="w-full mt-6 py-5 bg-accent text-bg rounded-2xl font-black text-xl hover:brightness-110 shadow-2xl transition-all flex items-center justify-center gap-3"><PlayIcon className="w-6 h-6" /> بدء المعالجة</button>
                                    </div>
                                )}
                            </div>
                            {processorQueue.length > 0 && <div className="bg-surface p-8 rounded-xl border border-border shadow-xl"><div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-700"><h2 className="text-2xl font-black text-gold">مراقبة المعالجة</h2><div className="flex gap-4"><button onClick={onClearCompleted} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold">مسح المكتمل</button><button onClick={onStopProcessing} className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded-lg text-sm font-bold">إلغاء الكل</button></div></div><div className="space-y-4">{processorQueue.map(item => (<div key={item.id} className="bg-zinc-900/50 p-5 rounded-2xl border-2 border-zinc-800 shadow-inner"><div className="flex justify-between items-center mb-4"><span className="text-md font-black truncate max-w-[400px]">{item.fileName}</span><span className={`text-xs font-black px-3 py-1.5 rounded-full ${item.status === 'completed' ? 'bg-success/20 text-success' : item.status === 'processing' ? 'bg-primary/20 text-primary' : item.status === 'error' ? 'bg-danger/20 text-danger' : 'bg-zinc-800 text-zinc-500'}`}>{item.status === 'completed' ? 'تم ✅' : item.status === 'processing' ? `جاري (${toArabic(item.progress)}%)` : item.status === 'error' ? 'خطأ ❌' : 'انتظار...'}</span></div><div className="w-full bg-zinc-800 rounded-full h-4 p-1 overflow-hidden shadow-inner flex items-center"><div className={`h-full rounded-full transition-all duration-700 ease-out ${item.status === 'completed' ? 'bg-success shadow-[0_0_15px_rgba(52,211,153,0.5)]' : item.status === 'error' ? 'bg-danger' : 'bg-primary shadow-[0_0_15px_rgba(56,189,248,0.5)]'}`} style={{ width: `${item.progress}%` }}></div></div></div>))}</div></div>}
                        </div>
                    ) : selectedTest && (
                        <div className="space-y-8 pb-32" dir="rtl">
                            <div className="bg-surface p-10 rounded-2xl border-2 border-border flex flex-col lg:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden group"><div className="absolute top-0 right-0 w-3 h-full bg-primary transition-all"></div><div className="text-center lg:text-right w-full"><h2 className="text-5xl font-black text-primary mb-4">{selectedTest.name}</h2><p className="text-2xl text-text-muted flex items-center gap-3 lg:justify-start justify-center"><BookOpenIcon className="w-8 h-8" /> {toArabic(selectedTest.questions.length)} سؤالاً جاهزاً.</p></div><button onClick={() => onStartTest(selectedTest, 'quantitativeManagement')} className="w-full lg:w-auto bg-accent text-bg px-14 py-6 rounded-2xl font-black text-2xl hover:brightness-110 shadow-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-4"><PlayIcon className="w-8 h-8" /> دخول التدريب</button></div>
                            <div className="grid grid-cols-1 gap-10">
                                {selectedTest.questions.length > 0 ? selectedTest.questions.map((q, idx) => (
                                    <div key={q.id} className="bg-surface p-8 rounded-2xl border border-border shadow-xl hover:border-primary/30 transition-all group/card">
                                        <div className="flex flex-wrap justify-between items-center mb-8 border-b border-zinc-800 pb-6 gap-6"><span className="font-black text-3xl text-gold flex items-center gap-4"><span className="bg-gold/10 text-gold px-6 py-2 rounded-xl border-2 border-gold/20 shadow-lg shadow-gold/5">السؤال {toArabic(idx+1)}</span>{q.isEdited && <span className="text-xs text-accent bg-accent/10 px-3 py-1.5 rounded-lg font-black border border-accent/20 animate-pulse">تم التعديل يدوياً</span>}</span><div className="flex items-center gap-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800 shadow-inner"><span className="text-md text-text-muted font-black">الإجابة:</span><select value={q.correctAnswer} onChange={e => onUpdateQuestionAnswer('quantitative', selectedTest.id, q.id, e.target.value)} className="bg-zinc-800 border-2 border-zinc-700 rounded-xl px-8 py-3 text-3xl font-black focus:ring-accent focus:border-accent text-white cursor-pointer hover:border-accent transition-all shadow-lg">{['?','أ','ب','ج','د'].map(o=><option key={o} value={o}>{o}</option>)}</select></div></div>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                            <div className="space-y-4"><p className="text-md text-primary font-black text-right flex items-center gap-2"><FileTextIcon className="w-5 h-5" /> صورة السؤال</p><div className="bg-white p-4 rounded-2xl border-4 border-zinc-800 overflow-hidden shadow-2xl relative"><img src={q.questionImage} className="w-full h-auto rounded-lg" /></div></div>
                                            <div className="space-y-4"><p className="text-md text-accent font-black text-right flex items-center gap-2"><CheckCircleIcon className="w-5 h-5" /> مفتاح الحل</p><div className="bg-white p-8 rounded-2xl border-4 border-zinc-800 flex items-center justify-center min-h-[300px] shadow-2xl relative"><img src={q.verificationImage} className="max-h-64 object-contain" /></div></div>
                                        </div>
                                    </div>
                                )) : <div className="text-center py-20 bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-800"><XCircleIcon className="w-20 h-20 mx-auto mb-4 text-zinc-700" /><p className="text-2xl font-bold text-text-muted">هذا الاختبار فارغ.</p></div>}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
