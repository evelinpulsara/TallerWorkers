import type { AudioEffectStrategy } from './audio-effect.strategy';
import { ConcreteWallStrategy } from './concrete-wall.strategy';
import { WoodWallStrategy } from './wood-wall.strategy';
import { FabricWallStrategy } from './fabric-wall.strategy';

export type WallMaterialKey = 'concrete' | 'wood' | 'fabric';

const STRATEGY_MAP: Record<WallMaterialKey, () => AudioEffectStrategy> = {
  concrete: () => new ConcreteWallStrategy(),
  wood:     () => new WoodWallStrategy(),
  fabric:   () => new FabricWallStrategy(),
};

export function createStrategyForMaterial(material: string): AudioEffectStrategy {
  const factory = STRATEGY_MAP[material as WallMaterialKey];
  return factory ? factory() : new ConcreteWallStrategy();
}

export type { AudioEffectStrategy } from './audio-effect.strategy';
export { ConcreteWallStrategy } from './concrete-wall.strategy';
export { WoodWallStrategy }     from './wood-wall.strategy';
export { FabricWallStrategy }   from './fabric-wall.strategy';
