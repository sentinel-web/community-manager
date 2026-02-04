import { Modal } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { ProfileStats } from '../dashboard/Dashboard';
import { useTranslation } from '/imports/i18n/LanguageContext';

export default function ProfileModal({ showProfile = false, toggleProfile = console.warn }) {
  const [profileStats, setProfileStats] = useState(null);
  const { t } = useTranslation();
  useEffect(() => {
    Meteor.callAsync('members.profileStats').then(setProfileStats).catch(console.error);
  });

  return (
    <Modal title={t('modals.profile')} open={showProfile} onCancel={toggleProfile} width={window.innerWidth * 0.75} footer={null} centered>
      {profileStats && <ProfileStats profileStats={profileStats} t={t} />}
    </Modal>
  );
}
ProfileModal.propTypes = {
  showProfile: PropTypes.bool,
  toggleProfile: PropTypes.func,
};
