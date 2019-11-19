// @NOTE: Code taken from https://github.com/chen0040/js-graph-algorithms <3

class QueueNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class Queue {
  constructor() {
    this.first = null;
    this.last = null;
    this.N = 0;
  }

  enqueue(item) {
    const oldLast = this.last;
    this.last = new QueueNode(item);

    if (oldLast != null) {
      oldLast.next = this.last;
    }

    if (this.first == null) {
      this.first = this.last;
    }

    this.N++;
  }

  dequeue() {
    if (this.first == null) {
      return undefined;
    }

    const oldFirst = this.first;
    const item = oldFirst.value;
    this.first = oldFirst.next;

    if (this.first == null) {
      this.last = null;
    }

    this.N--;

    return item;
  }

  size() {
    return this.N;
  }

  isEmpty() {
    return this.N == 0;
  }

  toArray() {
    const result = [];

    let x = this.first;
    while (x != null) {
      result.push(x.value);
      x = x.next;
    }

    return result;
  }
}

export class FlowEdge {
  constructor(v, w, capacity) {
    this.v = v;
    this.w = w;
    this.capacity = capacity;
    this.flow = 0;
  }

  residualCapacityTo(x) {
    if (x == this.v) {
      return this.flow;
    } else {
      return this.capacity - this.flow;
    }
  }

  addResidualFlowTo(x, deltaFlow) {
    if (x == this.v) {
      this.flow -= deltaFlow;
    } else if (x == this.w) {
      this.flow += deltaFlow;
    }
  }

  from() {
    return this.v;
  }

  to() {
    return this.w;
  }

  other(x) {
    return x == this.v ? this.w : this.v;
  }
}

export class FlowNetwork {
  constructor(V) {
    this.V = V;
    this.adjList = [];
    this.nodeInfo = [];

    for (let v = 0; v < V; ++v) {
      this.adjList.push([]);
      this.nodeInfo.push({});
    }
  }

  node(v) {
    return this.nodeInfo[v];
  }

  edge(v, w) {
    const adj_v = this.adjList[v];

    for (let i = 0; i < adj_v.length; ++i) {
      const x = adj_v[i].other(v);

      if (x === w) {
        return adj_v[i];
      }
    }

    return null;
  }

  addEdge(e) {
    const v = e.from();
    this.adjList[v].push(e);

    const w = e.other(v);
    this.adjList[w].push(e);
  }

  adj(v) {
    return this.adjList[v];
  }
}

export default class MaxFlow {
  constructor(G, s, t) {
    let bottle = Number.MAX_VALUE;

    this.value = 0;
    this.marked = null;
    this.edgeTo = null;
    this.s = s;
    this.t = t;

    while (this.hasAugmentedPath(G)) {
      for (let x = this.t; x != this.s; x = this.edgeTo[x].other(x)) {
        bottle = Math.min(bottle, this.edgeTo[x].residualCapacityTo(x));
      }

      for (let x = this.t; x != this.s; x = this.edgeTo[x].other(x)) {
        this.edgeTo[x].addResidualFlowTo(x, bottle);
      }

      this.value += bottle;
    }
  }

  hasAugmentedPath(G) {
    const V = G.V;

    this.marked = [];
    this.edgeTo = [];

    for (let v = 0; v < V; ++v) {
      this.marked.push(false);
      this.edgeTo.push(null);
    }

    const queue = new Queue();
    queue.enqueue(this.s);

    this.marked[this.s] = true;

    while (!queue.isEmpty()) {
      const v = queue.dequeue();
      const adj_v = G.adj(v);

      for (let i = 0; i < adj_v.length; ++i) {
        const e = adj_v[i];
        const w = e.other(v);

        if (!this.marked[w] && e.residualCapacityTo(w) > 0) {
          this.edgeTo[w] = e;
          this.marked[w] = true;

          if (w === this.t) {
            return true;
          }

          queue.enqueue(w);
        }
      }
    }

    return false;
  }
}