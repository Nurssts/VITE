// CSV helpers shared by every import/export in VITE.
// Exports are safe to open in Excel/Sheets: text that starts with = + - @ is prefixed with '
// (formula injection), and the prefix is removed again on import.

const NUMERIC = /^-?\d+(?:[.,]\d+)?$/;
const FORMULA = /^[=+\-@\t\r]/;

/** One CSV field (always quoted). Numbers stay numbers; formulas are neutralised. */
export function csvCell(v) {
  let s = v === null || v === undefined ? "" : typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  if (FORMULA.test(s) && !NUMERIC.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Reverse of the formula guard: "'=SUM(A1)" -> "=SUM(A1)". */
export function unguard(s) {
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

/** RFC-4180-ish parser. Returns objects keyed by the header row. Handles BOM, CRLF, quotes, ; delimiter. */
export function parseCSV(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] || "";
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const out = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (row.some((x) => x !== "")) out.push(row);
      row = [];
    } else field += c;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((x) => x !== "")) out.push(row);
  if (!out.length) return [];
  const keys = out.shift().map((x) => x.trim());
  return out.map((line) => Object.fromEntries(keys.map((k, i) => [k, unguard((line[i] ?? "").trim())])));
}

export function bool(v) {
  return ["1", "true", "yes", "да", "y", "+", "x"].includes(String(v ?? "").trim().toLowerCase());
}

/** Save text as a file (with UTF-8 BOM for CSV so Excel shows Cyrillic). */
export function download(name, text, type = "text/plain") {
  const body = type.startsWith("text/csv") ? "﻿" + text : text;
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(s, fallback = "vite") {
  return String(s || fallback).replace(/[^\w.-]+/g, "_").slice(0, 60) || fallback;
}
