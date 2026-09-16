// 화면 공통 조각. 터치 영역 48px, 주요 숫자 24px 이상은 index.css 토큰이 맡는다.

import type { ReactNode } from 'react';

export function Screen({
  title,
  sub,
  onBack,
  children,
  bottom,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  children: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <div className="screen">
      <header className="screen__head">
        {onBack ? (
          <button type="button" className="btn btn--ghost" onClick={onBack} aria-label="뒤로">
            ‹
          </button>
        ) : null}
        <div>
          <h1 className="screen__title">{title}</h1>
          {sub ? <p className="screen__sub">{sub}</p> : null}
        </div>
      </header>
      {children}
      {bottom ? <div className="bottom">{bottom}</div> : null}
    </div>
  );
}

export function Card({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="card">
      {label ? <p className="card__label">{label}</p> : null}
      {children}
    </section>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

/** 기본값으로 계산한 항목 표시. 받는 사람도 추정치임을 알 수 있게 한다. */
export function DefaultTag() {
  return <span className="tag">기본값</span>;
}
