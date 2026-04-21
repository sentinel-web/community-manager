import type { Key, MouseEvent } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { LanguageContextValue } from '../../i18n/LanguageContext';

export type TranslateFn = LanguageContextValue['t'];

export interface SectionPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export type RowClickEvent = MouseEvent<HTMLElement>;

export type ColumnsFactory<T = Record<string, unknown>> = (
  handleEdit: (e: RowClickEvent, record: T) => void,
  handleDelete: (e: RowClickEvent, record: T) => void,
  permissions: SectionPermissions,
  t: TranslateFn
) => ColumnsType<T>;

export interface GroupAction {
  key: string;
  label: string;
  handler: (selectedKeys: Key[]) => void | Promise<void>;
}

export interface BoundGroupAction {
  key: string;
  label: string;
  handler: () => void | Promise<void>;
}
