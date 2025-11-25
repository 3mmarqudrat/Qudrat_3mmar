

import React, { useState, useMemo, useEffect } from 'react';
import { authService } from '../services/authService';
import { User, LoginRecord } from '../types';
import { ArrowRightIcon, TrashIcon, EyeIcon, UserIcon, MailIcon, KeyIcon, ClockIcon, XCircleIcon, EyeOffIcon } from './Icons';

interface AdminViewProps {
    onBack: () => void;
    onPreviewUser: (user: User) => void;
    onDeleteUser: (userKey: string) => Promise<void>;
}

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatDateFull = (dateString: string) => {
    const d = new Date(dateString);
    
    // Hijri
    const hParts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric', weekday: 'long'
    }).format(d);

    // Gregorian
    const gParts = new Intl.DateTimeFormat('ar-SA', {
         day: 'numeric', month: 'numeric', year: 'numeric'
    }).format(d);
    
    // Time
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const time = `${toArabic(hours)}:${toArabic(minutes.toString().padStart(2, '0'))} ${ampm}`;

    return { fullDate: hParts + ' | ' + gParts, time };
};

export const AdminView: React.FC<AdminViewProps> = ({ onBack, onPreviewUser, onDeleteUser }) => {
    const [users, setUsers] = useState<{ key: string, user: User }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{key: string, user: User} | null>(null);
    const [viewHistoryUser, setViewHistoryUser] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

    useEffect(() => {
        authService.getAllUsers().then(setUsers);
    }, []);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users.filter(u => !u.user.isDeveloper);
        return users.filter(u => 
            !u.user.isDeveloper && (
                u.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.user.email.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [users, searchTerm]);

    const handleDelete = async (userKey: string) => {
        setIsDeleting(true);
        try {
            await onDeleteUser(userKey);
            // Refresh list
            const updatedUsers = await authService.getAllUsers();
            setUsers(updatedUsers);
            setShowDeleteConfirm(null);
        } catch (e) {
            console.error("Delete failed", e);
            alert("حدث خطأ أثناء الحذف");
        } finally {
            setIsDeleting(false);
        }
    };
    
    const togglePasswordVisibility = (key: string) => {
        setRevealedPasswords(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    
    const isUserActive = (user: User) => {
        if (!user.loginHistory || user.loginHistory.length === 0) return false;
        const lastRecord = user.loginHistory[user.loginHistory.length - 1];
        
        // If explicitly logged out, not active
        if (lastRecord.logoutTime) return false;
        
        // If no logout time, check the last heartbeat time
        // If last active was within the last 2 minutes, consider active
        if (lastRecord.lastActive) {
            const lastActiveTime = new Date(lastRecord.lastActive).getTime();
            const now = new Date().getTime();
            const twoMinutes = 2 * 60 * 1000;
            return (now - lastActiveTime) < twoMinutes;
        }
        
        // Fallback for immediate logins
        const loginTime = new Date(lastRecord.loginTime).getTime();
        const now = new Date().getTime();
        return (now - loginTime) < (2 * 60 * 1000);
    };

    return (
        <div className="bg-bg min-h-screen">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                        <ArrowRightIcon className="w-6 h-6 text-text-muted"/>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-text mx-auto">إدارة المستخدمين</h1>
                </div>
            </header>
            <main className="container mx-auto p-4">
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="ابحث عن مستخدم بالاسم أو البريد الإلكتروني..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-3 border rounded-md bg-zinc-700 text-slate-200 focus:ring-1 focus:border-primary focus-ring border-border"
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map(({ key, user }) => {
                        const isActive = isUserActive(user);
                        const isPasswordRevealed = revealedPasswords.has(key);
                        
                        return (
                         <div key={key} className="bg-surface rounded-lg border border-border p-4 flex flex-col justify-between relative overflow-hidden">
                            {isActive && (
                                <div className="absolute top-0 left-0 p-2">
                                    <span className="flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                </div>
                            )}
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-3">
                                    <UserIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-xs text-text-muted">اسم المستخدم</p>
                                        <p className="font-bold flex items-center gap-2">
                                            {user.username}
                                            {isActive && <span className="text-xs text-green-400 font-normal">(نشط الآن)</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MailIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-xs text-text-muted">البريد الإلكتروني</p>
                                        <p>{user.email}</p>
                                    </div>
                                </div>
                                 <div className="flex items-center gap-3">
                                    <KeyIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-xs text-text-muted">كلمة المرور</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-sm tracking-wider">
                                                {isPasswordRevealed ? (user.password || '******') : '******'}
                                            </p>
                                            <button 
                                                onClick={() => togglePasswordVisibility(key)}
                                                className="text-text-muted hover:text-text focus:outline-none"
                                                title={isPasswordRevealed ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                                            >
                                                {isPasswordRevealed ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-border pt-3 space-y-2">
                               <p className="text-xs text-text-muted">تاريخ التسجيل: {user.registrationDate ? new Date(user.registrationDate).toLocaleString('ar-SA') : 'N/A'}</p>
                               <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setViewHistoryUser(user)} className="p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors flex justify-center items-center" title="سجل النشاط">
                                        <ClockIcon className="w-5 h-5 text-sky-400"/>
                                    </button>
                                    <button onClick={() => onPreviewUser(user)} className="p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors flex justify-center items-center" title="معاينة الحساب">
                                        <EyeIcon className="w-5 h-5 text-yellow-400"/>
                                    </button>
                                    <button onClick={() => setShowDeleteConfirm({key, user})} className="p-2 bg-red-900/40 text-red-400 rounded-md hover:bg-red-900/70 transition-colors flex justify-center items-center" title="حذف الحساب">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                               </div>
                            </div>
                        </div>
                    )})}
                </div>

                 {filteredUsers.length === 0 && (
                    <p className="text-center text-text-muted mt-8">لم يتم العثور على مستخدمين.</p>
                 )}
            </main>
            
            {/* History Modal */}
            {viewHistoryUser && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setViewHistoryUser(null)}>
                    <div className="bg-surface rounded-lg m-4 max-w-lg w-full h-[80vh] flex flex-col border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-border flex justify-between items-center bg-zinc-800 rounded-t-lg">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <ClockIcon className="w-5 h-5 text-sky-400"/>
                                سجل نشاط: {viewHistoryUser.username}
                            </h3>
                            <button onClick={() => setViewHistoryUser(null)} className="p-1 hover:bg-zinc-600 rounded-full">
                                <XCircleIcon className="w-6 h-6 text-text-muted"/>
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-3 bg-zinc-900/50">
                            {viewHistoryUser.loginHistory && viewHistoryUser.loginHistory.length > 0 ? (
                                [...viewHistoryUser.loginHistory].reverse().map((record, idx) => {
                                    const loginDate = formatDateFull(record.loginTime);
                                    
                                    // Determine effective exit time and type
                                    let exitDate = null;
                                    let exitType = null;

                                    if (record.logoutTime) {
                                        exitDate = formatDateFull(record.logoutTime);
                                        exitType = 'logout';
                                    } else if (record.lastActive) {
                                        // Check if user is currently active
                                        const lastActiveTime = new Date(record.lastActive).getTime();
                                        const now = new Date().getTime();
                                        const isOnline = (now - lastActiveTime) < (2 * 60 * 1000);
                                        
                                        if (!isOnline) {
                                            exitDate = formatDateFull(record.lastActive);
                                            exitType = 'closed';
                                        }
                                    }

                                    return (
                                        <div key={idx} className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg text-sm relative">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500 rounded-l-lg"></div>
                                            <div className="pl-3 pr-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-green-400">دخول</span>
                                                    <span className="text-text-muted text-xs">{loginDate.fullDate}</span>
                                                </div>
                                                <p className="text-xl font-bold text-white mb-3 dir-ltr text-right">{loginDate.time}</p>
                                                
                                                {exitDate ? (
                                                    <>
                                                        <div className="flex justify-between items-center mb-1 border-t border-zinc-700 pt-2">
                                                            <span className={`font-bold ${exitType === 'logout' ? 'text-blue-400' : 'text-red-400'}`}>
                                                                {exitType === 'logout' ? 'تسجيل خروج' : 'إغلاق الموقع'}
                                                            </span>
                                                            <span className="text-text-muted text-xs">{exitDate.fullDate}</span>
                                                        </div>
                                                        <p className="text-lg font-bold text-zinc-400 dir-ltr text-right">{exitDate.time}</p>
                                                    </>
                                                ) : (
                                                    <div className="mt-2 pt-2 border-t border-zinc-700 text-center">
                                                        <span className="inline-block px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full animate-pulse border border-green-500/30">
                                                            متصل الآن ...
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-center text-text-muted py-10">لا يوجد سجل نشاط مسجل لهذا المستخدم.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-surface rounded-lg p-8 m-4 max-w-sm w-full text-center shadow-2xl border border-border">
                        <h2 className="text-xl font-bold mb-4">تأكيد الحذف</h2>
                        <p className="text-text-muted mb-6">
                            هل أنت متأكد أنك تريد حذف حساب المستخدم <span className="font-bold text-text">{showDeleteConfirm.user.username}</span>؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowDeleteConfirm(null)} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إلغاء</button>
                            <button onClick={() => handleDelete(showDeleteConfirm.key)} disabled={isDeleting} className="px-6 py-2 text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors font-semibold disabled:opacity-50">
                                {isDeleting ? 'جارٍ الحذف...' : 'حذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};