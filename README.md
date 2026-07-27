# Eugene Card — Server Authority Upgrade

This package moves sensitive marketplace state out of the browser.

## What becomes server-authoritative

- Trade creation, acceptance, rejection, counter/withdraw actions
- Card ownership changes during accepted trades
- Collector XP / level / reputation
- Auction bids and bid ordering
- Auction finalization and auction-win counts
- Server-generated notifications
- QRIS order creation and admin approval/rejection
- Profile identity mapping and server-owned stats

The browser can request an operation, but it cannot directly write cards,
trade state, auction state, transactions, stats, or notifications.

## Deploy

1. Install Firebase CLI:
   `npm install -g firebase-tools`
2. Authenticate:
   `firebase login`
3. Select your existing Firebase project:
   `firebase use eugene-card-marketplace`
4. If you already have production data, run the backfill script after your users have logged in once:
   `GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json node scripts/backfill-server-fields.js`
5. Install function dependencies:
   `cd functions && npm install`
6. Deploy backend first:
   `firebase deploy --only functions`
7. Replace your hosted frontend with `eugene_card_2_0.html`.
8. Deploy Firestore rules last:
   `firebase deploy --only firestore:rules`

## Admin claim

Admin status is no longer determined by a browser-controlled name/email list.

Use the one-time script with a Firebase Admin service-account credential:

`GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json node scripts/set-admin-claim.js user@example.com`

Then sign out/in so the browser receives the new token.

## Important

Deploy the rules and functions before switching the frontend to the
server-authoritative version. Existing direct client writes to protected
collections will intentionally fail after the rules are active.
