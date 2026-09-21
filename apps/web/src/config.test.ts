import { describe, expect, it } from 'vitest';

import { apiBase, resultBase } from './config.js';

describe('빌드 주소', () => {
  it('설정이 있으면 그 주소', () => {
    expect(apiBase({ VITE_API_BASE: 'https://driver-labor.workers.dev' })).toBe(
      'https://driver-labor.workers.dev',
    );
    expect(
      resultBase({ VITE_RESULT_BASE: 'https://driver-labor.workers.dev' }, 'https://localhost'),
    ).toBe('https://driver-labor.workers.dev');
  });

  it('비어 있으면 API는 같은 출처, 결과 링크는 현재 주소', () => {
    expect(apiBase({})).toBe('');
    expect(apiBase({ VITE_API_BASE: '  ' })).toBe('');
    expect(resultBase({}, 'https://driver-labor.workers.dev')).toBe(
      'https://driver-labor.workers.dev',
    );
  });

  it('앱에서 결과 링크가 localhost로 만들어지지 않으려면 설정이 필요하다', () => {
    // 설정이 없으면 WebView 주소가 그대로 들어간다(M8 이전 동작).
    expect(resultBase({}, 'https://localhost')).toBe('https://localhost');
    expect(
      resultBase({ VITE_RESULT_BASE: 'https://driver-labor.workers.dev' }, 'https://localhost'),
    ).toBe('https://driver-labor.workers.dev');
  });
});
