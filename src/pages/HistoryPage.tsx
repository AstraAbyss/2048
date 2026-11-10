import { useMemo, useState } from 'react';
import { ChevronRight, Flag, History as HistoryIcon, Trophy, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MiniBoard } from '../components/MiniBoard';
import { PageHeader } from '../components/PageHeader';
import { formatDate } from '../lib/format';
import { useAppStore } from '../store/appStore';
import type { GameResult, HistoryRecord } from '../storage/schemas';

const FILTERS: Array<{ id: 'all' | GameResult; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'won', label: '获胜' },
  { id: 'lost', label: '未达成' },
  { id: 'abandoned', label: '已放弃' },
];

function resultLabel(result: GameResult): string {
  if (result === 'won') return '获胜';
  if (result === 'lost') return '未达成';
  return '已放弃';
}

function ResultIcon({ result }: { result: GameResult }) {
  if (result === 'won') return <Trophy size={14} aria-hidden="true" />;
  if (result === 'lost') return <XCircle size={14} aria-hidden="true" />;
  return <Flag size={14} aria-hidden="true" />;
}

function HistoryCard({ record }: { record: HistoryRecord }) {
  return (
    <Link to={`/history/${record.gameId}`} className="history-card">
      <div className="history-card__main">
        <div className="history-card__top">
          <span className={`result-badge result-badge--${record.result}`}>
            <ResultIcon result={record.result} />
            {resultLabel(record.result)}
          </span>
          <span className="history-card__date">{formatDate(record.endedAt)}</span>
        </div>
        <div className="history-card__score">
          <strong>{record.score.toLocaleString('zh-CN')}</strong>
          <span>分</span>
        </div>
        <div className="history-card__meta">
          <span>最大 {record.bestTile}</span>
          <span>{record.moves} 步</span>
        </div>
      </div>
      <div className="history-card__board">
        <MiniBoard cells={record.cells} label={`${resultLabel(record.result)}的终局棋盘`} />
      </div>
      <ChevronRight size={18} className="history-card__chevron" aria-hidden="true" />
    </Link>
  );
}

export function HistoryPage() {
  const history = useAppStore((state) => state.history);
  const [filter, setFilter] = useState<'all' | GameResult>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? history : history.filter((record) => record.result === filter)),
    [filter, history],
  );

  return (
    <div className="page history-page">
      <PageHeader eyebrow="YOUR RUNS" title="历史记录" actions={<span className="count-pill">{history.length} 局</span>} />

      <p className="page-lede">
        每一局结束后自动归档。获胜、未达成和主动放弃的对局会分开标记，默认只保留最近 200 局。
      </p>

      <div className="filter-row" role="group" aria-label="按结果筛选">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`filter-chip ${filter === item.id ? 'filter-chip--active' : ''}`}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {history.length === 0 ? (
        <div className="empty-state empty-state--large">
          <div className="empty-state__icon">
            <HistoryIcon size={26} aria-hidden="true" />
          </div>
          <h2>还没有历史记录</h2>
          <p>完成一局后，得分、最大方块和终局棋盘会自动保存在这里。</p>
          <Link to="/" className="button button--primary">
            回到首页
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state empty-state--large">
          <h2>这个筛选下暂无记录</h2>
          <p>换一个结果类型看看。</p>
          <button type="button" className="button button--secondary" onClick={() => setFilter('all')}>
            查看全部
          </button>
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((record) => (
            <HistoryCard key={record.gameId} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
