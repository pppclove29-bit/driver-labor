import { describe, expect, it, vi } from 'vitest';

import { shareResult, type SharePorts } from './share.js';

const TEXT = '[집→Gangneung] 나 님 운전 정산 도착 · 괘씸자 1명 감지됨 🚨';
const URL_ = 'https://driver-labor.workers.dev/r#v1.abc';

describe('결과 링크 공유', () => {
  it('앱이면 공유 시트를 쓴다', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    const webShare = vi.fn();
    const copy = vi.fn();
    const ports: SharePorts = { nativeShare, webShare, copy };
    expect(await shareResult(TEXT, URL_, ports)).toBe('shared');
    expect(nativeShare).toHaveBeenCalledWith({ text: TEXT, url: URL_ });
    expect(webShare).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });

  it('앱이 아니면 Web Share, 그것도 없으면 복사', async () => {
    const webShare = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(TEXT, URL_, { webShare, copy: vi.fn() })).toBe('shared');

    const copy = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(TEXT, URL_, { copy })).toBe('copied');
    expect(copy).toHaveBeenCalledWith(`${TEXT}\n${URL_}`);
  });

  it('사용자가 공유를 취소하면 복사하지 않는다', async () => {
    const copy = vi.fn();
    const abort = Object.assign(new Error('취소'), { name: 'AbortError' });
    const nativeShare = vi.fn().mockRejectedValue(abort);
    expect(await shareResult(TEXT, URL_, { nativeShare, copy })).toBe('shared');
    expect(copy).not.toHaveBeenCalled();
  });

  it('공유가 실패하면 복사로 넘어간다', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    const nativeShare = vi.fn().mockRejectedValue(new Error('no activity'));
    expect(await shareResult(TEXT, URL_, { nativeShare, copy })).toBe('copied');
    expect(copy).toHaveBeenCalled();
  });
});
