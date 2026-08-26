import { AudioEffectStrategy } from './audio-effect.strategy';

export class FabricWallStrategy implements AudioEffectStrategy {
  readonly materialName = 'Fabric / Absorber';
  private static readonly ABSORPTION_COEFFICIENT = 0.70;

  calculateReflection(energy: number): number {
    return energy * FabricWallStrategy.ABSORPTION_COEFFICIENT;
  }

  getRT60Estimate(): number {
    return 0.2;
  }
}
