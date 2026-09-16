// M4 완료 기준: 정상·손상·위조(스크립트 삽입, 계좌번호, 허용 외 URL, 압축 폭탄) 링크 테스트.

import { describe, expect, it } from 'vitest';

import {
  decodeResult,
  encodeResult,
  isAllowedPayLink,
  LIMITS,
  LinkError,
  LINK_VERSION,
  PACKAGE_NAME,
  validatePayload,
} from './index.js';
import type { LinkPayload } from './index.js';

function 결과(부분: Partial<LinkPayload> = {}): LinkPayload {
  return {
    v: 1,
    from: '서울',
    to: '강릉',
    at: '2026-09-19T11:40:00+09:00',
    tone: 'mild',
    driver: 0,
    people: [
      { n: '민수', c: 11500, l: -29412, p: 40000, b: 57912, r: [] },
      { n: '지현', c: 11500, l: 11868, p: 0, b: -23368, r: ['frontSeatSleep'] },
      { n: '태호', c: 11500, l: 12384, p: 0, b: -23884, r: ['eatAlone', 'noisy'] },
      { n: '수빈', c: 5500, l: 5160, p: 0, b: -10660, r: [] },
    ],
    segments: [
      { n: 4, d: 120000, t: 90, f: 17000, o: 5000, l: 15480, x: 1 },
      { n: 3, d: 108000, t: 60, f: 14850, o: 3150, l: 10320, x: 1 },
    ],
    taxi: 265000,
    actual: 69412,
    saved: 195588,
    ...부분,
  };
}

describe('@dl/link-codec', () => {
  it('패키지가 로드되고 버전은 v1이다', () => {
    expect(PACKAGE_NAME).toBe('@dl/link-codec');
    expect(LINK_VERSION).toBe('v1');
  });
});

describe('정상 링크', () => {
  it('넣은 결과를 그대로 되돌린다', async () => {
    const fragment = await encodeResult(결과());
    expect(fragment.startsWith('v1.')).toBe(true);
    expect(await decodeResult(fragment)).toEqual(결과());
  });

  it('#과 전체 URL에서도 읽는다', async () => {
    const fragment = await encodeResult(결과());
    expect(await decodeResult(`#${fragment}`)).toEqual(결과());
    expect(await decodeResult(`https://example.com/r#${fragment}`)).toEqual(결과());
  });

  it('메신저 호환을 위해 2,000자 안쪽이다', async () => {
    const fragment = await encodeResult(결과());
    expect(fragment.length).toBeLessThan(2000);
  });

  it('허용 형식의 송금 링크는 남는다', async () => {
    const fragment = await encodeResult(결과({ pay: 'https://toss.me/minsu' }));
    expect((await decodeResult(fragment)).pay).toBe('https://toss.me/minsu');
  });
});

describe('손상된 링크', () => {
  it('점이 없으면 형식 오류', async () => {
    await expect(decodeResult('abcdef')).rejects.toMatchObject({ kind: 'corrupt' });
  });

  it('내용이 없으면 형식 오류', async () => {
    await expect(decodeResult('v1.')).rejects.toMatchObject({ kind: 'corrupt' });
  });

  it('중간이 잘리면 손상으로 본다', async () => {
    const fragment = await encodeResult(결과());
    const 잘린링크 = fragment.slice(0, Math.floor(fragment.length * 0.6));
    await expect(decodeResult(잘린링크)).rejects.toBeInstanceOf(LinkError);
  });

  it('모르는 버전은 구분해서 알려준다', async () => {
    await expect(decodeResult('v9.abc')).rejects.toMatchObject({ kind: 'too-new' });
    await expect(decodeResult('x1.abc')).rejects.toMatchObject({ kind: 'corrupt' });
  });
});

describe('위조 링크', () => {
  it('스크립트를 넣어도 값으로만 남고, 페이지는 텍스트로만 출력한다', () => {
    // 이름 10자 제한에 걸려 대부분 거부된다.
    expect(() =>
      validatePayload(
        결과({
          people: [{ n: '<script>alert(1)</script>', c: 0, l: 0, p: 0, b: 0, r: [] }],
          driver: 0,
        }),
      ),
    ).toThrow(LinkError);
    // 10자 안쪽 태그는 통과하되 값일 뿐이다. 출력은 textContent로만 한다.
    const payload = validatePayload(
      결과({ people: [{ n: '<b>x</b>', c: 0, l: 0, p: 0, b: 0, r: [] }], driver: 0 }),
    );
    expect(payload.people[0]?.n).toBe('<b>x</b>');
  });

  it('계좌번호처럼 보이는 이름은 거부한다', () => {
    expect(() =>
      validatePayload(
        결과({ people: [{ n: '110-234-56', c: 0, l: 0, p: 0, b: 0, r: [] }], driver: 0 }),
      ),
    ).toThrow(LinkError);
  });

  it('허용 형식이 아닌 송금 링크는 버튼을 숨긴다', async () => {
    for (const bad of [
      'https://evil.example.com/pay',
      'javascript:alert(1)',
      'http://toss.me/minsu',
      'https://toss.me.evil.com/minsu',
      '110-234-567890',
      'https://qr.kakaopay.com/../../evil',
    ]) {
      expect(isAllowedPayLink(bad)).toBe(false);
      const fragment = await encodeResult(결과({ pay: bad }));
      expect((await decodeResult(fragment)).pay).toBeUndefined();
    }
  });

  it('허용 범위를 넘는 금액은 거부한다', () => {
    expect(() =>
      validatePayload(
        결과({ people: [{ n: '민수', c: 9_999_999, l: 0, p: 0, b: 0, r: [] }], driver: 0 }),
      ),
    ).toThrow(LinkError);
  });

  it('멤버 10명·구간 10개를 넘으면 거부한다', () => {
    const many = Array.from({ length: 11 }, () => ({ n: '가', c: 0, l: 0, p: 0, b: 0, r: [] }));
    expect(() => validatePayload(결과({ people: many }))).toThrow(LinkError);
    const segments = Array.from({ length: 11 }, () => ({
      n: 2,
      d: 1000,
      t: 10,
      f: 0,
      o: 0,
      l: 0,
      x: 1,
    }));
    expect(() => validatePayload(결과({ segments }))).toThrow(LinkError);
  });

  it('모르는 사유 코드는 거부한다', () => {
    expect(() =>
      validatePayload(
        결과({ people: [{ n: '민수', c: 0, l: 0, p: 0, b: 0, r: ['<img>'] as never }], driver: 0 }),
      ),
    ).toThrow(LinkError);
  });

  it('압축 폭탄은 해제 중에 끊는다', async () => {
    // 0으로 채운 1MB는 아주 잘 압축돼 링크 크기 상한은 통과하지만, 해제 상한에서 걸린다.
    const bomb = 'A'.repeat(1_000_000);
    const stream = new Blob([bomb]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    expect(encoded.length).toBeLessThan(LIMITS.encodedBytes);
    await expect(decodeResult(`v1.${encoded}`)).rejects.toMatchObject({ kind: 'too-large' });
  });
});
