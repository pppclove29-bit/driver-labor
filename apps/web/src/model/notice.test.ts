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

  it('폰에만 남는 것과 서버로 가는 값만 알린다. 위치 이야기는 없다', () => {
    const text = NOTICE_LINES.join(' ');
    expect(text).toContain('이 폰에만 저장돼요');
    expect(text).toContain('장소 검색어');
    expect(text).not.toContain('위치');
  });
});
