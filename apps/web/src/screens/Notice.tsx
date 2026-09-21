// 첫 실행 고지. 동의를 받는 화면이 아니라 무엇이 어디에 남는지 알리는 화면이다.
// 위치 권한 동의는 운전 중 잠금(M10)에서 권한 요청 앞에 따로 받는다.

import { NOTICE_LINES, STORAGE_LINE } from '../model/notice.js';
import { Card, Screen } from '../ui/parts.jsx';

export function Notice({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Screen
      title="시작하기 전에"
      sub="무엇이 어디에 남는지 먼저 알려 드려요"
      bottom={
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          확인했어요
        </button>
      }
    >
      <Card>
        {NOTICE_LINES.map((line) => (
          <p key={line} style={{ margin: '0 0 12px' }}>
            {line}
          </p>
        ))}
      </Card>
      <p className="screen__sub">{STORAGE_LINE}</p>
    </Screen>
  );
}
