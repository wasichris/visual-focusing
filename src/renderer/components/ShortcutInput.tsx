import { useState, useRef, useEffect } from 'react';

interface ShortcutInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ShortcutInput({ label, value, onChange }: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRecording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];

    // 修飾鍵
    if (e.metaKey) keys.push('CommandOrControl');
    if (e.ctrlKey && !e.metaKey) keys.push('Control');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    // 主鍵
    const mainKey = e.key;
    if (
      mainKey !== 'Meta' &&
      mainKey !== 'Control' &&
      mainKey !== 'Alt' &&
      mainKey !== 'Shift'
    ) {
      // 特殊鍵映射
      const keyMap: Record<string, string> = {
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        ' ': 'Space',
      };

      keys.push(keyMap[mainKey] || mainKey.toUpperCase());
    }

    setRecordedKeys(keys);

    // 如果有完整的組合鍵，完成錄製
    if (keys.length >= 2) {
      const shortcut = keys.join('+');
      onChange(shortcut);
      setIsRecording(false);
      setRecordedKeys([]);
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordedKeys([]);
  };

  const handleBlur = () => {
    if (isRecording && recordedKeys.length >= 2) {
      const shortcut = recordedKeys.join('+');
      onChange(shortcut);
    }
    setIsRecording(false);
    setRecordedKeys([]);
  };

  const displayValue = isRecording
    ? recordedKeys.length > 0
      ? recordedKeys.join(' + ')
      : '按下快速鍵組合...'
    : value;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <label style={{ minWidth: '120px', fontSize: '14px' }}>{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onKeyDown={handleKeyDown}
        onFocus={handleStartRecording}
        onBlur={handleBlur}
        readOnly
        placeholder="點擊設定快速鍵"
        style={{
          flex: 1,
          padding: '8px 12px',
          border: isRecording ? '2px solid #007bff' : '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: isRecording ? '#f0f8ff' : 'white',
          cursor: 'pointer',
          outline: 'none',
        }}
      />
    </div>
  );
}

export default ShortcutInput;
