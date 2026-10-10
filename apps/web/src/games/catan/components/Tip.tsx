import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Hint } from '../hints';
import { placeTip } from '../tip-position';

/** How long the mouse rests on something before its hint shows: crossing the board shows none. */
const HOVER_DELAY_MS = 350;
/** What a finger is more likely to be pressing than asking about. */
const CONTROLS = 'button:not(:disabled), select, input, a[href]';

function holdsControl(anchor: Element): boolean {
  return anchor.closest(CONTROLS) !== null || anchor.querySelector(CONTROLS) !== null;
}

/** The box a hint points at. The wrapper of `Tip` has none of its own, so it is its child's. */
function boxOf(anchor: Element): DOMRect {
  const wrapped = getComputedStyle(anchor).display === 'contents' && anchor.firstElementChild;
  return (wrapped || anchor).getBoundingClientRect();
}

function TipBubble({ id, anchor, children }: { id: string; anchor: Element; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // After every render: the words may have changed, and so may where the anchor is.
  useLayoutEffect(() => {
    const place = () => {
      const bubble = ref.current;
      if (!bubble) return;
      const { left, top } = placeTip(boxOf(anchor), bubble.getBoundingClientRect(), {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      });
      bubble.style.left = `${Math.round(left)}px`;
      bubble.style.top = `${Math.round(top)}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  });

  // In the body, so no card clips it and nothing it sits in restyles it.
  return createPortal(
    <div ref={ref} id={id} role="tooltip" className="catan-tip-bubble">
      {children}
    </div>,
    document.body,
  );
}

/**
 * Hints for a group of things, one shown at a time. A mouse shows a hint by resting on its
 * anchor and the keyboard by focusing it. A finger shows it by touching the anchor, unless the
 * anchor is a control: touching that uses it. `press` is for a control that is only there to
 * show its hint.
 */
export function useTips() {
  const id = useId();
  const [open, setOpen] = useState<{ key: string; anchor: Element } | null>(null);
  // The anchor last asked about, known before React has drawn its hint.
  const current = useRef<Element | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((key: string, anchor: Element) => {
    window.clearTimeout(timer.current);
    current.current = anchor;
    setOpen({ key, anchor });
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    current.current = null;
    setOpen(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    // A finger never leaves the way a mouse does: touching anything else puts the hint away.
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node && current.current?.contains(event.target))) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, hide]);

  return {
    /** What to spread on the element a hint explains. */
    anchor: (key: string, press = false) => ({
      onPointerEnter(event: PointerEvent<Element>) {
        const target = event.currentTarget;
        if (event.pointerType !== 'touch') {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => show(key, target), HOVER_DELAY_MS);
        } else if (press || !holdsControl(target)) {
          show(key, target);
        }
      },
      onPointerLeave(event: PointerEvent<Element>) {
        if (event.pointerType !== 'touch') hide();
      },
      // Pressing a control is not asking about it.
      onPointerDown(event: PointerEvent<Element>) {
        if (event.pointerType !== 'touch' && !press) hide();
      },
      onFocus(event: FocusEvent<Element>) {
        if (event.target.matches(':focus-visible')) show(key, event.currentTarget);
      },
      onBlur: hide,
      ...(press && { onClick: (event: MouseEvent<Element>) => show(key, event.currentTarget) }),
    }),
    /** For `aria-describedby` on the control a hint explains. */
    describedBy: (key: string) => (open?.key === key ? id : undefined),
    /** The hint itself, when it is the one showing. It may be rendered anywhere. */
    bubble: (key: string, content: ReactNode) =>
      open?.key === key ? (
        <TipBubble id={id} anchor={open.anchor}>
          {content}
        </TipBubble>
      ) : null,
  };
}

/**
 * Wraps one thing in its hint. A wrapper, so that a disabled button can still be asked about;
 * it has no box of its own, so the table is laid out as if it were not there.
 */
export function Tip({
  hint,
  press,
  children,
}: {
  hint: ReactNode;
  /** The child is a button whose only job is to show this hint. */
  press?: boolean;
  children: ReactNode;
}) {
  const tips = useTips();
  return (
    <span className="catan-tip" {...tips.anchor('tip', press)}>
      {isValidElement<{ 'aria-describedby'?: string }>(children) &&
      typeof children.type === 'string'
        ? cloneElement(children, { 'aria-describedby': tips.describedBy('tip') })
        : children}
      {tips.bubble('tip', hint)}
    </span>
  );
}

/** A hint laid out: its title, then whatever the caller adds (a cost), its body and advice. */
export function HintText({ hint, children }: { hint: Hint; children?: ReactNode }) {
  return (
    <>
      {hint.title && <strong>{hint.title}</strong>}
      {children}
      <span>{hint.body}</span>
      {hint.advice && <span className="muted">{hint.advice}</span>}
    </>
  );
}
