import { UploadOutlined } from '@ant-design/icons';
import { App, Button, Input, Radio, Space, Tag, Typography, Upload } from 'antd';
import React, { useCallback, useState } from 'react';
import { parsePreset, PRESET_FILE_MAX_BYTES } from '/imports/api/events/preset';
import { useTranslation } from '/imports/i18n/LanguageContext';

interface PresetInputProps {
  /** Supplied by the surrounding `Form.Item`. */
  value?: string;
  onChange?: (value: string) => void;
}

/** Form control for an event preset: either a web link or an uploaded file (see imports/api/events/preset.ts). */
export default function PresetInput({ value = '', onChange }: PresetInputProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const preset = parsePreset(value);
  const filename = preset?.kind === 'file' ? preset.filename : '';
  const [mode, setMode] = useState<'link' | 'file'>(filename ? 'file' : 'link');

  const handleMode = useCallback(
    (next: 'link' | 'file') => {
      setMode(next);
      onChange?.('');
    },
    [onChange]
  );
  const handleUpload = useCallback(
    (file: File) => {
      if (file.size > PRESET_FILE_MAX_BYTES) {
        message.error(t('events.preset.tooLarge', { size: PRESET_FILE_MAX_BYTES / 1024 }));
        return false;
      }
      const reader = new FileReader();
      reader.onload = () => onChange?.(`file:${file.name.replace(/[:/\\]/g, '_').slice(0, 120)}:::${reader.result as string}`);
      reader.readAsDataURL(file);
      return false;
    },
    [onChange, message, t]
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Radio.Group
        value={mode}
        onChange={event => handleMode(event.target.value)}
        options={[
          { value: 'link', label: t('events.preset.link') },
          { value: 'file', label: t('events.preset.file') },
        ]}
      />
      {mode === 'link' ? (
        <Input value={filename ? '' : value} onChange={event => onChange?.(event.target.value)} placeholder={t('forms.placeholders.enterPresetLink')} />
      ) : (
        <Space>
          <Upload beforeUpload={handleUpload} showUploadList={false} accept=".html,.txt,.json">
            <Button icon={<UploadOutlined />}>{t('events.preset.chooseFile')}</Button>
          </Upload>
          {filename ? (
            <Tag closable onClose={() => onChange?.('')}>
              {filename}
            </Tag>
          ) : (
            <Typography.Text type="secondary">{t('events.preset.noFile')}</Typography.Text>
          )}
        </Space>
      )}
    </Space>
  );
}
