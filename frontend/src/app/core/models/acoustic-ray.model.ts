import { Vector2D } from './vector2d.model';

export interface RayPathPoint {
  position: Vector2D;
  energyAtPoint: number;
}

export interface RayCaptureResult {
  rayId: string;
  totalDistance: number;
  remainingEnergy: number;
  bounceCount: number;
  arrivalDelayMs: number;
}

export class AcousticRay {
  readonly id: string;
  readonly origin: Vector2D;
  angle: number;
  energy: number;
  bounceCount: number;
  readonly maxBounces: number;
  currentPosition: Vector2D;
  readonly path: RayPathPoint[];
  terminated: boolean;

  static readonly SPEED_OF_SOUND_MS = 343;

  constructor(params: {
    id?: string;
    origin: Vector2D;
    angle: number;
    initialEnergy: number;
    maxBounces?: number;
  }) {
    this.id = params.id ?? crypto.randomUUID();
    this.origin = params.origin;
    this.angle = params.angle;
    this.energy = Math.min(1, params.initialEnergy / 1e9);
    this.bounceCount = 0;
    this.maxBounces = params.maxBounces ?? 10;
    this.currentPosition = params.origin;
    this.terminated = false;
    this.path = [{ position: params.origin, energyAtPoint: this.energy }];
  }

  step(stepSize: number): void {
    const nextX = this.currentPosition.x + Math.cos(this.angle) * stepSize;
    const nextY = this.currentPosition.y + Math.sin(this.angle) * stepSize;
    this.currentPosition = new Vector2D(nextX, nextY);
    this.path.push({ position: this.currentPosition, energyAtPoint: this.energy });
  }

  reflect(lostEnergy: number, wallAxis: 'horizontal' | 'vertical'): void {
    if (wallAxis === 'vertical') {
      this.angle = Math.PI - this.angle;
    } else {
      this.angle = -this.angle;
    }
    this.energy = Math.max(0, this.energy - lostEnergy);
    this.bounceCount++;
    if (this.bounceCount >= this.maxBounces || this.energy <= 0.001) {
      this.terminated = true;
    }
  }

  get totalDistance(): number {
    let dist = 0;
    for (let i = 1; i < this.path.length; i++) {
      dist += this.path[i - 1].position.distanceTo(this.path[i].position);
    }
    return dist;
  }

  buildCaptureResult(): RayCaptureResult {
    const CANVAS_TO_METERS = 0.2;
    const distanceMeters = this.totalDistance * CANVAS_TO_METERS;
    return {
      rayId: this.id,
      totalDistance: this.totalDistance,
      remainingEnergy: this.energy,
      bounceCount: this.bounceCount,
      arrivalDelayMs: (distanceMeters / AcousticRay.SPEED_OF_SOUND_MS) * 1000,
    };
  }
}
