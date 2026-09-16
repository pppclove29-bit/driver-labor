import { LINK_VERSION } from '@dl/link-codec';

// 결과 보기 페이지. 링크의 # 뒤 데이터를 풀어 영수증을 그린다 (M4).
// 모든 값은 textContent로만 출력한다. innerHTML을 쓰지 않는다
// (CLAUDE.md 절대 규칙 3).

const root = document.getElementById('receipt');
if (!root) {
  throw new Error('#receipt 엘리먼트를 찾지 못했습니다');
}

const line = (text: string): HTMLParagraphElement => {
  const el = document.createElement('p');
  el.textContent = text;
  return el;
};

const heading = document.createElement('h1');
heading.textContent = '정산 결과';
root.append(heading);
root.append(line('M0 · 모노레포 뼈대'));
root.append(line(`링크 형식 버전: ${LINK_VERSION}`));
root.append(line('영수증 표시는 M4에서 만듭니다.'));
