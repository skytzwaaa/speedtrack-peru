export type Language = "es" | "en" | "qu";
export type ActivityType = "walk" | "run" | "bike" | "vehicle";
export type Tab = "home" | "activity" | "vehicle" | "history" | "profile";
export type SpeedStatus = "normal" | "caution" | "over";
export interface Measurement {
  instantaneous_speed?: number;
  device_speed?: number | null;
  break_before?: boolean;
  id: string;
  session_id: string;
  timestamp: number;
  elapsed: number;
  latitude: number | null;
  longitude: number | null;
  speed: number;
  acceleration: number;
  accuracy: number | null;
  distance: number;
}
export interface SessionEvent {
  id: string;
  session_id: string;
  timestamp: number;
  elapsed: number;
  type: "brake" | "accelerate" | "over";
  value: number;
}
export interface Split {
  id: string;
  session_id: string;
  kilometer: number;
  time: number;
  pace: number;
}
export interface Session {
  navigation?: NavigationPlan;
  id: string;
  user_id: string;
  type: ActivityType;
  start_time: string;
  end_time: string | null;
  distance: number;
  duration: number;
  avg_speed: number;
  max_speed: number;
  max_acceleration: number;
  max_deceleration: number;
  measurements: Measurement[];
  events: SessionEvent[];
  splits: Split[];
  demo: boolean;
  limit: number;
  above_limit: number;
  goal: number | null;
}
export type Coordinate = [number, number];
export interface RoutePlan {
  coordinates: Coordinate[];
  distance: number;
  duration: number;
  profile: string;
}
export interface NavigationPlan {
  destination: Coordinate;
  route?: RoutePlan;
}
export interface Settings {
  id: string;
  user_id: string;
  language: Language;
  units: "metric";
  voice_enabled: boolean;
  voice_language: Language;
  voice_volume: number;
  voice_fallback?: "off" | "es" | "en";
  progress_alerts?: boolean;
  kilometer_alerts: boolean;
  safety_alerts: boolean;
  approaching_alerts: boolean;
  speed_limit: number;
}
export interface User {
  id: string;
  name: string;
  email: string;
  language: Language;
  voice_enabled: boolean;
}
