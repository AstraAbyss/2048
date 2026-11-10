import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Home, RotateCcw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Board } from '../components/Board';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GameOverlay } from '../components/GameOverlay';
import type { Direction } from '../game/engine';
import { useAppStore } from '../store/appStore';

const KEY_DIRECTIONS: Record<string, Direction> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

export function GamePage() {
  const navigate = useNavigate();
  const game = useAppStore((state) => state.game);
  const session = useAppStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);
  const overlay = useAppStore((state) => state.overlay);
  const pendingRecord = useAppStore((state) => state.pendingRecord);
  const error = useAppStore((state) => state.error);
  const busy = useAppStore((state) => state.busy);
  const move = useAppStore((state) => state.move);
  const newGame = useAppStore((state) => state.newGame);
  const continueAfterWin = useAppStore((state) => state.continueAfterWin);
  const retryFinish = useAppStore((state) => state.retryFinish);
  const mergedIds = useAppStore((state) => state.mergedIds);
  const mergeSeq = useAppStore((state) => state.mergeSeq);
  const spawnedId = useAppStore((state) => state.spawnedId);
  const spawnSeq = useAppStore((state) => state.spawnSeq);

  const [locked, setLocked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const lockedRef = useRef(false);
  const unlockTimer = useRef<number | null>(null);

  const bestScore = Math.max(profile.stats.bestScore, game?.score ?? 0);

  useEffect(() => {
    if (!game) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmOpen || overlay) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]',
        )
      ) {
        return;
      }
      const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      if (lockedRef.current) return;
      lockedRef.current = true;
      setLocked(true);
      void move(direction).finally(() => {
        if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
        unlockTimer.current = window.setTimeout(() => {
          lockedRef.current = false;
          setLocked(false);
        }, 95);
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game, move, overlay, confirmOpen]);

  useEffect(
    () => () => {
      if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
    },
    [],
  );

  const requestNewGame = () => {
    if (
      session &&
      session.moves > 0 &&
      profile.settings.confirmNewGame
    ) {
      setConfirmOpen(true);
      return;
    }
    void startNewGame();
  };

  const startNewGame = async () => {
    const started = await newGame();
    if (started) setConfirmOpen(false);
  };

  if (!game) {
    return (
      <div className="page empty-page">
        <div className="empty-state">
          <div className="empty-state__icon">
            <Home size={24} aria-hidden="true" />
          </div>
          <h1>没有进行中的对局</h1>
          <p>先开始一局，或者回到首页继续其他操作。</p>
          <Link to="/" className="button button--primary">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page game-page">
      <header className="game-header">
        <button
          type="button"
          className="icon-button"
          aria-label="返回首页"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <Link to="/" className="game-brand" aria-label="2048 首页">
          2048
        </Link>
        <div className="score-row">
          <div className="score-card">
            <span>分数</span>
            <strong>{game.score.toLocaleString('zh-CN')}</strong>
          </div>
          <div className="score-card">
            <span>最高分</span>
            <strong>{bestScore.toLocaleString('zh-CN')}</strong>
          </div>
        </div>
        <span className="sr-only" aria-live="polite">
          当前分数 {game.score}，最高分 {bestScore}
        </span>
      </header>

      <Board
        game={game}
        mergedIds={mergedIds}
        mergeSeq={mergeSeq}
        spawnedId={spawnedId}
        spawnSeq={spawnSeq}
        disabled={Boolean(overlay) || locked}
        onDirection={(direction) => {
          if (lockedRef.current || overlay) return;
          lockedRef.current = true;
          setLocked(true);
          void move(direction).finally(() => {
            if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
            unlockTimer.current = window.setTimeout(() => {
              lockedRef.current = false;
              setLocked(false);
            }, 95);
          });
        }}
      />

      <footer className="game-footer">
        <div>
          <span className="game-footer__label">步数</span>
          <strong>{game.moves}</strong>
        </div>
        {profile.settings.showKeyboardHints ? (
          <span className="game-footer__hint">方向键 / WASD</span>
        ) : (
          <span className="game-footer__hint">滑动方块也可以移动</span>
        )}
        <button type="button" className="text-button" onClick={requestNewGame}>
          <RotateCcw size={15} aria-hidden="true" />
          重新开始
        </button>
      </footer>

      {overlay ? (
        <GameOverlay
          overlay={overlay}
          game={game}
          pendingRecord={Boolean(pendingRecord)}
          saveError={Boolean(pendingRecord && error)}
          onContinue={() => void continueAfterWin()}
          onNewGame={requestNewGame}
          onRetry={() => void retryFinish()}
          onHome={() => navigate('/')}
          onHistory={() => navigate('/history')}
        />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="重新开始？"
        description="当前对局会进入历史记录，然后从两个新方块开始。"
        confirmLabel="重新开始"
        busy={busy}
        onConfirm={() => void startNewGame()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
