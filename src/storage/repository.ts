import { invoke } from '@tauri-apps/api/core';
import { applyFinishedGame } from './finish';
import {
  createDefaultProfile,
  emptyHistory,
  normalizeProfile,
  parseHistory,
  parseSession,
  toHistoryFile,
  type HistoryRecord,
  type Profile,
  type Session,
} from './schemas';

export interface FinishResult {
  profile: Profile;
  history: HistoryRecord[];
}

export interface AppRepository {
  loadProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  loadSession(): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  clearSession(): Promise<void>;
  loadHistory(): Promise<HistoryRecord[]>;
  finishGame(record: HistoryRecord): Promise<FinishResult>;
  clearHistory(): Promise<void>;
  resetAll(): Promise<void>;
}

const PROFILE_KEY = 'game2048.profile.v1';
const SESSION_KEY = 'game2048.session.v1';
const HISTORY_KEY = 'game2048.history.v1';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class TauriRepository implements AppRepository {
  async loadProfile(): Promise<Profile | null> {
    const raw = await invoke<unknown | null>('load_profile');
    return raw === null ? null : normalizeProfile(raw);
  }

  async saveProfile(profile: Profile): Promise<void> {
    await invoke('save_profile', { profile });
  }

  async loadSession(): Promise<Session | null> {
    const raw = await invoke<unknown | null>('load_session');
    if (raw === null) return null;
    const session = parseSession(raw);
    if (!session) throw new Error('存档格式无效');
    return session;
  }

  async saveSession(session: Session): Promise<void> {
    await invoke('save_session', { session });
  }

  async clearSession(): Promise<void> {
    await invoke('clear_session');
  }

  async loadHistory(): Promise<HistoryRecord[]> {
    const raw = await invoke<unknown | null>('load_history');
    return raw === null ? [] : parseHistory(raw);
  }

  async finishGame(record: HistoryRecord): Promise<FinishResult> {
    const raw = await invoke<{ profile: unknown; history: unknown }>('finish_game', {
      record,
    });
    return {
      profile: normalizeProfile(raw.profile),
      history: parseHistory(raw.history),
    };
  }

  async clearHistory(): Promise<void> {
    await invoke('clear_history');
  }

  async resetAll(): Promise<void> {
    await invoke('reset_all');
  }
}

function readStorage(key: string): unknown {
  const text = localStorage.getItem(key);
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

function writeStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

class BrowserRepository implements AppRepository {
  async loadProfile(): Promise<Profile | null> {
    const raw = readStorage(PROFILE_KEY);
    return raw === null ? null : normalizeProfile(raw);
  }

  async saveProfile(profile: Profile): Promise<void> {
    writeStorage(PROFILE_KEY, profile);
  }

  async loadSession(): Promise<Session | null> {
    const raw = readStorage(SESSION_KEY);
    if (raw === null) return null;
    return parseSession(raw);
  }

  async saveSession(session: Session): Promise<void> {
    writeStorage(SESSION_KEY, session);
  }

  async clearSession(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async loadHistory(): Promise<HistoryRecord[]> {
    const raw = readStorage(HISTORY_KEY);
    return raw === null ? [] : parseHistory(raw);
  }

  async finishGame(record: HistoryRecord): Promise<FinishResult> {
    const profile = (await this.loadProfile()) ?? createDefaultProfile();
    const history = await this.loadHistory();
    const result = applyFinishedGame(profile, history, record);
    writeStorage(HISTORY_KEY, toHistoryFile(result.history));
    writeStorage(PROFILE_KEY, result.profile);
    localStorage.removeItem(SESSION_KEY);
    return result;
  }

  async clearHistory(): Promise<void> {
    writeStorage(HISTORY_KEY, emptyHistory());
  }

  async resetAll(): Promise<void> {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }
}

export function createRepository(): AppRepository {
  return isTauri() ? new TauriRepository() : new BrowserRepository();
}

export const repository: AppRepository = createRepository();
