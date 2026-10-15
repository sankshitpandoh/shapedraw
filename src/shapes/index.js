import { Triangle } from './triangle.js';
import { Rectangle } from './rectangle.js';
import { RotatedRectangle } from './rotated-rectangle.js';
import { Ellipse } from './ellipse.js';
import { RotatedEllipse } from './rotated-ellipse.js';
import { Quadratic } from './quadratic.js';
import { Polygon } from './polygon.js';

export { Triangle, Rectangle, RotatedRectangle, Ellipse, RotatedEllipse, Quadratic, Polygon };

// Same numbering as the Go CLI's -m flag.
export const ShapeType = Object.freeze({
  ANY: 0,
  TRIANGLE: 1,
  RECTANGLE: 2,
  ELLIPSE: 3,
  CIRCLE: 4,
  ROTATED_RECTANGLE: 5,
  QUADRATIC: 6,
  ROTATED_ELLIPSE: 7,
  POLYGON: 8,
});

export const shapeNames = [
  'combo',
  'triangle',
  'rectangle',
  'ellipse',
  'circle',
  'rotated rectangle',
  'beziers',
  'rotated ellipse',
  'polygon',
];

export function randomShape(ctx, type) {
  switch (type) {
    case ShapeType.TRIANGLE:
      return Triangle.random(ctx);
    case ShapeType.RECTANGLE:
      return Rectangle.random(ctx);
    case ShapeType.ELLIPSE:
      return Ellipse.random(ctx);
    case ShapeType.CIRCLE:
      return Ellipse.randomCircle(ctx);
    case ShapeType.ROTATED_RECTANGLE:
      return RotatedRectangle.random(ctx);
    case ShapeType.QUADRATIC:
      return Quadratic.random(ctx);
    case ShapeType.ROTATED_ELLIPSE:
      return RotatedEllipse.random(ctx);
    case ShapeType.POLYGON:
      return Polygon.random(ctx, 4, false);
    default:
      return randomShape(ctx, ctx.rnd.intn(8) + 1);
  }
}

const byName = {
  triangle: Triangle,
  rectangle: Rectangle,
  'rotated-rectangle': RotatedRectangle,
  ellipse: Ellipse,
  circle: Ellipse,
  'rotated-ellipse': RotatedEllipse,
  quadratic: Quadratic,
  polygon: Polygon,
};

export function shapeFromJSON(ctx, o) {
  const cls = byName[o.type];
  if (!cls) throw new Error(`unknown shape type: ${o.type}`);
  return cls.fromJSON(ctx, o);
}
