import { App, Empty, Row, Spin, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext, SubdrawerContext } from '../app/App';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import Table from '../table/Table';
import getQuestionnaireResponseColumns from './questionnaireResponse.columns';
import ResponseDetailView from './ResponseDetailView';

const { Text } = Typography;

function getUpdatePermission(role) {
  if (!role) return false;
  const permission = role.questionnaires;
  if (permission === true) return true;
  if (typeof permission === 'object' && permission !== null) {
    return permission.update === true;
  }
  return false;
}

export default function QuestionnaireResponses() {
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { drawerModel: questionnaire } = drawer;
  const { notification, message } = App.useApp();
  const { t } = useTranslation();

  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);

  // Get user's role for permission check
  const user = useTracker(() => Meteor.user(), []);
  useSubscribe('roles', { _id: user?.profile?.roleId ?? null }, { limit: 1 });
  const roles = useFind(() => RolesCollection.find({ _id: user?.profile?.roleId ?? null }, { limit: 1 }), [user?.profile?.roleId]);
  const canUpdate = useMemo(() => getUpdatePermission(roles?.[0]), [roles]);

  const loadResponses = useCallback(async () => {
    if (!questionnaire?._id) return;
    try {
      setLoading(true);
      const result = await Meteor.callAsync('questionnaireResponses.getForQuestionnaire', questionnaire._id, { limit });
      setResponses(result);
    } catch (error) {
      notification.error({
        message: error.error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [questionnaire?._id, limit, notification]);

  useEffect(() => {
    loadResponses();
  }, [loadResponses]);

  const handleViewDetails = useCallback(
    (e, response) => {
      e.preventDefault();
      subdrawer.setDrawerTitle(t('questionnaires.responseDetails'));
      subdrawer.setDrawerModel({ response, questionnaire });
      subdrawer.setDrawerComponent(React.createElement(ResponseDetailView, { setOpen: subdrawer.setDrawerOpen }));
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, questionnaire, t]
  );

  const handleToggleIgnored = useCallback(
    async (e, response) => {
      e.preventDefault();
      try {
        await Meteor.callAsync('questionnaireResponses.setIgnored', response._id, !response.ignored);
        message.success(response.ignored ? t('questionnaires.responseUnignored') : t('questionnaires.responseIgnored'));
        loadResponses();
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
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
