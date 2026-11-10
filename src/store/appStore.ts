import { create } from 'zustand';
import {
  boardMax,
  canMove,
  createGame,
  move as applyMove,
  stateFromCells,
  toCells,
  type Direction,
  type GameState,
} from '../game/engine';
import { playGameOver, playMove, playWin } from '../lib/sound';
import { repository } from '../storage/repository';
import {
  createDefaultProfile,
  type GameResult,
  type HistoryRecord,
  type Profile,
  type Session,
  type Settings,
} from '../storage/schemas';

type Overlay = 'win' | 'gameover' | null;

interface AppState {
  hydrated: boolean;
  initializing: boolean;
  busy: boolean;
  profile: Profile;
  session: Session | null;
  game: GameState | null;
  history: HistoryRecord[];
  overlay: Overlay;
  lastResult: HistoryRecord | null;
  pendingRecord: HistoryRecord | null;
  error: string | null;
  notice: string | null;
  mergeSeq: number;
  mergedIds: number[];
  spawnedId: number | null;
  spawnSeq: number;
  init: () => Promise<void>;
  newGame: () => Promise<boolean>;
  move: (direction: Direction) => Promise<void>;
  continueAfterWin: () => Promise<void>;
  retryFinish: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  clearHistory: () => Promise<void>;
  resetAll: () => Promise<void>;
  flush: () => Promise<void>;
  dismissError: () => void;
  dismissNotice: () => void;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function updatedAt(): string {
  return new Date().toISOString();
}

function maxCellValue(cells: Array<Array<number | null>>): number {
  return cells.reduce<number>(
    (max, row) =>
      row.reduce<number>(
        (rowMax, value) => (value ? Math.max(rowMax, value) : rowMax),
        max,
      ),
    0,
  );
}

function gameFromSession(session: Session): GameState {
  return stateFromCells(session.cells, {
    score: session.score,
    moves: session.moves,
    status: session.status,
    hasWon: session.hasWon,
    seed: session.seed,
    rngState: session.rngState,
    nextTileId: session.nextTileId,
  });
}

function sessionFromGame(game: GameState, previous?: Session | null): Session {
  const now = updatedAt();
  return {
    schemaVersion: 1,
    gameId: previous?.gameId ?? createId(),
    boardSize: game.boardSize,
    cells: toCells(game),
    score: game.score,
    moves: game.moves,
    status: game.status,
    hasWon: game.hasWon,
    seed: game.seed,
    rngState: game.rngState,
    nextTileId: game.nextTileId,
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
  };
}

function recordFromSession(
  session: Session,
  result: Exclude<GameResult, 'won'>,
): HistoryRecord {
  return {
    gameId: session.gameId,
    result: session.hasWon ? 'won' : result,
    boardSize: session.boardSize,
    score: session.score,
    bestTile: maxCellValue(session.cells),
    moves: session.moves,
    startedAt: session.startedAt,
    endedAt: updatedAt(),
    cells: session.cells,
  };
}

function recordFromGame(
  game: GameState,
  session: Session,
  result: Exclude<GameResult, 'won'>,
): HistoryRecord {
  return {
    ...recordFromSession(session, result),
    bestTile: boardMax(game.tiles),
    cells: toCells(game),
  };
}

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback}：${error.message}`;
  return fallback;
}

export const useAppStore = create<AppState>((set, get) => {
  let sessionQueue: Promise<void> = Promise.resolve();
  let profileQueue: Promise<void> = Promise.resolve();

  const trackSession = (session: Session): Promise<void> => {
    const run = sessionQueue.then(() => repository.saveSession(session));
    sessionQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const trackProfile = (profile: Profile): Promise<void> => {
    const run = profileQueue.then(() => repository.saveProfile(profile));
    profileQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const flush = async (): Promise<void> => {
    await Promise.all([sessionQueue, profileQueue]);
  };

  const archive = async (
    session: Session,
    result: Exclude<GameResult, 'won'>,
  ): Promise<HistoryRecord> => {
    const record = recordFromSession(session, result);
    await flush();
    const saved = await repository.finishGame(record);
    set({
      profile: saved.profile,
      history: saved.history,
      session: null,
      lastResult: record,
      pendingRecord: null,
      error: null,
    });
    return record;
  };

  const finishAfterMove = async (game: GameState, session: Session): Promise<void> => {
    const record = recordFromGame(game, session, 'lost');
    set({ overlay: 'gameover', lastResult: record, pendingRecord: record });
    try {
      await flush();
      const saved = await repository.finishGame(record);
      set({
        profile: saved.profile,
        history: saved.history,
        session: null,
        pendingRecord: null,
        error: null,
      });
    } catch (error) {
      console.error(error);
      set({
        error: '成绩保存失败，请重试。',
        pendingRecord: record,
      });
    }
  };

  return {
    hydrated: false,
    initializing: false,
    busy: false,
    profile: createDefaultProfile(),
    session: null,
    game: null,
    history: [],
    overlay: null,
    lastResult: null,
    pendingRecord: null,
    error: null,
    notice: null,
    mergeSeq: 0,
    mergedIds: [],
    spawnedId: null,
    spawnSeq: 0,

    init: async () => {
      if (get().hydrated || get().initializing) return;
      set({ initializing: true });

      let loadError: unknown = null;
      const [profileResult, sessionResult, historyResult] = await Promise.allSettled([
        repository.loadProfile(),
        repository.loadSession(),
        repository.loadHistory(),
      ]);

      if (profileResult.status === 'rejected') loadError = profileResult.reason;
      if (sessionResult.status === 'rejected') loadError = sessionResult.reason;
      if (historyResult.status === 'rejected') loadError = historyResult.reason;

      let profile =
        profileResult.status === 'fulfilled' && profileResult.value
          ? profileResult.value
          : createDefaultProfile();
      let history =
        historyResult.status === 'fulfilled' ? historyResult.value : [];
      let session =
        sessionResult.status === 'fulfilled' ? sessionResult.value : null;
      let game = session ? gameFromSession(session) : null;
      let overlay: Overlay = null;
      let notice: string | null = null;
      let error: string | null = loadError
        ? '部分本地数据读取失败，已使用可用数据继续。'
        : null;
      let pendingRecord: HistoryRecord | null = null;
      let profileChanged = false;

      if (session && game) {
        const bestScore = Math.max(profile.stats.bestScore, session.score);
        const bestTile = Math.max(profile.stats.bestTile, boardMax(game.tiles));
        if (
          bestScore !== profile.stats.bestScore ||
          bestTile !== profile.stats.bestTile
        ) {
          profile = {
            ...profile,
            stats: { ...profile.stats, bestScore, bestTile },
          };
          profileChanged = true;
        }
      }

      if (session && game && !canMove(game)) {
        const record = recordFromSession(session, 'lost');
        try {
          const saved = await repository.finishGame(record);
          profile = saved.profile;
          history = saved.history;
          notice = '上一局已结束，成绩已保存到历史记录。';
          session = null;
          game = null;
        } catch (saveError) {
          console.error(saveError);
          error = '上一局已经结束，但成绩保存失败。';
          overlay = 'gameover';
          pendingRecord = record;
          notice = null;
        }
      } else if (session && game?.status === 'won') {
        overlay = 'win';
      }

      set({
        hydrated: true,
        initializing: false,
        profile,
        history,
        session,
        game,
        overlay,
        notice,
        error,
        pendingRecord,
        lastResult: pendingRecord,
      });

      if (profileChanged) {
        void trackProfile(profile).catch((saveError) => {
          console.error(saveError);
          set({ error: '最高分保存失败。' });
        });
      }

      if (profileResult.status === 'fulfilled' && profileResult.value === null) {
        void trackProfile(profile).catch((saveError) => {
          console.error(saveError);
          set({ error: '设置初始化失败，但游戏仍可继续。' });
        });
      }
    },

    newGame: async () => {
      if (get().busy) return false;
      if (get().pendingRecord) {
        set({ error: '请先重试保存上一局成绩。' });
        return false;
      }

      set({ busy: true });
      try {
        const current = get().session;
        if (current && current.moves > 0) {
          await archive(current, 'abandoned');
        } else if (current) {
          await repository.clearSession();
        }

        const game = createGame();
        const session = sessionFromGame(game);
        set({
          game,
          session,
          overlay: null,
          lastResult: null,
          pendingRecord: null,
          error: null,
          busy: false,
          mergeSeq: 0,
          mergedIds: [],
          spawnedId: null,
          spawnSeq: 0,
        });
        void trackSession(session).catch((saveError) => {
          console.error(saveError);
          set({ error: '新对局进度保存失败，请检查存储权限。' });
        });
        return true;
      } catch (error) {
        console.error(error);
        set({
          busy: false,
          error: messageFor(error, '无法开始新游戏'),
        });
        return false;
      }
    },

    move: async (direction) => {
      const state = get();
      if (!state.game || state.overlay || state.busy || state.pendingRecord) return;
      const result = applyMove(state.game, direction);
      if (!result.moved) return;

      const session = sessionFromGame(result.state, state.session);
      const bestScore = Math.max(state.profile.stats.bestScore, result.state.score);
      const bestTile = Math.max(state.profile.stats.bestTile, boardMax(result.state.tiles));
      const profileChanged =
        bestScore !== state.profile.stats.bestScore ||
        bestTile !== state.profile.stats.bestTile;
      const profile = profileChanged
        ? {
            ...state.profile,
            stats: {
              ...state.profile.stats,
              bestScore,
              bestTile,
            },
          }
        : state.profile;

      set({
        game: result.state,
        session,
        profile,
        mergeSeq: state.mergeSeq + 1,
        mergedIds: result.mergedTileIds,
        spawnedId: result.spawnedTileId,
        spawnSeq: state.spawnSeq + 1,
      });

      void trackSession(session).catch((saveError) => {
        console.error(saveError);
        set({ error: '进度保存失败，请继续操作后将自动重试。' });
      });
      if (profileChanged) {
        void trackProfile(profile).catch((saveError) => {
          console.error(saveError);
          set({ error: '最高分保存失败。' });
        });
      }

      const volume = profile.settings.soundEnabled ? profile.settings.soundVolume : 0;
      playMove(result.mergedTileIds.length > 0, volume);

      if (result.gameOver) {
        playGameOver(volume);
        await finishAfterMove(result.state, session);
        return;
      }

      if (result.reached2048) {
        playWin(volume);
        set({ overlay: 'win' });
      }
    },

    continueAfterWin: async () => {
      const { game, session, overlay } = get();
      if (!game || !session || overlay !== 'win') return;
      const resumed: GameState = { ...game, status: 'playing' };
      const nextSession = sessionFromGame(resumed, session);
      set({ game: resumed, session: nextSession, overlay: null });
      try {
        await trackSession(nextSession);
      } catch (error) {
        console.error(error);
        set({ error: '继续游戏时保存失败，请稍后重试。' });
      }
    },

    retryFinish: async () => {
      const record = get().pendingRecord;
      if (!record) return;
      set({ error: null });
      try {
        await flush();
        const saved = await repository.finishGame(record);
        set({
          profile: saved.profile,
          history: saved.history,
          session: null,
          pendingRecord: null,
          error: null,
        });
      } catch (error) {
        console.error(error);
        set({ error: '成绩仍未保存，请检查存储权限后重试。' });
      }
    },

    updateSettings: async (patch) => {
      const previous = get().profile;
      const profile = {
        ...previous,
        settings: { ...previous.settings, ...patch },
      };
      set({ profile });
      try {
        await trackProfile(profile);
      } catch (error) {
        console.error(error);
        set({ error: '设置保存失败。' });
      }
    },

    clearHistory: async () => {
      try {
        await flush();
        await repository.clearHistory();
        set({ history: [], error: null, notice: '历史记录已清空。' });
      } catch (error) {
        console.error(error);
        set({ error: '清空历史记录失败，请重试。' });
      }
    },

    resetAll: async () => {
      if (get().busy) return;
      set({ busy: true });
      try {
        await flush();
        await repository.resetAll();
        const profile = createDefaultProfile();
        await repository.saveProfile(profile);
        set({
          profile,
          session: null,
          game: null,
          history: [],
          overlay: null,
          lastResult: null,
          pendingRecord: null,
          error: null,
          notice: '所有本地数据已重置。',
          busy: false,
          mergeSeq: 0,
          mergedIds: [],
          spawnedId: null,
          spawnSeq: 0,
        });
      } catch (error) {
        console.error(error);
        set({ busy: false, error: '重置数据失败，请重试。' });
      }
    },

    flush,

    dismissError: () => set({ error: null }),
    dismissNotice: () => set({ notice: null }),
  };
});
