import { Modal } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import { getModalWidth } from '../../config';
import { ProfileStats } from '../dashboard/Dashboard';
import { useTranslation } from '/imports/i18n/LanguageContext';

interface ProfileModalProps {
  showProfile?: boolean;
  toggleProfile?: () => void;
}

export default function ProfileModal({ showProfile = false, toggleProfile = () => {} }: ProfileModalProps) {
  const [profileStats, setProfileStats] = useState<Record<string, unknown> | null>(null);
  const { t } = useTranslation();
  useEffect(() => {
    Meteor.callAsync('members.profileStats').then((data: Record<string, unknown>) => setProfileStats(data));
  }, []);

  return (
    <Modal title={t('modals.profile')} open={showProfile} onCancel={toggleProfile} width={getModalWidth(window.innerWidth)} footer={null} centered>
      {profileStats && <ProfileStats profileStats={profileStats} />}
    </Modal>
  );
}
