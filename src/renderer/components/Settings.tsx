import { useState, useEffect } from 'react';
import type { AppConfig } from '../../shared/types';
import ShortcutInput from './ShortcutInput';
import { useTranslation, supportedLanguages } from '../i18n';

interface SettingsProps {
  config: AppConfig;
  hasPermission: boolean;
  onSave: (config: AppConfig) => void;
  onRequestPermissions: () => void;
}

// ── Design helpers ──────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={`sf-toggle${checked ? ' sf-toggle--on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="sf-toggle__thumb" />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="sf-toggle-row" onClick={() => onChange(!checked)}>
      <div className="sf-toggle-row__text">
        <span className="sf-toggle-row__label">{label}</span>
        {description && (
          <span className="sf-toggle-row__desc">{description}</span>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="sf-card">{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="sf-section-label">{children}</div>;
}

// ── Main component ──────────────────────────────────────────────

function Settings({
  config,
  hasPermission,
  onSave,
  onRequestPermissions,
}: SettingsProps) {
  const { t, language, setLanguage } = useTranslation();
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [version, setVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    releaseUrl: string;
  } | null>(null);

  useEffect(() => {
    window.electronAPI
      .getVersion()
      .then(setVersion)
      .catch(() => {});
    window.electronAPI
      .checkUpdate()
      .then((info) => {
        if (info.hasUpdate) setUpdateInfo(info);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const updateConfig = (partial: Partial<AppConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...partial }));
    setHasChanges(true);
  };

  const handleShortcutChange = (
    direction: 'up' | 'down' | 'left' | 'right',
    shortcut: string
  ) => {
    updateConfig({
      shortcuts: { ...localConfig.shortcuts, [direction]: shortcut },
    });
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    updateConfig({ language: lang });
  };

  const handleSave = () => {
    onSave(localConfig);
    setHasChanges(false);
  };
  const handleReset = () => {
    setLocalConfig(config);
    setLanguage(config.language || 'en');
    setHasChanges(false);
  };

  return (
    <div>
      {/* Language selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
          {t('language.label')}
        </span>
        <select
          className="sf-lang-select"
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {t(lang.label)}
            </option>
          ))}
        </select>
      </div>

      {/* Permission banner */}
      <div
        className={`sf-permission ${hasPermission ? 'sf-permission--ok' : 'sf-permission--warn'}`}
      >
        <div className="sf-permission__dot" />
        <div className="sf-permission__text">
          <strong>
            {hasPermission
              ? t('permissions.granted')
              : t('permissions.required')}
          </strong>
          <span>
            {hasPermission
              ? t('permissions.granted.desc')
              : t('permissions.required.desc')}
          </span>
        </div>
        {!hasPermission && (
          <button
            className="sf-btn sf-btn--primary"
            onClick={onRequestPermissions}
          >
            {t('permissions.openSettings')}
          </button>
        )}
      </div>

      {/* General */}
      <SectionCard>
        <SectionLabel>General</SectionLabel>
        <ToggleRow
          label={t('settings.enabled')}
          checked={localConfig.enabled}
          onChange={(v) => updateConfig({ enabled: v })}
        />
        <ToggleRow
          label={t('settings.launchAtLogin')}
          description={t('settings.launchAtLogin.desc')}
          checked={localConfig.launchAtLogin ?? false}
          onChange={(v) => updateConfig({ launchAtLogin: v })}
        />
        <ToggleRow
          label={t('settings.hideDock')}
          description={t('settings.hideDock.desc')}
          checked={localConfig.hideDockIcon ?? false}
          onChange={(v) => updateConfig({ hideDockIcon: v })}
        />
      </SectionCard>

      {/* Shortcuts */}
      <SectionCard>
        <SectionLabel>Shortcuts</SectionLabel>
        <p className="sf-shortcuts-desc">
          {localConfig.enabled
            ? t('shortcuts.enabled.desc')
            : t('shortcuts.disabled.desc')}
        </p>
        <ShortcutInput
          label={t('shortcuts.up')}
          value={localConfig.shortcuts.up}
          onChange={(v) => handleShortcutChange('up', v)}
        />
        <ShortcutInput
          label={t('shortcuts.down')}
          value={localConfig.shortcuts.down}
          onChange={(v) => handleShortcutChange('down', v)}
        />
        <ShortcutInput
          label={t('shortcuts.left')}
          value={localConfig.shortcuts.left}
          onChange={(v) => handleShortcutChange('left', v)}
        />
        <ShortcutInput
          label={t('shortcuts.right')}
          value={localConfig.shortcuts.right}
          onChange={(v) => handleShortcutChange('right', v)}
        />
        <p className="sf-shortcuts-hint">{t('shortcuts.hint')}</p>
      </SectionCard>

      {/* Advanced */}
      <SectionCard>
        <SectionLabel>Advanced</SectionLabel>
        <ToggleRow
          label={t('settings.debugLog')}
          description={t('settings.debugLog.desc')}
          checked={localConfig.enableDebugLog ?? false}
          onChange={(v) => updateConfig({ enableDebugLog: v })}
        />
      </SectionCard>

      {/* Save bar */}
      {hasChanges && (
        <div className="sf-savebar">
          <button className="sf-btn sf-btn--ghost" onClick={handleReset}>
            {t('actions.cancel')}
          </button>
          <button className="sf-btn sf-btn--primary" onClick={handleSave}>
            {t('actions.save')}
          </button>
        </div>
      )}

      {/* Help */}
      <SectionCard>
        <SectionLabel>Help</SectionLabel>
        <ul className="sf-help-list">
          <li>{t('help.1')}</li>
          <li>{t('help.2')}</li>
          <li>{t('help.3')}</li>
          <li>{t('help.4')}</li>
        </ul>
      </SectionCard>

      {/* Update */}
      {updateInfo && (
        <div className="sf-update">
          {t('update.available', { version: updateInfo.latestVersion })}
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('update.download')}
          </a>
        </div>
      )}

      {version && <p className="sf-version">Visual Focusing v{version}</p>}
    </div>
  );
}

export default Settings;
