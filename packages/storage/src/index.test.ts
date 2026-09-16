import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from './index.js';

describe('@dl/storage', () => {
  it('패키지가 로드된다', () => {
    expect(PACKAGE_NAME).toBe('@dl/storage');
  });
});
