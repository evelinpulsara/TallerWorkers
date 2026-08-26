import { Injectable, OnDestroy, signal } from '@angular/core';

const WORLD_SCALE = 10;
const REF_DISTANCE = 1;
const MAX_DISTANCE = 30;

export type AudioEngineState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface SpatialPosition {
  x: number;
  y: number;
}

export interface AudioEngineSnapshot {
  state: AudioEngineState;
  currentTimeS: number;
  durationS: number;
  sourceWorldX: number;
  sourceWorldZ: number;
  listenerWorldX: number;
  listenerWorldZ: number;
  rt60S: number;
  filterFreqHz: number;
}

@Injectable({ providedIn: 'root' })
export class AudioEngineService implements OnDestroy {
  readonly engineState  = signal<AudioEngineState>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly currentTimeS = signal<number>(0);
  readonly durationS    = signal<number>(0);

  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private pannerNode: PannerNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;

  private pausedAtS     = 0;
  private startedAtCtxS = 0;
  private rafId: number | null = null;

  private sourceX   = 0;
  private sourceZ   = 0;
  private listenerX = 0;
  private listenerZ = 0;
  private rt60S     = 0.5;

  private ensureContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContext();
      this.buildGraph();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private buildGraph(): void {
    const ctx = this.audioCtx!;

    this.pannerNode = ctx.createPanner();
    this.pannerNode.panningModel  = 'HRTF';
    this.pannerNode.distanceModel = 'inverse';
    this.pannerNode.refDistance   = REF_DISTANCE;
    this.pannerNode.maxDistance   = MAX_DISTANCE;
    this.pannerNode.rolloffFactor = 1.5;
    this.pannerNode.coneInnerAngle = 360;
    this.pannerNode.coneOuterAngle = 360;
    this.pannerNode.coneOuterGain  = 0;

    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type            = 'highshelf';
    this.filterNode.frequency.value = 4000;
    this.filterNode.gain.value      = -3;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0.9;

    this.pannerNode.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);

    ctx.listener.positionX?.setValueAtTime(this.listenerX, ctx.currentTime);
    ctx.listener.positionY?.setValueAtTime(0,              ctx.currentTime);
    ctx.listener.positionZ?.setValueAtTime(this.listenerZ, ctx.currentTime);
    ctx.listener.forwardX?.setValueAtTime(0,  ctx.currentTime);
    ctx.listener.forwardY?.setValueAtTime(0,  ctx.currentTime);
    ctx.listener.forwardZ?.setValueAtTime(-1, ctx.currentTime);
    ctx.listener.upX?.setValueAtTime(0, ctx.currentTime);
    ctx.listener.upY?.setValueAtTime(1, ctx.currentTime);
    ctx.listener.upZ?.setValueAtTime(0, ctx.currentTime);
  }

  async loadFile(file: File): Promise<void> {
    try {
      this.engineState.set('loading');
      this.errorMessage.set(null);
      const ctx = this.ensureContext();
      const arrayBuffer = await file.arrayBuffer();
      await this.decodeAndStore(ctx, arrayBuffer);
    } catch (err) {
      this.handleError('Failed to load audio file', err);
    }
  }

  async loadUrl(url: string): Promise<void> {
    try {
      this.engineState.set('loading');
      this.errorMessage.set(null);
      const ctx = this.ensureContext();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      await this.decodeAndStore(ctx, arrayBuffer);
    } catch (err) {
      this.handleError('Failed to load audio URL', err);
    }
  }

  private async decodeAndStore(ctx: AudioContext, buffer: ArrayBuffer): Promise<void> {
    this.audioBuffer = await ctx.decodeAudioData(buffer);
    this.durationS.set(this.audioBuffer.duration);
    this.pausedAtS = 0;
    this.engineState.set('ready');
  }

  play(): void {
    if (!this.audioBuffer) return;
    if (this.engineState() === 'playing') return;

    const ctx = this.ensureContext();
    this.stopSourceNode();

    const source = ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.loop   = false;
    source.connect(this.pannerNode!);

    this.sourceNode    = source;
    this.startedAtCtxS = ctx.currentTime - this.pausedAtS;

    source.start(0, this.pausedAtS);
    source.onended = () => {
      if (this.engineState() === 'playing') {
        this.pausedAtS = 0;
        this.engineState.set('ready');
        this.stopRAF();
      }
    };

    this.engineState.set('playing');
    this.startRAF();
  }

  pause(): void {
    if (this.engineState() !== 'playing') return;
    this.pausedAtS = this.audioCtx!.currentTime - this.startedAtCtxS;
    this.stopSourceNode();
    this.engineState.set('paused');
    this.stopRAF();
  }

  togglePlayback(): void {
    if (this.engineState() === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  stop(): void {
    this.stopSourceNode();
    this.pausedAtS = 0;
    this.currentTimeS.set(0);
    this.stopRAF();
    if (this.audioBuffer) this.engineState.set('ready');
  }

  setSourcePosition(pos: SpatialPosition): void {
    this.sourceX = this.canvasToWorld(pos.x);
    this.sourceZ = this.canvasToWorld(pos.y);
    this.applyPannerPosition();
  }

  setListenerPosition(pos: SpatialPosition): void {
    this.listenerX = this.canvasToWorld(pos.x);
    this.listenerZ = this.canvasToWorld(pos.y);
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    this.audioCtx.listener.positionX?.setValueAtTime(this.listenerX, t);
    this.audioCtx.listener.positionZ?.setValueAtTime(this.listenerZ, t);
  }

  applySimulationResult(rt60S: number): void {
    this.rt60S = rt60S;
    this.applyRT60ToFilter();
  }

  private canvasToWorld(unit: number): number {
    return ((unit - 50) / 50) * WORLD_SCALE;
  }

  private applyPannerPosition(): void {
    if (!this.pannerNode || !this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    this.pannerNode.positionX.setValueAtTime(this.sourceX, t);
    this.pannerNode.positionY.setValueAtTime(0,            t);
    this.pannerNode.positionZ.setValueAtTime(this.sourceZ, t);
  }

  private applyRT60ToFilter(): void {
    if (!this.filterNode || !this.audioCtx) return;
    const normalised = Math.min(1, this.rt60S / 1.2);
    const gainDb     = -18 + normalised * 17;
    this.filterNode.gain.setTargetAtTime(gainDb, this.audioCtx.currentTime, 0.1);
  }

  private stopSourceNode(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  private startRAF(): void {
    const tick = () => {
      if (this.audioCtx && this.engineState() === 'playing') {
        const elapsed = this.audioCtx.currentTime - this.startedAtCtxS;
        this.currentTimeS.set(Math.min(elapsed, this.durationS()));
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopRAF(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleError(message: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    this.errorMessage.set(`${message}: ${detail}`);
    this.engineState.set('error');
  }

  ngOnDestroy(): void {
    this.stop();
    this.audioCtx?.close();
    this.audioCtx = null;
  }

  getSnapshot(): AudioEngineSnapshot {
    return {
      state:          this.engineState(),
      currentTimeS:   this.currentTimeS(),
      durationS:      this.durationS(),
      sourceWorldX:   this.sourceX,
      sourceWorldZ:   this.sourceZ,
      listenerWorldX: this.listenerX,
      listenerWorldZ: this.listenerZ,
      rt60S:          this.rt60S,
      filterFreqHz:   this.filterNode?.frequency.value ?? 4000,
    };
  }
}
