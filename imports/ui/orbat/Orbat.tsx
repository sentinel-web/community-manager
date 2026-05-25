import { Card, Descriptions, Empty, Popover, Select, Space, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import { useTranslation } from '../../i18n/LanguageContext';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import type { Squad } from '/imports/api/types';
import useMethod from '../hooks/useMethod';
import { turnBase64ToImage } from '../profile-picture-input/ProfilePictureInput';
import useTheme from '../theme/theme.hook';
import { useTourRef } from '../tour/TourContext';

interface OrbatNode {
  id: string;
  name: string;
  descritpion: string;
  info?: string;
  parentId?: string;
  src: string | null;
  color?: string;
  children: OrbatNode[];
}

interface OrbatPopoverItem {
  label: string;
  children: string;
}

export default function Orbat() {
  const [ready, setReady] = useState(true);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [options, setOptions] = useState<OrbatNode[]>([]);
  const [viewType, setViewType] = useState('simple');
  const { t } = useTranslation();
  const { theme } = useTheme();
  const chartRef = useTourRef('orbat-chart');
  const { call: fetchSquads } = useMethod<Squad[]>('orbat.squads');

  useEffect(() => {
    setReady(false);
    fetchSquads().then(res => {
      if (res.ok) setSquads(res.data);
      setReady(true);
    });
  }, [fetchSquads]);

  const findParentRecursive = useCallback((options: OrbatNode[], parentId: string | undefined): OrbatNode | null => {
    if (!parentId) return null;
    for (const o of options) {
      if (o.id === parentId) return o;
      const found = findParentRecursive(o.children, parentId);
      if (found) return found;
    }
    return null;
  }, []);

  const getOptions = useCallback(async (): Promise<OrbatNode[]> => {
    const preparedOrbatOptions: OrbatNode[] = [];
    const roots: Squad[] = [];
    const parents: Squad[] = [];
    const children: Squad[] = [];
    // Build a single Set of squad IDs that appear as someone's parent — turns
    // the inner "does anything reference me?" lookup from O(n²) into O(n).
    const referencedParentIds = new Set(squads.flatMap(s => (s.parentSquadId ? [s.parentSquadId] : [])));
    const seen = new Set<string>();
    for (const squad of squads) {
      if (seen.has(squad._id!)) continue;
      seen.add(squad._id!);
      if (!squad.parentSquadId) {
        roots.push(squad);
      } else if (referencedParentIds.has(squad._id!)) {
        parents.push(squad);
      } else {
        children.push(squad);
      }
    }

    // Two-phase build: race the per-squad image decoding in parallel, then
    // assemble the tree sequentially so parents are placed before children
    // look them up via findParentRecursive. The ordered traversal (roots →
    // parents → children) preserves the prior tree-attachment semantics.
    const orderedSquads = [...roots, ...parents, ...children];
    const decoded = await Promise.all(
      orderedSquads.map(async squad => ({
        squad,
        src: squad.image ? (await turnBase64ToImage(squad.image)).src : null,
      }))
    );
    for (const { squad, src } of decoded) {
      const data: OrbatNode = {
        id: squad._id ?? '',
        name: squad.name,
        descritpion: `(SR: ${squad.shortRangeFrequency || 'N/A'} Mhz)`,
        info: squad.description,
        parentId: squad.parentSquadId,
        src: src,
        color: squad.color,
        children: [],
      };
      const parent = findParentRecursive(preparedOrbatOptions, data.parentId);
      if (!parent) {
        preparedOrbatOptions.push(data);
      } else {
        parent.children.push(data);
      }
    }
    return preparedOrbatOptions;
  }, [squads, findParentRecursive]);

  useEffect(() => {
    getOptions().then(setOptions);
  }, [getOptions]);

  const mapOption = useCallback(
    (option: OrbatNode) => {
      return (
        <TreeNode key={option.id} label={<ORBAT_Label option={option} viewType={viewType} />}>
          {option.children?.map(mapOption)}
        </TreeNode>
      );
    },
    [viewType]
  );

  return (
    <div ref={chartRef}>
      <Card
        loading={!ready}
        title={<Typography.Title level={3}>{t('orbat.title')}</Typography.Title>}
        extra={<OrbatViewSelector viewType={viewType} handleChange={setViewType} t={t} />}
      >
        {/* Horizontal-only scroll: a wide org tree pans sideways within the card
            rather than pushing a page-level scrollbar, while vertical growth flows
            into the page's content scroll instead of a nested vertical scrollbar. */}
        <div style={{ overflowX: 'auto' }}>
          {options?.length === 0 && <Empty />}
          {options.map(option => {
            return (
              <Tree lineColor={theme === 'dark' ? 'white' : 'black'} key={option.id} label={<ORBAT_Label option={option} viewType={viewType} />}>
                {option.children?.map(mapOption)}
              </Tree>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

interface OrbatViewSelectorProps {
  viewType: string;
  handleChange: (value: string) => void;
  t: LanguageContextValue['t'];
}

const OrbatViewSelector = ({ viewType, handleChange, t }: OrbatViewSelectorProps) => {
  const viewTypes = useMemo(
    () => [
      { value: 'simple', label: t('orbat.simple') },
      { value: 'advanced', label: t('orbat.advanced') },
    ],
    [t]
  );
  return <Select style={{ minWidth: 125 }} value={viewType} onChange={handleChange} options={viewTypes} optionFilterProp="label" showSearch />;
};

interface ORBAT_LabelProps {
  option: OrbatNode;
  viewType: string;
}

const ORBAT_Label = ({ option, viewType }: ORBAT_LabelProps) => {
  const [items, setItems] = useState<OrbatPopoverItem[]>([]);
  const { call: fetchPopoverItems } = useMethod<OrbatPopoverItem[]>('orbat.popover.items');

  useEffect(() => {
    let isMounted = true;
    fetchPopoverItems(option.id).then(res => {
      if (isMounted && res.ok) setItems(res.data);
    });
    return () => {
      isMounted = false;
    };
  }, [option.id, fetchPopoverItems]);

  if (viewType === 'advanced') {
    return <ORBAT_AdvancedLabel option={option} items={items} />;
  }
  return <ORBAT_SimpleLabel option={option} items={items} />;
};

interface ORBAT_SimpleLabelProps {
  option: OrbatNode;
  items: OrbatPopoverItem[];
}

const ORBAT_SimpleLabel = ({ option, items }: ORBAT_SimpleLabelProps) => {
  const hoverStyle = { cursor: 'pointer' };

  return (
    <div>
      <Popover
        trigger="click"
        placement="bottom"
        content={
          items?.length > 0 ? (
            <div style={{ maxWidth: 400 }}>
              <Descriptions items={items} />
            </div>
          ) : (
            <Empty />
          )
        }
      >
        <img
          style={{ ...hoverStyle, maxWidth: '128px', aspectRatio: '1/1', objectFit: 'contain' }}
          src={option.src ?? undefined}
          alt="-"
          title={option.info || option.name}
        />
        <div>
          <Typography.Text style={hoverStyle}>{option.name}</Typography.Text>
        </div>
        <div>
          <Typography.Text style={hoverStyle} type="secondary">
            {option.descritpion}
          </Typography.Text>
        </div>
      </Popover>
    </div>
  );
};

interface ORBAT_AdvancedLabelProps {
  option: OrbatNode;
  items: OrbatPopoverItem[];
}

const ORBAT_AdvancedLabel = ({ option, items }: ORBAT_AdvancedLabelProps) => {
  const { t } = useTranslation();
  const bgColor = option.color;
  const textColor = bgColor ? getLegibleTextColor(bgColor) : undefined;

  return (
    <Card type="inner" title={option.name} styles={{ header: { backgroundColor: bgColor, color: textColor } }}>
      <Space direction="vertical" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        {option.src && (
          <img style={{ maxWidth: '64px', aspectRatio: '1/1', objectFit: 'contain' }} src={option.src} alt="-" title={option.info || option.name} />
        )}
        <Typography.Text type="secondary">{option.descritpion}</Typography.Text>
        {items?.length > 0 ? (
          items.map(item => (
            <div key={item.label}>
              <Typography.Text strong>{item.label}</Typography.Text> <Typography.Text>{item.children}</Typography.Text>
            </div>
          ))
        ) : (
          <Typography.Text type="secondary" italic>
            {t('orbat.noMembers')}
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
};
