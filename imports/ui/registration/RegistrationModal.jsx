import { Form, Modal } from 'antd';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import RegistrationForm from './RegistrationForm';
import { useTranslation } from '/imports/i18n/LanguageContext';

export default function RegistrationModal({ open, setOpen }) {
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    setOpen(false);
    form.resetFields();
  }, [setOpen, form.resetFields]);

  return (
    <Modal title={t('modals.registration')} open={open} onCancel={handleClose} footer={null} centered destroyOnHidden>
      <RegistrationForm form={form} setOpen={setOpen} />
    </Modal>
  );
}
RegistrationModal.propTypes = {
  open: PropTypes.bool,
  setOpen: PropTypes.func,
};
