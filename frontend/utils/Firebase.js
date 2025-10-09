import {getAuth, GoogleAuthProvider} from "firebase/auth"
import { initializeApp } from "firebase/app";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY ,
  authDomain: "icilms.firebaseapp.com",
  projectId: "icilms",
  storageBucket: "icilms.firebasestorage.app",
  messagingSenderId: "836234810391",
  appId: "1:836234810391:web:e1da0bed67c78dd26ff852"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app)
const provider = new GoogleAuthProvider()
export {auth,provider}