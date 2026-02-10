import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Clock, ChevronRight, CheckCircle, XCircle, History } from "lucide-react";
import api, { QuickScenario, QuickFeedback, QuickSession } from "./api";

type Screen = "home" | "loading" | "exercise" | "feedback" | "history";
type DurationMode = "2.5min" | "5min" | "10min";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [durationMode, setDurationMode] = useState<DurationMode>("5min");
  const [scenario, setScenario] = useState<QuickScenario | null>(null);
  const [response, setResponse] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<QuickFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QuickSession[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // Detect device type
  const getDevice = () => {
    const ua = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(ua)) return "mobile";
    return "desktop";
  };

  // Timer logic
  useEffect(() => {
    if (screen === "exercise" && timeLeft > 0) {
      timerRef.current = window.setTimeout(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else if (screen === "exercise" && timeLeft === 0 && scenario && !isSubmitting) {
      handleSubmit();
    }
  }, [screen, timeLeft, scenario, isSubmitting, handleSubmit]);

  const handleStart = async () => {
    setScreen("loading");
    setError(null);
    try {
      const data = await api.startQuick(durationMode);
      setScenario(data);
      setTimeLeft(data.timer_seconds);
      startTimeRef.current = Date.now();
      setResponse("");
      setScreen("exercise");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setScreen("home");
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!scenario || isSubmitting) return;
    setIsSubmitting(true);
    const timeUsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const result = await api.submitQuick(scenario.session_id, response, timeUsed, getDevice());
      if (result.feedback) {
        setFeedback(result.feedback);
        setScreen("feedback");
      } else {
        setError("Grading returned empty response");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  }, [scenario, response, isSubmitting]);

  const handleViewHistory = async () => {
    setScreen("loading");
    try {
      const data = await api.listQuickSessions();
      setHistory(data.sessions);
      setScreen("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
      setScreen("home");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Home screen
  if (screen === "home") {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <h1 style={S.title}>Quick Practice</h1>
          <p style={S.subtitle}>Engineering document analysis on the go</p>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.modeSelector}>
            {(["2.5min", "5min", "10min"] as DurationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDurationMode(mode)}
                style={{
                  ...S.modeBtn,
                  background: durationMode === mode ? "#3b82f6" : "rgba(255,255,255,0.05)",
                  borderColor: durationMode === mode ? "#3b82f6" : "rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ fontSize: "18px", fontWeight: 600 }}>{mode}</div>
                <div style={{ fontSize: "12px", color: durationMode === mode ? "#bfdbfe" : "#64748b" }}>
                  {mode === "2.5min" && "5 bullets, 2 docs"}
                  {mode === "5min" && "9-10 bullets, 3 docs"}
                  {mode === "10min" && "15 bullets, 3 docs"}
                </div>
              </button>
            ))}
          </div>

          <button onClick={handleStart} style={S.primaryBtn}>
            Start Practice <ChevronRight size={20} />
          </button>

          <button onClick={handleViewHistory} style={S.ghostBtn}>
            <History size={16} /> View History
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (screen === "loading") {
    return (
      <div style={S.page}>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Loader2 size={36} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#94a3b8", marginTop: "16px" }}>Generating scenario...</p>
        </div>
      </div>
    );
  }

  // Exercise
  if (screen === "exercise" && scenario) {
    const isLowTime = timeLeft <= 30;
    return (
      <div style={S.page}>
        {/* Timer bar */}
        <div style={S.timerBar}>
          <Clock size={16} />
          <span style={{ color: isLowTime ? "#ef4444" : "#e2e8f0", fontWeight: 600 }}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div style={S.exerciseContainer}>
          {/* Question */}
          <div style={S.questionBox}>
            <div style={S.label}>Question</div>
            <div style={S.questionText}>{scenario.question}</div>
          </div>

          {/* Documents */}
          {scenario.documents.map((doc, i) => (
            <div key={i} style={S.docBox}>
              <div style={S.docTitle}>{doc.title}</div>
              <ul style={S.bulletList}>
                {doc.bullets.map((bullet, j) => (
                  <li key={j} style={S.bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}

          {/* Response textarea */}
          <div style={S.responseSection}>
            <div style={S.label}>Your Response (Technical Memo Format)</div>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your response in proper engineering language..."
              style={S.textarea}
              autoFocus
            />
          </div>

          {/* Submit button - visible but mainly for early submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !response.trim()}
            style={{
              ...S.primaryBtn,
              opacity: isSubmitting || !response.trim() ? 0.5 : 1,
              marginTop: "12px",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Submitting...
              </>
            ) : timeLeft === 0 ? (
              <>Submit</>
            ) : (
              <>Submit Early</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Feedback
  if (screen === "feedback") {
    if (!feedback) {
      return (
        <div style={S.page}>
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ color: "#ef4444", marginBottom: "16px" }}>Grading failed to load</div>
            <button onClick={() => setScreen("home")} style={S.primaryBtn}>Back to Home</button>
          </div>
        </div>
      );
    }
    return (
      <div style={S.page}>
        <div style={S.feedbackContainer}>
          <h2 style={S.feedbackTitle}>Feedback</h2>

          {/* Score */}
          <div style={S.scoreBox}>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "#3b82f6" }}>{feedback.score}/10</div>
          </div>

          {/* Key facts */}
          <div style={S.feedbackSection}>
            <div style={{ ...S.label, color: "#4ade80" }}>
              <CheckCircle size={14} /> Key Facts Identified
            </div>
            <ul style={S.feedbackList}>
              {feedback.key_facts_identified.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>

          {feedback.key_facts_missed.length > 0 && (
            <div style={S.feedbackSection}>
              <div style={{ ...S.label, color: "#f97316" }}>
                <XCircle size={14} /> Missed
              </div>
              <ul style={S.feedbackList}>
                {feedback.key_facts_missed.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Language feedback */}
          <div style={S.feedbackSection}>
            <div style={S.label}>Language</div>
            <p style={S.feedbackText}>{feedback.language_feedback}</p>
          </div>

          {/* Structure feedback */}
          <div style={S.feedbackSection}>
            <div style={S.label}>Structure</div>
            <p style={S.feedbackText}>{feedback.structure_feedback}</p>
          </div>

          {/* Density suggestion */}
          <div style={S.feedbackSection}>
            <div style={S.label}>Could Be More Dense?</div>
            <p style={S.feedbackText}>{feedback.density_suggestion}</p>
          </div>

          {/* Ideal response */}
          <div style={S.feedbackSection}>
            <div style={S.label}>Ideal Response</div>
            <div style={S.idealResponse}>{feedback.ideal_response}</div>
          </div>

          {/* Overall */}
          <div style={S.feedbackSection}>
            <div style={S.label}>Overall</div>
            <p style={S.feedbackText}>{feedback.overall_comment}</p>
          </div>

          <button onClick={() => setScreen("home")} style={S.primaryBtn}>
            Done
          </button>
        </div>
      </div>
    );
  }

  // History
  if (screen === "history") {
    return (
      <div style={S.page}>
        <div style={S.historyContainer}>
          <h2 style={S.feedbackTitle}>Practice History</h2>

          {history.length === 0 ? (
            <p style={{ color: "#64748b", textAlign: "center", padding: "40px 0" }}>
              No sessions yet. Start practicing!
            </p>
          ) : (
            history.map((sess) => (
              <div key={sess.session_id} style={S.historyItem}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                    {new Date(sess.timestamp).toLocaleDateString()} - {sess.duration_mode}
                  </span>
                  <span style={{ color: "#3b82f6", fontWeight: 600 }}>{sess.feedback.score}/10</span>
                </div>
                <div style={{ fontSize: "14px", color: "#e2e8f0", marginBottom: "4px" }}>{sess.question}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Device: {sess.device}
                </div>
              </div>
            ))
          )}

          <button onClick={() => setScreen("home")} style={{ ...S.ghostBtn, marginTop: "20px" }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0f1a",
    color: "#e2e8f0",
    padding: "16px",
    paddingBottom: "32px",
  },
  container: {
    maxWidth: "400px",
    margin: "0 auto",
    paddingTop: "60px",
    textAlign: "center",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    marginBottom: "32px",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px",
    padding: "12px",
    color: "#ef4444",
    fontSize: "14px",
    marginBottom: "16px",
  },
  modeSelector: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
  },
  modeBtn: {
    flex: 1,
    padding: "16px 8px",
    border: "1px solid",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    cursor: "pointer",
    textAlign: "center" as const,
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "14px 24px",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "12px 24px",
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "12px",
  },
  timerBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px",
    background: "rgba(15,23,42,0.9)",
    borderRadius: "8px",
    marginBottom: "16px",
    position: "sticky" as const,
    top: "16px",
    zIndex: 50,
  },
  exerciseContainer: {
    maxWidth: "600px",
    margin: "0 auto",
  },
  questionBox: {
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.2)",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "16px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    fontWeight: 600,
    marginBottom: "8px",
  },
  questionText: {
    fontSize: "16px",
    color: "#e2e8f0",
    lineHeight: 1.6,
  },
  docBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
  },
  docTitle: {
    fontSize: "13px",
    color: "#94a3b8",
    fontWeight: 600,
    marginBottom: "10px",
  },
  bulletList: {
    margin: 0,
    paddingLeft: "18px",
  },
  bullet: {
    fontSize: "14px",
    color: "#cbd5e1",
    lineHeight: 1.7,
    marginBottom: "6px",
  },
  responseSection: {
    marginTop: "16px",
  },
  textarea: {
    width: "100%",
    minHeight: "180px",
    padding: "14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#e2e8f0",
    fontSize: "15px",
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.6,
    resize: "vertical" as const,
    outline: "none",
  },
  feedbackContainer: {
    maxWidth: "500px",
    margin: "0 auto",
    paddingTop: "20px",
  },
  feedbackTitle: {
    fontSize: "22px",
    fontWeight: 700,
    marginBottom: "20px",
    textAlign: "center" as const,
  },
  scoreBox: {
    textAlign: "center" as const,
    padding: "20px",
    background: "rgba(59,130,246,0.1)",
    borderRadius: "12px",
    marginBottom: "20px",
  },
  feedbackSection: {
    marginBottom: "16px",
  },
  feedbackList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "14px",
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  feedbackText: {
    fontSize: "14px",
    color: "#cbd5e1",
    lineHeight: 1.6,
    margin: 0,
  },
  idealResponse: {
    background: "rgba(34,197,94,0.05)",
    border: "1px solid rgba(34,197,94,0.2)",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "13px",
    color: "#a7f3d0",
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
  },
  historyContainer: {
    maxWidth: "500px",
    margin: "0 auto",
    paddingTop: "20px",
  },
  historyItem: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "10px",
  },
};
