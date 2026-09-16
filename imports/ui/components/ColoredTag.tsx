import { CloseOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import type { TagProps } from 'antd';
import React from 'react';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import toOpaqueColor from '../../helpers/colors/toOpaqueColor';

// antd's own preset names carry matching background/text styling, so they are passed through untouched.
const PRESET_COLORS = new Set([
  'blue',
  'cyan',
  'default',
  'error',
  'geekblue',
  'gold',
  'green',
  'lime',
  'magenta',
  'orange',
  'pink',
  'processing',
  'purple',
  'red',
  'success',
  'volcano',
  'warning',
]);

interface ColoredTagProps extends Omit<TagProps, 'color'> {
  color?: string | null;
}

/**
 * antd `Tag` for user-chosen entity colors. antd forces white text on any non-preset `color`, which is
 * unreadable on light backgrounds, so this sets the WCAG-legible text color (black or white) instead —
 * on the tag and on its close icon, which antd styles separately. An empty, preset or unparseable color
 * renders a plain Tag with the theme's own text color.
 */
export default function ColoredTag({ color, style, children, ...tagProps }: ColoredTagProps) {
  // Alpha is dropped so the painted background matches the one the text color is computed from —
  // a legacy `#rrggbbaa` value would otherwise be measured opaque but painted translucent.
  const background = toOpaqueColor(color);
  const textColor = getLegibleTextColor(background);
  const presetColor = !!color && PRESET_COLORS.has(color);

  return (
    <Tag
      {...tagProps}
      color={presetColor ? (color as string) : background}
      style={textColor ? { color: textColor, ...style } : style}
      closeIcon={textColor && tagProps.closable ? <CloseOutlined style={{ color: textColor }} /> : tagProps.closeIcon}
    >
      {children}
    </Tag>
  );
}
