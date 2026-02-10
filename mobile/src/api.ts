/**
 * API client for Quick Engineering Practice mobile app.
 */

export interface QuickScenario {
  session_id: string;
  question: string;
  documents: Array<{
    title: string;
    bullets: string[];
  }>;
  timer_seconds: number;
}

export interface QuickFeedback {
  score: number;
  key_facts_identified: string[];
  key_facts_missed: string[];
  language_feedback: string;
  structure_feedback: string;
  density_suggestion: string;
  ideal_response: string;
  overall_comment: string;
}

export interface QuickSession {
  session_id: string;
  timestamp: string;
  duration_mode: string;
  question: string;
  user_response: string;
  feedback: QuickFeedback;
  device: string;
}

const BASE_URL = "";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }
  return response.json();
}

const api = {
  /** Start a new quick practice session */
  startQuick(durationMode: "5min" | "10min" | "20min"): Promise<QuickScenario> {
    return fetchJson<QuickScenario>("/api/quick/start", {
      method: "POST",
      body: JSON.stringify({ duration_mode: durationMode }),
    });
  },

  /** Submit response and get grading */
  submitQuick(
    sessionId: string,
    response: string,
    timeUsed: number,
    device: string
  ): Promise<{ feedback: QuickFeedback }> {
    return fetchJson("/api/quick/" + sessionId + "/submit", {
      method: "POST",
      body: JSON.stringify({ response, time_used: timeUsed, device }),
    });
  },

  /** List past quick sessions */
  listQuickSessions(): Promise<{ sessions: QuickSession[] }> {
    return fetchJson("/api/quick/sessions");
  },
};

export default api;
