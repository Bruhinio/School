import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: AIzaSyDAoGHH2QWcTyhh1U7wJ02FNeZi0ThpnJs",
  authDomain: "academic-8d9a0.firebaseapp.com",
  projectId: "academic-8d9a0",
  storageBucket: "academic-8d9a0.firebasestorage.app",
  messagingSenderId: "634725088368",
  appId: "1:634725088368:web:9ea8caf3f5679a8806c8b5"
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)
