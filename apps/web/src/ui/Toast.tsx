// 되돌리기는 삭제 확인 팝업 대신 토스트의 "취소"(5초)로 한다 (spec-screens.md 공통 UI 규칙).

import { useEffect } from 'react';

export interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
}

export const TOAST_MS = 5000;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, onClose]);

  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.undo ? (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            toast.undo?.();
            onClose();
          }}
        >
          취소
        </button>
      ) : null}
    </div>
  );
}
