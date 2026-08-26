import { Injectable, OnDestroy, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';

import { AudioSource } from '../models/audio-source.model';
import { Listener } from '../models/listener.model';
import { WallMaterialKey } from '../strategies/index';

import type {
  AcousticWorkerInput,
  AcousticWorkerProgress,
  AcousticWorkerResult,
} from '../../workers/acoustic.worker';

export interface SimulationProgress {
  completedRays: number;
  totalRays: number;
  progressPercent: number;
}

export interface SimulationResult {
  capturedRays: number;
  totalRays: number;
  captureRate: number;
  estimatedRT60: number;
  averageArrivalDelayMs: number;
  maxBounceCount: number;
}

export interface SimulationConfig {
  source: AudioSource;
  listener: Listener;
  material: WallMaterialKey;
  totalRays?: number;
  maxBounces?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkerManagerService implements OnDestroy {
  private worker: Worker | null = null;
  private readonly messageSubject = new Subject<AcousticWorkerProgress | AcousticWorkerResult>();

  readonly isRunning = signal(false);
  readonly lastProgress = signal<SimulationProgress | null>(null);
  readonly lastResult   = signal<SimulationResult | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly progress$: Observable<SimulationProgress> = this.messageSubject.pipe(
    filter((msg): msg is AcousticWorkerProgress => msg.type === 'PROGRESS'),
    map((msg) => ({
      completedRays:   msg.completedRays,
      totalRays:       msg.totalRays,
      progressPercent: msg.progressPercent,
    })),
  );

  readonly result$: Observable<SimulationResult> = this.messageSubject.pipe(
    filter((msg): msg is AcousticWorkerResult => msg.type === 'RESULT'),
    map((msg) => ({
      capturedRays:          msg.capturedRays.length,
      totalRays:             msg.totalRays,
      captureRate:           msg.captureRate,
      estimatedRT60:         msg.estimatedRT60,
      averageArrivalDelayMs: msg.averageArrivalDelayMs,
      maxBounceCount:        msg.maxBounceCount,
    })),
  );

  startSimulation(config: SimulationConfig): boolean {
    if (!this.supportsWorkers()) {
      this.errorMessage.set('Your browser does not support Web Workers.');
      return false;
    }

    this.terminateWorker();
    this.errorMessage.set(null);
    this.lastProgress.set(null);
    this.lastResult.set(null);
    this.isRunning.set(true);

    this.worker = new Worker(
      new URL('../../workers/acoustic.worker', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (event: MessageEvent<AcousticWorkerProgress | AcousticWorkerResult>) => {
      const msg = event.data;
      this.messageSubject.next(msg);

      if (msg.type === 'PROGRESS') {
        this.lastProgress.set({
          completedRays:   msg.completedRays,
          totalRays:       msg.totalRays,
          progressPercent: msg.progressPercent,
        });
      }

      if (msg.type === 'RESULT') {
        this.lastResult.set({
          capturedRays:          msg.capturedRays.length,
          totalRays:             msg.totalRays,
          captureRate:           msg.captureRate,
          estimatedRT60:         msg.estimatedRT60,
          averageArrivalDelayMs: msg.averageArrivalDelayMs,
          maxBounceCount:        msg.maxBounceCount,
        });
        this.isRunning.set(false);
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      this.errorMessage.set(`Worker error: ${error.message}`);
      this.isRunning.set(false);
      this.terminateWorker();
    };

    const totalRays = config.totalRays ?? 5_000;
    const progressChunkSize = Math.max(1, Math.floor(totalRays / 50));

    const input: AcousticWorkerInput = {
      type: 'START_SIMULATION',
      source:   config.source.position.toJSON(),
      listener: config.listener.position.toJSON(),
      material: config.material,
      totalRays,
      maxBounces:        config.maxBounces ?? 12,
      progressChunkSize,
    };

    this.worker.postMessage(input);
    return true;
  }

  cancelSimulation(): void {
    this.terminateWorker();
    this.isRunning.set(false);
  }

  supportsWorkers(): boolean {
    return typeof Worker !== 'undefined';
  }

  ngOnDestroy(): void {
    this.terminateWorker();
    this.messageSubject.complete();
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
