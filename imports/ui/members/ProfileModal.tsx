import { Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import { getModalWidth } from '../../config';
import useMethod from '../hooks/useMethod';
import useViewportSize from '../hooks/useViewportSize';
import { ProfileStats } from '../dashboard/Dashboard';
import { useTranslation } from '/imports/i18n/LanguageContext';

interface ProfileModalProps {
  showProfile?: boolean;
  toggleProfile?: () => void;
}

export default function ProfileModal({ showProfile = false, toggleProfile = () => {} }: ProfileModalProps) {
  const [profileStats, setProfileStats] = useState<Record<string, unknown> | null>(null);
  const { t } = useTranslation();
  const { width } = useViewportSize();
  const { call } = useMethod<Record<string, unknown>>('members.profileStats');
  useEffect(() => {
    call().then(res => setProfileStats(res.ok ? res.data : null));
  }, [call]);

  return (
    <Modal title={t('modals.profile')} open={showProfile} onCancel={toggleProfile} width={getModalWidth(width)} footer={null} centered>
      {profileStats && <ProfileStats profileStats={profileStats} />}
    </Modal>
  );
}
