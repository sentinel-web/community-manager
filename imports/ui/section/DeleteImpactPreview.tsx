import { Alert, List, Typography } from 'antd';
import React from 'react';
import { useTranslation, type LanguageContextValue } from '../../i18n/LanguageContext';

// Public shape returned by the `integrity.preview` Meteor method. Mirrors
// IntegrityPreview from server/integrity.ts but kept as a pure type here
// to avoid importing server code into the client bundle.
export interface BlockedByEntry {
  source: string;
  count: number;
  sample: string[];
}

export interface DeleteImpactPreviewData {
  blockedBy: BlockedByEntry[];
  pulled: Record<string, number>;
  setNull: Record<string, number>;
  cascaded: Record<string, number>;
}

interface DeleteImpactPreviewProps {
  preview: DeleteImpactPreviewData | null;
}

// Resolve the localized label for a source-collection name. Hand-written
// switch (rather than a dynamic-key map) keeps every t() call site bound
// to a literal LocaleKey so the param-extraction generic resolves cleanly.
// Internal/admin-only collections (attendances, profilePictures,
// questionnaireResponses) fall back to the raw name — they're not expected
// to appear as block sources in normal admin flows.
function resolveSourceLabel(source: string, t: LanguageContextValue['t']): string {
  switch (source) {
    case 'discoveryTypes':
      return t('navigation.discoveryTypes');
    case 'eventTypes':
      return t('navigation.eventTypes');
    case 'events':
      return t('navigation.events');
    case 'logs':
      return t('navigation.logs');
    case 'medals':
      return t('navigation.medals');
    case 'members':
      return t('navigation.members');
    case 'positions':
      return t('navigation.positions');
    case 'questionnaires':
      return t('navigation.questionnaires');
    case 'ranks':
      return t('navigation.ranks');
    case 'registrations':
      return t('navigation.registrations');
    case 'roles':
      return t('navigation.roles');
    case 'specializations':
      return t('navigation.specializations');
    case 'squads':
      return t('navigation.squads');
    case 'taskStatus':
      return t('navigation.taskStatus');
    case 'tasks':
      return t('navigation.tasks');
    default:
      return source;
  }
}

const SAMPLE_RENDER_LIMIT = 3;

export default function DeleteImpactPreview({ preview }: DeleteImpactPreviewProps) {
  const { t } = useTranslation();

  if (!preview) return null;
  if (preview.blockedBy.length === 0) return null;

  return (
    <Alert
      type="error"
      showIcon
      message={t('integrity.blockedTitle')}
      description={
        <>
          <Typography.Paragraph style={{ marginBottom: 8 }}>{t('integrity.blockedDescription')}</Typography.Paragraph>
          <List
            size="small"
            dataSource={preview.blockedBy}
            renderItem={entry => {
              const label = resolveSourceLabel(entry.source, t);
              const visible = entry.sample.slice(0, SAMPLE_RENDER_LIMIT);
              const remaining = Math.max(entry.sample.length - visible.length, 0);
              const names = visible.join(', ');
              const text =
                remaining > 0
                  ? t('integrity.usageEntryWithMore', { count: entry.count, label, names, more: remaining })
                  : t('integrity.usageEntry', { count: entry.count, label, names });
              return <List.Item key={entry.source}>{text}</List.Item>;
            }}
          />
        </>
      }
    />
  );
}
