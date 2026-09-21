# @dl/mobile

안드로이드 앱 껍데기(Capacitor). 화면 코드는 `apps/web`에 있고 여기서는 앱 설정과 안드로이드 프로젝트만 둔다.

| 명령 | 하는 일 |
|---|---|
| `pnpm --filter @dl/mobile dev` | 에뮬레이터용 빌드(`10.0.2.2:8788`) → 설치. 로컬 `pnpm dev:worker`와 함께 쓴다 |
| `pnpm --filter @dl/mobile sync` | 릴리스 설정으로 `apps/web` 빌드 → `android/`로 복사 |
| `pnpm --filter @dl/mobile apk` | 릴리스 설정으로 동기화한 뒤 APK 빌드 |
| `pnpm --filter @dl/mobile install:emulator` | 이미 빌드한 APK를 켜져 있는 기기에 설치 |
| `pnpm --filter @dl/mobile open` | Android Studio로 열기 |

- 안드로이드 빌드에는 JDK 21이 필요하다. 스크립트가 `JAVA_HOME`을 Android Studio의 JBR로 잡는다.
- 에뮬레이터: `~/Library/Android/sdk/emulator/emulator -avd fearless_test`
- 앱 타깃 빌드(`--mode app`)는 서비스 워커(PWA)를 빼고 자산만 만든다. 앱은 화면을 내장한다.
- 루트 `pnpm build`(web·result·worker)와 앱 빌드는 분리한다. 앱 빌드는 JDK가 필요하다.
- **혼합 콘텐츠 예외는 개발 빌드에만.** 앱 화면은 `https://localhost`인데 로컬 Worker는 평문
  `http://10.0.2.2:8788`이라 개발에서만 `CAP_DEV=1`로 예외를 연다. `sync`(릴리스)는 이 값을 주지 않는다.
  `apk`는 항상 릴리스 동기화를 먼저 하므로 개발 설정이 APK에 섞이지 않는다.
  확인: `android/app/src/main/assets/capacitor.config.json`의 `allowMixedContent`, 또는
  `unzip -p android/app/build/outputs/apk/debug/app-debug.apk assets/capacitor.config.json`.
