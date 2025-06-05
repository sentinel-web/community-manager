import { DownOutlined, IdcardOutlined, LogoutOutlined } from '@ant-design/icons';
import { Avatar, Button, Col, Dropdown, Grid, List, Row, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useState } from 'react';
import ProfileModal from '../members/ProfileModal';

export default function Footer() {
  const breakpoints = Grid.useBreakpoint();
  const user = useTracker(() => Meteor.user(), []);
  const [imageSrc, setImageSrc] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const toggleProfile = useCallback(() => {
    setShowProfile(prev => !prev);
  }, []);

  useEffect(() => {
    const profilePictureId = user?.profile?.profilePictureId;
    if (profilePictureId && typeof profilePictureId === 'string') {
      Meteor.callAsync('profilePictures.read', { _id: profilePictureId })
        .then(res => {
          if (res?.[0]) {
            setImageSrc(res[0].value);
          }
        })
        .catch(error => {
          console.error(error);
        });
    } else {
      setImageSrc(null);
    }
  }, [user?.profile?.profilePictureId]);

  if (!user) {
    return <></>;
  }

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col>
        <List
          dataSource={[user]}
          renderItem={item => {
            return (
              <List.Item key={item._id}>
                <Row gutter={[16, 16]}>
                  {breakpoints.sm && (
                    <Col>
                      <Avatar size={48} src={imageSrc} />
                    </Col>
                  )}
                  <Col>
                    <Row>
                      <Col span={24}>
                        <Typography.Text strong ellipsis>
                          {item.profile.name}
                        </Typography.Text>
                      </Col>
                      <Col span={24}>
                        <Typography.Text type="secondary" ellipsis>
                          {item.username}
                        </Typography.Text>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </List.Item>
            );
          }}
        />
      </Col>
      <Col>
        <Dropdown
          placement="right"
          trigger={['click']}
          menu={{
            items: [
              { key: 'profile', label: 'Profile', icon: <IdcardOutlined />, onClick: toggleProfile },
              { key: 'logout', label: 'Logout', danger: true, icon: <LogoutOutlined />, onClick: () => Meteor.logout() },
            ],
          }}
        >
          <Button type="text" icon={<DownOutlined />} />
        </Dropdown>
        <ProfileModal showProfile={showProfile} toggleProfile={toggleProfile} />
      </Col>
    </Row>
  );
}
