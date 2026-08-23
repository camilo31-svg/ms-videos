# MS Videos

Installable mobile-first player for three public Media Seva video collections:

- Sant Sadhu Ram Ji
- Sant Ajaib Singh Ji
- Maestro Kirpal con subtitulos and Serie Lluvia de Gracia from Sant Mat Castellano

## Included

- Video-only catalog with nested navigation, a back button, and breadcrumbs.
- Visual year tiles for quick navigation.
- Complete catalog snapshot for GitHub Pages, including all nested video folders.
- One row per recording, with a quality chooser when low, DVD, HD, 4K, MP4, or AVI variants are available.
- Foreground video playback.
- Audio-only mode for more reliable playback while the screen is locked.
- Media Session controls for play, pause, previous, next, and 10-second seeking.
- Lock-screen title, path, and MS Videos artwork on supported devices.
- Device-local favorites, listening history, and resume position.
- Direct download links where the repository permits downloads.
- System-aware light and dark modes with the selected theme saved on the device.
- Installable PWA shell with offline access to the app and catalog seed.

## Local preview

The app has no third-party runtime dependencies. With Node.js 22 or newer:

```powershell
node scripts/dev-server.mjs
```

Open `http://127.0.0.1:4173`.

Build and verify:

```powershell
node scripts/build.mjs
node --test tests/app.test.mjs
```

To refresh the complete catalog snapshot before publishing:

```powershell
node scripts/crawl-catalog.mjs
```

The static PWA is published from the contents of `public/` and uses relative paths so it works at `https://camilo31-svg.github.io/ms-videos/`.

## Native mobile path

The PWA uses the browser Media Session API. Android browsers usually support its lock-screen controls well, but background video-to-audio behavior can still vary by browser and iOS version.

For guaranteed background playback in an App Store or Play Store build, the recommended implementation is React Native with a native playback service: Media3 and a foreground media service on Android, plus `AVAudioSession` playback mode and `MPNowPlayingInfoCenter` on iOS. Flutter is equally viable with `video_player`, `just_audio`, and `audio_service`. Swift/Kotlin gives the most control but requires two separate apps.

The catalog model, favorites/history schema, lazy folder endpoint, and Spanish interface in this project can be reused by any of those native stacks.
