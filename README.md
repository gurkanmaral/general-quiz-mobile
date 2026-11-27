# KNO. mobile

The KNO. daily quiz for iOS and Android: Expo SDK 58, Expo Router, React Native 0.88. Same design and features as the web app ([general-quiz](https://github.com/gurkanmaral/general-quiz)), talking to the same API ([general-quiz-backend](https://github.com/gurkanmaral/general-quiz-backend)).

## Run locally

Start the backend first (`docker compose up --build` in general-quiz-backend; API on `:8787`), then:

```bash
npm install
npx expo start            # press i for the iOS simulator, a for Android, or scan the QR code with Expo Go
```

In development the app finds the API on the machine running the Expo dev server (port 8787), so simulators and phones on the same Wi-Fi work without configuration. Override with `EXPO_PUBLIC_API_URL` (and `EXPO_PUBLIC_WEB_URL` for shared links). The email confirmation code is **490909** outside production.

## How it works

- `src/app/` — screens (Expo Router): tabs **Today · Quizzes · Library · Profile**, plus `day/[date]`, `play/[slug]`, `lobby/[code]`, `friends`, `notifications`, `settings`, `privacy`, the `sign-in` modal and the `f/[token]` / `n/[token]` link screens.
- `src/lib/` — API client, account, Daily progress, notifications and sockets. Native apps have no cookies: the session token from Better Auth's bearer plugin (`set-auth-token`) is kept in the Keychain/Keystore (`expo-secure-store`) and sent as `Authorization: Bearer`, and as `auth.token` on Socket.IO.
- `src/ui/` — the design system (colours, fonts, hard-shadow blocks, buttons, avatars).
- `src/contracts`, `src/shared` — copies of the backend's zod contracts and streak/rotation rules. `npm run check:shared` fails when they differ from `../general-quiz-backend`; copy the backend files after a change there.
- `src/fallback` — bundled Daily content for offline play.
- Deep links: `kno://lobby/<code>`, `kno://f/<token>`, `kno://n/<token>`.

## Scripts

`npm run typecheck` · `npm run lint` · `npm run check:shared`

Not yet on mobile: Google sign-in (needs native OAuth setup) and push notifications.
