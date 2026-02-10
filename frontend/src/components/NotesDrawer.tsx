/**
 * NotesDrawer — slide-out panel showing notes from previous steps.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface NotesDrawerProps {
  notes: Record<string, string>;
  isOpen: boolean;
  onToggle: () => void;
}

const LABEL_MAP: Record<string, string> = {
  background_notes: "Background Notes",
  deliverable_summary: "Deliverable Summary",
  doc1_notes: "Document 1 Notes",
  doc2_notes: "Document 2 Notes",
  doc3_notes: "Document 3 Notes",
  data_predictions: "Data Predictions",
  data_notes: "Data Analysis",
};

export default function NotesDrawer({ notes, isOpen, onToggle }: NotesDrawerProps) {
  const noteEntries = Object.entries(notes).filter(([_, v]) => v);

  return (
    <>
      {/* Tab button */}
      <button
        onClick={onToggle}
        style={{
          position: "fixed",
          left: isOpen ? "320px" : "0",
          top: "50%",
          transform: "translateY(-50%)",
          background: "rgba(30,41,59,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderLeft: isOpen ? "1px solid rgba(255,255,255,0.1)" : "none",
          borderRadius: isOpen ? "0 8px 8px 0" : "0 8px 8px 0",
          padding: "12px 8px",
          cursor: "pointer",
          color: "#94a3b8",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          zIndex: 100,
          transition: "left 0.3s ease",
        }}
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        <span
          style={{
            writingMode: "vertical-rl",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Notes
        </span>
      </button>

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          left: isOpen ? "0" : "-320px",
          top: "0",
          bottom: "0",
          width: "320px",
          background: "rgba(15,23,42,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.1)",
          padding: "60px 16px 16px",
          overflowY: "auto",
          transition: "left 0.3s ease",
          zIndex: 99,
        }}
      >
        <h3
          style={{
            fontSize: "13px",
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "16px",
          }}
        >
          Previous Notes
        </h3>

        {noteEntries.map(([key, content]) => (
          <div
            key={key}
            style={{
              marginBottom: "16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              {LABEL_MAP[key] || key}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                maxHeight: "150px",
                overflowY: "auto",
              }}
            >
              {content}
            </div>
          </div>
        ))}

        {noteEntries.length === 0 && (
          <p style={{ fontSize: "13px", color: "#64748b" }}>No notes yet.</p>
        )}
      </div>
    </>
  );
}
