import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "./hooks/useSession";
import Timer from "./components/Timer";
import StepIndicator from "./components/StepIndicator";
import NoteEditor from "./components/NoteEditor";
import NotesDrawer from "./components/NotesDrawer";
import DocumentViewer from "./components/DocumentViewer";
import DataViewer from "./components/DataViewer";
import FeedbackPanel from "./components/FeedbackPanel";
import SettingsModal from "./components/SettingsModal";
import ChecklistTable, { type ChecklistRow } from "./components/ChecklistTable";
import api from "./api";
import { Settings, Loader2, FileText, ArrowRight, AlertTriangle, BookOpen } from "lucide-react";

export default function App() {
  const session = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentNotes, setCurrentNotes] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const stepStartRef = useRef<number>(Date.now());

  // Checklist state for document steps
  const [checklists, setChecklists] = useState<Record<string, ChecklistRow[]>>({
    doc1: [],
    doc2: [],
    doc3: [],
  });
  const [checklistFeedback, setChecklistFeedback] = useState<Record<string, any>>({});
  const [isReviewingChecklist, setIsReviewingChecklist] = useState(false);

  // Track timer updates - enable submit when at least half time has passed
  const handleTimeUpdate = useCallback((timeLeft: number, duration: number) => {
    const halfwayPoint = duration / 2;
    setCanSubmit(timeLeft <= halfwayPoint);
  }, []);

  // Load existing notes when entering background_review step
  useEffect(() => {
    if (session.step === "background_review" && session.notes.background_notes) {
      setCurrentNotes(session.notes.background_notes);
    }
  }, [session.step]);

  const getTimeUsed = () => Math.round((Date.now() - stepStartRef.current) / 1000);

  // Get current document step key (doc1, doc2, or doc3)
  const getCurrentDocKey = () => {
    if (session.step === "doc1" || session.step === "doc2" || session.step === "doc3") {
      return session.step;
    }
    return null;
  };

  // Update checklist for current document
  const updateCurrentChecklist = (rows: ChecklistRow[]) => {
    const docKey = getCurrentDocKey();
    if (docKey) {
      setChecklists((prev) => ({ ...prev, [docKey]: rows }));
    }
  };

  // Get checklist for current document
  const getCurrentChecklist = () => {
    const docKey = getCurrentDocKey();
    return docKey ? checklists[docKey] : [];
  };

  // Get feedback for current document
  const getCurrentFeedback = () => {
    const docKey = getCurrentDocKey();
    return docKey ? checklistFeedback[docKey] : null;
  };

  // Check if we can submit on doc steps (must have reviewed checklist first)
  const canSubmitDocStep = () => {
    const docKey = getCurrentDocKey();
    if (!docKey) return true; // Not a doc step
    return !!checklistFeedback[docKey]; // Must have feedback (comes when timer expires)
  };

  const handleSubmit = useCallback(() => {
    const timeUsed = getTimeUsed();
    session.submitAndAdvance(session.step, currentNotes, timeUsed);
    setCurrentNotes("");
    setCanSubmit(false);
    stepStartRef.current = Date.now();
  }, [session, currentNotes]);

  // Handle timer expiration - for doc steps, trigger checklist review instead of auto-submit
  const handleTimerExpire = useCallback(async () => {
    const docKey = getCurrentDocKey();
    if (docKey && session.sessionId) {
      // For document steps, trigger checklist review
      const docNum = parseInt(docKey.replace("doc", ""));
      setIsReviewingChecklist(true);
      try {
        const result = await api.reviewChecklist(session.sessionId, docNum, checklists[docKey]);
        setChecklistFeedback((prev) => ({ ...prev, [docKey]: result.feedback }));
      } catch (err) {
        console.error("Checklist review failed:", err);
        // Still allow proceeding even if review fails
        setChecklistFeedback((prev) => ({ ...prev, [docKey]: { feedback: "Review failed - you may proceed." } }));
      } finally {
        setIsReviewingChecklist(false);
      }
    } else {
      // For non-doc steps, auto-submit as before
      handleSubmit();
    }
  }, [handleSubmit, session.sessionId, checklists]);

  const getTimerDuration = () => {
    if (!session.timerConfig) return 420;
    switch (session.step) {
      case "background_read":
      case "background_review":
        return session.timerConfig.timer_background;
      case "request":
        return session.timerConfig.timer_request;
      case "doc1":
      case "doc2":
      case "doc3":
        return session.timerConfig.timer_document;
      case "predictions":
        return session.timerConfig.timer_predictions;
      case "data":
        return session.timerConfig.timer_data;
      default:
        return 420;
    }
  };

  const getTimerLabel = () => {
    switch (session.step) {
      case "background_read":
        return "Learn concepts";
      case "request":
        return "Read & summarize";
      case "background_review":
        return "Review concepts";
      case "predictions":
        return "Predict data";
      default:
        return "Read & note";
    }
  };

  // Landing page
  if (!session.sessionId && session.step !== "loading") {
    return (
      <div style={S.page}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <h1 style={{ fontSize: "28px", color: "#e2e8f0", fontWeight: 700, margin: "0 0 12px" }}>Engineering Document Trainer</h1>
          <p style={{ fontSize: "16px", color: "#94a3b8", lineHeight: 1.7, margin: "0 0 32px" }}>
            Practice reading engineering documents, extracting key information, and analyzing data under time pressure.
          </p>
          <button onClick={session.startSession} style={S.primaryBtn}><span>Start New Session</span><ArrowRight size={18} /></button>
          <button onClick={() => setSettingsOpen(true)} style={{ ...S.ghostBtn, marginLeft: "12px" }}><Settings size={16} /> Settings</button>
        </div>
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  // Loading
  if (session.step === "loading" || (session.isLoading && !session.background)) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: "center", padding: "120px 20px" }}>
          <Loader2 size={40} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "16px", color: "#94a3b8", marginTop: "20px" }}>Generating your engineering scenario...</p>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>This may take 15-30 seconds.</p>
        </div>
      </div>
    );
  }

  // Error
  if (session.error) {
    return (
      <div style={S.page}>
        <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center", padding: "80px 20px" }}>
          <AlertTriangle size={40} style={{ color: "#ef4444" }} />
          <h2 style={{ fontSize: "20px", color: "#e2e8f0", margin: "16px 0 8px" }}>Something went wrong</h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.7, margin: "0 0 24px" }}>{session.error}</p>
          <button onClick={session.resetSession} style={S.primaryBtn}>Try Again</button>
        </div>
      </div>
    );
  }

  // Reviewing
  if (session.step === "reviewing") {
    return (
      <div style={S.page}>
        <div style={{ textAlign: "center", padding: "120px 20px" }}>
          <Loader2 size={40} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "16px", color: "#94a3b8", marginTop: "20px" }}>Claude is reviewing your work...</p>
        </div>
      </div>
    );
  }

  // Feedback
  if (session.step === "feedback" && session.feedback) {
    return (
      <div style={S.page}>
        <FeedbackPanel feedback={session.feedback} improvement={session.improvement} tokenUsage={session.tokenUsage} onNewSession={session.resetSession} />
      </div>
    );
  }

  // Active exercise steps
  const isDocStep = session.step === "doc1" || session.step === "doc2" || session.step === "doc3";
  const isBackgroundStep = session.step === "background_read" || session.step === "background_review";
  const docNum = isDocStep ? parseInt(session.step.replace("doc", "")) : 0;
  const currentDoc = isDocStep ? session.documents[docNum - 1] : null;
  const hasPreviousNotes = Object.keys(session.notes).length > 0;

  // Show request in sidebar for document steps
  const showRequestSidebar = isDocStep || session.step === "background_review" || session.step === "predictions" || session.step === "data";

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        <StepIndicator currentStep={session.step} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Timer
            key={session.step}
            duration={getTimerDuration()}
            onExpire={handleTimerExpire}
            onTimeUpdate={handleTimeUpdate}
            label={getTimerLabel()}
          />
          <button onClick={() => setSettingsOpen(true)} style={S.iconBtn}><Settings size={16} /></button>
          <button
            onClick={() => {
              if (confirm("Exit this session? Your progress will not be saved.")) {
                session.resetSession();
              }
            }}
            style={{ ...S.iconBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
            title="Exit session"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={S.content}>
        {/* Background read step (first pass - before seeing the request) */}
        {session.step === "background_read" && session.background && (
          <div style={S.split}>
            <div>
              <div style={S.secHeader}><BookOpen size={18} style={{ color: "#64748b" }} /><span>Background Reading</span></div>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 12px" }}>
                Read this background document to understand the concepts you'll need for this exercise.
              </p>
              <DocumentViewer document={session.background} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={S.secHeader}><span>Concept Notes</span></div>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px" }}>
                Note key terms, principles, and relationships you'll need to remember.
              </p>
              <NoteEditor value={currentNotes} onChange={setCurrentNotes} height={400} placeholder="• Key concept: ...\n• Important relationship: ...\n• Normal range for X is..." />
            </div>
          </div>
        )}

        {/* Request step */}
        {session.step === "request" && session.request && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={S.secHeader}><FileText size={18} style={{ color: "#64748b" }} /><span>Client Request</span></div>
            <div style={S.card}>
              <div style={{ marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>From: {session.request.from}</div>
              <div style={{ marginBottom: "16px", fontSize: "16px", color: "#e2e8f0", fontWeight: 600 }}>RE: {session.request.subject}</div>
              <div style={{ fontSize: "15px", color: "#cbd5e1", lineHeight: 1.8 }}>
                {session.request.body.split("\n\n").map((p, i) => <p key={i} style={{ margin: "0 0 14px 0" }}>{p}</p>)}
              </div>
            </div>
            <div style={{ marginTop: "20px" }}>
              <div style={S.secHeader}><span>What should the deliverable look like?</span></div>
              <NoteEditor value={currentNotes} onChange={setCurrentNotes} placeholder="Describe the format, content, and key elements you'd include in the deliverable..." height={200} />
            </div>
          </div>
        )}

        {/* Background review step (second pass - after seeing the request) */}
        {session.step === "background_review" && session.background && (
          <div style={S.split}>
            <div>
              <div style={S.secHeader}><BookOpen size={18} style={{ color: "#64748b" }} /><span>Review Background</span></div>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 12px" }}>
                Now that you know the task, review the background with the client's needs in mind.
              </p>
              <DocumentViewer document={session.background} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Show the request for reference */}
              {session.request && (
                <div style={{ marginBottom: "16px" }}>
                  <RequestSummaryCard request={session.request} />
                </div>
              )}
              <div style={S.secHeader}><span>Additional Notes</span></div>
              <NoteEditor value={currentNotes} onChange={setCurrentNotes} height={300} placeholder="• Relevant to the request: ...\n• I should look for: ...\n• Key threshold: ..." />
            </div>
          </div>
        )}

        {/* Document steps */}
        {isDocStep && (
          <div style={S.split}>
            <div style={{ minHeight: "400px" }}>
              {session.isLoading || !currentDoc ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                  <Loader2 size={24} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <DocumentViewer document={currentDoc} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Show the request for reference */}
              {session.request && (
                <div style={{ marginBottom: "16px" }}>
                  <RequestSummaryCard request={session.request} />
                </div>
              )}

              {/* Parameter Checklist */}
              <ChecklistTable
                rows={getCurrentChecklist()}
                onChange={updateCurrentChecklist}
                disabled={false}
              />

              {/* Reviewing indicator */}
              {isReviewingChecklist && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", color: "#94a3b8", fontSize: "13px" }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  Reviewing your checklist...
                </div>
              )}

              {/* Checklist Feedback Display */}
              {getCurrentFeedback() && (
                <ChecklistFeedbackPanel feedback={getCurrentFeedback()} />
              )}

              <div style={{ ...S.secHeader, marginTop: "16px" }}><span>Your Notes</span></div>
              <NoteEditor value={currentNotes} onChange={setCurrentNotes} height={200} />
            </div>
          </div>
        )}

        {/* Predictions step */}
        {session.step === "predictions" && (
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            {/* Show request at top */}
            {session.request && (
              <div style={{ marginBottom: "20px" }}>
                <RequestSummaryCard request={session.request} />
              </div>
            )}
            <div style={S.secHeader}><span>Your Notes So Far</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
              {session.notes.background_notes && <NoteBlock label="Background Notes" content={session.notes.background_notes} />}
              {session.notes.deliverable_summary && <NoteBlock label="Deliverable Summary" content={session.notes.deliverable_summary} />}
              {session.notes.doc1_notes && <NoteBlock label="Document 1" content={session.notes.doc1_notes} />}
              {session.notes.doc2_notes && <NoteBlock label="Document 2" content={session.notes.doc2_notes} />}
              {session.notes.doc3_notes && <NoteBlock label="Document 3" content={session.notes.doc3_notes} />}
            </div>
            <div style={S.secHeader}><span>Predict the Data</span></div>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 12px" }}>Based on what you've read, what patterns do you expect? What ranges would be notable? What would you report?</p>
            <NoteEditor value={currentNotes} onChange={setCurrentNotes} placeholder="• If I see values above X, that indicates...\n• I expect the data to show...\n• I should report to the client if..." height={250} />
          </div>
        )}

        {/* Data step */}
        {session.step === "data" && (
          <div style={S.split}>
            <div style={{ minHeight: "400px" }}>
              {session.isLoading || !session.data ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                  <Loader2 size={24} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <DataViewer data={session.data} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Show request for reference */}
              {session.request && (
                <div style={{ marginBottom: "12px" }}>
                  <RequestSummaryCard request={session.request} />
                </div>
              )}
              {session.notes.data_predictions && (
                <div style={{ marginBottom: "12px" }}><NoteBlock label="Your Predictions" content={session.notes.data_predictions} /></div>
              )}
              <div style={S.secHeader}><span>Data Analysis Notes</span></div>
              <NoteEditor value={currentNotes} onChange={setCurrentNotes} placeholder="• I notice that...\n• This confirms/contradicts my prediction about...\n• I would report to the client that..." height={250} />
            </div>
          </div>
        )}
      </div>

      {/* Submit button */}
      {!["feedback", "loading", "reviewing"].includes(session.step) && (
        <div style={S.bottomBar}>
          {/* For doc steps: show message until feedback arrives (after timer expires) */}
          {isDocStep && !canSubmitDocStep() && (
            <span style={{ fontSize: "13px", color: "#64748b", marginRight: "16px" }}>
              {isReviewingChecklist ? "Reviewing checklist..." : "Timer will review your checklist when it expires"}
            </span>
          )}
          {/* For non-doc steps: show halfway message */}
          {!isDocStep && !canSubmit && (
            <span style={{ fontSize: "13px", color: "#64748b", marginRight: "16px" }}>
              Submit unlocks at halfway
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={isDocStep ? !canSubmitDocStep() : !canSubmit}
            style={{
              ...S.primaryBtn,
              opacity: (isDocStep ? canSubmitDocStep() : canSubmit) ? 1 : 0.5,
              cursor: (isDocStep ? canSubmitDocStep() : canSubmit) ? "pointer" : "not-allowed",
            }}
          >
            {session.step === "data" ? "Submit for Review" : "Submit & Continue"}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {hasPreviousNotes && !["predictions", "background_read"].includes(session.step) && (
        <NotesDrawer notes={session.notes} isOpen={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/** Compact card showing the client request for reference */
function RequestSummaryCard({ request }: { request: { from: string; subject: string; body: string } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "rgba(59,130,246,0.05)",
        border: "1px solid rgba(59,130,246,0.15)",
        borderRadius: "8px",
        padding: "12px 16px",
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
            Client Request
          </div>
          <div style={{ fontSize: "14px", color: "#93c5fd", fontWeight: 500 }}>{request.subject}</div>
        </div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{expanded ? "▲ Less" : "▼ More"}</div>
      </div>
      {expanded && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(59,130,246,0.15)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>From: {request.from}</div>
          <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.7 }}>
            {request.body.split("\n\n").map((p, i) => <p key={i} style={{ margin: "0 0 8px 0" }}>{p}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Display feedback from checklist review */
function ChecklistFeedbackPanel({ feedback }: { feedback: any }) {
  if (!feedback) return null;

  return (
    <div
      style={{
        marginTop: "12px",
        background: "rgba(34,197,94,0.05)",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: "8px",
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "#22c55e",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        Checklist Feedback
      </div>

      {/* Captured parameters */}
      {feedback.captured && feedback.captured.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", color: "#4ade80", marginBottom: "4px" }}>
            ✓ Captured ({feedback.captured.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
            {feedback.captured.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missed parameters */}
      {feedback.missed && feedback.missed.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", color: "#f97316", marginBottom: "4px" }}>
            ✗ Missed ({feedback.missed.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
            {feedback.missed.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Overall comment */}
      {feedback.feedback && (
        <div style={{ fontSize: "13px", color: "#cbd5e1", fontStyle: "italic", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {feedback.feedback}
        </div>
      )}

      <p style={{ fontSize: "11px", color: "#64748b", margin: "8px 0 0" }}>
        Update your checklist above based on this feedback, then click Submit to continue.
      </p>
    </div>
  );
}

function NoteBlock({ label, content }: { label: string; content: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "12px 16px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: "150px", overflowY: "auto" }}>{content}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0f1a", color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.8)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 },
  content: { padding: "24px", paddingBottom: "100px" },
  bottomBar: { position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.95)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "flex-end", zIndex: 50 },
  split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "1200px", margin: "0 auto" },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "24px" },
  secHeader: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600, marginBottom: "12px" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", background: "transparent", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", fontSize: "14px", cursor: "pointer" },
  iconBtn: { background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#64748b", display: "flex" },
};
