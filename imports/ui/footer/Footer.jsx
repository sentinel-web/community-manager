import { DownOutlined, IdcardOutlined, LockFilled, LogoutOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Col, Dropdown, Form, Grid, Input, List, Modal, Row, Typography } from 'antd';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useState } from 'react';
import ProfileModal from '../members/ProfileModal';

export default function Footer() {
  const breakpoints = Grid.useBreakpoint();
  const user = useTracker(() => Meteor.user(), []);
  const { modal, message } = App.useApp();
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
        .catch(() => {});
    } else {
      setImageSrc(null);
    }
  }, [user?.profile?.profilePictureId]);

  const startChangePassword = useCallback(() => {
    function handleSubmit({ oldPassword, newPassword }) {
      Accounts.changePassword(oldPassword, newPassword, error => {
        if (error) {
          message.error({ content: error.message });
        } else {
          Modal.destroyAll();
        }
      });
    }

    modal.confirm({
      title: 'Change Password',
      footer: null,
      centered: true,
      closable: true,
      content: (
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Current Password" name="oldPassword" rules={[{ required: true, type: 'string' }]} required>
            <Input.Password placeholder="Enter password" autoComplete="off" />
          </Form.Item>
          <Form.Item label="New Password" name="newPassword" rules={[{ required: true, type: 'string' }]} required>
            <Input.Password placeholder="Enter password" autoComplete="off" />
          </Form.Item>
          <Row gutter={[16, 16]} justify="end" align="middle">
            <Col>
              <Button type="primary" htmlType="submit">
                Sumbit
              </Button>
            </Col>
          </Row>
        </Form>
      ),
    });
  }, [modal, message]);

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
              { key: 'changePassword', label: 'Change Password', icon: <LockFilled />, onClick: startChangePassword },
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
