// js/auth.js

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // Ensure Firebase Auth is loaded and initialized before listening
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      updateAuthUI(user);
      
      if (typeof onAuthResolved === 'function') {
        onAuthResolved(user);
      }

      if (user) {
        syncUserToFirestore(user);
      }
    });
  } else {
    console.error("Firebase Auth SDK not detected. Check script order in index.html.");
  }
});

function loginWithGoogle() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    showToast("Firebase Auth is not initialized.");
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  
  // Force account selection prompt every time to prevent cached token loops
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      showToast(`Successfully signed in as ${user.displayName || user.email}`);
    })
    .catch((error) => {
      console.error("Google Sign-In Error Code:", error.code);
      console.error("Google Sign-In Error Message:", error.message);
      
      if (error.code === 'auth/popup-blocked') {
        showToast("Pop-up blocked by browser. Please allow popups for this site.");
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast("Domain not authorized in Firebase Console settings.");
      } else {
        showToast("Sign-in failed: " + error.message);
      }
    });
}

function logoutUser() {
  if (typeof firebase === 'undefined' || !firebase.auth) return;

  firebase.auth().signOut()
    .then(() => {
      currentUser = null;
      updateAuthUI(null);
      showToast("Signed out successfully.");
      if (typeof onAuthResolved === 'function') {
        onAuthResolved(null);
      }
      window.location.reload();
    })
    .catch((error) => {
      console.error("Sign Out Error:", error);
      showToast("Failed to sign out.");
    });
}

function updateAuthUI(user) {
  const loginBtn = document.getElementById('google-login-btn');
  const profileWidget = document.getElementById('user-profile-widget');
  const userNameEl = document.getElementById('header-user-name');
  const userAvatarEl = document.getElementById('header-user-avatar');

  if (user) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (profileWidget) profileWidget.classList.remove('hidden');
    
    if (userNameEl) {
      userNameEl.textContent = user.displayName || user.email.split('@')[0];
    }
    if (userAvatarEl) {
      userAvatarEl.src = user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`;
    }
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (profileWidget) profileWidget.classList.add('hidden');
  }
}

async function syncUserToFirestore(user) {
  try {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    const adminEmails = [
      "eugene.aquila06@gmail.com",
      "yujinybwork@gmail.com"
    ];
    
    const isAdmin = adminEmails.includes((user.email || '').toLowerCase().trim());

    if (!doc.exists) {
      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Collector',
        username: user.email.split('@')[0].toLowerCase(),
        avatar: user.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`,
        role: isAdmin ? 'ADMIN' : 'REGULAR',
        createdAt: new Date().toISOString()
      });
    } else {
      await userRef.set({
        email: user.email,
        lastLogin: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err) {
    console.error("Error syncing user profile to Firestore:", err);
  }
}