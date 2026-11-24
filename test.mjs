// Tests: level data integrity and scoring. Run: node test.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { LEVELS, TYPES } = createRequire(import.meta.url)("./levels.js");
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const Game = new Function("module", html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + "; return Game;")({});
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ": " + d : ""}`); };

// 1. content
check("12 levels", LEVELS.length === 12);
check("every level has 8-10 features", LEVELS.every(l => l.features.length >= 8 && l.features.length <= 10), LEVELS.map(l => l.features.length).join(","));
check("every level has at least 3 leaks and 3 safe features", LEVELS.every(l => l.features.filter(f => f.leak).length >= 3 && l.features.filter(f => !f.leak).length >= 3));
check("leak flag agrees with the type for every feature", LEVELS.every(l => l.features.every(f => TYPES[f.type] && TYPES[f.type].leak === f.leak)));
check("every feature has an explanation of 25+ characters", LEVELS.every(l => l.features.every(f => f.why.length >= 25)));
check("feature names are unique within each level", LEVELS.every(l => new Set(l.features.map(f => f.name)).size === l.features.length));
check("every level marks its prediction moment on the timeline", LEVELS.every(l => l.timeline.filter(t => /prediction/i.test(t)).length === 1));
const used = new Set(LEVELS.flatMap(l => l.features.map(f => f.type)));
check("all six leak/safe types are used", Object.keys(TYPES).every(t => used.has(t)), [...used].join(", "));
const total = LEVELS.reduce((s, l) => s + l.features.length, 0), leaks = LEVELS.reduce((s, l) => s + l.features.filter(f => f.leak).length, 0);
check("leaks are roughly balanced against safe features", leaks / total > 0.35 && leaks / total < 0.6, `${leaks} leaks of ${total} features`);
check("the HW4 4D leak is in the game", LEVELS[0].features.some(f => f.name === "checked_in_online" && f.leak));

// 2. scoring
{
  const L = LEVELS[0], leakNames = new Set(L.features.filter(f => f.leak).map(f => f.name));
  const perfect = Game.scoreLevel(L, leakNames);
  check("perfect answers: all right + 2 bonus", perfect.perfect && perfect.points === L.features.length + 2);
  const none = Game.scoreLevel(L, new Set());
  check("flag nothing: points = number of safe features", none.points === L.features.filter(f => !f.leak).length && none.results.filter(r => r.kind === "missed").length === leakNames.size);
  const all = Game.scoreLevel(L, new Set(L.features.map(f => f.name)));
  check("flag everything: points = number of leaks, rest are false alarms", all.points === leakNames.size && all.results.filter(r => r.kind === "false_alarm").length === L.features.length - leakNames.size);
  check("max score = features + 2 per level", Game.maxPoints(LEVELS) === total + 24, String(Game.maxPoints(LEVELS)));
}
// 3. mistake summary
{
  const runs = LEVELS.slice(0, 3).map(level => ({ level, res: Game.scoreLevel(level, new Set()) }));   // misses every leak
  const s = Game.summarize(runs), misses = runs.reduce((n, r) => n + r.level.features.filter(f => f.leak).length, 0);
  check("summary counts every miss, grouped by type and sorted", s.list.length === misses && s.byType.reduce((n, t) => n + t.n, 0) === misses && s.byType.every((t, i) => !i || t.n <= s.byType[i - 1].n) && s.byType.every(t => t.kind === "missed"));
  check("shuffle keeps every feature", Game.shuffle(LEVELS[1].features).length === LEVELS[1].features.length && new Set(Game.shuffle(LEVELS[1].features).map(f => f.name)).size === LEVELS[1].features.length);
}
console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
