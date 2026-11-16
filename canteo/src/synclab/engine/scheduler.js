/**
 * Canteo SyncLab 2.0 - Process Scheduler Strategies
 */

export const SCHEDULER_MODES = {
  MANUAL: 'manual',
  ROUND_ROBIN: 'roundRobin',
  RANDOM: 'random',
};

/**
 * Selects the next process to execute from runnable threads based on strategy
 *
 * @param {Array} processes List of all processes
 * @param {string} mode Scheduler strategy
 * @param {number} roundRobinIndex Current pointer for round robin
 * @returns {Object} { nextProcess, nextRoundRobinIndex }
 */
export function selectNextProcess(processes = [], mode = SCHEDULER_MODES.MANUAL, roundRobinIndex = 0) {
  const runnable = processes.filter(
    (p) => p.state === 'READY' || p.state === 'RUNNING'
  );

  if (!runnable.length) {
    return { nextProcess: null, nextRoundRobinIndex: roundRobinIndex };
  }

  if (mode === SCHEDULER_MODES.RANDOM) {
    const idx = Math.floor(Math.random() * runnable.length);
    return { nextProcess: runnable[idx], nextRoundRobinIndex: roundRobinIndex };
  }

  // Round Robin
  const selectedIdx = roundRobinIndex % runnable.length;
  const nextProcess = runnable[selectedIdx];
  const nextRoundRobinIndex = (roundRobinIndex + 1) % runnable.length;

  return { nextProcess, nextRoundRobinIndex };
}

