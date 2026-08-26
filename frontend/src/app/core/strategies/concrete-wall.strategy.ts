import { AudioEffectStrategy } from './audio-effect.strategy';

export class ConcreteWallStrategy implements AudioEffectStrategy {
  readonly materialName = 'Concrete';
  private static readonly ABSORPTION_COEFFICIENT = 0.02;

  calculateReflection(energy: number): number {
    return energy * ConcreteWallStrategy.ABSORPTION_COEFFICIENT;
  }

  getRT60Estimate(): number {
    return 0.8;
  }
}
