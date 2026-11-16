/**
 * Order Snapshot Adapter for Canteo Sync Lab.
 *
 * Safely adapts a real canteen customer order into an isolated, allowlisted
 * educational simulation snapshot.
 *
 * Guarantees:
 * 1. Strict allowlisting: only non-sensitive teaching metadata is copied.
 * 2. Immutable copy: source order object is never mutated.
 * 3. Identity separation: source order (e.g., 'ORD101') is strictly separated
 *    from simulated token identity (e.g., 'LAB-001').
 * 4. 1 Placed Order = 1 Buffer Ticket: multi-item orders become ONE order ticket.
 * 5. Safe fallback: corrupted, missing, or stale storage falls back to sample orders.
 */

const STORAGE_KEY = 'canteo_teaching_order_snapshot';

/**
 * Creates an immutable, allowlisted teaching snapshot from a real customer order.
 *
 * ALLOWLISTED FIELDS:
 * - sourceOrderId: string (e.g., "ORD101")
 * - items: array of { name: string, quantity: number }
 * - totalQuantity: integer count of all food items
 * - itemSummary: short readable summary (e.g., "2x Cold Brew, 1x Sandwich")
 * - placedAt: display timestamp string
 *
 * FORBIDDEN & EXCLUDED:
 * - Payment data, card info, UPI, transaction IDs
 * - Auth tokens, JWTs, user IDs, student IDs
 * - Contact information, emails, addresses, phones
 * - Internal database sequence numbers or mutable entity references
 */
export function createOrderTeachingSnapshot(realOrder) {
  if (!realOrder || typeof realOrder !== 'object') {
    return null;
  }

  const rawId = typeof realOrder.id === 'string' ? realOrder.id.trim() : `ORD-${Date.now()}`;
  const safeSourceId = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);

  // Extract items allowlist
  const rawItems = Array.isArray(realOrder.items) ? realOrder.items : [];
  const safeItems = rawItems
    .filter((it) => it && typeof it === 'object')
    .map((it) => ({
      name: String(it.name || 'Canteen Item').slice(0, 48),
      quantity: Math.max(1, Math.min(99, parseInt(it.quantity, 10) || 1)),
    }));

  // If no valid items found, provide a clean default
  if (safeItems.length === 0) {
    safeItems.push({ name: 'Canteen Meal', quantity: 1 });
  }

  const totalQuantity = safeItems.reduce((acc, it) => acc + it.quantity, 0);

  // Build clean summary string
  const summaryParts = safeItems.map((it) => `${it.quantity}x ${it.name}`);
  const itemSummary = summaryParts.join(', ');

  const placedAt = typeof realOrder.timestamp === 'string'
    ? realOrder.timestamp.slice(0, 32)
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const snapshot = {
    sourceOrderId: safeSourceId,
    totalQuantity,
    items: safeItems,
    itemSummary: itemSummary.length > 80 ? `${itemSummary.slice(0, 77)}...` : itemSummary,
    placedAt,
    isTeachingSnapshot: true,
  };

  // Deeply freeze to guarantee immutability
  return Object.freeze({
    ...snapshot,
    items: Object.freeze(snapshot.items.map((it) => Object.freeze({ ...it }))),
  });
}

/**
 * Creates an independent simulated lab request token from an allowlisted snapshot.
 * An order containing multiple items enters the bounded buffer as ONE order ticket.
 */
export function createLabRequestFromSnapshot(snapshot, nextSeq = 1) {
  if (!snapshot || !snapshot.sourceOrderId) {
    return {
      id: `LAB-${String(nextSeq).padStart(3, '0')}`,
      name: 'Sample Order Ticket',
      seq: nextSeq,
      sourceOrderRef: null,
      isImportedFromOrder: false,
    };
  }

  return {
    id: `LAB-${String(nextSeq).padStart(3, '0')}`,
    name: snapshot.itemSummary || `Order Ticket (${snapshot.sourceOrderId})`,
    seq: nextSeq,
    sourceOrderRef: snapshot.sourceOrderId,
    itemCount: snapshot.totalQuantity || 1,
    isImportedFromOrder: true,
    snapshotSummary: {
      sourceOrderId: snapshot.sourceOrderId,
      totalQuantity: snapshot.totalQuantity,
      placedAt: snapshot.placedAt,
      itemSummary: snapshot.itemSummary,
    },
  };
}

/**
 * Persists teaching snapshot to sessionStorage with error handling.
 */
export function saveTeachingSnapshot(snapshot) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (!snapshot) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Gracefully handle storage quota or private-browsing restrictions
  }
}

/**
 * Retrieves and validates teaching snapshot from sessionStorage.
 * Returns null if missing, corrupted, or schema is invalid.
 */
export function getTeachingSnapshot() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.isTeachingSnapshot === true &&
      typeof parsed.sourceOrderId === 'string' &&
      Array.isArray(parsed.items)
    ) {
      return Object.freeze(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears teaching snapshot from sessionStorage.
 */
export function clearTeachingSnapshot() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Graceful no-op
  }
}

