# Supabase setup for 5areta

The production Supabase project is connected and configured.

## Current architecture
- GitHub Pages hosts the frontend/PWA.
- Supabase Auth creates a persistent anonymous session per browser/device.
- A new device enters the shop's 6-digit code once.
- The `verify-device` Edge Function validates the code server-side and records the anonymous user in `authorized_devices`.
- RLS allows business-data access only when `is_authorized_device()` is true.
- The shop code is stored only as a bcrypt hash in the protected `shop_access_config` table.
- Supabase Database stores structured shop data.
- Supabase Storage bucket `product-images` stores product images privately.
- `cloud.js` handles migration, background sync, offline queueing, and signed image URLs.

## Important security rules
- Never commit a service-role/secret key to GitHub.
- The browser contains only the public Project URL and publishable key.
- Do not store the plaintext shop code in repository files.
- `device_pin_attempts` and `shop_access_config` intentionally have RLS enabled with no client policies; only trusted server-side code accesses them.

## Deployment
The production backend and Edge Function are already deployed to project:
`rsabmbljhjsfvadhrsti`

Anonymous Sign-Ins are enabled in Supabase Auth.
