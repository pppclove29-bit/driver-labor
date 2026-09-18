// Turnstile(보이지 않는 모드)로 세션용 토큰을 받는다. 앱(apps/web)에서만 쓴다.
// 결과 보기 페이지(apps/result)에는 넣지 않는다 (CLAUDE.md 절대 규칙 3).
//
// sitekey는 VITE_TURNSTILE_SITEKEY. 비어 있으면:
//   - 개발 서버: Worker fixtures 모드가 어떤 토큰이든 통과시키므로 스크립트 없이 고정 토큰
//   - 빌드: Cloudflare 공개 테스트 sitekey(항상 통과). 실제 위젯은 M6에서 만든다.

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TEST_SITEKEY = '1x00000000000000000000AA';

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'interaction-only';
      callback: (token: string) => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

function load(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile'));
    };
    script.onerror = () => {
      loading = undefined;
      reject(new Error('turnstile'));
    };
    document.head.append(script);
  });
  return loading;
}

export async function turnstileToken(): Promise<string> {
  const configured = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;
  if (!configured && import.meta.env.DEV) return 'dev-fixture';
  const api = await load();
  return new Promise((resolve, reject) => {
    const el = document.createElement('div');
    el.className = 'turnstile';
    document.body.append(el);
    const done = (id: string) => {
      api.remove(id);
      el.remove();
    };
    const id = api.render(el, {
      sitekey: configured ?? TEST_SITEKEY,
      appearance: 'interaction-only',
      callback: (token) => {
        done(id);
        resolve(token);
      },
      'error-callback': () => {
        done(id);
        reject(new Error('turnstile'));
      },
    });
  });
}
