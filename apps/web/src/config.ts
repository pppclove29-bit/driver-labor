// 빌드할 때 정해지는 주소. 앱 화면은 WebView에서 https://localhost로 뜨므로
// Worker API와 결과 링크는 절대 주소여야 한다.
//
//   웹 개발       빈 값. 같은 출처 + vite 프록시
//   --mode app     배포 주소 (.env.app, 실제 값은 M6 배포 때 .env.app.local로 넣는다)
//   --mode app-dev 에뮬레이터에서 맥북의 wrangler dev (http://10.0.2.2:8788)

interface BuildEnv {
  VITE_API_BASE?: string | undefined;
  VITE_RESULT_BASE?: string | undefined;
}

const currentOrigin = (): string => (typeof location === 'undefined' ? '' : location.origin);

/** `/api` 앞에 붙일 주소. 빈 값이면 같은 출처. */
export const apiBase = (env: BuildEnv = import.meta.env): string =>
  (env.VITE_API_BASE ?? '').trim();

/** 결과 링크(`/r#…`)의 주소. 앱에서는 localhost가 아니라 배포 주소여야 한다. */
export const resultBase = (env: BuildEnv = import.meta.env, origin?: string): string =>
  (env.VITE_RESULT_BASE ?? '').trim() || (origin ?? currentOrigin());
