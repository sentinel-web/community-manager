import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import useDrawerFrame from './useDrawerFrame';

interface DrawerFooterProps {
  children: ReactNode;
}

/**
 * Pins footer content (action buttons) to the bottom of the current Drawer by
 * portaling it into the frame's footer slot, while the body scrolls.
 *
 * Because a portal preserves the React tree (only the DOM target moves), the
 * children remain React descendants of the surrounding <Form> — so antd's
 * disabled context (e.g. `disabled={loading}`) still reaches buttons rendered
 * here. The footer DOM lives outside the <form> element, though, so a submit
 * button can't use htmlType="submit"; call `form.submit()` (or, for the generic
 * FormFooter, `form.requestSubmit()`) from an onClick handler instead.
 *
 * DrawerFooter itself renders inside the <Form> (only its children are
 * portaled), so it emits one hidden submit button at its own location. That
 * restores the form's default button — without it, native Enter-to-submit would
 * be lost once the visible submit button moved out of the form element. It is
 * positioned off-screen rather than `display: none`, since some browsers skip
 * `display: none` buttons during implicit (Enter-key) submission.
 */
const hiddenSubmitStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  border: 0,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
};

export default function DrawerFooter({ children }: DrawerFooterProps) {
  const { footerContainer } = useDrawerFrame();
  return (
    <>
      <button type="submit" tabIndex={-1} aria-hidden style={hiddenSubmitStyle} />
      {footerContainer ? createPortal(children, footerContainer) : null}
    </>
  );
}
