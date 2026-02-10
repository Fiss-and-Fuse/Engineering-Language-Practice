/**
 * SettingsModal — modal for configuring the app.
 *
 * Uses local state for form values and saves on blur to avoid
 * losing focus on every keystroke.
 */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "../api";
import type { AppConfig } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { value: 90, label: "1.5 min — 2-3 sentences per doc" },
  { value: 180, label: "3 min — 1 paragraph per doc" },
  { value: 300, label: "5 min — 1-2 paragraphs per doc" },
  { value: 420, label: "7 min — 2 full paragraphs per doc" },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);

  // Load config when modal opens
  useEffect(() => {
    if (isOpen && !config) {
      api.getConfig().then((cfg) => {
        setConfig(cfg);
        // Initialize local values from config
        setLocalValues({
          model_key: cfg.model_key,
          difficulty: cfg.difficulty,
          domain: cfg.domain || "",
          timer_request: cfg.timer_request,
          timer_document: cfg.timer_document,
          timer_predictions: cfg.timer_predictions,
          timer_data: cfg.timer_data,
          cost_limit: cfg.cost_limit,
        });
      }).catch(console.error);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  // Update local state only (no API call)
  const handleLocalChange = (key: string, value: string | number) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  // Save to API on blur
  const handleBlur = async (key: string) => {
    if (!config) return;
    const value = localValues[key];

    // Skip if value hasn't changed
    if (value === (config as any)[key]) return;

    setSaving(true);
    try {
      const updated = await api.updateConfig({ [key]: value });
      setConfig(updated);
    } catch (err) {
      console.error("Failed to update config:", err);
      // Revert local value on error
      setLocalValues((prev) => ({ ...prev, [key]: (config as any)[key] }));
    }
    setSaving(false);
  };

  // For selects, save immediately since they don't have the focus issue
  const handleSelectChange = async (key: string, value: string) => {
    // Parse numeric values for timer fields
    const isTimerField = key.startsWith("timer_");
    const parsedValue = isTimerField ? parseInt(value) : value;

    handleLocalChange(key, parsedValue);
    if (!config) return;
    setSaving(true);
    try {
      const updated = await api.updateConfig({ [key]: parsedValue });
      setConfig(updated);
    } catch (err) {
      console.error("Failed to update config:", err);
    }
    setSaving(false);
  };

  // Update all timers at once
  const handleAllTimersChange = async (value: number) => {
    const updates = {
      timer_request: value,
      timer_document: value,
      timer_predictions: value,
      timer_data: value,
    };

    setLocalValues((prev) => ({ ...prev, ...updates }));
    if (!config) return;
    setSaving(true);
    try {
      const updated = await api.updateConfig(updates);
      setConfig(updated);
    } catch (err) {
      console.error("Failed to update config:", err);
    }
    setSaving(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e293b",
          borderRadius: "12px",
          padding: "24px",
          width: "400px",
          maxHeight: "80vh",
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "18px", color: "#e2e8f0", fontWeight: 600 }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {!config ? (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Model selection */}
            <div>
              <label style={labelStyle}>Model</label>
              <select
                value={localValues.model_key as string}
                onChange={(e) => handleSelectChange("model_key", e.target.value)}
                style={selectStyle}
                disabled={saving}
              >
                {Object.entries(config.available_models).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label style={labelStyle}>Difficulty</label>
              <select
                value={localValues.difficulty as string}
                onChange={(e) => handleSelectChange("difficulty", e.target.value)}
                style={selectStyle}
                disabled={saving}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Domain */}
            <div>
              <label style={labelStyle}>Engineering Domain</label>
              <input
                type="text"
                value={localValues.domain as string}
                onChange={(e) => handleLocalChange("domain", e.target.value)}
                onBlur={() => handleBlur("domain")}
                placeholder="Leave blank for random"
                style={inputStyle}
                disabled={saving}
              />
            </div>

            {/* Timer duration - single setting for all steps */}
            <div>
              <label style={labelStyle}>Time Per Step</label>
              <select
                value={localValues.timer_document as number}
                onChange={(e) => handleAllTimersChange(parseInt(e.target.value))}
                style={selectStyle}
                disabled={saving}
              >
                {TIMER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Cost limit */}
            <div>
              <label style={labelStyle}>Cost Limit ($)</label>
              <input
                type="number"
                step="0.50"
                value={localValues.cost_limit as number}
                onChange={(e) => handleLocalChange("cost_limit", parseFloat(e.target.value) || 0)}
                onBlur={() => handleBlur("cost_limit")}
                style={inputStyle}
                disabled={saving}
              />
            </div>

            {saving && (
              <p style={{ fontSize: "12px", color: "#64748b", textAlign: "center" }}>
                Saving...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#94a3b8",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "6px",
  color: "#e2e8f0",
  fontSize: "14px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "6px",
  color: "#e2e8f0",
  fontSize: "14px",
  outline: "none",
};
