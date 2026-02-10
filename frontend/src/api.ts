/**
 * API client — all fetch calls to the backend.
 * 
 * WHY A SEPARATE FILE:
 * Components should focus on rendering, not on HTTP details.
 * This file handles:
 *   - Constructing URLs
 *   - Setting headers
 *   - Parsing JSON responses
 *   - Error handling
 * 
 * Components just call e.g. `api.startSession()` and get back typed data.
 * 
 * WHY NOT AXIOS:
 * The built-in `fetch` API is good enough for our needs. Axios adds
 * a dependency for features we don't use (interceptors, cancelation, etc).
 */

import type {
  StartSessionResponse,
  DocumentResponse,
  DataResponse,
  ReviewResponse,
  AppConfig,
  SessionSummary,
} from "./types";

/**
 * Base URL for the API.
 * 
 * WHY THIS PATTERN:
 * During development, the frontend runs on port 5173 (Vite) and
 * the backend on port 8000 (FastAPI). We need the full URL.
 * In production (when frontend is built and served by FastAPI),
 * we can use relative paths.
 * 
 * The `import.meta.env.DEV` check is Vite's way of knowing if
 * we're in dev mode or production.
 */
const BASE_URL = "";

/**
 * Generic fetch wrapper with error handling.
 * 
 * WHY GENERIC <T>:
 * TypeScript generics let us say "this function returns whatever type
 * the caller expects." So `fetchJson<StartSessionResponse>(...)` returns
 * a `StartSessionResponse`. The type is checked at compile time.
 */
async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    // Try to get error details from the response body
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {
      // Response wasn't JSON, use status text
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  return response.json();
}

/** All API methods, organized by resource */
const api = {
  /**
   * Start a new training session.
   * This triggers scenario generation (the slow Claude API call).
   */
  startSession(): Promise<StartSessionResponse> {
    return fetchJson<StartSessionResponse>("/api/session/start", {
      method: "POST",
    });
  },

  /** Get document N (1, 2, or 3) for a session */
  getDocument(sessionId: string, docNum: number): Promise<DocumentResponse> {
    return fetchJson<DocumentResponse>(
      `/api/session/${sessionId}/doc/${docNum}`
    );
  },

  /** Get the data artifact for a session */
  getData(sessionId: string): Promise<DataResponse> {
    return fetchJson<DataResponse>(`/api/session/${sessionId}/data`);
  },

  /**
   * Submit notes for a step.
   * 
   * @param sessionId - The active session
   * @param step - Backend field name (e.g. "doc1_notes")
   * @param content - The user's notes text
   * @param timeUsed - Seconds spent on this step
   */
  submitNotes(
    sessionId: string,
    step: string,
    content: string,
    timeUsed: number
  ): Promise<{ status: string; step: string }> {
    return fetchJson("/api/session/" + sessionId + "/submit", {
      method: "POST",
      body: JSON.stringify({ step, content, time_used: timeUsed }),
    });
  },

  /**
   * Review the checklist for a document step.
   * Returns feedback on what parameters were captured vs. missed.
   */
  reviewChecklist(
    sessionId: string,
    docNum: number,
    checklist: Array<{ id: string; parameter: string; check: string }>
  ): Promise<{ feedback: any; cost_so_far: number }> {
    return fetchJson(`/api/session/${sessionId}/review-checklist`, {
      method: "POST",
      body: JSON.stringify({ doc_num: docNum, checklist }),
    });
  },

  /**
   * Trigger AI review of completed session.
   * This is the second big Claude API call.
   */
  reviewSession(sessionId: string): Promise<ReviewResponse> {
    return fetchJson<ReviewResponse>(
      `/api/session/${sessionId}/review`,
      { method: "POST" }
    );
  },

  /** Get current cost estimate for an active session */
  getCost(
    sessionId: string
  ): Promise<{ cost: number; limit: number; tokens: any }> {
    return fetchJson(`/api/cost/${sessionId}`);
  },

  /** Get current app configuration */
  getConfig(): Promise<AppConfig> {
    return fetchJson<AppConfig>("/api/config");
  },

  /** Update app configuration (partial update) */
  updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    return fetchJson<AppConfig>("/api/config", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  /** List all past sessions (summaries) */
  listSessions(): Promise<{ sessions: SessionSummary[] }> {
    return fetchJson("/api/sessions");
  },

  /** Get full session data (for viewing history) */
  getSession(sessionId: string): Promise<any> {
    return fetchJson(`/api/session/${sessionId}`);
  },
};

export default api;
