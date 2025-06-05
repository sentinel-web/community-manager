import { Form, Modal } from 'antd';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import RegistrationForm from './RegistrationForm';

export default function RegistrationModal({ open, setOpen }) {
  const [form] = Form.useForm();

  const handleClose = useCallback(() => {
    setOpen(false);
    form.resetFields();
  }, [setOpen, form.resetFields]);

  return (
    <Modal title="Registration" open={open} onCancel={handleClose} footer={null} centered destroyOnHidden>
      <RegistrationForm form={form} setOpen={setOpen} />
    </Modal>
  );
}
RegistrationModal.propTypes = {
  open: PropTypes.bool,
  setOpen: PropTypes.func,
};
