// S11 결과 보기. 링크를 받은 사람의 질문은 "그래서 내가 얼마야?" 하나다.
// 외부 스크립트·광고·분석 도구 없음. 모든 값은 textContent로만 출력한다
// (CLAUDE.md 절대 규칙 3). 서버 요청도 하지 않는다.

import {
  decodeResult,
  ERROR_MESSAGES,
  FIXED_NOTICE,
  isAllowedPayLink,
  justification,
  LinkError,
  PAY_NOTICE,
  reasonPhrase,
} from '@dl/link-codec';
import type { LinkPayload, LinkPerson } from '@dl/link-codec';

const container = document.getElementById('receipt');
if (!container) {
  throw new Error('#receipt 엘리먼트를 찾지 못했습니다');
}
const root: HTMLElement = container;

const OPENED_KEY = 'dl.openedName';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function issuedAt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getFullYear())}년 ${String(d.getMonth() + 1)}월 ${String(d.getDate())}일 발급`;
}

function showError(kind: LinkError['kind']): void {
  root.replaceChildren(el('h1', 'title', '정산 결과'), el('p', 'notice', ERROR_MESSAGES[kind]));
}

/** 계산 근거. 이름을 탭하면 펼친다. */
function basis(payload: LinkPayload, person: LinkPerson, index: number): HTMLElement {
  const box = el('div', 'basis');
  box.append(el('p', 'row', `공통비 ${won(person.c)}`));
  box.append(
    el(
      'p',
      'row',
      index === payload.driver ? `받을 수고비 ${won(-person.l)}` : `수고비 ${won(person.l)}`,
    ),
  );
  if (person.p > 0) box.append(el('p', 'row', `낸 돈 ${won(person.p)}`));

  for (const code of person.r) {
    box.append(el('p', 'reason', reasonPhrase(code, payload.tone)));
  }

  if (payload.segments.length > 0) {
    box.append(el('p', 'label', '구간'));
    payload.segments.forEach((seg, i) => {
      const distance = (seg.d / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
      box.append(
        el(
          'p',
          'row dim',
          `${String(i + 1)}. ${distance}km · ${String(seg.t)}분 · ${String(seg.n)}명 · ` +
            `유류 ${won(seg.f)} + 통행료 ${won(seg.o)} · 수고비 ${won(seg.l)}` +
            (seg.x > 1 ? ` · 난이도 ${seg.x.toFixed(2)}` : ''),
        ),
      );
    });
  }
  return box;
}

function personRow(payload: LinkPayload, person: LinkPerson, index: number): HTMLElement {
  const item = el('section', 'person');
  const head = el('button', 'person__head');
  head.type = 'button';

  const name = el('span', 'person__name', person.n);
  const amount = el(
    'span',
    'person__amount',
    person.b >= 0 ? `받을 돈 ${won(person.b)}` : `보낼 돈 ${won(-person.b)}`,
  );
  head.append(name, amount);

  const detail = basis(payload, person, index);
  detail.hidden = true;

  head.addEventListener('click', () => {
    detail.hidden = !detail.hidden;
    head.setAttribute('aria-expanded', String(!detail.hidden));
    try {
      if (detail.hidden) localStorage.removeItem(OPENED_KEY);
      else localStorage.setItem(OPENED_KEY, person.n);
    } catch {
      // 저장이 막힌 브라우저에서도 화면은 그대로 동작한다.
    }
  });
  head.setAttribute('aria-expanded', 'false');

  let remembered: string | null;
  try {
    remembered = localStorage.getItem(OPENED_KEY);
  } catch {
    remembered = null;
  }
  if (remembered === person.n) {
    detail.hidden = false;
    head.setAttribute('aria-expanded', 'true');
  }

  item.append(head, detail);
  return item;
}

/** 송금 버튼. 페이지가 형식을 다시 검증하고, 아니면 버튼을 만들지 않는다. */
function payButton(payload: LinkPayload): HTMLElement | undefined {
  const url = payload.pay;
  if (!url || !isAllowedPayLink(url)) return undefined;

  const driver = payload.people[payload.driver];
  const owed = payload.people.filter((p) => p.b < 0);
  const box = el('section', 'pay');

  const link = el('a', 'pay__button', `${driver?.n ?? '운전자'}에게 송금`);
  link.href = url;
  link.rel = 'noreferrer noopener';
  box.append(link);

  if (owed.length === 1) {
    const amount = -(owed[0]?.b ?? 0);
    const copy = el('button', 'pay__copy', '금액 복사');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      void navigator.clipboard.writeText(String(amount)).then(
        () => {
          copy.textContent = '복사했어요';
        },
        () => {
          copy.textContent = String(amount);
        },
      );
    });
    box.append(copy);
  }

  box.append(el('p', 'notice', PAY_NOTICE));
  return box;
}

function render(payload: LinkPayload): void {
  const driver = payload.people[payload.driver];
  const nodes: Node[] = [];

  nodes.push(el('h1', 'title', `${payload.from} → ${payload.to}`));
  nodes.push(el('p', 'sub', `운전 ${driver?.n ?? ''} · ${issuedAt(payload.at)}`));

  // 사람별 금액이 먼저. 3초 안에 "내가 얼마"를 볼 수 있어야 한다.
  for (const [i, person] of payload.people.entries()) nodes.push(personRow(payload, person, i));

  if (payload.taxi > 0) {
    nodes.push(
      el(
        'p',
        'saved',
        `택시였다면 ${won(payload.taxi)} · ${driver?.n ?? '운전자'} 덕분에 ${won(payload.saved)} 아꼈어요`,
      ),
    );
  }

  const pay = payButton(payload);
  if (pay) nodes.push(pay);

  const note = justification(payload.tone);
  if (note) nodes.push(el('p', 'justification', note));
  nodes.push(el('p', 'notice', FIXED_NOTICE));

  root.replaceChildren(...nodes);
}

async function main(): Promise<void> {
  const hash = location.hash.slice(1);
  if (hash.length === 0) {
    root.replaceChildren(
      el('h1', 'title', '정산 결과'),
      el('p', 'notice', '결과 링크로 열어주세요. 링크의 # 뒤에 결과가 들어 있어요.'),
    );
    return;
  }
  try {
    render(await decodeResult(hash));
  } catch (error) {
    showError(error instanceof LinkError ? error.kind : 'corrupt');
  }
}

void main();
window.addEventListener('hashchange', () => {
  void main();
});
