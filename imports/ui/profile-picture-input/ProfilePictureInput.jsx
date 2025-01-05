import { App, Spin, Upload } from 'antd';
import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';

export async function turnImageFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

export async function turnBase64ToImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = error => reject(error);
    img.src = base64;
  });
}

export default function ProfilePictureInput({ fileList, setFileList, form, profilePictureId }) {
  const { notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);

  async function uploadImage(file) {
    setLoading(true);
    const base64 = await turnImageFileToBase64(file);
    setImageSrc(base64);
    Meteor.callAsync('profilePictures.insert', { value: base64 })
      .catch(error => {
        console.error(error);
        notification.error({
          message: error.error,
          description: error.message,
        });
      })
      .then(res => {
        form.setFieldsValue({ profilePictureId: res });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (profilePictureId && typeof profilePictureId === 'string') {
      setLoading(true);
      Meteor.callAsync('profilePictures.get', profilePictureId)
        .then(async res => {
          if (res) {
            setImageSrc(res.value);
          }
        })
        .catch(error => {
          console.error(error);
          notification.error({
            message: error.error,
            description: error.message,
          });
        })
        .finally(() => setLoading(false));
    } else {
      setImageSrc(null);
    }
  }, [profilePictureId, notification]);

  return (
    <Upload.Dragger
      accept="image/*"
      directory={false}
      fileList={fileList}
      beforeUpload={(_, fileList) => setFileList(fileList)}
      customRequest={() => uploadImage(fileList[0])}
    >
      <Spin spinning={loading}>
        {imageSrc ? (
          <img style={{ maxHeight: 150, borderRadius: '50%' }} src={imageSrc} alt="" />
        ) : (
          <p>Click this area to upload a profile picture.</p>
        )}
      </Spin>
    </Upload.Dragger>
  );
}
