import { Card, Empty, Popover, Select, Tooltip, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import { useTranslation } from '../../i18n/LanguageContext';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import type { OrbatSquad, SquadMemberRow } from '/imports/api/types';
import buildOrbatTree, { type OrbatTreeNode } from '/imports/helpers/orbat/buildOrbatTree';
import useMethod from '../hooks/useMethod';
import { turnBase64ToImage } from '../profile-picture-input/ProfilePictureInput';
import useTheme from '../theme/theme.hook';
import { useTourRef } from '../tour/TourContext';
import OrbatMemberRows from './OrbatMemberRows';

interface OrbatNode {
  id: string;
  name: string;
  descritpion: string;
  info?: string;
  src: string | null;
  color?: string;
  memberCount: number;
  children: OrbatNode[];
}

function toOrbatNode({ item, children }: OrbatTreeNode<OrbatSquad>, srcById: Map<string, string | null>): OrbatNode {
  return {
    id: item._id ?? '',
    name: item.name,
    descritpion: `(SR: ${item.shortRangeFrequency || 'N/A'} Mhz)`,
    info: item.description,
    src: srcById.get(item._id ?? '') ?? null,
    color: item.color,
    memberCount: item.memberCount,
    children: children.map(child => toOrbatNode(child, srcById)),
  };
}

export default function Orbat() {
  const [ready, setReady] = useState(true);
  const [squads, setSquads] = useState<OrbatSquad[]>([]);
  const [options, setOptions] = useState<OrbatNode[]>([]);
  const [viewType, setViewType] = useState('simple');
  const { t } = useTranslation();
  const { theme } = useTheme();
  const chartRef = useTourRef('orbat-chart');
  const { call: fetchSquads } = useMethod<OrbatSquad[]>('orbat.squads');

  useEffect(() => {
    setReady(false);
    fetchSquads().then(res => {
      if (res.ok) setSquads(res.data);
      setReady(true);
    });
  }, [fetchSquads]);

  const getOptions = useCallback(async (): Promise<OrbatNode[]> => {
    // Decode the squad images in parallel, then assemble the tree. The server returns squads sorted by
    // { order, name }; buildOrbatTree keeps that order among siblings.
    const decoded = await Promise.all(
      squads.map(async squad => [squad._id ?? '', squad.image ? (await turnBase64ToImage(squad.image)).src : null] as const)
    );
    const srcById = new Map<string, string | null>(decoded);
    return buildOrbatTree(squads).map(node => toOrbatNode(node, srcById));
  }, [squads]);

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
  const [items, setItems] = useState<SquadMemberRow[]>([]);
  const { call: fetchPopoverItems } = useMethod<SquadMemberRow[]>('orbat.popover.items');

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
  items: SquadMemberRow[];
}

const ORBAT_SimpleLabel = ({ option, items }: ORBAT_SimpleLabelProps) => {
  const hoverStyle = { cursor: 'pointer' };

  return (
    <div>
      <Popover trigger="click" placement="bottom" content={items?.length > 0 ? <OrbatMemberRows rows={items} /> : <Empty />}>
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
        <div>
          <OrbatMemberCount count={option.memberCount} />
        </div>
      </Popover>
    </div>
  );
};

interface ORBAT_AdvancedLabelProps {
  option: OrbatNode;
  items: SquadMemberRow[];
}

const ORBAT_AdvancedLabel = ({ option, items }: ORBAT_AdvancedLabelProps) => {
  const { t } = useTranslation();
  const bgColor = option.color;
  const textColor = bgColor ? getLegibleTextColor(bgColor) : undefined;

  return (
    <Card type="inner" title={option.name} styles={{ header: { backgroundColor: bgColor, color: textColor } }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {option.src && (
          <img style={{ maxWidth: '64px', aspectRatio: '1/1', objectFit: 'contain' }} src={option.src} alt="-" title={option.info || option.name} />
        )}
        <Typography.Text type="secondary">{option.descritpion}</Typography.Text>
        <OrbatMemberCount count={option.memberCount} />
        {items?.length > 0 ? (
          <OrbatMemberRows rows={items} />
        ) : (
          <Typography.Text type="secondary" italic>
            {t('orbat.noMembers')}
          </Typography.Text>
        )}
      </div>
    </Card>
  );
};

interface OrbatMemberCountProps {
  count: number;
}

const OrbatMemberCount = ({ count }: OrbatMemberCountProps) => {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('orbat.memberCountHint')}>
      <Typography.Text type="secondary">{t('orbat.memberCount', { count })}</Typography.Text>
    </Tooltip>
  );
};
