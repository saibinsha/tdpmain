// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAwithJ3_8TxjV_H9do2lUbI-Q8W3fSLaI",
  authDomain: "tdp2-4d674.firebaseapp.com",
  projectId: "tdp2-4d674",
  storageBucket: "tdp2-4d674.firebasestorage.app",
  messagingSenderId: "386414628105",
  appId: "1:386414628105:web:2a8547550f4d24820157d8",
  measurementId: "G-L0ZPR0NLMG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
