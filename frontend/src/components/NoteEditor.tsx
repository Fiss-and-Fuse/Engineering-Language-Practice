/**
 * NoteEditor — a text editor with bullet point support.
 * 
 * HOW BULLET POINTS WORK:
 * We use a regular <textarea> but intercept keyboard events:
 *   - Enter → auto-insert "• " on the new line
 *   - Tab at start of line → indent to "  • " (sub-bullet)
 *   - Shift+Tab → outdent back to "• "
 *   - Backspace on empty bullet → remove the bullet
 * 
 * WHY NOT A RICH TEXT EDITOR (like Slate, Draft.js, Quill):
 * Those are 50-200KB libraries that would take longer to set up
 * than the entire rest of this project. A textarea with keyboard
 * handling gives us 90% of the functionality in 5% of the code.
 * The notes are stored as plain text with "• " and "  • " prefixes.
 * 
 * KEYBOARD HANDLING EXPLANATION:
 * textarea.selectionStart tells us where the cursor is (character index).
 * We find the start of the current line by searching backward for "\n".
 * Then we check what prefix that line has to decide what to do.
 */

import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from "react";

interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Read-only mode (for displaying previous notes) */
  readOnly?: boolean;
  /** Height in pixels */
  height?: number;
}

export default function NoteEditor({
  value,
  onChange,
  placeholder = "Type your notes here...\nPress Enter for bullet points, Tab to indent",
  readOnly = false,
  height = 300,
}: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handle special keyboard shortcuts.
   * 
   * WHY preventDefault():
   * When we handle Tab ourselves, we need to prevent the browser's
   * default Tab behavior (which moves focus to the next element).
   * Same with Enter — we want our custom behavior, not just a newline.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd } = textarea;
      const text = value;

      // Find the start of the current line
      // We search backward from cursor for "\n" (or use 0 if first line)
      const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = text.substring(lineStart, selectionStart);

      if (e.key === "Enter") {
        e.preventDefault();

        // Determine bullet prefix for new line
        // If current line starts with "  • " → new line also gets "  • "
        // If current line starts with "• " → new line also gets "• "
        // Otherwise → new line gets "• " (first bullet)
        let prefix = "• ";
        if (currentLine.startsWith("  • ")) {
          prefix = "  • ";
        } else if (currentLine.startsWith("• ")) {
          prefix = "• ";
        }

        // If current line is JUST the bullet (nothing typed), remove it
        // This is how you "exit" bullet mode — press Enter on empty bullet
        const fullLine = text.substring(lineStart, text.indexOf("\n", lineStart) === -1 ? text.length : text.indexOf("\n", lineStart));
        if (fullLine.trim() === "•") {
          const newText = text.substring(0, lineStart) + text.substring(lineStart + fullLine.length);
          onChange(newText);
          // Set cursor position after React re-renders
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          });
          return;
        }

        // Insert newline + bullet prefix
        const newText =
          text.substring(0, selectionStart) + "\n" + prefix + text.substring(selectionEnd);
        onChange(newText);

        // Move cursor after the new prefix
        const newPos = selectionStart + 1 + prefix.length;
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = newPos;
        });
      }

      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();

        // Indent: "• " → "  • " (add 2 spaces)
        if (currentLine.startsWith("• ")) {
          const newText =
            text.substring(0, lineStart) + "  " + text.substring(lineStart);
          onChange(newText);
          // Move cursor 2 positions right (to account for added spaces)
          const newPos = selectionStart + 2;
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = newPos;
          });
        } else if (!currentLine.startsWith("  ")) {
          // If no bullet yet, start one
          const newText =
            text.substring(0, lineStart) + "• " + text.substring(lineStart);
          onChange(newText);
          const newPos = selectionStart + 2;
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = newPos;
          });
        }
      }

      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();

        // Outdent: "  • " → "• " (remove 2 leading spaces)
        if (currentLine.startsWith("  ")) {
          const newText =
            text.substring(0, lineStart) + text.substring(lineStart + 2);
          onChange(newText);
          const newPos = Math.max(lineStart, selectionStart - 2);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = newPos;
          });
        }
      }
    },
    [value, onChange, readOnly]
  );

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      readOnly={readOnly}
      spellCheck={false}
      style={{
        width: "100%",
        height: `${height}px`,
        padding: "12px 16px",
        background: readOnly ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${readOnly ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)"}`,
        borderRadius: "8px",
        color: "#e2e8f0",
        fontSize: "14px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineHeight: "1.7",
        resize: "vertical",
        outline: "none",
        transition: "border-color 0.2s",
        cursor: readOnly ? "default" : "text",
        opacity: readOnly ? 0.7 : 1,
      }}
      onFocus={(e) => {
        if (!readOnly) {
          e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = readOnly
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.15)";
      }}
    />
  );
}
