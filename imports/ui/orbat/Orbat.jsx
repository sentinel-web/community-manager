import { Card, Descriptions, Empty, Popover, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import { turnBase64ToImage } from '../profile-picture-input/ProfilePictureInput';

export default function Orbat() {
  const [ready, setReady] = useState(true);
  const [squads, setSquads] = useState([]);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    setReady(false);
    Meteor.callAsync('orbat.squads')
      .then(squads => {
        setSquads(squads);
        setReady(true);
      })
      .catch(error => {
        console.error(error);
        setReady(true);
      });
  }, []);

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

  const mapOption = option => {
    return (
      <TreeNode key={option.id} label={<ORBAT_Label option={option} />}>
        {option.children?.map(mapOption)}
      </TreeNode>
    );
  };

  return (
    <Card loading={!ready} title={<Typography.Title level={3}>ORBAT</Typography.Title>}>
      <div style={{ overflow: 'auto' }}>
        {options?.length === 0 && <Empty />}
        {options.map(option => {
          return (
            <Tree key={option.id} label={<ORBAT_Label option={option} />}>
              {option.children?.map(mapOption)}
            </Tree>
          );
        })}
      </div>
    </Card>
  );
}

const ORBAT_Label = ({ option }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    Meteor.callAsync('orbat.popover.items', option.id).then(setItems).catch(console.error);
  }, [option.id]);
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
ORBAT_Label.propTypes = {
  option: PropTypes.object,
};
