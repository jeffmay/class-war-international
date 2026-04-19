/**
 * Tests for the imperative status bar utility.
 *
 * Each test that touches the DOM creates a fresh <span> with the correct ID
 * and removes it after, so tests remain isolated regardless of run order.
 */

import { getErrorLog, logError, setStatusText, STATUS_TEXT_ID } from './statusText';

// ── helpers ──────────────────────────────────────────────────────────────────

function createStatusEl(): HTMLSpanElement {
  const el = document.createElement('span');
  el.id = STATUS_TEXT_ID;
  document.body.appendChild(el);
  return el;
}

function removeStatusEl(el: HTMLElement): void {
  document.body.removeChild(el);
}

// ── setStatusText ─────────────────────────────────────────────────────────────

describe('setStatusText', () => {
  test('sets textContent on the element', () => {
    const el = createStatusEl();
    setStatusText('hello world');
    expect(el.textContent).toBe('hello world');
    removeStatusEl(el);
  });

  test('adds game-status-info class by default', () => {
    const el = createStatusEl();
    setStatusText('info message');
    expect(el.classList.contains('game-status-info')).toBe(true);
    removeStatusEl(el);
  });

  test('adds game-status-warn class when type is "warn"', () => {
    const el = createStatusEl();
    setStatusText('cannot undo', 'warn');
    expect(el.classList.contains('game-status-warn')).toBe(true);
    expect(el.classList.contains('game-status-info')).toBe(false);
    removeStatusEl(el);
  });

  test('adds game-status-error class when type is "error"', () => {
    const el = createStatusEl();
    setStatusText('something broke', 'error');
    expect(el.classList.contains('game-status-error')).toBe(true);
    expect(el.classList.contains('game-status-info')).toBe(false);
    removeStatusEl(el);
  });

  test('replaces a previous type class when called again', () => {
    const el = createStatusEl();
    setStatusText('first', 'warn');
    setStatusText('second', 'error');
    expect(el.classList.contains('game-status-error')).toBe(true);
    expect(el.classList.contains('game-status-warn')).toBe(false);
    removeStatusEl(el);
  });

  test('does nothing when the element is absent', () => {
    // No element in DOM — must not throw
    expect(() => setStatusText('text')).not.toThrow();
  });
});

// ── logError ──────────────────────────────────────────────────────────────────

describe('logError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('appends an entry to the error log', () => {
    const before = getErrorLog().length;
    logError('test error message');
    expect(getErrorLog().length).toBe(before + 1);
    expect(getErrorLog()[getErrorLog().length - 1].message).toBe('test error message');
  });

  test('stores the raw value in the log entry', () => {
    const raw = new Error('boom');
    logError('wrapped', raw);
    const entry = getErrorLog()[getErrorLog().length - 1];
    expect(entry.raw).toBe(raw);
  });

  test('stores a timestamp close to now', () => {
    const before = Date.now();
    logError('ts test');
    const after = Date.now();
    const ts = getErrorLog()[getErrorLog().length - 1].timestamp.getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  test('calls console.error with the message', () => {
    logError('console check', 'extra');
    expect(console.error).toHaveBeenCalledWith('[ClassWar]', 'console check', 'extra');
  });

  test('shows the message in the status element with error type', () => {
    const el = createStatusEl();
    logError('visible error');
    expect(el.textContent).toBe('visible error');
    expect(el.classList.contains('game-status-error')).toBe(true);
    removeStatusEl(el);
  });

  test('adds the game-status-flash class to trigger the animation', () => {
    const el = createStatusEl();
    logError('flash me');
    expect(el.classList.contains('game-status-flash')).toBe(true);
    removeStatusEl(el);
  });

  test('does nothing when the status element is absent', () => {
    expect(() => logError('no dom')).not.toThrow();
  });
});
