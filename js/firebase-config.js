// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCm13Nh6k6W9wsL0_OPpjKZNrbSg-pFsuA",
  authDomain: "eugene-card-marketplace.firebaseapp.com",
  projectId: "eugene-card-marketplace",
  storageBucket: "eugene-card-marketplace.firebasestorage.app",
  messagingSenderId: "789014481646",
  appId: "1:789014481646:web:3858909b429985005a41ff",
  measurementId: "G-MRPT21P9M1"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

const ADMIN_EMAILS = [
  'eugene.aquila06@gmail.com',
  'yujinybwork@gmail.com'
];

function isUserAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.some(admin => admin.toLowerCase() === email.toLowerCase());
}

// Check if user has PLUS or ADMIN access
async function checkUserAnalyticsAccess(user) {
  if (!user) return false;
  if (isUserAdmin(user.email)) return true;

  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists && doc.data().role === 'PLUS') {
      return true;
    }
  } catch (err) {
    console.error("Error checking membership role:", err);
  }
  return false;
}