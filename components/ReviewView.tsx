
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Section, FolderQuestion, Test, VERBAL_BANKS, VERBAL_CATEGORIES, ReviewFilterState, ReviewDateFilter, ReviewAttributeFilters } from '../types';
import { ArrowRightIcon, BookOpenIcon, BarChartIcon, PlayIcon, FlagIcon, StarIcon, XCircleIcon, ClockIcon, SettingsIcon, CheckCircleIcon, ChevronDownIcon } from './Icons';
// Fix: MultiSelectDropdown is now exported from ../App
import { MultiSelectDropdown } from '../App';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

interface ReviewViewProps {
    data: AppData;
    onBack: () => void;
    onStartReviewTest: (test: Test) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ data, onBack, onStartReviewTest }) => {
    const [activeSection, setActiveSection] = useState<Section>(() => (localStorage.getItem('review_activeSection') as Section) || 'quantitative');
    const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('review_activeTab') || 'mistake');
    const [activePanel, setActivePanel] = useState<'time' | 'attribute'>(() => (localStorage.getItem('review_activePanel') as any) || 'time');
    
    const [timeFilter, setTimeFilter] = useState<ReviewDateFilter>(() => (localStorage.getItem('review_timeFilter') as any) || 'today');
    const [attrFilters, setAttrFilters] = useState<ReviewAttributeFilters>(() => {
        const saved = localStorage.getItem('review_attrFilters');
        return saved ? JSON.parse(saved) : { bank: ['all'], category: ['all'], type: ['all'], selectedTestIds: ['all'] };
    });

    const availableTests = useMemo(() => {
        return activeSection === 'quantitative' ? data.tests.quantitative : [];
    }, [data.tests.quantitative, activeSection]);

    useEffect(() => {
        localStorage.setItem('review_activeSection', activeSection);
        localStorage.setItem('review_activeTab', activeTab);
        localStorage.setItem('review_activePanel', activePanel);
        localStorage.setItem('review_timeFilter', timeFilter || '');
        localStorage.setItem('review_attrFilters', JSON.stringify(attrFilters));
    }, [activeSection, activeTab, activePanel, timeFilter, attrFilters]);

    const allQuestions = useMemo(() => {
        return (data.reviewTests[activeSection]?.[0]?.questions as FolderQuestion[]) || [];
    }, [data.reviewTests, activeSection]);

    const filteredQuestions = useMemo(() => {
        let qs = [...allQuestions];

        if (activeTab === 'mistake') qs = qs.filter(q => q.reviewType === 'mistake');
        else if (activeTab === 'delay') qs = qs.filter(q => q.reviewType === 'delay');
        else if (activeTab === 'specialLaw') qs = qs.filter(q => q.reviewType === 'specialLaw');
        else if (activeTab === 'duplicate') {
            const counts: Record<string, number> = {};
            qs.forEach(q => { if (q.originalId) counts[q.originalId] = (counts[q.originalId] || 0) + 1; });
            return Object.keys(counts).filter(id => counts[id] > 1).map(id => qs.find(q => q.originalId === id)!);
        } else if (activeTab === 'other') {
            if (activePanel === 'time') {
                const now = new Date();
                if (timeFilter === 'today') {
                    qs = qs.filter(q => new Date(q.addedDate!).toDateString() === now.toDateString());
                } else if (timeFilter === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    qs = qs.filter(q => new Date(q.addedDate!) >= weekAgo);
                } else if (timeFilter === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    qs = qs.filter(q => new Date(q.addedDate!) >= monthAgo);
                }
            } else {
                // فلترة متعددة حسب النوع
                if (!attrFilters.type.includes('all')) {
                    qs = qs.filter(q => attrFilters.type.includes(q.reviewType!));
                }

                if (activeSection === 'verbal') {
                    // فلترة متعددة للبنوك والأقسام
                    if (!attrFilters.bank.includes('all')) {
                        qs = qs.filter(q => attrFilters.bank.includes(q.bankKey!));
                    }
                    if (!attrFilters.category.includes('all')) {
                        qs = qs.filter(q => attrFilters.category.includes(q.categoryKey!));
                    }
                } else if (activeSection === 'quantitative') {
                    // فلترة متعددة للاختبارات
                    if (!attrFilters.selectedTestIds.includes('all')) {
                        qs = qs.filter(q => attrFilters.selectedTestIds.includes(q.testName!));
                    }
                }
            }
        }
        return qs;
    }, [allQuestions, activeTab, activePanel, timeFilter, attrFilters, activeSection]);

    const generateTests = (questions: FolderQuestion[]) => {
        const tests: Test[] = [];
        const chunkSize = 75;
        for (let i = 0; i < questions.length; i += chunkSize) {
            tests.push({
                id: `rev_test_${activeTab}_${i}`,
                name: `الاختبار رقم ${toArabic(Math.floor(i / chunkSize) + 1)}`,
                questions: questions.slice(i, i + chunkSize),
                section: activeSection
            });
        }
        return tests;
    };

    const testsToDisplay = useMemo(() => {
        if (activeTab === 'other' && activePanel === 'time' && (timeFilter === 'byDay' || timeFilter === 'byMonth')) {
            const groups: Record<string, FolderQuestion[]> = {};
            allQuestions.forEach(q => {
                const date = new Date(q.addedDate!);
                const key = timeFilter === 'byDay' 
                    ? date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'numeric' })
                    : date.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
                if (!groups[key]) groups[key] = [];
                groups[key].push(q);
            });
            return Object.entries(groups).map(([name, qs], idx) => ({
                id: `group_${idx}`,
                name: name,
                questions: qs,
                section: activeSection
            }));
        }
        return generateTests(filteredQuestions);
    }, [filteredQuestions, allQuestions, activeTab, timeFilter, activePanel, activeSection]);

    return (
        <div className="bg-bg min-h-screen flex flex-col text-right font-cairo" dir="rtl">
            <header className="bg-surface/80 backdrop-blur-lg p-3 sticky top-0 z-20 border-b border-border shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                        <ArrowRightIcon className="w-6 h-6 text-text-muted rotate-180 md:rotate-0"/>
                    </button>
                    <h1 className="text-xl font-bold text-text mx-auto">مركز المراجعة</h1>
                </div>
            </header>

            <main className="container mx-auto p-3 md:p-6 flex-grow flex flex-col gap-4">
                <div className="flex gap-2 justify-center">
                    <button onClick={() => setActiveSection('quantitative')} className={`flex-1 max-w-[160px] p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${activeSection === 'quantitative' ? 'border-primary bg-primary/10' : 'border-zinc-800 bg-surface opacity-60'}`}>
                        <BarChartIcon className={`w-6 h-6 ${activeSection === 'quantitative' ? 'text-primary' : 'text-text-muted'}`} />
                        <span className="font-bold text-sm">القسم الكمي</span>
                    </button>
                    <button onClick={() => setActiveSection('verbal')} className={`flex-1 max-w-[160px] p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${activeSection === 'verbal' ? 'border-primary bg-primary/10' : 'border-zinc-800 bg-surface opacity-60'}`}>
                        <BookOpenIcon className={`w-6 h-6 ${activeSection === 'verbal' ? 'text-primary' : 'text-text-muted'}`} />
                        <span className="font-bold text-sm">القسم اللفظي</span>
                    </button>
                </div>

                <div className="bg-surface rounded-xl border border-border p-1 flex overflow-x-auto no-scrollbar shadow-inner">
                    {['all', 'mistake', 'delay', 'specialLaw', 'duplicate', 'other'].map(tab => {
                        if (activeSection === 'verbal' && (tab === 'specialLaw' || tab === 'duplicate')) return null;
                        const label = tab === 'all' ? 'الكل' : tab === 'mistake' ? 'الأخطاء' : tab === 'delay' ? 'التأخير' : tab === 'specialLaw' ? 'قانون خاص' : tab === 'duplicate' ? 'مكرر' : 'أخرى';
                        return (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? 'bg-zinc-700 text-white shadow-md' : 'text-text-muted hover:bg-zinc-800'}`}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'other' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div 
                            onClick={() => setActivePanel('time')} 
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${activePanel === 'time' ? 'border-accent bg-accent/5 ring-2 ring-accent/20 shadow-lg' : 'border-zinc-800 bg-surface opacity-60 hover:opacity-100'}`}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-base flex items-center gap-2"><ClockIcon className="w-5 h-5 text-accent" /> التصنيف حسب الوقت</h3>
                                {activePanel === 'time' && <CheckCircleIcon className="w-5 h-5 text-accent" />}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['today', 'week', 'month', 'byDay', 'byMonth'].map((f) => (
                                    <button 
                                        key={f} 
                                        onClick={(e) => { e.stopPropagation(); setTimeFilter(f as any); setActivePanel('time'); }} 
                                        className={`py-1.5 px-3 rounded-md text-xs font-bold border transition-all ${timeFilter === f && activePanel === 'time' ? 'bg-accent text-white border-accent' : 'bg-zinc-800 border-zinc-700 text-text-muted'}`}
                                    >
                                        {f === 'today' ? 'اليوم' : f === 'week' ? 'أسبوع' : f === 'month' ? 'شهر' : f === 'byDay' ? 'بالأيام' : 'بالأشهر'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div 
                            onClick={() => setActivePanel('attribute')} 
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${activePanel === 'attribute' ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-lg' : 'border-zinc-800 bg-surface opacity-60 hover:opacity-100'}`}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-base flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-primary" /> التصنيف حسب الخصائص</h3>
                                {activePanel === 'attribute' && <CheckCircleIcon className="w-5 h-5 text-primary" />}
                            </div>
                            <div className="space-y-3">
                                {activeSection === 'verbal' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <MultiSelectDropdown 
                                            label="البنوك"
                                            options={[{value:'all', label:'الكل'}, ...Object.entries(VERBAL_BANKS).map(([k,v])=>({value:k, label:v}))]}
                                            selectedValues={attrFilters.bank}
                                            onChange={vals => setAttrFilters({...attrFilters, bank: vals})}
                                        />
                                        <MultiSelectDropdown 
                                            label="الأقسام"
                                            options={[{value:'all', label:'الكل'}, ...Object.entries(VERBAL_CATEGORIES).map(([k,v])=>({value:k, label:v}))]}
                                            selectedValues={attrFilters.category}
                                            onChange={vals => setAttrFilters({...attrFilters, category: vals})}
                                        />
                                    </div>
                                ) : (
                                    <MultiSelectDropdown 
                                        label="الاختبارات"
                                        options={[{value:'all', label:'الكل'}, ...availableTests.map(t=>({value:t.name, label:t.name}))]}
                                        selectedValues={attrFilters.selectedTestIds}
                                        onChange={vals => setAttrFilters({...attrFilters, selectedTestIds: vals})}
                                    />
                                )}
                                <MultiSelectDropdown 
                                    label="أنواع الأسئلة"
                                    options={[
                                        {value:'all', label:'الكل'},
                                        {value:'mistake', label:'الأخطاء'},
                                        {value:'delay', label:'التأخير'},
                                        ...(activeSection === 'quantitative' ? [{value:'specialLaw', label:'قانون خاص'}] : [])
                                    ]}
                                    selectedValues={attrFilters.type}
                                    onChange={vals => setAttrFilters({...attrFilters, type: vals as any})}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {testsToDisplay.length > 0 ? testsToDisplay.map((test) => (
                        <div key={test.id} className="bg-surface rounded-xl border border-border p-4 flex flex-col justify-between hover:border-primary transition-all group shadow-md hover:shadow-primary/10">
                            <div className="mb-3">
                                <h3 className="text-lg font-black text-primary truncate">{test.name}</h3>
                                <div className="flex items-center justify-between text-text-muted text-xs mt-1">
                                    <span className="flex items-center gap-1"><BookOpenIcon className="w-3 h-3" /> {toArabic(test.questions.length)} سؤال</span>
                                    {activeTab === 'duplicate' && <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded text-[10px] font-bold">مكرر</span>}
                                </div>
                            </div>
                            <button onClick={() => onStartReviewTest(test)} className="w-full py-2 bg-zinc-800 hover:bg-primary hover:text-bg rounded-lg font-black text-sm transition-all flex items-center justify-center gap-2">
                                <PlayIcon className="w-3 h-3" /> بدء الاختبار
                            </button>
                        </div>
                    )) : (
                        <div className="col-span-full py-16 text-center opacity-30 flex flex-col items-center">
                            <XCircleIcon className="w-12 h-12 mb-2" />
                            <p className="text-lg font-bold">لا توجد أسئلة</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
