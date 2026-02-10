import type { ReviewFeedback, ImprovementData, TokenUsage } from "../types";
import { Star, Target, CheckCircle, XCircle, TrendingUp, DollarSign } from "lucide-react";

interface FeedbackPanelProps {
  feedback: ReviewFeedback;
  improvement: ImprovementData | null;
  tokenUsage: TokenUsage | null;
  onNewSession: () => void;
}

function scoreColor(score: number): string {
  if (score >= 4) return "#22c55e";
  if (score >= 3) return "#eab308";
  return "#ef4444";
}

function ScoreStars({ score }: { score: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} fill={i <= score ? scoreColor(score) : "transparent"} stroke={i <= score ? scoreColor(score) : "#475569"} strokeWidth={1.5} />
      ))}
    </div>
  );
}

function ScoreRow({ score, label }: { score: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "13px", color: "#94a3b8", minWidth: "140px" }}>{label}</span>
      <ScoreStars score={score} />
      <span style={{ fontSize: "14px", fontWeight: 600, color: scoreColor(score) }}>{score}/5</span>
    </div>
  );
}

function Card({ title, score, feedback, children }: { title: string; score: number; feedback: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "20px", marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ margin: 0, fontSize: "15px", color: "#e2e8f0" }}>{title}</h4>
        <ScoreStars score={score} />
      </div>
      <p style={{ margin: 0, fontSize: "14px", color: "#cbd5e1", lineHeight: 1.7 }}>{feedback}</p>
      {children}
    </div>
  );
}

function ConceptSection({ label, found, missed, feedback }: { label: string; found: string[]; missed: string[]; feedback: string }) {
  return (
    <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <h5 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#94a3b8" }}>{label}</h5>
      {found.map((item, i) => (
        <div key={"f" + i} style={{ display: "flex", gap: "6px", alignItems: "flex-start", marginBottom: "4px" }}>
          <CheckCircle size={14} style={{ color: "#22c55e", marginTop: "2px", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", color: "#cbd5e1" }}>{item}</span>
        </div>
      ))}
      {missed.map((item, i) => (
        <div key={"m" + i} style={{ display: "flex", gap: "6px", alignItems: "flex-start", marginBottom: "4px" }}>
          <XCircle size={14} style={{ color: "#ef4444", marginTop: "2px", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>{item}</span>
        </div>
      ))}
      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>{feedback}</p>
    </div>
  );
}

export default function FeedbackPanel({ feedback: f, improvement, tokenUsage, onNewSession }: FeedbackPanelProps) {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      {/* Overall Score */}
      <div style={{ textAlign: "center", padding: "32px", marginBottom: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}>
        <div style={{ fontSize: "64px", fontWeight: 800, color: scoreColor(f.overall.score), lineHeight: 1 }}>
          {f.overall.score}<span style={{ fontSize: "24px", color: "#64748b" }}>/5</span>
        </div>
        <p style={{ margin: "16px auto 0", fontSize: "16px", color: "#cbd5e1", lineHeight: 1.7, maxWidth: "600px" }}>{f.overall.summary}</p>
        <div style={{ marginTop: "16px", padding: "12px 20px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "8px", display: "inline-block" }}>
          <Target size={14} style={{ display: "inline", marginRight: "8px", color: "#60a5fa", verticalAlign: "middle" }} />
          <span style={{ fontSize: "14px", color: "#93c5fd" }}>Focus next time: {f.overall.top_improvement}</span>
        </div>
      </div>

      {/* Score Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px", padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
        <ScoreRow score={f.deliverable_understanding.score} label="Understanding" />
        <ScoreRow score={f.note_quality.score} label="Note Quality" />
        <ScoreRow score={f.note_efficiency.score} label="Efficiency" />
        <ScoreRow score={f.data_predictions.score} label="Predictions" />
        <ScoreRow score={f.data_analysis.score} label="Data Analysis" />
        <ScoreRow score={f.formatting.score} label="Formatting" />
      </div>

      {/* Detail Cards */}
      <Card title="Deliverable Understanding" score={f.deliverable_understanding.score} feedback={f.deliverable_understanding.feedback} />
      <Card title="Note Quality & Grammar" score={f.note_quality.score} feedback={f.note_quality.feedback} />
      <Card title="Note Efficiency" score={f.note_efficiency.score} feedback={f.note_efficiency.feedback} />

      {/* Concept Extraction */}
      <Card title="Concept Extraction" score={Math.round((f.data_predictions.score + f.data_analysis.score) / 2)} feedback="How well you identified key information from each document:">
        <ConceptSection label="Document 1" found={f.concept_extraction.doc1.found} missed={f.concept_extraction.doc1.missed} feedback={f.concept_extraction.doc1.feedback} />
        <ConceptSection label="Document 2" found={f.concept_extraction.doc2.found} missed={f.concept_extraction.doc2.missed} feedback={f.concept_extraction.doc2.feedback} />
        <ConceptSection label="Document 3" found={f.concept_extraction.doc3.found} missed={f.concept_extraction.doc3.missed} feedback={f.concept_extraction.doc3.feedback} />
      </Card>

      {/* Data Predictions */}
      <Card title="Data Predictions" score={f.data_predictions.score} feedback={f.data_predictions.feedback}>
        {f.data_predictions.correct_predictions.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            {f.data_predictions.correct_predictions.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                <CheckCircle size={14} style={{ color: "#22c55e", marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#cbd5e1" }}>{p}</span>
              </div>
            ))}
          </div>
        )}
        {f.data_predictions.missed_predictions.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            {f.data_predictions.missed_predictions.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                <XCircle size={14} style={{ color: "#ef4444", marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>{p}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Data Analysis */}
      <Card title="Data Analysis" score={f.data_analysis.score} feedback={f.data_analysis.feedback}>
        {f.data_analysis.correct_observations.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            {f.data_analysis.correct_observations.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                <CheckCircle size={14} style={{ color: "#22c55e", marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#cbd5e1" }}>{o}</span>
              </div>
            ))}
          </div>
        )}
        {f.data_analysis.missed_observations.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            {f.data_analysis.missed_observations.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                <XCircle size={14} style={{ color: "#ef4444", marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>{o}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Formatting" score={f.formatting.score} feedback={f.formatting.feedback} />

      {/* Improvement Comparison */}
      {improvement && (
        <div style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: "10px", padding: "20px", marginBottom: "12px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", color: "#93c5fd", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={18} /> Progress Over Time
          </h4>
          <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#cbd5e1" }}>{improvement.overall_trend}</p>
          {improvement.improvements.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em" }}>Improvements</span>
              {improvement.improvements.map((item, i) => (
                <p key={i} style={{ margin: "4px 0", fontSize: "13px", color: "#cbd5e1" }}>• {item}</p>
              ))}
            </div>
          )}
          {improvement.persistent_issues.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "#eab308", textTransform: "uppercase", letterSpacing: "0.05em" }}>Still Working On</span>
              {improvement.persistent_issues.map((item, i) => (
                <p key={i} style={{ margin: "4px 0", fontSize: "13px", color: "#94a3b8" }}>• {item}</p>
              ))}
            </div>
          )}
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(59,130,246,0.1)", borderRadius: "6px" }}>
            <span style={{ fontSize: "13px", color: "#93c5fd" }}>Next session focus: {improvement.recommendation}</span>
          </div>
        </div>
      )}

      {/* Cost Summary */}
      {tokenUsage && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", marginBottom: "24px" }}>
          <DollarSign size={16} style={{ color: "#64748b" }} />
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            Session cost: ${tokenUsage.estimated_cost.toFixed(2)} — {tokenUsage.total_input_tokens.toLocaleString()} input + {tokenUsage.total_output_tokens.toLocaleString()} output tokens ({tokenUsage.call_count} API calls)
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <button
          onClick={onNewSession}
          style={{
            padding: "12px 32px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          New Session
        </button>
      </div>
    </div>
  );
}
