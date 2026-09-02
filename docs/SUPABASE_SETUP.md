# Supabase setup for 5areta

The production Supabase project is connected and configured.

## Current architecture
- GitHub Pages hosts the frontend/PWA.
- Supabase Auth keeps a persistent anonymous session per browser/device.
- There is no shop PIN or visible login prompt in normal use.
- RLS allows business-data access only for sessions already present in `authorized_devices`.
- A genuinely new browser/device is not automatically approved; approve it manually in Supabase if needed later.
- Supabase Database stores structured shop data.
- Supabase Storage bucket `product-images` stores product images privately.
- `cloud.js` performs simple background synchronization and signed image loading.
- localStorage is kept as an immediate device cache/offline working copy. There is no one-time migration gate.

## Important security rules
- Never commit a service-role/secret key to GitHub.
- The browser contains only the public Project URL and publishable key.
- Do not make the business tables publicly writable.
- Do not auto-authorize arbitrary anonymous sessions.

## Removed legacy mechanisms
The earlier six-digit shop-code system has been removed:
- `device_pin_attempts` removed.
- `shop_access_config` removed.
- `verify_shop_pin(text)` removed.
- The deployed `verify-device` Edge Function has been replaced with a disabled response and is no longer called by the frontend.
- The previous automatic localStorage migration/verification flow has been removed.

## Deployment
Production project:
`rsabmbljhjsfvadhrsti`

Anonymous Sign-Ins remain enabled so a new browser can obtain a session, but access to business data still requires manual inclusion in `authorized_devices`.
