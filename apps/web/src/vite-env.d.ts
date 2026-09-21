/// <reference types="vite/client" />

// 빌드할 때 정해지는 값. 실제 값은 apps/web/.env* 와 .env.*.local에 둔다.
interface ImportMetaEnv {
  /** Worker API 주소. 빈 값이면 같은 출처 */
  readonly VITE_API_BASE?: string;
  /** 결과 링크 주소. 앱에서는 배포 주소여야 한다 */
  readonly VITE_RESULT_BASE?: string;
  /** Turnstile sitekey. 비어 있으면 개발은 고정 토큰, 빌드는 공개 테스트 키 */
  readonly VITE_TURNSTILE_SITEKEY?: string;
}
