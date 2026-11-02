import { describe, it, expect } from "vitest";
import { dictionaries, translate } from "./index";
import type { TranslationKey } from "./es";
import type { Language } from "../types";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
describe("complete language contracts", () => {
  for (const [language, dictionary] of Object.entries(dictionaries)) {
    it(`${language} has every key, nonempty text and matching placeholders`, () => {
      expect(Object.keys(dictionary).sort()).toEqual(
        Object.keys(dictionaries.es).sort(),
      );
      for (const key of Object.keys(dictionaries.es) as TranslationKey[]) {
        expect(dictionary[key].trim(), key).not.toBe("");
        expect(placeholders(dictionary[key]), key).toEqual(
          placeholders(dictionaries.es[key]),
        );
      }
    });
  }
  it("fallback survives invalid persisted language and missing runtime keys", () => {
    expect(translate("invalid" as Language, "pause")).toBe(
      dictionaries.es.pause,
    );
    expect(translate("qu", "missing" as TranslationKey)).toBe("missing");
  });
  it("Quechua is explicit rather than a spread of Spanish", () => {
    expect(readFileSync("src/i18n/qu.ts", "utf8")).not.toContain("...es");
  });
  it("every key is referenced by the app or built dynamically", () => {
    // Keys assembled at runtime (PhysicsPanel renders `${concept}Desc`).
    const dynamic =
      /^(?:displacement|velocity|acceleration|mru|mruv|uncertainty)Desc$/;
    const sources: string[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = `${folder}/${entry.name}`;
        if (entry.isDirectory()) {
          if (path !== "src/i18n") walk(path);
        } else if (/\.tsx?$/.test(path))
          sources.push(readFileSync(path, "utf8"));
      }
    };
    walk("src");
    const code = sources.join("\n");
    const unused = (Object.keys(dictionaries.es) as TranslationKey[]).filter(
      (key) => !dynamic.test(key) && !new RegExp(`\\b${key}\\b`).test(code),
    );
    expect(unused).toEqual([]);
  });
  it("UI JSX text contains only brands, symbols or scientific notation", () => {
    const allowed =
      /^(?:SpeedTrack|Perú|v = d \/ t|v = Δx \/ Δt|a = Δv \/ Δt|km\/h = m\/s × 3\.6|km \/|h ≈|km\/h|Y ·|· v2\.0)$/;
    const violations: string[] = [];
    for (const folder of ["src/components", "src/pages", "src/hooks"]) {
      for (const file of readdirSync(folder).filter((f) =>
        f.endsWith(".tsx"),
      )) {
        const path = `${folder}/${file}`;
        const ast = ts.createSourceFile(
          path,
          readFileSync(path, "utf8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        const visit = (node: ts.Node) => {
          if (ts.isJsxText(node)) {
            const value = node.text.trim();
            if (/[a-zA-ZÀ-ÿ]/.test(value) && !allowed.test(value))
              violations.push(`${path}: ${value}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(ast);
      }
    }
    expect(violations).toEqual([]);
  });
});
