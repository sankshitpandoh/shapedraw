export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static fromHex(x) {
    x = x.replace(/^#+|#+$/g, '');
    const h = (s) => parseInt(s, 16) || 0;
    let r = 0, g = 0, b = 0, a = 255;
    switch (x.length) {
      case 3:
      case 4:
        r = h(x[0]) * 17;
        g = h(x[1]) * 17;
        b = h(x[2]) * 17;
        if (x.length === 4) a = h(x[3]) * 17;
        break;
      case 6:
      case 8:
        r = h(x.slice(0, 2));
        g = h(x.slice(2, 4));
        b = h(x.slice(4, 6));
        if (x.length === 8) a = h(x.slice(6, 8));
        break;
    }
    return new Color(r, g, b, a);
  }

  hex() {
    const p = (v) => v.toString(16).padStart(2, '0');
    return `#${p(this.r)}${p(this.g)}${p(this.b)}`;
  }

  toJSON() {
    return { r: this.r, g: this.g, b: this.b, a: this.a };
  }
}
