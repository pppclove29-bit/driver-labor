import { describe, expect, it } from 'vitest';

import { justification, penaltyReason, receiptTitle, shareText, TONES } from './tone.js';

describe('영수증 말투', () => {
  it('시간 항목은 분을, 횟수 항목은 횟수를 쓴다', () => {
    expect(penaltyReason('frontSeatSleep', 'spicy', 60, 1)).toContain('60분');
    expect(penaltyReason('navigate', 'business', 25, 1)).toContain('25분');
    // 혼자 먹기는 횟수 항목이다. 분(0)이 새어 나오면 안 된다.
    expect(penaltyReason('eatAlone', 'spicy', 0, 3)).toContain('3회');
    expect(penaltyReason('eatAlone', 'spicy', 0, 3)).not.toContain('0회');
    expect(penaltyReason('noisy', 'spicy', 0, 2)).toContain('2회');
    expect(penaltyReason('backseatDriving', 'business', 0, 1)).toContain('1회');
  });

  it('말투 세 가지 모두 문구가 있다', () => {
    for (const { id } of TONES) {
      expect(penaltyReason('litter', id, 0, 1).length).toBeGreaterThan(0);
      expect(receiptTitle(id).length).toBeGreaterThan(0);
    }
  });

  it('명분 문구는 비즈니스에서 표시하지 않는다', () => {
    expect(justification('mild')).toBeTruthy();
    expect(justification('spicy')).toBeTruthy();
    expect(justification('business')).toBeUndefined();
  });

  it('공유 본문에는 괘씸자 이름이 없고 인원수만 들어간다', () => {
    const text = shareText('spicy', '경포해변', 2);
    expect(text).toContain('2명');
    expect(shareText('spicy', '경포해변', 0)).not.toContain('명 감지');
    expect(shareText('mild', '경포해변', 2)).toContain('경포해변');
    expect(shareText('business', '경포해변', 2)).toContain('경포해변');
  });
});
