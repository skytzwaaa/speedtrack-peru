import type { ActivityType } from "../types";
import type { GpsPoint } from "../services/gpsService";
import { calculateAcceleration, calculateDistance } from "./physics";
export const ceilings: Record<ActivityType, number> = {
  walk: 15,
  run: 45,
  bike: 110,
  vehicle: 250,
};
// Tunable quality policy, not claims about sensor accuracy. See docs/precision-v2.md.
export const gpsPolicy = {
  maxAccuracyM: 35,
  gapSeconds: 15,
  minIntervalSeconds: 0.5,
  smoothingSeconds: 3,
  stationaryHoldSeconds: 3,
  stationaryKmh: 0.7,
  noiseFloorM: 2,
  noiseAccuracyFraction: 0.5,
  maxAccelerationMs2: 6,
  vehicleAccelerationMs2: 12,
};
export class GpsFilter {
  constructor(
    private policy = gpsPolicy,
    private maxSpeeds = ceilings,
  ) {}
  private mode: ActivityType | null = null;
  private instantaneous = 0;
  private previous: GpsPoint | null = null;
  private speed = 0;
  private lastSeen: number | null = null;
  private lastSample: GpsPoint | null = null;
  // Muchos Android devuelven speed = 0 en todos los fixes aunque haya
  // movimiento. Un 0 solo cuenta como "parado" si este teléfono ya demostró
  // reportar velocidad positiva; si no, se decide solo por desplazamiento.
  private deviceReportsSpeed = false;
  reset() {
    this.previous = null;
    this.lastSeen = null;
    this.lastSample = null;
    this.speed = 0;
    this.instantaneous = 0;
  }
  accept(p: GpsPoint, mode: ActivityType) {
    if (this.mode !== mode) {
      this.reset();
      this.mode = mode;
    }
    if (
      ![p.latitude, p.longitude, p.timestamp, p.accuracy].every(
        Number.isFinite,
      ) ||
      Math.abs(p.latitude) > 90 ||
      Math.abs(p.longitude) > 180 ||
      p.accuracy < 0 ||
      p.accuracy > this.policy.maxAccuracyM
    )
      return null;
    const prev = this.previous;
    if (this.lastSeen !== null && p.timestamp <= this.lastSeen) return null;
    const dt = prev ? (p.timestamp - prev.timestamp) / 1000 : 0;
    const sampleDt =
      this.lastSeen === null ? 0 : (p.timestamp - this.lastSeen) / 1000;
    // Reacquire after a signal gap without adding an unobserved straight line.
    if (!prev || sampleDt > this.policy.gapSeconds) {
      this.previous = p;
      this.lastSeen = p.timestamp;
      this.lastSample = p;
      this.speed = 0;
      this.instantaneous = 0;
      return {
        delta: 0,
        speed: 0,
        instantaneousSpeed: 0,
        acceleration: 0,
        breakBefore: true,
      };
    }
    if (sampleDt < this.policy.minIntervalSeconds) return null;
    // Check consecutive observations too: a long stationary anchor must not
    // dilute a sudden jump by dividing it by the entire idle period.
    if (
      this.lastSample &&
      (calculateDistance(this.lastSample, p) / sampleDt) * 3600 >
        this.maxSpeeds[mode]
    )
      return null;
    const distance = calculateDistance(prev, p);
    const raw = (distance / dt) * 3600;
    if (raw > this.maxSpeeds[mode]) return null; // Never promote a rejected jump to the baseline.
    let device =
      p.speed !== null && Number.isFinite(p.speed) && p.speed >= 0
        ? p.speed * 3.6
        : null;
    if (device !== null && device >= this.policy.stationaryKmh)
      this.deviceReportsSpeed = true;
    else if (device !== null && !this.deviceReportsSpeed) device = null;
    if (device !== null && device > this.maxSpeeds[mode]) return null;
    // Keep an anchor until displacement clears uncertainty. Device speed alone
    // must never turn stationary coordinate jitter into accumulated distance.
    const clearanceM = Math.max(
      this.policy.noiseFloorM,
      Math.min(prev.accuracy, p.accuracy) * this.policy.noiseAccuracyFraction,
    );
    const stationary =
      (device !== null && device < this.policy.stationaryKmh) ||
      distance * 1000 < clearanceM;
    const rawSpeed = stationary ? 0 : raw; // v = accepted displacement / time
    const maxA =
      mode === "vehicle"
        ? this.policy.vehicleAccelerationMs2
        : this.policy.maxAccelerationMs2;
    if (
      !stationary &&
      Math.abs(calculateAcceleration(this.instantaneous, rawSpeed, sampleDt)) >
        maxA
    )
      return null;
    // El peso depende del tiempo que cubre la medición (desde el ancla), no del
    // intervalo entre fixes: con precisión baja el ancla tarda varios segundos
    // en superar el ruido y una medición de 6 s no debe pesar como una de 1 s.
    const alpha =
      1 - Math.exp(-Math.max(dt, sampleDt) / this.policy.smoothingSeconds);
    // A sub-noise walking step is not evidence of a stop. Hold an established
    // estimate briefly while the anchor gathers enough displacement; a device
    // stop or three seconds without confirmed displacement clears it.
    const pendingMotion =
      stationary &&
      !(device !== null && device < this.policy.stationaryKmh) &&
      this.speed >= this.policy.stationaryKmh &&
      // Tiempo esperado para superar el ruido a la velocidad actual (con
      // margen), entre el mínimo configurado y 10 s.
      dt <=
        Math.min(
          10,
          Math.max(
            this.policy.stationaryHoldSeconds,
            (1.5 * clearanceM) / (this.speed / 3.6),
          ),
        );
    const speed = stationary
      ? pendingMotion
        ? this.speed
        : 0
      : this.speed + alpha * (rawSpeed - this.speed);
    const acceleration = calculateAcceleration(this.speed, speed, sampleDt);
    if (Math.abs(acceleration) > maxA) return null;
    if (!stationary || (device !== null && device < this.policy.stationaryKmh))
      this.previous = p;
    this.lastSeen = p.timestamp;
    this.lastSample = p;
    this.speed = speed;
    this.instantaneous = rawSpeed;
    return {
      delta: stationary ? 0 : distance,
      speed,
      instantaneousSpeed: rawSpeed,
      acceleration,
      breakBefore: false,
    };
  }
}
