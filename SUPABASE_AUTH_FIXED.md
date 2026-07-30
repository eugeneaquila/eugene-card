Eugene Card Supabase Auth Fixed

Changes:
- Firebase Google OAuth should be replaced with Supabase OAuth handler.
- Use loginWithGoogle() for the Google button.
- Enable Google provider in Supabase Authentication.
- Configure redirect URLs.

Search remaining Firebase references and remove:
firebase
initializeApp
signInWithPopup
GoogleAuthProvider