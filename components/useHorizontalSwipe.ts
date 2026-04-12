import { useRef } from 'react';
import type { TouchEventHandler } from 'react';

interface UseHorizontalSwipeOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  minHorizontalDistance?: number;
  maxVerticalDistance?: number;
  suppressClickDurationMs?: number;
}

interface TouchPoint {
  x: number;
  y: number;
}

const DEFAULT_MIN_HORIZONTAL_DISTANCE = 56;
const DEFAULT_MAX_VERTICAL_DISTANCE = 48;
const DEFAULT_SUPPRESS_CLICK_DURATION_MS = 400;

export const useHorizontalSwipe = ({
  onSwipeLeft,
  onSwipeRight,
  minHorizontalDistance = DEFAULT_MIN_HORIZONTAL_DISTANCE,
  maxVerticalDistance = DEFAULT_MAX_VERTICAL_DISTANCE,
  suppressClickDurationMs = DEFAULT_SUPPRESS_CLICK_DURATION_MS,
}: UseHorizontalSwipeOptions) => {
  const touchStartRef = useRef<TouchPoint | null>(null);
  const suppressClickUntilRef = useRef(0);

  const onTouchStart: TouchEventHandler<HTMLElement> = (event) => {
    if (event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd: TouchEventHandler<HTMLElement> = (event) => {
    const touchStart = touchStartRef.current;
    touchStartRef.current = null;

    if (!touchStart || event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX < minHorizontalDistance || absDeltaY > maxVerticalDistance || absDeltaX <= absDeltaY) {
      return;
    }

    suppressClickUntilRef.current = Date.now() + suppressClickDurationMs;

    if (deltaX < 0) {
      onSwipeLeft();
      return;
    }

    onSwipeRight();
  };

  const shouldSuppressClick = () => Date.now() < suppressClickUntilRef.current;

  return {
    swipeHandlers: {
      onTouchStart,
      onTouchEnd,
    },
    shouldSuppressClick,
  };
};
