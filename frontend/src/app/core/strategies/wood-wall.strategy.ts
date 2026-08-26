import { AudioEffectStrategy } from './audio-effect.strategy';

export class WoodWallStrategy implements AudioEffectStrategy {
  readonly materialName = 'Wood';
  private static readonly ABSORPTION_COEFFICIENT = 0.10;

  calculateReflection(energy: number): number {
    return energy * WoodWallStrategy.ABSORPTION_COEFFICIENT;
  }

  getRT60Estimate(): number {
    return 0.5;
  }
}
