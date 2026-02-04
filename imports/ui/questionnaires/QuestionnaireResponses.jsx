import { App, Empty, Row, Spin, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DrawerContext, SubdrawerContext } from '../app/App';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import Table from '../table/Table';
import getQuestionnaireResponseColumns from './questionnaireResponse.columns';
import ResponseDetailView from './ResponseDetailView';

const { Text } = Typography;

export default function QuestionnaireResponses() {
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { drawerModel: questionnaire } = drawer;
  const { notification } = App.useApp();

  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);

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
      subdrawer.setDrawerTitle('Response Details');
      subdrawer.setDrawerModel({ response, questionnaire });
      subdrawer.setDrawerComponent(React.createElement(ResponseDetailView, { setOpen: subdrawer.setDrawerOpen }));
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, questionnaire]
  );

  const handleLoadMore = useCallback(() => {
    setLimit(prev => prev + 20);
  }, []);

  const columns = useMemo(() => getQuestionnaireResponseColumns(handleViewDetails), [handleViewDetails]);

  const loadMoreDisabled = responses.length < limit;

  if (!questionnaire) {
    return <Text>No questionnaire selected.</Text>;
  }

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Viewing responses for: <strong>{questionnaire.name}</strong>
      </Text>
      {loading ? (
        <Row justify="center" style={{ padding: 48 }}>
          <Spin size="large" />
        </Row>
      ) : responses.length === 0 ? (
        <Empty description="No responses yet" />
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
