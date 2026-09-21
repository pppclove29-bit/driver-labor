// 결과 페이지가 보여주는 고정 문장. 받는 사람이 읽는 유일한 텍스트라 값이 흔들리면 안 된다.
import { describe, expect, it } from 'vitest';

import {
  ERROR_MESSAGES,
  FIXED_NOTICE,
  justification,
  PAY_NOTICE,
  reasonPhrase,
} from './phrases.js';
import { REASON_CODES, TONE_CODES } from './schema.js';

describe('결과 페이지 문구', () => {
  it('괘씸·감면 코드 전부가 말투 3종 문구를 가진다', () => {
    for (const code of REASON_CODES) {
      for (const tone of TONE_CODES) {
        const phrase = reasonPhrase(code, tone);
        expect(phrase, `${code}/${tone}`).toBeTruthy();
        expect(phrase.length, `${code}/${tone}`).toBeGreaterThan(1);
      }
    }
  });

  it('같은 코드라도 말투마다 문구가 다르다', () => {
    for (const code of REASON_CODES) {
      // "기타"는 메모를 링크에 싣지 않아 말투와 무관하게 한 단어다(CLAUDE.md 절대 규칙 1).
      if (code === 'etc') continue;
      const phrases = TONE_CODES.map((t) => reasonPhrase(code, t));
      expect(new Set(phrases).size, code).toBe(TONE_CODES.length);
    }
  });

  it('"기타"는 말투와 무관하게 한 단어다(메모를 링크에 싣지 않는다)', () => {
    for (const tone of TONE_CODES) expect(reasonPhrase('etc', tone)).toBe('기타');
  });

  it('문구에 이름·금액 자리표시가 들어가지 않는다', () => {
    // 링크는 사유를 코드로만 나르고 자유 텍스트를 옮기지 않는다.
    for (const code of REASON_CODES) {
      for (const tone of TONE_CODES) {
        expect(reasonPhrase(code, tone)).not.toMatch(/\{|\}|\$|원\b/);
      }
    }
  });

  it('명분 문구는 비즈니스 말투에서 표시하지 않는다', () => {
    expect(justification('mild')).toBeTruthy();
    expect(justification('spicy')).toBeTruthy();
    expect(justification('business')).toBeUndefined();
  });

  it('고정 안내는 계산 근거와 확인 요청을 모두 담는다', () => {
    // 이 문장은 말투와 무관하게 늘 같다 (architecture.md 결과 링크 악용 막기).
    expect(FIXED_NOTICE).toContain('자동 계산했어요');
    expect(FIXED_NOTICE).toContain('링크를 만든 사람이 입력한 값');
    expect(FIXED_NOTICE).toContain('송금 전에 확인하세요');
    expect(PAY_NOTICE).toContain('받는 사람');
  });

  it('오류 문구는 네 가지 경우를 모두 덮고 무엇을 해야 할지 알려준다', () => {
    const keys = Object.keys(ERROR_MESSAGES).sort();
    expect(keys).toEqual(['corrupt', 'invalid', 'too-large', 'too-new']);
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).toMatch(/다시 요청하세요|새로고침하세요/);
    }
  });
});
