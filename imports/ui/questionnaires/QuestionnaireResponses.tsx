import { App, Empty, Row, Spin, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import type { Questionnaire } from '../../api/types/questionnaire';
import type { Role } from '../../api/types/role';
import { useTranslation } from '../../i18n/LanguageContext';
import { useDrawerFrame, useDrawerStack } from '../drawer-stack';
import type { RowClickEvent } from '../section/types';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import Table from '../table/Table';
import getQuestionnaireResponseColumns from './questionnaireResponse.columns';
import ResponseDetailView from './ResponseDetailView';
import type { QuestionnaireResponseRow } from './types';

const { Text } = Typography;

function getUpdatePermission(role: Role | undefined): boolean {
  if (!role) return false;
  const permission = role.questionnaires;
  if (permission === true) return true;
  if (typeof permission === 'object' && permission !== null) {
    return permission.update === true;
  }
  return false;
}

export default function QuestionnaireResponses() {
  const { model } = useDrawerFrame<void, Questionnaire>();
  const drawerStack = useDrawerStack();
  const questionnaire = (model || {}) as unknown as Questionnaire;
  const { notification, message } = App.useApp();
  const { t } = useTranslation();

  const [responses, setResponses] = useState<QuestionnaireResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);

  const user = useTracker(() => Meteor.user(), []);
  useSubscribe('roles', { _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 });
  const roles = useFind(() => RolesCollection.find({ _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 }), [user?.profile?.roleId]);
  const canUpdate = useMemo(() => getUpdatePermission(roles?.[0]), [roles]);

  const loadResponses = useCallback(async () => {
    if (!questionnaire?._id) return;
    try {
      setLoading(true);
      const result = await Meteor.callAsync('questionnaireResponses.getForQuestionnaire', questionnaire._id, { limit });
      setResponses(result as QuestionnaireResponseRow[]);
    } catch (error) {
      notification.error({
        message: (error as Meteor.Error).error,
        description: (error as Meteor.Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [questionnaire?._id, limit, notification]);

  useEffect(() => {
    loadResponses();
  }, [loadResponses]);

  const handleViewDetails = useCallback(
    (e: RowClickEvent, response: QuestionnaireResponseRow) => {
      e.preventDefault();
      void drawerStack.push<void, { response: QuestionnaireResponseRow; questionnaire: Questionnaire }>({
        title: t('questionnaires.responseDetails'),
        Component: ResponseDetailView,
        model: { response, questionnaire },
      });
    },
    [drawerStack, questionnaire, t]
  );

  const handleToggleIgnored = useCallback(
    async (e: RowClickEvent, response: QuestionnaireResponseRow) => {
      e.preventDefault();
      try {
        await Meteor.callAsync('questionnaireResponses.setIgnored', response._id, !response.ignored);
        message.success(response.ignored ? t('questionnaires.responseUnignored') : t('questionnaires.responseIgnored'));
        loadResponses();
      } catch (error) {
        notification.error({
          message: (error as Meteor.Error).error,
          description: (error as Meteor.Error).message,
        });
      }
    },
    [message, notification, loadResponses, t]
  );

  const handleLoadMore = useCallback(() => {
    setLimit(prev => prev + 20);
  }, []);

  const columns = useMemo(
    () => getQuestionnaireResponseColumns(handleViewDetails, handleToggleIgnored, canUpdate, t),
    [handleViewDetails, handleToggleIgnored, canUpdate, t]
  );

  const loadMoreDisabled = responses.length < limit;

  if (!questionnaire) {
    return <Text>{t('questionnaires.noQuestionnaireSelected')}</Text>;
  }

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {t('questionnaires.responsesFor')} <strong>{questionnaire.name}</strong>
      </Text>
      {loading ? (
        <Row justify="center" style={{ padding: 48 }}>
          <Spin size="large" />
        </Row>
      ) : responses.length === 0 ? (
        <Empty description={t('questionnaires.noResponsesYet')} />
      ) : (
        <>
          <TableContainer>
            <Table columns={columns} datasource={responses} />
          </TableContainer>
          <TableFooter ready={true} count={responses.length} handleLoadMore={handleLoadMore} disabled={loadMoreDisabled} />
        </>
      )}
    </div>
  );
}
