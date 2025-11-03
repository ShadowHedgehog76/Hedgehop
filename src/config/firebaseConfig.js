// firebaseConfig.js - Configuration Firebase
// 
// INSTRUCTIONS :
// 1. Créez un projet Firebase sur https://console.firebase.google.com/
// 2. Activez Authentication > Sign-in method > Email/Password
// 3. Activez Realtime Database
// 4. Remplacez les valeurs ci-dessous par celles de votre projet
// 5. Ces clés peuvent être publiques (côté client), elles ne sont pas secrètes

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyB-26w2dwPypmmf8UBAELz2il75PNPPbx8",
  authDomain: "hedgehop-fcf21.firebaseapp.com",
  databaseURL: "https://hedgehop-fcf21-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hedgehop-fcf21",
  storageBucket: "hedgehop-fcf21.firebasestorage.app",
  messagingSenderId: "999347725617",
  appId: "1:999347725617:web:e65bb143493081abb23c10"
};

// Initialisation Firebase (évite la double initialisation)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Export de la base de données Realtime
export const database = getDatabase(app);

// Exemple de vraies valeurs (à remplacer) :
// export const firebaseConfig = {
//   apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
//   authDomain: "hedgehop-music.firebaseapp.com",
//   projectId: "hedgehop-music", 
//   storageBucket: "hedgehop-music.appspot.com",
//   messagingSenderId: "123456789012",
//   appId: "1:123456789012:web:abcdef123456789012345"
// };