# Mobile App (Android / Capacitor) — Build & Hardening Reference

How the web app is packaged into the Android APK, the app-only security
hardening that was added, and how to produce a signed release build.

Last updated: 2026-06-24.

---

## 1. Stack

- **Capacitor 6** wraps the Vite `dist/` build into a native Android WebView app.
- `capacitor.config.ts` — `appId: com.tnpscmentor.app`, `appName: TNPSC Mentors`,
  `webDir: dist`. Native Google sign-in via `@codetrix-studio/capacitor-google-auth`.
- Native plugins in use: `@capacitor/app`, `@capacitor/filesystem`,
  `@capacitor/share`, `@codetrix-studio/capacitor-google-auth`, plus the
  app-local **`ScreenSecure`** plugin (below).

## 2. Build pipeline

```bash
# from tnpsc-mentor/
npm run build           # tsc + vite build  ->  dist/
npx cap sync android    # copy dist + plugins into the android/ Gradle project

# from tnpsc-mentor/android/
JAVA_HOME=<jdk17> ./gradlew assembleDebug     # -> app/build/outputs/apk/debug/app-debug.apk
JAVA_HOME=<jdk17> ./gradlew assembleRelease   # -> app/build/outputs/apk/release/app-release.apk
```

Built/verified with **JDK 17** (`C:/Users/mas20/java/jdk-17.0.10+7`) and the
Android SDK at `C:/Users/mas20/AppData/Local/Android/Sdk`. The SDK path is set in
`android/local.properties` (`sdk.dir=...`, gitignored).

Always run `npm run build && npx cap sync android` before a Gradle build, or the
APK ships a stale web bundle. Convenience copies of the latest APKs live at the
repo root: `TNPSC-Mentor-debug.apk` / `TNPSC-Mentor-release.apk`.

## 3. App-only hardening (2026-06-24)

All four behaviours are gated to the **native app** via
`Capacitor.isNativePlatform()` — the web build is unchanged.

### a. No landing page in the APK
`src/App.tsx` `RootRedirect`: logged-out **native** users go straight to `/login`
(web visitors still get `LandingPage`). `LandingPage` is `lazy()`-loaded, so its
chunk is never fetched inside the app.

### b. No screenshots while taking a test
- Native plugin `android/app/src/main/java/com/tnpscmentor/app/ScreenSecurePlugin.java`
  toggles the window's **`FLAG_SECURE`** (blocks screenshots + screen recording,
  blanks the recent-apps thumbnail). Registered in `MainActivity.java`
  (`registerPlugin(ScreenSecurePlugin.class)` in `onCreate`, before `super`).
- JS bridge `src/lib/screenSecure.ts` + hook `src/hooks/useScreenSecure.ts`.
- Enabled while a test is on screen in `QuizPage.tsx` and `MockQuizPage.tsx`
  (proctored *or* not); released on exit. No-op on web — the existing
  `useProctoring` engine still catches keyboard-shortcut captures there.

> JS cannot intercept Android's hardware/gesture screenshot — `FLAG_SECURE` is
> the only reliable block, hence the native plugin.

### c. Copy / paste prevention (app-wide)
`src/lib/copyGuard.ts` (installed from `App.tsx`) blocks
copy/cut/context-menu/long-press selection document-wide; paste is allowed only
into real `<input>/<textarea>/contenteditable` so login, search and answer entry
still work. Backed by the `.no-copy` CSS rule in `src/index.css` (disables
`user-select` + `-webkit-touch-callout`, re-enables it for form fields).

### d. Explanation PDF download — kept, now saves natively
jsPDF's `doc.save()` silently fails inside a WebView. `src/lib/savePdf.ts`
detects native and writes the PDF via `@capacitor/filesystem` (Cache dir), then
opens the Android share/save sheet via `@capacitor/share` (`files: [uri]`).
All three generators route through it: `lib/explanationPdf.ts`,
`lib/studyNotesPdf.ts`, `lib/pdfGenerator.ts`. Web download is unchanged.

## 4. Release signing

**The original `tnpsc-release.keystore` password was lost** (not in docs, env, or
shell history) so it can no longer sign builds. Since the app is distributed as a
**direct APK download (not Google Play)**, switching keys is safe — no Play
key lock-in. (Only cost: a user with the OLD release installed must uninstall
before installing a new differently-signed APK.)

Current key — `tnpsc-release-2026.keystore` (repo root), created 2026-06-24:
- alias `tnpsc`, RSA-2048, validity ~10000 days, type PKCS12.
- **SHA-1:** `F2:D3:2C:FA:C3:DB:74:35:52:29:93:E8:B6:CE:E7:6B:6A:60:3B:C3`
- **SHA-256:** `86:C0:04:B9:56:F6:71:E6:C7:4D:BD:99:88:65:4F:E4:30:1D:00:B0:F5:8E:5B:BC:D5:E5:BA:5A:06:4B:2E:75`

Signing is wired into `android/app/build.gradle` (`signingConfigs.release`),
which reads `android/keystore.properties` (**gitignored** — holds `storeFile`,
`storePassword`, `keyAlias`, `keyPassword`). If that file is missing, the release
build falls back to **unsigned**.

`android/keystore.properties`:
```
storeFile=../../tnpsc-release-2026.keystore
storePassword=<see password manager>
keyAlias=tnpsc
keyPassword=<see password manager>
```

> Store the keystore file + its password in a password manager / secure backup.
> If both the keystore and password are lost, direct-download users simply
> uninstall + reinstall the next build; a Play-published app could not be updated
> at all. **Never commit `keystore.properties` or `*.keystore`.**

### Verify a signed APK
```bash
<sdk>/build-tools/<ver>/apksigner verify --print-certs app-release.apk
```

### Action item — native Google sign-in
The new key has a new SHA-1, so add **both** new fingerprints above to the Android
OAuth client in the Google Cloud console (same project as the web client id in
`capacitor.config.ts`), or native Google sign-in may fail on the signed build.
