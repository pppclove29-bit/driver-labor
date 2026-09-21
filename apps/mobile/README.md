# @dl/mobile

안드로이드 앱 껍데기(Capacitor). 화면 코드는 `apps/web`에 있고 여기서는 앱 설정과 안드로이드 프로젝트만 둔다.

| 명령 | 하는 일 |
|---|---|
| `pnpm --filter @dl/mobile sync` | `apps/web` 앱 타깃 빌드 → `android/`로 복사 |
| `pnpm --filter @dl/mobile apk` | 디버그 APK 빌드 |
| `pnpm --filter @dl/mobile install:emulator` | 켜져 있는 에뮬레이터·기기에 설치 |
| `pnpm --filter @dl/mobile open` | Android Studio로 열기 |

- 안드로이드 빌드에는 JDK 21이 필요하다. 스크립트가 `JAVA_HOME`을 Android Studio의 JBR로 잡는다.
- 에뮬레이터: `~/Library/Android/sdk/emulator/emulator -avd fearless_test`
- 앱 타깃 빌드(`--mode app`)는 서비스 워커(PWA)를 빼고 자산만 만든다. 앱은 화면을 내장한다.
- 루트 `pnpm build`(web·result·worker)와 앱 빌드는 분리한다. 앱 빌드는 JDK가 필요하다.
