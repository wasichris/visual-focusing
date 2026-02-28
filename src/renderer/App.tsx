import { useState, useEffect } from 'react';
import Settings from './components/Settings';
import type { AppConfig } from '../shared/types';
import { I18nProvider, useTranslation } from './i18n';

function AppContent({
  config,
  setConfig,
  hasPermission,
  onRequestPermissions,
}: {
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
  hasPermission: boolean;
  onRequestPermissions: () => void;
}) {
  const { t } = useTranslation();

  const handleSaveConfig = async (newConfig: AppConfig) => {
    try {
      await window.electronAPI.setConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('Save config failed:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>{t('app.title')}</h1>
      <Settings
        config={config}
        hasPermission={hasPermission}
        onSave={handleSaveConfig}
        onRequestPermissions={onRequestPermissions}
      />
    </div>
  );
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
    checkPermissions();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await window.electronAPI.getConfig();
      setConfig(cfg);
    } catch (error) {
      console.error('Load config failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const status = await window.electronAPI.checkPermissions();
      setHasPermission(status.accessibility);
    } catch (error) {
      console.error('Check permissions failed:', error);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const granted = await window.electronAPI.requestPermissions();
      setHasPermission(granted);
    } catch (error) {
      console.error('Request permissions failed:', error);
    }
  };

  if (loading || !config) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <I18nProvider language={config.language || 'en'}>
      <AppContent
        config={config}
        setConfig={setConfig}
        hasPermission={hasPermission}
        onRequestPermissions={handleRequestPermissions}
      />
    </I18nProvider>
  );
}

export default App;
