export interface AudioEffectStrategy {
  readonly materialName: string;
  calculateReflection(energy: number): number;
  getRT60Estimate(): number;
}
