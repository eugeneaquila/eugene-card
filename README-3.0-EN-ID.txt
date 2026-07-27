EUGENE CARD 3.0 — EN / ID
===========================

This package is a frontend replacement, not a Firebase data reset.

Included:
- index.html
- analytics.html
- revenue.html
- admin-command-center.html

Language:
- English (EN)
- Bahasa Indonesia (ID)
- Shared localStorage key: eugene_lang
- The language selection persists between pages.
- The 3.0 sidebar, mobile navigation, homepage dashboard, admin links,
  analytics, revenue, and command center use the shared language preference.

Install:
1. Back up the currently deployed frontend.
2. Replace the four HTML files with the files in this package.
3. Keep your Firebase project, Firestore data, Authentication, Storage,
   and Cloud Functions intact.
4. Deploy normally.

Note:
This is not a backend migration. Do not delete your Firebase project or
Firestore collections as part of this frontend replacement.
