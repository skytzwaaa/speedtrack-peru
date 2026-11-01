import { useI18n } from "../i18n";
import { lazy, Suspense } from "react";
import type { MapProps } from "./WorldMap";
const WorldMap = lazy(() => import("./WorldMap"));
export function RouteMap(props: MapProps) {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <>
          <div className="map-canvas" role="status" aria-busy="true">
            {t("loading")}
          </div>
          {props.children}
          {props.controls?.(null)}
        </>
      }
    >
      <WorldMap {...props} />
    </Suspense>
  );
}
