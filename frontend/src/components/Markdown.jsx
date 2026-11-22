// Minimal, safe Markdown for AI answers: headings, paragraphs, bullet/numbered lists, tables,
// code blocks, **bold**, *italic*, `code`. Builds React elements only — model output can never
// inject HTML or scripts (no dangerouslySetInnerHTML).
import { Fragment } from "react";

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

export function inline(text, keyBase = "i") {
  const parts = String(text).split(INLINE).filter((p) => p !== "");
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={k} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={k} className="rounded bg-zinc-900 px-1 py-0.5 text-[0.85em] text-zinc-100">{p.slice(1, -1)}</code>;
    if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_"))) return p.length > 2 ? <em key={k}>{p.slice(1, -1)}</em> : p;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isDivider = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/** Parse markdown into a list of blocks (exported for tests). */
export function parseBlocks(src) {
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (isRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]));
      blocks.push({ type: "table", head, rows });
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s|^```/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !isRow(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

export default function Markdown({ text }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-200">
      {parseBlocks(text).map((b, i) => {
        if (b.type === "heading") {
          const cls = b.level <= 2 ? "text-base font-semibold text-white" : "text-sm font-semibold text-white";
          return (
            <p key={i} className={`${cls} pt-1`} role="heading" aria-level={Math.min(6, b.level + 2)}>
              {inline(b.text, `h${i}`)}
            </p>
          );
        }
        if (b.type === "hr") return <hr key={i} className="border-zinc-800" />;
        if (b.type === "code")
          return (
            <pre key={i} className="overflow-x-auto rounded-lg border border-zinc-800 bg-black p-3 text-xs text-zinc-300">
              {b.text}
            </pre>
          );
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-zinc-600`}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `l${i}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        if (b.type === "table")
          return (
            <div key={i} className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/60">
                  <tr>
                    {b.head.map((c, j) => (
                      <th key={j} className="whitespace-nowrap px-3 py-2 font-medium text-zinc-400">
                        {inline(c, `th${i}-${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-t border-zinc-900">
                      {r.map((c, k) => (
                        <td key={k} className={`num px-3 py-2 align-top text-zinc-200 ${c.length <= 24 ? "whitespace-nowrap" : "min-w-[14rem]"}`}>
                          {inline(c, `td${i}-${j}-${k}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return <p key={i}>{inline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
