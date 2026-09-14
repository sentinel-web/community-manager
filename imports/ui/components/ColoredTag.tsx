import { Tag } from 'antd';
import type { TagProps } from 'antd';
import React, { useMemo } from 'react';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';

interface ColoredTagProps extends Omit<TagProps, 'color'> {
  color?: string | null;
}

/**
 * antd `Tag` for user-chosen entity colors. antd forces white text on any non-preset `color`, which is
 * unreadable on light backgrounds, so this sets the WCAG-legible text color (black or white) instead.
 * An empty color renders a plain default Tag with the theme's text color.
 */
export default function ColoredTag({ color, style, children, ...tagProps }: ColoredTagProps) {
  const textColor = useMemo(() => getLegibleTextColor(color), [color]);
  const mergedStyle = useMemo(() => (textColor ? { color: textColor, ...style } : style), [textColor, style]);

  return (
    <Tag {...tagProps} color={color || undefined} style={mergedStyle}>
      {children}
    </Tag>
  );
}
