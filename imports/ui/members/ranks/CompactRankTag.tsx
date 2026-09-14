import type { TagProps } from 'antd';
import { Tooltip } from 'antd';
import React from 'react';
import ColoredTag from '../../components/ColoredTag';

interface CompactRankTagProps {
  name: string;
  abbreviation?: string | null;
  color?: string | null;
  description?: string | null;
  style?: TagProps['style'];
}

/**
 * Rank tag for compact places (tables, ORBAT, squad member lists): shows the abbreviation with the full
 * name in the tooltip, and falls back to the full name when the rank has no abbreviation.
 */
export default function CompactRankTag({ name, abbreviation, color, description, style }: CompactRankTagProps) {
  const fullName = abbreviation ? [name, description].filter(Boolean).join(' — ') : description;
  return (
    <Tooltip title={fullName || undefined}>
      <ColoredTag color={color} style={style}>
        {abbreviation || name}
      </ColoredTag>
    </Tooltip>
  );
}
