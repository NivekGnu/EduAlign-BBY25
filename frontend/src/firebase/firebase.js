import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    
  apiKey: "AIzaSyB5NOkb1AcoAW3oKj7IzJWNIVvXoJSAPjk", 
  authDomain: "edualignai-3800.firebaseapp.com",
  projectId: "edualignai-3800",
  storageBucket: "edualignai-3800.firebasestorage.app",
  messagingSenderId: "100283104152",
  appId: "1:100283104152:web:758224f9e5e89d08c949ed"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);