// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
//new
import { getApps, getApp } from "firebase/app";
//import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAsT3hj9Z0OUHm4jauSG8y6OHuQCDlu26s",
  authDomain: "vivapro-b5b3c.firebaseapp.com",
  projectId: "vivapro-b5b3c",
  storageBucket: "vivapro-b5b3c.firebasestorage.app",
  messagingSenderId: "119317028074",
  appId: "1:119317028074:web:236d79ebb5289fbbc4cb93",
  measurementId: "G-0MSFXK9XZZ"
};

// Initialize Firebase
//const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);

//NEW ADDITION 10THMAY
// This prevents Firebase from starting twice
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

//const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); 

//export const db = getFirestore(app); 

//10th may
//export const db = initializeFirestore(app, {
  //localCache: persistentLocalCache()
//});

export const db = getFirestore(app);