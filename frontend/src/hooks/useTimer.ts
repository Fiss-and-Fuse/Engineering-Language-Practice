/**
 * useTimer — a custom React hook for countdown timers.
 * 
 * WHY A CUSTOM HOOK:
 * React hooks let you extract reusable stateful logic. Every step
 * in our exercise uses a countdown timer, so instead of duplicating
 * timer code in each component, we write it once here.
 * 
 * HOW REACT HOOKS WORK (refresher):
 * - useState(initialValue) → [currentValue, setterFunction]
 *   React re-renders the component when the value changes.
 * - useEffect(callback, dependencies) → runs the callback when
 *   dependencies change. Used for side effects like setInterval.
 * - useCallback(fn, deps) → memoizes a function so it doesn't get
 *   recreated on every render (important for preventing infinite loops).
 * - useRef(initial) → a mutable container that persists across renders
 *   without causing re-renders when changed. Perfect for interval IDs.
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTimerOptions {
  /** Total duration in seconds */
  duration: number;
  /** Called when timer hits 0 */
  onExpire?: () => void;
  /** Called when 1 minute remains */
  onWarning?: () => void;
  /** Start automatically? Default: true */
  autoStart?: boolean;
}

interface UseTimerReturn {
  /** Seconds remaining */
  timeLeft: number;
  /** Is the timer currently counting down? */
  isRunning: boolean;
  /** Is the timer in warning state (< 60 seconds)? */
  isWarning: boolean;
  /** Has the timer expired? */
  isExpired: boolean;
  /** Formatted time string like "5:23" */
  display: string;
  /** Percentage of time remaining (0-100) */
  percent: number;
  /** Start or resume the timer */
  start: () => void;
  /** Pause the timer */
  pause: () => void;
  /** Reset to initial duration */
  reset: () => void;
}

export function useTimer({
  duration,
  onExpire,
  onWarning,
  autoStart = true,
}: UseTimerOptions): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);

  /**
   * useRef for the interval ID.
   * 
   * WHY NOT useState:
   * We need to store the interval ID to clear it later, but we don't
   * want changing it to trigger a re-render. useRef is perfect for
   * "mutable values that don't affect rendering."
   */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Track whether we've already fired the warning callback.
   * Without this, onWarning would fire every second during the
   * last minute (once per tick).
   */
  const warningFiredRef = useRef(false);
  const expireFiredRef = useRef(false);

  // Derived state — computed from timeLeft, not stored separately
  const isWarning = timeLeft <= 60 && timeLeft > 0;
  const isExpired = timeLeft <= 0;

  /**
   * Format seconds into "M:SS" display.
   * 
   * WHY Math.floor AND padStart:
   * - Math.floor(323/60) = 5 (minutes)
   * - 323 % 60 = 23 (remaining seconds)
   * - padStart(2, "0") ensures "5:03" not "5:3"
   */
  const display = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60)
    .toString()
    .padStart(2, "0")}`;

  const percent = (timeLeft / duration) * 100;

  // Memoized control functions
  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setTimeLeft(duration);
    setIsRunning(false);
    warningFiredRef.current = false;
    expireFiredRef.current = false;
  }, [duration]);

  /**
   * The main timer effect.
   * 
   * HOW useEffect CLEANUP WORKS:
   * The function returned from useEffect runs when:
   *   1. The component unmounts (cleanup)
   *   2. Before the effect re-runs (dependency changed)
   * 
   * We use this to clear the interval — otherwise it would keep
   * ticking even after the component is removed from the page.
   */
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;

          // Fire warning at 60 seconds
          if (next <= 60 && !warningFiredRef.current) {
            warningFiredRef.current = true;
            onWarning?.();
          }

          // Fire expire at 0
          if (next <= 0 && !expireFiredRef.current) {
            expireFiredRef.current = true;
            onExpire?.();
          }

          return Math.max(0, next);
        });
      }, 1000);
    }

    // Cleanup: clear interval when effect re-runs or component unmounts
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timeLeft > 0, onExpire, onWarning]);

  return {
    timeLeft,
    isRunning,
    isWarning,
    isExpired,
    display,
    percent,
    start,
    pause,
    reset,
  };
}
