import { Button, Col, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import type { Questionnaire } from '../../api/types/questionnaire';
import type { LocaleKey } from '/imports/i18n';
import type { RowClickEvent, SectionPermissions, TranslateFn } from '../section/types';
import TableActions from '../table/body/actions/TableActions';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  active: 'success',
  closed: 'error',
};

// `as const satisfies` preserves the literal union so t(STATUS_LABEL_KEYS[status])
// resolves to a paramless LocaleKey rather than the full LocaleKey union.
const STATUS_LABEL_KEYS = {
  draft: 'questionnaires.draft',
  active: 'questionnaires.active',
  closed: 'questionnaires.closed',
} as const satisfies Record<string, LocaleKey>;

interface ViewResponsesExtraProps {
  record: Questionnaire;
}

const getQuestionnaireColumns = (
  handleEdit: (e: RowClickEvent, record: Questionnaire) => void,
  handleDelete: (e: RowClickEvent, record: Questionnaire) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TranslateFn,
  handleViewResponses: ((e: RowClickEvent, record: Questionnaire) => void) | null = null,
): ColumnsType<Questionnaire> => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<Questionnaire> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a: Questionnaire, b: Questionnaire) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a: Questionnaire, b: Questionnaire) => (a.description || '').localeCompare(b.description || ''),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      sorter: (a: Questionnaire, b: Questionnaire) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {t(STATUS_LABEL_KEYS[status as keyof typeof STATUS_LABEL_KEYS] ?? 'questionnaires.draft')}
        </Tag>
      ),
    },
    {
      title: t('questionnaires.questions'),
      dataIndex: 'questions',
      key: 'questions',
      sorter: (a: Questionnaire, b: Questionnaire) => (a.questions?.length || 0) - (b.questions?.length || 0),
      render: (questions: Questionnaire['questions']) => questions?.length || 0,
    },
  ];

  const ViewResponsesExtra = handleViewResponses
    ? ({ record }: ViewResponsesExtraProps) => (
        <Col flex="auto">
          <Button style={{ width: '100%' }} onClick={e => handleViewResponses(e, record)}>
            {t('questionnaires.responses')}
          </Button>
        </Col>
      )
    : undefined;

  if (canUpdate || canDelete || handleViewResponses) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: unknown, record: Questionnaire) => (
        <TableActions
          record={record}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          canUpdate={canUpdate}
          canDelete={canDelete}
          extra={ViewResponsesExtra}
        />
      ),
    });
  }

  return columns;
};

export default getQuestionnaireColumns;
