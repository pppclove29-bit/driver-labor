import { describe, expect, it } from 'vitest';

import { LINK_VERSION, PACKAGE_NAME } from './index.js';

describe('@dl/link-codec', () => {
  it('패키지가 로드된다', () => {
    expect(PACKAGE_NAME).toBe('@dl/link-codec');
  });

  it('링크 형식 버전은 v1이다', () => {
    expect(LINK_VERSION).toBe('v1');
  });
});
