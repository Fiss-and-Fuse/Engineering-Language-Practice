/**
 * useSession — manages the complete session lifecycle.
 *
 * THIS IS ESSENTIALLY A STATE MACHINE:
 * loading → background_read → request → background_review → doc1 → doc2 → doc3 → predictions → data → reviewing → feedback
 *
 * The background document is shown twice:
 * 1. Before the request (first read, take initial notes)
 * 2. After the request (review with context, take more notes)
 */

import { useState, useCallback } from "react";
import api from "../api";
import type {
  ExerciseStep,
  ClientRequest,
  Document,
  DataArtifact,
  ReviewFeedback,
  ImprovementData,
  TokenUsage,
  TimerConfig,
} from "../types";

interface SessionState {
  /** Current step in the exercise */
  step: ExerciseStep;
  /** Session ID from the backend */
  sessionId: string | null;
  /** Background/theory document */
  background: Document | null;
  /** The client's request */
  request: ClientRequest | null;
  /** Documents, loaded one at a time */
  documents: (Document | null)[];
  /** Data artifact */
  data: DataArtifact | null;
  /** Timer configuration from backend */
  timerConfig: TimerConfig | null;

  /** User's notes for each step */
  notes: Record<string, string>;
  /** Time spent on each step (seconds) */
  timeUsed: Record<string, number>;

  /** AI feedback (after review) */
  feedback: ReviewFeedback | null;
  /** Improvement comparison (optional) */
  improvement: ImprovementData | null;
  /** Token usage info */
  tokenUsage: TokenUsage | null;

  /** Error message if something goes wrong */
  error: string | null;
  /** Is an API call in progress? */
  isLoading: boolean;
}

const initialState: SessionState = {
  step: "background_read",
  sessionId: null,
  background: null,
  request: null,
  documents: [null, null, null],
  data: null,
  timerConfig: null,
  notes: {},
  timeUsed: {},
  feedback: null,
  improvement: null,
  tokenUsage: null,
  error: null,
  isLoading: false,
};

export function useSession() {
  const [state, setState] = useState<SessionState>(initialState);

  /**
   * Start a new session.
   * Calls the backend, which calls Claude to generate the scenario.
   */
  const startSession = useCallback(async () => {
    setState((prev) => ({ ...prev, step: "loading", isLoading: true, error: null }));

    try {
      const result = await api.startSession();
      setState((prev) => ({
        ...prev,
        step: "background_read",
        sessionId: result.session_id,
        background: result.background,
        request: result.request,
        timerConfig: result.config,
        isLoading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err.message || "Failed to start session",
        isLoading: false,
      }));
    }
  }, []);

  /**
   * Save notes for the current step and advance to the next.
   */
  const submitAndAdvance = useCallback(
    async (currentStep: ExerciseStep, content: string, timeUsed: number) => {
      if (!state.sessionId) return;

      // Map current step → backend field name + next step
      const stepConfig: Record<string, { field: string; next: ExerciseStep }> = {
        background_read: { field: "background_notes", next: "request" },
        request: { field: "deliverable_summary", next: "background_review" },
        background_review: { field: "background_notes", next: "doc1" },
        doc1: { field: "doc1_notes", next: "doc2" },
        doc2: { field: "doc2_notes", next: "doc3" },
        doc3: { field: "doc3_notes", next: "predictions" },
        predictions: { field: "data_predictions", next: "data" },
        data: { field: "data_notes", next: "reviewing" },
      };

      const config = stepConfig[currentStep];
      if (!config) return;

      // Save notes to backend
      api.submitNotes(state.sessionId, config.field, content, timeUsed).catch((err) =>
        console.error("Failed to save notes:", err)
      );

      // Update local state
      const needsLoading = ["doc1", "doc2", "doc3", "data", "reviewing"].includes(config.next);
      setState((prev) => ({
        ...prev,
        notes: { ...prev.notes, [config.field]: content },
        timeUsed: { ...prev.timeUsed, [config.field]: timeUsed },
        step: config.next,
        isLoading: needsLoading,
      }));

      // Load content for the next step
      if (config.next === "doc1" || config.next === "doc2" || config.next === "doc3") {
        const docNum = parseInt(config.next.replace("doc", ""));
        try {
          const result = await api.getDocument(state.sessionId, docNum);
          setState((prev) => {
            const docs = [...prev.documents];
            docs[docNum - 1] = result.document;
            return { ...prev, documents: docs, isLoading: false };
          });
        } catch (err: any) {
          setState((prev) => ({ ...prev, error: err.message, isLoading: false }));
        }
      } else if (config.next === "data") {
        try {
          const result = await api.getData(state.sessionId);
          setState((prev) => ({ ...prev, data: result.data, isLoading: false }));
        } catch (err: any) {
          setState((prev) => ({ ...prev, error: err.message, isLoading: false }));
        }
      } else if (config.next === "reviewing") {
        try {
          setState((prev) => ({ ...prev, isLoading: true }));
          const result = await api.reviewSession(state.sessionId);
          setState((prev) => ({
            ...prev,
            step: "feedback",
            feedback: result.feedback,
            improvement: result.improvement,
            tokenUsage: result.token_usage,
            isLoading: false,
          }));
        } catch (err: any) {
          setState((prev) => ({ ...prev, error: err.message, isLoading: false }));
        }
      }
    },
    [state.sessionId]
  );

  /** Reset everything for a new session */
  const resetSession = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    startSession,
    submitAndAdvance,
    resetSession,
  };
}
