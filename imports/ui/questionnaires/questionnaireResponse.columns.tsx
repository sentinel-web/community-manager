import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import type { Answer } from '../../api/types/questionnaire';
import type { RowClickEvent, TranslateFn } from '../section/types';
import type { QuestionnaireResponseRow } from './types';

const getQuestionnaireResponseColumns = (
  handleViewDetails: (e: RowClickEvent, record: QuestionnaireResponseRow) => void,
  handleToggleIgnored: ((e: RowClickEvent, record: QuestionnaireResponseRow) => void) | null = null,
  canUpdate = false,
  t: TranslateFn,
): ColumnsType<QuestionnaireResponseRow> => {
  return [
    {
      title: t('questionnaires.respondent'),
      dataIndex: 'respondentName',
      key: 'respondentName',
      ellipsis: true,
      render: (name: string, record: QuestionnaireResponseRow) => (
        <Space>
          {record.respondentId ? name : <Tag color="blue">{t('questionnaires.anonymous')}</Tag>}
          {record.ignored && <Tag color="orange">{t('questionnaires.ignored')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('questionnaires.submittedAt'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      sorter: (a: QuestionnaireResponseRow, b: QuestionnaireResponseRow) =>
        new Date(a.submittedAt as Date).valueOf() - new Date(b.submittedAt as Date).valueOf(),
      render: (date: Date | undefined) => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: t('questionnaires.answers'),
      dataIndex: 'answers',
      key: 'answerSummary',
      ellipsis: true,
      render: (answers: Answer[]) => {
        if (!answers || answers.length === 0) return '-';
        const count = answers.length;
        const answered = answers.filter(a => a.value !== undefined && a.value !== null && a.value !== '').length;
        return t('questionnaires.answeredOf', { answered, count });
      },
    },
    {
      title: t('common.actions'),
      dataIndex: '_id',
      key: 'actions',
      render: (_id: unknown, record: QuestionnaireResponseRow) => (
        <Space>
          <Tooltip title={t('questionnaires.viewDetails')}>
            <Button type="text" icon={<EyeOutlined />} onClick={e => handleViewDetails(e, record)} />
          </Tooltip>
          {canUpdate && handleToggleIgnored && (
            <Tooltip title={record.ignored ? t('questionnaires.unignore') : t('questionnaires.ignore')}>
              <Button
                type="text"
                danger={!record.ignored}
                icon={<EyeInvisibleOutlined />}
                onClick={e => handleToggleIgnored(e, record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];
};

export default getQuestionnaireResponseColumns;
