import { App, Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

export default function LogTableActions({ record, handleDelete, handleView }) {
  const { modal } = App.useApp();
  const styles = {
    button: {
      width: '100%',
    },
  };
  const handleRemove = useCallback(
    e => {
      modal.confirm({
        title: 'Delete Log',
        content: 'Are you sure you want to delete this log entry?',
        okText: 'Yes',
        okType: 'danger',
        onOk: () => handleDelete(e, record),
        closable: true,
        maskClosable: true,
      });
    },
    [modal, handleDelete, record]
  );

  return (
    <Row gutter={[16, 16]} justify="center">
      <Col flex="auto">
        <Button style={styles.button} onClick={e => handleView(e, record)}>
          View
        </Button>
      </Col>
      <Col flex="auto">
        <Button style={styles.button} onClick={e => handleRemove(e, record)} danger>
          Delete
        </Button>
      </Col>
    </Row>
  );
}
LogTableActions.propTypes = {
  record: PropTypes.any,
  handleDelete: PropTypes.func,
  handleView: PropTypes.func,
};
