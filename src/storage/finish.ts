import {
  HISTORY_LIMIT,
  type HistoryRecord,
  type Profile,
} from './schemas';

export interface FinishResult {
  profile: Profile;
  history: HistoryRecord[];
}

export function applyFinishedGame(
  profile: Profile,
  history: HistoryRecord[],
  record: HistoryRecord,
): FinishResult {
  const records = [
    record,
    ...history.filter((item) => item.gameId !== record.gameId),
  ]
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .slice(0, HISTORY_LIMIT);

  const nextProfile: Profile = {
    ...profile,
    settings: { ...profile.settings },
    stats: { ...profile.stats },
    lastFinishedGameId: profile.lastFinishedGameId,
  };

  nextProfile.stats.bestScore = Math.max(nextProfile.stats.bestScore, record.score);
  nextProfile.stats.bestTile = Math.max(nextProfile.stats.bestTile, record.bestTile);

  if (profile.lastFinishedGameId !== record.gameId) {
    nextProfile.stats.gamesPlayed += 1;
    if (record.result === 'won') nextProfile.stats.gamesWon += 1;
    nextProfile.lastFinishedGameId = record.gameId;
  }

  return { profile: nextProfile, history: records };
}
