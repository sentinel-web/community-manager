import { App, Spin, Upload } from 'antd';
import type { FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';

export async function turnImageFileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export async function turnBase64ToImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = error => reject(error);
    img.src = base64;
  });
}

interface ProfilePictureInputProps {
  fileList?: UploadFile[];
  setFileList: (files: UploadFile[]) => void;
  form: FormInstance;
  profilePictureId?: string;
}

export default function ProfilePictureInput({ fileList, setFileList, form, profilePictureId }: ProfilePictureInputProps) {
  const { notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  async function uploadImage(file: Blob) {
    setLoading(true);
    const base64 = await turnImageFileToBase64(file);
    setImageSrc(base64);
    Meteor.callAsync('profilePictures.insert', { value: base64 })
      .catch((error: Meteor.Error) => {
        notification.error({
          message: error.error as string,
          description: error.message,
        });
      })
      .then(res => {
        form.setFieldValue(['profile', 'profilePictureId'], res);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (profilePictureId && typeof profilePictureId === 'string') {
      setLoading(true);
      Meteor.callAsync('profilePictures.read', { _id: profilePictureId })
        .then(res => {
          if (res?.[0]) {
            setImageSrc(res[0].value);
          }
        })
        .catch((error: Meteor.Error) => {
          notification.error({
            message: error.error as string,
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
      beforeUpload={(_, list) => {
        setFileList(list);
      }}
      customRequest={() => {
        if (fileList && fileList[0]) {
          uploadImage(fileList[0] as unknown as Blob);
        }
      }}
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
