/**
 * DataViewer — displays the data artifact (table, values, or text output).
 * Parses markdown tables and renders them as proper HTML tables.
 */

import { BarChart3 } from "lucide-react";
import type { DataArtifact } from "../types";

interface DataViewerProps {
  data: DataArtifact;
}

/** Parse a markdown table into rows and cells */
function parseMarkdownTable(content: string): { headers: string[]; rows: string[][] } | null {
  const lines = content.trim().split("\n").filter((line) => line.trim());

  if (lines.length < 2) return null;

  // Check if it looks like a markdown table
  if (!lines[0].includes("|")) return null;

  const parseLine = (line: string): string[] =>
    line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, i, arr) => i > 0 && i < arr.length - 1 || cell !== "");

  const headers = parseLine(lines[0]);

  // Skip the separator line (e.g., |---|---|---|)
  const startRow = lines[1].match(/^[\s|:-]+$/) ? 2 : 1;

  const rows: string[][] = [];
  for (let i = startRow; i < lines.length; i++) {
    if (!lines[i].match(/^[\s|:-]+$/)) {
      rows.push(parseLine(lines[i]));
    }
  }

  return { headers, rows };
}

export default function DataViewer({ data }: DataViewerProps) {
  const table = data.format === "table" ? parseMarkdownTable(data.content) : null;

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
          marginBottom: "8px",
        }}
      >
        <BarChart3 size={18} />
        <span>Data: {data.format.replace("_", " ")}</span>
      </div>

      <p
        style={{
          fontSize: "13px",
          color: "#94a3b8",
          marginBottom: "12px",
        }}
      >
        {data.description}
      </p>

      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "20px",
          maxHeight: "calc(100vh - 300px)",
          overflowY: "auto",
          overflowX: "auto",
        }}
      >
        {table ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <thead>
              <tr>
                {table.headers.map((header, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderBottom: "2px solid rgba(255,255,255,0.15)",
                      color: "#e2e8f0",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{
                    background: rowIndex % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  }}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        color: "#cbd5e1",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre
            style={{
              fontSize: "13px",
              color: "#e2e8f0",
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: "pre",
            }}
          >
            {data.content}
          </pre>
        )}
      </div>
    </div>
  );
}
