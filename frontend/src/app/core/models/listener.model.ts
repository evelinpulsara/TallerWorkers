import { Vector2D } from './vector2d.model';

export class Listener {
  readonly id: string;
  position: Vector2D;
  captureRadius: number;
  label: string;

  constructor(params: {
    id?: string;
    position: Vector2D;
    captureRadius?: number;
    label?: string;
  }) {
    this.id = params.id ?? crypto.randomUUID();
    this.position = params.position;
    this.captureRadius = params.captureRadius ?? 3;
    this.label = params.label ?? 'Listener';
  }

  captures(point: Vector2D): boolean {
    return this.position.distanceTo(point) <= this.captureRadius;
  }

  toJSON(): object {
    return {
      id: this.id,
      position: this.position.toJSON(),
      captureRadius: this.captureRadius,
      label: this.label,
    };
  }

  static fromJSON(obj: {
    id: string;
    position: { x: number; y: number };
    captureRadius: number;
    label: string;
  }): Listener {
    return new Listener({
      id: obj.id,
      position: Vector2D.fromJSON(obj.position),
      captureRadius: obj.captureRadius,
      label: obj.label,
    });
  }
}
