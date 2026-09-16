// S10b 광고 카드. 계산 등록 1회당 결과 화면 맨 아래에 1개만.
// 결과를 가리거나 기다리게 하지 않는다. 실패하면 아무것도 표시하지 않는다.
// 실제 광고 스크립트는 매체 심사 뒤에 붙인다. 지금은 자리표시 카드다.

export function AdCard({ onClose }: { onClose: () => void }) {
  return (
    <section
      className="card"
      style={{ marginTop: 8, marginBottom: 'calc(var(--tap) + 8px)' }}
      aria-label="광고"
    >
      <div className="split">
        <span className="tag">광고</span>
        <button type="button" className="btn btn--ghost" aria-label="광고 닫기" onClick={onClose}>
          ✕
        </button>
      </div>
      <p className="dim" style={{ margin: 0 }}>
        광고 자리입니다. 매체 심사를 통과하면 여기에 카드 1개가 붙습니다. 소리·자동 재생은 쓰지
        않습니다.
      </p>
    </section>
  );
}
