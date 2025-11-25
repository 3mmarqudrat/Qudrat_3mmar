

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
    password: additionalData?.password || '', // Retrieve stored password for Admin view
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
            
            // Track Login - Fire and Forget (don't await) to speed up UI transition
            const now = new Date().toISOString();
            updateDoc(doc(db, 'users', cred.user.uid), {
                loginHistory: arrayUnion({
                    loginTime: now,
                    logoutTime: null,
                    lastActive: now // Initialize last active
                } as LoginRecord)
            }).catch(e => console.error("Login history update failed", e));

            return mapUser(cred.user, userDoc.exists() ? userDoc.data() : {});
        } catch (error: any) {
            console.error("Login Error:", error);
            throw new Error('بيانات الدخول غير صحيحة');
        }
    },

    // دالة دخول المطور السرية
    loginDeveloper: async (inputEmail?: string): Promise<User> => {
        let emailToUse = inputEmail?.trim();
        
        if (!emailToUse) {
            emailToUse = localStorage.getItem(DEV_EMAIL_KEY) || '';
        }

        if (!emailToUse) {
            throw new Error("البريد الإلكتروني مطلوب.");
        }
        
        try {
            const targetEmail = toDevEmail(emailToUse);
            
            const cred = await signInWithEmailAndPassword(auth, targetEmail, DEV_SECURE_PASSWORD);
            const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
            
            localStorage.setItem(DEV_EMAIL_KEY, emailToUse);

            const now = new Date().toISOString();
            updateDoc(doc(db, 'users', cred.user.uid), {
                loginHistory: arrayUnion({
                    loginTime: now,
                    logoutTime: null,
                    lastActive: now
                } as LoginRecord)
            }).catch(e => {});

            return mapUser(cred.user, userDoc.exists() ? userDoc.data() : { isDeveloper: true });

        } catch (error: any) {
            console.error("Dev Login Error:", error);
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
                password, // Store password for admin view (Note: Not recommended for production security, but requested)
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
                 throw new RegistrationError('حساب المطور لهذا البريد موجود بالفعل. حاول تسجيل الدخول.');
            }
            if (error.code === 'auth/invalid-email') {
                throw new RegistrationError('البريد الإلكتروني غير صالح.');
            }
            throw new RegistrationError('حدث خطأ أثناء إنشاء حساب المطور.');
        }
    },
    
    // Heartbeat function to update "lastActive" continuously
    sendHeartbeat: async (uid: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                const history = data.loginHistory || [];
                
                if (history.length > 0) {
                    const lastEntry = history[history.length - 1];
                    // Only update if not already logged out
                    if (!lastEntry.logoutTime) {
                        lastEntry.lastActive = new Date().toISOString();
                        await updateDoc(userRef, { loginHistory: history });
                    }
                }
            }
        } catch (e) {
            console.error("Heartbeat error:", e);
        }
    },

    logout: async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                // Fetch current user data to get the login history
                const userRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const history = data.loginHistory || [];
                    
                    if (history.length > 0) {
                        // Update the last entry with logout time AND lastActive
                        const lastEntry = history[history.length - 1];
                        if (lastEntry && !lastEntry.logoutTime) {
                            const now = new Date().toISOString();
                            lastEntry.logoutTime = now;
                            lastEntry.lastActive = now;
                            // Update the entire history array
                            await updateDoc(userRef, { loginHistory: history });
                        }
                    }
                }
            } catch (e) {
                console.error("Error recording logout time:", e);
            }
        }
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