import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toast } from './components/Toast';
import { isTauri } from './storage/repository';
import { useAppStore } from './store/appStore';
import { GamePage } from './pages/GamePage';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';

function useColorScheme() {
  const theme = useAppStore((state) => state.profile.settings.theme);
  const motion = useAppStore((state) => state.profile.settings.motion);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolvedTheme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolvedTheme === 'dark' ? '#171614' : '#faf8ef');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const reduced = motion === 'reduced' || (motion === 'system' && media.matches);
      document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [motion]);
}

function AppLoading() {
  return (
    <div className="app-loading">
      <div className="app-loading__mark">2048</div>
      <span>正在恢复本地进度…</span>
    </div>
  );
}

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated);
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const init = useAppStore((state) => state.init);
  const navigate = useNavigate();
  const location = useLocation();
  const autoResumed = useRef(false);

  useColorScheme();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!hydrated || autoResumed.current) return;
    autoResumed.current = true;
    if (
      profile.settings.launchBehavior === 'auto' &&
      session &&
      location.pathname === '/'
    ) {
      navigate('/game', { replace: true });
    }
  }, [hydrated, profile.settings.launchBehavior, session, location.pathname, navigate]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void useAppStore.getState().flush();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const currentWindow = getCurrentWindow();
      let closing = false;
      const stop = await currentWindow.onCloseRequested(async (event) => {
        if (closing) return;
        event.preventDefault();
        closing = true;
        try {
          await useAppStore.getState().flush();
          await currentWindow.close();
        } catch (error) {
          closing = false;
          console.error(error);
        }
      });
      if (disposed) stop();
      else unlisten = stop;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!hydrated) return <AppLoading />;

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:gameId" element={<HistoryDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </div>
  );
}
