
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    User as FirebaseUser,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, LoginRecord } from '../types';

export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}

const mapUser = (fbUser: FirebaseUser, additionalData?: any): User => ({
    uid: fbUser.uid,
    email: fbUser.email?.replace('+dev_priv', '') || '', 
    username: additionalData?.username || fbUser.displayName || 'User',
    password: additionalData?.password || '', 
    isDeveloper: additionalData?.isDeveloper || false,
    registrationDate: fbUser.metadata.creationTime,
    loginHistory: additionalData?.loginHistory || []
});

const DEV_EMAIL_KEY = 'qudrat_dev_email';
const DEV_SECURE_PASSWORD = '...dev_secure'; 

const toDevEmail = (email: string): string => {
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) return email; 
    return email.substring(0, atIndex) + '+dev_priv' + email.substring(atIndex);
};

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        try {
            if (password === '...') {
                throw new Error('يرجى استخدام نموذج دخول المطور');
            }

            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};

            const now = new Date().toISOString();
            if (navigator.onLine) {
                updateDoc(doc(db, 'users', cred.user.uid), {
                    loginHistory: arrayUnion({
                        loginTime: now,
                        logoutTime: null,
                        lastActive: now 
                    } as LoginRecord)
                }).catch(() => {});
            }

            return mapUser(cred.user, userData);
        } catch (error: any) {
            console.error("Standard Login Error:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            }
            throw new Error('حدث خطأ أثناء تسجيل الدخول');
        }
    },

    loginDeveloper: async (inputEmail?: string): Promise<User> => {
        let emailToUse = inputEmail?.trim();
        
        if (!emailToUse) {
            emailToUse = localStorage.getItem(DEV_EMAIL_KEY) || '';
        }

        if (!emailToUse) {
            throw new Error("البريد الإلكتروني للمطور مطلوب.");
        }
        
        try {
            const targetEmail = toDevEmail(emailToUse);
            const cred = await signInWithEmailAndPassword(auth, targetEmail, DEV_SECURE_PASSWORD);
            
            let devData = { isDeveloper: true };
            try {
                const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
                if (userDoc.exists()) {
                    devData = { ...userDoc.data(), isDeveloper: true } as any;
                }
            } catch (e: any) {
                if (e.code !== 'permission-denied') console.error("Dev doc fetch error", e);
            }
            
            localStorage.setItem(DEV_EMAIL_KEY, emailToUse);

            const now = new Date().toISOString();
            if (navigator.onLine) {
                updateDoc(doc(db, 'users', cred.user.uid), {
                    loginHistory: arrayUnion({
                        loginTime: now,
                        logoutTime: null,
                        lastActive: now
                    } as LoginRecord)
                }).catch(() => {});
            }

            return mapUser(cred.user, devData);

        } catch (error: any) {
            console.error("Dev Login Error:", error);
            throw new Error("بيانات دخول المطور غير صحيحة أو الحساب غير موجود.");
        }
    },

    register: async (username: string, email: string, password: string, confirmPassword: string): Promise<User> => {
        if (!username.trim() || !email.trim() || !password || !confirmPassword) {
            throw new RegistrationError('جميع الحقول مطلوبة.');
        }
        if (password !== confirmPassword) {
             throw new RegistrationError('كلمتا المرور غير متطابقتين.');
        }
        if (password.length < 6) { 
            throw new RegistrationError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
        }

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: username });
            
            const newUser = {
                username,
                email,
                password, 
                isDeveloper: false,
                registrationDate: new Date().toISOString(),
                loginHistory: []
            };
            
            await setDoc(doc(db, 'users', cred.user.uid), newUser);
            return mapUser(cred.user, newUser);
        } catch (error: any) {
            console.error("Registration Error:", error);
            if (error.code === 'auth/email-already-in-use') {
                throw new RegistrationError('البريد الإلكتروني مسجل بالفعل.');
            }
            throw new RegistrationError('حدث خطأ أثناء إنشاء الحساب.');
        }
    },
    
    registerDeveloper: async (email: string): Promise<User> => {
        if (!email.trim()) throw new RegistrationError('البريد الإلكتروني مطلوب.');
        
        try {
            const devEmail = toDevEmail(email);
            const cred = await createUserWithEmailAndPassword(auth, devEmail, DEV_SECURE_PASSWORD);
            await updateProfile(cred.user, { displayName: 'المطور' });
            
            const devUser = {
                username: 'المطور',
                email: email, 
                isDeveloper: true,
                registrationDate: new Date().toISOString(),
                loginHistory: []
            };
            
            await setDoc(doc(db, 'users', cred.user.uid), devUser);
            localStorage.setItem(DEV_EMAIL_KEY, email);
            return mapUser(cred.user, devUser);
        } catch (error: any) {
             console.error("Dev Registration Error:", error);
            if (error.code === 'auth/email-already-in-use') {
                 throw new RegistrationError('حساب المطور لهذا البريد موجود بالفعل.');
            }
            throw new RegistrationError('حدث خطأ أثناء إنشاء حساب المطور.');
        }
    },
    
    sendHeartbeat: async (uid: string) => {
        if (!navigator.onLine) return; 
        try {
            const userRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                const history = data.loginHistory || [];
                
                if (history.length > 0) {
                    const lastEntry = history[history.length - 1];
                    if (!lastEntry.logoutTime) {
                        lastEntry.lastActive = new Date().toISOString();
                        await updateDoc(userRef, { loginHistory: history });
                    }
                }
            }
        } catch (e: any) {
            if (e.code !== 'permission-denied' && e.message !== 'Failed to get document because the client is offline.') {
                console.error("Heartbeat error:", e);
            }
        }
    },

    logout: async () => {
        const currentUser = auth.currentUser;
        if (currentUser && navigator.onLine) {
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const history = data.loginHistory || [];
                    
                    if (history.length > 0) {
                        const lastEntry = history[history.length - 1];
                        if (lastEntry && !lastEntry.logoutTime) {
                            const now = new Date().toISOString();
                            lastEntry.logoutTime = now;
                            lastEntry.lastActive = now;
                            await updateDoc(userRef, { loginHistory: history });
                        }
                    }
                }
            } catch (e: any) {
                if (e.code !== 'permission-denied') console.error("Error recording logout time:", e);
            }
        }
        await signOut(auth);
    },

    onAuthStateChanged: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                 try {
                     const userDocRef = doc(db, 'users', fbUser.uid);
                     let userData = null;
                     try {
                         const userDoc = await getDoc(userDocRef);
                         if (userDoc.exists()) userData = userDoc.data();
                     } catch (e: any) {
                         if (e.code !== 'permission-denied') throw e;
                     }
                     
                     if (userData) {
                         callback(mapUser(fbUser, userData));
                     } else {
                         const newUser = {
                             username: fbUser.displayName || 'User',
                             email: fbUser.email?.replace('+dev_priv', '') || '',
                             isDeveloper: fbUser.email?.includes('+dev_priv') || false,
                             registrationDate: fbUser.metadata.creationTime,
                             loginHistory: []
                         };
                         callback(mapUser(fbUser, newUser));
                     }
                 } catch (e) {
                     console.error("Error fetching user data in auth change", e);
                     callback(null);
                 }
            } else {
                callback(null);
            }
        });
    },
    
    getAllUsers: async (): Promise<{ key: string, user: User }[]> => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            return querySnapshot.docs.map(docSnap => ({
                key: docSnap.id,
                user: { uid: docSnap.id, ...docSnap.data() } as User
            }));
        } catch (e: any) {
            if (e.code !== 'permission-denied') console.error("Error getting users", e);
            return [];
        }
    },

    deleteUser: async (userKey: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'users', userKey));
        } catch(e: any) { 
            if (e.code !== 'permission-denied') console.error("Error deleting user profile:", e); 
        }
    },
};
