/// <reference lib="webworker" />

interface ReflectionStrategy {
  absorptionCoefficient: number;
  rt60: number;
}

const STRATEGIES: Record<string, ReflectionStrategy> = {
  concrete: { absorptionCoefficient: 0.02, rt60: 0.8 },
  wood:     { absorptionCoefficient: 0.10, rt60: 0.5 },
  fabric:   { absorptionCoefficient: 0.70, rt60: 0.2 },
};

function getStrategy(material: string): ReflectionStrategy {
  return STRATEGIES[material] ?? STRATEGIES['concrete'];
}

export interface WorkerPosition {
  x: number;
  y: number;
}

export interface AcousticWorkerInput {
  type: 'START_SIMULATION';
  source: WorkerPosition;
  listener: WorkerPosition;
  material: string;
  totalRays: number;
  maxBounces: number;
  progressChunkSize: number;
}

export interface AcousticWorkerProgress {
  type: 'PROGRESS';
  completedRays: number;
  totalRays: number;
  progressPercent: number;
}

export interface RayResult {
  angle: number;
  bounceCount: number;
  remainingEnergy: number;
  captured: boolean;
  totalDistance: number;
  arrivalDelayMs: number;
}

export interface AcousticWorkerResult {
  type: 'RESULT';
  capturedRays: RayResult[];
  totalRays: number;
  captureRate: number;
  estimatedRT60: number;
  averageArrivalDelayMs: number;
  maxBounceCount: number;
}

const CANVAS_MIN = 0;
const CANVAS_MAX = 100;
const STEP_SIZE  = 0.8;
const CANVAS_TO_METERS = 0.20;
const SPEED_OF_SOUND_MS = 343;

function distanceBetween(a: WorkerPosition, b: WorkerPosition): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function simulateRay(
  source: WorkerPosition,
  listener: WorkerPosition,
  angle: number,
  maxBounces: number,
  strategy: ReflectionStrategy,
  captureRadius: number,
): RayResult {
  let x = source.x;
  let y = source.y;
  let energy = 1.0;
  let bounceCount = 0;
  let totalDistance = 0;
  let captured = false;

  for (let step = 0; step < 2000; step++) {
    const nx = x + Math.cos(angle) * STEP_SIZE;
    const ny = y + Math.sin(angle) * STEP_SIZE;
    totalDistance += STEP_SIZE;

    let reflected = false;

    if (nx <= CANVAS_MIN || nx >= CANVAS_MAX) {
      angle = Math.PI - angle;
      energy -= energy * strategy.absorptionCoefficient;
      bounceCount++;
      reflected = true;
    }

    if (ny <= CANVAS_MIN || ny >= CANVAS_MAX) {
      angle = -angle;
      energy -= energy * strategy.absorptionCoefficient;
      bounceCount++;
      reflected = true;
    }

    energy *= 0.9998;

    x = reflected ? Math.min(CANVAS_MAX - 0.1, Math.max(CANVAS_MIN + 0.1, nx)) : nx;
    y = reflected ? Math.min(CANVAS_MAX - 0.1, Math.max(CANVAS_MIN + 0.1, ny)) : ny;

    const distToListener = distanceBetween({ x, y }, listener);
    if (distToListener <= captureRadius) {
      captured = true;
      break;
    }

    if (energy <= 0.001 || bounceCount >= maxBounces) {
      break;
    }
  }

  const distanceMeters = totalDistance * CANVAS_TO_METERS;
  const arrivalDelayMs = (distanceMeters / SPEED_OF_SOUND_MS) * 1000;

  return { angle, bounceCount, remainingEnergy: energy, captured, totalDistance, arrivalDelayMs };
}

addEventListener('message', (event: MessageEvent<AcousticWorkerInput>) => {
  const data = event.data;
  if (data.type !== 'START_SIMULATION') return;

  const { source, listener, material, totalRays, maxBounces, progressChunkSize } = data;
  const strategy = getStrategy(material);
  const capturedRays: RayResult[] = [];
  const captureRadius = 5;
  const angleStep = (2 * Math.PI) / totalRays;
  let completedRays = 0;

  for (let i = 0; i < totalRays; i++) {
    const baseAngle = angleStep * i;
    const jitter = (Math.random() - 0.5) * angleStep * 0.5;
    const angle = baseAngle + jitter;

    const result = simulateRay(source, listener, angle, maxBounces, strategy, captureRadius);
    if (result.captured) capturedRays.push(result);

    completedRays++;

    if (completedRays % progressChunkSize === 0 || completedRays === totalRays) {
      const progressMessage: AcousticWorkerProgress = {
        type: 'PROGRESS',
        completedRays,
        totalRays,
        progressPercent: Math.round((completedRays / totalRays) * 100),
      };
      postMessage(progressMessage);
    }
  }

  const captureRate = (capturedRays.length / totalRays) * 100;
  const avgDelay = capturedRays.length > 0
    ? capturedRays.reduce((sum, r) => sum + r.arrivalDelayMs, 0) / capturedRays.length
    : 0;
  const maxBounce = capturedRays.length > 0
    ? Math.max(...capturedRays.map(r => r.bounceCount))
    : 0;

  const resultMessage: AcousticWorkerResult = {
    type: 'RESULT',
    capturedRays,
    totalRays,
    captureRate,
    estimatedRT60: strategy.rt60,
    averageArrivalDelayMs: avgDelay,
    maxBounceCount: maxBounce,
  };

  postMessage(resultMessage);
});
