// Fuzzy event search: ignores case, accents and Cyrillic/Latin differences ("алматы" ~ "almaty"),
// tolerates small typos, ranks code/name matches first.
const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g",
  қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

export function locText(l) {
  if (!l) return "";
  if (typeof l === "string") return l;
  return Object.values(l).filter((v) => typeof v === "string").join(", ");
}

export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split("")
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// score of one query token against the event's words; 0 = no match
function tokenScore(tok, words, code) {
  if (code === tok) return 100;
  if (code.startsWith(tok)) return 80;
  let best = 0;
  for (const w of words) {
    if (w === tok) best = Math.max(best, 70);
    else if (w.startsWith(tok)) best = Math.max(best, 60);
    else if (w.includes(tok) && tok.length >= 3) best = Math.max(best, 40);
    else if (tok.length >= 4) {
      const d = Math.min(lev(tok, w.slice(0, tok.length), 2), lev(tok, w, 2));
      if (d <= (tok.length >= 6 ? 2 : 1)) best = Math.max(best, 30 - d * 5); // typo
    }
  }
  return best;
}

export function searchEvents(events, query, limit = 8) {
  const q = norm(query);
  const today = new Date().toISOString().slice(0, 10);
  const list = events.map((e) => {
    const name = norm(e.name || e.eventName);
    const code = norm(e.code || e.eventCode).replace(/\s/g, "");
    const loc = norm(locText(e.location));
    return { e, words: [...name.split(" "), ...loc.split(" ")].filter(Boolean), code, text: `${name} ${loc}` };
  });

  // empty query: nearest upcoming events first
  if (!q) {
    return list
      .map((x) => x.e)
      .sort((a, b) => {
        const fa = (a.end || a.start || "") >= today ? 0 : 1;
        const fb = (b.end || b.start || "") >= today ? 0 : 1;
        return fa - fb || String(a.start || "").localeCompare(String(b.start || ""));
      })
      .slice(0, limit)
      .map((e) => ({ event: e, similar: false }));
  }

  const toks = q.split(" ");
  const scored = list
    .map((x) => {
      const scores = toks.map((t) => tokenScore(t, x.words, x.code));
      if (scores.some((s) => s === 0)) return { x, score: 0 };
      return { x, score: scores.reduce((a, b) => a + b, 0) / scores.length + (x.text.includes(q) ? 15 : 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) return scored.slice(0, limit).map((r) => ({ event: r.x.e, similar: r.score < 40 }));

  // nothing matched every word: offer the closest events that match at least one word
  return list
    .map((x) => ({ x, score: Math.max(...toks.map((t) => tokenScore(t, x.words, x.code))) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => ({ event: r.x.e, similar: true }));
}
