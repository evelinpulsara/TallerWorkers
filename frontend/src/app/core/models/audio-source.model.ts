import { Vector2D } from './vector2d.model';

export class AudioSource {
  readonly id: string;
  position: Vector2D;
  peakLevelDb: number;
  label: string;

  constructor(params: {
    id?: string;
    position: Vector2D;
    peakLevelDb?: number;
    label?: string;
  }) {
    this.id = params.id ?? crypto.randomUUID();
    this.position = params.position;
    this.peakLevelDb = params.peakLevelDb ?? 94;
    this.label = params.label ?? 'Speaker';
  }

  get initialEnergy(): number {
    return Math.pow(10, this.peakLevelDb / 10);
  }

  toJSON(): object {
    return {
      id: this.id,
      position: this.position.toJSON(),
      peakLevelDb: this.peakLevelDb,
      label: this.label,
    };
  }

  static fromJSON(obj: {
    id: string;
    position: { x: number; y: number };
    peakLevelDb: number;
    label: string;
  }): AudioSource {
    return new AudioSource({
      id: obj.id,
      position: Vector2D.fromJSON(obj.position),
      peakLevelDb: obj.peakLevelDb,
      label: obj.label,
    });
  }
}
