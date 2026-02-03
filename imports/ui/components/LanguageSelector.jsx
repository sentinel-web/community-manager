import React, { useCallback } from 'react';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Language selector dropdown component
 */
export default function LanguageSelector() {
  const { language, setLanguage, locales, t } = useLanguage();

  const handleChange = useCallback(
    value => {
      setLanguage(value);
    },
    [setLanguage]
  );

  const options = Object.entries(locales).map(([code, { name, flag }]) => ({
    value: code,
    label: (
      <span>
        {flag} {name}
      </span>
    ),
  }));

  return (
    <Select
      value={language}
      onChange={handleChange}
      options={options}
      style={{ minWidth: 140 }}
      suffixIcon={<GlobalOutlined />}
      title={t('settings.selectLanguage')}
    />
  );
}
