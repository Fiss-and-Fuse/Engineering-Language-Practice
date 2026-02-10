/**
 * Timer — displays a countdown timer with visual warnings.
 * 
 * DESIGN CHOICES:
 * - Big clear numbers so you can glance at it while reading
 * - Progress bar shows time visually (easier to gauge at a glance than numbers)
 * - Yellow warning state at 1 minute — gentle but noticeable
 * - Red + pulse when expired — "time's up" without being obnoxious
 * - Pause button for bathroom breaks (honor system)
 */

import React from "react";
import { useTimer } from "../hooks/useTimer";
import { Pause, Play, Clock } from "lucide-react";

interface TimerProps {
  duration: number;
  onExpire: () => void;
  label: string;
  onTimeUpdate?: (timeLeft: number, duration: number) => void;
}

export default function Timer({ duration, onExpire, label, onTimeUpdate }: TimerProps) {
  const timer = useTimer({
    duration,
    onExpire,
    autoStart: true,
  });

  // Report time updates to parent
  React.useEffect(() => {
    onTimeUpdate?.(timer.timeLeft, duration);
  }, [timer.timeLeft, duration, onTimeUpdate]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 16px",
        borderRadius: "8px",
        background: timer.isExpired
          ? "rgba(220, 38, 38, 0.1)"
          : timer.isWarning
          ? "rgba(234, 179, 8, 0.1)"
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${
          timer.isExpired
            ? "rgba(220, 38, 38, 0.3)"
            : timer.isWarning
            ? "rgba(234, 179, 8, 0.3)"
            : "rgba(255,255,255,0.1)"
        }`,
        animation: timer.isExpired ? "pulse 1s ease-in-out infinite" : undefined,
      }}
    >
      <Clock
        size={18}
        style={{
          color: timer.isExpired
            ? "#dc2626"
            : timer.isWarning
            ? "#eab308"
            : "#94a3b8",
        }}
      />

      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: timer.isExpired
                ? "#dc2626"
                : timer.isWarning
                ? "#eab308"
                : "#e2e8f0",
            }}
          >
            {timer.display}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "3px",
            borderRadius: "2px",
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${timer.percent}%`,
              borderRadius: "2px",
              background: timer.isExpired
                ? "#dc2626"
                : timer.isWarning
                ? "#eab308"
                : "#3b82f6",
              transition: "width 1s linear",
            }}
          />
        </div>
      </div>

      <button
        onClick={timer.isRunning ? timer.pause : timer.start}
        style={{
          background: "none",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "6px",
          padding: "4px 8px",
          cursor: "pointer",
          color: "#94a3b8",
          display: "flex",
          alignItems: "center",
        }}
        title={timer.isRunning ? "Pause" : "Resume"}
      >
        {timer.isRunning ? <Pause size={14} /> : <Play size={14} />}
      </button>
    </div>
  );
}
