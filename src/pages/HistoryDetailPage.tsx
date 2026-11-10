import { useState } from 'react';
import { Flag, Trophy, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MiniBoard } from '../components/MiniBoard';
import { PageHeader } from '../components/PageHeader';
import { formatFullDate } from '../lib/format';
import { useAppStore } from '../store/appStore';
import type { GameResult } from '../storage/schemas';

function resultLabel(result: GameResult): string {
  if (result === 'won') return '获胜';
  if (result === 'lost') return '未达成';
  return '已放弃';
}

function ResultIcon({ result }: { result: GameResult }) {
  if (result === 'won') return <Trophy size={16} aria-hidden="true" />;
  if (result === 'lost') return <XCircle size={16} aria-hidden="true" />;
  return <Flag size={16} aria-hidden="true" />;
}

export function HistoryDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const history = useAppStore((state) => state.history);
  const session = useAppStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);
  const busy = useAppStore((state) => state.busy);
  const newGame = useAppStore((state) => state.newGame);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const record = history.find((item) => item.gameId === gameId);

  const startNewGame = async () => {
    setConfirmOpen(false);
    const started = await newGame();
    if (started) navigate('/game');
  };

  const requestNewGame = () => {
    if (session && session.moves > 0 && profile.settings.confirmNewGame) {
      setConfirmOpen(true);
      return;
    }
    void startNewGame();
  };

  if (!record) {
    return (
      <div className="page detail-page">
        <PageHeader title="找不到这局记录" backTo="/history" />
        <div className="empty-state empty-state--large">
          <h2>记录可能已被删除</h2>
          <p>历史记录最多保留最近 200 局，也可能被手动清空。</p>
          <Link to="/history" className="button button--primary">
            返回历史记录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <PageHeader
        eyebrow="RUN DETAIL"
        title="对局详情"
        backTo="/history"
        actions={
          <span className={`result-badge result-badge--${record.result}`}>
            <ResultIcon result={record.result} />
            {resultLabel(record.result)}
          </span>
        }
      />

      <section className="detail-hero">
        <span className="detail-hero__date">{formatFullDate(record.endedAt)}</span>
        <div className="detail-hero__score">
          <strong>{record.score.toLocaleString('zh-CN')}</strong>
          <span>分</span>
        </div>
        <div className="detail-metrics">
          <div>
            <span>最大方块</span>
            <strong>{record.bestTile}</strong>
          </div>
          <div>
            <span>步数</span>
            <strong>{record.moves}</strong>
          </div>
          <div>
            <span>结果</span>
            <strong>{resultLabel(record.result)}</strong>
          </div>
        </div>
      </section>

      <section className="detail-board-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FINAL BOARD</span>
            <h2>终局棋盘</h2>
          </div>
          <span className="detail-board-section__hint">4 × 4</span>
        </div>
        <MiniBoard cells={record.cells} label="这局结束时的棋盘" />
      </section>

      <div className="detail-actions">
        <button type="button" className="button button--primary" onClick={requestNewGame} disabled={busy}>
          再来一局
        </button>
        <Link to="/history" className="button button--secondary">
          返回列表
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="开始新游戏？"
        description="当前正在进行的对局会进入历史记录，然后开始新的一局。"
        confirmLabel="开始新游戏"
        busy={busy}
        onConfirm={() => void startNewGame()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
