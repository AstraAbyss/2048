import { useState } from 'react';
import {
  ArrowRight,
  History as HistoryIcon,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatRelativeTime, maxCellValue } from '../lib/format';
import { useAppStore } from '../store/appStore';

export function HomePage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const history = useAppStore((state) => state.history);
  const busy = useAppStore((state) => state.busy);
  const newGame = useAppStore((state) => state.newGame);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const bestScore = Math.max(profile.stats.bestScore, session?.score ?? 0);
  const currentMax = session ? maxCellValue(session.cells) : 0;
  const hasProgress = Boolean(session && session.moves > 0);

  const startNewGame = async () => {
    setConfirmOpen(false);
    const started = await newGame();
    if (started) navigate('/game');
  };

  const requestNewGame = () => {
    if (hasProgress && profile.settings.confirmNewGame) {
      setConfirmOpen(true);
      return;
    }
    void startNewGame();
  };

  return (
    <div className="page home-page">
      <header className="home-header">
        <div>
          <span className="eyebrow">OFFLINE NUMBER PUZZLE</span>
          <h1 className="logo">2048</h1>
        </div>
        <div className="home-header__side">
          <div className="best-card">
            <span>最高分</span>
            <strong>{bestScore.toLocaleString('zh-CN')}</strong>
          </div>
          <Link to="/settings" className="icon-button" aria-label="打开设置">
            <SettingsIcon size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <p className="home-lede">
        滑动方块，让相同数字相遇。每一步都会自动保存，随时可以回来继续。
      </p>

      {session ? (
        <section className={`continue-card ${session.status === 'won' ? 'continue-card--won' : ''}`}>
          <div className="continue-card__top">
            <span className="continue-card__label">
              {session.status === 'won' ? (
                <>
                  <Trophy size={15} aria-hidden="true" />
                  已达成 2048
                </>
              ) : (
                <>
                  <Sparkles size={15} aria-hidden="true" />
                  正在进行的对局
                </>
              )}
            </span>
            <span className="continue-card__time">{formatRelativeTime(session.updatedAt)}</span>
          </div>
          <div className="continue-card__score">
            <strong>{session.score.toLocaleString('zh-CN')}</strong>
            <span>分</span>
          </div>
          <div className="continue-card__meta">
            <span>最大方块 {currentMax}</span>
            <span>{session.moves} 步</span>
          </div>
          <Link to="/game" className="button button--primary button--wide">
            <Play size={17} aria-hidden="true" />
            {session.status === 'won' ? '继续挑战' : '继续游戏'}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <section className="start-card">
          <div className="start-card__badge">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <h2>从两个方块开始</h2>
          <p>合出 2048，然后继续挑战更大的数字。无需登录，完全离线。</p>
          <button
            type="button"
            className="button button--primary button--wide"
            onClick={requestNewGame}
            disabled={busy}
          >
            <Play size={17} aria-hidden="true" />
            开始新游戏
          </button>
        </section>
      )}

      <div className="home-actions">
        <button
          type="button"
          className="action-tile"
          onClick={requestNewGame}
          disabled={busy}
        >
          <span className="action-tile__icon">
            <RotateCcw size={20} aria-hidden="true" />
          </span>
          <span>
            <strong>新游戏</strong>
            <small>{session ? '保留当前进度到历史' : '开始一局新的 2048'}</small>
          </span>
        </button>
        <Link to="/history" className="action-tile">
          <span className="action-tile__icon">
            <HistoryIcon size={20} aria-hidden="true" />
          </span>
          <span>
            <strong>历史记录</strong>
            <small>{history.length > 0 ? `最近 ${history.length} 局成绩` : '还没有历史成绩'}</small>
          </span>
        </Link>
      </div>

      <section className="stats-strip" aria-label="游戏统计">
        <div>
          <span>已完成</span>
          <strong>{profile.stats.gamesPlayed}</strong>
          <small>局</small>
        </div>
        <div>
          <span>获胜</span>
          <strong>{profile.stats.gamesWon}</strong>
          <small>局</small>
        </div>
        <div>
          <span>最大方块</span>
          <strong>{profile.stats.bestTile || '—'}</strong>
        </div>
      </section>

      <footer className="home-footer">
        {profile.settings.showKeyboardHints ? (
          <p>
            方向键 / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动 · 自动保存
          </p>
        ) : (
          <p>每一步都会自动保存</p>
        )}
        <Link to="/settings" className="text-link">
          调整主题与音效
        </Link>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        title="开始新游戏？"
        description={
          session
            ? '当前对局会进入历史记录，然后从两个新方块开始。'
            : '当前对局会进入历史记录。'
        }
        confirmLabel="开始新游戏"
        busy={busy}
        onConfirm={() => void startNewGame()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
