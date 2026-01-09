
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Section, Test, TestAttempt, UserAnswer, Question, Folder, VERBAL_BANKS, VERBAL_CATEGORIES, VerbalTests, FolderQuestion, AppData, User, ReviewFilterState, ReviewAttributeFilterType } from './types';
import { useAppData } from './hooks/useAppData';
import { useQuantitativeProcessor } from './hooks/useQuantitativeProcessor';
import { BarChartIcon, BookOpenIcon, PlusCircleIcon, ArrowLeftIcon, HistoryIcon, TrashIcon, UploadCloudIcon, CheckCircleIcon, XCircleIcon, FolderIcon, SaveIcon, ChevronDownIcon, ArrowRightIcon, PlayIcon, LogOutIcon, UserIcon, MailIcon, KeyIcon, FileTextIcon, EyeIcon, EyeOffIcon, InfoIcon, ClockIcon, SettingsIcon, BookmarkIcon, CalendarIcon } from './components/Icons';
import { AuthView } from './components/AuthView';
import { AdminView } from './components/AdminView';
import { authService } from './services/authService';
import { AppSettings, settingsService } from './services/settingsService';
import { SiteManagementView } from './components/SiteManagementView';
import { VerbalManagementView } from './components/VerbalManagementView';
import { QuantitativeManagementView } from './components/QuantitativeManagementView';
import { TakeTestView } from './components/TakeTestView';
import { SessionState, sessionService } from './services/sessionService';
import { SummaryView } from './components/SummaryView';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${toArabic(String(minutes).padStart(2, '0'))}:${toArabic(String(seconds).padStart(2, '0'))}`;
};

const formatDateParts = (dateString: string) => {
    const d = new Date(dateString);
    const dayName = d.toLocaleDateString('ar-SA', { weekday: 'long' });
    const hParts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const hDay = toArabic(hParts.find(p => p.type === 'day')?.value || '');
    const hMonth = toArabic(hParts.find(p => p.type === 'month')?.value || '');
    const hYear = toArabic(hParts.find(p => p.type === 'year')?.value || '');
    const hijriDate = `${hDay} / ${hMonth} / ${hYear} هـ`;
    const gDay = toArabic(d.getDate());
    const gMonth = toArabic(d.getMonth() + 1);
    const gYear = toArabic(d.getFullYear());
    const gregDate = `${gDay} / ${gMonth} / ${gYear} م`;
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
    hours = hours % 12 || 12;
    const time = `${toArabic(hours)}:${toArabic(minutes.toString().padStart(2, '0'))} ${ampm}`;
    return { dayName, hijriDate, gregDate, time };
};

const UserMenu: React.FC<{ user: User; onLogout: () => void; children?: React.ReactNode; }> = ({ user, onLogout, children }) => (
    <div className="flex items-center gap-2 md:gap-4">
        {children}
        <div className="flex items-center gap-2 bg-zinc-800/50 py-1 px-3 rounded-full border border-zinc-700 hidden md:flex">
            <UserIcon className="w-4 h-4 text-text-muted" />
            <span className="font-bold text-text text-sm">{user.username}</span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-red-900/50 transition-colors bg-zinc-800 border border-zinc-700 hover:border-red-500/50 group" aria-label="تسجيل الخروج">
            <span className="text-sm font-bold text-text-muted group-hover:text-red-400 transition-colors">خروج</span>
            <LogOutIcon className="w-4 h-4 text-red-500"/>
        </button>
    </div>
);

const MultiSelectDropdown: React.FC<{
    label: string;
    options: { value: string; label: string }[];
    selectedValues: string[];
    onChange: (newValues: string[]) => void;
    showInput?: boolean;
    inputPlaceholder?: string;
}> = ({ label, options, selectedValues, onChange, showInput, inputPlaceholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const isAllSelected = selectedValues.includes('all');
    const handleOptionToggle = (value: string) => {
        if (value === 'all') { onChange(['all']); return; }
        let newValues = isAllSelected ? [value] : (selectedValues.includes(value) ? selectedValues.filter(v => v !== value) : [...selectedValues, value]);
        const availableOptionsCount = options.filter(o => o.value !== 'all').length;
        if (newValues.length === availableOptionsCount || newValues.length === 0) onChange(['all']);
        else onChange(newValues);
    };
    const handleInputChange = (val: string) => {
        setInputValue(val);
        const cleanVal = val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
        const rangeMatch = cleanVal.match(/^(\d+)-(\d+)$/);
        const singleMatch = cleanVal.match(/^(\d+)$/);
        let matchedValues: string[] = [];
        if (rangeMatch) {
            const min = Math.min(parseInt(rangeMatch[1]), parseInt(rangeMatch[2]));
            const max = Math.max(parseInt(rangeMatch[1]), parseInt(rangeMatch[2]));
            options.forEach(opt => { if (opt.value !== 'all') { const numMatch = opt.label.match(/\d+/); if (numMatch && parseInt(numMatch[0]) >= min && parseInt(numMatch[0]) <= max) matchedValues.push(opt.value); } });
        } else if (singleMatch) {
            const target = parseInt(singleMatch[1]);
            options.forEach(opt => { if (opt.value !== 'all') { const numMatch = opt.label.match(/\d+/); if (numMatch && parseInt(numMatch[0]) === target) matchedValues.push(opt.value); } });
        }
        if (matchedValues.length > 0) onChange(matchedValues.length === options.filter(o => o.value !== 'all').length ? ['all'] : matchedValues);
    };
    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium mb-1 text-text-muted">{label}</label>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600 h-11 flex justify-between items-center text-sm">
                <span className="truncate">{isAllSelected ? 'الكل' : `${toArabic(selectedValues.length)} محدد`}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-600 rounded-md shadow-xl max-h-60 flex flex-col">
                    {showInput && <div className="p-2 border-b border-zinc-700"><input type="text" value={inputValue} onChange={e => handleInputChange(e.target.value)} placeholder={inputPlaceholder} className="w-full p-1.5 bg-zinc-900 border border-zinc-600 rounded text-xs text-white text-center" dir="ltr" /></div>}
                    <div className="overflow-y-auto flex-1 p-1 space-y-1 custom-scrollbar">
                        <div onClick={() => handleOptionToggle('all')} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-zinc-700 ${isAllSelected ? 'bg-primary/20 text-primary' : ''}`}><div className={`w-4 h-4 rounded border flex items-center justify-center ${isAllSelected ? 'bg-primary border-primary' : 'border-zinc-500'}`}>{isAllSelected && <CheckCircleIcon className="w-3 h-3 text-white" />}</div><span className="text-sm font-bold">الكل</span></div>
                        {options.filter(o => o.value !== 'all').map(opt => {
                            const isSelected = selectedValues.includes(opt.value);
                            return <div key={opt.value} onClick={() => handleOptionToggle(opt.value)} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-zinc-700 ${isSelected ? 'bg-zinc-700' : ''}`}><div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-accent border-accent' : 'border-zinc-500'}`}>{isSelected && <CheckCircleIcon className="w-3 h-3 text-white" />}</div><span className="text-sm">{opt.label}</span></div>;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const Header: React.FC<{ title: string; leftSlot?: React.ReactNode; rightSlot?: React.ReactNode; }> = ({ title, leftSlot, rightSlot }) => (
    <header className="bg-surface/80 backdrop-blur-lg p-4 flex-shrink-0 z-20 border-b" style={{borderColor: 'var(--color-border)', height: '70px'}}>
        <div className="container mx-auto flex items-center justify-between h-full"><div className="flex-1 flex justify-start items-center gap-2">{leftSlot}</div><h1 className="text-lg md:text-2xl font-bold text-text text-center truncate px-2 md:px-4">{title}</h1><div className="flex-1 flex justify-end items-center gap-2">{rightSlot}</div></div>
    </header>
);

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; onClick: () => void; description?: string; enabled?: boolean; }> = ({ title, icon, onClick, description, enabled = true }) => (
    <div onClick={enabled ? onClick : undefined} className={`group relative bg-surface rounded-xl shadow-lg p-8 transition-all duration-300 border ${enabled ? 'cursor-pointer hover:border-primary hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2' : 'border-zinc-700 opacity-70 cursor-not-allowed'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
        <div className={`relative z-10 ${!enabled ? 'blur-[1px] grayscale' : ''}`}><div className="transition-transform duration-300 group-hover:scale-110 text-center">{icon}</div><h2 className={`text-2xl font-bold mt-6 text-text text-center transition-colors duration-300 ${enabled ? 'group-hover:text-primary': ''}`}>{title}</h2>{description && <p className="text-text-muted text-center mt-2">{description}</p>}</div>
        {!enabled && <div className="absolute inset-0 flex items-center justify-center z-20"><div className="bg-zinc-900/90 border border-amber-500/50 px-6 py-3 rounded-lg transform -rotate-6 shadow-xl backdrop-blur-sm"><span className="text-amber-400 font-bold text-xl tracking-wider">قريباً</span></div></div>}
    </div>
);

const HomeView: React.FC<{
    username: string; onSelectUserMode: (mode: 'training' | 'review') => void; onLogout: () => void; onGoToAdmin: () => void; onGoToSiteManagement: () => void; onGoToVerbalManagement: () => void; onGoToQuantitativeManagement: () => void; isDevUser: boolean; isPreviewMode: boolean; onTogglePreviewMode: () => void; previewingUser: User | null; onExitPreview: () => void;
}> = ({ username, onSelectUserMode, onLogout, onGoToAdmin, onGoToSiteManagement, onGoToVerbalManagement, onGoToQuantitativeManagement, isDevUser, isPreviewMode, onTogglePreviewMode, previewingUser, onExitPreview }) => {
    const showDevView = isDevUser && !isPreviewMode;
    return (
        <div className="bg-bg min-h-screen">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b" style={{borderColor: 'var(--color-border)'}}>
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex-1">{previewingUser && <button onClick={onExitPreview} className="px-4 py-2 bg-red-600 text-white rounded-md font-bold text-sm shadow-lg hover:bg-red-700 transition-colors animate-pulse">خروج من المعاينة</button>}</div> 
                    <div className="flex items-center gap-2 md:gap-4">
                        { isDevUser && !previewingUser && <div className="flex items-center gap-2 bg-zinc-800 p-1.5 rounded-lg border border-zinc-700"><label htmlFor="preview-switch" className="flex items-center cursor-pointer gap-2 select-none"><span className={`text-xs font-bold transition-colors ${!isPreviewMode ? 'text-primary' : 'text-zinc-500'}`}>وضع المطور</span><div className="relative"><input type="checkbox" id="preview-switch" className="sr-only" checked={isPreviewMode} onChange={onTogglePreviewMode} /><div className={`block w-10 h-5 rounded-full transition-colors ${isPreviewMode ? 'bg-accent' : 'bg-zinc-600'}`}></div><div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${isPreviewMode ? 'translate-x-5' : ''}`}></div></div><span className={`text-xs font-bold transition-colors ${isPreviewMode ? 'text-accent' : 'text-zinc-500'}`}>وضع المعاينة</span></label></div>}
                         { isDevUser && <span className="hidden sm:inline font-semibold text-text-muted opacity-50">|</span> }
                        <UserMenu user={{username} as User} onLogout={onLogout} />
                    </div>
                </div>
                { previewingUser && <div className="bg-amber-500/20 border-t border-amber-500/30 text-amber-300 text-center py-1 text-sm font-semibold">أنت الآن تتصفح حساب: {previewingUser.username} ({previewingUser.email})</div>}
            </header>
            <main className="container mx-auto p-4 md:p-8"><div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-text">أهلاً بك، <span style={{color: 'var(--color-primary)'}}>{username}</span>!</h2><p className="mt-4 text-lg text-text-muted">{showDevView ? "اختر مهمة للبدء." : "اختر الخيار الذي تود البدء به."}</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">{ showDevView ? (<><SectionCard title="إدارة المستخدمين" icon={<UserIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={onGoToAdmin} description="عرض وإدارة حسابات المستخدمين." /><SectionCard title="إدارة الموقع" icon={<SettingsIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={onGoToSiteManagement} description="تفعيل أو إلغاء تفعيل الأقسام، إدارة البيانات." /><SectionCard title="إدارة القسم اللفظي" icon={<BookOpenIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={onGoToVerbalManagement} description="إضافة وتعديل اختبارات القسم اللفظي." /><SectionCard title="إدارة القسم الكمي" icon={<BarChartIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={onGoToQuantitativeManagement} description="إضافة وتعديل اختبارات القسم الكمي." /></>) : (<><SectionCard title="التدريب" icon={<BookOpenIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={() => onSelectUserMode('training')} description="ابدأ التدرب على اختبارات جديدة." /><SectionCard title="المراجعة" icon={<FileTextIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={() => onSelectUserMode('review')} description="راجع الأخطاء والأسئلة المحفوظة." /></>)}</div></main>
        </div>
    );
};

const ModeSelectionView: React.FC<{ onBack: () => void; onSelectSection: (section: Section, mode: 'training' | 'review') => void; userMode: 'training' | 'review'; settings: AppSettings; user: User; onLogout: () => void; }> = ({ onBack, onSelectSection, userMode, settings, user, onLogout }) => {
    const title = userMode === 'training' ? 'التدريب' : 'المراجعة';
    const description = userMode === 'training' ? 'اختر القسم الذي تود التدرب عليه.' : 'اختر القسم الذي تود مراجعته.';
    const isVerbalEnabled = userMode === 'training' ? settings.isVerbalEnabled : settings.isReviewVerbalEnabled;
    const isQuantitativeEnabled = userMode === 'training' ? settings.isQuantitativeEnabled : settings.isReviewQuantitativeEnabled;
    return (
        <div className="bg-bg min-h-screen"><Header title={title} leftSlot={<button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors"><ArrowRightIcon className="w-6 h-6 text-text-muted"/></button>} rightSlot={<UserMenu user={user} onLogout={onLogout} />} /><main className="container mx-auto p-4 md:p-8"><div className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-bold text-text">{title}</h2><p className="mt-4 text-lg text-text-muted">{description}</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto justify-center"><SectionCard title="القسم اللفظي" icon={<BookOpenIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={() => onSelectSection('verbal', userMode)} description="التناظر اللفظي، إكمال الجمل، والمزيد." enabled={isVerbalEnabled} /><SectionCard title="القسم الكمي" icon={<BarChartIcon className="w-16 h-16 text-primary mx-auto"/>} onClick={() => onSelectSection('quantitative', userMode)} description="الجبر، الهندسة، والإحصاء." enabled={isQuantitativeEnabled} /></div></main></div>
    );
};

const SectionView: React.FC<{ section: Section; data: AppData; onBack: () => void; onStartTest: (test: Test, bankKey?: string, categoryKey?: string) => void; onReviewAttempt: (attempt: TestAttempt) => void; headerLeftSlot?: React.ReactNode; headerRightSlot?: React.ReactNode; openBankKeys: Set<string>; onToggleBank: (bankKey: string) => void; selectedTestId: string | null; onSelectTest: (test: Test, bankKey?: string, categoryKey?: string) => void; }> = ({ section, data, onBack, onStartTest, onReviewAttempt, headerLeftSlot, headerRightSlot, openBankKeys, onToggleBank, selectedTestId, onSelectTest }) => {
    const selectedTestInfo = useMemo(() => {
        if (!selectedTestId) return null;
        if (section === 'quantitative') { const test = data.tests.quantitative.find(t => t.id === selectedTestId); return test ? { test, bankKey: undefined, categoryKey: undefined } : null; }
        for (const b in data.tests.verbal) for (const c in data.tests.verbal[b]) { const test = data.tests.verbal[b][c].find(t => t.id === selectedTestId); if (test) return { test, bankKey: b, categoryKey: c }; }
        return null;
    }, [selectedTestId, data.tests, section]);
    // Fix: Cast answers to any array to handle length safely in the following mapping logic.
    const attemptsForSelectedTest = selectedTestInfo ? data.history.filter(a => a.testId === selectedTestInfo.test.id) : [];
    
    // Logic to extract number from test name for sorting
    const getTestNumber = (name: string) => {
        const n = name.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
        const m = n.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
    };

    const renderSidebar = () => {
        if (section === 'quantitative') {
            const sortedTests = [...data.tests.quantitative].sort((a, b) => getTestNumber(a.name) - getTestNumber(b.name) || a.name.localeCompare(b.name));
             return (<nav className="space-y-3 p-4"><h2 className="text-lg font-bold text-text-muted px-2 mb-4">الاختبارات ({sortedTests.length})</h2><div className="space-y-2">{sortedTests.length > 0 ? sortedTests.map(test => (<div key={test.id} onClick={() => onSelectTest(test)} className={`flex justify-between items-center p-3 rounded-lg border transition-all cursor-pointer group ${selectedTestId === test.id ? 'border-primary bg-primary/10 shadow-md' : 'border-zinc-700 bg-surface hover:border-zinc-500'}`}><span className={`flex-grow text-right text-base font-medium pr-2 truncate ${selectedTestId === test.id ? 'text-primary' : 'text-text'}`}>{test.name}</span><button onClick={(e) => { e.stopPropagation(); onStartTest(test); }} className="px-3 py-1 bg-zinc-800 border border-zinc-600 text-accent font-bold rounded hover:bg-accent hover:text-white transition-colors"><PlayIcon className="w-4 h-4" /></button></div>)) : <div className="p-4 text-center text-text-muted italic bg-surface rounded-lg border border-dashed border-zinc-700">لا توجد اختبارات.</div>}</div></nav>);
        }
        const totalVerbalTests = Object.values(data.tests.verbal).reduce((total, bank) => total + Object.values(bank).reduce((bankTotal, cats) => bankTotal + cats.length, 0), 0);
        return (<nav className="space-y-2 p-4"><h2 className="text-lg font-bold text-text-muted px-2 mb-2">البنوك ({totalVerbalTests})</h2>{Object.entries(VERBAL_BANKS).map(([bk, bn]) => { const bankData = data.tests.verbal[bk] || {}; const bankCount = Object.values(bankData).reduce((c, tests) => c + tests.length, 0); return (<div key={bk} className="mb-2"><button onClick={() => onToggleBank(bk)} className={`w-full flex justify-between items-center text-right p-4 rounded-lg border transition-all ${openBankKeys.has(bk) ? 'bg-zinc-800 border-primary text-primary' : 'bg-surface border-border hover:border-zinc-500'}`}><span className="font-bold text-lg">{bn} <span className="text-sm font-normal text-text-muted opacity-70">({bankCount})</span></span><ChevronDownIcon className={`w-5 h-5 transition-transform ${openBankKeys.has(bk) ? 'rotate-180' : ''}`} /></button>{openBankKeys.has(bk) && (<div className="pr-3 mt-2 space-y-4 border-r-2 border-zinc-800 mr-2">{Object.entries(VERBAL_CATEGORIES).map(([ck, cn]) => { const tests = bankData[ck] || []; return (<div key={ck} className="bg-zinc-900/30 rounded-lg p-2"><h4 className="font-bold text-sky-400 text-base mb-3 px-2 tracking-wide flex items-center gap-2 border-b border-zinc-800 pb-2"><span className="w-2 h-2 rounded-full bg-sky-500 shadow-sm shadow-sky-500/50"></span>{cn}</h4><div className="space-y-2 pl-1">{tests.length > 0 ? tests.map(test => (<div key={test.id} onClick={() => onSelectTest(test, bk, ck)} className={`flex justify-between items-center p-3 rounded-md transition-all cursor-pointer group border ${selectedTestId === test.id ? 'border-accent bg-accent/10' : 'border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800'}`}><span className={`flex-grow text-right text-sm pr-2 ${selectedTestId === test.id ? 'text-accent font-bold' : 'text-text-muted'}`}>{test.name}</span><button onClick={(e) => { e.stopPropagation(); onStartTest(test, bk, ck); }} className="p-1.5 bg-zinc-700 border border-zinc-600 text-accent rounded hover:bg-accent hover:text-white transition-colors"><PlayIcon className="w-3 h-3" /></button></div>)) : <div className="p-2 text-xs text-zinc-600 italic text-center">لا توجد اختبارات.</div>}</div></div>); })}</div>)}</div>); })}</nav>);
    };
    return (
        <div className="bg-bg h-screen flex flex-col overflow-hidden"><Header title={`التدريب - ${section === 'quantitative' ? 'القسم الكمي' : 'القسم اللفظي'}`} leftSlot={headerLeftSlot} rightSlot={headerRightSlot} /><div className="flex flex-col md:flex-row flex-grow overflow-hidden w-full h-full"><aside className="w-full md:w-1/3 lg:w-1/4 border-b md:border-b-0 md:border-l border-border h-[35%] md:h-full overflow-y-auto custom-scrollbar bg-bg/50 flex-shrink-0">{renderSidebar()}</aside><main className="w-full md:w-2/3 lg:w-3/4 flex-grow md:h-full overflow-y-auto custom-scrollbar bg-bg relative"><div className="w-full p-4 md:p-6 min-h-full flex flex-col"><div className="bg-surface rounded-lg p-4 md:p-6 border border-border flex-grow flex flex-col">{selectedTestInfo ? (<div className="flex-grow flex flex-col"><h3 className="text-3xl font-bold text-primary mb-2">{selectedTestInfo.test.name}</h3>{section === 'verbal' && <p className="text-md text-text-muted mb-6">{VERBAL_BANKS[selectedTestInfo.bankKey!]} - {VERBAL_CATEGORIES[selectedTestInfo.categoryKey!]}</p>}{section === 'quantitative' && <p className="text-md text-text-muted mb-6">القسم الكمي</p>}<div className="bg-zinc-900/50 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4"><p className="text-lg">عدد الأسئلة: <span className="font-bold text-xl">{selectedTestInfo.test.questions.length || '...'}</span></p><button onClick={() => onStartTest(selectedTestInfo.test, selectedTestInfo.bankKey, selectedTestInfo.categoryKey)} className="w-full sm:w-auto px-8 py-3 bg-accent border-2 border-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-lg transform transition-transform hover:scale-105">بدء الاختبار</button></div><div className="flex justify-between items-center mt-8 mb-4 border-b border-border pb-2"><h4 className="text-xl font-bold">سجل المحاولات</h4><span className="text-sm font-bold text-text-muted bg-zinc-700 px-3 py-1 rounded-full">{toArabic(attemptsForSelectedTest.length)} محاولات</span></div>{attemptsForSelectedTest.length > 0 ? (<div className="space-y-4 flex-grow">{attemptsForSelectedTest.map(attempt => { const answered = (attempt.answers as UserAnswer[]).length; const incorrect = answered - attempt.score; const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100); const { dayName, hijriDate, gregDate, time } = formatDateParts(attempt.date); return (<div key={attempt.id} onClick={() => onReviewAttempt(attempt)} className="p-4 bg-zinc-800 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors"><div className="flex justify-between items-center border-b border-zinc-700 pb-3 mb-3 w-full text-lg font-bold text-zinc-300" dir="rtl"><span>{dayName}</span><span>{hijriDate}</span><span>{gregDate}</span><span className="text-sky-400" dir="ltr">{time}</span></div><div className="flex justify-between items-center mb-2"><div className="text-center"><p className={`font-bold text-3xl ${percentage >= 50 ? 'text-green-400' : 'text-red-400'}`}>{toArabic(percentage)}%</p><span className="text-sm text-text-muted">({toArabic(attempt.score)}/{toArabic(attempt.totalQuestions)})</span></div></div><div className="flex justify-between items-center text-text-muted border-t border-zinc-700 pt-3 mt-1 w-full text-xl font-medium"><span className="flex items-center gap-2"><span className="text-green-400 font-bold text-2xl">{toArabic(attempt.score)}</span> صح</span><span className="flex items-center gap-2"><span className="text-red-400 font-bold text-2xl">{toArabic(incorrect)}</span> خطأ</span><span className="flex items-center gap-2"><span className="text-yellow-400 font-bold text-2xl">{toArabic(attempt.totalQuestions - answered)}</span> متروك</span><span className="flex items-center gap-2 text-lg text-zinc-400"><ClockIcon className="w-5 h-5" /> {formatTime(attempt.durationSeconds)}</span></div></div>); })}</div>) : <p className="text-text-muted text-center py-8">لا توجد محاولات سابقة لهذا الاختبار.</p>}</div>) : <div className="flex flex-col items-center justify-center h-full text-center text-text-muted py-16 flex-grow"><ArrowLeftIcon className="w-16 h-16 mb-4 animate-pulse" /><p className="text-lg">الرجاء تحديد اختبار من الشريط الجانبي لعرض التفاصيل.</p></div>}</div></div></main></div></div>
    );
};

export const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [previewUser, setPreviewUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const activeUser = previewUser || currentUser;
    const isDevUser = activeUser?.isDeveloper || false;
    const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
    const [pageHistory, setPageHistory] = useState<string[]>(['auth']);
    const page = pageHistory[pageHistory.length - 1];
    const [returnPath, setReturnPath] = useState<string | null>(null);
    useEffect(() => { const unsubscribe = authService.onAuthStateChanged((user) => { setCurrentUser(user); if (user) { if(pageHistory[0] === 'auth') setPageHistory(['home']); } else { setPageHistory(['auth']); setPreviewUser(null); } setAuthLoading(false); }); return () => unsubscribe(); }, []);
    useEffect(() => { if (!activeUser?.uid || previewUser) return; const h = () => authService.sendHeartbeat(activeUser.uid!); h(); const i = setInterval(h, 60000); return () => clearInterval(i); }, [activeUser, previewUser]);
    const navigate = (newPage: string, replace = false) => { setPageHistory(prev => { if (replace) { const h = [...prev]; h[h.length - 1] = newPage; return h; } if (prev[prev.length - 1] === newPage) return prev; return [...prev, newPage]; }); };
    const goBack = () => { setPageHistory(prev => prev.length > 1 ? prev.slice(0, -1) : prev); };
    const [userMode, setUserMode] = useState<'training' | 'review' | null>(null);
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [currentTest, setCurrentTest] = useState<Test | null>(null);
    const [currentTestContext, setCurrentTestContext] = useState<{ bankKey?: string; categoryKey?: string }>({});
    const [currentAttempt, setCurrentAttempt] = useState<TestAttempt | null>(null);
    const [attemptToReview, setAttemptToReview] = useState<TestAttempt | null>(null);
    const [summaryReturnPage, setSummaryReturnPage] = useState<string>('section');
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [openBankKeys, setOpenBankKeys] = useState<Set<string>>(new Set());
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [pendingSession, setPendingSession] = useState<SessionState | null>(null);
    const [reviewFilters, setReviewFilters] = useState<ReviewFilterState>({ activeTab: 'all', activePanel: null, dateFilter: null, attributeFilters: { bank: ['all'], category: ['all'], type: ['all'], selectedTestIds: ['all'] }, });
    const { data, isLoading: isDataLoading, addTest, addQuestionsToTest, deleteTest, deleteTests, updateQuestionAnswer, addAttemptToHistory, deleteUserData, addDelayedQuestionToReview, addSpecialLawQuestionToReview, reviewedQuestionIds, fetchTestQuestions } = useAppData(activeUser?.uid || null, isDevUser, isPreviewMode);
    const processor = useQuantitativeProcessor(addTest, addQuestionsToTest);
    useEffect(() => { const load = async () => { if (activeUser?.uid) { const saved = await sessionService.loadSessionState(activeUser.uid); if (saved) { setOpenBankKeys(new Set(saved.openBankKeys || [])); setSelectedTestId(saved.selectedTestId || null); setUserMode(saved.userMode || null); if (saved.reviewFilters) setReviewFilters(saved.reviewFilters); if (saved.currentTest && saved.pageHistory && saved.pageHistory[saved.pageHistory.length - 1] === 'takeTest') { setPendingSession(saved); } else if (saved.currentTest) { sessionService.clearTestState(activeUser.uid); } } } }; load(); }, [activeUser]);
    useEffect(() => { if (activeUser?.uid) { const state: SessionState = { pageHistory, selectedSection, userMode, currentTest, currentTestContext, userAnswers, elapsedTime, openBankKeys: Array.from(openBankKeys), selectedTestId, reviewFilters }; sessionService.saveSessionState(state, activeUser.uid); } }, [pageHistory, selectedSection, userMode, currentTest, currentTestContext, userAnswers, elapsedTime, openBankKeys, selectedTestId, activeUser, reviewFilters]);
    const clearTestSession = () => { setCurrentTest(null); setUserAnswers([]); setElapsedTime(0); if (activeUser?.uid) { sessionService.clearTestState(activeUser.uid); } };
    const handleLogout = () => { authService.logout(); setCurrentUser(null); setPreviewUser(null); setPageHistory(['auth']); setShowLogoutConfirm(false); clearTestSession(); };
    const handleTogglePreviewMode = () => { if (isDevUser) setIsPreviewMode(!isPreviewMode); };
    const handleStartTest = async (test: Test, bankKey?: string, categoryKey?: string, returnTo?: string) => { await fetchTestQuestions(test.id); clearTestSession(); setSelectedTestId(test.id); setCurrentTest(test); setCurrentTestContext({ bankKey, categoryKey }); setReturnPath(returnTo || 'section'); if (!selectedSection) setSelectedSection(test.section === 'quantitative' || (test.questions && !!test.questions[0]?.questionImage) ? 'quantitative' : 'verbal'); navigate('takeTest'); };
    const handleFinishTest = (answers: UserAnswer[], duration: number) => { const section = selectedSection || (currentTest?.questions[0]?.questionImage ? 'quantitative' : 'verbal'); if (!currentTest) return; const score = answers.reduce((c, ua) => { const q = currentTest.questions.find(q => q.id === ua.questionId); return q && q.correctAnswer === ua.answer ? c + 1 : c; }, 0); const att: TestAttempt = { id: `att_${Date.now()}`, testId: currentTest.id, testName: currentTest.name, section: section, bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, date: new Date().toISOString(), score, totalQuestions: currentTest.questions.length, answers, questions: currentTest.questions, durationSeconds: duration }; if (!isDevUser || isPreviewMode) addAttemptToHistory(att); setCurrentAttempt(att); setAttemptToReview(att); setSummaryReturnPage(returnPath || (currentTest.id.includes('review_') ? 'review' : (userMode === 'training' ? 'section' : 'review'))); clearTestSession(); navigate('summary', true); };
    const handleResumeTest = async (saved: SessionState) => { if (saved.currentTest) await fetchTestQuestions(saved.currentTest.id); setCurrentTest(saved.currentTest); setCurrentTestContext(saved.currentTestContext || {}); setUserAnswers(saved.userAnswers || []); setElapsedTime(saved.elapsedTime || 0); setSelectedSection(saved.selectedSection); setUserMode(saved.userMode); if (saved.pageHistory && saved.pageHistory[saved.pageHistory.length - 1] === 'takeTest') setPageHistory(saved.pageHistory); else setPageHistory(prev => [...prev, 'takeTest']); setPendingSession(null); };

    if (authLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
    if (!activeUser) return <AuthView onLoginSuccess={() => {}} recentUser={null} />;
    if (isDataLoading) return <div className="min-h-screen bg-bg flex items-center justify-center text-center"><div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-lg text-text-muted">جارٍ تحميل البيانات...</p></div>;

    return (
        <>
            {processor.isProcessing && page !== 'quantitativeManagement' && (
                <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-surface border border-primary/50 rounded-lg shadow-2xl p-4 z-50 animate-pulse"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div><span className="font-bold text-sm text-primary">جارٍ معالجة الاختبارات...</span></div></div><div className="text-xs text-text-muted mb-1 truncate">{processor.queue.find(j => j.status === 'processing')?.fileName}</div><div className="w-full bg-zinc-700 rounded-full h-1.5 overflow-hidden"><div className="bg-primary h-full transition-all duration-300" style={{ width: `${processor.queue.find(j => j.status === 'processing')?.progress}%` }}></div></div></div>
            )}
            {pendingSession && <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"><div className="bg-surface rounded-lg p-8 m-4 max-w-md w-full text-center border border-border"><div className="mb-4"><ClockIcon className="w-16 h-16 mx-auto text-primary animate-pulse"/></div><h2 className="text-xl font-bold mb-4">استئناف الاختبار السابق</h2><p className="text-text-muted mb-6">هل تريد العودة إلى اختبار <strong>{pendingSession.currentTest?.name}</strong>؟</p><div className="flex justify-center gap-4"><button onClick={() => { clearTestSession(); setPendingSession(null); }} className="px-6 py-2 bg-zinc-600 rounded-md">بدء جديد</button><button onClick={() => handleResumeTest(pendingSession)} className="px-6 py-2 bg-accent text-white rounded-md font-bold">إكمال الاختبار</button></div></div></div>}
             {showLogoutConfirm && <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"><div className="bg-surface rounded-lg p-8 m-4 max-sm w-full text-center border border-border"><h2 className="text-xl font-bold mb-4">تأكيد الخروج</h2><p className="text-text-muted mb-6">هل أنت متأكد؟</p><div className="flex justify-center gap-4"><button onClick={() => setShowLogoutConfirm(false)} className="px-6 py-2 bg-zinc-600 rounded-md">إلغاء</button><button onClick={handleLogout} className="px-6 py-2 bg-red-600 text-white rounded-md">خروج</button></div></div></div>}

            {page === 'home' && <HomeView username={activeUser.username} onSelectUserMode={(m) => { setUserMode(m); navigate('modeSelection'); }} onLogout={() => setShowLogoutConfirm(true)} onGoToAdmin={() => navigate('admin')} onGoToSiteManagement={() => navigate('siteManagement')} onGoToVerbalManagement={() => navigate('verbalManagement')} onGoToQuantitativeManagement={() => navigate('quantitativeManagement')} isDevUser={isDevUser} isPreviewMode={isPreviewMode} onTogglePreviewMode={handleTogglePreviewMode} previewingUser={previewUser} onExitPreview={() => { setPreviewUser(null); navigate('admin'); }} />}
            {page === 'modeSelection' && userMode && <ModeSelectionView userMode={userMode} onBack={goBack} onSelectSection={(s, m) => { setSelectedSection(s); setUserMode(m); navigate(m === 'training' ? 'section' : 'review'); }} settings={settings} user={activeUser} onLogout={() => setShowLogoutConfirm(true)} />}
            {page === 'section' && selectedSection && <SectionView section={selectedSection} data={data} onBack={() => { goBack(); setSelectedTestId(null); }} onStartTest={handleStartTest} onReviewAttempt={(a) => { setAttemptToReview(a); setSummaryReturnPage(page); navigate('reviewAttempt'); }} headerLeftSlot={<div className="flex items-center gap-4"><button onClick={goBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors"><ArrowRightIcon className="w-6 h-6 text-text-muted"/></button><button onClick={() => { setUserMode('review'); navigate('review'); }} className="px-3 py-2 text-sm font-bold rounded-md bg-zinc-700">المراجعة</button></div>} headerRightSlot={<UserMenu user={activeUser} onLogout={() => setShowLogoutConfirm(true)} />} openBankKeys={openBankKeys} onToggleBank={(k) => setOpenBankKeys(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; })} selectedTestId={selectedTestId} onSelectTest={(t) => { setSelectedTestId(t.id); fetchTestQuestions(t.id); }} />}
            {page === 'takeTest' && currentTest && <TakeTestView test={currentTest} onFinishTest={handleFinishTest} onBack={() => { navigate(returnPath || 'section', true); }} initialAnswers={userAnswers} initialElapsedTime={elapsedTime} onStateChange={(ans, time) => { setUserAnswers(ans); setElapsedTime(time); }} onAddDelayedReview={(q, idx) => selectedSection && addDelayedQuestionToReview(selectedSection, q, {bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, testName: currentTest.name, originalQuestionIndex: idx})} onAddSpecialLawReview={(q, idx) => selectedSection && addSpecialLawQuestionToReview(selectedSection, q, {bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, testName: currentTest.name, originalQuestionIndex: idx})} reviewedQuestionIds={reviewedQuestionIds} />}
            {page === 'summary' && (currentAttempt || attemptToReview) && <SummaryView attempt={(currentAttempt || attemptToReview!) as TestAttempt} onBack={() => { navigate(summaryReturnPage === 'section' ? 'section' : 'review', true); setCurrentAttempt(null); setAttemptToReview(null); setReturnPath(null); }} onReview={(a) => { setAttemptToReview(a); navigate('reviewAttempt'); }} user={activeUser} onLogout={() => setShowLogoutConfirm(true)} />}
            {page === 'reviewAttempt' && attemptToReview && <TakeTestView test={{ id: attemptToReview.testId, name: attemptToReview.testName, questions: attemptToReview.questions }} reviewAttempt={attemptToReview} onFinishTest={()=>{}} reviewedQuestionIds={reviewedQuestionIds} onBackToSummary={() => navigate('summary', true)} onBackToSection={() => { navigate(userMode === 'training' ? 'section' : 'review', true); setAttemptToReview(null); setReturnPath(null); }} />}
            {page === 'admin' && <AdminView onBack={goBack} onPreviewUser={(u) => { setPreviewUser(u); navigate('home'); }} onDeleteUser={async (k) => { await authService.deleteUser(k); await deleteUserData(k); }} />}
            {page === 'siteManagement' && <SiteManagementView onBack={goBack} onUpdateSettings={(ns) => setSettings(ns)} />}
            {page === 'verbalManagement' && <VerbalManagementView data={data} onBack={goBack} onAddTest={addTest} onAddQuestionsToTest={addQuestionsToTest} onDeleteTest={deleteTest} onUpdateQuestionAnswer={updateQuestionAnswer} />}
            {page === 'quantitativeManagement' && <QuantitativeManagementView onBack={goBack} onStartTest={(t, r) => handleStartTest(t, undefined, undefined, r || 'quantitativeManagement')} data={data} onAddTest={addTest} onAddQuestionsToTest={addQuestionsToTest} onUpdateQuestionAnswer={updateQuestionAnswer} onDeleteTests={deleteTests} processorQueue={processor.queue} isProcessorWorking={processor.isProcessing} onAddFilesToQueue={processor.addFilesToQueue} onClearCompleted={processor.clearCompleted} onStopProcessing={processor.cancelAll} onSelectTest={(tid) => fetchTestQuestions(tid)} />}
        </>
    );
};
