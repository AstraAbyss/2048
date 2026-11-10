interface MiniBoardProps {
  cells: Array<Array<number | null>>;
  label?: string;
}

export function MiniBoard({ cells, label = '终局棋盘' }: MiniBoardProps) {
  return (
    <div className="mini-board" role="img" aria-label={label}>
      {cells.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => (
          <span
            key={`${rowIndex}-${colIndex}`}
            className={`mini-cell ${value ? `mini-cell--${value > 2048 ? 'super' : value}` : 'mini-cell--empty'}`}
          >
            {value ?? ''}
          </span>
        )),
      )}
    </div>
  );
}
