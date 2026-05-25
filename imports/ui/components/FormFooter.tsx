import { Button, Col, Row } from 'antd';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerFooter } from '../drawer-stack';

interface FormFooterProps {
  setOpen?: (open: boolean) => void;
  onCancel?: () => void;
  cancelText?: string;
  submitText?: string;
}

const FormFooter = ({ setOpen, onCancel, cancelText, submitText }: FormFooterProps) => {
  const { t } = useTranslation();
  // Anchor stays in the form's DOM so we can reach the owning <form> for submit.
  const anchorRef = useRef<HTMLSpanElement>(null);

  const handleCancel = onCancel ?? (() => setOpen?.(false));

  // DrawerFooter portals the buttons into the Drawer footer slot, outside the
  // <form> element, so this button can't use htmlType="submit". With no form
  // instance to hand, walk up from the in-form anchor and call requestSubmit(),
  // firing antd validation and onFinish. (Enter-to-submit is handled separately
  // by DrawerFooter's hidden in-form submit button.)
  const handleSubmit = useCallback(() => {
    anchorRef.current?.closest('form')?.requestSubmit();
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden style={{ display: 'none' }} />
      <DrawerFooter>
        <Row gutter={[16, 16]} align="middle" justify="end">
          <Col>
            <Button onClick={handleCancel} danger>
              {cancelText || t('common.cancel')}
            </Button>
          </Col>
          <Col>
            <Button type="primary" onClick={handleSubmit}>
              {submitText || t('common.submit')}
            </Button>
          </Col>
        </Row>
      </DrawerFooter>
    </>
  );
};

export default FormFooter;
