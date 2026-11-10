import { describe, expect, it } from 'vitest';
import {
  canMove,
  createGame,
  move,
  stateFromCells,
  toCells,
  type Cells,
} from './engine';

function emptyRow(): Cells[number] {
  return [null, null, null, null];
}

function boardWithFirstRow(row: Cells[number]): Cells {
  return [row, emptyRow(), emptyRow(), emptyRow()];
}

describe('2048 engine', () => {
  it('merges each tile at most once per move', () => {
    const state = stateFromCells(boardWithFirstRow([2, 2, 2, 2]), {
      seed: 'merge',
      rngState: 1,
    });
    const result = move(state, 'left', { spawn: false });

    expect(result.moved).toBe(true);
    expect(result.scoreDelta).toBe(8);
    expect(toCells(result.state)[0]).toEqual([4, 4, null, null]);
  });

  it('does not chain a newly merged tile', () => {
    const state = stateFromCells(boardWithFirstRow([2, 2, 4, null]), {
      seed: 'chain',
      rngState: 1,
    });
    const result = move(state, 'left', { spawn: false });

    expect(toCells(result.state)[0]).toEqual([4, 4, null, null]);
    expect(result.scoreDelta).toBe(4);
  });

  it('handles multiple merges and scoring', () => {
    const state = stateFromCells(boardWithFirstRow([4, 4, 8, 8]), {
      seed: 'score',
      rngState: 1,
    });
    const result = move(state, 'left', { spawn: false });

    expect(toCells(result.state)[0]).toEqual([8, 16, null, null]);
    expect(result.scoreDelta).toBe(24);
    expect(result.state.score).toBe(24);
    expect(result.state.moves).toBe(1);
  });

  it('keeps tiles in place for an invalid move', () => {
    const state = stateFromCells(
      [
        [null, null, 2, 4],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      { seed: 'invalid', rngState: 77 },
    );
    const before = toCells(state);
    const result = move(state, 'right', { spawn: true });

    expect(result.moved).toBe(false);
    expect(result.spawnedTileId).toBeNull();
    expect(toCells(result.state)).toEqual(before);
    expect(result.state.rngState).toBe(77);
  });

  it('spawns exactly one new tile after a valid move', () => {
    const state = stateFromCells(boardWithFirstRow([null, 2, null, null]), {
      seed: 'spawn',
      rngState: 123,
    });
    const result = move(state, 'left', { spawn: true });

    expect(result.moved).toBe(true);
    expect(result.spawnedTileId).not.toBeNull();
    expect(result.state.tiles).toHaveLength(2);
    expect(result.state.tiles.some((tile) => tile.id === result.spawnedTileId)).toBe(true);
  });

  it('detects a full board with no possible moves', () => {
    const state = stateFromCells(
      [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      { seed: 'over', rngState: 9 },
    );

    expect(canMove(state)).toBe(false);
    const result = move(state, 'left');
    expect(result.moved).toBe(false);
    expect(result.gameOver).toBe(true);
  });

  it('does not declare game over when a merge exists', () => {
    const state = stateFromCells(
      [
        [2, 2, 4, 8],
        [4, 8, 16, 32],
        [2, 4, 8, 16],
        [4, 8, 16, 32],
      ],
      { seed: 'merge-over', rngState: 9 },
    );

    expect(canMove(state)).toBe(true);
  });

  it('triggers victory once at 2048 and keeps the game playable', () => {
    const state = stateFromCells(
      [
        [1024, 1024, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      { seed: 'win', rngState: 44 },
    );
    const result = move(state, 'left', { spawn: false });

    expect(result.reached2048).toBe(true);
    expect(result.state.hasWon).toBe(true);
    expect(result.state.status).toBe('won');
    expect(toCells(result.state)[0][0]).toBe(2048);

    const continued = { ...result.state, status: 'playing' as const };
    const next = move(continued, 'right', { spawn: false });
    expect(next.reached2048).toBe(false);
    expect(next.state.hasWon).toBe(true);
  });

  it('restores the random sequence from a saved state', () => {
    const game = createGame('deterministic-seed');
    const first = move(game, 'left');
    const saved = {
      cells: toCells(first.state),
      score: first.state.score,
      moves: first.state.moves,
      status: first.state.status,
      hasWon: first.state.hasWon,
      seed: first.state.seed,
      rngState: first.state.rngState,
      nextTileId: first.state.nextTileId,
    };
    const restored = stateFromCells(saved.cells, saved);
    const a = move(restored, 'down');
    const b = move(first.state, 'down');

    expect(toCells(a.state)).toEqual(toCells(b.state));
    expect(a.state.rngState).toBe(b.state.rngState);
    expect(a.state.score).toBe(b.state.score);
  });

  it('creates a game with two tiles', () => {
    const game = createGame('initial');
    expect(game.tiles).toHaveLength(2);
    expect(game.tiles.every((tile) => tile.value === 2 || tile.value === 4)).toBe(true);
    expect(game.score).toBe(0);
    expect(game.moves).toBe(0);
  });
});
