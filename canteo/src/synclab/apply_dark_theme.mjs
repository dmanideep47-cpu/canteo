import { readFileSync, writeFileSync } from 'fs';

const original = readFileSync('canteo/src/synclab/synclab.css', 'utf8');
const lines = original.split('\n');

// Part 1: Lines 197 to end (lines index 196 to lines.length)
const tailSection = lines.slice(196).join('\n');

// Part 2: Refined Core Header, Simulator, Bounded Buffer, Semaphores, Workstations (Lines 1 to 196 replacement)
const refinedCore = `/* ==========================================================================
   CANTEO SYNCLAB — REFINED VERCEL-INSPIRED DESIGN SYSTEM
   ========================================================================== */

:root {
  --sl-bg: #0A0A0A;
  --sl-surface-0: #0C0C0C;
  --sl-surface-1: #121212;
  --sl-surface-2: #161616;
  --sl-surface-3: #1C1C1C;
  --sl-surface-hover: #222222;
  --sl-border-subtle: #1C1C1C;
  --sl-border: #242424;
  --sl-border-hover: #333333;
  --sl-border-active: #444444;

  --sl-text-primary: #EDEDED;
  --sl-text-heading: #FAFAFA;
  --sl-text-muted: #888888;
  --sl-text-subtle: #52525B;

  --sl-amber: #F59E0B;
  --sl-amber-muted: #D97706;
  --sl-amber-bg: rgba(245, 158, 11, 0.08);
  --sl-amber-border: rgba(245, 158, 11, 0.22);

  --sl-green: #10B981;
  --sl-green-muted: #059669;
  --sl-green-bg: rgba(16, 185, 129, 0.08);
  --sl-green-border: rgba(16, 185, 129, 0.22);

  --sl-red: #EF4444;
  --sl-red-muted: #DC2626;
  --sl-red-bg: rgba(239, 68, 68, 0.08);
  --sl-red-border: rgba(239, 68, 68, 0.22);

  --sl-blue: #3B82F6;
  --sl-blue-bg: rgba(59, 130, 246, 0.08);
  --sl-blue-border: rgba(59, 130, 246, 0.22);

  /* Legacy variable compatibility */
  --sl-ivory: #0A0A0A;
  --sl-forest: #10B981;
  --sl-brown: #71717A;
  --sl-gold: #F59E0B;
  --sl-line: #242424;
  --sl-deep: #059669;
  --sl-sage: #34D399;
  --sl-olive: #10B981;
  --sl-wheat: #F59E0B;
  --sl-cream: #121212;
}

/* Shell & Canvas */
.synclab-shell {
  min-height: 100%;
  background: var(--sl-bg);
  color: var(--sl-text-primary);
  padding: 20px clamp(16px, 2.5vw, 36px) 28px;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
  isolation: isolate;
  overflow-x: hidden;
}

/* Hide ambient clutter */
.sl-ambient,
.sl-header-scene,
.sl-canteen-scene,
.sl-float-decor {
  display: none !important;
}

/* Studio Header */
.sl-header,
.sl-studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0 16px;
  border-bottom: 1px solid var(--sl-border-subtle);
  min-height: 56px;
  position: relative;
  z-index: 1;
}

.sl-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sl-brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  color: var(--sl-text-heading);
  display: grid;
  place-items: center;
}

.sl-eyebrow {
  display: block;
  color: var(--sl-amber);
  font: 700 9px/1.3 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.sl-brand h1 {
  font-family: inherit;
  font-size: 20px;
  font-weight: 600;
  color: var(--sl-text-heading);
  margin: 1px 0 0;
  letter-spacing: -0.02em;
}

.sl-brand small {
  display: block;
  margin-top: 1px;
  color: var(--sl-text-muted);
  font-size: 11px;
}

.sl-header-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--sl-green-border);
  background: var(--sl-green-bg);
  color: #34D399;
  border-radius: 9999px;
  padding: 5px 12px;
  font: 600 9px/1 ui-monospace, monospace;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.sl-header-badge span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sl-green);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.sl-header-badge i {
  width: 1px;
  height: 10px;
  background: rgba(16, 185, 129, 0.3);
  margin: 0 2px;
}

/* Intro Meta Band */
.sl-intro-band {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0 14px;
  color: var(--sl-text-muted);
  font-size: 11px;
}

.sl-intro-band > span {
  font: 700 9px ui-monospace, monospace;
  letter-spacing: 0.08em;
  color: #D4D4D8;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  padding: 3px 7px;
  border-radius: 4px;
}

.sl-intro-band p {
  margin: 0;
  line-height: 1.4;
}

.sl-intro-band i {
  color: var(--sl-text-subtle);
  padding: 0 4px;
}

/* Section Navigation */
.sl-section-nav {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--sl-border-subtle);
  margin: 0 0 20px;
  padding-bottom: 2px;
  overflow-x: auto;
  min-width: 0;
  scrollbar-width: thin;
}

.sl-section-nav button {
  flex: none;
  display: flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--sl-text-muted);
  padding: 7px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.sl-section-nav button:hover {
  color: var(--sl-text-primary);
  background: var(--sl-surface-1);
}

.sl-section-nav button.active {
  color: var(--sl-text-heading);
  background: var(--sl-surface-3);
  border-color: var(--sl-border-hover);
  font-weight: 600;
}

.sl-section-nav button > span {
  font: 600 10px ui-monospace, monospace;
  color: var(--sl-text-subtle);
}

.sl-section-nav button.active > span {
  color: var(--sl-amber);
}

/* Section Headings */
.sl-section-content {
  max-width: 1420px;
  margin: auto;
}

.sl-section-heading {
  margin: 0 0 18px;
}

.sl-section-heading h2 {
  font-family: inherit;
  font-size: clamp(20px, 2.4vw, 26px);
  font-weight: 600;
  color: var(--sl-text-heading);
  margin: 4px 0 6px;
  letter-spacing: -0.02em;
}

.sl-section-heading p {
  margin: 0;
  color: var(--sl-text-muted);
  font-size: 12px;
  line-height: 1.6;
  max-width: 760px;
}

/* Standard Panels */
.sl-panel {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.sl-panel h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sl-text-heading);
  letter-spacing: -0.01em;
}

.sl-panel > p {
  font-size: 12px;
  line-height: 1.6;
  color: var(--sl-text-muted);
  margin: 0;
}

/* Controls Bar */
.sl-control-bar,
.sl-top-control-bar {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  box-shadow: none;
}

.sl-button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.sl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-primary);
  height: 32px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sl-btn:hover:not(:disabled) {
  background: var(--sl-surface-hover);
  border-color: var(--sl-border-active);
  color: #FFFFFF;
}

.sl-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed !important;
  pointer-events: none;
}

.sl-btn.primary {
  background: #EDEDED;
  border-color: #EDEDED;
  color: #0A0A0A;
  font-weight: 600;
}

.sl-btn.primary:hover:not(:disabled) {
  background: #FFFFFF;
  color: #000000;
  filter: brightness(1.05);
}

.sl-btn.quiet {
  background: transparent;
  border: 1px solid transparent;
  color: var(--sl-text-muted);
}

.sl-btn.quiet:hover:not(:disabled) {
  background: var(--sl-surface-2);
  border-color: var(--sl-border);
  color: var(--sl-text-primary);
}

.sl-btn.small {
  height: 26px;
  padding: 0 9px;
  font-size: 10px;
}

.sl-speed {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--sl-text-muted);
  font-size: 11px;
}

.sl-speed select {
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 5px;
  padding: 4px 8px;
  color: var(--sl-text-primary);
  font-size: 11px;
}

/* Scenario Picker */
.sl-scenario-picker {
  margin: 0 0 14px;
  padding: 12px 14px;
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  box-shadow: none;
}

.sl-scenario-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.sl-scenario-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--sl-text-muted);
  font: 600 10px ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sl-scenario-row select {
  max-width: min(280px, 70vw);
  height: 32px;
  padding: 0 10px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-primary);
  font: 11px inherit;
}

.sl-scenario-copy {
  flex: 1 1 240px;
  color: var(--sl-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.sl-scenario-expected {
  margin-top: 8px;
  color: var(--sl-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.sl-scenario-expected > b {
  color: #34D399;
  font-weight: 600;
}

.sl-demo-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-primary);
  font-size: 11px;
  line-height: 1.45;
}

.sl-evidence-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--sl-border-subtle);
}

.sl-evidence-actions > span {
  margin-right: auto;
  font: 700 10px ui-monospace, monospace;
}

.sl-evidence-actions .pass {
  color: #34D399;
}

.sl-evidence-actions .pending {
  color: var(--sl-amber);
}

.sl-report-preview {
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-muted);
  font-size: 11px;
}

.sl-report-preview summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--sl-text-primary);
}

.sl-report-preview p {
  margin: 6px 0 0;
  line-height: 1.5;
}

.sl-classroom-toggle {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 11px;
  color: var(--sl-text-muted);
  cursor: pointer;
}

.sl-classroom-toggle input {
  accent-color: var(--sl-green);
}

/* Learning Mode Selector */
.sl-mode-selector {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 12px;
  padding: 4px;
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 8px;
}

.sl-mode-selector::before {
  content: "MODE";
  margin: 0 8px 0 4px;
  color: var(--sl-text-subtle);
  font: 700 9px ui-monospace, monospace;
  letter-spacing: 0.1em;
}

.sl-mode-selector button {
  flex: none;
  background: transparent;
  border: 1px solid transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--sl-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sl-mode-selector button:hover {
  color: var(--sl-text-primary);
  background: var(--sl-surface-2);
}

.sl-mode-selector button.active {
  background: var(--sl-surface-3);
  color: var(--sl-text-heading);
  border-color: var(--sl-border-active);
  font-weight: 600;
}

.sl-mode-selector button b {
  font-size: 11px;
}

.sl-mode-selector button small {
  display: none;
}

.sl-mode-panel {
  padding: 12px 16px;
  margin: 0 0 14px;
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
}

/* Simulator Grid */
.refined-sim-grid,
.sl-sim-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(290px, 340px);
  gap: 16px;
  align-items: start;
}

.refined-sim-grid *,
.sl-sim-grid * {
  min-width: 0;
}

.sl-sim-main,
.sl-sim-side {
  display: grid;
  gap: 14px;
}

/* Bounded Buffer Stage */
.sl-buffer-stage {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  min-height: 290px;
}

.sl-buffer-orbit {
  width: 100%;
  border: none;
  border-radius: 0;
  padding: 0;
  text-align: left;
}

.sl-buffer-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 14px;
}

.sl-buffer-heading > div {
  display: grid;
  gap: 2px;
}

.sl-buffer-heading > div > b {
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: var(--sl-text-heading);
  letter-spacing: -0.02em;
}

.sl-buffer-heading > div > small {
  font-size: 11px;
  color: var(--sl-text-muted);
}

.sl-capacity-pill {
  padding: 5px 12px;
  border: 1px solid var(--sl-border);
  border-radius: 9999px;
  background: var(--sl-surface-2);
  color: #D4D4D8;
  font: 600 10px ui-monospace, monospace;
  white-space: nowrap;
}

.sl-capacity-pill i {
  font-style: normal;
  color: var(--sl-text-subtle);
  padding: 0 2px;
}

/* Five Slots Grid */
.sl-slots-wrap {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  padding: 2px 2px 10px;
  scrollbar-color: #333333 transparent;
  scrollbar-width: thin;
}

.sl-slots {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  min-width: 0;
}

.sl-slot {
  min-height: 195px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 6px;
  padding: 10px 8px 12px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--sl-surface-2);
  color: var(--sl-text-primary);
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.sl-slot:hover {
  border-color: var(--sl-border-active);
  background: var(--sl-surface-hover);
}

.sl-slot.filled {
  background: #131A16;
  border-color: #1F382A;
}

.sl-slot.selected {
  border-color: var(--sl-amber) !important;
  box-shadow: 0 0 0 1px var(--sl-amber) !important;
}

.sl-slot.read-point {
  border-top: 2px solid var(--sl-green);
}

.sl-slot.write-point {
  border-bottom: 2px solid var(--sl-amber);
}

.sl-slot-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 4px;
}

.sl-slot-number {
  font: 700 9px ui-monospace, monospace;
  color: var(--sl-text-subtle);
}

.sl-slot-role-badge {
  padding: 2px 5px;
  border-radius: 4px;
  font: 700 8px/1 ui-monospace, monospace;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.sl-slot-role-badge.read {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.sl-slot-role-badge.write {
  background: rgba(245, 158, 11, 0.15);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.sl-food-photo {
  background-image: url('/synclab/canteen-dishes.png');
  background-size: 300% 200%;
  background-repeat: no-repeat;
  background-color: #181818;
}

.sl-slot-food {
  display: block;
  width: 100%;
  height: 76px;
  border-radius: 6px;
  border: 1px solid var(--sl-border-subtle);
  background-size: 300% 200%;
  flex: none;
}

.sl-food-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  height: 76px;
  border: 1px dashed var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-subtle);
  background: #101010;
}

.sl-food-empty span {
  font: 700 8px ui-monospace, monospace;
  letter-spacing: 0.08em;
}

.sl-slot-dish {
  font: 600 12px/1.3 inherit;
  color: var(--sl-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.sl-slot-dish.empty-label {
  color: var(--sl-text-subtle);
  font-weight: 500;
  font-size: 11px;
}

.sl-order-id {
  color: var(--sl-text-muted);
  font: 600 10px ui-monospace, monospace;
}

.sl-queue-status {
  color: #34D399;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 1px 4px;
  border-radius: 3px;
  font: 700 8px ui-monospace, monospace;
  letter-spacing: 0.06em;
}

.sl-pointer-row {
  position: absolute;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  z-index: 2;
  white-space: nowrap;
}

.sl-pointer-row i {
  font: 700 7px ui-monospace, monospace;
  font-style: normal;
  border-radius: 3px;
  padding: 2px 4px;
  color: #0A0A0A;
}

.sl-pointer-row i.read {
  background: var(--sl-green);
}

.sl-pointer-row i.write {
  background: var(--sl-amber);
}

.sl-orbit-bottom {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 6px;
  color: var(--sl-text-muted);
  font: 700 9px ui-monospace, monospace;
  letter-spacing: 0.06em;
}

.sl-orbit-bottom b {
  color: var(--sl-text-primary);
  font-size: 11px;
}

.sl-buffer-arrow {
  color: var(--sl-amber);
  font-size: 14px;
}

/* Inspected Slot & FIFO Head Summary Blocks */
.sl-buffer-selected {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 12px 18px;
  align-items: center;
  padding: 12px 16px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  margin-top: 10px;
}

.sl-selected-slot-block,
.sl-fifo-head-block {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.sl-buffer-subtag {
  font: 700 8px ui-monospace, monospace;
  letter-spacing: 0.08em;
  color: var(--sl-amber);
}

.sl-buffer-subtag.sl-fifo-subtag {
  color: #34D399;
}

.sl-buffer-selected-title,
.sl-fifo-head-title {
  font: 600 13px/1.35 inherit;
  color: var(--sl-text-heading);
  overflow-wrap: anywhere;
}

.sl-buffer-selected-detail,
.sl-fifo-head-detail {
  font-size: 11px;
  line-height: 1.45;
  color: var(--sl-text-muted);
  overflow-wrap: anywhere;
}

/* Execution Bottom */
.sl-execution-bottom {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 14px 16px;
  display: grid;
  gap: 10px;
}

.sl-current-operation {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--sl-border-subtle);
}

.sl-current-operation > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.sl-current-operation b {
  font-size: 11px;
  color: var(--sl-text-heading);
  overflow-wrap: anywhere;
  font-family: ui-monospace, monospace;
}

.sl-selected-event p {
  margin: 6px 0;
  color: var(--sl-text-primary);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sl-selected-event small {
  font-size: 10px;
  color: var(--sl-text-muted);
  display: block;
  margin-top: 3px;
}

.sl-algorithm-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.sl-algorithm-mini code {
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  color: var(--sl-text-muted);
  font: 9px ui-monospace, monospace;
}

.sl-algorithm-mini code.current {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
  color: #FBBF24;
  font-weight: 700;
}

.sl-algorithm-mini code.done {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
  color: #34D399;
}

/* History Panel & Event Trace */
.sl-history-panel {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 16px;
}

.sl-history-panel .sl-panel-title > span {
  color: var(--sl-text-subtle);
  font: 600 9px ui-monospace, monospace;
}

.sl-history-table {
  display: grid;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.sl-history-row {
  display: grid;
  grid-template-columns: 36px 54px minmax(70px, 100px) minmax(90px, 130px) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--sl-border-subtle);
  color: var(--sl-text-muted);
  cursor: pointer;
  font-size: 10px;
  line-height: 1.45;
  transition: all 0.1s ease;
}

.sl-history-row:hover {
  background: var(--sl-surface-2);
  color: var(--sl-text-primary);
}

.sl-history-row.selected {
  background: rgba(245, 158, 11, 0.08);
  border-left: 2px solid var(--sl-amber);
  color: var(--sl-text-heading);
}

.sl-history-row > span:first-child {
  font: 700 9px ui-monospace, monospace;
  color: var(--sl-text-subtle);
}

.sl-history-row > b {
  color: var(--sl-text-heading);
  font: 700 10px ui-monospace, monospace;
}

.sl-history-row > span:nth-child(3) {
  color: var(--sl-text-primary);
  overflow-wrap: anywhere;
}

.sl-history-row > span:nth-child(4) {
  color: var(--sl-amber);
  font: 9px ui-monospace, monospace;
  overflow-wrap: anywhere;
}

.sl-history-row > span:last-child {
  overflow-wrap: anywhere;
}

.sl-event-inspector {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.sl-event-inspector b {
  color: var(--sl-text-heading);
  font: 700 11px ui-monospace, monospace;
}

.sl-event-inspector small {
  font: 9px ui-monospace, monospace;
  color: var(--sl-text-subtle);
  overflow-wrap: anywhere;
}

.sl-process-timeline {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.sl-trace-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.sl-trace-row > b {
  color: var(--sl-text-heading);
  font: 700 10px ui-monospace, monospace;
}

.sl-trace-events {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sl-trace-events button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 4px;
  color: var(--sl-text-muted);
  font-size: 9px;
  cursor: pointer;
}

.sl-trace-events button.selected {
  border-color: var(--sl-amber);
  background: rgba(245, 158, 11, 0.12);
  color: #FBBF24;
}

.sl-event-history {
  margin-top: 10px;
  border-top: 1px solid var(--sl-border-subtle);
  padding-top: 8px;
}

.sl-event-history summary {
  cursor: pointer;
  color: var(--sl-text-muted);
  font-size: 11px;
  font-weight: 500;
}

/* Process Monitor (Right Column) */
.sl-process-panel {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 16px;
}

.sl-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.sl-panel-title h3 {
  margin: 0;
}

.sl-add-process {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sl-process-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.sl-process-columns > div > .sl-eyebrow {
  margin-bottom: 6px;
  color: var(--sl-text-subtle);
}

.sl-workstation-list,
.sl-process-list {
  display: grid;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
  padding: 2px 2px 2px 0;
}

.sl-workstation,
.sl-process-card {
  display: grid;
  grid-template-columns: 8px 36px minmax(0, 1fr);
  align-items: start;
  gap: 8px 10px;
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--sl-surface-2);
  text-align: left;
  color: var(--sl-text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sl-workstation:hover,
.sl-process-card:hover {
  background: var(--sl-surface-hover);
  border-color: var(--sl-border-active);
}

.sl-workstation.selected,
.sl-process-card.selected {
  border-color: var(--sl-amber) !important;
  background: rgba(245, 158, 11, 0.08) !important;
}

.sl-workstation .sl-process-food,
.sl-workstation .sl-kitchen-icon,
.sl-process-card .sl-process-food {
  grid-column: 2;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  flex: none;
}

.sl-kitchen-icon {
  display: grid;
  place-items: center;
  background: #1C1C1C;
  color: var(--sl-text-primary);
  border: 1px solid var(--sl-border);
}

.sl-workstation-body,
.sl-process-card-body {
  grid-column: 3;
  display: grid;
  gap: 3px;
  min-width: 0;
  width: 100%;
}

.sl-workstation-header,
.sl-process-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}

.sl-workstation-id,
.sl-process-id {
  font: 700 12px ui-monospace, monospace;
  color: var(--sl-text-heading);
}

.sl-process-item-title {
  font: 600 11px inherit;
  color: var(--sl-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sl-workstation-order-name {
  display: block;
  font: 600 11px/1.3 inherit;
  color: var(--sl-text-primary);
  overflow-wrap: anywhere;
}

.sl-workstation-sub-status {
  display: block;
  margin-top: 1px;
  font-size: 10px;
  line-height: 1.35;
  color: var(--sl-text-muted);
  overflow-wrap: anywhere;
}

.sl-workstation-state,
.sl-process-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font: 700 8px/1 ui-monospace, monospace;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex: none;
}

.sl-workstation-state[data-state="IDLE"] { background: #181818; color: #888888; border: 1px solid #282828; }
.sl-workstation-state[data-state="WAITING_FOR_ORDER"] { background: rgba(245, 158, 11, 0.12); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.25); }
.sl-workstation-state[data-state="FULL_PERMIT_RESERVED"] { background: rgba(59, 130, 246, 0.12); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.25); }
.sl-workstation-state[data-state="WAITING_FOR_MUTEX"] { background: rgba(239, 68, 68, 0.12); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.25); }
.sl-workstation-state[data-state="CRITICAL_SECTION"] { background: rgba(245, 158, 11, 0.18); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 800; }
.sl-workstation-state[data-state="ORDER_REMOVED"] { background: rgba(16, 185, 129, 0.12); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.25); }
.sl-workstation-state[data-state="PREPARING"] { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
.sl-workstation-state[data-state="READY"] { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); }

.sl-process-badge.state-ready { background: rgba(59, 130, 246, 0.12); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.25); }
.sl-process-badge.state-running { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); }
.sl-process-badge.state-blocked,
.sl-process-badge.state-waiting { background: rgba(239, 68, 68, 0.12); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.25); }
.sl-process-badge.state-completed { background: #1C1C1C; color: #71717A; border: 1px solid #282828; }

/* Sync Chips */
.sl-sync-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 5px;
  margin-top: 2px;
}

.sl-sync-chip {
  padding: 1px 5px;
  border-radius: 4px;
  font: 600 9px/1.3 ui-monospace, monospace;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.sl-sync-chip.held { background: rgba(16, 185, 129, 0.12); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.25); }
.sl-sync-chip.consumed { background: rgba(59, 130, 246, 0.12); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.25); }
.sl-sync-chip.none { background: #181818; color: var(--sl-text-subtle); border: 1px solid var(--sl-border); }
.sl-sync-chip.waiting-full { background: rgba(245, 158, 11, 0.12); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.25); font-weight: 600; }
.sl-sync-chip.cooking-outside-mutex { background: rgba(16, 185, 129, 0.12); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 600; }
.sl-sync-chip.mutex-held { background: rgba(239, 68, 68, 0.12); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.25); font-weight: 700; }
.sl-sync-chip.mutex-waiting { background: rgba(245, 158, 11, 0.12); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.25); }
.sl-sync-chip.mutex-none { background: #181818; color: var(--sl-text-subtle); border: 1px solid var(--sl-border); }

/* Workstation Prep */
.sl-workstation-prep {
  display: grid;
  gap: 3px;
  margin-top: 3px;
}

.sl-prep-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}

.sl-prep-percentage {
  font: 700 10px ui-monospace, monospace;
  color: #34D399;
}

.sl-workstation-prep em {
  font: 10px ui-monospace, monospace;
  color: var(--sl-text-muted);
  font-style: normal;
}

.sl-prep-progress {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 9999px;
  background: #242424;
}

.sl-prep-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--sl-green);
  transition: width 0.25s ease;
}

/* State Dots */
.sl-workstation .sl-state-dot,
.sl-process-card .sl-state-dot {
  grid-column: 1;
  margin-top: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.sl-state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #52525B;
}

.sl-state-dot.idle { background: #52525B; }
.sl-state-dot.ready { background: #60A5FA; }
.sl-state-dot.running { background: var(--sl-green); }
.sl-state-dot.waiting_for_order { background: var(--sl-amber); }
.sl-state-dot.full_permit_reserved { background: #60A5FA; }
.sl-state-dot.waiting_for_mutex,
.sl-state-dot.blocked,
.sl-state-dot.waiting { background: var(--sl-red); }
.sl-state-dot.critical_section { background: var(--sl-amber); }
.sl-state-dot.order_removed { background: var(--sl-green); }
.sl-state-dot.preparing { background: var(--sl-amber); }
.sl-state-dot.completed { background: #52525B; }

/* Process Detail Box */
.sl-process-detail {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  color: var(--sl-text-primary);
  font-size: 11px;
}

.sl-process-detail b {
  font: 700 11px ui-monospace, monospace;
  color: var(--sl-text-heading);
}

.sl-process-detail span {
  font: 600 11px inherit;
  color: var(--sl-text-primary);
}

.sl-process-detail small {
  font: 10px ui-monospace, monospace;
  color: var(--sl-text-muted);
}

/* Resources & Integrity Grid */
.sl-resource-integrity-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(250px, 1fr) minmax(220px, 0.85fr);
  gap: 14px;
  margin-top: 14px;
  min-width: 0;
}

.sl-resource-integrity-grid > * {
  min-width: 0;
}

.sl-resource-panel {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 16px;
}

.sl-semaphores {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.sl-metric-button {
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 0;
}

.sl-metric-button:hover {
  border-color: var(--sl-border-active);
  background: var(--sl-surface-hover);
}

.sl-metric-button.selected {
  border-color: var(--sl-amber) !important;
  background: rgba(245, 158, 11, 0.08) !important;
}

.sl-metric-button span {
  display: block;
  font: 700 9px ui-monospace, monospace;
  color: var(--sl-text-muted);
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
}

.sl-metric-button strong {
  display: block;
  font: 700 20px ui-monospace, monospace;
  color: var(--sl-text-heading);
  margin-top: 5px;
}

.sl-metric-button strong.amber { color: var(--sl-amber); }
.sl-metric-button strong.green { color: var(--sl-green); }
.sl-metric-button strong.red { color: var(--sl-red); }

.sl-resource-detail {
  margin: 10px 0 6px !important;
  color: var(--sl-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.sl-resource-panel > small {
  display: block;
  color: var(--sl-text-subtle);
  font-size: 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sl-invariant {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 10px;
  padding: 10px 12px;
  background: #141A17;
  border: 1px solid #1F382B;
  border-radius: 8px;
}

.sl-invariant span {
  font: 700 9px ui-monospace, monospace;
  color: #34D399;
}

.sl-invariant b {
  font: 700 11px ui-monospace, monospace;
  color: var(--sl-text-heading);
}

.sl-invariant em {
  font-size: 9px;
  color: var(--sl-text-muted);
  font-style: normal;
  margin-left: auto;
}

/* Ready for Pickup Panel */
.sl-ready-panel {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 16px;
}

.sl-ready-panel .sl-panel-title {
  margin-bottom: 10px;
}

.sl-ready-orders {
  display: grid;
  gap: 8px;
}

.sl-ready-order {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--sl-surface-2);
}

.sl-ready-order > .sl-food-photo {
  width: 44px;
  height: 38px;
  border-radius: 6px;
}

.sl-ready-order > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sl-ready-order b {
  font: 700 11px ui-monospace, monospace;
  color: var(--sl-text-heading);
}

.sl-ready-order small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sl-text-muted);
  font-size: 11px;
}

/* System Integrity Panel */
.sl-integrity-panel {
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  padding: 16px;
  border-left: 3px solid var(--sl-green);
}

.sl-integrity-panel.failed {
  border-left-color: var(--sl-red);
  background: rgba(239, 68, 68, 0.06);
}

.sl-integrity-status {
  display: block;
  margin-top: 8px;
  color: #34D399;
  font: 700 10px ui-monospace, monospace;
}

.sl-integrity-panel.failed .sl-integrity-status {
  color: #F87171;
}

.sl-integrity-panel > p {
  margin-top: 8px !important;
  color: #F87171 !important;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.sl-text-button {
  border: 0;
  background: transparent;
  color: var(--sl-amber);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
}

.sl-integrity-checks {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.sl-integrity-checks > div {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 2px 8px;
  padding: 7px 9px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  font-size: 10px;
}

.sl-integrity-checks b {
  font: 700 8px ui-monospace, monospace;
  color: #34D399;
}

.sl-integrity-checks small {
  grid-column: 2;
  color: var(--sl-text-muted);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/* Section 01 System Model Styles */
.sl-model-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 2vw, 24px);
  padding: 24px 14px;
  background: var(--sl-surface-1);
  border: 1px solid var(--sl-border);
  border-radius: 12px;
  margin-bottom: 16px;
}

.sl-actor {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 145px;
  padding: 14px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  color: var(--sl-amber);
}

.sl-actor.consumer {
  color: #34D399;
}

.sl-actor b {
  font-size: 12px;
  font-weight: 600;
  color: var(--sl-text-heading);
}

.sl-actor small {
  font-size: 10px;
  color: var(--sl-text-muted);
  margin-top: 2px;
}

.sl-flow-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--sl-text-subtle);
  font: 700 9px ui-monospace, monospace;
}

.sl-flow-arrow.reverse {
  transform: scaleX(-1);
}

.sl-flow-arrow.reverse span {
  transform: scaleX(-1);
}

.sl-buffer-diagram {
  width: min(340px, 34vw);
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  color: var(--sl-text-primary);
  border-radius: 10px;
  padding: 14px;
}

.sl-buffer-top span {
  font: 700 8px ui-monospace, monospace;
  letter-spacing: 0.12em;
  color: var(--sl-amber);
}

.sl-buffer-top b {
  font-size: 16px;
  font-weight: 600;
  color: var(--sl-text-heading);
  display: block;
  margin: 2px 0;
}

.sl-buffer-top small {
  font-size: 10px;
  color: var(--sl-text-muted);
  display: block;
}

.sl-mini-slots {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin: 10px 0;
}

.sl-mini-slots span {
  display: grid;
  place-items: center;
  height: 26px;
  border: 1px solid var(--sl-border);
  border-radius: 4px;
  color: var(--sl-amber);
  background: var(--sl-surface-1);
  font: 700 10px ui-monospace, monospace;
}

.sl-lock-note {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  color: var(--sl-text-muted);
  font-size: 10px;
}

.sl-model-lower {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.sl-architecture {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.sl-architecture > div {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  width: 100%;
  padding: 8px;
  color: var(--sl-amber);
}

.sl-architecture > div.shared {
  background: #141A17;
  border-color: #1F382B;
  color: #34D399;
}

.sl-architecture b {
  font-size: 11px;
  color: var(--sl-text-heading);
}

.sl-architecture small {
  font-size: 10px;
  color: var(--sl-text-muted);
}

.sl-concept-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.sl-concept-pills span {
  font: 600 9px ui-monospace, monospace;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  color: var(--sl-text-muted);
  padding: 4px 8px;
  border-radius: 9999px;
}

.sl-mapping {
  display: grid;
  grid-template-columns: 1fr 24px 1fr;
}

.sl-mapping > div {
  display: contents;
}

.sl-mapping span,
.sl-mapping b {
  padding: 8px 10px;
  border-bottom: 1px solid var(--sl-border-subtle);
  font-size: 11px;
}

.sl-mapping span {
  color: var(--sl-text-muted);
}

.sl-mapping b {
  color: var(--sl-text-heading);
  font-weight: 500;
}

.sl-mapping svg {
  align-self: center;
  justify-self: center;
  color: var(--sl-text-subtle);
}

/* Section 04 Solution Styles */
.sl-algorithms {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 14px 0;
}

.sl-algorithms pre {
  margin: 0;
  padding: 12px 14px;
  background: #0E0E0E;
  border: 1px solid var(--sl-border);
  color: #D4D4D8;
  border-radius: 8px;
  font: 10px/1.8 ui-monospace, monospace;
  overflow: auto;
}

.sl-algorithms .algorithm-line {
  display: block;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
}

.sl-algorithms .algorithm-line.current {
  background: rgba(245, 158, 11, 0.2);
  color: #FBBF24;
  font-weight: 700;
}

.sl-code-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 12px 0;
}

.sl-code-steps > div {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
}

.sl-code-steps > div.current {
  background: rgba(245, 158, 11, 0.12);
  border-color: var(--sl-amber);
}

.sl-code-steps > div.done {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.25);
}

.sl-code-steps span {
  font: 700 8px ui-monospace, monospace;
  color: var(--sl-text-subtle);
}

.sl-code-steps code {
  font: 10px ui-monospace, monospace;
  color: var(--sl-text-heading);
}

.sl-code-steps i {
  position: absolute;
  right: 5px;
  top: 3px;
  font: 700 7px ui-monospace, monospace;
  color: var(--sl-amber);
  font-style: normal;
}

.sl-explain-step {
  padding: 10px 12px;
  background: var(--sl-surface-2);
  border-left: 3px solid var(--sl-amber);
  border-radius: 6px;
}

.sl-explain-step span {
  font: 700 8px ui-monospace, monospace;
  color: var(--sl-amber);
  letter-spacing: 0.1em;
}

.sl-explain-step p {
  font-size: 11px;
  color: var(--sl-text-primary);
  line-height: 1.55;
  margin: 4px 0 0;
}

.sl-debug-vars {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 6px;
  padding: 10px 12px;
  background: var(--sl-surface-2);
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  margin-top: 10px;
}

.sl-debug-vars > * {
  font-size: 10px;
  color: var(--sl-text-muted);
}

.sl-debug-vars code {
  font: 9px/1.4 ui-monospace, monospace;
  color: var(--sl-amber);
  overflow-wrap: anywhere;
}

/* Flowcharts Section */
.sl-flowcharts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.sl-flowcharts .combined-flow {
  grid-column: 1 / -1;
}

.sl-flow-svg,
.sl-combined-svg {
  width: 100%;
  height: auto;
  display: block;
  margin: 8px auto 0;
  background: #0C0C0C;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
}

.sl-flow-lines path,
.combined-lines path {
  fill: none;
  stroke: #52525B;
  stroke-width: 1.6;
}

.sl-flow-node rect,
.sl-flow-node ellipse {
  fill: #161616;
  stroke: #2E2E2E;
  stroke-width: 1.4;
}

.sl-flow-node polygon {
  fill: #1C1810;
  stroke: var(--sl-amber);
  stroke-width: 1.4;
}

.sl-flow-node.terminal ellipse {
  fill: #101F18;
  stroke: var(--sl-green);
}

.sl-flow-node text {
  font: 10px Inter, system-ui, sans-serif;
  fill: #EDEDED;
}

.sl-flow-node text.sub {
  font: 8px ui-monospace, monospace;
  fill: #A1A1AA;
}

.sl-flow-label {
  font: 700 8px ui-monospace, monospace;
  fill: var(--sl-amber);
}

.sl-flow-node.clickable {
  cursor: pointer;
}

.sl-flow-node.active rect,
.sl-flow-node.active ellipse,
.sl-flow-node.active polygon {
  stroke: var(--sl-amber);
  stroke-width: 2.5;
  fill: #261E14;
}

.sl-compare {
  margin-top: 14px;
}

.sl-compare > div {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 0;
}

.sl-compare b,
.sl-compare span {
  padding: 8px 10px;
  border-bottom: 1px solid var(--sl-border-subtle);
  font-size: 11px;
  line-height: 1.5;
}

.sl-compare b {
  color: var(--sl-text-heading);
}

.sl-compare span {
  color: var(--sl-text-muted);
}

/* Footer */
.sl-footer {
  max-width: 1420px;
  margin: 24px auto 0;
  padding-top: 14px;
  border-top: 1px solid var(--sl-border-subtle);
  color: var(--sl-text-subtle);
  font: 600 9px ui-monospace, monospace;
  text-align: center;
  letter-spacing: 0.05em;
}

/* Focus States */
.sl-btn:focus-visible,
.sl-section-nav button:focus-visible,
.sl-mode-selector button:focus-visible,
.sl-history-row:focus-visible,
.sl-slot:focus-visible,
.sl-metric-button:focus-visible,
.sl-workstation:focus-visible,
.sl-process-card:focus-visible {
  outline: 2px solid var(--sl-amber);
  outline-offset: 2px;
}

/* Responsive adjustments */
@media (max-width: 1000px) {
  .sl-sim-grid,
  .refined-sim-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .sl-sim-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sl-sim-side > .sl-panel:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .synclab-shell {
    padding: 14px 12px 24px;
  }
  .sl-header {
    flex-wrap: wrap;
    gap: 10px;
  }
  .sl-brand h1 {
    font-size: 18px;
  }
  .sl-section-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }
  .sl-model-lower,
  .sl-algorithms,
  .sl-flowcharts {
    grid-template-columns: 1fr;
  }
  .sl-flowcharts .combined-flow {
    grid-column: auto;
  }
  .sl-control-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .sl-semaphores {
    grid-template-columns: 1fr;
  }
  .sl-resource-integrity-grid {
    grid-template-columns: 1fr;
  }
  .sl-sim-side {
    grid-template-columns: 1fr;
  }
  .sl-sim-side > .sl-panel:last-child {
    grid-column: auto;
  }
  .sl-buffer-selected {
    grid-template-columns: 1fr;
  }
  .sl-current-operation {
    grid-template-columns: 1fr;
  }
  .sl-slots {
    min-width: 580px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .synclab-shell * {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

// Part 3: Dark Harmonization Overrides for All Child Sections (appended at bottom of file)
const darkHarmonization = `
/* ==========================================================================
   CANTEO SYNCLAB — GLOBAL DARK THEME OVERRIDES FOR CHILD SECTIONS
   ========================================================================== */

/* Section 04: Interactive Synchronization Solution Overrides */
.sl-solution-container {
  color: var(--sl-text-primary) !important;
}
.sl-solution-container .sl-panel,
.sl-solution-container .sl-controls-card,
.sl-solution-container .sl-playback-bar,
.sl-solution-container .sl-telemetry-hud,
.sl-solution-container .sl-step-banner,
.sl-solution-container .sl-pseudocode-drawer {
  background: var(--sl-surface-1) !important;
  border-color: var(--sl-border) !important;
  color: var(--sl-text-primary) !important;
}
.sl-solution-container h2,
.sl-solution-container h3,
.sl-solution-container strong {
  color: var(--sl-text-heading) !important;
}
.sl-solution-container p,
.sl-solution-container span {
  color: var(--sl-text-muted);
}
.sl-solution-container .sl-q-slot {
  background: var(--sl-surface-2) !important;
  border-color: var(--sl-border) !important;
  color: var(--sl-text-primary) !important;
}

/* Section 05: Flowcharts View Overrides */
.sl-flowcharts-view {
  color: var(--sl-text-primary) !important;
}
.sl-flowcharts-controls,
.sl-flowchart-card,
.sl-flowchart-legend {
  background: var(--sl-surface-1) !important;
  border-color: var(--sl-border) !important;
  color: var(--sl-text-primary) !important;
}
.sl-flowcharts-controls h2,
.sl-flowcharts-controls h3,
.sl-flowchart-card h3 {
  color: var(--sl-text-heading) !important;
}
.sl-flowcharts-controls p,
.sl-flowchart-card p {
  color: var(--sl-text-muted) !important;
}
.sl-flowchart-tab {
  background: var(--sl-surface-2) !important;
  border-color: var(--sl-border) !important;
  color: var(--sl-text-muted) !important;
}
.sl-flowchart-tab.active {
  background: var(--sl-surface-3) !important;
  border-color: var(--sl-border-active) !important;
  color: var(--sl-text-heading) !important;
}

/* Section 02.B: Execution Analysis Overrides */
.sl-analysis-section {
  background: var(--sl-surface-1) !important;
  border: 1px solid var(--sl-border) !important;
  box-shadow: none !important;
  color: var(--sl-text-primary) !important;
}
.sl-analysis-header {
  border-bottom: 1px solid var(--sl-border-subtle) !important;
}
.sl-analysis-title-block h3 {
  color: var(--sl-text-heading) !important;
}
.sl-analysis-title-block p {
  color: var(--sl-text-muted) !important;
}
.sl-occupancy-card,
.sl-timeline-card,
.sl-step-explanation-card {
  background: var(--sl-surface-2) !important;
  border: 1px solid var(--sl-border) !important;
  color: var(--sl-text-primary) !important;
}
.sl-chart-panel {
  background: #0E0E0E !important;
  border-color: var(--sl-border) !important;
}
.sl-timeline-container {
  background: #0E0E0E !important;
  border-color: var(--sl-border) !important;
}
.sl-summary-primary {
  background: transparent !important;
}
.sl-step-explanation-card.historical {
  background: #14171E !important;
  border-color: #26354D !important;
}
.sl-step-explanation-card.live {
  background: #131A16 !important;
  border-color: #1F382B !important;
}
.sl-details-drawer {
  background: #0E0E0E !important;
  border-top-color: var(--sl-border) !important;
}
.sl-snap-block {
  background: var(--sl-surface-1) !important;
  border-color: var(--sl-border) !important;
}
.sl-snap-block b {
  color: var(--sl-text-heading) !important;
}
.sl-thread-row {
  border-bottom-color: var(--sl-border-subtle) !important;
}

/* Classroom Workbench Overrides */
.sl-workbench-container,
.sl-workbench-card,
.sl-workbench-header,
.sl-workbench-toolbar,
.sl-stage-panel,
.sl-exercise-card {
  background: var(--sl-surface-1) !important;
  border-color: var(--sl-border) !important;
  color: var(--sl-text-primary) !important;
}
.sl-workbench-header h3,
.sl-stage-panel h4,
.sl-exercise-card h3 {
  color: var(--sl-text-heading) !important;
}
.sl-workbench-header p,
.sl-stage-panel p,
.sl-exercise-card p {
  color: var(--sl-text-muted) !important;
}
.sl-stage-step-pill {
  background: var(--sl-surface-2) !important;
  border-color: var(--sl-border) !important;
  color: var(--sl-text-muted) !important;
}
.sl-stage-step-pill.active {
  background: var(--sl-surface-3) !important;
  border-color: var(--sl-border-active) !important;
  color: var(--sl-text-heading) !important;
}
.sl-workbench-evidence-block {
  background: #0E0E0E !important;
  border-color: var(--sl-border) !important;
}
`;

const newContent = refinedCore + '\n\n' + tailSection + '\n\n' + darkHarmonization;
writeFileSync('canteo/src/synclab/synclab.css', newContent, 'utf8');
console.log('Successfully wrote refined dark synclab.css. Total length:', newContent.length);

