// 스토어 아이콘은 512×512 PNG이고 투명 배경이면 Play가 받지 않는다.
// 앱 아이콘(apps/web/public/icon-512.png)을 그대로 스토어에 올린다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const icon = new Uint8Array(
  readFileSync(new URL('../../web/public/icon-512.png', import.meta.url)),
);
const view = new DataView(icon.buffer, icon.byteOffset, icon.byteLength);
const ascii = (from: number, to: number): string => String.fromCharCode(...icon.slice(from, to));

/** PNG 헤더(IHDR)에서 크기와 색 방식을 읽는다. colorType 4·6이면 알파 채널이 있다. */
function header(): { width: number; height: number; colorType: number } {
  expect([...icon.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(ascii(12, 16)).toBe('IHDR');
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    colorType: view.getUint8(25),
  };
}

describe('스토어 아이콘', () => {
  it('512×512 PNG다', () => {
    const { width, height } = header();
    expect([width, height]).toEqual([512, 512]);
  });

  it('투명 배경이 아니다(Play가 거부한다)', () => {
    const { colorType } = header();
    expect([4, 6]).not.toContain(colorType); // 4=회색+알파, 6=RGBA
    // 팔레트 이미지의 투명도 청크(tRNS)도 없어야 한다
    const bytes = ascii(0, icon.length);
    expect(bytes.includes('tRNS')).toBe(false);
  });
});
