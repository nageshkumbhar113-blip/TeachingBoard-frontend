# TeachingBoard Mobile And Runtime Notes

## Runtime smoke tests

Run:

```bash
npm install
npm run test:runtime
```

What is covered:

- Student app shows published quizzes only
- Admin to Student deep-link handoff works with shared IndexedDB
- Service worker re-registration clears stale versioned caches

## Capacitor Android wrapper

Already scaffolded:

- `capacitor.config.ts`
- `android/`
- `dist-mobile/` generation via `npm run mobile:prepare`

Useful commands:

```bash
npm run mobile:prepare
npm run cap:add:android
npm run cap:sync
```

## APK build prerequisite

Java is available on this machine, but Android SDK is not configured yet.

To fix:

1. Install Android SDK via Android Studio.
2. Copy `android/local.properties.example` to `android/local.properties`.
3. Set the correct SDK path.
4. Then run:

```bash
android\gradlew.bat -p android assembleDebug
```

Current blocker seen during build:

- `SDK location not found`
