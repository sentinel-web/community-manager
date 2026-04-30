import { Modal } from 'antd';
import React, { useCallback } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import RegistrationForm from './RegistrationForm';

interface RegistrationModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function RegistrationModal({ open, setOpen }: RegistrationModalProps) {
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <Modal title={t('modals.registration')} open={open} onCancel={handleClose} footer={null} centered destroyOnHidden>
      <RegistrationForm setOpen={setOpen} />
    </Modal>
  );
}
