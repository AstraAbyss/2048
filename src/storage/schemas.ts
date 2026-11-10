import { z } from 'zod';

export const BOARD_SIZE = 4;
export const HISTORY_LIMIT = 200;

export type ThemeSetting = 'system' | 'light' | 'dark';
export type MotionSetting = 'system' | 'full' | 'reduced';
export type LaunchBehavior = 'home' | 'auto';

export interface Settings {
  theme: ThemeSetting;
  motion: MotionSetting;
  soundEnabled: boolean;
  soundVolume: number;
  confirmNewGame: boolean;
  launchBehavior: LaunchBehavior;
  showKeyboardHints: boolean;
}

export interface Stats {
  bestScore: number;
  bestTile: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface Profile {
  schemaVersion: 1;
  settings: Settings;
  stats: Stats;
  lastFinishedGameId: string | null;
}

export type GameResult = 'won' | 'lost' | 'abandoned';

export interface Session {
  schemaVersion: 1;
  gameId: string;
  boardSize: number;
  cells: Array<Array<number | null>>;
  score: number;
  moves: number;
  status: 'playing' | 'won';
  hasWon: boolean;
  seed: string;
  rngState: number;
  nextTileId: number;
  startedAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  gameId: string;
  result: GameResult;
  boardSize: number;
  score: number;
  bestTile: number;
  moves: number;
  startedAt: string;
  endedAt: string;
  cells: Array<Array<number | null>>;
}

export interface HistoryFile {
  schemaVersion: 1;
  records: HistoryRecord[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  motion: 'system',
  soundEnabled: true,
  soundVolume: 0.4,
  confirmNewGame: true,
  launchBehavior: 'home',
  showKeyboardHints: true,
};

const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  motion: z.enum(['system', 'full', 'reduced']),
  soundEnabled: z.boolean(),
  soundVolume: z.number().min(0).max(1),
  confirmNewGame: z.boolean(),
  launchBehavior: z.enum(['home', 'auto']),
  showKeyboardHints: z.boolean(),
});

const StatsSchema = z.object({
  bestScore: z.number().int().nonnegative(),
  bestTile: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  gamesWon: z.number().int().nonnegative(),
});

const CellsSchema = z
  .array(
    z
      .array(z.number().int().positive().nullable())
      .length(BOARD_SIZE),
  )
  .length(BOARD_SIZE);

export const SessionSchema = z.object({
  schemaVersion: z.literal(1),
  gameId: z.string().min(1),
  boardSize: z.literal(BOARD_SIZE),
  cells: CellsSchema,
  score: z.number().int().nonnegative(),
  moves: z.number().int().nonnegative(),
  status: z.enum(['playing', 'won']),
  hasWon: z.boolean(),
  seed: z.string().min(1),
  rngState: z.number().int().nonnegative(),
  nextTileId: z.number().int().positive(),
  startedAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const HistoryRecordSchema = z.object({
  gameId: z.string().min(1),
  result: z.enum(['won', 'lost', 'abandoned']),
  boardSize: z.literal(BOARD_SIZE),
  score: z.number().int().nonnegative(),
  bestTile: z.number().int().nonnegative(),
  moves: z.number().int().nonnegative(),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  cells: CellsSchema,
});

const HistoryFileSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(HistoryRecordSchema),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createDefaultProfile(): Profile {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS },
    stats: { bestScore: 0, bestTile: 0, gamesPlayed: 0, gamesWon: 0 },
    lastFinishedGameId: null,
  };
}

export function normalizeProfile(raw: unknown): Profile {
  const fallback = createDefaultProfile();
  if (!isRecord(raw)) return fallback;

  const settingsResult = SettingsSchema.partial().safeParse(raw.settings);
  const statsResult = StatsSchema.partial().safeParse(raw.stats);

  return {
    schemaVersion: 1,
    settings: {
      ...fallback.settings,
      ...(settingsResult.success ? settingsResult.data : {}),
    },
    stats: {
      ...fallback.stats,
      ...(statsResult.success ? statsResult.data : {}),
    },
    lastFinishedGameId:
      typeof raw.lastFinishedGameId === 'string' ? raw.lastFinishedGameId : null,
  };
}

export function parseSession(raw: unknown): Session | null {
  const result = SessionSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseHistory(raw: unknown): HistoryRecord[] {
  const result = HistoryFileSchema.safeParse(raw);
  if (!result.success) return [];
  return [...result.data.records]
    .filter((record, index, records) => records.findIndex((item) => item.gameId === record.gameId) === index)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .slice(0, HISTORY_LIMIT);
}

export function emptyHistory(): HistoryFile {
  return { schemaVersion: 1, records: [] };
}

export function toHistoryFile(records: HistoryRecord[]): HistoryFile {
  return {
    schemaVersion: 1,
    records: records
      .slice()
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      .slice(0, HISTORY_LIMIT),
  };
}
