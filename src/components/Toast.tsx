import { useEffect } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export function Toast() {
  const error = useAppStore((state) => state.error);
  const notice = useAppStore((state) => state.notice);
  const dismissError = useAppStore((state) => state.dismissError);
  const dismissNotice = useAppStore((state) => state.dismissNotice);

  const message = error ?? notice;
  const isError = Boolean(error);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => {
      if (isError) dismissError();
      else dismissNotice();
    }, isError ? 7000 : 4500);
    return () => window.clearTimeout(timeout);
  }, [message, isError, dismissError, dismissNotice]);

  if (!message) return null;

  return (
    <div
      className={`toast ${isError ? 'toast--error' : 'toast--success'}`}
      role={isError ? 'alert' : 'status'}
    >
      {isError ? (
        <XCircle size={18} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={18} aria-hidden="true" />
      )}
      <span>{message}</span>
      <button
        type="button"
        className="toast__close"
        aria-label="关闭提示"
        onClick={isError ? dismissError : dismissNotice}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
