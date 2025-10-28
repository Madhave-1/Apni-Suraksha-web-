import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGUr37MokAGMN4CkPAvwxOHQrfZTMf6KY",
  authDomain: "apnisuraksha-44c45.firebaseapp.com",
  projectId: "apnisuraksha-44c45",
  storageBucket: "apnisuraksha-44c45.appspot.com",
  messagingSenderId: "706482026117",
  appId: "1:706482026117:web:30432e8e222e91abf9dbec"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
