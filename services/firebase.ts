
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4JFs35VZYKtHlekx5Ws1nDyZOFkjcP9o",
  authDomain: "qudrat-d3af8.firebaseapp.com",
  projectId: "qudrat-d3af8",
  storageBucket: "qudrat-d3af8.firebasestorage.app",
  messagingSenderId: "1045528725724",
  appId: "1:1045528725724:web:01428262909740982c8c19"
};

// تهيئة التطبيق أولاً بشكل صريح لضمان تسجيل كافة المكونات قبل استدعائها
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// تصدير النسخ المهيأة من الخدمات
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
