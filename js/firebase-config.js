// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCm13Nh6k6W9wsL0_OPpjKZNrbSg-pFsuA",
  authDomain: "eugene-card-marketplace.firebaseapp.com",
  projectId: "eugene-card-marketplace",
  storageBucket: "eugene-card-marketplace.appspot.com",
  messagingSenderId: "789014481646",
  appId: "1:789014481646:web:3858909b429985005a41ff"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();