import { useState, type ReactNode } from 'react';
import {
  Database,
  Info,
  Moon,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { useAppStore } from '../store/appStore';
import type { LaunchBehavior, MotionSetting, ThemeSetting } from '../storage/schemas';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__item ${value === option.value ? 'segmented__item--active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row__copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </div>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const history = useAppStore((state) => state.history);
  const busy = useAppStore((state) => state.busy);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const resetAll = useAppStore((state) => state.resetAll);
  const [dialog, setDialog] = useState<'clear' | 'reset' | null>(null);

  const { settings, stats } = profile;

  const handleClearHistory = async () => {
    await clearHistory();
    setDialog(null);
  };

  const handleReset = async () => {
    await resetAll();
    setDialog(null);
    navigate('/');
  };

  return (
    <div className="page settings-page">
      <PageHeader eyebrow="PREFERENCES" title="设置" />

      <p className="page-lede">
        设置会立即生效并保存在本机。游戏进度与历史记录不会上传到任何服务器。
      </p>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">APPEARANCE</span>
            <h2>外观</h2>
          </div>
        </div>

        <SettingRow title="主题" description="跟随系统，或固定使用浅色/深色。">
          <Segmented<ThemeSetting>
            label="主题"
            value={settings.theme}
            options={[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
            ]}
            onChange={(theme) => void updateSettings({ theme })}
          />
        </SettingRow>

        <SettingRow title="动态效果" description="减少滑动和弹跳，适合对动画敏感的用户。">
          <Segmented<MotionSetting>
            label="动态效果"
            value={settings.motion}
            options={[
              { value: 'system', label: '跟随系统' },
              { value: 'full', label: '完整' },
              { value: 'reduced', label: '减少' },
            ]}
            onChange={(motion) => void updateSettings({ motion })}
          />
        </SettingRow>
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SOUND</span>
            <h2>声音</h2>
          </div>
          <span className="section-heading__icon">
            {settings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </span>
        </div>

        <SettingRow title="游戏音效" description="合成短音，不包含背景音乐。">
          <Toggle
            label="游戏音效"
            checked={settings.soundEnabled}
            onChange={(soundEnabled) => void updateSettings({ soundEnabled })}
          />
        </SettingRow>

        <div className={`volume-row ${settings.soundEnabled ? '' : 'volume-row--disabled'}`}>
          <label htmlFor="volume">音量</label>
          <input
            id="volume"
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(settings.soundVolume * 100)}
            disabled={!settings.soundEnabled}
            onChange={(event) =>
              void updateSettings({ soundVolume: Number(event.target.value) / 100 })
            }
          />
          <span>{Math.round(settings.soundVolume * 100)}%</span>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GAMEPLAY</span>
            <h2>游戏</h2>
          </div>
        </div>

        <SettingRow title="新游戏前确认" description="有进行中对局时，先确认再覆盖。">
          <Toggle
            label="新游戏前确认"
            checked={settings.confirmNewGame}
            onChange={(confirmNewGame) => void updateSettings({ confirmNewGame })}
          />
        </SettingRow>

        <SettingRow title="启动行为" description="打开 App 后停留在首页，或直接恢复上次对局。">
          <Segmented<LaunchBehavior>
            label="启动行为"
            value={settings.launchBehavior}
            options={[
              { value: 'home', label: '停留首页' },
              { value: 'auto', label: '自动继续' },
            ]}
            onChange={(launchBehavior) => void updateSettings({ launchBehavior })}
          />
        </SettingRow>

        <SettingRow title="显示键盘提示" description="在首页和游戏页显示方向键/WASD 操作提示。">
          <Toggle
            label="显示键盘提示"
            checked={settings.showKeyboardHints}
            onChange={(showKeyboardHints) => void updateSettings({ showKeyboardHints })}
          />
        </SettingRow>
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DATA</span>
            <h2>数据</h2>
          </div>
          <span className="section-heading__icon">
            <Database size={18} />
          </span>
        </div>

        <div className="data-summary">
          <div>
            <span>历史记录</span>
            <strong>{history.length}</strong>
            <small>局</small>
          </div>
          <div>
            <span>总对局</span>
            <strong>{stats.gamesPlayed}</strong>
            <small>局</small>
          </div>
          <div>
            <span>最高分</span>
            <strong>{stats.bestScore.toLocaleString('zh-CN')}</strong>
          </div>
        </div>

        <div className="setting-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDialog('clear')}
            disabled={history.length === 0 || busy}
          >
            <Trash2 size={16} aria-hidden="true" />
            清空历史记录
          </button>
          <button
            type="button"
            className="button button--danger-outline"
            onClick={() => setDialog('reset')}
            disabled={busy}
          >
            <RotateCcw size={16} aria-hidden="true" />
            重置全部数据
          </button>
        </div>
      </section>

      <section className="settings-section settings-section--about">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ABOUT</span>
            <h2>关于</h2>
          </div>
          <span className="section-heading__icon">
            <Info size={18} />
          </span>
        </div>
        <div className="about-block">
          <div>
            <strong>2048</strong>
            <span>版本 {__APP_VERSION__} · 离线桌面版</span>
          </div>
          <p>
            所有数据仅保存在本机。没有账号、广告、遥测或网络请求。历史记录最多保留
            200 局，最高分独立保存。
          </p>
          <div className="about-meta">
            {settings.theme === 'dark' ? <Moon size={14} /> : null}
            <span>React + Tauri 2</span>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={dialog === 'clear'}
        title="清空历史记录？"
        description={`将删除全部 ${history.length} 局历史记录。当前对局、最高分和设置不会受影响。`}
        confirmLabel="清空历史"
        danger
        busy={busy}
        onConfirm={() => void handleClearHistory()}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'reset'}
        title="重置全部数据？"
        description="将删除当前对局、全部历史记录、最高分和设置。此操作无法撤销。"
        confirmLabel="全部重置"
        danger
        busy={busy}
        onConfirm={() => void handleReset()}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
