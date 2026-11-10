import { ArrowRight, Home, RotateCcw, Save, Trophy } from 'lucide-react';
import type { GameState } from '../game/engine';

interface GameOverlayProps {
  overlay: 'win' | 'gameover';
  game: GameState;
  pendingRecord: boolean;
  saveError: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onRetry: () => void;
  onHome: () => void;
  onHistory: () => void;
}

export function GameOverlay({
  overlay,
  game,
  pendingRecord,
  saveError,
  onContinue,
  onNewGame,
  onRetry,
  onHome,
  onHistory,
}: GameOverlayProps) {
  const isWin = overlay === 'win';
  const achieved = isWin || game.hasWon;
  const maxTile = game.tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
  const blocked = pendingRecord && !saveError;

  return (
    <div className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={`result-card ${isWin ? 'result-card--win' : ''}`}>
        <div className="result-card__badge">
          {achieved ? <Trophy size={24} aria-hidden="true" /> : <Home size={24} aria-hidden="true" />}
        </div>
        <span className="eyebrow">
          {isWin ? 'MILESTONE' : achieved ? 'CHALLENGE COMPLETE' : 'GAME OVER'}
        </span>
        <h2 id="result-title">{isWin ? '达成 2048！' : achieved ? '挑战结束' : '本局结束'}</h2>
        <p className="result-card__copy">
          {isWin
            ? '漂亮。你可以继续挑战更大的数字，或者开一局新的。'
            : achieved
              ? '你已经达成过 2048。这一局没有可移动的方向了，成绩已为你整理。'
              : '没有可移动的方向了。这局的成绩已经为你整理好。'}
        </p>

        <div className="result-stats">
          <div>
            <span>得分</span>
            <strong>{game.score.toLocaleString('zh-CN')}</strong>
          </div>
          <div>
            <span>最大方块</span>
            <strong>{maxTile}</strong>
          </div>
          <div>
            <span>步数</span>
            <strong>{game.moves}</strong>
          </div>
        </div>

        {saveError ? (
          <div className="result-card__save-error" role="alert">
            <span>成绩还没有保存成功。</span>
            <button type="button" className="text-button" onClick={onRetry}>
              <Save size={15} aria-hidden="true" />
              重试保存
            </button>
          </div>
        ) : null}

        <div className="result-card__actions">
          {isWin ? (
            <>
              <button type="button" className="button button--primary" onClick={onContinue}>
                继续挑战
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button type="button" className="button button--secondary" onClick={onNewGame}>
                新游戏
              </button>
              <button type="button" className="button button--ghost" onClick={onHome}>
                返回首页
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="button button--primary"
                onClick={onNewGame}
                disabled={pendingRecord}
              >
                <RotateCcw size={17} aria-hidden="true" />
                再来一局
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={onHistory}
                disabled={pendingRecord}
              >
                查看记录
              </button>
              <button type="button" className="button button--ghost" onClick={onHome}>
                返回首页
              </button>
            </>
          )}
        </div>
        {blocked ? <p className="result-card__hint">正在保存成绩…</p> : null}
      </div>
    </div>
  );
}
