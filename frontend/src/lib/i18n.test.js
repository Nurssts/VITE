import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EN } from "./en";
import { TRANSLATIONS } from "./i18n";

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(js|jsx)$/.test(f) && !f.includes(".test.") ? [p] : [];
  });
}

const CYRILLIC = new RegExp("[\\u0400-\\u04FF]");
// Built from a string: Vite's import analysis lexer mis-parses an equivalent regex literal.
const TR_CALL = new RegExp('\\btr\\(\\s*"((?:[^"\\\\]|\\\\.)*)"', "g");

/** Russian strings passed to tr("...") that have no English translation. */
export function untranslated() {
  const missing = new Set();
  for (const f of files(join(import.meta.dirname, ".."))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(TR_CALL)) {
      const key = JSON.parse(`"${m[1]}"`);
      if (CYRILLIC.test(key) && !(key in EN)) missing.add(key);
    }
  }
  return [...missing].sort();
}

describe("i18n", () => {
  it("has an English translation for every Russian UI string", () => {
    expect(untranslated()).toEqual([]);
  });
  it("keyed translations exist in both languages", () => {
    const en = Object.keys(TRANSLATIONS.en);
    expect(Object.keys(TRANSLATIONS.ru).filter((k) => !en.includes(k))).toEqual([]);
  });
});
