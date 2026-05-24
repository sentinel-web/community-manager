import type { ColumnsType } from 'antd/es/table';
import { Alert, Table, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';

const { Text } = Typography;

interface UpdatePayload {
  id?: string;
  changes?: Record<string, unknown>;
  before?: Record<string, unknown>;
}

interface DiffRow {
  key: string;
  field: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

// Render any payload value as a stable, readable string. Primitives render
// as-is; objects/arrays are JSON-encoded so nested edits (e.g. a whole
// `profile` object) stay inspectable. `undefined` becomes an em dash so an
// added field reads as "nothing → value".
function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length ? value : '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface LogDiffViewProps {
  payload: Record<string, unknown>;
}

/**
 * Field-by-field before→after view for `*.updated` audit logs. The server
 * snapshots the touched fields' pre-update values into `payload.before`,
 * keyed identically to `payload.changes`, so this component simply zips the
 * two maps. Logs written before before-capture existed (no `before` key) fall
 * back to a single "new value" column with an explanatory note.
 */
function LogDiffView({ payload }: LogDiffViewProps) {
  const { t } = useTranslation();
  const { changes = {}, before } = (payload || {}) as UpdatePayload;
  const hasBefore = before !== undefined;

  const rows = useMemo<DiffRow[]>(() => {
    // Union of touched keys: `changes` drives the set, but include any
    // before-only keys defensively in case the two ever diverge.
    const keys = Array.from(new Set([...Object.keys(changes), ...Object.keys(before ?? {})])).sort();
    return keys.map(key => {
      const after = changes[key];
      const beforeValue = before?.[key];
      return {
        key,
        field: key,
        before: beforeValue,
        after,
        changed: formatValue(beforeValue) !== formatValue(after),
      };
    });
  }, [changes, before]);

  const columns = useMemo<ColumnsType<DiffRow>>(() => {
    const fieldColumn = {
      title: t('logs.diff.field'),
      dataIndex: 'field',
      key: 'field',
      width: '30%',
      render: (field: string) => <Text code>{field}</Text>,
    };
    const afterColumn = {
      title: hasBefore ? t('logs.diff.after') : t('logs.diff.newValue'),
      dataIndex: 'after',
      key: 'after',
      render: (value: unknown, row: DiffRow) => (
        <Text type={hasBefore && row.changed ? 'success' : undefined} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {formatValue(value)}
        </Text>
      ),
    };
    if (!hasBefore) return [fieldColumn, afterColumn];
    return [
      fieldColumn,
      {
        title: t('logs.diff.before'),
        dataIndex: 'before',
        key: 'before',
        render: (value: unknown, row: DiffRow) => (
          <Text type={row.changed ? 'danger' : undefined} delete={row.changed} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {formatValue(value)}
          </Text>
        ),
      },
      afterColumn,
    ];
  }, [t, hasBefore]);

  if (rows.length === 0) {
    return <Tag>{t('logs.diff.noChanges')}</Tag>;
  }

  return (
    <>
      {!hasBefore && <Alert type="info" showIcon banner message={t('logs.diff.noBefore')} style={{ marginBottom: 8 }} />}
      <Table<DiffRow> columns={columns} dataSource={rows} pagination={false} size="small" rowKey="key" />
    </>
  );
}

export default LogDiffView;
