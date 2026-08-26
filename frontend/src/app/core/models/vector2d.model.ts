export class Vector2D {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  distanceTo(other: Vector2D): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  angleTo(other: Vector2D): number {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }

  translate(dx: number, dy: number): Vector2D {
    return new Vector2D(this.x + dx, this.y + dy);
  }

  clamp(min: number, max: number): Vector2D {
    return new Vector2D(
      Math.min(max, Math.max(min, this.x)),
      Math.min(max, Math.max(min, this.y)),
    );
  }

  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  static fromJSON(obj: { x: number; y: number }): Vector2D {
    return new Vector2D(obj.x, obj.y);
  }

  toString(): string {
    return `Vector2D(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
  }
}
