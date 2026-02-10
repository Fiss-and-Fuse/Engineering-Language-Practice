/**
 * StepIndicator — shows progress through the exercise steps.
 */

import { STEP_ORDER, STEP_LABELS, type ExerciseStep } from "../types";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: ExerciseStep;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      {STEP_ORDER.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = step === currentStep;
        const isPending = index > currentIndex;

        return (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                fontSize: "11px",
                fontWeight: 600,
                background: isComplete
                  ? "#22c55e"
                  : isCurrent
                  ? "#3b82f6"
                  : "rgba(255,255,255,0.1)",
                color: isComplete || isCurrent ? "white" : "#64748b",
                border: isPending ? "1px solid rgba(255,255,255,0.2)" : "none",
              }}
            >
              {isComplete ? <Check size={12} /> : index + 1}
            </div>
            {isCurrent && (
              <span
                style={{
                  fontSize: "12px",
                  color: "#e2e8f0",
                  fontWeight: 500,
                  marginLeft: "4px",
                }}
              >
                {STEP_LABELS[step]}
              </span>
            )}
            {index < STEP_ORDER.length - 1 && (
              <div
                style={{
                  width: "16px",
                  height: "2px",
                  background: isComplete ? "#22c55e" : "rgba(255,255,255,0.1)",
                  marginLeft: "4px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
