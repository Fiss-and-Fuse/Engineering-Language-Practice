/**
 * TypeScript interfaces for the Engineering Document Practice Tool.
 * 
 * WHY A TYPES FILE:
 * TypeScript interfaces describe the "shape" of our data. By defining
 * them in one place, every component that uses session data gets
 * autocomplete and compile-time error checking. If the backend changes
 * its JSON format, we update types here and TypeScript tells us
 * everywhere that breaks.
 * 
 * INTERFACES vs TYPES:
 * In TypeScript, `interface` and `type` are mostly interchangeable.
 * Convention: use `interface` for object shapes (like these) and
 * `type` for unions, intersections, and aliases.
 */

/** The client's engineering request */
export interface ClientRequest {
  from: string;
  subject: string;
  body: string;
}

/** A single supporting document */
export interface Document {
  title: string;
  content: string;
}

/** The data artifact (table, values, or text output) */
export interface DataArtifact {
  format: "table" | "values" | "text_output";
  description: string;
  content: string;
}

/** Timer configuration from the backend */
export interface TimerConfig {
  timer_request: number;
  timer_document: number;
  timer_predictions: number;
  timer_data: number;
  timer_background: number;  // Half of timer_document, for background reading
}

/** Response from POST /api/session/start */
export interface StartSessionResponse {
  session_id: string;
  background: Document;  // Background/theory document for context
  request: ClientRequest;
  config: TimerConfig;
  cost_so_far: number;
}

/** Response from GET /api/session/{id}/doc/{n} */
export interface DocumentResponse {
  document: Document;
}

/** Response from GET /api/session/{id}/data */
export interface DataResponse {
  data: DataArtifact;
}

/** Feedback for a single document's concept extraction */
export interface DocConceptFeedback {
  found: string[];
  missed: string[];
  feedback: string;
}

/** Scored feedback section */
export interface ScoredFeedback {
  score: number;
  feedback: string;
}

/** Data predictions feedback (has extra fields) */
export interface PredictionFeedback extends ScoredFeedback {
  correct_predictions: string[];
  missed_predictions: string[];
}

/** Data analysis feedback */
export interface AnalysisFeedback extends ScoredFeedback {
  correct_observations: string[];
  missed_observations: string[];
}

/** Overall feedback */
export interface OverallFeedback {
  score: number;
  summary: string;
  top_improvement: string;
}

/** Complete feedback from the AI review */
export interface ReviewFeedback {
  deliverable_understanding: ScoredFeedback;
  note_quality: ScoredFeedback;
  note_efficiency: ScoredFeedback;
  concept_extraction: {
    doc1: DocConceptFeedback;
    doc2: DocConceptFeedback;
    doc3: DocConceptFeedback;
  };
  data_predictions: PredictionFeedback;
  data_analysis: AnalysisFeedback;
  formatting: ScoredFeedback;
  overall: OverallFeedback;
}

/** Improvement comparison (optional, from past sessions) */
export interface ImprovementData {
  improvements: string[];
  persistent_issues: string[];
  new_strengths: string[];
  overall_trend: string;
  recommendation: string;
}

/** Token usage info */
export interface TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  call_count: number;
  estimated_cost: number;
  calls: Array<{
    label: string;
    input_tokens: number;
    output_tokens: number;
  }>;
}

/** Response from POST /api/session/{id}/review */
export interface ReviewResponse {
  feedback: ReviewFeedback;
  improvement: ImprovementData | null;
  token_usage: TokenUsage;
}

/** App configuration */
export interface AppConfig {
  model_key: string;
  model_name: string;
  available_models: Record<string, string>;
  timer_request: number;
  timer_document: number;
  timer_predictions: number;
  timer_data: number;
  cost_limit: number;
  domain: string | null;
  difficulty: string;
}

/** Session list item (summary, not full data) */
export interface SessionSummary {
  session_id: string;
  timestamp: string;
  domain: string;
  difficulty: string;
  model_used: string;
  overall_score: number | null;
  estimated_cost: number | null;
}

/**
 * The steps of the exercise, in order.
 * 
 * WHY AN ENUM-LIKE UNION TYPE:
 * This ensures we can't accidentally use an invalid step name.
 * TypeScript will error if we type "doc4_notes" by mistake.
 */
export type ExerciseStep =
  | "loading"           // Scenario being generated
  | "background_read"   // Read background/theory document (first pass)
  | "request"           // Read the client request
  | "background_review" // Review background document (second pass)
  | "doc1"              // Read document 1
  | "doc2"              // Read document 2
  | "doc3"              // Read document 3
  | "predictions"       // Write data predictions
  | "data"              // Examine data
  | "reviewing"         // AI review in progress
  | "feedback";         // Showing results

/**
 * Maps exercise steps to the submit step names the backend expects.
 * 
 * WHY A CONST OBJECT:
 * This serves as a lookup table. When we need to submit notes for
 * the current step, we look up the backend field name here.
 * `as const` makes TypeScript treat the values as literal strings
 * instead of generic `string` type.
 */
export const STEP_TO_FIELD = {
  background_read: "background_notes",
  request: "deliverable_summary",
  background_review: "background_notes",
  doc1: "doc1_notes",
  doc2: "doc2_notes",
  doc3: "doc3_notes",
  predictions: "data_predictions",
  data: "data_notes",
} as const;

/** Human-readable step labels for the progress indicator */
export const STEP_LABELS: Record<ExerciseStep, string> = {
  loading: "Generating Scenario",
  background_read: "Background",
  request: "Read Request",
  background_review: "Review Background",
  doc1: "Document 1",
  doc2: "Document 2",
  doc3: "Document 3",
  predictions: "Data Predictions",
  data: "Examine Data",
  reviewing: "AI Review",
  feedback: "Feedback",
};

/** Ordered list of active steps (for progress bar) */
export const STEP_ORDER: ExerciseStep[] = [
  "background_read", "request", "background_review", "doc1", "doc2", "doc3", "predictions", "data", "feedback"
];
