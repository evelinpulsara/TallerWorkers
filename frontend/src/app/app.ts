import {
  Component,
  inject,
  computed,
  signal,
  effect,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';

import { ThemeService }         from './services/theme.service';
import { WorkerManagerService } from './core/services/worker-manager.service';
import { AudioEngineService }   from './core/services/audio-engine.service';
import { AudioSource }          from './core/models/audio-source.model';
import { Listener }             from './core/models/listener.model';
import { Vector2D }             from './core/models/vector2d.model';

export type AudioInputTab   = 'file' | 'url';
export type WallMaterial    = 'concrete' | 'wood' | 'fabric';
export type PlaybackState   = 'idle' | 'playing' | 'paused';
export type ProcessingState = 'idle' | 'processing' | 'done' | 'error';
export type DragTarget      = 'source' | 'listener' | null;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, ReactiveFormsModule, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy {

  protected readonly themeService  = inject(ThemeService);
  protected readonly workerManager = inject(WorkerManagerService);
  protected readonly audioEngine   = inject(AudioEngineService);

  protected readonly isDark = computed(() => this.themeService.isDarkMode());

  protected activeTab     = signal<AudioInputTab>('file');
  protected audioFileName = signal<string>('');
  protected audioUrl      = signal<string>('');
  protected audioFile: File | null = null;

  protected spaceImageUrl      = signal<string | null>(null);
  protected spaceImageFileName = signal<string>('');

  protected selectedMaterial = signal<WallMaterial>('concrete');

  private audioSource = new AudioSource({ position: new Vector2D(30, 50) });
  private listener    = new Listener({ position: new Vector2D(70, 50) });

  protected sourcePosition   = signal<{ x: number; y: number }>(this.audioSource.position.toJSON());
  protected listenerPosition = signal<{ x: number; y: number }>(this.listener.position.toJSON());

  protected processingState    = signal<ProcessingState>('idle');
  protected processingProgress = signal<number>(0);

  protected capturedRays    = signal<number>(0);
  protected captureRate     = signal<number>(0);
  protected estimatedRT60   = signal<number>(0);
  protected avgArrivalDelay = signal<number>(0);
  protected maxBounces      = signal<number>(0);

  protected readonly isProcessing    = computed(() => this.processingState() === 'processing');
  protected readonly isProcessingDone = computed(() => this.processingState() === 'done');
  protected readonly isPlaying       = computed(() => this.audioEngine.engineState() === 'playing');
  protected readonly isAudioReady    = computed(() => {
    const s = this.audioEngine.engineState();
    return s === 'ready' || s === 'playing' || s === 'paused';
  });
  protected readonly canProcess = computed(
    () =>
      (this.activeTab() === 'file'
        ? this.audioFileName().length > 0
        : this.audioUrl().trim().length > 0) &&
      !this.isProcessing(),
  );

  protected readonly wallMaterialOptions: { value: WallMaterial; label: string }[] = [
    { value: 'concrete', label: 'Concreto' },
    { value: 'wood',     label: 'Madera' },
    { value: 'fabric',   label: 'Tela / Absorbente' },
  ];

  protected readonly currentTimeS = this.audioEngine.currentTimeS;
  protected readonly durationS    = this.audioEngine.durationS;
  protected readonly engineError  = this.audioEngine.errorMessage;

  private readonly subs = new Subscription();

  private dragTarget: DragTarget = null;
  private reSimDebounce: ReturnType<typeof setTimeout> | null = null;
  private hasRunOnce = false;

  constructor() {
    this.subs.add(
      this.workerManager.progress$.subscribe((p) => {
        this.processingProgress.set(p.progressPercent);
      }),
    );

    this.subs.add(
      this.workerManager.result$.subscribe((result) => {
        this.processingState.set('done');
        this.processingProgress.set(100);
        this.capturedRays.set(result.capturedRays);
        this.captureRate.set(result.captureRate);
        this.estimatedRT60.set(result.estimatedRT60);
        this.avgArrivalDelay.set(result.averageArrivalDelayMs);
        this.maxBounces.set(result.maxBounceCount);
        this.audioEngine.applySimulationResult(result.estimatedRT60);
        this.hasRunOnce = true;
      }),
    );

    effect(() => {
      if (this.workerManager.errorMessage()) {
        this.processingState.set('error');
      }
    });

    this.audioEngine.setSourcePosition(this.audioSource.position.toJSON());
    this.audioEngine.setListenerPosition(this.listener.position.toJSON());
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  selectTab(tab: AudioInputTab): void {
    this.activeTab.set(tab);
  }

  onAudioFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.audioFile = file;
    this.audioFileName.set(file.name);
    this.audioEngine.loadFile(file);
  }

  onAudioUrlBlur(): void {
    const url = this.audioUrl().trim();
    if (url.length > 0) this.audioEngine.loadUrl(url);
  }

  onSpaceImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.spaceImageFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => this.spaceImageUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  onMaterialChange(value: WallMaterial): void {
    this.selectedMaterial.set(value);
  }

  onMarkerMouseDown(event: MouseEvent, target: DragTarget): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragTarget = target;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.dragTarget) return;
    const pos = this.getCanvasPosition(event);
    this.applyPosition(pos);
  }

  onCanvasMouseUp(event: MouseEvent): void {
    if (!this.dragTarget) return;
    const pos = this.getCanvasPosition(event);
    this.applyPosition(pos);
    this.dragTarget = null;
    this.scheduleReSimulation();
  }

  onCanvasMouseLeave(): void {
    if (this.dragTarget) {
      this.dragTarget = null;
      this.scheduleReSimulation();
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.dragTarget !== null) return;
    const pos = this.getCanvasPosition(event);
    if (event.shiftKey) {
      this.listener.position = pos;
      this.listenerPosition.set(pos.toJSON());
      this.audioEngine.setListenerPosition(pos.toJSON());
    } else {
      this.audioSource.position = pos;
      this.sourcePosition.set(pos.toJSON());
      this.audioEngine.setSourcePosition(pos.toJSON());
    }
    this.scheduleReSimulation();
  }

  private getCanvasPosition(event: MouseEvent): Vector2D {
    const canvas = event.currentTarget as HTMLElement;
    const rect   = canvas.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width)  * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top)  / rect.height) * 100));
    return new Vector2D(x, y);
  }

  private applyPosition(pos: Vector2D): void {
    if (this.dragTarget === 'source') {
      this.audioSource.position = pos;
      this.sourcePosition.set(pos.toJSON());
      this.audioEngine.setSourcePosition(pos.toJSON());
    } else if (this.dragTarget === 'listener') {
      this.listener.position = pos;
      this.listenerPosition.set(pos.toJSON());
      this.audioEngine.setListenerPosition(pos.toJSON());
    }
  }

  private scheduleReSimulation(): void {
    if (!this.hasRunOnce) return;
    if (this.reSimDebounce) clearTimeout(this.reSimDebounce);
    this.reSimDebounce = setTimeout(() => {
      this.processingState.set('processing');
      this.processingProgress.set(0);
      this.workerManager.startSimulation({
        source:     this.audioSource,
        listener:   this.listener,
        material:   this.selectedMaterial() as 'concrete' | 'wood' | 'fabric',
        totalRays:  5_000,
        maxBounces: 12,
      });
    }, 300);
  }

  startProcessing(): void {
    if (!this.canProcess()) return;
    this.processingState.set('processing');
    this.processingProgress.set(0);
    this.workerManager.startSimulation({
      source:     this.audioSource,
      listener:   this.listener,
      material:   this.selectedMaterial() as 'concrete' | 'wood' | 'fabric',
      totalRays:  5_000,
      maxBounces: 12,
    });
  }

  cancelProcessing(): void {
    this.workerManager.cancelSimulation();
    this.processingState.set('idle');
    this.processingProgress.set(0);
    if (this.reSimDebounce) clearTimeout(this.reSimDebounce);
  }

  togglePlayback(): void {
    this.audioEngine.togglePlayback();
  }

  downloadProcessedAudio(): void {
    if (!this.isProcessingDone()) return;
    const a = document.createElement('a');
    a.href = '#'; a.download = 'audio-3d-procesado.wav'; a.click();
  }

  downloadSimulation(): void {
    if (!this.isProcessingDone()) return;
    const a = document.createElement('a');
    a.href = '#'; a.download = 'simulacion-acustica.png'; a.click();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.reSimDebounce) clearTimeout(this.reSimDebounce);
  }
}
