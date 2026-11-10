import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { toCells, type Direction, type GameState, type Tile } from '../game/engine';

interface BoardProps {
  game: GameState;
  mergedIds: number[];
  mergeSeq: number;
  spawnedId: number | null;
  spawnSeq: number;
  disabled?: boolean;
  onDirection: (direction: Direction) => void;
}

interface Layout {
  cell: number;
  gap: number;
}

const INITIAL_LAYOUT: Layout = { cell: 64, gap: 10 };

function tileFontSize(value: number, cell: number): number {
  if (value >= 1024) return Math.max(16, cell * 0.3);
  if (value >= 128) return Math.max(17, cell * 0.35);
  return Math.max(18, cell * 0.43);
}

interface TileViewProps {
  tile: Tile;
  layout: Layout;
  mergePulse: number;
  spawned: boolean;
}

function TileView({ tile, layout, mergePulse, spawned }: TileViewProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const { cell, gap } = layout;
  const x = gap + tile.col * (cell + gap);
  const y = gap + tile.row * (cell + gap);

  useEffect(() => {
    if (document.documentElement.dataset.motion === 'reduced') return;
    const element = innerRef.current;
    if (!element) return;
    element.animate(
      [
        { opacity: 0, transform: 'scale(0.55)' },
        { opacity: 1, transform: 'scale(1.04)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 150, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }, []);

  useEffect(() => {
    if (mergePulse <= 0 || document.documentElement.dataset.motion === 'reduced') return;
    const element = innerRef.current;
    if (!element) return;
    element.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.16)', offset: 0.45 },
        { transform: 'scale(1)' },
      ],
      { duration: 190, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }, [mergePulse]);

  useEffect(() => {
    if (!spawned || document.documentElement.dataset.motion === 'reduced') return;
    const element = innerRef.current;
    if (!element) return;
    element.animate(
      [
        { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.5)' },
        { boxShadow: '0 0 0 8px rgba(255, 255, 255, 0)' },
      ],
      { duration: 280, easing: 'ease-out' },
    );
  }, [spawned]);

  return (
    <div
      className="tile"
      style={{
        width: cell,
        height: cell,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      aria-hidden="true"
    >
      <div
        ref={innerRef}
        className={`tile__inner ${tile.value > 2048 ? 'tile__inner--super' : ''}`}
        data-value={tile.value}
        style={{ fontSize: tileFontSize(tile.value, cell) }}
      >
        {tile.value}
      </div>
    </div>
  );
}

export function Board({
  game,
  mergedIds,
  mergeSeq,
  spawnedId,
  spawnSeq,
  disabled = false,
  onDirection,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const [layout, setLayout] = useState<Layout>(INITIAL_LAYOUT);

  useLayoutEffect(() => {
    const element = boardRef.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth;
      if (!width) return;
      const gap = Math.max(8, Math.round(width * 0.022));
      const cell = Math.max(1, (width - gap * 5) / 4);
      setLayout((previous) =>
        Math.abs(previous.cell - cell) < 0.5 && previous.gap === gap
          ? previous
          : { cell, gap },
      );
    };

    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const cells = toCells(game);
  const mergedSet = new Set(mergedIds);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.focus();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; dragging still works without it.
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || disabled) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const threshold = Math.max(18, layout.cell * 0.18);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      onDirection(dx > 0 ? 'right' : 'left');
    } else {
      onDirection(dy > 0 ? 'down' : 'up');
    }
  };

  return (
    <div
      ref={boardRef}
      className={`board ${disabled ? 'board--disabled' : ''}`}
      role="grid"
      aria-label="2048 棋盘，使用方向键、WASD 或滑动移动方块"
      aria-rowcount={4}
      aria-colcount={4}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      {cells.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => {
          const x = layout.gap + colIndex * (layout.cell + layout.gap);
          const y = layout.gap + rowIndex * (layout.cell + layout.gap);
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="board-cell"
              role="gridcell"
              aria-label={`第 ${rowIndex + 1} 行第 ${colIndex + 1} 列，${
                value ?? '空'
              }`}
              style={{
                width: layout.cell,
                height: layout.cell,
                transform: `translate3d(${x}px, ${y}px, 0)`,
              }}
            />
          );
        }),
      )}

      {[...game.tiles]
        .sort((a, b) => a.id - b.id)
        .map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            layout={layout}
            mergePulse={mergedSet.has(tile.id) ? mergeSeq : 0}
            spawned={tile.id === spawnedId && spawnSeq > 0}
          />
        ))}
    </div>
  );
}
