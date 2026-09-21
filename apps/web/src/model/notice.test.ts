import { describe, expect, it } from 'vitest';

import { needsNotice, NOTICE_LINES, NOTICE_VERSION } from './notice.js';

describe('첫 실행 고지', () => {
  it('아직 못 봤으면 보여주고, 본 뒤에는 안 보여준다', () => {
    expect(needsNotice(undefined)).toBe(true);
    expect(needsNotice(NOTICE_VERSION)).toBe(false);
  });

  it('문구 버전을 올리면 다시 보여준다', () => {
    expect(needsNotice(NOTICE_VERSION - 1)).toBe(true);
  });

  it('위치는 폰 안에서만 쓰고 백그라운드를 쓰지 않는다고 적혀 있다', () => {
    const text = NOTICE_LINES.join(' ');
    expect(text).toContain('서버로 보내지 않아요');
    expect(text).toContain('백그라운드 위치는 쓰지 않아요');
  });
});
