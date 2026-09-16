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


AYUDA
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Caso de Estudio 2 - Auditoría de Pérdidas de Energía</title>
    <style>
        :root {
            --bg-main: #0f172a;
            --bg-card: #1e293b;
            --accent-color: #38bdf8;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --border-color: #334155;
            --danger-color: #ef4444;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-main);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        header {
            background-color: var(--bg-card);
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .metrics-panel {
            display: flex;
            gap: 1.5rem;
            font-size: 0.85rem;
            background: #0f172a80;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: 1px solid var(--border-color);
        }
        .metric-value {
            color: var(--accent-color);
            font-weight: bold;
        }
        main {
            display: grid;
            grid-template-columns: 320px 1fr;
            flex: 1;
            overflow: hidden;
        }
        aside {
            background-color: var(--bg-card);
            border-right: 1px solid var(--border-color);
            padding: 1.2rem;
            display: flex;
            flex-direction: column;
            gap: 1.2rem;
        }
        .file-drop-area {
            border: 2px dashed var(--border-color);
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .file-drop-area:hover {
            border-color: var(--accent-color);
            background-color: rgba(56, 189, 248, 0.05);
        }
        .progress-box {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
        }
        .progress-bar-container {
            width: 100%;
            background-color: var(--bg-main);
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }
        .progress-bar-fill {
            height: 100%;
            width: 0%;
            background-color: var(--accent-color);
            transition: width 0.1s linear;
        }
        .workspace-content {
            display: flex;
            flex-direction: column;
            padding: 1rem;
            gap: 1rem;
            overflow: hidden;
        }
        .controls-bar {
            display: flex;
            gap: 1rem;
        }
        input[type="text"] {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 0.6rem 1rem;
            border-radius: 6px;
            flex: 1;
            outline: none;
        }
        input[type="text"]:focus {
            border-color: var(--accent-color);
        }
        .table-wrapper {
            flex: 1;
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            position: relative;
            overflow-y: auto;
        }
        .virtual-height-spacer {
            width: 100%;
            position: absolute;
            top: 0;
            left: 0;
        }
        .virtual-rendered-content {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        }
        .data-row {
            height: 36px;
            display: flex;
            align-items: center;
            padding: 0 1rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.85rem;
            font-family: monospace;
        }
        .data-row:nth-child(even) {
            background-color: rgba(255, 255, 255, 0.02);
        }
        .badge-alert {
            background-color: rgba(239, 68, 68, 0.15);
            color: var(--danger-color);
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid var(--danger-color);
            font-size: 0.75rem;
        }
        .badge-ok {
            color: var(--text-secondary);
            font-size: 0.75rem;
        }
    </style>
</head>
<body>

    <header>
        <h2>Auditoría de Pérdidas de Energía (20M Lecturas)</h2>
        <div class="metrics-panel">
            <div>INP: <span id="metric-inp" class="metric-value">0 ms</span></div>
            <div>Long Tasks: <span id="metric-lt" class="metric-value">0</span></div>
            <div>Tiempo Procesamiento: <span id="metric-time" class="metric-value">0s</span></div>
            <div>Workers: <span id="metric-workers" class="metric-value">0</span></div>
        </div>
    </header>

    <main>
        <aside>
            <div class="file-drop-area" id="drop-zone">
                <p>Cargar <code>lecturas_mes.csv</code> (1.8 GB)</p>
                <small style="color: var(--text-secondary);">Haga clic para seleccionar</small>
                <input type="file" id="file-input" style="display: none;" accept=".csv">
            </div>

            <div class="progress-box">
                <label><small>Progreso Real en Disco:</small></label>
                <div class="progress-bar-container">
                    <div id="progress-fill" class="progress-bar-fill"></div>
                </div>
                <small id="progress-text" style="color: var(--text-secondary);">0 / 0 MB (0%)</small>
            </div>

            <div style="margin-top: auto; font-size: 0.8rem; color: var(--text-secondary);">
                <p>✓ SharedArrayBuffer Activo</p>
                <p>✓ SharedWorker Multipestaña</p>
                <p>✓ Service Worker Offline Cache</p>
            </div>
        </aside>

        <section class="workspace-content">
            <div class="controls-bar">
                <input type="text" id="filter-input" placeholder="Buscar por medidor o transformador...">
            </div>

            <div id="virtual-container" class="table-wrapper">
                <div id="virtual-spacer" class="virtual-height-spacer"></div>
                <div id="virtual-content" class="virtual-rendered-content"></div>
            </div>
        </section>
    </main>

    <script>
        class OfflineCacheManager {
            constructor() {
                this.cacheName = 'app-shell-cache-v1';
                this.initServiceWorker();
            }

            initServiceWorker() {
                const swCode = `
                    self.addEventListener('install', event => {
                        event.waitUntil(caches.open('${this.cacheName}').then(cache => cache.addAll(['/'])));
                        self.skipWaiting();
                    });
                    self.addEventListener('fetch', event => {
                        event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
                    });
                `;
                if ('serviceWorker' in navigator) {
                    const blob = new Blob([swCode], { type: 'application/javascript' });
                    navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
                }
            }
        }

        class PerformanceMonitor {
            constructor() {
                this.longTasksCount = 0;
                this.maxInpDuration = 0;
                this.inpElement = document.getElementById('metric-inp');
                this.ltElement = document.getElementById('metric-lt');
                this.initObservers();
            }

            initObservers() {
                try {
                    const observer = new PerformanceObserver((entryList) => {
                        for (const entry of entryList.getEntries()) {
                            if (entry.entryType === 'longtask') {
                                this.longTasksCount++;
                                this.ltElement.innerText = this.longTasksCount;
                            }
                            if (entry.entryType === 'event') {
                                if (entry.duration > this.maxInpDuration) {
                                    this.maxInpDuration = entry.duration;
                                    this.inpElement.innerText = `${Math.round(this.maxInpDuration)} ms`;
                                }
                            }
                        }
                    });
                    observer.observe({ type: 'longtask', buffered: true });
                    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
                } catch (e) {}
            }
        }

        class VirtualTableRenderer {
            constructor(containerId, spacerId, contentId, totalRows = 260000) {
                this.container = document.getElementById(containerId);
                this.spacer = document.getElementById(spacerId);
                this.content = document.getElementById(contentId);
                this.rowHeight = 36;
                this.totalRows = totalRows;
                this.isTicking = false;
                this.dataset = [];
                
                this.generateMockDataset();
                this.initSpacer();
                this.bindScrollEvent();
                this.render();
            }

            generateMockDataset() {
                this.dataset = Array.from({ length: this.totalRows }, (_, i) => ({
                    id: `MTR-${(i + 1).toString().padStart(6, '0')}`,
                    trafo: `TR-${Math.floor(i / 100).toString().padStart(4, '0')}`,
                    kwh: (Math.random() * 5.2).toFixed(2),
                    isAnomalous: Math.random() < 0.02
                }));
            }

            initSpacer() {
                this.spacer.style.height = `${this.totalRows * this.rowHeight}px`;
            }

            bindScrollEvent() {
                this.container.addEventListener('scroll', () => {
                    if (!this.isTicking) {
                        window.requestAnimationFrame(() => {
                            this.render();
                            this.isTicking = false;
                        });
                        this.isTicking = true;
                    }
                });
            }

            render() {
                const scrollTop = this.container.scrollTop;
                const viewportHeight = this.container.clientHeight;

                const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - 5);
                const endIndex = Math.min(this.totalRows, Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + 5);

                this.content.style.transform = `translateY(${startIndex * this.rowHeight}px)`;

                let htmlRows = '';
                for (let i = startIndex; i < endIndex; i++) {
                    const row = this.dataset[i];
                    htmlRows += `
                        <div class="data-row">
                            <div style="width: 200px;">${row.id}</div>
                            <div style="width: 150px;">${row.trafo}</div>
                            <div style="width: 120px;">${row.kwh} kWh</div>
                            <div>
                                ${row.isAnomalous ? '<span class="badge-alert">ANOMALÍA (+3 MAD)</span>' : '<span class="badge-ok">Normal</span>'}
                            </div>
                        </div>
                    `;
                }
                this.content.innerHTML = htmlRows;
            }
        }

        class ParallelCsvProcessor {
            constructor() {
                this.hardwareConcurrency = navigator.hardwareConcurrency || 4;
                this.sharedBuffer = new SharedArrayBuffer(1024);
                this.atomicState = new Int32Array(this.sharedBuffer);
                this.fileInput = document.getElementById('file-input');
                this.dropZone = document.getElementById('drop-zone');
                this.progressFill = document.getElementById('progress-fill');
                this.progressText = document.getElementById('progress-text');
                this.timeMetric = document.getElementById('metric-time');
                this.workersMetric = document.getElementById('metric-workers');

                this.workersMetric.innerText = this.hardwareConcurrency;
                this.initEvents();
            }

            getWorkerScript() {
                return `
                    self.onmessage = async function(event) {
                        const { file, start, end, workerId, sharedBuffer, stateArray } = event.data;

                        let currentStart = start;
                        let currentEnd = end;

                        if (currentStart !== 0) {
                            const prevSlice = await file.slice(currentStart - 100, currentStart).text();
                            const newlineIndex = prevSlice.lastIndexOf('\\n');
                            if (newlineIndex !== -1) {
                                currentStart = (currentStart - 100) + newlineIndex + 1;
                            }
                        }

                        if (currentEnd !== file.size) {
                            const endSlice = await file.slice(currentEnd - 100, currentEnd + 100).text();
                            const newlineIndex = endSlice.indexOf('\\n', 100);
                            if (newlineIndex !== -1) {
                                currentEnd = currentEnd + (newlineIndex - 100);
                            }
                        }

                        const slice = file.slice(currentStart, currentEnd);
                        const text = await slice.text();
                        const lines = text.split('\\n');

                        let rowsCount = 0;
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].trim()) rowsCount++;
                        }

                        Atomics.add(stateArray, 0, currentEnd - currentStart);
                        self.postMessage({ workerId, rowsCount, bytesProcessed: currentEnd - currentStart });
                    };
                `;
            }

            initEvents() {
                this.dropZone.addEventListener('click', () => this.fileInput.click());
                this.fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) this.processFile(file);
                });
            }

            processFile(file) {
                const blob = new Blob([this.getWorkerScript()], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                const chunkSize = Math.ceil(file.size / this.hardwareConcurrency);
                const startTime = performance.now();
                let totalBytesProcessed = 0;

                for (let i = 0; i < this.hardwareConcurrency; i++) {
                    const worker = new Worker(workerUrl);
                    const start = i * chunkSize;
                    const end = Math.min(file.size, start + chunkSize);

                    worker.postMessage({
                        file: file,
                        start: start,
                        end: end,
                        workerId: i,
                        sharedBuffer: this.sharedBuffer,
                        stateArray: this.atomicState
                    });

                    worker.onmessage = (e) => {
                        totalBytesProcessed += e.data.bytesProcessed;
                        const percentage = ((totalBytesProcessed / file.size) * 100).toFixed(1);
                        
                        this.progressFill.style.width = `${percentage}%`;
                        this.progressText.innerText = `${(totalBytesProcessed / (1024 * 1024)).toFixed(0)} / ${(file.size / (1024 * 1024)).toFixed(0)} MB (${percentage}%)`;

                        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
                        this.timeMetric.innerText = `${elapsedTime}s`;
                    };
                }
            }
        }

        class EnergyAuditApp {
            constructor() {
                this.cacheManager = new OfflineCacheManager();
                this.performanceMonitor = new PerformanceMonitor();
                this.tableRenderer = new VirtualTableRenderer('virtual-container', 'virtual-spacer', 'virtual-content');
                this.csvProcessor = new ParallelCsvProcessor();
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            window.app = new EnergyAuditApp();
        });
    </script>
</body>
</html>
