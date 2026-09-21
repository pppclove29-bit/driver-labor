import { describe, expect, it, vi } from 'vitest';

import { SAVE_FAILED_MESSAGE, trySave } from './saving.js';

describe('저장 실패 알림', () => {
  it('저장에 성공하면 알리지 않는다', async () => {
    const onFail = vi.fn();
    expect(await trySave(async () => undefined, onFail)).toBe(true);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('저장이 실패하면 무엇을 해야 할지 알려준다', async () => {
    const onFail = vi.fn();
    const full = Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    expect(await trySave(() => Promise.reject(full), onFail)).toBe(false);
    expect(onFail).toHaveBeenCalledWith(SAVE_FAILED_MESSAGE);
    expect(SAVE_FAILED_MESSAGE).toContain('저장 공간');
  });

  it('Error가 아닌 것을 던져도 앱은 멈추지 않는다', async () => {
    const onFail = vi.fn();
    expect(await trySave(() => Promise.reject('보안 정책'), onFail)).toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
  });
});
