# Supabase setup for 5areta

The production Supabase project is connected and configured.

## Current architecture
- GitHub Pages hosts the frontend/PWA.
- Supabase Auth keeps a persistent anonymous session per browser/device.
- A new browser/session sees a site password screen.
- The `unlock-site` Edge Function verifies the password server-side and adds the current anonymous Auth user to `authorized_devices`.
- RLS allows business-data access only for sessions present in `authorized_devices`.
- Once a normal browser has been approved, its persisted Supabase session means the password is not requested on normal subsequent opens.
- Supabase Database stores structured shop data.
- Supabase Storage bucket `product-images` stores product images privately.
- `cloud.js` performs the password gate, background synchronization, and signed image loading.
- localStorage is kept as an immediate device cache/offline working copy. There is no one-time data-migration gate.

## Password security
- The plaintext site password must never be committed to GitHub.
- `site_access_config` stores only the password hash and has RLS enabled with no browser policy.
- `verify_site_password(text)` is executable only by service-role code.
- The `unlock-site` Edge Function runs the password check and authorizes the current anonymous user after success.
- `site_password_attempts` rate-limits repeated failures for the same anonymous session.
- The frontend stores only a non-secret local unlocked marker; it does not store the site password.

## Important security rules
- Never commit a service-role/secret key to GitHub.
- The browser contains only the public Project URL and publishable key.
- Do not make the business tables publicly writable.
- New anonymous sessions must pass the site password before receiving a row in `authorized_devices`.

## Legacy mechanisms
The earlier device-PIN/migration design remains removed:
- `device_pin_attempts` removed.
- `shop_access_config` removed.
- `verify_shop_pin(text)` removed.
- The old `verify-device` Edge Function is disabled and is not called by the frontend.
- The previous automatic localStorage migration/verification flow remains removed.

## Deployment
Production project:
`rsabmbljhjsfvadhrsti`

Anonymous Sign-Ins remain enabled so a new browser can obtain a session before presenting the site password.
