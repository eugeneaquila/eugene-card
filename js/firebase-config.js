// js/firebase-config.js

// Firebase Configuration Object
// Replace these placeholders with your actual Firebase web project credentials:
const firebaseConfig = {
  apiKey: "AIzaSyCm13Nh6k6W9wsL0_OPpjKZNrbSg-pFsuA",
  authDomain: "eugene-card-marketplace.firebaseapp.com",
  projectId: "eugene-card-marketplace",
  storageBucket: "eugene-card-marketplace.appspot.com",
  messagingSenderId: "789014481646",
  appId: "1:789014481646:web:3858909b429985005a41ff",
  measurementId: "G-MRPT21P9M1"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global Instances
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();