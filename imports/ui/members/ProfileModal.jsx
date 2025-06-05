import { Modal } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { ProfileStats } from '../dashboard/Dashboard';

export default function ProfileModal({ showProfile = false, toggleProfile = console.warn }) {
  const [profileStats, setProfileStats] = useState(null);
  useEffect(() => {
    Meteor.callAsync('members.profileStats').then(setProfileStats).catch(console.error);
  });

  return (
    <Modal title="Profile" open={showProfile} onCancel={toggleProfile} width={window.innerWidth * 0.75} footer={null} centered>
      {profileStats && <ProfileStats profileStats={profileStats} />}
    </Modal>
  );
}
ProfileModal.propTypes = {
  showProfile: PropTypes.bool,
  toggleProfile: PropTypes.func,
};
