// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBVyuozFfPPy5I6o5KFwEz58byJ3pJpaI",
  authDomain: "project-records-9603b.firebaseapp.com",
  projectId: "project-records-9603b",
  storageBucket: "project-records-9603b.firebasestorage.app",
  messagingSenderId: "993992362671",
  appId: "1:993992362671:web:93b6e607477155d369e25a",
  measurementId: "G-DJELNY8RWC"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);