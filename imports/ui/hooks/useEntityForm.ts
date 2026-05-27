import { useCallback, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTranslation } from '/imports/i18n/LanguageContext';
import type { ParameterlessLocaleKey } from '/imports/i18n';
import type { CrudCollectionName } from '/imports/api/types/crud';
import { useDrawerFrame } from '../drawer-stack';
import useMethod from './useMethod';
import { entityArgs, entityIsUpdate, entityMethodName, entityResolveValue } from './entityFormSubmit';

/**
 * The EntityForm seam — see CONTEXT.md → EntityForm.
 *
 * Owns the create-vs-update submit lifecycle of a drawer entity form. Built on
 * top of MethodCall: where `useMethod` owns one client method call, this hook
 * owns the whole "save this entity" flow — choosing insert vs update, computing
 * the success message, shaping the call arguments, and resolving the drawer
 * frame on success. The DOM-free decision logic lives in `entityFormSubmit`.
 *
 * Escape hatches are composition, not configuration: a pre-submit guard wraps
 * `onFinish`, an extra mutation is a separate `useMethod` alongside, and a form
 * that is not create-vs-update keeps using `useMethod` directly.
 */

interface EntityModel {
  _id?: string;
}

export interface UseEntityFormOptions<V> {
  /** The collection — the method name is derived as `<collection>.update` / `<collection>.insert`. */
  collection: CrudCollectionName;
  /** Success message shown when inserting. */
  created: ParameterlessLocaleKey;
  /** Success message shown when updating. */
  updated: ParameterlessLocaleKey;
  /**
   * The one form-specific step: map antd form values to the wire payload
   * (field selection, color extraction, date parsing, …). Defaults to identity.
   * The payload is sent untyped through `useMethod`, so its shape is intentionally
   * not constrained to `V`.
   */
  toPayload?: (values: V) => unknown;
}

export interface UseEntityForm<V, M> {
  onFinish: (values: V) => Promise<void>;
  loading: boolean;
  model: M;
  cancel: () => void;
}

export default function useEntityForm<V, M extends EntityModel = EntityModel>(options: UseEntityFormOptions<V>): UseEntityForm<V, M> {
  const { collection, created, updated, toPayload } = options;
  const { t } = useTranslation();
  const { model, resolve, cancel } = useDrawerFrame<string, M>();

  const modelId = model?._id;
  // Non-reactive read, exactly as the hand-rolled forms did — anonymous callers
  // always insert (load-bearing for the anonymous RegistrationForm).
  const isUpdate = entityIsUpdate(!!Meteor.user(), modelId);

  const { call, loading } = useMethod<string | undefined>(entityMethodName(collection, isUpdate), {
    success: t(isUpdate ? updated : created),
  });

  // Store toPayload in a ref refreshed each render so onFinish closes over the
  // latest component state (imageSrc, …) without itself churning identity.
  const toPayloadRef = useRef(toPayload);
  toPayloadRef.current = toPayload;

  const onFinish = useCallback(
    async (values: V) => {
      const transform = toPayloadRef.current;
      const payload = transform ? transform(values) : values;
      const res = await call(...entityArgs(isUpdate, modelId, payload));
      if (!res.ok) return;
      resolve(entityResolveValue(modelId, res.data) as string | undefined);
    },
    [call, isUpdate, modelId, resolve]
  );

  return { onFinish, loading, model, cancel };
}
