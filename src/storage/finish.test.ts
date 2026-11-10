import { describe, expect, it } from 'vitest';
import { applyFinishedGame } from './finish';
import {
  createDefaultProfile,
  normalizeProfile,
  type HistoryRecord,
} from './schemas';

function record(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    gameId: 'game-1',
    result: 'lost',
    boardSize: 4,
    score: 100,
    bestTile: 64,
    moves: 20,
    startedAt: '2026-01-01T10:00:00.000Z',
    endedAt: '2026-01-01T10:05:00.000Z',
    cells: [
      [2, 4, 8, 16],
      [32, 64, 2, 4],
      [8, 16, 32, 64],
      [2, 4, 8, 16],
    ],
    ...overrides,
  };
}

describe('finished game accounting', () => {
  it('updates lifetime stats and history once', () => {
    const first = applyFinishedGame(createDefaultProfile(), [], record());
    expect(first.profile.stats.gamesPlayed).toBe(1);
    expect(first.profile.stats.gamesWon).toBe(0);
    expect(first.profile.stats.bestScore).toBe(100);
    expect(first.profile.stats.bestTile).toBe(64);
    expect(first.history).toHaveLength(1);

    const retry = applyFinishedGame(first.profile, first.history, record());
    expect(retry.profile.stats.gamesPlayed).toBe(1);
    expect(retry.profile.stats.gamesWon).toBe(0);
    expect(retry.history).toHaveLength(1);
  });

  it('counts a won game and keeps the highest score', () => {
    const first = applyFinishedGame(createDefaultProfile(), [], record({ score: 500 }));
    const second = applyFinishedGame(
      first.profile,
      first.history,
      record({
        gameId: 'game-2',
        result: 'won',
        score: 300,
        bestTile: 2048,
        endedAt: '2026-01-02T10:00:00.000Z',
      }),
    );

    expect(second.profile.stats.gamesPlayed).toBe(2);
    expect(second.profile.stats.gamesWon).toBe(1);
    expect(second.profile.stats.bestScore).toBe(500);
    expect(second.profile.stats.bestTile).toBe(2048);
    expect(second.history[0].gameId).toBe('game-2');
  });

  it('caps history at 200 records', () => {
    const records: HistoryRecord[] = Array.from({ length: 200 }, (_, index) =>
      record({
        gameId: `old-${index}`,
        endedAt: new Date(2026, 0, 1, 0, index).toISOString(),
      }),
    );
    const result = applyFinishedGame(
      createDefaultProfile(),
      records,
      record({ gameId: 'new', endedAt: '2026-02-01T00:00:00.000Z' }),
    );

    expect(result.history).toHaveLength(200);
    expect(result.history[0].gameId).toBe('new');
    expect(result.history.some((item) => item.gameId === 'old-0')).toBe(false);
    expect(result.history.some((item) => item.gameId === 'old-199')).toBe(true);
  });
});

describe('profile normalization', () => {
  it('fills missing settings and stats with defaults', () => {
    const profile = normalizeProfile({
      settings: { theme: 'dark' },
      stats: { bestScore: 42 },
      lastFinishedGameId: 'g',
    });

    expect(profile.settings.theme).toBe('dark');
    expect(profile.settings.soundVolume).toBe(0.4);
    expect(profile.stats.bestScore).toBe(42);
    expect(profile.stats.gamesPlayed).toBe(0);
    expect(profile.lastFinishedGameId).toBe('g');
  });

  it('falls back to defaults for invalid input', () => {
    const profile = normalizeProfile(null);
    expect(profile.settings.theme).toBe('system');
    expect(profile.stats.bestScore).toBe(0);
  });
});
