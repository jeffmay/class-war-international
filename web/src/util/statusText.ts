/**
 * Imperative status bar API.
 *
 * Uses document.getElementById so it can be called from anywhere — event
 * handlers, error boundaries, game logic — without threading React props or
 * state setters through the component tree.
 *
 * Board.tsx owns the <span id={STATUS_TEXT_ID}> element and uses
 * useLayoutEffect to sync its computed default text into the DOM.  Calls to
 * setStatusText made between renders (hover, errors) take effect immediately
 * and persist until the next useLayoutEffect sync.
 */

export const STATUS_TEXT_ID = "game-status-text";

export type StatusType = "info" | "warn" | "error";

export interface ErrorLogEntry {
  timestamp: Date;
  message: string;
  /** The original thrown value (Error, string, etc.) */
  raw?: unknown;
}

const _errorLog: ErrorLogEntry[] = [];

/** Read-only view of every error that has been passed to logError. */
export function getErrorLog(): readonly ErrorLogEntry[] {
  return _errorLog;
}

/**
 * Set the status bar text and visual type immediately.
 *
 * - "info"  — default colour; used for contextual hints and game state prompts.
 * - "warn"  — amber; used to explain why an action is currently unavailable.
 * - "error" — red; used for caught programming errors or invalid states.
 */
export function setStatusText(text: string, type: StatusType = "info"): void {
  const el = document.getElementById(STATUS_TEXT_ID);
  if (!el) return;
  el.textContent = text;
  el.classList.remove("game-status-info", "game-status-warn", "game-status-error");
  el.classList.add(`game-status-${type}`);
}

/**
 * Record a programming error, print it to the console, and show it in the
 * status bar with a brief flash animation so the developer notices it.
 *
 * All logged entries are accessible via getErrorLog() for future display in
 * an error-log panel.
 */
export function logError(message: string, raw?: unknown): void {
  _errorLog.push({ timestamp: new Date(), message, raw });
  console.error("[ClassWar]", message, raw);

  const el = document.getElementById(STATUS_TEXT_ID);
  if (!el) return;

  setStatusText(message, "error");

  // Restart the flash animation even if it is already running.
  el.classList.remove("game-status-flash");
  // Trigger a reflow so the browser registers the class removal before re-adding.
  void el.offsetWidth;
  el.classList.add("game-status-flash");
}
