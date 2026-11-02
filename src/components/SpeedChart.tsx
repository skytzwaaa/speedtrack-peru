import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import type { Session } from "../types";
import { useI18n } from "../i18n";
import { Section } from "./ui";
const MAX_POINTS = 600;
// Reduce a ≤600 puntos conservando el pico de cada tramo, para no pintar
// miles de nodos SVG en actividades largas.
function sample<T extends { speed: number }>(rows: T[]): T[] {
  if (rows.length <= MAX_POINTS) return rows;
  const size = Math.ceil(rows.length / MAX_POINTS);
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const bucket = rows.slice(i, i + size);
    out.push(bucket.reduce((a, b) => (b.speed > a.speed ? b : a)));
  }
  return out;
}
export function SpeedChart({ session }: { session: Session }) {
  const { t } = useI18n();
  const foot = session.type === "run" || session.type === "walk";
  const unit = foot ? "paceUnit" : "speedUnit";
  const id = useId().replaceAll(":", "");
  return (
    <Section
      title={t(foot ? "paceChart" : "chart")}
      action={<span className="tiny-unit">{t(unit)}</span>}
    >
      <div
        className="chart"
        role="img"
        aria-label={`${t("chart")}, ${session.measurements.length}`}
      >
        <ResponsiveContainer width="100%" height={185}>
          <AreaChart
            data={sample(session.measurements).map((m) => ({
              ...m,
              plotted: foot ? (m.speed >= 1 ? 60 / m.speed : null) : m.speed,
            }))}
            margin={{ top: 12, right: 10, bottom: 5, left: -24 }}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c3f65b" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#c3f65b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#2a302b"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="elapsed"
              type="number"
              domain={[0, "dataMax"]}
              tick={{ fill: "#8e998f", fontSize: 10 }}
              tickFormatter={(v) => String(Math.round(v))}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8e998f", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#202820",
                border: "1px solid #3b4737",
                borderRadius: 12,
                color: "#fff",
              }}
              formatter={(value) => [
                `${Number(value).toFixed(1)} ${t(unit)}`,
                t(foot ? "pace" : "speed"),
              ]}
              labelFormatter={(value) =>
                `${Math.round(Number(value))} ${t("seconds")}`
              }
            />
            {session.type === "vehicle" && (
              <ReferenceLine
                y={session.limit}
                stroke="#ffb96c"
                strokeDasharray="4 4"
              />
            )}
            {session.events.map((e) => (
              <ReferenceLine
                key={e.id}
                x={e.elapsed}
                stroke={
                  e.type === "brake"
                    ? "#fa827c"
                    : e.type === "over"
                      ? "#ffb96c"
                      : "#8ac8fa"
                }
                strokeDasharray="2 4"
              />
            ))}
            <Area
              type="monotone"
              dataKey="plotted"
              stroke="#c3f65b"
              strokeWidth={2.5}
              fill={`url(#${id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="chart-axis">{t("seconds")}</div>
      </div>
    </Section>
  );
}
