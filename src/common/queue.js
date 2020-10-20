// Handles a queue of pending transactions scoped via a key and locks the
// current one with additional data.
export default class TransactionQueue {
  constructor() {
    this.nextTicketId = 0;
    this.pending = {};
    this.current = {};
  }

  queue(key) {
    if (!(key in this.pending)) {
      this.pending[key] = [];
    }

    const ticketId = this.nextTicketId;
    this.pending[key].push(ticketId);
    this.nextTicketId += 1;

    return ticketId;
  }

  unqueue(key, ticketId) {
    const index = this.pending[key].findIndex((id) => id === ticketId);

    if (index > 0) {
      throw new Error(`Can only unqueue oldest transaction (LIFO logic)`);
    } else if (index === 0) {
      this.pending[key].shift();
    } else {
      // Do nothing!
    }
  }

  isNextInQueue(key, ticketId) {
    return this.pending[key].findIndex((id) => id === ticketId) === 0;
  }

  lockTransaction(key, transactionData) {
    if (key in this.current) {
      throw new Error(`Can't lock already locked transaction with key ${key}`);
    }

    this.current[key] = transactionData;
  }

  unlockTransaction(key, ticketId) {
    if (key in this.current && this.current[key].ticketId === ticketId) {
      delete this.current[key];
    }
  }

  isLocked(key) {
    return key in this.current;
  }

  getCurrentTransaction(key) {
    return this.current[key];
  }
}
