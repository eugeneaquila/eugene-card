# Eugene Card Vercel Setup

## Environment Variables

Add in Vercel Project Settings:

SUPABASE_URL
SUPABASE_ANON_KEY

## Supabase Google OAuth

In Supabase:
Authentication -> Providers -> Google

Enable Google and add:
- Google Client ID
- Google Client Secret

Add redirect URLs:

Production:
https://YOUR_DOMAIN.vercel.app

Development:
http://localhost:3000

## Deploy

Import this project into Vercel.
Framework preset:
Other

Build command:
leave empty

Output directory:
/