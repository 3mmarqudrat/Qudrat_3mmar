
import { useState, useRef, useEffect, useCallback } from 'react';
import { Question, Section } from '../types';

declare const pdfjsLib: any;
declare const Tesseract: any;

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ProcessItem {
    id: string;
    file: File;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
}

interface ProcessorConfig {
    questionBox: CropBox;
    answerBox: CropBox;
}

export const useQuantitativeProcessor = (
    onAddTest: (section: Section, testName: string, bankKey: string, categoryKey: string, sourceText: string) => Promise<string>,
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[]) => Promise<void>
) => {
    const [queue, setQueue] = useState<ProcessItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentConfig, setCurrentConfig] = useState<ProcessorConfig | null>(null);
    const processingRef = useRef(false);

    const extractAnswerFromText = (text: string): string => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        const match = normalized.match(/الإجابة الصحيحة[:\s]+([أبجد])/);
        if (match && match[1]) return match[1];
        const fallbackMatch = normalized.match(/[أبجد]/);
        return fallbackMatch ? fallbackMatch[0] : '?';
    };

    const processNextItem = useCallback(async () => {
        if (processingRef.current || !currentConfig) return;
        
        const nextItem = queue.find(i => i.status === 'pending');
        if (!nextItem) {
            setIsProcessing(false);
            return;
        }

        processingRef.current = true;
        setIsProcessing(true);

        setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'processing' } : i));

        try {
            const arrayBuffer = await nextItem.file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            
            const testName = nextItem.fileName.replace(/\.pdf$/i, '').split('-')[0].trim();
            
            // هام جداً: انتظار إنشاء الاختبار والحصول على معرفه الحقيقي
            const testId = await onAddTest('quantitative', testName, '', '', `ملف مصدري مستخرج: ${nextItem.fileName}`);

            if (!testId) throw new Error("Failed to create test reference");

            const questionsToAdd: Omit<Question, 'id'>[] = [];
            const startPage = 2; // تخطي الغلاف

            for (let pageNum = startPage; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 }); 
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                // قص منطقة السؤال
                const qCanvas = document.createElement('canvas');
                qCanvas.width = currentConfig.questionBox.width;
                qCanvas.height = currentConfig.questionBox.height;
                qCanvas.getContext('2d')!.drawImage(
                    canvas, 
                    currentConfig.questionBox.x, currentConfig.questionBox.y, 
                    currentConfig.questionBox.width, currentConfig.questionBox.height, 
                    0, 0, 
                    currentConfig.questionBox.width, currentConfig.questionBox.height
                );
                
                // قص منطقة الإجابة
                const aCanvas = document.createElement('canvas');
                aCanvas.width = currentConfig.answerBox.width;
                aCanvas.height = currentConfig.answerBox.height;
                aCanvas.getContext('2d')!.drawImage(
                    canvas, 
                    currentConfig.answerBox.x, currentConfig.answerBox.y, 
                    currentConfig.answerBox.width, currentConfig.answerBox.height, 
                    0, 0, 
                    currentConfig.answerBox.width, currentConfig.answerBox.height
                );

                let autoAnswer = '?';
                try {
                    const { data: { text } } = await Tesseract.recognize(aCanvas, 'ara', { logger: () => {} });
                    autoAnswer = extractAnswerFromText(text);
                } catch (e) {}

                questionsToAdd.push({
                    questionText: `سؤال مستخرج من صفحة ${pageNum}`,
                    questionImage: qCanvas.toDataURL('image/webp', 0.8), 
                    verificationImage: aCanvas.toDataURL('image/webp', 0.6),
                    options: ['أ', 'ب', 'ج', 'د'],
                    correctAnswer: autoAnswer,
                    order: pageNum - startPage
                });
                
                const progress = Math.round(((pageNum - 1) / (pdf.numPages - 1)) * 100);
                setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, progress } : item));
            }

            if (questionsToAdd.length > 0) {
                // انتظار اكتمال رفع جميع الأسئلة قبل تعليم المهمة كمكتملة
                await onAddQuestionsToTest('quantitative', testId, questionsToAdd);
            }

            setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'completed', progress: 100 } : item));
            
            // نجاح المعالجة يقتضي تحديث واجهة المستخدم فوراً
            console.log(`Successfully processed ${questionsToAdd.length} questions for test ${testId}`);

        } catch (error) {
            console.error("Processing error:", error);
            setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'error' } : item));
        } finally {
            processingRef.current = false;
        }
    }, [queue, currentConfig, onAddTest, onAddQuestionsToTest]);

    useEffect(() => {
        if (!processingRef.current && queue.some(i => i.status === 'pending')) {
            processNextItem();
        }
    }, [queue, processNextItem]);

    return { 
        queue, 
        isProcessing, 
        addFilesToQueue: (files: File[], config: ProcessorConfig) => {
            const items: ProcessItem[] = files.map(f => ({
                id: `j_${Date.now()}_${Math.random()}`,
                file: f,
                fileName: f.name,
                status: 'pending',
                progress: 0
            }));
            setCurrentConfig(config);
            setQueue(prev => [...prev, ...items]);
        }, 
        clearCompleted: () => setQueue(prev => prev.filter(i => i.status !== 'completed')),
        cancelAll: () => { setQueue([]); setIsProcessing(false); processingRef.current = false; }
    };
};
