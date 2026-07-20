// Firebase — configuração com variáveis de ambiente


import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';


console.log('Variáveis Firebase:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY
    ? `${import.meta.env.VITE_FIREBASE_API_KEY.slice(0, 6)}...`
    : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

/* ——— helpers ——— */
export const login      = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logout     = () => signOut(auth);
export const onAuth     = (cb) => onAuthStateChanged(auth, cb);

/** busca o perfil (role) do usuário no Firestore */
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? snap.data() : null;
};