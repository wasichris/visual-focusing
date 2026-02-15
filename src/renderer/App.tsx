import { useState, useEffect } from 'react';
import Settings from './components/Settings';
import type { AppConfig } from '../shared/types';

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
      console.error('載入設定失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const status = await window.electronAPI.checkPermissions();
      setHasPermission(status.accessibility);
    } catch (error) {
      console.error('檢查權限失敗:', error);
    }
  };

  const handleSaveConfig = async (newConfig: AppConfig) => {
    try {
      await window.electronAPI.setConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('儲存設定失敗:', error);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const granted = await window.electronAPI.requestPermissions();
      setHasPermission(granted);
    } catch (error) {
      console.error('請求權限失敗:', error);
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
        <p>載入中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>🎯 Visual Focusing</h1>
      
      <Settings
        config={config}
        hasPermission={hasPermission}
        onSave={handleSaveConfig}
        onRequestPermissions={handleRequestPermissions}
      />
    </div>
  );
}

export default App;
