/**
 * ChecklistTable — two-column table for tracking parameter thresholds and data checks.
 * Column 1: Parameter/threshold/limit from documents
 * Column 2: What to check in the data / actual value found
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface ChecklistRow {
  id: string;
  parameter: string;
  check: string;
}

interface ChecklistTableProps {
  rows: ChecklistRow[];
  onChange: (rows: ChecklistRow[]) => void;
  disabled?: boolean;
}

export default function ChecklistTable({ rows, onChange, disabled }: ChecklistTableProps) {
  const addRow = () => {
    const newRow: ChecklistRow = {
      id: Date.now().toString(),
      parameter: "",
      check: "",
    };
    onChange([...rows, newRow]);
  };

  const updateRow = (id: string, field: "parameter" | "check", value: string) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const deleteRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  return (
    <div style={{ marginTop: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          Parameter Checklist
        </div>
        {!disabled && (
          <button
            onClick={addRow}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: "4px",
              color: "#60a5fa",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add Row
          </button>
        )}
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 40px",
            background: "rgba(255,255,255,0.05)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={headerCellStyle}>Parameter / Threshold / Limit</div>
          <div style={headerCellStyle}>Check Against Data</div>
          <div style={headerCellStyle}></div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Click "Add Row" to start tracking parameters
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 40px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <input
                type="text"
                value={row.parameter}
                onChange={(e) => updateRow(row.id, "parameter", e.target.value)}
                placeholder="e.g., Max temp: 42°C"
                disabled={disabled}
                style={inputCellStyle}
              />
              <input
                type="text"
                value={row.check}
                onChange={(e) => updateRow(row.id, "check", e.target.value)}
                placeholder="e.g., Look for values > 42"
                disabled={disabled}
                style={inputCellStyle}
              />
              {!disabled && (
                <button
                  onClick={() => deleteRow(row.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
        Record every threshold, limit, and criterion you find. You'll check these against the data later.
      </p>
    </div>
  );
}

const headerCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "11px",
  color: "#94a3b8",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  color: "#e2e8f0",
  fontSize: "13px",
  fontFamily: "'JetBrains Mono', monospace",
  outline: "none",
};

export type { ChecklistRow };
