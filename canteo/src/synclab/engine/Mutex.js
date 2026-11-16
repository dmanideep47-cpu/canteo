export class Mutex {
  constructor() { this.owner = null; this.waiters = []; }
  acquire(processId) {
    if (!processId) throw new TypeError('Mutex acquisition requires a process id.');
    if (this.owner === processId) throw new Error(`${processId} cannot reacquire a non-recursive mutex it already owns.`);
    if (this.owner === null && this.waiters.length === 0) { this.owner = processId; return { acquired: true }; }
    if (!this.waiters.includes(processId)) this.waiters.push(processId);
    return { acquired: false, blocked: true };
  }
  release(processId) {
    if (this.owner !== processId) throw new Error(`${processId} cannot release a mutex owned by ${this.owner ?? 'nobody'}.`);
    const next = this.waiters.shift() ?? null;
    this.owner = next;
    return next;
  }
}
