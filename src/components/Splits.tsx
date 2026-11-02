import type { Session } from "../types";
import { useI18n } from "../i18n";
import { pace } from "../utils/formatters";
import { Section } from "./ui";
export function Splits({ session }: { session: Session }) {
  const { t } = useI18n();
  const best = session.splits.reduce(
    (min, s) => (s.pace > 0 && s.pace < min ? s.pace : min),
    Infinity,
  );
  return (
    <Section title={t("splits")}>
      <div className="card splits">
        {session.splits.length ? (
          session.splits.map((s) => (
            <div className="split" key={s.id}>
              <span>
                {t("km")} {s.kilometer}
              </span>
              <div className="split-track">
                <i
                  style={{
                    width: `${s.pace > 0 && Number.isFinite(best) ? (best / s.pace) * 100 : 0}%`,
                  }}
                />
              </div>
              <strong>
                {pace(s.pace)} <small>{t("paceUnit")}</small>
              </strong>
            </div>
          ))
        ) : (
          <p className="muted">{t("noSplits")}</p>
        )}
      </div>
    </Section>
  );
}
