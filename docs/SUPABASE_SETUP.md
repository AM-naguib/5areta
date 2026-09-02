# Supabase setup for 5areta

This folder prepares the secure shared-data backend for the GitHub Pages app.

## Security model
- The browser uses only the Supabase Project URL and publishable key.
- The service-role key is never stored in this repository or frontend.
- Each device gets an anonymous Supabase Auth session.
- A new device enters the shop's 6-digit PIN once.
- The `verify-device` Edge Function checks that PIN using a Supabase Function secret and marks the anonymous user as an authorized device.
- RLS blocks business data unless the current anonymous user is in `authorized_devices`.
- After authorization, the Supabase session persists on that browser so normal use has no login screen.
- Five wrong PIN attempts block that anonymous session for 15 minutes.

## One-time Supabase Dashboard steps

### 1. Enable Anonymous Sign-Ins
Supabase Dashboard → Authentication → Providers / Sign In methods → enable **Anonymous Sign-Ins**.

### 2. Create the database schema
Supabase Dashboard → SQL Editor → New query.
Copy all of `supabase/schema.sql`, run it once, and confirm it succeeds.

### 3. Create the Edge Function
Supabase Dashboard → Edge Functions → create a function named:

`verify-device`

Paste the contents of `supabase/functions/verify-device/index.ts`.

### 4. Add the shop PIN as a Function secret
In the Edge Function / project secrets area add:

`SHOP_PIN`

Set its value to the 6-digit shop PIN you chose. Do **not** commit that value to GitHub.

The built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to deployed Supabase Edge Functions; do not copy the service-role key into the frontend.

### 5. Deploy the function
Deploy `verify-device`.

## Public frontend values
These values are safe to use in the browser:
- Project URL: `https://rsabmbljhjsfvadhrsti.supabase.co`
- Publishable key: use the project's `sb_publishable_...` key already supplied to the app setup.

## Next implementation step
After these dashboard steps are complete, wire the frontend to:
1. create/resume the anonymous session,
2. check `authorized_devices`,
3. show the one-time PIN sheet on an unapproved device,
4. migrate the current localStorage dataset to the Supabase tables,
5. upload product images to the private `product-images` bucket,
6. verify the cloud copy,
7. remove the legacy localStorage dataset,
8. use a small offline queue for writes while the network is unavailable.
