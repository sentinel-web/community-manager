import { Input, Modal } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import type { Role } from '../../api/types';
import { useTranslation } from '../../i18n/LanguageContext';
import { getNavigationValue } from '../navigation/Navigation';
import useNavigation from '../navigation/navigation.hook';
import { PaletteContext } from './PaletteContext';
import { getNavigatePaletteItems } from './palette.items';
import type { PaletteItem } from './palette.types';

const LISTBOX_ID = 'palette-listbox';

export default function Palette() {
  const { open, setOpen } = useContext(PaletteContext);
  const { t } = useTranslation();
  const { setNavigationValue } = useNavigation();
  const user = useTracker(() => Meteor.user(), []);
  useSubscribe('roles', { _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 });
  const roles = useFind(
    () => RolesCollection.find({ _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 }),
    [user?.profile?.roleId]
  );
  const role = roles?.[0] as Role | undefined;

  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<React.ComponentRef<typeof Input>>(null);

  const navigate = useCallback(
    (route: string) => {
      setNavigationValue(route);
      window.history.pushState(null, '', `${window.location.origin}/${route}`);
      setOpen(false);
    },
    [setNavigationValue, setOpen]
  );

  const allItems = useMemo<PaletteItem[]>(() => getNavigatePaletteItems(role, t, navigate), [role, t, navigate]);

  const filteredItems = useMemo<PaletteItem[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return allItems;
    return allItems.filter(item => item.label.toLowerCase().includes(trimmed));
  }, [allItems, query]);

  const groupedItems = useMemo(() => {
    const groups: { label: string; items: PaletteItem[] }[] = [];
    const indexByLabel = new Map<string, number>();
    filteredItems.forEach(item => {
      let idx = indexByLabel.get(item.group);
      if (idx === undefined) {
        idx = groups.length;
        indexByLabel.set(item.group, idx);
        groups.push({ label: item.group, items: [] });
      }
      groups[idx].items.push(item);
    });
    return groups;
  }, [filteredItems]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlighted(prev => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted(prev => (filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = filteredItems[highlighted];
        if (item) item.onSelect();
      }
    },
    [filteredItems, highlighted]
  );

  const setNavOnPopstate = useCallback(() => {
    setNavigationValue(getNavigationValue());
  }, [setNavigationValue]);

  useEffect(() => {
    window.addEventListener('popstate', setNavOnPopstate);
    return () => window.removeEventListener('popstate', setNavOnPopstate);
  }, [setNavOnPopstate]);

  let runningIndex = -1;

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      closable={false}
      destroyOnHidden
      maskClosable
      width={640}
      style={{ top: 96 }}
      styles={{ body: { padding: 0 } }}
      afterOpenChange={isOpen => {
        if (isOpen) inputRef.current?.focus();
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '60vh' }}>
        <Input
          ref={inputRef}
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          variant="borderless"
          size="large"
          style={{ padding: '12px 16px', fontSize: 16, borderBottom: '1px solid var(--ant-color-border-secondary, rgba(128,128,128,0.2))' }}
          role="combobox"
          aria-expanded={open}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={filteredItems[highlighted] ? `palette-item-${highlighted}` : undefined}
          autoFocus
        />
        <div role="listbox" id={LISTBOX_ID} style={{ overflow: 'auto', padding: '8px 0' }}>
          {groupedItems.length === 0 && <div style={{ padding: '16px', textAlign: 'center', opacity: 0.6 }}>{t('palette.noResults')}</div>}
          {groupedItems.map(group => (
            <div key={group.label} role="group" aria-label={group.label}>
              <div style={{ padding: '8px 16px 4px', fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase' }}>{group.label}</div>
              {group.items.map(item => {
                runningIndex += 1;
                const isHighlighted = runningIndex === highlighted;
                const itemIndex = runningIndex;
                return (
                  <div
                    key={item.key}
                    id={`palette-item-${itemIndex}`}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlighted(itemIndex)}
                    onClick={() => item.onSelect()}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      background: isHighlighted ? 'var(--ant-color-primary-bg, rgba(22,119,255,0.1))' : 'transparent',
                    }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
