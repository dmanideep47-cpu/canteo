/**
 * Canteo SyncLab 2.0 - System Invariants & Mathematical Accounting
 */

export const BUFFER_CAPACITY = 5;

/**
 * Validates the counting semaphore and bounded buffer conservation invariant:
 * empty + full + reservedEmpty + reservedFull = 5
 *
 * @param {Object} state Engine snapshot
 * @returns {Object} Validation outcome
 */
export function validateSystemInvariants(state) {
  const empty = Number(state.empty ?? 5);
  const full = Number(state.full ?? 0);
  const reservedEmpty = Number(state.reservedEmpty ?? 0);
  const reservedFull = Number(state.reservedFull ?? 0);
  const capacity = Number(state.capacity ?? BUFFER_CAPACITY);
  const sum = empty + full + reservedEmpty + reservedFull;

  const valid = sum === capacity;
  const inFlight = reservedEmpty + reservedFull;
  const isQuiescent = inFlight === 0;

  return {
    valid,
    sum,
    capacity,
    empty,
    full,
    reservedEmpty,
    reservedFull,
    inFlight,
    isQuiescent,
    equation: `${empty} + ${full} + ${reservedEmpty} + ${reservedFull} = ${capacity}`,
    statusLabel: valid
      ? isQuiescent
        ? '✓ Quiescent (Invariant Holds)'
        : `⚡ ${inFlight} Permit${inFlight > 1 ? 's' : ''} in Transit`
      : `⚠️ Invariant Violation: Sum is ${sum}, Expected ${capacity}`,
  };
}

