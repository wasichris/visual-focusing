import { useState } from 'react';
import type { AppConfig } from '../../shared/types';
import ShortcutInput from './ShortcutInput';

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
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);

  const handleShortcutChange = (
    direction: 'up' | 'down' | 'left' | 'right',
    shortcut: string
  ) => {
    const newConfig = {
      ...localConfig,
      shortcuts: {
        ...localConfig.shortcuts,
        [direction]: shortcut,
      },
    };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleEnabledChange = (enabled: boolean) => {
    const newConfig = { ...localConfig, enabled };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleNotificationsChange = (showNotifications: boolean) => {
    const newConfig = { ...localConfig, showNotifications };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleDebugLogChange = (enableDebugLog: boolean) => {
    const newConfig = { ...localConfig, enableDebugLog };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleHideDockIconChange = (hideDockIcon: boolean) => {
    const newConfig = { ...localConfig, hideDockIcon };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localConfig);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalConfig(config);
    setHasChanges(false);
  };

  return (
    <div>
      {/* 權限狀態 */}
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
          {hasPermission ? '✅ 權限已授予' : '⚠️ 需要輔助使用權限'}
        </h3>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
          {hasPermission
            ? '應用程式已獲得控制視窗所需的權限'
            : '此應用需要「輔助使用」權限才能控制其他視窗'}
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
            開啟系統設定
          </button>
        )}
      </div>

      {/* 啟用開關 */}
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
            onChange={(e) => handleEnabledChange(e.target.checked)}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            啟用快速鍵
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
            onChange={(e) => handleNotificationsChange(e.target.checked)}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            顯示切換通知
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
            onChange={(e) => handleDebugLogChange(e.target.checked)}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            啟用除錯日誌
          </span>
        </label>

        <p style={{ margin: '0 0 15px 30px', fontSize: '14px', color: '#666' }}>
          除錯日誌會在 Console 顯示詳細的切換資訊，開發用途
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
            onChange={(e) => handleHideDockIconChange(e.target.checked)}
            style={{ marginRight: '10px', width: '20px', height: '20px' }}
          />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>
            關閉視窗後隱藏 Dock 圖示
          </span>
        </label>

        <p style={{ margin: '0 0 0 30px', fontSize: '14px', color: '#666' }}>
          啟用後關閉設定視窗時，Dock 圖示會隱藏，可透過選單列圖示重新開啟
        </p>

        <p style={{ margin: '0 0 0 0', fontSize: '14px', color: '#666' }}>
          {localConfig.enabled
            ? '快速鍵已啟用，可以使用以下組合鍵切換視窗'
            : '快速鍵已停用'}
        </p>
      </div>

      {/* 快速鍵設定 */}
      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>快速鍵設定</h3>

        <div style={{ display: 'grid', gap: '15px' }}>
          <ShortcutInput
            label="向上切換 ↑"
            value={localConfig.shortcuts.up}
            onChange={(value) => handleShortcutChange('up', value)}
          />
          <ShortcutInput
            label="向下切換 ↓"
            value={localConfig.shortcuts.down}
            onChange={(value) => handleShortcutChange('down', value)}
          />
          <ShortcutInput
            label="向左切換 ←"
            value={localConfig.shortcuts.left}
            onChange={(value) => handleShortcutChange('left', value)}
          />
          <ShortcutInput
            label="向右切換 →"
            value={localConfig.shortcuts.right}
            onChange={(value) => handleShortcutChange('right', value)}
          />
        </div>

        <p style={{ marginTop: '15px', fontSize: '13px', color: '#666' }}>
          💡 提示：使用 Command (⌘), Control (⌃), Option (⌥), Shift (⇧)
          搭配方向鍵
        </p>
      </div>

      {/* 儲存按鈕 */}
      {hasChanges && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
          }}
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
            取消
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
            儲存設定
          </button>
        </div>
      )}

      {/* 使用說明 */}
      <div
        style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>使用說明</h3>
        <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
          <li>設定完成後，按下快速鍵即可切換到對應方向的視窗</li>
          <li>應用程式會自動偵測目前視窗周圍的其他視窗</li>
          <li>如果該方向沒有視窗，則不會有任何動作</li>
          <li>可以隨時在此修改快速鍵組合</li>
        </ul>
      </div>
    </div>
  );
}

export default Settings;
