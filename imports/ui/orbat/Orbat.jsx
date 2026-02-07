import { App, Card, Descriptions, Empty, Popover, Select, Space, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import { useTranslation } from '../../i18n/LanguageContext';
import { turnBase64ToImage } from '../profile-picture-input/ProfilePictureInput';
import useTheme from '../theme/theme.hook';

export default function Orbat() {
  const { message } = App.useApp();
  const [ready, setReady] = useState(true);
  const [squads, setSquads] = useState([]);
  const [options, setOptions] = useState([]);
  const [viewType, setViewType] = useState('simple');
  const { t } = useTranslation();
  const { theme } = useTheme();

  useEffect(() => {
    setReady(false);
    Meteor.callAsync('orbat.squads')
      .then(squads => {
        setSquads(squads);
        setReady(true);
      })
      .catch(() => {
        message.error('Failed to load ORBAT data');
        setReady(true);
      });
  }, [message]);

  const findParentRecursive = useCallback((options, parentId) => {
    if (!parentId) {
      return null;
    }
    for (const o of options) {
      if (o.id === parentId) {
        return o;
      }
      const found = findParentRecursive(o.children, parentId);
      if (found) {
        return found;
      }
    }
    return null;
  }, []);

  const getOptions = useCallback(async () => {
    const preparedOrbatOptions = [];
    const roots = [];
    const parents = [];
    const children = [];
    for (const squad of squads) {
      if (!squad.parentSquadId && !roots.find(s => s._id === squad._id)) {
        roots.push(squad);
      } else if (!parents.find(s => s._id === squad._id) && squads.find(s => s.parentSquadId === squad._id)) {
        parents.push(squad);
      } else {
        children.push(squad);
      }
    }

    const prepareData = async squad => {
      const src = squad.image ? (await turnBase64ToImage(squad.image)).src : null;
      const data = {
        id: squad._id,
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
    };

    for (const squad of [...roots, ...parents, ...children]) {
      await prepareData(squad);
    }

    return preparedOrbatOptions;
  }, [squads, findParentRecursive]);

  useEffect(() => {
    getOptions().then(setOptions);
  }, [getOptions]);

  const mapOption = useCallback(
    option => {
      return (
        <TreeNode key={option.id} label={<ORBAT_Label option={option} viewType={viewType} />}>
          {option.children?.map(mapOption)}
        </TreeNode>
      );
    },
    [viewType]
  );

  return (
    <Card
      loading={!ready}
      title={<Typography.Title level={3}>{t('orbat.title')}</Typography.Title>}
      extra={<OrbatViewSelector viewType={viewType} handleChange={setViewType} t={t} />}
    >
      <div style={{ overflow: 'auto' }}>
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
  );
}

const OrbatViewSelector = ({ viewType, handleChange, t }) => {
  const viewTypes = useMemo(
    () => [
      { value: 'simple', label: t('orbat.simple') },
      { value: 'advanced', label: t('orbat.advanced') },
    ],
    [t]
  );
  return <Select style={{ minWidth: 125 }} value={viewType} onChange={handleChange} options={viewTypes} optionFilterProp="label" showSearch />;
};
OrbatViewSelector.propTypes = {
  viewType: PropTypes.string,
  handleChange: PropTypes.func,
  t: PropTypes.func,
};

const ORBAT_Label = ({ option, viewType }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let isMounted = true;
    Meteor.callAsync('orbat.popover.items', option.id)
      .then(data => {
        if (isMounted) setItems(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [option.id]);

  if (viewType === 'advanced') {
    return <ORBAT_AdvancedLabel option={option} items={items} />;
  }
  return <ORBAT_SimpleLabel option={option} items={items} />;
};
ORBAT_Label.propTypes = {
  option: PropTypes.object,
  viewType: PropTypes.string,
};

const ORBAT_SimpleLabel = ({ option, items }) => {
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
          src={option.src}
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
ORBAT_SimpleLabel.propTypes = {
  option: PropTypes.object,
  items: PropTypes.array,
};

const ORBAT_AdvancedLabel = ({ option, items }) => {
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
          items.map((item, index) => (
            <div key={index}>
              <Typography.Text strong>{item.label}</Typography.Text>{' '}
              <Typography.Text>{item.children}</Typography.Text>
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
ORBAT_AdvancedLabel.propTypes = {
  option: PropTypes.object,
  items: PropTypes.array,
};
