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

  const updateConfig = (partial: Partial<AppConfig>) => {
    const newConfig = { ...localConfig, ...partial };
    setLocalConfig(newConfig);
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
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: '15px',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '14px', color: '#666' }}>
          {t('language.label')}
        </span>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '14px',
          }}
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {t(lang.label)}
            </option>
          ))}
        </select>
      </div>

      {/* Permissions */}
      <div
        style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: hasPermission ? '#d4edda' : '#f8d7da',
          border: `1px solid ${hasPermission ? '#c3e6cb' : '#f5c6cb'}`,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '10px' }}>
          {hasPermission ? t('permissions.granted') : t('permissions.required')}
        </h3>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
          {hasPermission
            ? t('permissions.granted.desc')
            : t('permissions.required.desc')}
        </p>
        {!hasPermission && (
          <button
            onClick={onRequestPermissions}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {t('permissions.openSettings')}
          </button>
        )}
      </div>

      {/* Toggles */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '15px',
          }}
        >
          <input
            type="checkbox"
            checked={localConfig.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            {t('settings.enabled')}
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '15px',
          }}
        >
          <input
            type="checkbox"
            checked={localConfig.showNotifications ?? false}
            onChange={(e) =>
              updateConfig({ showNotifications: e.target.checked })
            }
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            {t('settings.notifications')}
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        >
          <input
            type="checkbox"
            checked={localConfig.enableDebugLog ?? false}
            onChange={(e) => updateConfig({ enableDebugLog: e.target.checked })}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            {t('settings.debugLog')}
          </span>
        </label>
        <p style={{ margin: '0 0 15px 30px', fontSize: '14px', color: '#666' }}>
          {t('settings.debugLog.desc')}
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        >
          <input
            type="checkbox"
            checked={localConfig.hideDockIcon ?? false}
            onChange={(e) => updateConfig({ hideDockIcon: e.target.checked })}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            {t('settings.hideDock')}
          </span>
        </label>
        <p style={{ margin: '0 0 0 30px', fontSize: '14px', color: '#666' }}>
          {t('settings.hideDock.desc')}
        </p>
      </div>

      {/* System */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        >
          <input
            type="checkbox"
            checked={localConfig.launchAtLogin ?? false}
            onChange={(e) => updateConfig({ launchAtLogin: e.target.checked })}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            {t('settings.launchAtLogin')}
          </span>
        </label>
        <p style={{ margin: '0 0 0 30px', fontSize: '14px', color: '#666' }}>
          {t('settings.launchAtLogin.desc')}
        </p>
      </div>

      {/* Shortcuts */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '5px' }}>
          {t('shortcuts.title')}
        </h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#666' }}>
          {localConfig.enabled
            ? t('shortcuts.enabled.desc')
            : t('shortcuts.disabled.desc')}
        </p>
        <div style={{ display: 'grid', gap: '15px' }}>
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
        </div>
        <p style={{ marginTop: '15px', fontSize: '13px', color: '#666' }}>
          {t('shortcuts.hint')}
        </p>
      </div>

      {/* Save buttons */}
      {hasChanges && (
        <div
          style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}
        >
          <button
            onClick={handleReset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {t('actions.cancel')}
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {t('actions.save')}
          </button>
        </div>
      )}

      {/* Help */}
      <div
        style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>{t('help.title')}</h3>
        <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
          <li>{t('help.1')}</li>
          <li>{t('help.2')}</li>
          <li>{t('help.3')}</li>
          <li>{t('help.4')}</li>
        </ul>
      </div>

      {/* Update notification */}
      {updateInfo && (
        <div
          style={{
            marginTop: '20px',
            padding: '12px 15px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            fontSize: '14px',
          }}
        >
          {t('update.available', { version: updateInfo.latestVersion })}
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: '8px', color: '#0056b3' }}
          >
            {t('update.download')}
          </a>
        </div>
      )}
      {version && (
        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#999',
            marginTop: '20px',
          }}
        >
          Visual Focusing v{version}
        </p>
      )}
    </div>
  );
}

export default Settings;
