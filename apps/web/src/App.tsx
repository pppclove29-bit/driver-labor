import { PACKAGE_NAME as CALC } from '@dl/calc';
import { LINK_VERSION } from '@dl/link-codec';
import { PACKAGE_NAME as STORAGE } from '@dl/storage';

// M0 뼈대 확인용 화면. 실제 화면(S1 홈, S2 새 여행 …)은 M2에서 만든다.
export function App() {
  return (
    <main>
      <h1>운전 노동 정산기</h1>
      <p>M0 · 모노레포 뼈대</p>
      <ul>
        <li>계산 엔진: {CALC}</li>
        <li>저장소: {STORAGE}</li>
        <li>결과 링크 형식: {LINK_VERSION}</li>
      </ul>
      <p>
        결과 보기 페이지: <a href="/r">/r</a>
      </p>
    </main>
  );
}
