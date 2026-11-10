export const BOARD_SIZE = 4;
export const WINNING_TILE = 2048;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'playing' | 'won';
export type Cell = number | null;
export type Cells = Cell[][];

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
}

export interface GameState {
  boardSize: number;
  tiles: Tile[];
  score: number;
  moves: number;
  status: GameStatus;
  hasWon: boolean;
  seed: string;
  rngState: number;
  nextTileId: number;
}

export interface MoveResult {
  state: GameState;
  moved: boolean;
  scoreDelta: number;
  mergedTileIds: number[];
  spawnedTileId: number | null;
  reached2048: boolean;
  gameOver: boolean;
}

interface RandomResult {
  value: number;
  state: number;
}

function nextRandom(state: number): RandomResult {
  let x = state >>> 0;
  if (x === 0) x = 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return { value: x / 0x100000000, state: x };
}

export function randomSeed(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 0x9e3779b9;
}

export function boardMax(tiles: Tile[]): number {
  return tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
}

export function toCells(state: GameState): Cells {
  const cells: Cells = Array.from({ length: state.boardSize }, () =>
    Array<Cell>(state.boardSize).fill(null),
  );
  for (const tile of state.tiles) {
    cells[tile.row][tile.col] = tile.value;
  }
  return cells;
}

export function cellsToTiles(cells: Cells, startId = 1): { tiles: Tile[]; nextTileId: number } {
  const tiles: Tile[] = [];
  let id = startId;
  for (let row = 0; row < cells.length; row += 1) {
    for (let col = 0; col < cells[row].length; col += 1) {
      const value = cells[row][col];
      if (value !== null && value > 0) {
        tiles.push({ id, value, row, col });
        id += 1;
      }
    }
  }
  return { tiles, nextTileId: id };
}

export function stateFromCells(
  cells: Cells,
  options: Partial<Omit<GameState, 'tiles' | 'boardSize'>> = {},
): GameState {
  const { tiles, nextTileId } = cellsToTiles(cells);
  return {
    boardSize: cells.length,
    tiles,
    score: options.score ?? 0,
    moves: options.moves ?? 0,
    status: options.status ?? 'playing',
    hasWon: options.hasWon ?? false,
    seed: options.seed ?? randomSeed(),
    rngState: options.rngState ?? hashSeed(options.seed ?? 'restored'),
    nextTileId: Math.max(options.nextTileId ?? nextTileId, nextTileId),
  };
}

function emptyCells(tiles: Tile[], size: number): Array<{ row: number; col: number }> {
  const occupied = new Set(tiles.map((tile) => `${tile.row}:${tile.col}`));
  const empty: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!occupied.has(`${row}:${col}`)) empty.push({ row, col });
    }
  }
  return empty;
}

function spawnTile(
  tiles: Tile[],
  size: number,
  rngState: number,
  nextTileId: number,
): { tile: Tile | null; rngState: number; nextTileId: number } {
  const empty = emptyCells(tiles, size);
  if (empty.length === 0) return { tile: null, rngState, nextTileId };
  const positionRandom = nextRandom(rngState);
  const valueRandom = nextRandom(positionRandom.state);
  const position = empty[Math.floor(positionRandom.value * empty.length)];
  const value = valueRandom.value < 0.9 ? 2 : 4;
  return {
    tile: { id: nextTileId, value, row: position.row, col: position.col },
    rngState: valueRandom.state,
    nextTileId: nextTileId + 1,
  };
}

export function createGame(seed = randomSeed()): GameState {
  let state: GameState = {
    boardSize: BOARD_SIZE,
    tiles: [],
    score: 0,
    moves: 0,
    status: 'playing',
    hasWon: false,
    seed,
    rngState: hashSeed(seed),
    nextTileId: 1,
  };

  for (let i = 0; i < 2; i += 1) {
    const spawned = spawnTile(state.tiles, state.boardSize, state.rngState, state.nextTileId);
    if (spawned.tile) state.tiles = [...state.tiles, spawned.tile];
    state.rngState = spawned.rngState;
    state.nextTileId = spawned.nextTileId;
  }

  return state;
}

function lineCoordinates(
  direction: Direction,
  lineIndex: number,
  size: number,
): Array<{ row: number; col: number }> {
  const coordinates: Array<{ row: number; col: number }> = [];
  for (let position = 0; position < size; position += 1) {
    switch (direction) {
      case 'left':
        coordinates.push({ row: lineIndex, col: position });
        break;
      case 'right':
        coordinates.push({ row: lineIndex, col: size - 1 - position });
        break;
      case 'up':
        coordinates.push({ row: position, col: lineIndex });
        break;
      case 'down':
        coordinates.push({ row: size - 1 - position, col: lineIndex });
        break;
    }
  }
  return coordinates;
}

function targetCoordinate(
  direction: Direction,
  lineIndex: number,
  position: number,
  size: number,
): { row: number; col: number } {
  switch (direction) {
    case 'left':
      return { row: lineIndex, col: position };
    case 'right':
      return { row: lineIndex, col: size - 1 - position };
    case 'up':
      return { row: position, col: lineIndex };
    case 'down':
      return { row: size - 1 - position, col: lineIndex };
  }
}

export function canMove(state: Pick<GameState, 'boardSize' | 'tiles'>): boolean {
  const { boardSize, tiles } = state;
  if (tiles.length < boardSize * boardSize) return true;
  const grid = new Map<string, number>();
  for (const tile of tiles) grid.set(`${tile.row}:${tile.col}`, tile.value);
  for (let row = 0; row < boardSize; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      const value = grid.get(`${row}:${col}`);
      if (value === undefined) return true;
      if (col + 1 < boardSize && grid.get(`${row}:${col + 1}`) === value) return true;
      if (row + 1 < boardSize && grid.get(`${row + 1}:${col}`) === value) return true;
    }
  }
  return false;
}

export function move(
  state: GameState,
  direction: Direction,
  options: { spawn?: boolean } = {},
): MoveResult {
  const shouldSpawn = options.spawn ?? true;
  const size = state.boardSize;
  const originalPositions = new Map(state.tiles.map((tile) => [tile.id, `${tile.row}:${tile.col}`]));
  const grid = new Map<string, Tile>();
  for (const tile of state.tiles) grid.set(`${tile.row}:${tile.col}`, tile);

  const finalTiles: Tile[] = [];
  const mergedTileIds: number[] = [];
  let scoreDelta = 0;

  for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
    const coordinates = lineCoordinates(direction, lineIndex, size);
    const line = coordinates
      .map(({ row, col }) => grid.get(`${row}:${col}`))
      .filter((tile): tile is Tile => Boolean(tile));

    let target = 0;
    for (let index = 0; index < line.length; index += 1) {
      const current = line[index];
      const next = line[index + 1];
      const position = targetCoordinate(direction, lineIndex, target, size);
      if (next && next.value === current.value) {
        const mergedValue = current.value * 2;
        finalTiles.push({
          id: next.id,
          value: mergedValue,
          row: position.row,
          col: position.col,
        });
        mergedTileIds.push(next.id);
        scoreDelta += mergedValue;
        index += 1;
      } else {
        finalTiles.push({
          ...current,
          row: position.row,
          col: position.col,
        });
      }
      target += 1;
    }
  }

  const moved =
    mergedTileIds.length > 0 ||
    finalTiles.some(
      (tile) => originalPositions.get(tile.id) !== `${tile.row}:${tile.col}`,
    );

  if (!moved) {
    return {
      state,
      moved: false,
      scoreDelta: 0,
      mergedTileIds: [],
      spawnedTileId: null,
      reached2048: false,
      gameOver: !canMove(state),
    };
  }

  let nextState: GameState = {
    ...state,
    tiles: finalTiles,
    score: state.score + scoreDelta,
    moves: state.moves + 1,
  };

  let spawnedTileId: number | null = null;
  if (shouldSpawn) {
    const spawned = spawnTile(
      nextState.tiles,
      nextState.boardSize,
      nextState.rngState,
      nextState.nextTileId,
    );
    if (spawned.tile) {
      nextState.tiles = [...nextState.tiles, spawned.tile];
      spawnedTileId = spawned.tile.id;
    }
    nextState.rngState = spawned.rngState;
    nextState.nextTileId = spawned.nextTileId;
  }

  const reached2048 = !state.hasWon && boardMax(nextState.tiles) >= WINNING_TILE;
  nextState = {
    ...nextState,
    hasWon: state.hasWon || reached2048,
    status: reached2048 ? 'won' : state.status,
  };

  return {
    state: nextState,
    moved: true,
    scoreDelta,
    mergedTileIds,
    spawnedTileId,
    reached2048,
    gameOver: !canMove(nextState),
  };
}
