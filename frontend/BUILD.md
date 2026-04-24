# AAN Services — Build & Distribute an Installable APK

This guide covers generating an offline-installable `.apk` for Android using Expo Application Services (EAS). It is the ONLY part of the workflow that must be done from your local computer (not inside Emergent).

---

## Prerequisites (one-time)

1. Install **Node.js 20+ LTS** → https://nodejs.org
2. Install **Git** → https://git-scm.com
3. Install **Yarn** → `npm install -g yarn`
4. Install **EAS CLI** → `npm install -g eas-cli`
5. Create a free Expo account → https://expo.dev/signup

## Step 1 — Export code from Emergent

In Emergent, click **Save to GitHub**, then on your machine:

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>/frontend
yarn install
```

## Step 2 — Deploy the backend publicly

The URL in `EXPO_PUBLIC_BACKEND_URL` is baked into the APK. Deploy the FastAPI backend (`/app/backend`) to any cheap/free host:

- **Railway** (easiest) → https://railway.app → New Project → Deploy from GitHub → select `/backend` → add MongoDB plugin
- **Render** → https://render.com → similar
- **Fly.io** → https://fly.io

Once deployed you get a URL like `https://aan-backend.up.railway.app`.

## Step 3 — Configure environment for the build

Copy the sample and fill in your public backend URL:

```bash
cp .env.production.example .env
# edit .env — set EXPO_PUBLIC_BACKEND_URL to your deployed backend URL
```

> ⚠️ Do NOT ship the preview-agent URL; it will stop working outside the preview session.

## Step 4 — Review `app.json`

Already production-ready. Only change if you need different branding:

```json
"name": "AAN Services",
"slug": "aan-services",
"android": { "package": "in.aanservices.app", "versionCode": 1 },
"ios":     { "bundleIdentifier": "in.aanservices.app" }
```

Bump `versionCode` (Android) / `buildNumber` (iOS) on every new build.

## Step 5 — Login & build

```bash
eas login                # use your Expo account
eas build:configure      # pick Android (eas.json already exists, confirm it)
eas build --profile preview --platform android
```

First time EAS will ask to create an Android **Keystore** — say **YES** (free, managed by EAS).

## Step 6 — Download & install

- ~10–20 min later, EAS prints a URL like `https://expo.dev/artifacts/eas/abc.apk`
- Also visible on https://expo.dev → Projects → aan-services → Builds
- On the Android phone: enable **Install unknown apps** for Chrome → open the URL → tap **Install**
- Share the same URL with any user for instant install

---

## iOS (optional)

Requires a paid Apple Developer account ($99/yr):

```bash
eas build --profile preview --platform ios
```

Distribute via **TestFlight** (recommended) or ad-hoc UDID-based provisioning.

---

## Google Play Store submission (later)

```bash
eas build --profile production --platform android   # generates .aab
eas submit --platform android                        # uploads to Play Console
```

One-time Play Console fee: $25.

---

## Handy commands

```bash
# See your builds
eas build:list

# Cancel a running build
eas build:cancel

# View credentials (keystore, certs)
eas credentials
```

## Free-tier limits

- 30 priority builds / month
- Unlimited builds on the slow (free) queue
- Keystore storage: free

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| APK installs but shows network errors | `EXPO_PUBLIC_BACKEND_URL` is wrong / backend not publicly reachable. Update `.env`, rebuild. |
| "Version code 1 has already been used" on re-upload | Bump `android.versionCode` in `app.json`. |
| Camera/Gallery does nothing | Android permissions missing in `app.json` plugin section (already present here). Rebuild. |
| Login fails only in APK | Double-check `.env` URL — must start with `https://` and be publicly reachable. |
| Build queue is slow | Free tier uses a shared queue — use EAS paid plan or wait. |

---

Built with ❤️ on Emergent.
