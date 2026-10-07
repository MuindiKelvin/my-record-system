// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBdpYdqeKVnEltKpzIZHol1ZPN0Zu5hBX4",
  authDomain: "my-records-d94f2.firebaseapp.com",
  projectId: "my-records-d94f2",
  storageBucket: "my-records-d94f2.firebasestorage.app",
  messagingSenderId: "354724250611",
  appId: "1:354724250611:web:83a130f0c4c807f2cac886",
  measurementId: "G-DV6BPKD5DH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);