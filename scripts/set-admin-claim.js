// One-time setup script.
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json node scripts/set-admin-claim.js user@example.com
//
// After setting the claim, the user must sign out/in (or refresh their ID token)
// before the browser sees the new admin claim.

const admin = require('firebase-admin');

admin.initializeApp();

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-admin-claim.js user@example.com');
  process.exit(1);
}

(async () => {
  const user = await admin.auth().getUserByEmail(email.toLowerCase());
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`Admin claim set for ${user.email} (${user.uid}).`);
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
