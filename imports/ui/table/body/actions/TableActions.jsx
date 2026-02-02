import { App, Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

export default function TableActions({ record, handleDelete, handleEdit, extra, canUpdate = true, canDelete = true }) {
  const { modal } = App.useApp();
  const styles = {
    button: {
      width: '100%',
    },
  };
  const handleRemove = useCallback(
    e => {
      modal.confirm({
        title: 'Delete Entry',
        content: 'Are you sure you want to delete this entry?',
        okText: 'Yes',
        okType: 'danger',
        onOk: () => handleDelete(e, record),
        closable: true,
        maskClosable: true,
      });
    },
    [modal, handleDelete, record]
  );

  // Don't render anything if no actions are available
  if (!canUpdate && !canDelete && !extra) {
    return null;
  }

  return (
    <Row gutter={[16, 16]} justify="center">
      {canUpdate && (
        <Col flex="auto">
          <Button style={styles.button} onClick={e => handleEdit(e, record)}>
            Edit
          </Button>
        </Col>
      )}
      {canDelete && (
        <Col flex="auto">
          <Button style={styles.button} onClick={e => handleRemove(e, record)} danger>
            Delete
          </Button>
        </Col>
      )}
      {extra && React.createElement(extra, { record })}
    </Row>
  );
}
TableActions.propTypes = {
  record: PropTypes.any,
  handleDelete: PropTypes.func,
  handleEdit: PropTypes.func,
  extra: PropTypes.any,
  canUpdate: PropTypes.bool,
  canDelete: PropTypes.bool,
};
