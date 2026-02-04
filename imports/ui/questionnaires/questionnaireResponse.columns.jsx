import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Tooltip } from 'antd';
import React from 'react';

const getQuestionnaireResponseColumns = (handleViewDetails, handleToggleIgnored = null, canUpdate = false) => {
  return [
    {
      title: 'Respondent',
      dataIndex: 'respondentName',
      key: 'respondentName',
      ellipsis: true,
      render: (name, record) => (
        <Space>
          {record.respondentId ? name : <Tag color="blue">Anonymous</Tag>}
          {record.ignored && <Tag color="orange">Ignored</Tag>}
        </Space>
      ),
    },
    {
      title: 'Submitted At',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      sorter: (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      render: date => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: 'Answers',
      dataIndex: 'answers',
      key: 'answerSummary',
      ellipsis: true,
      render: answers => {
        if (!answers || answers.length === 0) return '-';
        const count = answers.length;
        const answered = answers.filter(a => a.value !== undefined && a.value !== null && a.value !== '').length;
        return `${answered}/${count} answered`;
      },
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      key: 'actions',
      render: (id, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button type="text" icon={<EyeOutlined />} onClick={e => handleViewDetails(e, record)} />
          </Tooltip>
          {canUpdate && handleToggleIgnored && (
            <Tooltip title={record.ignored ? 'Unignore' : 'Ignore'}>
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
