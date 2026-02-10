/**
 * DocumentViewer — displays a document with title and formatted content.
 */

import { FileText } from "lucide-react";
import type { Document } from "../types";

interface DocumentViewerProps {
  document: Document;
}

export default function DocumentViewer({ document }: DocumentViewerProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
          marginBottom: "12px",
        }}
      >
        <FileText size={18} />
        <span>{document.title}</span>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "24px",
          maxHeight: "calc(100vh - 250px)",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            color: "#cbd5e1",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
        >
          {document.content}
        </div>
      </div>
    </div>
  );
}
