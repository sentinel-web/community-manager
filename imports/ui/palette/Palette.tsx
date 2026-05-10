import { Modal } from 'antd';
import React, { useContext } from 'react';
import { PaletteContext } from './PaletteContext';

export default function Palette() {
  const { open, setOpen } = useContext(PaletteContext);

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      closable={false}
      destroyOnHidden
      maskClosable
      width={640}
      style={{ top: 96 }}
      styles={{ body: { padding: 0 } }}
    />
  );
}
