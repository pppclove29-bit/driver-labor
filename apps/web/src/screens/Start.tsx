// S2 출발. 버튼 하나짜리 화면이다. 도착지·동승자·경로는 여기서 묻지 않는다.
// 출발 직전에 입력을 요구하면 시작을 누르지 않게 된다 (decisions.md 입력 방식).

import { clock } from '../model/format.js';
import { Card, Screen } from '../ui/parts.jsx';

export function Start({ startedAt, onHome }: { startedAt: string; onHome: () => void }) {
  return (
    <Screen
      title="시작했어요"
      sub="도착해서 완료만 누르세요"
      bottom={
        <button type="button" className="btn btn--primary" onClick={onHome}>
          확인
        </button>
      }
    >
      <Card label="출발">
        <p className="huge" style={{ margin: 0 }}>
          {clock(startedAt)}
        </p>
        <p className="screen__sub" style={{ margin: 0 }}>
          이제 폰을 덮어도 됩니다. 운전 중에는 알림도 진동도 보내지 않아요.
        </p>
      </Card>
      <p className="screen__sub">
        도착지·인원·괘씸·결제는 도착한 뒤에 넣습니다. 시간은 앱이 재고 있어요.
      </p>
    </Screen>
  );
}
