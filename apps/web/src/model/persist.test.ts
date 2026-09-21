import { describe, expect, it, vi } from 'vitest';

import { keepStorage } from './persist.js';

describe('저장소 유지 요청', () => {
  it('이미 유지 중이면 다시 요청하지 않는다', async () => {
    const persist = vi.fn();
    expect(await keepStorage({ persisted: async () => true, persist })).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('요청이 받아들여지면 persisted, 거절되면 denied', async () => {
    expect(await keepStorage({ persisted: async () => false, persist: async () => true })).toBe(
      'persisted',
    );
    expect(await keepStorage({ persisted: async () => false, persist: async () => false })).toBe(
      'denied',
    );
  });

  it('지원하지 않거나 오류가 나도 앱은 계속 간다', async () => {
    expect(await keepStorage(undefined)).toBe('unsupported');
    expect(await keepStorage({})).toBe('unsupported');
    expect(
      await keepStorage({
        persist: () => Promise.reject(new Error('보안 정책')),
      }),
    ).toBe('unsupported');
  });
});
