// A growable list of horizontal pixel runs, stored in typed arrays so the
// hot loop doesn't allocate. Each run covers pixels x1..x2 (inclusive) on row
// y with a coverage alpha in 0..0xffff.

export class Scanlines {
  constructor(capacity = 1024) {
    this.length = 0;
    this.alloc(capacity);
  }

  alloc(capacity) {
    const old = this.ys;
    this.capacity = capacity;
    const ys = new Int32Array(capacity);
    const x1s = new Int32Array(capacity);
    const x2s = new Int32Array(capacity);
    const alphas = new Uint32Array(capacity);
    if (old) {
      ys.set(this.ys.subarray(0, this.length));
      x1s.set(this.x1s.subarray(0, this.length));
      x2s.set(this.x2s.subarray(0, this.length));
      alphas.set(this.alphas.subarray(0, this.length));
    }
    this.ys = ys;
    this.x1s = x1s;
    this.x2s = x2s;
    this.alphas = alphas;
  }

  clear() {
    this.length = 0;
    return this;
  }

  push(y, x1, x2, alpha) {
    if (this.length === this.capacity) this.alloc(this.capacity * 2);
    const i = this.length++;
    this.ys[i] = y;
    this.x1s[i] = x1;
    this.x2s[i] = x2;
    this.alphas[i] = alpha;
  }

  // Drop or clip runs that fall outside a w x h image.
  crop(w, h) {
    const { ys, x1s, x2s, alphas } = this;
    let j = 0;
    for (let i = 0; i < this.length; i++) {
      const y = ys[i];
      let x1 = x1s[i];
      let x2 = x2s[i];
      if (y < 0 || y >= h || x1 >= w || x2 < 0) continue;
      if (x1 < 0) x1 = 0;
      if (x2 > w - 1) x2 = w - 1;
      if (x1 > x2) continue;
      ys[j] = y;
      x1s[j] = x1;
      x2s[j] = x2;
      alphas[j] = alphas[i];
      j++;
    }
    this.length = j;
    return this;
  }
}
