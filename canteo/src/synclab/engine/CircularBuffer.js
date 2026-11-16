export const BUFFER_CAPACITY = 5;

export class CircularBuffer {
  constructor(capacity = BUFFER_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity !== BUFFER_CAPACITY) {
      throw new RangeError('The Canteo teaching buffer has a fixed capacity of five.');
    }
    this.capacity = capacity;
    this.slots = Array(capacity).fill(null);
    this.writePosition = 0;
    this.readPosition = 0;
  }

  #assertPosition(position) {
    if (!Number.isInteger(position) || position < 0 || position >= this.capacity) throw new RangeError(`Circular buffer position ${position} is outside the fixed capacity.`);
  }

  writeCurrent(item) {
    if (item === null || item === undefined) throw new TypeError('A circular-buffer slot must contain an order item.');
    const position = this.writePosition;
    this.#assertPosition(position);
    if (this.slots[position] !== null) throw new Error(`Cannot overwrite occupied slot ${position}.`);
    this.slots[position] = item;
    return position;
  }

  advanceWrite() {
    this.#assertPosition(this.writePosition);
    this.writePosition = (this.writePosition + 1) % this.capacity;
    return this.writePosition;
  }

  insert(item) {
    const position = this.writeCurrent(item);
    this.advanceWrite();
    return position;
  }

  readCurrent() {
    const position = this.readPosition;
    this.#assertPosition(position);
    const item = this.slots[position];
    if (item === null) throw new Error(`Cannot consume empty slot ${position}.`);
    this.slots[position] = null;
    return { item, position };
  }

  advanceRead() {
    this.#assertPosition(this.readPosition);
    this.readPosition = (this.readPosition + 1) % this.capacity;
    return this.readPosition;
  }

  remove() {
    const result = this.readCurrent();
    this.advanceRead();
    return result;
  }

  get occupancy() { return this.slots.filter((slot) => slot !== null).length; }
  reset() { this.slots.fill(null); this.writePosition = 0; this.readPosition = 0; }
}
