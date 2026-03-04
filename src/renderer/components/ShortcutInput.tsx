import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';

interface ShortcutInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ShortcutInput({ label, value, onChange }: ShortcutInputProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRecording) {
      window.electronAPI.suspendShortcuts();
    } else {
      window.electronAPI.resumeShortcuts();
    }
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];
    if (e.metaKey) keys.push('Command');
    if (e.ctrlKey && !e.metaKey) keys.push('Control');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    const mainKey = e.key;
    if (
      mainKey !== 'Meta' &&
      mainKey !== 'Control' &&
      mainKey !== 'Alt' &&
      mainKey !== 'Shift'
    ) {
      const keyMap: Record<string, string> = {
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        ' ': 'Space',
      };
      let finalKey: string;
      const code = e.code;
      if (code.startsWith('Key')) {
        finalKey = code.slice(3).toUpperCase();
      } else if (code.startsWith('Digit')) {
        finalKey = code.slice(5);
      } else {
        finalKey = keyMap[mainKey] || mainKey;
        if (finalKey.length === 1) finalKey = finalKey.toUpperCase();
      }
      keys.push(finalKey);
    }

    setRecordedKeys(keys);

    const hasMainKey =
      mainKey !== 'Meta' &&
      mainKey !== 'Control' &&
      mainKey !== 'Alt' &&
      mainKey !== 'Shift';

    if (hasMainKey && keys.length >= 2) {
      onChange(keys.join('+'));
      setIsRecording(false);
      setRecordedKeys([]);
    }
  };

  const handleFocus = () => {
    setIsRecording(true);
    setRecordedKeys([]);
  };

  const handleBlur = () => {
    if (isRecording && recordedKeys.length >= 2) {
      onChange(recordedKeys.join('+'));
    }
    setIsRecording(false);
    setRecordedKeys([]);
  };

  const formatValue = (v: string) => v.replace(/CommandOrControl/g, 'Command');

  const renderChips = (keyString: string) => {
    if (!keyString) return null;
    const keys = keyString.split('+');
    return (
      <>
        {keys.map((key, i) => (
          <span
            key={i}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
          >
            <kbd className="sf-kbd">{key}</kbd>
            {i < keys.length - 1 && <span className="sf-kbd--sep">+</span>}
          </span>
        ))}
      </>
    );
  };

  return (
    <div
      ref={rowRef}
      tabIndex={0}
      role="button"
      className={`sf-shortcut-row${isRecording ? ' sf-shortcut-row--recording' : ''}`}
      onClick={() => {
        if (!isRecording) rowRef.current?.focus();
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <span className="sf-shortcut-row__label">{label}</span>
      <div className="sf-shortcut-row__keys">
        {isRecording ? (
          recordedKeys.length > 0 ? (
            renderChips(recordedKeys.join('+'))
          ) : (
            <span className="sf-recording-hint">
              {t('shortcuts.recording')}
            </span>
          )
        ) : (
          renderChips(formatValue(value))
        )}
      </div>
    </div>
  );
}

export default ShortcutInput;
