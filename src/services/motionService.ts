// Sensor de movimiento (acelerómetro). Complementa al GPS: funciona bajo techo
// y sin señal. Detecta si el teléfono se está moviendo y cuenta pasos al
// caminar/correr. NO mide distancia real: en bicicleta o vehículo no hay forma
// fiable de integrar la aceleración, así que ahí solo indica "movimiento".
// Umbrales heurísticos, sin calibrar con recorridos reales (ver docs).
export const motionPolicy = {
  gravityTauMs: 1500, // estimación de gravedad (filtro lento)
  smoothTauMs: 60, // suavizado de la aceleración dinámica
  stepThreshold: 1.0, // m/s² para contar un paso
  stepReleaseFraction: 0.4, // histéresis
  minStepMs: 280, // máx. ~3,5 pasos/s
  windowMs: 2000,
  movingStd: 0.3, // desviación típica (m/s²) para "en movimiento"
};
export interface MotionReading {
  steps: number;
  moving: boolean;
}
export class MotionAnalyzer {
  steps = 0;
  private lastT: number | null = null;
  private gravity = 9.81;
  private smooth = 0;
  private above = false;
  private lastStep = -Infinity;
  private window: { t: number; a: number }[] = [];
  private sum = 0;
  private sumSq = 0;
  constructor(private policy = motionPolicy) {}
  push(t: number, x: number, y: number, z: number): MotionReading {
    const m = Math.hypot(x, y, z);
    if (this.lastT === null) {
      this.gravity = m;
      this.lastT = t;
    }
    const dt = Math.max(0, t - this.lastT);
    this.lastT = t;
    this.gravity +=
      (m - this.gravity) * (1 - Math.exp(-dt / this.policy.gravityTauMs));
    const dynamic = m - this.gravity;
    this.smooth +=
      (dynamic - this.smooth) * (1 - Math.exp(-dt / this.policy.smoothTauMs));
    if (!this.above && this.smooth > this.policy.stepThreshold) {
      this.above = true;
      if (t - this.lastStep >= this.policy.minStepMs) {
        this.steps++;
        this.lastStep = t;
      }
    } else if (
      this.above &&
      this.smooth < this.policy.stepThreshold * this.policy.stepReleaseFraction
    )
      this.above = false;
    this.window.push({ t, a: dynamic });
    this.sum += dynamic;
    this.sumSq += dynamic * dynamic;
    while (this.window.length && t - this.window[0].t > this.policy.windowMs) {
      const old = this.window.shift()!;
      this.sum -= old.a;
      this.sumSq -= old.a * old.a;
    }
    return { steps: this.steps, moving: this.moving() };
  }
  moving() {
    const n = this.window.length;
    // Hace falta casi una ventana completa para no declarar movimiento con
    // las primeras muestras (el filtro de gravedad aún converge).
    if (n < 10 || this.lastT! - this.window[0].t < this.policy.windowMs * 0.5)
      return false;
    const mean = this.sum / n;
    const variance = Math.max(0, this.sumSq / n - mean * mean);
    return Math.sqrt(variance) > this.policy.movingStd;
  }
}
type MotionCallback = (t: number, x: number, y: number, z: number) => void;
// Devuelve null si el dispositivo no ofrece acelerómetro (p. ej. un PC).
export function watchMotion(onSample: MotionCallback): (() => void) | null {
  if (typeof window === "undefined" || !("DeviceMotionEvent" in window))
    return null;
  let stopped = false;
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (stopped || !a || a.x == null || a.y == null || a.z == null) return;
    onSample(e.timeStamp, a.x, a.y, a.z);
  };
  // iOS exige un permiso explícito; en Android/Chromium no hace falta.
  const request = (
    DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    }
  ).requestPermission;
  if (typeof request === "function")
    void request()
      .then((r) => {
        if (r === "granted" && !stopped)
          window.addEventListener("devicemotion", handler);
      })
      .catch(() => {});
  else window.addEventListener("devicemotion", handler);
  return () => {
    stopped = true;
    window.removeEventListener("devicemotion", handler);
  };
}
