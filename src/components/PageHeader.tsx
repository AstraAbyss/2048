import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  backTo?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, backTo = '/', actions }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="page-header">
      <button
        type="button"
        className="icon-button"
        aria-label="返回"
        onClick={() => navigate(backTo)}
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <div className="page-header__title">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
      </div>
      <div className="page-header__actions">
        {actions ?? (
          <Link to="/" className="mini-brand" aria-label="返回 2048 首页">
            2048
          </Link>
        )}
      </div>
    </header>
  );
}
