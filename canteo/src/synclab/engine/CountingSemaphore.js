export class CountingSemaphore {
  constructor(name, initialValue, maxValue = Number.POSITIVE_INFINITY) {
    if (!Number.isInteger(initialValue) || initialValue < 0 || (!Number.isInteger(maxValue) && maxValue !== Number.POSITIVE_INFINITY) || maxValue < initialValue) {
      throw new RangeError('Semaphore initial and maximum values must be valid non-negative counts.');
    }
    this.name = name;
    this.value = initialValue;
    this.maxValue = maxValue;
    this.waiters = [];
    this.holders = new Set();
  }

  wait(processId) {
    if (!processId) throw new TypeError('Semaphore wait requires a process id.');
    if (this.holders.has(processId)) return { acquired: false, alreadyHeld: true };
    if (this.waiters.includes(processId)) return { acquired: false, alreadyWaiting: true };
    if (this.waiters.length) {
      this.waiters.push(processId);
      return { acquired: false, blocked: true };
    }
    if (this.value > 0) {
      this.value -= 1;
      this.holders.add(processId);
      return { acquired: true };
    }
    this.waiters.push(processId);
    return { acquired: false, blocked: true };
  }

  signal() {
    if (this.value + this.holders.size >= this.maxValue) throw new RangeError(`${this.name} semaphore has no permit available to signal.`);
    if (this.waiters.length) {
      const woken = this.waiters.shift();
      this.holders.add(woken);
      return { woken, permitTransferred: true };
    }
    this.value += 1;
    return { woken: null, permitTransferred: false };
  }

  releasePermit(processId) {
    if (!this.holders.delete(processId)) throw new Error(`${processId} does not hold a ${this.name} permit.`);
  }
}
