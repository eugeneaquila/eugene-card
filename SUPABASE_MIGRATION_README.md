# Eugene Card Supabase Migration

This package contains the database migration for replacing Firebase Firestore collections.

Converted collections:
- profiles
- cards
- listings
- tradeRequests -> trade_requests
- chats
- messages
- notifications
- transactions

Next code step:
Replace Firebase Firestore calls:

`db.collection("cards").get()`

with Supabase:

```
const {data} = await supabase.from('cards').select('*')
```

Realtime listeners should use Supabase Realtime channels.