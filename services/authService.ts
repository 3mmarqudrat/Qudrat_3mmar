
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

// Map Firebase User to App User
const mapUser = (fbUser: FirebaseUser, additionalData?: any): User => ({
    uid: fbUser.uid,
    email: fbUser.email?.replace('+dev_priv', '') || '', // Strip internal suffix for display
    username: additionalData?.username || fbUser.displayName || 'User',
    isDeveloper: additionalData?.isDeveloper || false,
    registrationDate: fbUser.metadata.creationTime,
    loginHistory: additionalData?.loginHistory || []
});

const DEV_EMAIL_KEY = 'qudrat_dev_email';
// كلمة مرور داخلية لتجاوز شرط الـ 6 أحرف الخاص بـ Firebase
const DEV_SECURE_PASSWORD = '...dev_secure'; 

// Helper function to insert suffix correctly BEFORE the @ symbol
// Example: user@gmail.com -> user+dev_priv@gmail.com
const toDevEmail = (email: string): string => {
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) return email; 
    return email.substring(0, atIndex) + '+dev_priv' + email.substring(atIndex);
};

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        try {
            // الدخول للمستخدم العادي (بيانات عادية)
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
            
            // Track Login
            try {
                await updateDoc(doc(db, 'users', cred.user.uid), {
                    loginHistory: arrayUnion({
                        loginTime: new Date().toISOString(),
                        logoutTime: null
                    } as LoginRecord)
                });
            } catch (e) {
                // If doc doesn't exist, ignore tracking
            }

            return mapUser(cred.user, userDoc.exists() ? userDoc.data() : {});
        } catch (error: any) {
            console.error("Login Error:", error);
            throw new Error('بيانات الدخول غير صحيحة');
        }
    },

    // دالة دخول المطور السرية
    loginDeveloper: async (inputEmail?: string): Promise<User> => {
        // 1. تحديد البريد الإلكتروني الذي سنستخدمه
        // إذا قام المستخدم بكتابة بريد، نستخدمه. إذا تركه فارغاً، نبحث في الذاكرة.
        let emailToUse = inputEmail?.trim();
        
        if (!emailToUse) {
            emailToUse = localStorage.getItem(DEV_EMAIL_KEY) || '';
        }

        if (!emailToUse) {
            // GENERIC ERROR MESSAGE FOR SECRECY
            throw new Error("البريد الإلكتروني مطلوب.");
        }
        
        try {
            // 2. استخدام النسخة "المعدلة" من البريد داخلياً
            const targetEmail = toDevEmail(emailToUse);
            
            // 3. استخدام كلمة المرور الطويلة داخلياً
            const cred = await signInWithEmailAndPassword(auth, targetEmail, DEV_SECURE_PASSWORD);
            const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
            
            // 4. حفظ البريد بنجاح في هذا المتصفح للمرات القادمة (لتفعيل الدخول بالحقل الفارغ)
            localStorage.setItem(DEV_EMAIL_KEY, emailToUse);

            try {
                 await updateDoc(doc(db, 'users', cred.user.uid), {
                    loginHistory: arrayUnion({
                        loginTime: new Date().toISOString(),
                        logoutTime: null
                    } as LoginRecord)
                });
            } catch (e) {}

            return mapUser(cred.user, userDoc.exists() ? userDoc.data() : { isDeveloper: true });

        } catch (error: any) {
            console.error("Dev Login Error:", error);
            // GENERIC ERROR MESSAGE FOR SECRECY
            throw new Error("بيانات الدخول غير صحيحة.");
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
    
    // دالة تسجيل المطور السرية
    registerDeveloper: async (email: string): Promise<User> => {
        if (!email.trim()) throw new RegistrationError('البريد الإلكتروني مطلوب.');
        
        try {
            // 1. إضافة اللاحقة للبريد داخلياً بشكل صحيح (قبل ال @)
            const devEmail = toDevEmail(email);
            
            // 2. إنشاء الحساب بكلمة المرور الداخلية الطويلة
            const cred = await createUserWithEmailAndPassword(auth, devEmail, DEV_SECURE_PASSWORD);
            await updateProfile(cred.user, { displayName: 'المطور' });
            
            const devUser = {
                username: 'المطور',
                email: email, // حفظ البريد الأصلي للعرض
                isDeveloper: true,
                registrationDate: new Date().toISOString(),
                loginHistory: []
            };
            
            await setDoc(doc(db, 'users', cred.user.uid), devUser);
            
            // 3. حفظ البريد الأصلي في المتصفح للدخول السريع لاحقاً
            localStorage.setItem(DEV_EMAIL_KEY, email);
            
            return mapUser(cred.user, devUser);
        } catch (error: any) {
             console.error("Dev Registration Error:", error);
            if (error.code === 'auth/email-already-in-use') {
                 // رسالة مخصصة للمطور
                 throw new RegistrationError('حساب المطور لهذا البريد موجود بالفعل. حاول تسجيل الدخول.');
            }
            // Catch invalid email specifically
            if (error.code === 'auth/invalid-email') {
                throw new RegistrationError('البريد الإلكتروني غير صالح.');
            }
            throw new RegistrationError('حدث خطأ أثناء إنشاء حساب المطور.');
        }
    },
    
    logout: async () => {
        await signOut(auth);
    },

    onAuthStateChanged: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                 try {
                     const userDocRef = doc(db, 'users', fbUser.uid);
                     const userDoc = await getDoc(userDocRef);
                     
                     if (userDoc.exists()) {
                         callback(mapUser(fbUser, userDoc.data()));
                     } else {
                         // Fallback logic
                         const newUser = {
                             username: fbUser.displayName || 'User',
                             email: fbUser.email?.replace('+dev_priv', '') || '',
                             isDeveloper: false,
                             registrationDate: fbUser.metadata.creationTime,
                             loginHistory: []
                         };
                         await setDoc(userDocRef, newUser);
                         callback(mapUser(fbUser, newUser));
                     }
                 } catch (e) {
                     console.error("Error fetching user data", e);
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
        } catch (e) {
            console.error("Error getting users", e);
            return [];
        }
    },

    deleteUser: async (userKey: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'users', userKey));
        } catch(e) { 
            console.error("Error deleting user profile:", e); 
        }
    },
};
