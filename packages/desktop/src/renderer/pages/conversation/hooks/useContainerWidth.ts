import { useEffect, useRef, useState } from 'react';

type UseContainerWidthReturn = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerWidth: number;
};

/**
 * Width settle delay. While the sider width transition runs (0.2s) the observed
 * row resizes every frame; committing each intermediate value re-rendered the
 * whole Layout — and its route subtree — once per frame for the duration of the
 * animation. Consumers (explorer / preview clamps) only need the resting width,
 * so intermediate values are coalesced and the commit is deferred until the
 * size stops changing.
 */
const WIDTH_SETTLE_MS = 120;

/**
 * Tracks the width of a container element using ResizeObserver,
 * falling back to window.innerWidth when the element is not yet mounted.
 */
export function useContainerWidth(): UseContainerWidthReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      setContainerWidth(typeof window === 'undefined' ? 0 : window.innerWidth);
      return;
    }
    setContainerWidth(element.offsetWidth);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const width = entries[0].contentRect.width;
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        setContainerWidth(width);
      }, WIDTH_SETTLE_MS);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, []);

  return { containerRef, containerWidth };
}
