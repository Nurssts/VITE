import { useEffect, useState } from "react";
import { Button, COLORS, DemoBanner, Kpi, PageHeader, Panel, RoleBar } from "../components/ui";
import { allStats, avg, fmt, priority, roleLabel } from "../lib/model";
import { t } from "../lib/i18n";

// Pointy-top hexagon geometry for the hive map (SVG units).
const R = 50;
const W = Math.sqrt(3) * R;
const ROW = R * 1.5;
const hexPath = (cx, cy, r = R - 3) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join("") + "Z";

function useNarrow() {
  const query = "(max-width: 640px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function HiveMap({ cells, onOpen, lang }) {
  const narrow = useNarrow();
  const n = cells.length;
  const cols = Math.max(1, Math.min(n, narrow ? 4 : n <= 12 ? 6 : 8));
  const rows = Math.ceil(n / cols);
  const width = cols * W + (rows > 1 ? W / 2 : 0) + 4;
  const height = (rows - 1) * ROW + 2 * R + 4;
  const max = Math.max(1, ...cells.map((c) => c.mean));

  return (
    <svg viewBox={`-2 -2 ${width} ${height}`} className="h-auto w-full" role="list" aria-label={t(lang, "hive_map_title")}>
      <defs>
        <linearGradient id="honey-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd77a" />
          <stop offset="1" stopColor="#d99410" />
        </linearGradient>
      </defs>
      {cells.map((c, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const cx = W / 2 + col * W + (row % 2 ? W / 2 : 0);
        const cy = R + row * ROW;
        const level = c.count ? c.mean / max : 0;
        const fillH = 2 * R * level;
        const leader = i === 0 && c.count;
        const surface = cy + R - fillH;
        const delay = { animationDelay: `${120 + i * 55}ms` };
        const labels = (ink) => (
          <g fill={ink} fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            <text x={cx} y={cy - 2} fontWeight="700" fontSize="15">
              {c.number}
            </text>
            <text x={cx} y={cy + 17} fontSize="12">
              {c.count ? fmt(c.mean) : "—"}
            </text>
          </g>
        );
        const label = c.count
          ? `${c.number} ${c.name}: ${fmt(c.mean)}, #${i + 1}`
          : `${c.number} ${c.name}: ${t(lang, "hive_map_empty")}`;
        return (
          <g
            key={c.id}
            className="cell cursor-pointer"
            role="listitem"
            tabIndex={0}
            aria-label={label}
            onClick={onOpen}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
          >
            <title>{label}</title>
            <clipPath id={`cell-${i}`}>
              <path d={hexPath(cx, cy)} />
            </clipPath>
            {/* Same rect as the honey fill: dark labels show only below the honey line */}
            <clipPath id={`honey-${i}`}>
              <rect className="cell-fill" style={delay} x={cx - R} y={surface} width={2 * R} height={fillH} />
            </clipPath>
            <path d={hexPath(cx, cy)} fill={COLORS.cell} />
            {fillH > 0 ? (
              <rect
                className="cell-fill"
                style={delay}
                x={cx - R}
                y={surface}
                width={2 * R}
                height={fillH}
                fill="url(#honey-fill)"
                clipPath={`url(#cell-${i})`}
              />
            ) : null}
            <path
              className="cell-edge transition-colors"
              d={hexPath(cx, cy)}
              fill="none"
              stroke={leader ? COLORS.honey : COLORS.waxHi}
              strokeWidth={leader ? 3 : 1.5}
            />
            {labels(c.count ? COLORS.paper : COLORS.smoke)}
            {fillH > 0 ? <g clipPath={`url(#honey-${i})`}>{labels(COLORS.ink)}</g> : null}
          </g>
        );
      })}
    </svg>
  );
}

export default function Overview({ db, setPage, lang = "ru" }) {
  const ss = allStats(db);
  const ranked = ss.filter((s) => s.count).sort((a, b) => b.mean - a.mean);
  const unranked = ss.filter((s) => !s.count);
  const total = db.records.filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode).length;
  const top = ranked[0];
  const maxMean = Math.max(1, ...ranked.map((s) => s.mean));
  const cells = [...ranked, ...unranked].map((s) => ({
    id: s.team.id,
    number: s.team.number,
    name: s.team.name,
    mean: s.mean,
    count: s.count,
  }));
  const eyebrow = [db.meta.eventName || t(lang, "event_not_chosen"), db.meta.eventCode || t(lang, "all_code")].join(" · ");

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={t(lang, "tournament_overview")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPage("teams")}>
              {t(lang, "all_teams")}
            </Button>
            <Button onClick={() => setPage("scouting")}>{t(lang, "record_match")}</Button>
          </>
        }
      />

      <DemoBanner demo={db.meta.demo} lang={lang} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel className="comb-bg">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-50">{t(lang, "hive_map_title")}</h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-400">{t(lang, "hive_map_note")}</p>
            </div>
          </div>
          {cells.length ? (
            <HiveMap cells={cells} onOpen={() => setPage("teams")} lang={lang} />
          ) : (
            <p className="py-12 text-center text-sm text-zinc-500">{t(lang, "chart_empty")}</p>
          )}
          <p className="chart-note">{t(lang, "chart_note")}</p>
        </Panel>

        <Panel className="flex flex-col">
          <h2 className="text-xs font-medium text-zinc-400">{t(lang, "leader_profile")}</h2>
          {top ? (
            <>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-3xl font-extrabold tracking-tight text-honey-400">{top.team.number}</span>
                <span className="truncate text-sm text-zinc-300">{top.team.name}</span>
              </div>
              <div className="tabular mt-1 font-mono text-xs text-zinc-500">
                {fmt(top.mean)} ± {fmt(top.sd)} · {top.count} {t(lang, "col_matches").toLowerCase()}
              </div>
              <span className="mt-3 self-start rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{roleLabel(top)}</span>
              <div className="mt-6 flex flex-col gap-3.5">
                {["auto", "hive", "flower", "reliability"].map((k) => (
                  <RoleBar key={k} role={k} value={top.profile[k]} label={k[0].toUpperCase() + k.slice(1)} />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">{t(lang, "no_data")}</p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi label={t(lang, "kpi_teams")} value={db.teams.length} foot={t(lang, "kpi_teams_foot")} />
        <Kpi label={t(lang, "kpi_obs")} value={total} foot={db.meta.demo ? t(lang, "kpi_obs_demo") : t(lang, "kpi_obs_real")} />
        <Kpi label={t(lang, "kpi_avg")} value={ranked.length ? fmt(avg(ranked.map((s) => s.mean))) : "—"} foot={t(lang, "kpi_avg_foot")} />
        <Kpi
          label={t(lang, "kpi_completeness")}
          value={ranked.length ? `${Math.round((ranked.filter((s) => s.count >= 4).length / ranked.length) * 100)}%` : "—"}
          foot={t(lang, "kpi_completeness_foot")}
        />
      </div>

      <Panel className="mt-4">
        <h2 className="mb-4 font-display text-base font-bold text-zinc-50">{t(lang, "team_ranking")}</h2>
        <div className="-mx-1 overflow-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                {[t(lang, "col_team"), t(lang, "col_score"), t(lang, "col_matches"), t(lang, "col_class"), t(lang, "col_confidence")].map((h) => (
                  <th key={h} className="border-b border-zinc-800 pb-2.5 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 8).map((s, idx) => (
                <tr key={s.team.id} className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30">
                  <td className="py-3 pr-4">
                    <span className={`mr-3 inline-block w-5 font-mono text-xs ${idx === 0 ? "text-honey-400" : "text-zinc-600"}`}>{idx + 1}</span>
                    <span className="font-mono font-semibold text-zinc-50">{s.team.number}</span>
                    <span className="ml-2 text-zinc-400">{s.team.name}</span>
                  </td>
                  <td className="pr-4">
                    <div className="flex items-center gap-3">
                      <span className="w-12 font-mono font-medium text-zinc-50">{fmt(s.mean)}</span>
                      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800 sm:block" aria-hidden="true">
                        <span className="block h-full rounded-full bg-honey-400" style={{ width: `${(s.mean / maxMean) * 100}%` }} />
                      </span>
                      <span className="font-mono text-xs text-zinc-500">± {fmt(s.sd)}</span>
                    </div>
                  </td>
                  <td className="pr-4 font-mono text-zinc-300">{s.count}</td>
                  <td className="pr-4">
                    <span className={`inline-grid h-6 w-6 place-items-center rounded-md text-xs font-semibold ${priority(s) === "A" ? "bg-honey-400/15 text-honey-300" : "bg-zinc-800 text-zinc-300"}`}>
                      {priority(s)}
                    </span>
                  </td>
                  <td className="text-zinc-300">{s.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
