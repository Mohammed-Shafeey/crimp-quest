import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  CRIMP QUEST — pixel-RPG training tracker                           */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "crimpquest:v1";

const C = {
  bg: "#141029",
  bgDeep: "#0C0A1C",
  panel: "#1F1A3D",
  panelHi: "#2A2352",
  bone: "#EDE6D6",
  boneDim: "#8A83A6",
  magenta: "#FF3D7F",
  cyan: "#3DE0E0",
  gold: "#FFC53D",
  red: "#E5484D",
  green: "#5CE08A",
};

/* ---------------------------- SCALES ------------------------------ */
/* Each scale carries a `source` so invented tiers never masquerade
   as real data. */

const SCALES = {
  repeaters: {
    key: "repeaters",
    name: "REPEATERS",
    sub: "bodyweight · 15mm · 7s on / 3s off · to failure",
    unit: "reps",
    metricLabel: "REPS",
    color: C.gold,
    source: "YOUR OWN SCALE — French grades borrowed for flavor. No repeater-to-redpoint-grade link exists in research; pure gamification.",
    sourceTone: "invented",
    // value entered = reps
    metric: (v) => v.reps,
    fmt: (m) => `${m}`,
    tiers: [
      { min: 0, name: "6a OR BELOW" },
      { min: 5, name: "6b" },
      { min: 10, name: "6c" },
      { min: 16, name: "7a" },
      { min: 22, name: "7b" },
      { min: 29, name: "7c" },
      { min: 37, name: "8a" },
      { min: 46, name: "8b" },
      { min: 56, name: "8c" },
      { min: 67, name: "9a" },
      { min: 78, name: "9b" },
      { min: 90, name: "9c" },
    ],
    fields: [{ id: "reps", label: "REPS COMPLETED", step: 0.5 }],
  },

  twoArm: {
    key: "twoArm",
    name: "TWO-ARM MAX",
    sub: "15mm · half-crimp · 7s · total suspended load",
    unit: "% BW",
    metricLabel: "TOTAL LOAD",
    color: C.magenta,
    source:
      "LATTICE-DERIVED (est.) — via your assumed 0.90 edge coefficient. V12+ is linear extrapolation and gets shakier the higher it goes.",
    sourceTone: "derived",
    // value entered = added kg. metric = total load as % bodyweight
    metric: (v, bw) => ((bw + v.added) / bw) * 100,
    fmt: (m) => `${m.toFixed(0)}%`,
    tiers: [
      { min: 0, name: "V3 OR BELOW" },
      { min: 115.2, name: "V4" },
      { min: 120.6, name: "V5" },
      { min: 126.0, name: "V6" },
      { min: 131.4, name: "V7" },
      { min: 136.8, name: "V8" },
      { min: 142.2, name: "V9" },
      { min: 147.6, name: "V10" },
      { min: 153.0, name: "V11" },
      { min: 158.4, name: "V12" },
      { min: 163.8, name: "V13" },
      { min: 169.2, name: "V14" },
      { min: 174.6, name: "V15" },
    ],
    fields: [{ id: "added", label: "ADDED WEIGHT (KG)", step: 0.5 }],
  },

  oneArm: {
    key: "oneArm",
    name: "ONE-ARM MAX",
    sub: "15mm · half-crimp · band-assisted · force = BW − assist",
    unit: "% BW",
    metricLabel: "FORCE",
    color: C.cyan,
    source: "LATTICE-DERIVED (est.) — one-arm chart converted via your 0.90 coefficient. V4–V13 follows the original ~3.6%/grade curve; V14–V17 steepened per your own estimate (V17 ≈ 130% BW) rather than the flatter linear extrapolation. Still speculative.",
    sourceTone: "derived",
    // value entered = assist kg + hand. metric = (bw - assist) / bw * 100
    metric: (v, bw) => ((bw - v.assist) / bw) * 100,
    fmt: (m) => `${m.toFixed(0)}%`,
    tiers: [
      { min: 0, name: "V3 OR BELOW" },
      { min: 59.4, name: "V4" },
      { min: 63.0, name: "V5" },
      { min: 66.6, name: "V6" },
      { min: 70.2, name: "V7" },
      { min: 73.8, name: "V8" },
      { min: 77.4, name: "V9" },
      { min: 81.0, name: "V10" },
      { min: 84.6, name: "V11" },
      { min: 88.2, name: "V12" },
      { min: 91.8, name: "V13" },
      { min: 101.4, name: "V14" },
      { min: 110.9, name: "V15" },
      { min: 120.5, name: "V16" },
      { min: 130.0, name: "V17" },
    ],
    fields: [{ id: "assist", label: "ASSIST ON SCALE (KG)", step: 0.5 }],
    hasHand: true,
    splitByHand: true,
  },

  pinch: {
    key: "pinch",
    name: "PINCH",
    sub: "55mm block · one hand · 7–10s",
    unit: "% BW",
    metricLabel: "LOAD",
    color: C.green,
    source: "YOUR OWN SCALE — V-grade labels invented purely for fun. No pinch-to-grade data exists anywhere, unlike the other two ladders.",
    sourceTone: "invented",
    metric: (v, bw) => (v.load / bw) * 100,
    fmt: (m) => `${m.toFixed(0)}%`,
    tiers: [
      { min: 0, name: "V3 OR BELOW" },
      { min: 23.8, name: "V6" },
      { min: 30.4, name: "V7" },
      { min: 38.0, name: "V8" },
      { min: 45.6, name: "V9" },
      { min: 55.1, name: "V10" },
      { min: 64.6, name: "V11" },
      { min: 74.1, name: "V12" },
      { min: 83.6, name: "V13" },
      { min: 93.1, name: "V14" },
    ],
    fields: [{ id: "load", label: "LOAD LIFTED (KG)", step: 0.5 }],
    hasHand: true,
    splitByHand: true,
  },
};

const SCALE_ORDER = ["repeaters", "twoArm", "oneArm", "pinch"];

const SESSION_TYPES = [
  "MAX HANGS",
  "REPEATERS",
  "PINCH BLOCK",
  "BOARD / SPRAY",
  "CLIMBING",
  "REST",
];

/* --------------------------- RARITY -------------------------------- */
/* Shared across titles now, and future cosmetics/loot later — one
   source of truth for the color+label so the loot system can reuse it. */

const RARITY = {
  common: { label: "COMMON", color: C.boneDim },
  rare: { label: "RARE", color: C.cyan },
  epic: { label: "EPIC", color: C.magenta },
  legendary: { label: "LEGENDARY", color: C.gold },
};

/* ---------------------------- LOOT ---------------------------------- */
/* Chests are earned 1-per-Training-Level (not Rank Level — that's
   already rewarded via titles/XP on real strength PRs). Sprites don't
   exist yet, so chests drop rarity-tagged tokens tied to the cosmetic
   slots already scaffolded in profile.sprite — banked now, spendable
   once the sprite system ships, rather than invented and thrown away.

   Randomness here is deliberately confined to flavor only (which
   rarity/slot you get) — it never touches anything real like rank or
   XP, and chest count is hard-capped by genuinely earned Training
   Level, so it can't be farmed. */

const LOOT_SLOTS = ["shoes", "chalk", "harness", "trainingTool", "wall"];

// Minimum distance (as a fraction of wall width/height) between two placed
// holds' centers. Simple distance check, not true bounding-box collision —
// good enough to stop holds landing directly on top of each other without
// needing per-hold pixel masks.
const MIN_HOLD_DISTANCE = 0.05;

// Regular holds render proportional to their real native pixel width, not
// a flat fixed size — otherwise a hold that was extracted bigger (which is
// exactly why it landed in a higher rarity tier) ends up squashed to the
// same on-screen size as a tiny common one. Clamped so the biggest holds
// don't overwhelm a wall meant to hold 40+ of these.
const HOLD_PX_TO_WALL_PCT = 0.31; // calibrated so an ~14.5px-wide hold (the catalog average) lands at ~4.5%
const HOLD_MIN_PCT = 3;
const HOLD_MAX_PCT = 8;
const holdDisplayPct = (item) => {
  if (!item.w) return 4.5; // legacy items with no stored native size
  const pct = item.w * HOLD_PX_TO_WALL_PCT;
  return Math.max(HOLD_MIN_PCT, Math.min(HOLD_MAX_PCT, pct));
};
/* Three independent chest tiers, each earned a different way:
   - DAILY: earned by logging your first session of a calendar day.
     Can't drop legendary — this is the low-stakes, frequent chest.
   - STANDARD: earned per Training Level gained, plus a bonus for
     fully completing a week's 5 quests. The "normal" chest.
   - RANK: earned per genuine rank-up event on any benchmark (same
     events that already grant Rank-Up XP). No commons at all, and
     weighted hard toward epic/legendary — this is the reward for
     actually getting stronger, not just logging activity. */
const CHEST_TIERS = {
  daily: {
    key: "daily",
    label: "DAILY CHEST",
    color: C.cyan,
    weights: [
      ["common", 60],
      ["rare", 30],
      ["epic", 10],
    ],
  },
  standard: {
    key: "standard",
    label: "CHEST",
    color: C.gold,
    weights: [
      ["common", 50],
      ["rare", 30],
      ["epic", 15],
      ["legendary", 5],
    ],
  },
  rankup: {
    key: "rankup",
    label: "RANK CHEST",
    color: C.magenta,
    weights: [
      ["rare", 35],
      ["epic", 40],
      ["legendary", 25],
    ],
  },
};

/* Named gear items with real art — hand-converted from real photos or
   AI-generated, whichever actually looks right for that item. Keyed by
   slot then rarity. When a chest roll lands on a slot+rarity that has
   a catalog entry, it becomes that specific item instead of a bare
   token. Empty slot+rarity combos just stay abstract tokens until
   real art exists for them — nothing here is required to be filled in. */
/* Empty spray wall background — real photo of the actual physical space,
   converted to pixel art. Holds get manually placed on top of this by
   the user, not auto-arranged. */
const WALL_BG = "data:image/png;base64,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";

const GEAR_CATALOG = {
  // Rare whole-piece "boulder" prefabs — unlike individual holds (which
  // cap at epic), these are the one thing that still drops legendary on
  // the wall slot. Placed as a single unit (not divided into holds) so
  // the deliberate arrangement stays intact.
  wallPrefabs: {
    legendary: [
      {
        id: "red_boulder",
        name: "Red Boulder",
        w: 118,
        h: 114,
        image: "data:image/png;base64,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",
      },
    ],
  },
  shoes: {
    common: [
      {
        id: "rental",
        name: "Rental Shoe",
        image: "data:image/png;base64,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",
      },
    ],
    legendary: [
      {
        id: "drago",
        name: "La Sportiva Drago",
        image: "data:image/png;base64,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",
      },
    ],
  },
  harness: {
    rare: [
      {
        id: "ct_wall",
        name: "Climbing Technology Wall",
        image: "data:image/png;base64,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",
      },
    ],
  },
  wall: {
    common: [
      { id: "hold_000", name: "Navy Hold #1", w: 17, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAMCAYAAACEJVa/AAABFklEQVR4nM2QvUrDUBiGn0Nq05o2TRRRbMBF8AckFnRz9ArqWDcvRLwEL8BJHHVzc+jgZkU7iZJJI3TR1EBojlKPQzEmWnXUd/o+OO/Dcz74LxHpRV/bVgCvvS4v57tieOVrcglgeUvZ8y7u6goAzX1LAcjTnV9hHxARE3V8bu8daoszuPVNbEOnCWpYMQ1PBrPWUMJZIm9V0XSDjfo6QdjDNot4d13GKzoAD0+S9lmLoHWMvNwTGZPw4kCYNBRWlb6MODw6IV8qE3hX2LMLGYu+jNBFjPxskr6NNjYFQHFimtC7YaRSQhudTN48++3EYijkHQSQMwwKzhyxf43SywOLx04G8C0kfSepCgOwiJNv/9T527wBmuhZdzQQwSIAAAAASUVORK5CYII=" },
      { id: "hold_001", name: "Magenta Hold #1", w: 16, h: 13, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAANCAYAAACgu+4kAAABIklEQVR4nM2OsUsCcRzFP3fmUR7YDUZaRluQdIsRETTU0l4HFUENtx3NN/oXtLW43dBkQxFuzgUNZbQ5BQ1iDRVydF5Her+GUBQtaqrv9B689/k++FfnZC3hZC3xm47cFrZhinXG2Z3WsQ3zx5Chtli4baImVSKvIXtVjdlvlpg3eakP8NwK8HwPFchsrZIulqmllU4pujzFWOGOqu9iG6Y4OHGkHkBFDXAD/9MUy8TnZ4h3fZUeFViZwy1d9ayRuk1O3xabzQkA4nKUlJbgof5ESkvg+R4AhZcK1v2xNBDQhugNhUliZEaTnVVu+M5Zok7u3Onp9AEA9td2xGJNYdgPAXgbkbnWQg4vjvryAwEA1tKGiIkIDakFQP7y9Mvs394HJRhbYoqAEcsAAAAASUVORK5CYII=" },
      { id: "hold_002", name: "Orange Hold #1", w: 14, h: 13, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAANCAYAAACZ3F9/AAAAwUlEQVR4nGNgoDdgxCUx1U3wP4ydves9hjoWbBoE/v5mCLGVRhb+j64ZhbPPm/+/tYUsVhfsOvuEwXfDB7h6Jhijz4ITrunv118YGt2MZRiWOvP8x9CIDo6eeMyw6+wTXNIIP35gZmd49eoDXMJCVxyn7Sg2Nh39wLjp5leGL+9+MjAwMDBcffmegYGBgeHnJwh/741XDB+YWeEaMYK5zlrgPwMDA4OvGkLRi/e/GR59Y0SJFpzxCDMA2UW41NIHAACUv0Q01gLhHQAAAABJRU5ErkJggg==" },
      { id: "hold_003", name: "Amber Hold #1", w: 15, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAMCAYAAAC9QufkAAABJElEQVR4nMWRP0tCURjGf0el0NsfSFFzEYomp6ApQmixOWoKSmhrM/oCbUJTQ+DeFiEUugUhiKMfoA+QZFcLb+feFK+eBvOYWLTVs5z3Pc/7vA/nOfBfEMPiPLulZimzEh/0yT1H/CQawqerx3tS+/MEo5sAVG+Lqlb3atq1XbaP2+JbcS8wOPu9B17NGonVNAmgr5p6uLpUVKWKy8lZVwB4hsSbE0DKDm2nid+YRloFLfSIIADx5QXsxshcO59etITZCqvD3RfCUYPnJ5tS5Yb0QVgPm3Vr7M0ToRzthFRqQ7K2PgOAlB0AHOlylVd4371kr20xHtgncvmGgJDyGW1ikZ6+L9xNEZtzyFyOQpsQf10QWeziWANnv5Ekkyv8+n1/gw9y7WSBESbqWAAAAABJRU5ErkJggg==" },
      { id: "hold_004", name: "Amber Hold #2", w: 15, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAMCAYAAAC9QufkAAABGElEQVR4nMWQPUsDQRCGn9tEJB+FcBAs7EVJIUZSKBYWVhJQQrCyFUQby1SWAStRLG3ERrRUEAstxC5/II12x8V4BGU3Meb21upOJZc6Uw3vzPPOB4wqrDjxrJY2ADlbUNqWsT0D8PFl3szpFxaW1gh0A5GYpv58y4cU+MpnY//LioWP9sbM8mqSmWIe0S8AEBgPYdlRfl9/Yr3sRkwyTD47Fulsko7n0FWvkbs9uUKgGwAUpnyqlYypXSkLQIRNzf4Eraamq3oASNnj5FTiuY+0Ww7tlsObq4bfvLuVM/OzksVigmx2PDLpSB+lLG7uAg7Pf+8e+GS1kjE6pdks/y9dXwjCdYfCAAc7JfP9/oBO6Uj7O3H08QMxJWuxb8eqMQAAAABJRU5ErkJggg==" },
      { id: "hold_005", name: "Green Hold #1", w: 14, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAALCAYAAABPhbxiAAAA00lEQVR4nL2RvWoCURSEv6uLu4XEgKBVSBEUFwvFn8LSp/ER7OzzCFZWwdYnEOxTBqKCxS0MCuKqXBUX5KRb9qK2TjWHM8Oc4cCzoR4tKr2CAKTySQDEKL67v5HeiYsbn74AqLSQz2YAaPlNAPRGYzonmfa1soyVXkH88hv1j5qVfAxNxN0XL+KJuCgwe1bBmlWw5ms8skzn84XrRu53LHXepdou3u182BlmE81i+GefCjDta+WErnilJLnMq2VcLraR6SYxnhyfndDlZzB/+IHn4B+l8kPhz2d8uAAAAABJRU5ErkJggg==" },
      { id: "hold_006", name: "Navy Hold #2", w: 13, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAMCAYAAAC5tzfZAAAA50lEQVR4nMWPsU7CYBSFv9KSQv+U0EQWQBMHQkeMC4lOXX0ER3Z9AAafwQfgVZxM1BgIiVNHE+LgAqFNm2rxOvUPRWY808m557s3F/5FTjCW3Uxd3Ih9eVfKrcJUz29FdXwIxrL50jEnwRUt1+QpXcn39N4oQQBHp31MW+G1uwRDn+U6BcBr1HmpN/9eKuS1uyw/Fjw8l/OfdLUf+gxftX9/nKI6PgCmrahsYj0ztiF7MJLacQ/LcQHIkwjLcYnDGdl8oruVbSibTwxZvJEnEXkSARCHs90PypcKNc6uJZOaXrSvcxj9AolDQ1DhsFnMAAAAAElFTkSuQmCC" },
      { id: "hold_007", name: "Magenta Hold #2", w: 13, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAMCAYAAAC5tzfZAAABBklEQVR4nL3QoUsDYRjH8e/rjt1uwjkOZtHigXBlYWcwOUx2m4jFFRkmsVhMFo2ma0sGk/+AWRYmGgQ3kIFlcgwVNtnd7vD1NciNiV7dLz1P+PweeGBaEclQd2sK4N6JKbezVO88kYZmJpcdw+ZcrtNaiqi7NZUUpSItDtHyBsrMcFraxC5a2EULb3VXHRweqX8RwGcQIh+7yOs2lYJDpeCwZ66gPfeYvDpGT2JE0+8wDIc0/Q6N2xt47wNwNnDpzkbjci0ZTh4uRXatqnjxWczNYeoG/bdXAAZRyIKu//1ekuPSllpWOcrS+gFxwMV8D69xJVIRwP7Gtvr6GJFXGQIhf4Hp5htjB1kHddCCxwAAAABJRU5ErkJggg==" },
      { id: "hold_008", name: "Crimson Hold #1", w: 14, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAMCAYAAABSgIzaAAAAzElEQVR4nM2QPwtBYRTGfy9ieXFdwy2fQb6Bkp2yKjH5IjYfwcRiNCiDgYkkJXajZJD8eQcJr0HdLpeMnO2cnt9zznPgL6scNHU5aGrnzPcNAKgUCwCoekM31U68BfPSsJ2rmRwAi+4QACk87o1ZGdalkEU6lQSg1euzmMxtobqcWOurG5QI4hGL2WgMQCIURV1OtrCzWdNWe+ECFZrBZmkLDe8ZADPgZ3rYsef2FEk4m7w0tDNHzOMHYHU7UztuxUfw1UTx+JPzxN/VHXo9QCsRPZQBAAAAAElFTkSuQmCC" },
      { id: "hold_009", name: "Green Hold #2", w: 13, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAALCAYAAACksgdhAAAAzElEQVR4nGNgGBCgX6r+H4Vfp/rfpFPzv36dKoo4C7IGcw81BlYRJrgCTW1ZBhERAQjnO9P/i903GVE0MTAwMAhxijDEeugzMDAwMPxn+wMXv/bsKgMD5z9Mm35++sFw5dE1hneibxjOnbnD4GJrgeJ0US4hTE0sv9gZ/n1gYvjE8INBRV6G4cGjJ3BFd98+Znh76iumpivzbzEyMKj959D4wCDwn4+BTYAJrujzpe8M99Y9ZoTx4QwY8Czz/n//4xUUsRszH2Koow8AAPvPQFKxcgaVAAAAAElFTkSuQmCC" },
      { id: "hold_010", name: "Grey Hold #1", w: 15, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAKCAYAAABrGwT5AAAAnklEQVR4nMWPsQ6CMBRFD4lJCzG4yA/gRvwPtuLkRzqpG//RMMvW4moQpjq1AWTnTfe+vJN7H2w10dRUl6vzWkgBwDiMM+BxvwVm50VZKqcqFY6MtUGf8hwAawzDd3B1/YxmsIwlWmuOWRagfZLw6XusMQC82hYZy/XaZalccS6Cb3TD0vvUP9j/LaQgTQ+z/bvrZv+uwr7BcjdN3H5+DaM1//0VrZcAAAAASUVORK5CYII=" },
      { id: "hold_011", name: "Navy Hold #3", w: 14, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAALCAYAAABPhbxiAAAAyklEQVR4nM2PsQ7BcBjEf5WiIX8RuxgkSJdaGHgCg8Vm8l42ixcwmIy6mBg6SAwNQxdFpU3aDn9ThfYBuOm+y12+O/g7jPSZHOkzmdbVtCltmEynCCFgjlxbCyUTHDbGst7Q6Q0MAOIAgsjncfdxLjc67R6e78qtvVIyHwF25p6yVuZwMGm2jLd+Ou7RVJGtqqmCq3MmCJ+UioJqpcbZtt7GQjHPZ9VcQjanpeK4NlEYc/dcuv0hURgThTGe736FAL6OZGtaS3b9Fi+hV0tTD8Hn0AAAAABJRU5ErkJggg==" },
      { id: "hold_012", name: "Magenta Hold #3", w: 13, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAALCAYAAACksgdhAAAA3klEQVR4nM2PsUrDUBSGv5vGhCRqhjpIwRfQwVIQO/YlCm6l4NK5cx/BToVueQHBXRwd9BHaSRBBaEuhV9KYNNfrEFJaUtfiP53/cL6f/8C/UVDr6KDW0Zs7sWn61ZY+SQWp5WAmEQA3/gVhFDLw3uk9BwLAzIHhdVvfVq4wLs+yNBkDoL8SfKnwxm/r8DVUnim0GaKeRoWKputs+3z4OBKM558cGweZ/15w7p8i4wg5X4H9x0/delM3Jg62fYiX/BBaBgCP/pS713uxE8rBpVC4ugTAUiiGLw+Fu/3oF71rQ3psvOsPAAAAAElFTkSuQmCC" },
      { id: "hold_013", name: "Orange Hold #2", w: 13, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAALCAYAAACksgdhAAAA70lEQVR4nL2QvUrDYBSGn08NbWwhWSTZHAQ3B/8g6A3YpbuzN1B6AQ69gOINOHsVHQsZdFPQTVQkjVDzlaahST+OU6NVB5f6TOe8vOe8nAP/hfraXO5bUnUrDFKDV1st9UFqaIdZ6V2bF93AlqOtOtsnDcz7K6IjlONDJUfiIU7xIGc3hQJY+R49vQsRHdEPnxEdIfEQk+Zoq9z/mdQOM5WMlZwCvrNOsONh0hyA3n3M06wOZItDAJ3biRpVa9L0EgB2N10iPaH3YnFx/VbetPCIOa2DDTl0MvZ8m6vHgk4/+dX3g/NjV7qBLX8yL40PmspT6/h7EeIAAAAASUVORK5CYII=" },
      { id: "hold_014", name: "Navy Hold #4", w: 14, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAALCAYAAABPhbxiAAAAxklEQVR4nMWQvwsBcRjGP9+6IjrFTAZZ/AlkuoFTDDYW/92ZFCk/yo02k4wUZSAD0smPq69Bzq9TJp7pfer5PL3vC3+VnqhIPVGR32SV26DFyrJYKl1NFQlwOp452Dv6s6b4CAphsZivOVp7NL0AwGgwBMCrqBLAnBhOwVOTFivLSDju+OVqSi6TxRsKst1YtOs1B1YeQXNiiJSdlwF/CIBkOkur28HnUQE42Dsn+7Y7QCp6h2+3CmHRGzfcV32FH73bg36rC+xkQV+KmN6xAAAAAElFTkSuQmCC" },
      { id: "hold_015", name: "Navy Hold #5", w: 14, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAKCAYAAACE2W/HAAAAvElEQVR4nMXPvQ7BYBTG8f/bqBKJMJpdAIlFYukNWCyWbnauwSW4AKPRPRgMFmoydZE0TE0bJVpfr6lvilh5pnNy8jvJA7+OSC96YyC1fEnt8Xwo3kGSTBrlKlXaVlcdpyCT+XEOuC5H4gNq9yOXwMPebAHwdy61jqWehIGPAzLBCsbrsdAbA+muFgBcAo9ruEfLFgGIfP97R4BCqy8BmqbJYjYD4CbKGCeHgz0RXyGAUe+pboaIAF7Qf/IEaCg98WOWvRwAAAAASUVORK5CYII=" },
      { id: "hold_016", name: "Crimson Hold #2", w: 12, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAALCAYAAABLcGxfAAAAvElEQVR4nGNgoBtI4xX6X8or8h9dPIpH4H8arxBcnAXGkGJiY8g2NGb4ePb4/y///8E1TDSxZph6/iwDhoZn/34xvH/9iaHLNxAu+eriLYaHT18yPPv3C1PDi/9/Ga68f8nwYe8TBnNNLQbW158Ynn17z3Du0wcGZBvhGjZ9+cjIwMDwP4FPnOH705cMr//8YGBgYGA48/MLw7IvHxgxNCBrMvr6iUGOg5PhxLePGIHDiCECDRkYG9l0+gAAUWxOPvihecMAAAAASUVORK5CYII=" },
      { id: "hold_017", name: "Amber Hold #3", w: 11, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAMCAYAAAC0qUeeAAAAwklEQVR4nGNgoBVgRBeY2871n+HrbwYGblaG5MpvKPIsyJwJ7e7/hTgOMriGazL8+PaWgYGB4T+yBjijIYf/v5PVbwYjCxUGJmZ1BgYGBoZ/f28y7Dn/iiEg+AUjisk/X/5h0NIThCuCgbfn38LZTMjOeP3yEwMDAwPDnL7rDAwMDAw/vr1lUNVixe7bzGCR/49Pivx/c0X6/5sr0v/PbuT8XxbH8R+7aqiGQ8u4/h9axoVfIQxUhnL/rwzlJqyQagAAy3ZGUFnK2uYAAAAASUVORK5CYII=" },
      { id: "hold_018", name: "Magenta Hold #4", w: 12, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAKCAYAAACALL/6AAAAqUlEQVR4nGNgoDVgRObMM8r8j03RMRNmhjmzpjAyMDAwsMAEiy1C/zt/5mP4oszP8PrnVwZRdm4GnrsfGfjYORnOPrgF1wzXIPjlJwMDAwODJqcsg4Y4M0RQnIHh01mEYhQN73nYGW5+/Mzw6dJ5BhlOPriCTz+/4/ZDnk3cf4UvjAzmnznhYvukfjHUHp7HiFUDTBPrn+8M3xj/MjAwMDBMP74OQw1tAQDoQi+eNOa/kwAAAABJRU5ErkJggg==" },
      { id: "hold_019", name: "Navy Hold #6", w: 13, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAKCAYAAABv7tTEAAAAnklEQVR4nGNgoBdgROY4K0f9x6Vw791lcLUsMIaLiv//8Pg4ho8fvjLwC3DDaQYGBoaPH74ysG1n/b/92kJGFE0MDAwMR/cch7MfP7nNICujysDAwMDw+dNbht+/PmB3nqdW/H8udl6Gbz8/M5ja2zCcPniEgYGBgeHT13cMRx9uZsSqCeZMVjYBOB9dA1ZNDAwMDNbyvvAAQddAXwAAQao2nB9BhfoAAAAASUVORK5CYII=" },
      { id: "hold_020", name: "Grey Hold #2", w: 13, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAKCAYAAABv7tTEAAAAg0lEQVR4nGNgGBQgLCL2v39A2H90cUZ0Rch8LRVVho/fvzFcu3KNYefOTXC1LDCGf0DYf2srKxQTeXh5GWQZGBgU5OUZGBgY/sM0siArunzlKoomXl4eBn5OLoaP378xcHByYHeef0DYf1ExMQy/vX71imHjhlWMWDXBNKKLIWugLwAA2NwlLeW0oQQAAAAASUVORK5CYII=" },
      { id: "hold_021", name: "Grey Hold #3", w: 13, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAJCAYAAADpeqZqAAAAkklEQVR4nL2PMQ6CQBBFH4nFkkgp0qhHsOAE0tChlYe0UjtOYcMBXO2WApJhI91aQdgYW343k3mT92GuBNPheDq7VRwDUBsz7vtPT1nex9vFFMiyA+skwVrrfe5EUKFyt+sl8CCAp9Y0pgbgUVWk6R6AppX/enleuM1uC0AULRHpAHjrl6fnQYPm0EOF6qfPvPkCbJM1LTh5tC8AAAAASUVORK5CYII=" },
      { id: "hold_022", name: "Teal Hold #1", w: 12, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAKCAYAAACALL/6AAAAlUlEQVR4nGNgoDVghDEkq2v/o0s+b21mRBdjQeYYutswSArxMDAwMDDsOXqSQbK69j+6JiYY4/enDwzvnrxi+PH8C8OP518YKlz8GZwcbBhEcnNRbEax4c3zFwxvnr+A8xVEhBksnZwYTn348v/l4vmMKH5gYGBgEI9N/M8kJ4PiZm4hPobPF64xYNUA04TMhymkHwAAhYgxi315quAAAAAASUVORK5CYII=" },
      { id: "hold_023", name: "Teal Hold #2", w: 13, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAJCAYAAADpeqZqAAAAlUlEQVR4nGNgoBdgROZIVtf+x6XweWszXC0LjCEem/jfycGGQUFEmOHBm7cMCiLCcA3nP79l+P0p9/+byZMZUTQxMDAwnLx0ieGupATD3++/GU5eusSgqaTCwMDAwHD11X0G5g9fsDtPPDbxP5OcDAMXtwDDx+cPGPglFRgY2f8xfL5wjeHl4vmMWDXBNKKLIWugLwAAp7wuy4EdihIAAAAASUVORK5CYII=" },
      { id: "hold_024", name: "Teal Hold #3", w: 13, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAKCAYAAABv7tTEAAAAnElEQVR4nGNgGDRAsrr2v2R17X9kMUZ0BVzcAgzfvn5gYGBgYOAW4mNgYGBg0FRSYTi+bx/Dm8mTGRkYGBhYYBrEYxP/s8kJMkSY2cENkeETZHjy6T3DrnOXUGzHsIlNTpBBT0yR4fq9OwwikhIMDAwMDHeOn4LbgqGJgYGBQSQ39z8rnwCc/+/RE4aXi+ejqMPQBHMqjI2ugb4AAAWLK1j3k0Q2AAAAAElFTkSuQmCC" },
      { id: "hold_025", name: "Crimson Hold #3", w: 9, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAMCAYAAABfnvydAAAArklEQVR4nKWPPQrCQBSEv13SSBYTf0DQUhBUsLKztTVYp/MYHsPWA3gD+xSWXsDYWYioJKJBUxjWKgtCKp3qMfPxhoF/JfLDV64GUEKyfETGl3k4a3dYDEc4SAObD75y9diuADDp9jgD/WAtAKycHJRrlFoNAObbDV8VAMk7ZRfuiS93pnbVABbAKrkJJaT2602Oz5hD+voGAE46I4iuAIRZWrzZU472lKOL01/1AaAoLdT4tGqyAAAAAElFTkSuQmCC" },
      { id: "hold_026", name: "Grey Hold #4", w: 12, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAJCAYAAAAGuM1UAAAAbklEQVR4nGNgoDVgROb4B4T9x6Zo44ZVcHWMyIqdnBwZeHh5URQfP36C4fWrV3BNLMiS71+9Zvjw8RvDubMnGUxNDBn+/PhN2EmiYmIMvLw8DJ8/f2FgYGBAMR1DAwMDA4O7ux/cHxycHCiK6QMAyDAnkayi5nEAAAAASUVORK5CYII=" },
      { id: "hold_027", name: "Navy Hold #7", w: 11, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAALCAYAAACprHcmAAAAlUlEQVR4nGNgoAvgM4z+j0+eEcZgNc6HK/x9diIjNsUsyBwBLRMGIxt7hgOLBf7/+/6BgenvF4afF+YyYihm+vuFgVNYgoGBgYHBITaZ4dHTFwwMDAwM9xgY/sM0oJj8/e0LhuvXIez3d67jdsbPC3MZPzEw/P8lq8rAwsXLwPj0JFR8KVb3MzAwMDCwGyT/JxQq1AcA2N0urOWeQycAAAAASUVORK5CYII=" },
      { id: "hold_028", name: "Green Hold #3", w: 10, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAALCAYAAABGbhwYAAAAr0lEQVR4nGNgoAsw6dT8r1+n+h9ZjBGZYzpV4z8DAwNDgI0Lw/Hrpxken/3AcLH7JiMDAwMDC0yRfqn6f2dDSwZebm4GbjYeBlUFeYbHZz/ADYErZOD8x/Dg0ROGu28fM9gY6zEwMDAw/Pz0A1PhxabbjH8TGf8ruAsy3H7wkIGBgYGBnY8Di4kMDAxX5t9iZGBQ+y9nLszw6uMHhr9vUPyDCTTS5f/rJKoRUEUpAAC70DIIyoAOBAAAAABJRU5ErkJggg==" },
      { id: "hold_029", name: "Red Hold #1", w: 10, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAALCAYAAABGbhwYAAAAqklEQVR4nGNgoCmoDOX+j0uOCcbos+D8nyUhyLA6XhmrYhYYg//3HwYpMyeGAE4OhqVPXv7/wMzKkL3rPSOGwo+sLAy3dmxnkODnYgj1t2BgYGBgEPh74n/03i+MKAo/QPgM5x9+YDBkuM3AwMDA8PLrX0yrm658Y/zEwf3fT5yB4cXHbwznXnxn+MDMzsDA8J2BgYGBAe4GGCgwEf3Px/4bovnoBwx56gEAwqsysPcYA6YAAAAASUVORK5CYII=" },
      { id: "hold_030", name: "Magenta Hold #5", w: 9, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAALCAYAAACtWacbAAAAnElEQVR4nGNgoBZgRObMM8r8D2MnnZsOl2OCMZptk/47/+RjSFC1YojhVGLIjUr+j6GI8f0bBlkpWQYGBgYGFi5OBrHHcDUMLDCGMLcww59v3xkYvn1nYGBgYOD++hdT0fef/xi+/v7K8Onnd4ZP/34zvGf5ianoogwbQ9/DGwyK7IIMT7l/MjQfXoHiKTjIs4n7n2cT9x+rJFUAAACPLxRV+B2vAAAAAElFTkSuQmCC" },
      { id: "hold_031", name: "Amber Hold #4", w: 11, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAJCAYAAADkZNYtAAAAiUlEQVR4nGNgoBVghDEmtLv/l+c4iCL57gcTQ3LlN7gaFrjM030MrkWacC4TJzvDt7fPGJ7e/vO/bt4vRgYGBgYmmOSnb4wMj+/fZ5g54zrDj29vGb69fcbw+uUn3G6qDOX+//ikyP/HJ0X+X9/L+78ylPs/sjwLMqd99VdGTt7f/xH8X4wMdAEApREza9gwQCcAAAAASUVORK5CYII=" },
      { id: "hold_032", name: "Navy Hold #8", w: 9, h: 11, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAALCAYAAACtWacbAAAAkElEQVR4nGNgoBZgROZwW+f9//UDIvT77ES4HAuMwWqc/59JUJlBxciCwVBLnmHtFIH/P480MqIoYmBgYJAxsmB4/+wJw3k065iQOQ+PbGQQlJJhYGBgYPj3/QOmIqa/XxhE9BwYeAUEGZ6cO8HA9PcLdodzOVX/Z+YSZ/jx/C6Kw1GskxPjYPj15CKKAuoCAGkmKmnqoNHvAAAAAElFTkSuQmCC" },
      { id: "hold_033", name: "Teal Hold #4", w: 11, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAJCAYAAADkZNYtAAAAf0lEQVR4nGNgoBVgROaI5Ob+Z+UTQFHwvLWZEUOxeGbRf+NIdwYGBgYGSSEeBgYGBoarl+4x3D98nuHl9D5GBgYGBha4rrcfGW6dvsTAwMDA8E5SgoGBgYHhzfMXxDvj96cPDG8mT8Z0Btw5sYn/GRgYGBh/MjG8WDUXQ542AAD1tSI5wlwh4gAAAABJRU5ErkJggg==" },
      { id: "hold_034", name: "Crimson Hold #4", w: 10, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAg0lEQVR4nGNgoClI4xX6H8Uj8B+bHAuMEcUj8D9NQolBXlqcgeHM0f9fGP4zbPrykREmzwRjfGH4z/Dlzw+Gw7duM0zzC2ZY5BfCgGw63MRNXz4yqjOy/rfkFWK4c/oibqsZGBgYnv7/w3D88zsGBgYGhg9/f6MoZGRAAzDr0N1IfQAAX84s0dNn4lUAAAAASUVORK5CYII=" },
      { id: "hold_035", name: "Red Hold #2", w: 10, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAkklEQVR4nGNgoAvos+D832fB+R9ZjAWZU2ct8F/g70+GnChrhv8fXzAwMNz9X3TiOyOKwjprgf8VtmIMDAwMDH+ePWJg5mZDsQWu8NNPVoYTl18ySAqwMUjwczEcufGK4QMzOwMDw3cGBgYGBkZkXQUmov+jdRkYPr/6xXDgAyND09EPKPIM6IoLTET/41RANQAAL6kqhUjMhpgAAAAASUVORK5CYII=" },
      { id: "hold_036", name: "Magenta Hold #6", w: 10, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAnklEQVR4nGNgoDZghDHmGWX+f8r9k+GhJhfDnFlTGNEVssAYoh++MiSoujIceniDgTc6/z8DAwND/9KJjBgKn/z7yfDx9l0GO1UNBrtXHxn+fPvO8Mst6v/UXcsYURTekfjHcPrjKwbJS58YGBgYGPiYWBmUv7JiupGBgYGh2CL0PwMDA4MAKy/Drw/fGJovr8BwKxzMM8r8T1QwUAwA53wwaSLrjZAAAAAASUVORK5CYII=" },
      { id: "hold_037", name: "Grey Hold #5", w: 9, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAKCAYAAABmBXS+AAAAcElEQVR4nGNgoBZgROaERcT+h7FXrVjMiKEoLCL2v7u7OwM3NzfDyZMnGZ4+fQpXyIRs0ounDxke3LnBYG5ujmIdXNHPHz8Z7j96zvCXiQ3DTXBFGzesYvz06SPDm9evGU6ePInfJ2ERsf+RPUBdAABdWiiZe77qqwAAAABJRU5ErkJggg==" },
      { id: "hold_038", name: "Green Hold #4", w: 9, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAgklEQVR4nGNgoBZghDH0S9X/s4owMTAwMDD8/vqH4WLTbbgcC4zBKsLE4GJrwcDAwMAgyS3NMI9h5X+YQrii31//MPByczOsWruTQVNLgeHny19w65hgjJ8vfzGs37GXQVpKhOHOwyfY3cTAwMCgkS7/n4GBgYHlFzvDlfm3UOSoAwAmsSHtpvACywAAAABJRU5ErkJggg==" },
      { id: "hold_039", name: "Navy Hold #9", w: 9, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAbklEQVR4nGNgoBZgROY4K0f9R+bvvbuMkYGBgYEFJuCi4v9fSVWfQUxYhEFAXIBh+4a1cMUsyDrfvnjM8PjhNQZxUQUU65hgjD13NjK+ePeQgYudl0FEGMVWVDfBrGVgYGD4/vsfw9GHmzHkKQMAxG0bpBm43LAAAAAASUVORK5CYII=" },
      { id: "hold_040", name: "Navy Hold #10", w: 10, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAJCAYAAAALpr0TAAAAfElEQVR4nGNgoCnw1Ir/by3v+x+bHAuM4aLi/9/L3YOBgYGBgW+n0H8GBgaG7dcWMmIoZGBgYNi2cwcDFzsvg7GRHQM7NxfD718f/u+5s5GRgYGBgQmmaM+djYyfvr5jYGBgYLh+9TzD3Rs3UKxmZEADyG48+nAzhjz1AAAywCFyd8FJ4wAAAABJRU5ErkJggg==" },
      { id: "hold_041", name: "Grey Hold #6", w: 8, h: 10, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAKCAYAAACJxx+AAAAATklEQVR4nGNgoCrwDwj77x8Q9h9ZjAlZ0s/fj8HP348BqwJ2DnaGFy9fMjx/+pgB2RQmZNVvXr/GsJYFxvj54yfD06dPGZ4+fUqaIykHAPd2HiKQaSS5AAAAAElFTkSuQmCC" },
      { id: "hold_042", name: "Teal Hold #5", w: 10, h: 9, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAJCAYAAAALpr0TAAAAgUlEQVR4nGNgoDZgROao9Hb///ruE8PvTx8YGBgYGN5MnsyIoVA8s+g/kxA3g1ekBwMDAwPDpZM3GR6ducLwcnofIwMDAwMTTOHL6X2M/959Zdhx4SjD1Uv3GF79+YDbagYGBgaJsOT/POYaDJ8vXGN4uXg+hjwKEMnN/U+sJ8kHAMnAKYuhBXymAAAAAElFTkSuQmCC" },
      { id: "hold_043", name: "Teal Hold #6", w: 9, h: 8, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAICAYAAAArzdW1AAAAWUlEQVR4nGNgoBZgROZIVtf+h7GftzbD5VhgDJHc3P9ekR4QBe++MPx7V/T/5fQ+RhRFDAwMDAd3HmNgYGBg+M3DjNs68cyi/39ZfjMwMDAwvJk8GUWOOgAAChoYYrzpZHUAAAAASUVORK5CYII=" },
    ],
    rare: [
      { id: "hold_056", name: "Yellow Hold #2", w: 22, h: 17, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAARCAYAAADZsVyDAAAB8klEQVR4nN2TP2gTYRjGf3dpobkzBlNaRZASSwwqgQqCUNFBlIL4B6l0EETQSdqhjl1KkELXDo4quDi5lNpB0Q6CQWgT05ZWQlxEWonhiEnuztQk9zm0fOZy579Rn+ne9x5+7/N+3x38a1L8munZoIgnYgBk3rzHKDhcuVPz9f4xOD0bFH39EXbtvih7xU9PWEqZfwX3GN+9DIkD0SgAaiCOqnTjCANV6Wbt7SMsS6Fsqnw2HG5N2D8d1NGetrV2mjls25D10WM35LNZmSPWhwDIfDjF+MQz1xAX2LIU4omoa/JXa4vnCzZfSnVujxo4zRwAWmiQ4ye3Pbr+lFePNXH62o8N1FbIYrbuWWlPz34GjgjOD3Wx9Hqe3Gqemm1gV1NyyOGBCwBMTl2SG3d4SD6KJ2LkVvMsZhuMDIdZXyntvCmh63l69+mUTZWzB19wtz3xzPSQGBkO+4JLxU0sy/+eLEshu1wDYHnthOxL94NpTUS6HM5dPkTNNigWKi5AsdCkZ2+AYqHpgRsFh/m5IPcXSpInj+LjRieR/i1g+8JssyETtcLblUnV2awEXFBXYoDR673i5tWqZ9VWlU2V9EpA1sl7Zd8z8jSTY2FxZtD9deTXd2q9k418g8mH3377B/oakmNhEdJsAKq29stk/4++A8zUwumEuwSEAAAAAElFTkSuQmCC" },
      { id: "hold_057", name: "Grey Hold #7", w: 25, h: 18, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAASCAYAAACuLnWgAAACGElEQVR4nN2UT08TQRjGf8U/2aa0lZAWNUFSoonZ1MoBQ4y1DX+S4bQmfgPiJ9KLX8Fw9ESPNaXGyAHBJpBggWKhtIJst1unTWA8kF26pAiiJ57TzGTmed73mWcGrgp8/4somZ5WAe0mAJnMew/v9X8lHx1LqeHYENs7NZ4lx7h2QwNQnUKXFkmmpxXA3TsRzJ8mAEetQ3p8bfS4ji3bKped83UVEcJQzrizmk47bNnmyegI5XIZAM2v8Tz1lL19k35/GMtqIGXT5fSICGEoza8xMTFOo9lEj+uq+K0IQCQaJRjsdfdaVoNEXGejVGbq5SS7lQrB4C2WvxaoVauewj0X9PrNWzWfz9OSLYwXBg3LwjT3OWodeg59r1aZmprEtm0CgQAAu5UK8/k8AMX1TRY+fXC53YEQhkqNp7k9MEAmkwFAv/+AvmgEgN5g0CV04IisrhYpFBYJhcJsbZbOTpct26wX1/lRqyGEAGD23ay7cebVDAAbayusbRzfhWOfZTUIhcIsflnydNDVLiEMNTh0z50PDsYAUC2bh4lHrCwt8/HzAppf85DIXxJbtnHS9EcROIlmZ5KkbDLyOAHA1mbpxC7ZBjiT3EHP6YVcds6Xy875NL+GHtfp7wsBUK+b1OvH78HpRMrmuQJdO+mEE+nyToXh2BAA2zs1pGx29f7CnXTitPcO/kYALvBBCmGovYODSwtcLfwGtJri2+jhGFwAAAAASUVORK5CYII=" },
      { id: "hold_058", name: "Navy Hold #12", w: 22, h: 17, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAARCAYAAADZsVyDAAABpklEQVR4nOWTwUvbUBjAf5E1YSkRURg7bO7QDCQHBW/qSVsGPbiO3eylp53G/qexw9hVvOrBQw8TmWM4FTbBWhliadolJOt7KbwdJLExrRM8DT94kOR97/f9vpf34F5Gya6oslNTg9+0uwDLTk2ZhsXCyjL7u9/4cfKFemNDA3hwPblYqCaVdSOHFBFbxx+163MAr9fWAPjdDTJFU+BioaqWXizjnwsAnHmbT+8/UHZqSoqI2dlFnHk7ybcsi8/be+TzD28GA/jnguczl4ujEN68eztyK/Z3j5h8NMXXnfpocLFQVRPjk3TcFr+aVwZt10wtEEGIkTdxL9oAHH7fAyAU/nBwr+8z9XgOGYacNU/RTRMZhjx5Op0kB8EfOm7rqjuvTSh8pIgAkh+X2Ypm4wAA07DAi43aKZOu56IbuUzrvX7aeCx+qDc2tEh2k7ZGjVcvVxNDKSKkiOj1/ZQtDDnHJbuilMoDDDWLQ4oI3cjhBW4GmjKOY/PnuqZpl+fSC9wMbNAy7nRY4RtvXsmuqJw+kbwPFhoFvBUYYOnZanLb/gX7v+MvRW7G0tGGLgsAAAAASUVORK5CYII=" },
      { id: "hold_059", name: "Blue Hold #2", w: 20, h: 15, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAPCAYAAADkmO9VAAABlklEQVR4nNWSwUobURSGv8mMXjPXxBhBg4IEFUQXEipSRITSRVd9i+ztA7jyFbrvztcQXCgKLnRpslA7EM1CjTPTG2fSCbeLNFeHGNftWR3O+c///+eeC/96WO815daO7kQWmWwBAEe3TE8df39z1hlG5n7e1VNrn1B3dRY/fkn1xroBJ5GlM9kC8dFeinhARVSqenz5A9PLG6jApzxXJLLzb4qGTy28g/2U25TDkfVvemb7KzI/AUBpvkw0ZINJKWh6PlrkUvVMP5FbOzqTLfD80BxC8UI0KQVeo4ez3RlEpaoHHHYii/zSNLaQ3F/XyE6VUIGPzE+gAp/SfBmAloppejdGYFTaRPb4oMPRMU3SDgFYWVs1ABX4AFyfn9L0bgzZsE2Mw0Qp3IU5urGiXvtpAN1Y9Ygbl7SvznAXNl7E7uo9V91fg4QAnadGr+imHzpph2xurnN6eGgwr0NYEfHf3JxbVKrakRKnOEvyeItTnAXgtwrN4IjMkTzeokUOKw7NZvHFD8OT+oevr9WPPvi93v8VfwBqGZYS/qwhHAAAAABJRU5ErkJggg==" },
      { id: "hold_060", name: "Magenta Hold #8", w: 23, h: 17, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAARCAYAAAA2cze9AAAB6ElEQVR4nOXSP2gTYRjH8e8l6ZXLhSaSGiiEatKCFiKIg1VoQIRO0g6CUJeKwaU4Ojulax0EZ7dSFFwKIk5CClqdpBB0CmrVGoxNzlzOu+TucbiS9kgT/DOJ73Q87/N++D0PB//1uXXuihxWj/wpuJybF4BkU2PBmWJyOiZLm/eVv8KL+YJc/KSSljiG12ZEHyJ+IceNSop01pUnkx3uPV1Vfgu/c/qaAFw3xyHu18a0UcKzJ8GwkarJpYmzvPy88evJi/mCHNv1mAsdB0DXdCJRDffqlN/wvkVnswJAo/Y18LYvfvvUghwJD/tJ1QMPpjN4aR2l7gDgvf6AaZn+dO03FLfWuns/FF/PLsrMUBZd01FSOuFMyofSOmJ0kISKUneQUgWp+vC2ZdBIqgGnBy/mCzJjjhNPjuLGQjB3AvfAvSRUWH+LVzW7iV9ZVUqRb9zdWOv/tzyYWJTZPRhAyWdgb3xJqISef8EtfwTowuXGDqVoPbCOgWvptCwiUQ0pVQJ1410Vw7YYGdYwbAvDa/PoaI2VFw97YIBucTk3LzfVMz5iW0HUa+9/Oy1MNYRtN3mWsvrCPcnLjR1/ZDUEQN1pUnNt9Ji236TB9vddamPqQDiQHGDp/GVpNH8M6gdgdevxQPTfPz8B4Na/ZWFE2bUAAAAASUVORK5CYII=" },
      { id: "hold_061", name: "Grey Hold #8", w: 22, h: 15, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAPCAYAAADgbT9oAAABhElEQVR4nNWTzy8DURDHPxKhbLfbSqqVcECi0jgrwXmDpJz8gy7ihBMnIRKOJNJI/Eq1p7eot9vVXQnrQJ+sXQlOzOm9me98533nzcB/s47PDtMsB4meBF7LY2dnKxL/FbFploO5uWk6Ors4OT4GwPd8ADY31n9URIFNsxzMzJYwjD6Sug7A4eERup4EoHJaUUnfURIhBhgrFBXg8uoKgFvLwnGa2LYklTKwhFCYODUh4uJEkUxa58V/JtOfJZfPA+C6LgCiXsf3n6gLoZQYPb3UhcC2Jetrq4qv83OlxoPzdhAWgGqLpmkMFwq4rsvQ6AhN5w2Xy+cZBy7Oz5CNctBuU4S4bbL1iKxWAUinswwO5mg6jiqU1HU0TVOK7u5lKD+W2HGakXutdo1tS2RDsrA4D6Be3RAWldNK6FNDTV9aXgkAuhPdwMeotW1yqsT+7h5GxiCVMpS/Vr2JTErsgrjeEwADA9kQoE1mCYHX8pQ/bvxi5/GdPPgqDnCwt/3rrfyb9gr6vaUE0xA2mgAAAABJRU5ErkJggg==" },
      { id: "hold_062", name: "Magenta Hold #9", w: 21, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAOCAYAAADABlfOAAABi0lEQVR4nNWSvS9DURyGn17V9qRNfURKEyJh8NGURCIqEYtNSLpYmQwMXQwmk1FE+AOwEGGREAkxSCzEJA3SRRhoUtX46O1tte4x4OrV1u6dTt73/J7z5pwD/0WWUsHY0LgMPOSwZx0FWaY8TdxmYeZ4ueh8UfOgbVJ2Cw+uRg8ASk3lz8BNglxKA2A/Guayv5bp1TkTpwC62Twqg3V+LB7npzHcUnjqTsRYXh0dsjLYwMLaosGy5u9d7pqQQdH0A/wFyJdSU4kef6K1vRf/1bU5+15MBUbkQMaNqqkkb2NFQfl6v7xDxlRUTQUg1DcqizZ12wVO8dmyLKmTS2nm1l/Kh51pMeqxcGHTjNyAZq2Cs+cYXs1BS7WX58c4AM6v0pFEFIB64QbgJaPxomcB2FXuWTrZNu7U9FBTgRHZmXRSldLpEF5Tu9N0lB6H2YvorxxbE8yGN/5+/ZAvKCsUB/6UzfCEBLvdxdNb0vDSQuHcpTJ/slXAKPn5Q76gLJUBxJU31sN7Jef/hz4AEmWEDd7FhmcAAAAASUVORK5CYII=" },
      { id: "hold_063", name: "Green Hold #6", w: 23, h: 16, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAQCAYAAAD9L+QYAAABkklEQVR4nOWSTS9jYRiGr9PDqWqrphpFaiqEMwxphJjNiI/MwmIWYzmZFf+hW2t+haWdH+APiAVBGB9J66MlNYOqHtP0TOY8FuWk4yBj7LiXz3vneq/3yQuvPrG4LrG4LuWzimdDp9pFC6v0vmunUChipPOSmDtWAFzPAffPdEpzV5Bvo18IekJkjRxSVO3z/zL/NP1Bcv4cH/t6iAZaAVhf33a4PgnePdEharPQMxwl5KnHq/lQzAoWt5YAMC+sf4ffGoqhADA4VDK9Mg28mo+DXJKd1ZTd31tLkZwv7dsBj8V1wWNR6S2NG98H+Nw2wvfjTYKeEA2BMMuJlb8EzAsLrdblsAawb4nFdZmYHCeTPaHhTZgr0+C08MMuui0vR+dH/DaEreVDOvvecrp/CYBW62J7IU1yPqXcC2/72iT6UBSAuoifs3TeYfhQMjtZNmZ3lbtzey03f1N8Ef+joPKk9zKYPy2HscO8/AVSVGkdaHKA3DVV5BO/UNx/AJCi+iD4Xnh5WsYi4qouVR6DvLxcA4zwl6jatUAkAAAAAElFTkSuQmCC" },
      { id: "hold_064", name: "Green Hold #7", w: 20, h: 16, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAQCAYAAAAWGF8bAAABnElEQVR4nN2SPU8bQRCGn7P8AdrT+QIGRXbCIQyyaTAhLlIlipLfEIkfQkvPT6BKSZca0VBDE4pEGJAtm7NPChzm/CXbJ+U2ReS1DltWWjLV7jv7PjOaHfhvo7C/IQv7G/KpHv0n815OxlIRNH3sz1srpFImw1++LB3WtJnA4sFmqPJLy+Bz4SM9vzvx9v2XLQAFDQGLB5tS0yWf3ryj2XcRYl7lXhur2O1qCDYqEPUTSlPAwl5O7hTXEWKehtvgbXaHnt9FxHUA7HZVAURcp9aqkAgEzv1dqIgCDtsDvpduyFsrZBYyISNAIhDK1On1cJseD3Wb27NHfny9VjNUB4DsblrmPlgYpo6xNAdAvz8E4PKnzbr1CoC297fT0kmdyjc7xAhdRtAX20mWkyaGqStzw3GJiSjLSZO7lod72qF6XJ/wT/xy+cjR8kZMsjbWGuUmmWwK3wvwvYDB1e+pMIDINLF0WNMeL1oKsLRo4nsBcTPC/YNHfzC5PjOBo04r505I872Abr1D+ciZ2h1MmeHTyO6m1ZLPAj2f+ANxBKeM0YcTmwAAAABJRU5ErkJggg==" },
      { id: "hold_065", name: "Yellow Hold #3", w: 16, h: 16, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABeElEQVR4nMWSvS9DYRTGf/3S9vp2E7FJfISFQUSERkLEJmIVg7AYLGIXEYnEwMKIiD9AxCAGq6GkaKivNh3EgFw06mq1t6+h7lvNrdmTvMk5532f5zzn5IX/hq1QcWfFIwBeNAOAiYVUwXcWgfVFRTTWQltnAwB2r5sr/wVnx2mqVAfD0wmLkCxsLvtEfU0gR3Y0kTFuAEjoGgCh4CsAPSO65DnNoMJ2QodvjIzQpLrT2UVGaJSUqQC0d2scHuznObCbwYtmcHm6lXdpimWEJuPe/jrmx4uExcH72w/px7aJhK7hUVSZ30ejxNOyb05gdLIaj6LKeQF297IzDw1m88+PJM+PRl4DuYz1RUUM9Cl4i93ysYl4PBuHI4LbcJKZpZR1iQ93ac7UBA31OWIhvOsKELM6AJgfLxItLXaaW10W4nUwxXnEzdxqLI9j/53MbnzZziNu9HhaHoAjv1GQbHFgYm6qXJQqOgAVlS4CoRLWtp/+/M7/i2+ZCo9L4nbhnwAAAABJRU5ErkJggg==" },
      { id: "hold_066", name: "Green Hold #8", w: 18, h: 16, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAQCAYAAAAbBi9cAAABa0lEQVR4nM2SP04CURCHv0WJYjZoRKNR19WY4CIFxr+lsbC29gScgNjbGWsLDmA8BBcwBgsKA8YQBRYCigZxdWWRPAvC6oIRqfTXvMy8mW9m3jz49wpFFkUosih6zev/aqwdBkQgqODxDACIxNGV1DNIC6tiUvWypmwAYG7VcI+5BEB8P9kVaIPq1ToyXuK5czTFz+rCCprip2zeIR0LASAMifrLO5gu2ru1DS2siuVtv30xNzvDo1lmaSqIZH2+QCwZo/TwhFVqkDi4tvMdHX3VbVYH4Oz+ArfcjJ8enWYnsAPAZTlBLWyJVDQjOUDp04LkGZTF7KYP74jc9D3kmPANkzzJsb4b5NbQyct5AFKZrKO4Y2uvTyYA1YpBvlBmfGiUt2cQtT6qFaMZVGkeVqnhmKBjG1pYFTPzk+3uDuk3RVpjAbjaA1LRjKTfFHuCfNtRSwt7UwJgPqR0hfwIage2lD4t/Pq3/60+ADX9ixhONf+PAAAAAElFTkSuQmCC" },
      { id: "hold_067", name: "Grey Hold #9", w: 19, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAOCAYAAADNGCeJAAABUUlEQVR4nNWRPU/CYBSFH5RYtJSGhdbwoQETDeLgov4DNjQM/kgndbKjCQxEE9EQI0bp4lDAxAC+oTVRHExfbUVnvdPNOec+ubkX/mpFwsLu3v7E748OD775fsYduwBY1rHMRMKhzVKJbCGPZVl4ric9JabIPpHQyaRSzCiz1GsNCYz6gXK5Mtna2aaQzyOEoFqtAnDf6WB37MBmG6V1DNMEoF5rSD1KqLqOQ1zTEEKgqiqmYWAaBqqqAkhdCIHT7QZmJUy4L9gdm0wqBUBc0+g6jtxACCGHbtvXvHmvXLRaAVjgZuVyZVIsFRmNnlnOpYlE56T32O+jzy8A8NDrAXDTvqN2ejL9AT4wu5QDQNPiUj87b7K2ugLAcDhg8DQIfHIqzAfqSZ1EQpda8/KK9KKJElOmgn6E+UAAPfkJ9FwPd+xOBf0KC0Ph40lfb/R/6h0Kc4IL4QCu8wAAAABJRU5ErkJggg==" },
      { id: "hold_068", name: "Teal Hold #8", w: 22, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAOCAYAAAArMezNAAABXElEQVR4nOWTv0tCURSAPzUx8QeW1lNQkQrSiDdE4B8QtLmGDW+QJgcX/59wcInWtqAtkCAiLJIMSkRL8aklWkbgbRDFp0VRS9DZ7jmXj++cey78y5CUmJCUmBjN6X4DdG/tCABrOMib1UD3+IJqOqUDmPqxZTwpfOurAMjhZbIn1xRH6t8GS/GkplXbkgeAzTWZwkN94r4G7EokhNHu+BBsmbXj8rhZnJsHIOBy4rXPAHCUy1E8vRyOQQOWlJiwBfyEZRmAVvsZOeAbggtq32o7GAQgo9YotZocnmVpVJvo6k+fG3caLfLFMgazkY1QaGg0AAdcTjJqjYJaJ18sA1C6vUPc3FPZ39UsguYgKTFhDfUfZCW0oDGoNJoAfTtTD/Gqp3N+1a+NQSfAA7je7x1Pa6LX6EC7qZnpl2AARyQqTA4z1XRK54hEh9swbbbQfekA8Hiw96s/8PfiHeKkdKwCJBx0AAAAAElFTkSuQmCC" },
      { id: "hold_069", name: "Purple Hold", w: 20, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAOCAYAAAAvxDzwAAABVElEQVR4nNWRPUvDUBSGn0qTaEugH1Qd/BisoOIi6KTgYAcL1YIu4qD+AP+Ui7s4uOgg6NTBSdvSCrYqWMQ0tuRi0uE6SEPTpuqo73bOPTznPfeFv65AdyM9ty8767O7o56ZttamdiXAxf2xOxPsHNheOJTrWxlenuqMjkV5Ny0cuyVVTfEHpjcxayaqpsj2Yhe4PLkh19YztARMz04AoOs6Owd7Hkil+Mz84gxGrcmbUefpsYpjt9x3FzikDFAqlKkbr0RjCWLDcQ8oHosiHIvISIRSvoptCfK3Nwi76X/yefkkIGVYqppC7fWB8Y85HCFQQyEcITBiCc+CQjHncdZWz4enklmpqBFCmu7pmw0DVVMIaTrCbgLQsAyuK6cehm+CqWRWShmmM4yl1RVyl1du7QfrC4SvkAAGgzrdKfeDfQv0c9uwDIC+sF8BO93+BPsf+gTTNIkLivwaBwAAAABJRU5ErkJggg==" },
      { id: "hold_070", name: "Navy Hold #13", w: 22, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAOCAYAAAArMezNAAABIUlEQVR4nOXQv0rDUBTH8W/RNjUxBfUBOnTL5lg6ZtAIoYM4pAh5AZ9L3Bxc1a06iIKLBrXQupXSEnOJpn/gOpSExoZWdBLPdg6/+7nnXviXVSvb0qw05Oxs9TdgjFWrJmH4QTQRstk5y/0Y3t8+kgAHroMQAoDm+XUq823YMlw5HvlIqSXg8+Mra+sFnh5e6PbaxNsuhS3DlaPhGAC77pBXp3MhBG9+SMvzpn3QnzubwGalIQtKnhgC2NvZBWCluAHAzdU9AFpRI4xCur02qqLjBwMuWse5TBhAVXRUBfTSFgC3d15qCxH0eR+KBAMIwk7qC+JKDSzDlV8Dsy+IJgLnsM7pyWXSZ6FzcK1sy5K2mZVLXbQIzIRjfKEMS9G/WZ+6un5/94y3VQAAAABJRU5ErkJggg==" },
      { id: "hold_071", name: "Crimson Hold #8", w: 16, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAOCAYAAAAmL5yKAAABGklEQVR4nM2QO0+EUBCFD4QgmwCLhMRXtXYWxsev0JjY2ZBsyz+w93dYGCtLC2Nia2O01s7CV2G0kIW7d3EfsGOhTLgBa51qvpM7c+cc4K9LaxJD26MlzWBOMcVhP258a1Rh3wloe30DsysdAMDj+SX8GRO2YaENnZoWKXA016Gdvd1fz706vcCxeMeZTHmOm8jxKZpfhmu2AABi/Nm4xDVbOHi+w4lMtJoFAHjNetzHozGeRhk2XY+1W/EBCWLWy0bSFC8DoSy77sforq4pWpJPFFYyiByfwmCR2TYsyHzI/JANcJOlAMBhKhZ+RNpyAraQFBP+VeQ53qhQQqxlUC5pQ8eCafHgffF9SXW4ZqFaoe1RlcvU/199Ach3cCbEjMUeAAAAAElFTkSuQmCC" },
      { id: "hold_072", name: "Yellow Hold #4", w: 17, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAOCAYAAADJ7fe0AAABWklEQVR4nM2SvUvDUBTFz0sLaT6sSmmRbopS/AccnBS6CkKRDCqIgwhODg4uroIO/gV+Tl0EQxEchG4ZhC4OglAFB0tVQml8iY1N+xzSPhJaimPPdN+75/3uufCAYREJHkq6xACg8hHB0hYl/Z8MgJweykzTpnmjeP8aMg6CRrvF93sTDcdETE4AABazUxAiGQDAW/kOJV1itu1z6lQIQTnEcnoHCcQHTs6sos1Mfm9Wi7i5VtlyrkoAQOg2qCfg6bGG2leFmz3PALUK8DwjBB1PppEZs3vXObpqECDG0vE61rZFbtDzn9A2E2i3ntEOpCy/MF737LC3u8GImYeWI0hNKJAUET+2G/JQ6uL8stkZHEjS1fHJRQccY5lZB/NzLlRVBKU+SFVFGA8tyHERQKN/kqD2VxQmjTSxkI1CUfz4t3oLAHBw9svf/utD7aynWHLUhWO5fIXh1B8U6XYCF3ng2QAAAABJRU5ErkJggg==" },
      { id: "hold_073", name: "Teal Hold #9", w: 18, h: 13, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAANCAYAAACkTj4ZAAABLElEQVR4nN2RPU8CQRCGn0MIARUxIEpAIn6VJPSa2FnRGhsL488g/AVbGxMLG2NrZ8JfsDDiFnbmQrwYbsllDySEWwvkcucZa+NUM+/MPnlnFv5FFJstXWy2dFCLfx8I1p7tAjCJjwFIZLIA1A/3qC/muLRdbV2cGyHQ2tGZLm9W2a2UkMmp1hEdaoWqD84spNnI5wBoCxFy6YN0bom5VAJHDajn1ylnlmmUtiNrmY7k/uER2e8xMrs/rKYkk+GYdxRtIdhaKUQgjhrwZktsS6LEM/27G2PWM4KDqyenunKwj+z30KOYrxtJz89d28F7NbGur0JvQ8f+aupYpQxAej6LEk8AzDT90sW6DUMijmaRbRzrVG0npHm2C0pGnPwKgukvBuuPoRu6yd+PTy+VbRc8EXKRAAAAAElFTkSuQmCC" },
      { id: "hold_074", name: "Navy Hold #14", w: 17, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAOCAYAAADJ7fe0AAABLklEQVR4nM2SsUvDQBSHv0raBkMGN0GhQwVLFztbnHSwgwgVxTq0rv5XurhrB5c6thadXFyqQ5IqAckpFxJsK8Sh5LS2Qt364Lj37ngfv/fjwUzGZvYoKmZ2ov/2aXFSytei9Y1tAPSGGV0/nSemhczFiQwEjm2zuLzA4XGVrZXdqJSvTaVKKdE1E0M3uGvdUyisUd4/AaDfGyhQKp3k6uFsTKH2s3gTrwDctm7I5nIA7B1UeXGeyawuDaGn39B4ZAX5+PTxpaeAjm2r29ANBiGE/UBB2+3LyUrCns982gTAc52Rt1glgC89Go8XaixlbNOqJ2QgeJfDE/Z8XGFRrlRwhYXT7eBLD6fbwRXWiCdjJhUzO5GumaTSyd9fyEDQtOpjPRN34a+FmwSYrfgCLxp+4KWT6P0AAAAASUVORK5CYII=" },
      { id: "hold_075", name: "Crimson Hold #9", w: 17, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAMCAYAAACEJVa/AAAA9klEQVR4nM2QsU7CUBSGvwuIgZRSGpkcnB3cHX0BBycTElcT3sLZR+ABfAIfwYSZwZiwtWkcqClwWyJi6XUgbXrifQD+7f/Pud8598CxSNnCx55vMlPgqEaVTdLE2gvQqpuR4xmA59s70bSYzemHH2ZNYYWqOuDp4gq9+xYAt90BYDB0WcaawdDlPQiYxBEv2UqJTTJMBcjybQV5XUTc+Gd8BstDEEPysxODGnUTbjThRouG8cO98G9fEdM0qbYQ34HDQa+7fbzmCf5pWzwup0/ThDWF/SalRo5nzlWLy26PVf4rajrPme+3YgsrpATZcuAf4Lj0B0meYBJKAHwYAAAAAElFTkSuQmCC" },
      { id: "hold_076", name: "Blue Hold #3", w: 17, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAOCAYAAADJ7fe0AAABQklEQVR4nM2SvUtCYRTGf9evC15v4FYSES3RFtyh4QpFSFtL/gENNUXo0Nbi1D/g7tjY1CbhlFEUqEupEBJIJFjmzY80r29DaF6uRW2e7T3wnPf3POfAxJaiR4SiR8R/NK7Rh1uLCnVpFY9PRciqaKWOpL8McYwSAPgDs2xurDC1oDGOSA7GhByMWfpDkmY6Lrm1qABIXeYJb4WoGTonkt8i2D084DpfIdcoi042IdnsAFRLBZyywmmyzvTcPOH9PVJnadZDOoMPAPpO3/hMHGaD91oNj2IAcH+V5K5pApC5ffgiNupUbs5xmA17JgCdbELqlnN0mybtSpFe643ttcUhYbVUoP38RL/9ysAKwNj03VpUeAMztr7Lq/JRvMDIHFt0P65Q0SNCyOr3YEWl9/JIMx23aX69A3l5x7KZUQuTWZ94J3fnYK2B/wAAAABJRU5ErkJggg==" },
      { id: "hold_077", name: "Orange Hold #5", w: 16, h: 13, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAANCAYAAACgu+4kAAABRUlEQVR4nMWSv0tCcRTFP0+fvtRMRUMcTAkKokGyRXBzClpaamppbusPcPAPiP6Bhv6FpKUhapCExIqGpiIT6hk8fP7+VX1b0jS1trrTvedyDodzL/x3Sd+B5JpTADzWJbaPi0P7HwUutqZFaCkESpvr9C1qsUPT4Wb94G6skNxt9pdNYtHrQpRU5GCYcCzIu2UC8XRPsqQJW0egeTxDYnL/0Cq3oNxCqaV7mNFmZmVzA0OjSfn8jJNVh4gdlXoihm5TMslc5nSUKaVHzuWL1J8rdDKnvD5ksfrsRCN+diMWMeRgJ92Q4lFFcFNgbtaO22Yl4HeRyxeZNL5BrQ6AWm0NZGDoHxIpXbrS2gBon4SA3zVAqLy0R4fY70Q3VoXXJrFgquBzmsmqDeZnLAAcFszsZb4yGHueeNQpRuGJlP7rb/xtfQA35HCpiFSY/wAAAABJRU5ErkJggg==" },
      { id: "hold_078", name: "Orange Hold #6", w: 16, h: 14, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAOCAYAAAAmL5yKAAABG0lEQVR4nGNgGGjASEjBVDfB/8j87F3vUfSw4NN8OlH0vwQPO4O4qgbD/48vGBgYGBgE/v7+H733C9wQDBesjlf+b8H3k0FcR4mBUViD4d/1YxgGL9lwkyH57G9GDBesjlf+728lDef/f3YPRePfr78YHj5+jyLGhMzxU+GEaHz1juH/q3cMqzeegGuEaT734jvcdhQXLHXm+Q/TDAOSHMwMf7/+YmBgYGDYe+MVw6NvjAzZSP5HccGPDz8x/GptIcvAwMDAsP70M4hmtBhAMeCfshXD1K13GV69+gB38t+vvxjefv3GcPMHC1bNDAxYYqHOWuC/OscfBjU5SHhsvvWboenoB5zpBatEnbXAf4G/Pxk+MLPj1Tw4AAB7THePBTPLSwAAAABJRU5ErkJggg==" },
      { id: "hold_079", name: "Green Hold #9", w: 15, h: 12, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAMCAYAAAC9QufkAAABA0lEQVR4nMWRPU7DQBCFP0cgZ5UliaLF4i9ai58khiKNEaLnBFyCE0RcAZ+Cg+QAFFAiGYUSicJQOLCrFICWIpIVJ67hdW/mzdPMG/gveMuF4ajv1lVt3pQOZzwertMVHcDaIrm4OXP1EI5CXdSsnUGCqzIohuMkctsnLQbdHu+zjFD0MOQoAcRUGtQWiRA+n9YCYMiRtAHQSrOlm8RJ5CqHv+w3r28ZG40GSgQAjNNxITyPTjnUewyudGFQrG2eLfI45OllghA+AJImd+k9O5sBHaH4yE3p5tINw1Hf7R50SoJsmgMQtNpk07yU/EqC+5dd5/k/8wzqcrnN4+2k8m1/i1/NVEix9g8GZwAAAABJRU5ErkJggg==" },
    ],
    epic: [
      { id: "hold_044", name: "Crimson Hold #5", w: 28, h: 31, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAfCAYAAAD0ma06AAAEfElEQVR4nN2W224TVxSGP9vjA+OZeOzENE5ssABFIQXU0nBSK0oRFz2IqKqqVkrv8wZ9jT5AH4CLqupFryq1glaAOKWIQpoALcTBCXZxScYz46kPY+9eTDyxa4ck9I4l+caz9v7Xvw7/2vCqm28rhyklJhR8WAjvPwUfFyx9y7P9TNrsw4yaEDH8nFITAORqNoV6lYOyiu40sBDie6u8Y9C+B2bUhJgeGuGxXUELBNGbDaKpQQBW8kX8qSQAN3OLO2bq7wc2HpJZrdXJDCfRmw0yw0kSwk/wmYEmBWkVSjsl5llPSmO9MRDIjELZQsuMEtFUJMNi9fEix04cx7pxY0ep7bp9Rk2Ids3UpAZAZjgJZYumUebOtVuuo2m6we0e4uPzHzGlxATbtC7AGH4S4RAAV3NPALi3/BT90RJmSeeNU8cw5+YJr62x/7NPvHPK1s3eHxBAkSIA7InswizpGI7D3YqBdvR1AJLpDOqhCQIP/2Dv2XeRKlXeP3t22yy90KYVTXw6sBu92QDcVOaLJbJjByiZa94B9dAE5tw8tXic+HunAfjzl8vYZZvf789t2bUeQ8W3QVYLBMkXNzqxUnhOQrjfzbl51EMTADz65juiN28z2BJkRnZvh+AGoCVafR3uzC+QGU5ilnSS6QzJdIaIbpKOKhzJZgEYGk2BaXLu/IdMK9oLU9tFv51WcLs0aNg0BmQAj3E0NUil8BwAI6lxJJultJxHPnOa0l9FpEqVK5d+5mtztW9qe4du3a7mnnDb0AkaNvliyVUcp8HC4jLR1CDSxAFSUoA7126RVOMAJF8bJr4vyzuTbzGjJvoy7QG8Zq4CbpcW6lUe2xVPcbJhmbeze5h9lCMdVVjJF7lft2kaZSKXrkAiztpv97gy+ysHj0/27dwe2l+qQ+KgrLJPjnZp6XW7zEk5hu40OJweIV8suaIAmCUdbf9eluMqAE7UHS2pUuWHixe7OrcHsHM8dKfhbQgtECRXszEchyPRAW98Os1YV6f/WqfI96T0gqX7vjWeoQWCZMMyqVCEBduVsmxY5osPpjww3XGDWrBNfqqscTO3CMDKUp6Vpbx3Z+cu3XQfdjL4fDjLXcPtzMuXfkQLBL1aR/0SD0SDM2GV2ZoFwOHJNwFYLf3N/NJSl/RtqgpfDabF0QHNPVirk6vZANyv24z4Q+yJ7OK6XcYSLcYCG3LYZt7emdCd0hfKUHs3Go7D01YdgPGQ7AFbosVkWMFwHB42q4z6JMq0PB+AQr3KA9GgvcI2TSlAUTSxahajPok2cBsMYDKsMFuzUHx+JsMKAKl1kKhf8oLstC33yrSiCQvB0cAu7wJLtDgXjfOk+k+P/9NWnfGQzOx6oCvC6RqLTZWmbRcs3Xdi/DAPm1VG/CHGQzJjgQi64zZVpeV0/U7KMQDGAhHKtLqWwrYYdtqMmhDtC6/bZUb8IQYkiUK92uWXCkV6avdSgOAqUdTvlr6zRpboZmOJVt/d+FKP2XZdFXxenTqH+0WPqpcCbFtbnP/PS/zVs38BY7URCPwsqAIAAAAASUVORK5CYII=" },
      { id: "hold_045", name: "Amber Hold #5", w: 29, h: 26, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAaCAYAAABLlle3AAAEC0lEQVR4nO2WbWgbdRjAf5eXNs2lr1kT6XDVNllmpGlhiFtphYkbgkiFIVY/dDqGoKAIwmAoQwQZOKgDFUFwRRRxDCnFNwaDhUGz4tZSU6jr2q62pXVpvLbp7q5Je5fzQ9ZLjzSsaj+Jz8f/8/zv97zfH/6XfyE93W1GT3ebUUwv7DSw9yOX0X7Yy6qSQZYzJBM6T7ykWjg7Bj139oRRnvqSjk4fLrcXmz0EwG/DPzCrVfLc0Tsma0egV79xG7V+O/XhfbD2kEWn3o0xGl9iaLqdt05dEgAcfxfw8TuHDI93nV2eYfOs1i9QH3ga1qy2WX0MgHCkGlG8ap4XhQ72lZmNoCgCKdmGpmjsi9wA4MGHGwBIqxIut7fgflYfs+gUZak4tKe7zTjQ/Cu1/oqCj6VVCbe3juxqxqyZu7yY2zAaXyIcgWRiBVHMN7MFeu7sCeNA84UtgTZ7KAdYA5u9OMgmeNG0GEvJeQCmJxcBGL6u5W02X6h3fM3N+Hrhh+5FtR3JGhJpVaJMLAVypQEIhp2mjSXSPQ0CoaYgaTV3EcDl9pLVx+4PLvkdaWYKgDKxlGuxFHX+fEqjl/ORmtDvP/cYbo9AWpXo+3aBjk4fgAmH2JasVSUDgCxnUGWNUFOQoYEJWprdTE2qpt3uui1qemsiw8HWHKij02fWYj6RK2CgMZcmVc57DPnOPvRUA0vJeYYGJghHqi2RRvs1Gh/3AneATcvhi3edxgYQKGiksZFxZm5v8lZ0sDCTocZrZ3pSp/2wg/mEnYOtleYKBLgZX8chOnj2VdlkmZEur8HeQKk5EhuyUctQE/gemEeWM8SupDnS6kFuFKj1VwASoaYgbs8UycSKxdmRkSynz8uWzWdCq6qdBBoFCzCtSqwqV8zabCyIGq+dGzGZRUkH0txdhqGBCaREFofoINAokEzo/NwrcObiWsGqNaGzc07Glsuovdc4o/H8BhkfXeeF448wNjJOtF/nWJePVSVjjkUysUIyobMo6cyNZKn0OBiKrXPm4vqWu91yeLLLZbxyLDdPqqwR7deoKsnP2Pg0vPjyo6jSvJnG2C86Pq+Nwbid/RGdwbidZKqUT79aKPozKVC8f7zE2B3Mj29LONc8w9c1fHtKqfPrKIqAKBoMjwoE63Npr/RkEUWDaL/G2x9uHWFRKMCp50UjEFqj5TEHiiIQvazxTEdudKL9+ZHZGyhlQcoSrAdRNPixT+f0+cIabgsK8NrRXUagMUVVtZMjT7qR5QwXem3sj+imza2JDFXVTmpcWW7/oVPibOOND678c+gG+M3XM9T6K7gWS7EgZfF5Leuany65APjsuz+3/SC4r+HJLpfhrsh1ablbteiqqp3Mzjl575PUjr+1/hvyF8iDq1IxD7tQAAAAAElFTkSuQmCC" },
      { id: "hold_046", name: "Green Hold #5", w: 32, h: 24, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAYAAACbU/80AAADBElEQVR4nOWWT28SWxjGf1CFO85AW6RVoQhppYI3uU3j/0TTmLioW3d+Aj9Bt+79CPcT3J2Ju8adW+/iqldN08YGlMFYBpiBmZ5OqxwXEw6dglHTduWzOy/veZ/n/XNeBn53RI4zeGF5RkZPRYjEv/L+n/pIrmMTsLg0J889mAbArFu4G95IESeOg7ywPCN716LqnM2kIZPmZPKkXPu7GhIRHbp9BOR/5MeInRkb+m12McPs/ZzcbzuyCiwuzcnT99I4CYfFUpF6Y4tiIQeA5wk6jR06tjt079AzMHs/J2NTUS7cOQtAsZAf8tmoVDFI0rFdthyb9ktHzcMvV2Bh5aJE66nz9aUSQvi0XYeb5ash36pVRdc1Jo1xmrUuyQkDgJY/qMR3BVx5XJYRY9Au6QbFOptPhrKM93RMYXKzfBU9ZhDZPUFFrON5AoBPlTaAIj+IkQIWHhVl+c8c2VQWP+qpYEL4pNMTIXKAUm5e2Vxs5R+cOwCqBQC97UFiQzOwsHJR5i5PMGmMK1s2lQUgoevKpseCjKrOJgUtEFAR6wAhAQD1xhYGSQD+ffo2tA++2wJNiyOEj6bFefPhHZmpaRK6roj7SGvTvLVeoevaEHmnsQPApDHOnht6fQohAaWHeXl9eZ6UlqYlLDQtDkBmKthoVas6Msh/axvcuvwX8Z6OJWwAmrXuwMGGXbtHY7vF13Z49YQExM/EAGgJCyF8VYkfoZQ/j+cJLGErYrNugQjI/M4Oe509pD9GZbUWarsScOVxWUIwaNlUFlOYAKS0tGrBfvSfXs/uZ9RVO1/6wRbcP2yV1dF/RqEK3L19g5awVPmF8DFbZoi839dgoqOsPauFAu42DWrP1396wSkBe94XXr9e4/RMgrbrAMHwtF0HTZtGCJ9mrcuWYzMhk2y+qKssD5b1VxC6uPCoKMuXCkNO/fdr1i26b3aU/bDkcKAF/uddrFOdkY6Npo3zf/DEDku6H0OB5h5kpDGTCNm677ePJNufEgCDT6k+Np98PNZPt98b3wAIMVXp5Inq7wAAAABJRU5ErkJggg==" },
      { id: "hold_047", name: "Magenta Hold #7", w: 28, h: 20, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAUCAYAAACeXl35AAADO0lEQVR4nO2U32tbZRjHPyentD3Nr9qWmjaZWztHXZt2K5S5ogMv3NAO20KVSRF3MRCKsptd+Aco3tkLb7z0TqYyEAZlQ5TBBi6sQ5fGzhW7ZjZLgp78OKc5edMkJ68XJ4TWZoPJvBG/V+flfd7v5/0+h/eB/7qUf8P0k/0zcqIjyLrIsBD/ahej5WnDPg5Py4XWcdyam1cY4LdATX5685sG9KklPD8yKwEuMMS+/n0AGBkdgMXKr3y0clGBxyS8cPwteaTgxioIeLaDhcgXTS93fmRWHrbamOIAiZKBz69Re/0gtUsx/N09GBkdzRSN+qbAzw+ckefUCVr6NKpFQSqvs3j0rATI2dsA9G9JutU2KMFscBRLWIQA7zsv4kpY1Hb4CZ/2aODi0bPynDvsLLr8KB4XwbkwH1yKAXAvm8IsFxnuCjTOqMNBPHoezxtDkC9TjWzQEgpQTaQBHp/wkCnB7XxXE2nU4SCYVVxzYeT1DV7ofR51oBd74w8AXD2d2KsPnf26hyUsfD6Vlg4NhLXLfxfw64PvytODxzAyOm7NodqrD1EJIu/kUU4MIDtbqeXLEB5CyZdRIjquuXpHLt8jEo0yOfMq1cgGVh3WtKXvn5qXJ/VB6PLjLgp2SolnUQF5N4cS9DrJEhZyq+zs382x9P0VxrQ+jo2NNWAJYfKTmsWQpb3AvmSBVZGG5TShdj9mrcJIaJDqDrh5e43vfrjPmzPTGNdirBppsrIIwGtHjgOQXHuAWasQ39YRCiy3m3z2y7fKHmB3QWPyUBgjo+PZ30siGuXH+zFC7X4SaQOAqJ0DYPPqLeetGWlOz06zefUWybUHTo1IsWIbxHwVAL5cWWo+aTIewWZyk77OHtRCjcnBMLbHxZU7N1mxHeAzSjvvnZzBvL1GtSiYnHgJ41qMJStO0uv4GloJ3VXZA9oDzHnaiPyZ4nC2Atl6C8tFhAIfnjrD6o1lRsbGwbS5XI4zLrow0+tE7RzXvVuPBPxdu4rmR6fkiS2v86Dr6mz1ALAuMuRkiUB3Pz9vp9Bd5aYteyIgOKMqUJCNtfBpGLVS48e//dzLEuDi7zf+0Rxuemh+dKpBfNIE/+sv0elkWg2aS9kAAAAASUVORK5CYII=" },
      { id: "hold_048", name: "Crimson Hold #6", w: 24, h: 21, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAVCAYAAABc6S4mAAACG0lEQVR4nN2VPW/TUBSGn6TOt5MYp6hREypRVUBRAakMlUDq2o0fgITY8hNYWBDs+QEMDAydkJBAVVWJtYKBdkBMgBBtRZuKKjipE/Lh+DIEX3JjJ5AR3uUe33Pu+/p8+Br+dYQmCS6lTeHZWcLUcHl8Wh3Lof2JtJwrirrjkNE0ljMGALoWJ3t9uR+w8UwAI4XGqpdzRbFq5kkUZuTe9NKCLy5Wtbn38jm2cFm3LYVzpEA5VxRrV65RmM1zujir+I6fbko7E00AcOZsBoD7O6+VbAIFnsycFyuLl5leWuDk/Se5/21vzxdbbXekPZfqizw8+sgLuxaCgB48yObFfDJFNF/gYGsb22kB/boP43OzgTEVkc/7jTpWr6vEhIcPzcUTFFZuUNvZleQA59Zu+gSuZnIAmLEoZizqI4ehEnl1//H1WCH/G+zWLQwtwptmjYroyRL5MgDGkq+fHAaSA1hOPwOPXBEopU2xauYDG+lB1+I8unvHR153HAAMLUJF9BR/YAajYDstDra2A8kBXjW+K28PA1NkC5f9Rh3oN20Y3jh667tfsR7etm3fR6YIAHIKrGaX+WRKmfEv7SaGFsFyuhx1WqTCv49+6LUCyWFoikppU1yKJgEkmYfBUgzi0O2MvfB8jtu6IQAuTMVpuA6psCbXSckDBQaF9FCYiuhxMRShhqv4gy62iQQ83NKz8h+gE8JG+Cbl/8ZPXTPnn9R1NOwAAAAASUVORK5CYII=" },
      { id: "hold_049", name: "Crimson Hold #7", w: 24, h: 22, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAVCAYAAABc6S4mAAACN0lEQVR4nN2UQW8SQRiGH5YF08J2t7AKljZpU9OEgxViTO3FmBgPjYleDSdP/Qfc+wv6Azx4s570YGL05sl4MGnUxNS2CRaNbQO0sLCsFHYZD8imlC2hNV58b7PzzfPOvDvfwD+W728WLysRAWCKNgBrZqWPJ58HnAlrIuGTSY4qhC5Hqe8doPkDmAjx0jR6TM58gqyii6VUGqdq4J9KsPPhI1Pxi9SKFQDe1Eo8rh26XOks8BU1LpZSaVDD6AspMEymb6QIVK1T1wwVUVbRBcCt+auMJ2cYSc7SKhiMJ6G8WwQgciFIzqpzc1RlXzhuVAMNsoouDNo8ur5AMZ+nrYYZSc668+XdItKX7YGb8zRYjU4KTQ6g+QPut+jD+wQuqbQKBvZBaSi4p8GT2IyYnrtCzB+kOZegvPGN9uI1gIHwnFUH4Hvj1+kGq9FJkX5wl4ngCAUlhD7qR5+KUbEcpPefADDy+b6bcXjU9IT3GWhyAOftOqVEDAnYDgcBGNv8gWk33LpXpX0WlYg73jmyqNp2HxyO9cGyEhEZfcKz6KSS9+7w7sVrdo4617Nq29TbHYNN0eJ4s52rk58+ew7AXrNBSJJZdzrRhPFxspOHNujm/Lle7dktTqsP6mnQfbC8lLPqVOyWO/4pOgaDwF31FKyocXE7onvCuz9xy2l4vpqnqSeiLafB/J8oACpOiw2rRkiSzwXvOwF0btOEFGRMlvnatFCR3EjOCvc06CoT1oSJAIbL+v/Vb+ZU+rYY+R+tAAAAAElFTkSuQmCC" },
      { id: "hold_050", name: "Orange Hold #3", w: 23, h: 20, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAUCAYAAABmvqYOAAACIklEQVR4nNWUP2gTURzHP9ckpvmjuQTSpCeUEK1SrAmKYiQUSgpuOnXr2GwuDo6SwcVNXNxcM7m4OFhQiygUmyhUUWsgoGhMrtRcSNPG/PF1SHPNcUltwKVfOLjfu+/7fd6993s/OKqS+g2m59xifNQCwLh8DICp9EZf71DJPy/4xakrUUSlCEC71gBg5UOJd1cXuX3n/qEhBmN6zi3mZ0MGgzV0sQMpF6h9yfH+m0biaeVQAGtvcOK41WRolwtIShjJEcathIlllknX2+KjT3Dvce1AiP7x4TWvSM6c7G/yBJGUMCM7df46RmlmltmsbZPLVwGo2SSuP9FMIH2pcrs5cAWiUuw8niAWFOznYgTKBQKT+550dUUsPN8yAMz7cIBEpUhr76AlTxAAi1cBYH42RF1bF4vZpg4YKjnAWr5EVW0Qj3XiLgwgEpEhu6HHI90XzWJjKftDL71eqaqGqmp6/KveNgHX8iUAUtNOYVr5zaWylIrL4rSrjNtnN0wubv0BYGwMIuEAkbARPEimE07FZXHZvx8HvTaiF6K8frYKQOx8gM3atgHaq6ra0O9B3zpNxWX916g0CCh2bpx16UOvPmmcmXCY5n39vsN63crdN9rg5CbYtFPIbkHAZdEvWtBrMyV+KWw8elHWcw7VjLqQmSm3Yfztzxa531YeZIzNbehOd+uSXwBM+lpMOAWre5XX3Yr/omTCK5IJr/i38yhqFxZzxETHvHbsAAAAAElFTkSuQmCC" },
      { id: "hold_051", name: "Blue Hold #1", w: 23, h: 19, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAATCAYAAAB7u5a2AAACKElEQVR4nNWUwU4TURSGv7HaAaZTGJEItWCjICIBqcRgrCSNmrAx+gCwMOmeF3DhygfQnQvjigdwbwgmENw0JRJTS1hJpZCmwc50Op1Sc1114Ja2Civ9V/ec/Oc/595z7oH/FUozpxZbFELVUVwLe+1NU87f4Hyjo+vhC6Ffm8YIhenTfSRB1Gwbd+PdqZNI4uqDl8LX1YsRChO9dZXsTpahRwvYZpGcLyAOk69PleBco8MYHgNg9fMXOoN9LMxN0j8UYWD2CVpsUZypcnUqIfw9vQDYZpH+oQjff+zxwXZ5NjMIM4O8BYSqC4Dy8qs/3sIjqFMJ4Q/fxhgeo1qyAPAHdLRgN3qPwd2blzkwHQCWP65hpVckoWaNl978V3kfp2AA4FM1qiXLS7T51QRg7v44PI6xGtCpliz8Ab0eLhoTeEYwOi+eP53lfbKKX/Ph5He5NBmXKolcuQjAxPgIANs7PwFIpzNUSxaF1CeON10SrxkROvtCkqA2cMM7129RH9OJ8REOTIdC0SWdzuAU9jA3V7yx9Z7FTC0p6lRC0CBu57Yku5LN4OyHsK9Pk7e+HRUR7MYp7Elcec6VCu1QK1vci8fZ2M5h57awc23psriZWlJU0SECo3ckkpPfBeCCprO+nkRxLTrCo9TKlsQ7tGX7xCdqrL6SzZwIFqruJTwOxbWkNdF2cdUD6udWUFyLZvun5S8LRucFHGt0C6hKBTO1dObN+W/iN7TV3EQUyUHGAAAAAElFTkSuQmCC" },
      { id: "hold_052", name: "Yellow Hold #1", w: 24, h: 20, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAUCAYAAACXtf2DAAACNElEQVR4nNWUP2gTYRjGf5dEm38qtpEWRaHaWqu2aFCpJbo46KCDFBcXB110cnARHByEgEJUKOggFkS7xGArOEUsWMigDYSCkVBjwEKxxrN45L5cyCWfU66Nl5Q2Wx/44N67557nfb/v/V7Y6FBa/XEsEpIBfwpTNwHI6je4dSdi02vJYCLWJZ1qgTMX+qkWSzg8bcxMfWEuXebqvXKd5roNJmJdsr2kERzqsX0zhEp6donTl4Wl61iP+Mdxr2wvaRwc3I7LNWyt//H46YisPbvWIvzmoVvu2asAkkNHr1CVakNeUS8RHOph7vlb611Tg7FISA7uS+L1u9jRuRW3twPAEm9mMvX+e11sM3j04JoM7hrH50vSN9ALgMPZZxNyKB2YZsKKDaHi8bWxs1MnEd8MlBsbnNr/iv4Th6kWS82Ko1rJUF0RG0Ilv6ghCibTcZNwtGw/5LFISCYnPbJvoHdVcYBnka8YQsUQKvO5HPlFjfxihXeTFW6O1repVUHAn2qaebWSqYvPXnTj9nawlF8AIPGpwsyMlyex37a2twyysyVODi9Yh9kMhlDZ3d3NfC6HKJi8fukgHBUKiIb8hl1Uy6wRfv3UgT9Mx000oRCOFle9rJaBJhSm4yoHBjX8/jYbMZetZajwIbGJu6OrC9dQR7o+EpDH+v9y5PhyYbq+TPmcKvMtu63hXq/JoGayxVfg/LnlKTKXLpP54QTg/gtjXfOrKfn2JZ9cGYejesujfWPjH/bO3EpCksbAAAAAAElFTkSuQmCC" },
      { id: "hold_053", name: "Orange Hold #4", w: 21, h: 20, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAUCAYAAABiS3YzAAAByUlEQVR4nNWUz2rUUBSHvzSd2HZSbAfagKJIFtaCqCiI0IU7oYjgvm5cFXHnA1SYJ+jGBxDfwF2FFlQEYdw5UGvLQEcpmUgnY+dmxiSN14VOxvQm0S57IHDPPb/z8bv/AicltOOInz66J2833+CXhm0H3UOW1kWKcyzo5tKMtC9ZaLMVpNsm9kP2/R4vt3wev/IS1uj/wD5WJ+RFzU5g0m0DoJcNZssG57+IlL4QurY8KSvhGHPWPAQGBNm6a+dMVi6HslrvabnQAezq9flkTjtjI/caitZ1O5ixXux04+5peWvaQi8b6BMX+Dk+VrQYAIQe50NrD2fkFdtK8tjbAy8f5rqdzPmRwWBteVKaYboovzup78Xz1wrAEQHbjS5TplSdhi0d+4alNBW5FO0Ax4+o7UZU6/3kSo0UNR6NB/fnUkBhQLOnMTh1xWlRxP5wX/b9Ho4IMAHHi9hulxR9Aj3oHirFowfhiOFF3fEjajshq/WO8ioTaMuPaXxqYVZOZUJScC9i/WspE5iCPnnf1wC5+CcXRiaPz80+Wz9GWf3wLfe/oRSe3ZmWADfPprf77aago/9eRfVdtsNc6CBWFqbk3/m/QCczfgGrMb/RspE6AAAAAABJRU5ErkJggg==" },
      { id: "hold_054", name: "Navy Hold #11", w: 25, h: 19, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAATCAYAAABlcqYFAAACA0lEQVR4nO2UQWsTURDHf7tpst1Ns24MDcE0VCGaVjwYa0G0WOhNEBSvxZM3EfsB+in0rje/gkcPguIlVgypNG0R6TbtQd1kN1uTTZPnIWTttkmJ1pM4l33Mmze/NzP/t/DfBlji+l1x2Cf9jcTRG48FgNeQkFUDxd3AXnnh5x45KUBbWBZaegqARCKFu1NGjmRRxKhofngmAcgnAfQqCClRzuWvEdVPkczNAtAJjflxf1SJnl8U+/GzaOkprszNk80YALx6Z2FVTLzqNnK7/vsQPb8o2loCocTYB67eusdEZoK4rgJQLK1jVUzcXZOOVaHXqr6Q8MySrw5ZNXz/7UcPMbdMAFR9nJuXkgCUtmqsrH7h6+e17hlpD2nvWyBnQF3awrKYnLtDzIjjVC3yFycBiOsqlv3D//Z8xdI6nz6u4lW3iRhpOp5Nq/w2oKwAJDyzJPTsBZK5WVy7xvR0LnAby20C4FQtAFy7Rm2zQMt1UMfPAFBfex9o0xGIcvmBGM2cJ2KkURMpvLpDZCx2OJ7aZgGAES24Z2+UaRWe9H13R2bSsCw6no0c0XGdnX5nuD+f5/nL14SjXVDLdQJqGlgJ/JImEEhw0MLRGC3X8fcBhFk8MoeBEOi2rbcOnU4NvB1A+/suQN85HAsZBiY1u9W5b54O9e8bKuggUJEax7bm37afwGS8BrcCdYsAAAAASUVORK5CYII=" },
      { id: "hold_055", name: "Teal Hold #7", w: 26, h: 17, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAARCAYAAADDjbwNAAACKElEQVR4nO2Uz0uTcRzHXzrN1tZ8fsye6abkWsEkQooKy1BWZB3mwYOsw5A1OnTYpf8jLx6iQ0QEEV2Dbp2CQhklIi7IfmASmjqX7NnjGPPbYTxPzWePUXSK3sfv9/t5v/i8eT8P/NcvFBhPi8B4Wuw+b/mbgG1DR6jteLuDBEiLlSf3msz7JqdBfyYjXIUiVcnL+tSU4zuAwaErYlEL1gyPdrGT1zkY6aQ4/RYT1txoUIonhHS4h1M3EkQGzqAlU7YoRiauCfPtu74+hNoOQCjcy6WxEZunLTotmRK9V2NUjQpyGVxuLx1jo8yAACgXDABmD3QixRNCHTgNgD67gKe/j4Ais1UsIUsq64buDAKoGhUA3q995WI0ytynz3ijxynpBfz9PvT8Fh7Fh7c7iKLJACgj57l88gTPczkAlrLztIW6LM+67P2ZjBiIxVgzihbM5W5l4uw5ns3NAbBmFAE40nEIgMFwxJp/MP2SqlFhKTsPwOqdSXsZtGRK9AxfAGCzsIEsqbjcrVSNCsd6gpbh8tamZRzyyXWQxVcztKyWEG07rD68X7fED9DNW6JZ8dhi9Cg+AGRJ5frwEN37amnfzb4GYCW/icvdyscXbygvf6Hw9HHDhtYdasmUwCvTCBgK9wIQUGpbLOQ+UNIL7OR1mja+EQtJPJq87fgZ2C6keMKq8n63x6rtbrgJ2DZ0xy32BDmBf24QsGdMfwQyZf5iTP0O5N/UdzDYxIb4smrgAAAAAElFTkSuQmCC" },
    ],
  },
};

/* Merges the built-in GEAR_CATALOG with anything the user has added
   themselves via the in-app item manager (data.customItems). Custom
   items are plain, already-transparent images — no processing needed,
   they just slot into the same slot+rarity buckets as built-in items. */
const CATALOG_SLOTS = ["shoes", "chalk", "harness", "trainingTool", "wall"];
const RARITY_KEYS = ["common", "rare", "epic", "legendary"];

/* Flattens the built-in GEAR_CATALOG into a plain list for browsing —
   rollLoot uses the nested structure directly, but the Items page wants
   a single filterable list across everything that exists. */
const allBuiltInItems = () => {
  const out = [];
  CATALOG_SLOTS.forEach((slot) => {
    RARITY_KEYS.forEach((r) => {
      (GEAR_CATALOG[slot]?.[r] || []).forEach((it) => {
        out.push({ ...it, slot, rarity: r, source: "built-in" });
      });
    });
  });
  (GEAR_CATALOG.wallPrefabs?.legendary || []).forEach((it) => {
    out.push({ ...it, slot: "wallPrefab", rarity: "legendary", source: "built-in" });
  });
  return out;
};

const getEffectiveCatalog = (data) => {
  const effective = {};
  CATALOG_SLOTS.forEach((slot) => {
    effective[slot] = {};
    RARITY_KEYS.forEach((r) => {
      effective[slot][r] = [...(GEAR_CATALOG[slot]?.[r] || [])];
    });
  });
  effective.wallPrefabs = { legendary: [...(GEAR_CATALOG.wallPrefabs?.legendary || [])] };

  (data?.customItems || []).forEach((it) => {
    const bucket = it.slot === "wallPrefab" ? effective.wallPrefabs : effective[it.slot];
    if (!bucket || !bucket[it.rarity]) return;
    bucket[it.rarity].push({ id: it.id, name: it.name, image: it.image, w: it.w, h: it.h });
  });
  return effective;
};

const rollLoot = (tierKey = "standard", data) => {
  const catalog = getEffectiveCatalog(data);
  const tier = CHEST_TIERS[tierKey] || CHEST_TIERS.standard;
  const total = tier.weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  let rarity = tier.weights[0][0];
  for (const [name, w] of tier.weights) {
    if (r < w) {
      rarity = name;
      break;
    }
    r -= w;
  }
  const slot = LOOT_SLOTS[Math.floor(Math.random() * LOOT_SLOTS.length)];

  // Wall + legendary: give a boulder prefab if one exists (real legendary
  // drop, placed as a whole unit). If none exist yet, clamp to epic like
  // regular holds do — never leave a dead token with no real art.
  let isPrefab = false;
  let effectiveRarity = rarity;
  let candidates = null;
  if (slot === "wall" && rarity === "legendary") {
    const prefabs = catalog.wallPrefabs?.legendary;
    if (prefabs && prefabs.length) {
      isPrefab = true;
      effectiveRarity = "legendary";
      candidates = prefabs;
    } else {
      effectiveRarity = "epic";
    }
  }
  if (!candidates) candidates = catalog[slot]?.[effectiveRarity];

  const catalogItem = candidates && candidates.length
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : null;

  return {
    id: uid(),
    tier: tierKey,
    rarity: effectiveRarity,
    slot,
    isPrefab,
    date: today(),
    ...(catalogItem
      ? { itemId: catalogItem.id, name: catalogItem.name, image: catalogItem.image, w: catalogItem.w, h: catalogItem.h }
      : {}),
  };
};

/* ---------------------------- TITLES ------------------------------- */
/* Each title is derived live from data (entries/sessions), not stored
   as an "unlocked" flag — so there's nothing to desync or migrate.
   Adding a new title later is just adding an entry to this array. */

const overallLevel = (data, bw) =>
  SCALE_ORDER.reduce((sum, k) => {
    const sc = SCALES[k];
    const best = bestFor(data.entries, sc, bw);
    return sum + (best ? tierIndex(sc, sc.metric(best, bw)) : 0);
  }, 0) + 1;

const weekKeyOf = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-${week}`;
};

const weeksLogged = (sessions) => {
  const weeks = new Set();
  sessions.forEach((s) => weeks.add(weekKeyOf(s.date)));
  return weeks.size;
};

const weekEntries = (entries, wk) => entries.filter((e) => weekKeyOf(e.date) === wk);
const weekSessions = (sessions, wk) => sessions.filter((s) => weekKeyOf(s.date) === wk);

const reachesGrade = (scale, entries, bw, gradeName) => {
  const idx = scale.tiers.findIndex((t) => t.name === gradeName);
  if (idx < 0) return false;
  if (scale.splitByHand) {
    const r = bestForHand(entries, scale, bw, "R");
    const l = bestForHand(entries, scale, bw, "L");
    const tiR = r ? tierIndex(scale, scale.metric(r, bw)) : -1;
    const tiL = l ? tierIndex(scale, scale.metric(l, bw)) : -1;
    return Math.max(tiR, tiL) >= idx;
  }
  const best = bestFor(entries, scale, bw);
  if (!best) return false;
  return tierIndex(scale, scale.metric(best, bw)) >= idx;
};

const TITLES = [
  {
    id: "first_chalk",
    name: "FIRST CHALK",
    desc: "Log your first benchmark entry.",
    rarity: "common",
    check: (d) => d.entries.length >= 1,
  },
  {
    id: "all_rounder",
    name: "ALL-ROUNDER",
    desc: "Log at least one entry in all four benchmarks.",
    rarity: "rare",
    check: (d) => SCALE_ORDER.every((k) => d.entries.some((e) => e.scale === k)),
  },
  {
    id: "structural",
    name: "STRUCTURAL",
    desc: "Reach V8 or higher on two-arm max.",
    rarity: "rare",
    check: (d, bw) => reachesGrade(SCALES.twoArm, d.entries, bw, "V8"),
  },
  {
    id: "one_arm_operator",
    name: "ONE-ARM OPERATOR",
    desc: "Reach V8+ one-arm max on either hand.",
    rarity: "rare",
    check: (d, bw) => reachesGrade(SCALES.oneArm, d.entries, bw, "V8"),
  },
  {
    id: "vice_grip",
    name: "VICE GRIP",
    desc: "Reach V8+ pinch on either hand.",
    rarity: "rare",
    check: (d, bw) => reachesGrade(SCALES.pinch, d.entries, bw, "V8"),
  },
  {
    id: "engine",
    name: "ENGINE",
    desc: "Reach 7a+ on the repeater ladder.",
    rarity: "rare",
    check: (d, bw) => reachesGrade(SCALES.repeaters, d.entries, bw, "7a"),
  },
  {
    id: "eleven_eleven",
    name: "ELEVEN ELEVEN",
    desc: "Hit V11 in any strength benchmark.",
    rarity: "epic",
    check: (d, bw) =>
      ["twoArm", "oneArm", "pinch"].some((k) => reachesGrade(SCALES[k], d.entries, bw, "V11")),
  },
  {
    id: "ambidextrous",
    name: "AMBIDEXTROUS",
    desc: "Right and left within 5% of each other on a split benchmark.",
    rarity: "rare",
    check: (d, bw) =>
      ["oneArm", "pinch"].some((k) => {
        const sc = SCALES[k];
        const r = bestForHand(d.entries, sc, bw, "R");
        const l = bestForHand(d.entries, sc, bw, "L");
        if (!r || !l) return false;
        const mr = sc.metric(r, bw);
        const ml = sc.metric(l, bw);
        return Math.abs(mr - ml) / Math.max(mr, ml) <= 0.05;
      }),
  },
  {
    id: "rest_respecter",
    name: "RECOVERY MINDED",
    desc: "Log a REST session.",
    rarity: "common",
    check: (d) => d.sessions.some((s) => s.type === "REST"),
  },
  {
    id: "grinder",
    name: "GRINDER",
    desc: "Log 5 training sessions.",
    rarity: "common",
    check: (d) => d.sessions.length >= 5,
  },
  {
    id: "workhorse",
    name: "WORKHORSE",
    desc: "Log 15 training sessions.",
    rarity: "rare",
    check: (d) => d.sessions.length >= 15,
  },
  {
    id: "consistent",
    name: "CONSISTENT",
    desc: "Log a session in 4 different calendar weeks.",
    rarity: "epic",
    check: (d) => weeksLogged(d.sessions) >= 4,
  },
  {
    id: "apprentice",
    name: "APPRENTICE",
    desc: "Reach Level 10.",
    rarity: "common",
    check: (d, bw) => overallLevel(d, bw) >= 10,
  },
  {
    id: "journeyman",
    name: "JOURNEYMAN",
    desc: "Reach Level 25.",
    rarity: "rare",
    check: (d, bw) => overallLevel(d, bw) >= 25,
  },
  {
    id: "elite",
    name: "ELITE",
    desc: "Reach Level 35.",
    rarity: "epic",
    check: (d, bw) => overallLevel(d, bw) >= 35,
  },
  {
    id: "ceiling_breaker",
    name: "CEILING BREAKER",
    desc: "Max out any single benchmark ladder.",
    rarity: "legendary",
    check: (d, bw) =>
      SCALE_ORDER.some((k) => {
        const sc = SCALES[k];
        const best = bestFor(d.entries, sc, bw);
        return best && tierIndex(sc, sc.metric(best, bw)) === sc.tiers.length - 1;
      }),
  },
  {
    id: "collector",
    name: "COLLECTOR",
    desc: "Own 10 unlocked items total.",
    rarity: "common",
    check: (d) => (d.loot || []).length >= 10,
  },
  {
    id: "hoarder",
    name: "HOARDER",
    desc: "Own 25 unlocked items total.",
    rarity: "rare",
    check: (d) => (d.loot || []).length >= 25,
  },
  {
    id: "full_loadout",
    name: "FULL LOADOUT",
    desc: "Own at least one real item in every gear slot.",
    rarity: "rare",
    check: (d) =>
      GEAR_SLOTS.every((s) => (d.loot || []).some((i) => i.slot === s.key && i.image)),
  },
  {
    id: "legendary_owner",
    name: "LEGENDARY OWNER",
    desc: "Own at least one legendary item.",
    rarity: "epic",
    check: (d) => (d.loot || []).some((i) => i.rarity === "legendary"),
  },
  {
    id: "curator",
    name: "CURATOR",
    desc: "Add a custom item to the catalog yourself.",
    rarity: "rare",
    check: (d) => (d.customItems || []).length >= 1,
  },
  {
    id: "first_hold",
    name: "FIRST HOLD",
    desc: "Place your first hold on the spray wall.",
    rarity: "common",
    check: (d) => (d.wallHolds || []).length >= 1,
  },
  {
    id: "wall_builder",
    name: "WALL BUILDER",
    desc: "Place 25 holds on the spray wall.",
    rarity: "rare",
    check: (d) => (d.wallHolds || []).length >= 25,
  },
  {
    id: "full_send_wall",
    name: "FULL SEND WALL",
    desc: "Place 40 holds on the spray wall.",
    rarity: "epic",
    check: (d) => (d.wallHolds || []).length >= 40,
  },
  {
    id: "boulder_problem",
    name: "BOULDER PROBLEM",
    desc: "Place a whole boulder prefab on the wall.",
    rarity: "epic",
    check: (d) => {
      const wallHolds = d.wallHolds || [];
      const loot = d.loot || [];
      return wallHolds.some((w) => loot.find((i) => i.id === w.lootItemId)?.isPrefab);
    },
  },
];

/* -------------------------- TRAINING XP ----------------------------- */
/* Separate from Rank Level (which reflects your best-ever benchmarks).
   Training Level reflects activity — logging sessions and benchmarks,
   hitting new ranks, and training consistently across weeks. Fully
   derived from data.entries/data.sessions, same as titles — nothing
   stored, nothing to desync.

   Anti-exploit: logging is capped per calendar day, so spamming fake
   entries/sessions in one sitting doesn't inflate XP past the cap.
   Rank-up bonuses can only fire once per genuinely new best per scale
   (and per hand, for split scales) — you can't re-earn them by logging
   the same number twice. */

const ACTION_XP = 12; // per session or benchmark entry logged
const DAILY_ACTIVITY_XP_CAP = 30; // per calendar day, across sessions+entries combined
const RANK_UP_XP = 60; // per new best tier reached on any ladder
const CONSISTENCY_XP_PER_WEEK = 30; // per distinct calendar week with >=1 session
const TRAINING_LEVEL_MAX = 30;

const trainingLevelThreshold = (n) => (n <= 1 ? 0 : Math.round(22 * Math.pow(n, 1.35)));

const trainingLevelFromXP = (xp) => {
  let lvl = 1;
  for (let n = 2; n <= TRAINING_LEVEL_MAX; n++) {
    if (xp >= trainingLevelThreshold(n)) lvl = n;
    else break;
  }
  return lvl;
};

/* Walk a scale's entries in date order; count/award each time the
   running best tier actually increases. A fatigued/lower reading never
   claws back XP already earned — matches how "best" works everywhere
   else in the app. Returns both the event count (used to earn Rank
   Chests) and the XP total (used in the Training XP breakdown). */
const rankUpEventsForSeries = (entries, scale, bw) => {
  const sorted = entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  let bestTier = -1;
  let count = 0;
  sorted.forEach((e) => {
    const t = tierIndex(scale, scale.metric(e, bw));
    if (t > bestTier) {
      count += 1;
      bestTier = t;
    }
  });
  return count;
};

/* Total rank-up events across every scale (and both hands, for split
   scales) — this is exactly what already drives rank-up XP, reused
   here as the earn-rate for Rank Chests. */
const totalRankUpEvents = (data, bw) => {
  let count = 0;
  SCALE_ORDER.forEach((k) => {
    const scale = SCALES[k];
    if (scale.splitByHand) {
      ["R", "L"].forEach((hand) => {
        count += rankUpEventsForSeries(
          data.entries.filter((e) => e.scale === k && e.hand === hand),
          scale,
          bw
        );
      });
    } else {
      count += rankUpEventsForSeries(data.entries.filter((e) => e.scale === k), scale, bw);
    }
  });
  return count;
};

/* How many of your weekly quest draws had all 5 quests completed —
   this is the earn-rate bonus feeding Standard Chests, on top of
   Training Level ups. */
const fullyCompletedQuestWeeks = (data, bw) => {
  const records = data.quests || [];
  let count = 0;
  records.forEach((rec) => {
    const defs = rec.questIds.map((id) => QUEST_POOL.find((q) => q.id === id)).filter(Boolean);
    if (defs.length > 0 && defs.every((q) => q.check(data, bw, rec.weekKey))) count += 1;
  });
  return count;
};

const trainingXPBreakdown = (data, bw) => {
  const byDate = {};
  data.sessions.forEach((s) => {
    byDate[s.date] = (byDate[s.date] || 0) + 1;
  });
  data.entries.forEach((e) => {
    byDate[e.date] = (byDate[e.date] || 0) + 1;
  });
  let activity = 0;
  Object.values(byDate).forEach((count) => {
    activity += Math.min(count * ACTION_XP, DAILY_ACTIVITY_XP_CAP);
  });

  const rankUps = totalRankUpEvents(data, bw) * RANK_UP_XP;

  const weeks = weeksLogged(data.sessions);
  const consistency = weeks * CONSISTENCY_XP_PER_WEEK;

  const quests = questXPEarned(data, bw);

  return { activity, rankUps, consistency, quests, total: activity + rankUps + consistency + quests };
};

/* --------------------------- WEEKLY QUESTS -------------------------- */
/* 5 quests drawn per calendar week. Timing within the week is free —
   no rest-day conflicts to worry about. Completion is checked live
   against that week's real logged data (same "nothing stored as a
   flag" approach as titles) — only WHICH 5 quests got offered needs
   to be persisted, since that draw is random and has to stay stable
   once assigned.

   "gym" quests stay locked until profile.gymAccess is turned on —
   right now only hangboard/weighted training exists, so the pool is
   home-only by default. */

const QUEST_POOL = [
  { id: "q_onearm", text: "Log a one-arm max attempt, either hand", context: "home", xp: 25,
    check: (d, bw, wk) => weekEntries(d.entries, wk).some((e) => e.scale === "oneArm") },
  { id: "q_twoarm", text: "Log a two-arm max attempt", context: "home", xp: 25,
    check: (d, bw, wk) => weekEntries(d.entries, wk).some((e) => e.scale === "twoArm") },
  { id: "q_pinch", text: "Log a pinch block attempt", context: "home", xp: 25,
    check: (d, bw, wk) => weekEntries(d.entries, wk).some((e) => e.scale === "pinch") },
  { id: "q_repeaters", text: "Run a repeater benchmark or training set", context: "home", xp: 25,
    check: (d, bw, wk) =>
      weekEntries(d.entries, wk).some((e) => e.scale === "repeaters") ||
      weekSessions(d.sessions, wk).some((s) => s.type === "REPEATERS") },
  { id: "q_three_sessions", text: "Log 3 training sessions this week", context: "home", xp: 35,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).length >= 3 },
  { id: "q_fresh", text: "Log a session with readiness 8 or higher", context: "home", xp: 20,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).some((s) => Number(s.readiness) >= 8) },
  { id: "q_rest", text: "Log a REST session — recovery counts", context: "home", xp: 20,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).some((s) => s.type === "REST") },
  { id: "q_three_benchmarks", text: "Log entries across 3 different benchmark types", context: "home", xp: 35,
    check: (d, bw, wk) => new Set(weekEntries(d.entries, wk).map((e) => e.scale)).size >= 3 },
  { id: "q_two_types", text: "Do a MAX HANGS session and a REPEATERS session on different days", context: "home", xp: 30,
    check: (d, bw, wk) => {
      const s = weekSessions(d.sessions, wk);
      const hangDates = new Set(s.filter((x) => x.type === "MAX HANGS").map((x) => x.date));
      const repDates = new Set(s.filter((x) => x.type === "REPEATERS").map((x) => x.date));
      return [...hangDates].some((dt) => !repDates.has(dt)) && hangDates.size > 0 && repDates.size > 0;
    } },
  { id: "q_note", text: "Write a real note on a session (15+ characters)", context: "home", xp: 15,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).some((s) => (s.note || "").trim().length >= 15) },
  { id: "q_both_hands", text: "Log both a right-hand and left-hand entry this week", context: "home", xp: 25,
    check: (d, bw, wk) => {
      const we = weekEntries(d.entries, wk);
      return we.some((e) => e.hand === "R") && we.some((e) => e.hand === "L");
    } },
  { id: "q_pinch_session", text: "Log a PINCH BLOCK training session", context: "home", xp: 20,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).some((s) => s.type === "PINCH BLOCK") },
  { id: "q_bw_pr", text: "Set a new all-time best on any benchmark this week", context: "home", xp: 40,
    check: (d, bw, wk) => {
      const we = weekEntries(d.entries, wk);
      return SCALE_ORDER.some((k) => {
        const scale = SCALES[k];
        const hands = scale.splitByHand ? ["R", "L"] : [""];
        return hands.some((hand) => {
          const priorEntries = d.entries.filter(
            (e) => e.scale === k && (!scale.splitByHand || e.hand === hand) && weekKeyOf(e.date) < wk
          );
          const priorBestTier = priorEntries.length
            ? Math.max(...priorEntries.map((e) => tierIndex(scale, scale.metric(e, bw))))
            : -1;
          return we.some(
            (e) =>
              e.scale === k &&
              (!scale.splitByHand || e.hand === hand) &&
              tierIndex(scale, scale.metric(e, bw)) > priorBestTier
          );
        });
      });
    } },
  { id: "q_readiness_log", text: "Log readiness on every session this week", context: "home", xp: 20,
    check: (d, bw, wk) => {
      const s = weekSessions(d.sessions, wk);
      return s.length > 0 && s.every((x) => x.readiness != null && x.readiness !== "");
    } },
  { id: "g_climb", text: "Log a CLIMBING session", context: "gym", xp: 30,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).some((s) => s.type === "CLIMBING") },
  { id: "g_board", text: "Log a BOARD / SPRAY session", context: "gym", xp: 30,
    check: (d, bw, wk) => weekSessions(d.sessions, wk).some((s) => s.type === "BOARD / SPRAY") },
  { id: "g_two_gym", text: "Log 2 gym sessions (climbing or board) this week", context: "gym", xp: 40,
    check: (d, bw, wk) =>
      weekSessions(d.sessions, wk).filter((s) => s.type === "CLIMBING" || s.type === "BOARD / SPRAY").length >= 2 },
  { id: "g_note", text: "Log a detailed note (15+ chars) on a gym session", context: "gym", xp: 20,
    check: (d, bw, wk) =>
      weekSessions(d.sessions, wk).some(
        (s) => (s.type === "CLIMBING" || s.type === "BOARD / SPRAY") && (s.note || "").trim().length >= 15
      ) },
  { id: "g_both", text: "Log both a CLIMBING and a BOARD/SPRAY session this week", context: "gym", xp: 35,
    check: (d, bw, wk) => {
      const s = weekSessions(d.sessions, wk);
      return s.some((x) => x.type === "CLIMBING") && s.some((x) => x.type === "BOARD / SPRAY");
    } },
];

const QUEST_XP_PER_WEEK_CAP = 5; // matches "5 quests per week" — safety ceiling if pool ever changes

/* Deterministically-random draw of 5 quests for a given week, respecting
   gym-lock. Uses the week key as a seed so re-generating (e.g. after a
   reload before persistence lands) produces the same draw. */
const drawWeeklyQuests = (weekKey, gymAccess) => {
  const pool = QUEST_POOL.filter((q) => q.context === "home" || (q.context === "gym" && gymAccess));
  // simple seeded shuffle so the same week always draws the same set
  let hash = [...weekKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
  const shuffled = pool
    .map((q) => ({ q, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.q);
  return shuffled.slice(0, Math.min(QUEST_XP_PER_WEEK_CAP, shuffled.length)).map((q) => q.id);
};

/* Sum of XP from every quest ever completed, across every week a draw
   exists for — evaluated against that week's real data, not a stored
   completion flag. */
const questXPEarned = (data, bw) => {
  const records = data.quests || [];
  let total = 0;
  records.forEach((rec) => {
    rec.questIds.forEach((id) => {
      const q = QUEST_POOL.find((x) => x.id === id);
      if (q && q.check(data, bw, rec.weekKey)) total += q.xp;
    });
  });
  return total;
};

/* --------------------------- SEED DATA ---------------------------- */

// Starter items shown off across slots/rarities — restorable via the Reset
// Items button in Profile, so a catalog art swap never leaves you stuck
// with stale baked-in images and no way to get fresh ones yourself.
const defaultLoot = () => [
  { id: "rental1", rarity: "common", slot: "shoes", date: "2026-07-16", itemId: "rental", name: "Rental Shoe", image: GEAR_CATALOG.shoes.common[0].image },
  { id: "wallhold1", rarity: "common", slot: "wall", date: "2026-07-16", itemId: "hold_000", name: GEAR_CATALOG.wall.common[0].name, w: GEAR_CATALOG.wall.common[0].w, h: GEAR_CATALOG.wall.common[0].h, image: GEAR_CATALOG.wall.common[0].image },
];

const seed = () => ({
  profile: {
    bodyweight: 64,
    name: "CLIMBER",
    equippedTitleId: null,
    // No gym access right now — quest pool stays home-only until this
    // is flipped on. Toggle lives on the Profile tab.
    gymAccess: false,
  },
  entries: [
    { id: "s1", scale: "twoArm", date: "2026-07-07", added: 35, hand: "", note: "Near limit, could go slightly higher" },
    { id: "s2", scale: "oneArm", date: "2026-07-07", assist: 8, hand: "R", note: "Peak, brief hold" },
    { id: "s3", scale: "oneArm", date: "2026-07-07", assist: 13, hand: "L", note: "" },
    { id: "s4", scale: "pinch", date: "2026-07-07", load: 25, hand: "R", note: "Fresh, felt like more in the tank" },
    { id: "s5", scale: "repeaters", date: "2026-07-14", reps: 11.5, hand: "", note: "First real baseline. Readiness 7/10, post-comp" },
    { id: "s6", scale: "oneArm", date: "2026-07-14", assist: 13, hand: "R", note: "Fatigued — post-comp, not a true max" },
  ],
  sessions: [
    {
      id: "l1",
      date: "2026-07-14",
      type: "REPEATERS",
      sets: 3,
      reps: 6,
      load: "bodyweight",
      readiness: 7,
      note: "After benchmark. Forearms cooked, tendons fine.",
    },
  ],
  quests: [], // weekly quest draws: [{ weekKey, questIds: [...5] }]
  loot: defaultLoot(), // opened chest items: [{ id, rarity, slot, date, itemId?, name?, image? }]
  wallHolds: [], // placed holds: [{ id, lootItemId, x, y }] — x/y are 0-1 fractions of the wall image
  customItems: [], // user-added catalog items: [{ id, slot, rarity, name, image, w, h }]
  equippedItems: {}, // manual gear-rack picks: { shoes: lootItemId, chalk: ..., harness: ..., trainingTool: ... } — falls back to highest-rarity owned if a slot has no entry
});

/* --------------------------- HELPERS ------------------------------ */

const tierIndex = (scale, m) => {
  let i = 0;
  scale.tiers.forEach((t, idx) => {
    if (m >= t.min) i = idx;
  });
  return i;
};

const latestFor = (entries, scaleKey) => {
  const rows = entries
    .filter((e) => e.scale === scaleKey)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows[0] || null;
};

/* Best (highest metric) entry — used for the tier badge, so a fatigued
   day doesn't demote you. */
const bestFor = (entries, scale, bw) => {
  const rows = entries.filter((e) => e.scale === scale.key);
  if (!rows.length) return null;
  return rows.reduce((a, b) =>
    scale.metric(b, bw) > scale.metric(a, bw) ? b : a
  );
};

/* Same, but scoped to a single hand — for scales tracked per-arm (one-arm max). */
const bestForHand = (entries, scale, bw, hand) => {
  const rows = entries.filter((e) => e.scale === scale.key && e.hand === hand);
  if (!rows.length) return null;
  return rows.reduce((a, b) =>
    scale.metric(b, bw) > scale.metric(a, bw) ? b : a
  );
};

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------- PIXEL PRIMITIVES ----------------------- */

const Panel = ({ children, style = {}, accent }) => (
  <div
    className="cq-panel"
    style={{
      background: C.panel,
      borderTop: `3px solid ${C.panelHi}`,
      borderLeft: `3px solid ${C.panelHi}`,
      borderRight: `3px solid ${C.bgDeep}`,
      borderBottom: `3px solid ${C.bgDeep}`,
      boxShadow: accent ? `0 0 0 2px ${accent}` : "none",
      ...style,
    }}
  >
    {children}
  </div>
);

const XPBar = ({ pct, color, segments = 20 }) => {
  const filled = Math.round((Math.max(0, Math.min(1, pct)) * segments));
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 12,
            background: i < filled ? color : C.bgDeep,
            boxShadow:
              i < filled ? `inset 0 -3px 0 rgba(0,0,0,0.35)` : "none",
          }}
        />
      ))}
    </div>
  );
};

const Btn = ({ children, onClick, color = C.magenta, small, disabled, full }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="cq-btn"
    style={{
      fontFamily: "'Press Start 2P', monospace",
      fontSize: small ? 8 : 10,
      lineHeight: 1.6,
      padding: small ? "8px 10px" : "12px 14px",
      background: disabled ? C.panelHi : color,
      color: disabled ? C.boneDim : C.bgDeep,
      border: "none",
      borderTop: `3px solid rgba(255,255,255,0.35)`,
      borderLeft: `3px solid rgba(255,255,255,0.35)`,
      borderRight: `3px solid rgba(0,0,0,0.45)`,
      borderBottom: `3px solid rgba(0,0,0,0.45)`,
      cursor: disabled ? "not-allowed" : "pointer",
      width: full ? "100%" : "auto",
      textTransform: "uppercase",
    }}
  >
    {children}
  </button>
);

const Field = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 10 }}>
    <div
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 7,
        color: C.boneDim,
        marginBottom: 6,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
    {children}
  </label>
);

const inputStyle = {
  width: "100%",
  background: C.bgDeep,
  color: C.bone,
  border: `2px solid ${C.panelHi}`,
  borderRadius: 0,
  padding: "10px 8px",
  fontFamily: "'VT323', monospace",
  fontSize: 20,
  outline: "none",
};

/* ============================== APP =============================== */

export default function CrimpQuest() {
  const [tab, setTab] = useState("stats");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  /* -------- load -------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        setData(res ? JSON.parse(res.value) : seed());
      } catch {
        setData(seed());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Accepts either a plain object or an updater function (prevData) =>
     nextData — the functional form always resolves against the latest
     committed state, which matters for anything that appends to an
     array (entries, sessions, loot, quests). Without this, two rapid
     calls in the same tick (a real risk on a touchscreen double-tap)
     both read the same stale array and the second overwrites the
     first instead of stacking. */
  const persist = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      window.storage.set(STORAGE_KEY, JSON.stringify(next)).then(
        () => setErr(null),
        () => setErr("SAVE FAILED — data kept in this session only")
      );
      return next;
    });
  }, []);

  /* -------- weekly quest draw — lives here (not in ProfileTab) so it
     fires on load regardless of which tab is open, and Training Level
     in the header is correct from the first render. -------- */
  useEffect(() => {
    if (!data) return;
    const wk = weekKeyOf(today());
    const records = data.quests || [];
    if (!records.some((r) => r.weekKey === wk)) {
      const questIds = drawWeeklyQuests(wk, !!data.profile.gymAccess);
      persist((prev) => ({ ...prev, quests: [...(prev.quests || []), { weekKey: wk, questIds }] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data && (data.quests || []).some((r) => r.weekKey === weekKeyOf(today()))]);

  const bw = data?.profile?.bodyweight || 64;

  /* -------- rank level (best-ever benchmarks) -------- */
  const level = data ? overallLevel(data, bw) : 1;

  /* -------- training level (activity — separate system) -------- */
  const xpInfo = data ? trainingXPBreakdown(data, bw) : { total: 0 };
  const trainingXP = xpInfo.total;
  const trainingLevel = trainingLevelFromXP(trainingXP);
  const thisThresh = trainingLevelThreshold(trainingLevel);
  const nextThresh =
    trainingLevel < TRAINING_LEVEL_MAX ? trainingLevelThreshold(trainingLevel + 1) : thisThresh;
  const trainingPct =
    trainingLevel >= TRAINING_LEVEL_MAX
      ? 1
      : (trainingXP - thisThresh) / (nextThresh - thisThresh);

  const equippedTitle =
    data && data.profile.equippedTitleId
      ? TITLES.find((t) => t.id === data.profile.equippedTitleId && t.check(data, bw))
      : null;

  const maxLevel =
    SCALE_ORDER.reduce((s, k) => s + SCALES[k].tiers.length - 1, 0) + 1;

  if (loading) {
    return (
      <Shell>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            color: C.gold,
            fontSize: 12,
            textAlign: "center",
            padding: 60,
          }}
        >
          LOADING<span className="cq-blink">_</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* ---------------- HEADER ---------------- */}
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 20,
            lineHeight: 1.4,
            color: C.bone,
            margin: 0,
            textShadow: `3px 3px 0 ${C.magenta}, 6px 6px 0 ${C.bgDeep}`,
            letterSpacing: 1,
          }}
        >
          CRIMP
          <br />
          QUEST
        </h1>
        <div
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 18,
            color: C.boneDim,
            marginTop: 10,
          }}
        >
          finger training log · 15mm · half-crimp
        </div>
      </div>

      <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.gold}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 12,
              color: C.gold,
            }}
          >
            RANK LVL {level}
          </span>
          <span
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 18,
              color: C.boneDim,
            }}
          >
            {bw} kg bodyweight
          </span>
        </div>
        <XPBar pct={(level - 1) / (maxLevel - 1)} color={C.gold} segments={16} />
        <div
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 16,
            color: C.boneDim,
            marginTop: 8,
          }}
        >
          Rank Level = sum of your best-ever ranks across all four benchmarks. Max {maxLevel}.
        </div>
        {equippedTitle && (
          <div
            style={{
              marginTop: 10,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 9,
              color: C.bgDeep,
              background: RARITY[equippedTitle.rarity].color,
              display: "inline-block",
              padding: "6px 8px",
            }}
          >
            {equippedTitle.name}
          </div>
        )}
      </Panel>

      <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.magenta}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 12,
              color: C.magenta,
            }}
          >
            TRAINING LVL {trainingLevel}
          </span>
          <span
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 18,
              color: C.boneDim,
            }}
          >
            {trainingXP} XP
          </span>
        </div>
        <XPBar pct={trainingPct} color={C.magenta} segments={16} />
        <div
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 16,
            color: C.boneDim,
            marginTop: 8,
          }}
        >
          {trainingLevel >= TRAINING_LEVEL_MAX
            ? "Max training level reached."
            : `${nextThresh - trainingXP} XP to Training Lvl ${trainingLevel + 1}.`}{" "}
          From logging sessions, hitting new ranks, and training consistency — separate from Rank Level.
        </div>
      </Panel>

      {err && (
        <div
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 17,
            color: C.red,
            background: C.bgDeep,
            border: `2px solid ${C.red}`,
            padding: 10,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          onClick={() => setTab("items")}
          title="Settings"
          style={{
            background: C.panel,
            border: `2px solid ${C.panelHi}`,
            color: C.boneDim,
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 12,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          ⚙
        </button>
      </div>

      {tab === "items" ? (
        <ItemsPage data={data} persist={persist} onBack={() => setTab("profile")} />
      ) : (
        <>
      {/* ---------------- TABS ---------------- */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {[
          ["profile", "PROFILE"],
          ["stats", "STATS"],
          ["wall", "WALL"],
          ["timer", "TIMER"],
          ["log", "LOG"],
          ["charts", "CHART"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              padding: "12px 2px",
              background: tab === id ? C.magenta : C.panel,
              color: tab === id ? C.bgDeep : C.boneDim,
              border: "none",
              borderTop: `3px solid ${tab === id ? "rgba(255,255,255,0.35)" : C.panelHi}`,
              borderLeft: `3px solid ${tab === id ? "rgba(255,255,255,0.35)" : C.panelHi}`,
              borderRight: `3px solid ${C.bgDeep}`,
              borderBottom: `3px solid ${C.bgDeep}`,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <ProfileTab data={data} bw={bw} persist={persist} />
      )}
      {tab === "stats" && (
        <StatsTab data={data} bw={bw} persist={persist} />
      )}
      {tab === "wall" && <WallTab data={data} persist={persist} />}
      {tab === "timer" && <TimerTab />}
      {tab === "log" && <LogTab data={data} persist={persist} />}
      {tab === "charts" && <ChartsTab data={data} bw={bw} />}
        </>
      )}

      <div
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 15,
          color: C.boneDim,
          marginTop: 24,
          borderTop: `2px solid ${C.panel}`,
          paddingTop: 12,
          lineHeight: 1.5,
        }}
      >
        Ranks marked YOUR OWN SCALE are invented for motivation — they're not
        population data. The V-grade ladder is derived from a third-party
        reconstruction of Lattice's chart, converted with your assumed 0.90
        edge coefficient. Treat all of it as a training signal, not a ranking.
      </div>
    </Shell>
  );
}

/* --------------------------- SHELL -------------------------------- */

function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        padding: "20px 14px 40px",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        .cq-blink { animation: cqblink 1s steps(2) infinite; }
        @keyframes cqblink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        .cq-btn:active { transform: translate(2px,2px); }
        .cq-scan {
          position: fixed; inset: 0; pointer-events: none; z-index: 50;
          background: repeating-linear-gradient(
            0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px,
            transparent 1px, transparent 3px);
        }
        input, select, textarea { border-radius: 0 !important; }
        @media (prefers-reduced-motion: reduce) {
          .cq-blink { animation: none; }
        }
      `}</style>
      <div className="cq-scan" />
      <div style={{ maxWidth: 560, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/* -------------------------- PLAYER SPRITE -------------------------- */
/* Placeholder pixel figure. Deliberately isolated and prop-driven so
   the future cosmetics system can layer base/top/shoes/chalkbag on
   top of this without touching anything else in the app. */

const GEAR_SLOTS = [
  { key: "shoes", label: "CLIMBING SHOES" },
  { key: "chalk", label: "CHALK BAG" },
  { key: "harness", label: "HARNESS" },
  { key: "trainingTool", label: "TRAINING TOOL" },
];

function GearRack({ name, lootItems, equippedItems }) {
  return (
    <Panel style={{ padding: 16, marginBottom: 14 }}>
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
          color: C.boneDim,
          marginBottom: 4,
          textAlign: "center",
        }}
      >
        GEAR RACK
      </div>
      <div
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 18,
          color: C.bone,
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        {name || "CLIMBER"}
      </div>

      {GEAR_SLOTS.map((slot) => {
        const items = lootItems.filter((i) => i.slot === slot.key);
        const rarityRank = (r) => ["common", "rare", "epic", "legendary"].indexOf(r);
        const equippedId = equippedItems?.[slot.key];
        const equippedItem = equippedId ? items.find((i) => i.id === equippedId && i.image) : null;
        const featured =
          equippedItem ||
          items.filter((i) => i.image).sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
        return (
          <div
            key={slot.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: `1px solid ${C.panelHi}`,
            }}
          >
            {/* real art (from GEAR_CATALOG matches) renders here once a slot
                has at least one item with an image; otherwise falls back to
                the count-only placeholder, still ready for future art. */}
            {featured ? (
              <div
                style={{
                  width: 84,
                  height: 84,
                  flexShrink: 0,
                  border: `2px solid ${RARITY[featured.rarity].color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: C.bgDeep,
                }}
              >
                <img
                  src={featured.image}
                  alt={featured.name}
                  style={{ width: 74, height: 74, objectFit: "contain", imageRendering: "pixelated" }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: 84,
                  height: 84,
                  flexShrink: 0,
                  border: `2px dashed ${C.panelHi}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 20,
                  color: items.length ? C.gold : C.boneDim,
                }}
              >
                {items.length || "—"}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 21, color: C.bone }}>
                {slot.label}
              </div>
              {items.length === 0 ? (
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
                  empty — unlock via LOOT
                </div>
              ) : (
                <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                  {items.map((it) => (
                    <span
                      key={it.id}
                      style={{
                        width: 14,
                        height: 14,
                        background: RARITY[it.rarity].color,
                        display: "inline-block",
                      }}
                      title={RARITY[it.rarity].label}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 14,
          color: C.boneDim,
          marginTop: 12,
        }}
      >
        Each dot is one unlocked item, colored by rarity. Real art slots in here once generated — the
        structure's ready.
      </div>
    </Panel>
  );
}

/* ---------------------------- WALL TAB ------------------------------ */
/* Holds are unlocked the same way gear is (via LOOT, slot="wall"), but
   placement is manual — pick an unplaced hold, tap where it goes. A
   real photo of the actual physical wall, converted to pixel art, is
   the background. Collision is a simple minimum-distance check between
   hold centers, not true per-pixel overlap — good enough to stop holds
   landing directly on top of each other without needing per-hold masks. */

function WallTab({ data, persist }) {
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [msg, setMsg] = useState("");

  const wallHolds = data.wallHolds || [];
  const lootItems = data.loot || [];
  const placedIds = new Set(wallHolds.map((w) => w.lootItemId));
  const wallSlotItems = lootItems.filter((i) => i.slot === "wall" && i.image && !placedIds.has(i.id));
  const unplacedHolds = wallSlotItems.filter((i) => !i.isPrefab);
  const unplacedPrefabs = wallSlotItems.filter((i) => i.isPrefab);

  const movingItem = movingId
    ? (() => {
        const w = wallHolds.find((wh) => wh.id === movingId);
        return w ? lootItems.find((i) => i.id === w.lootItemId) : null;
      })()
    : null;
  const movingIsPrefab = !!movingItem?.isPrefab;

  const toggleEditMode = () => {
    setEditMode((v) => !v);
    setSelected(null);
    setMovingId(null);
    setMsg("");
  };

  const selectForMove = (holdId) => {
    setMovingId((cur) => (cur === holdId ? null : holdId));
    setMsg(movingId === holdId ? "" : "Tap a new spot on the wall to move it there.");
  };

  const removeMoving = () => {
    if (!movingId) return;
    persist((prev) => ({
      ...prev,
      wallHolds: (prev.wallHolds || []).filter((w) => w.id !== movingId),
    }));
    setMovingId(null);
    setMsg("Removed — back in your inventory below.");
  };

  const handleWallClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return; // not laid out yet — ignore
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (editMode) {
      if (!movingId) {
        setMsg("Tap one of your placed holds first, then tap where it should go.");
        return;
      }
      // Boulder prefabs skip the distance check — they're a big single
      // piece, meant to be placed deliberately, not auto-spaced like holds.
      const tooClose = !movingIsPrefab && wallHolds.some((w) => {
        if (w.id === movingId) return false; // don't collide with its own old spot
        const dx = w.x - x;
        const dy = w.y - y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_HOLD_DISTANCE;
      });
      if (tooClose) {
        setMsg("Too close to another hold — try a different spot.");
        return;
      }
      persist((prev) => ({
        ...prev,
        wallHolds: (prev.wallHolds || []).map((w) => (w.id === movingId ? { ...w, x, y } : w)),
      }));
      setMovingId(null);
      setMsg("Moved.");
      return;
    }

    if (!selected) {
      setMsg("Pick a hold below first, then tap the wall.");
      return;
    }
    const selectedIsPrefab = unplacedPrefabs.some((i) => i.id === selected);
    const tooClose = !selectedIsPrefab && wallHolds.some((w) => {
      const dx = w.x - x;
      const dy = w.y - y;
      return Math.sqrt(dx * dx + dy * dy) < MIN_HOLD_DISTANCE;
    });
    if (tooClose) {
      setMsg("Too close to another hold — try a different spot.");
      return;
    }
    persist((prev) => ({
      ...prev,
      wallHolds: [...(prev.wallHolds || []), { id: uid(), lootItemId: selected, x, y }],
    }));
    setSelected(null);
    setMsg("Placed.");
  };

  return (
    <div>
      <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.cyan}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.cyan }}>
            SPRAY WALL
          </span>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
            {wallHolds.length} placed
          </span>
        </div>

        <div style={{ margin: "8px 0" }}>
          <Btn onClick={toggleEditMode} color={editMode ? C.gold : C.panelHi} small>
            {editMode ? "Done editing" : "Edit mode — move holds"}
          </Btn>
        </div>

        <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginBottom: 10 }}>
          {editMode
            ? movingId
              ? "Tap a new spot on the wall to move it there."
              : "Tap one of your placed holds to pick it up."
            : selected
            ? "Tap anywhere on the wall to place it."
            : "Pick a hold below, then tap the wall to place it."}
        </div>

        <div
          onClick={handleWallClick}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "256 / 136",
            backgroundImage: `url(${WALL_BG})`,
            backgroundSize: "100% 100%",
            imageRendering: "pixelated",
            cursor: editMode || selected ? "crosshair" : "default",
            border: `2px solid ${editMode ? C.gold : selected ? C.cyan : C.panelHi}`,
          }}
        >
          {wallHolds.map((w) => {
            const item = lootItems.find((i) => i.id === w.lootItemId);
            if (!item) return null;
            const isMoving = w.id === movingId;
            const widthPct = item.isPrefab ? "32%" : `${holdDisplayPct(item)}%`;
            return (
              <img
                key={w.id}
                src={item.image}
                alt=""
                onClick={
                  editMode
                    ? (e) => {
                        e.stopPropagation();
                        selectForMove(w.id);
                      }
                    : undefined
                }
                style={{
                  position: "absolute",
                  left: `${w.x * 100}%`,
                  top: `${w.y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${isMoving ? 1.1 : 1})`,
                  width: widthPct,
                  height: "auto",
                  imageRendering: "pixelated",
                  pointerEvents: editMode ? "auto" : "none",
                  cursor: editMode ? "pointer" : "default",
                  filter: isMoving ? `drop-shadow(0 0 4px ${C.gold})` : "none",
                  zIndex: item.isPrefab ? 1 : 2,
                }}
              />
            );
          })}
        </div>

        {editMode && movingIsPrefab && (
          <div style={{ marginTop: 8 }}>
            <Btn onClick={removeMoving} color={C.red} small>
              Remove from wall
            </Btn>
          </div>
        )}

        {msg && (
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.gold, marginTop: 8 }}>
            {msg}
          </div>
        )}
      </Panel>

      {editMode ? (
        <Panel style={{ padding: 14 }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
            Editing layout — tap a placed hold above to pick it up, then tap a new spot. Tap "Done
            editing" when you're happy with it.
          </div>
        </Panel>
      ) : (
        <>
          {unplacedPrefabs.length > 0 && (
            <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.gold}>
              <div
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 9,
                  color: C.gold,
                  marginBottom: 10,
                }}
              >
                BOULDER PREFABS — {unplacedPrefabs.length}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {unplacedPrefabs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelected(item.id);
                      setMsg("Tap the wall to place it — pick a good empty spot.");
                    }}
                    style={{
                      width: 84,
                      height: 84,
                      border: `2px solid ${selected === item.id ? C.cyan : C.gold}`,
                      background: C.bgDeep,
                      padding: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        imageRendering: "pixelated",
                      }}
                    />
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: C.boneDim, marginTop: 8 }}>
                A whole pre-arranged boulder, placed as one piece. No spacing check — pick the spot
                yourself.
              </div>
            </Panel>
          )}

          <Panel style={{ padding: 14 }}>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 9,
              color: C.boneDim,
              marginBottom: 10,
            }}
          >
            UNPLACED HOLDS — {unplacedHolds.length}
          </div>
          {unplacedHolds.length === 0 ? (
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
              None waiting. Open chests to unlock more — holds are a possible drop from any chest now.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {unplacedHolds.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setMsg("Tap the wall to place it.");
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    border: `2px solid ${selected === item.id ? C.cyan : RARITY[item.rarity].color}`,
                    background: C.bgDeep,
                    padding: 4,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name || item.rarity}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      imageRendering: "pixelated",
                    }}
                  />
                </button>
              ))}
            </div>
          )}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ------------------------- ITEM MANAGER ----------------------------- */
/* Lets the user add their own catalog items directly — no round trip
   needed for plain, already-transparent single images. Sheets that need
   segmenting still go through chat; this just handles the simple case
   entirely client-side via FileReader, merged into the effective catalog
   by getEffectiveCatalog(). */

function ItemsPage({ data, persist, onBack }) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("shoes");
  const [rarity, setRarity] = useState("common");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [filterSlot, setFilterSlot] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [selectedKey, setSelectedKey] = useState(null);

  const customItems = data.customItems || [];
  const SLOT_SORT_ORDER = ["shoes", "chalk", "harness", "trainingTool", "wall", "wallPrefab"];
  const RARITY_SORT_ORDER = ["common", "rare", "epic", "legendary"];
  const allItems = [...allBuiltInItems(), ...customItems.map((i) => ({ ...i, source: "custom" }))].sort(
    (a, b) => {
      const slotDiff = SLOT_SORT_ORDER.indexOf(a.slot) - SLOT_SORT_ORDER.indexOf(b.slot);
      if (slotDiff !== 0) return slotDiff;
      const rarityDiff = RARITY_SORT_ORDER.indexOf(a.rarity) - RARITY_SORT_ORDER.indexOf(b.rarity);
      if (rarityDiff !== 0) return rarityDiff;
      return (a.name || "").localeCompare(b.name || "");
    }
  );

  const slotOptions = [
    ["shoes", "SHOES"],
    ["chalk", "CHALK"],
    ["harness", "HARNESS"],
    ["trainingTool", "TRAINING TOOL"],
    ["wall", "WALL HOLD"],
    ["wallPrefab", "WALL PREFAB"],
  ];
  const slotLabel = (key) => slotOptions.find((s) => s[0] === key)?.[1] || key.toUpperCase();

  const rarityDisabled = (r) => slot === "wall" && r === "legendary";

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => setPreview({ dataUrl, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => setError("Couldn't read that as an image.");
      img.src = dataUrl;
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const canSave = name.trim().length > 0 && preview && !rarityDisabled(rarity);

  const startEdit = (item) => {
    setEditingId(item.id);
    setName(item.name || "");
    setSlot(item.slot);
    setRarity(item.rarity);
    setPreview({ dataUrl: item.image, w: item.w, h: item.h });
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setSlot("shoes");
    setRarity("common");
    setPreview(null);
    setError("");
  };

  const saveItem = () => {
    if (!canSave) return;
    if (editingId) {
      persist((prev) => ({
        ...prev,
        customItems: (prev.customItems || []).map((i) =>
          i.id === editingId
            ? { ...i, slot, rarity, name: name.trim(), image: preview.dataUrl, w: preview.w, h: preview.h }
            : i
        ),
      }));
    } else {
      const item = {
        id: uid(),
        slot,
        rarity,
        name: name.trim(),
        image: preview.dataUrl,
        w: preview.w,
        h: preview.h,
      };
      persist((prev) => ({ ...prev, customItems: [...(prev.customItems || []), item] }));
    }
    cancelEdit();
  };

  const deleteItem = (id) => {
    persist((prev) => ({ ...prev, customItems: (prev.customItems || []).filter((i) => i.id !== id) }));
    if (editingId === id) cancelEdit();
  };

  const filtered = allItems.filter((i) => {
    if (filterSlot !== "all" && i.slot !== filterSlot) return false;
    if (filterRarity !== "all" && i.rarity !== filterRarity) return false;
    if (filterSource !== "all" && i.source !== filterSource) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Btn onClick={onBack} color={C.panelHi} small>
          ← Back
        </Btn>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: C.bone }}>
          ITEMS
        </span>
      </div>

      <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.green}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.green, marginBottom: 4 }}>
          {editingId ? "EDIT ITEM" : "ADD CUSTOM ITEM"}
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginBottom: 12 }}>
          {editingId
            ? "Change any field and save — updates in place, no new entry created."
            : "Upload an already-transparent image — it becomes a real possible chest drop immediately, same as anything built in."}
        </div>

        <Field label="NAME">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>

        <Field label="SLOT">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {slotOptions.map(([key, label]) => (
              <Btn key={key} small color={slot === key ? C.green : C.panelHi} onClick={() => setSlot(key)}>
                {label}
              </Btn>
            ))}
          </div>
        </Field>

        <Field label="RARITY">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["common", "rare", "epic", "legendary"].map((r) => (
              <Btn
                key={r}
                small
                disabled={rarityDisabled(r)}
                color={rarity === r ? RARITY[r].color : C.panelHi}
                onClick={() => setRarity(r)}
              >
                {RARITY[r].label}
              </Btn>
            ))}
          </div>
          {slot === "wall" && (
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: C.boneDim, marginTop: 4 }}>
              Wall holds cap at epic — use WALL PREFAB for a legendary whole-piece drop instead.
            </div>
          )}
        </Field>

        <Field label="IMAGE — already-transparent PNG">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ ...inputStyle, padding: 8, fontSize: 15 }}
          />
        </Field>

        {error && (
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.red, marginBottom: 8 }}>
            {error}
          </div>
        )}

        {preview && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 60,
                height: 60,
                border: `2px solid ${C.panelHi}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: C.bgDeep,
                flexShrink: 0,
              }}
            >
              <img
                src={preview.dataUrl}
                alt="preview"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", imageRendering: "pixelated" }}
              />
            </div>
            <span style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim }}>
              {preview.w}×{preview.h}px
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={saveItem} color={C.green} disabled={!canSave} full={!editingId}>
            {editingId ? "Update item" : "Add to catalog"}
          </Btn>
          {editingId && (
            <Btn onClick={cancelEdit} color={C.panelHi} small>
              Cancel
            </Btn>
          )}
        </div>
      </Panel>

      <Panel style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.bone }}>
            ALL ITEMS
          </span>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
            {filtered.length} / {allItems.length}
          </span>
        </div>

        <Field label="SLOT">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["all", "ALL"], ...slotOptions].map(([key, label]) => (
              <Btn key={key} small color={filterSlot === key ? C.cyan : C.panelHi} onClick={() => setFilterSlot(key)}>
                {label}
              </Btn>
            ))}
          </div>
        </Field>

        <Field label="RARITY">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["all", "ALL"], ["common", "COMMON"], ["rare", "RARE"], ["epic", "EPIC"], ["legendary", "LEGENDARY"]].map(
              ([key, label]) => (
                <Btn
                  key={key}
                  small
                  color={filterRarity === key ? (key === "all" ? C.cyan : RARITY[key].color) : C.panelHi}
                  onClick={() => setFilterRarity(key)}
                >
                  {label}
                </Btn>
              )
            )}
          </div>
        </Field>

        <Field label="SOURCE">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["all", "ALL"], ["built-in", "BUILT-IN"], ["custom", "CUSTOM"]].map(([key, label]) => (
              <Btn key={key} small color={filterSource === key ? C.cyan : C.panelHi} onClick={() => setFilterSource(key)}>
                {label}
              </Btn>
            ))}
          </div>
        </Field>

        <div style={{ marginTop: 14 }}>
          {filtered.length === 0 ? (
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
              No items match these filters.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {filtered.map((item) => {
                const key = item.source + "-" + item.id;
                const isSelected = selectedKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(isSelected ? null : key)}
                    title={item.name}
                    style={{
                      width: 48,
                      height: 48,
                      border: `2px solid ${isSelected ? C.cyan : RARITY[item.rarity].color}`,
                      background: C.bgDeep,
                      padding: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", imageRendering: "pixelated" }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedKey &&
          (() => {
            const item = filtered.find((i) => i.source + "-" + i.id === selectedKey);
            if (!item) return null;
            return (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: `1px solid ${C.panelHi}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: 56, height: 56, objectFit: "contain", imageRendering: "pixelated", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'VT323', monospace", fontSize: 19, color: C.bone }}>
                    {item.name || "(unnamed)"}
                  </div>
                  <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: RARITY[item.rarity].color }}>
                    {slotLabel(item.slot)} · {RARITY[item.rarity].label} · {item.source}
                  </div>
                  {item.source === "custom" && (
                    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                      <button
                        onClick={() => startEdit(item)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.cyan,
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 9,
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => {
                          deleteItem(item.id);
                          setSelectedKey(null);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.red,
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 9,
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        DEL
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
      </Panel>
    </div>
  );
}

/* --------------------------- PROFILE ------------------------------- */

function ProfileTab({ data, bw, persist }) {
  const [nameEdit, setNameEdit] = useState(data.profile.name || "CLIMBER");

  const earnedSet = new Set(TITLES.filter((t) => t.check(data, bw)).map((t) => t.id));
  const equipped =
    data.profile.equippedTitleId && earnedSet.has(data.profile.equippedTitleId)
      ? TITLES.find((t) => t.id === data.profile.equippedTitleId)
      : null;
  const xpBreakdown = trainingXPBreakdown(data, bw);
  const trainingLevel = trainingLevelFromXP(xpBreakdown.total);
  const lootItems = data.loot || [];

  const daysActive = new Set((data.sessions || []).map((s) => s.date)).size;
  const questBonusWeeks = fullyCompletedQuestWeeks(data, bw);
  const rankUpEvents = totalRankUpEvents(data, bw);

  const earnedByTier = {
    daily: daysActive,
    standard: trainingLevel - 1 + questBonusWeeks,
    rankup: rankUpEvents,
  };
  // Legacy items (opened before tiers existed) have no .tier — treat them
  // as standard so they still count against that pool rather than vanishing.
  const openedByTier = {
    daily: lootItems.filter((i) => i.tier === "daily").length,
    standard: lootItems.filter((i) => i.tier === "standard" || !i.tier).length,
    rankup: lootItems.filter((i) => i.tier === "rankup").length,
  };
  const unopenedByTier = {
    daily: Math.max(0, earnedByTier.daily - openedByTier.daily),
    standard: Math.max(0, earnedByTier.standard - openedByTier.standard),
    rankup: Math.max(0, earnedByTier.rankup - openedByTier.rankup),
  };

  const openChest = (tierKey) => {
    if (unopenedByTier[tierKey] <= 0) return;
    persist((prev) => ({ ...prev, loot: [...(prev.loot || []), rollLoot(tierKey, prev)] }));
  };

  const [confirmingReset, setConfirmingReset] = useState(false);
  const resetItems = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    persist((prev) => ({ ...prev, loot: defaultLoot(), wallHolds: [] }));
    setConfirmingReset(false);
  };

  const [invFilterSlot, setInvFilterSlot] = useState("all");
  const [invFilterRarity, setInvFilterRarity] = useState("all");
  const [invSelectedId, setInvSelectedId] = useState(null);
  const equippedItems = data.equippedItems || {};

  const equipGearItem = (item) => {
    persist((prev) => ({ ...prev, equippedItems: { ...(prev.equippedItems || {}), [item.slot]: item.id } }));
  };
  const unequipGearSlot = (slotKey) => {
    persist((prev) => {
      const next = { ...(prev.equippedItems || {}) };
      delete next[slotKey];
      return { ...prev, equippedItems: next };
    });
  };

  const saveName = () => {
    const v = nameEdit.trim() || "CLIMBER";
    persist((prev) => ({ ...prev, profile: { ...prev.profile, name: v } }));
  };

  const toggleEquip = (id) => {
    persist((prev) => ({
      ...prev,
      profile: { ...prev.profile, equippedTitleId: prev.profile.equippedTitleId === id ? null : id },
    }));
  };

  const toggleGymAccess = () => {
    persist((prev) => ({ ...prev, profile: { ...prev.profile, gymAccess: !prev.profile.gymAccess } }));
  };

  const currentWeek = weekKeyOf(today());
  const questRecords = data.quests || [];

  const thisWeekRecord = questRecords.find((r) => r.weekKey === currentWeek);
  const thisWeekQuests = thisWeekRecord
    ? thisWeekRecord.questIds.map((id) => QUEST_POOL.find((q) => q.id === id)).filter(Boolean)
    : [];
  const completedThisWeek = thisWeekQuests.filter((q) => q.check(data, bw, currentWeek));

  const pastWeeks = questRecords
    .filter((r) => r.weekKey !== currentWeek)
    .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1))
    .slice(0, 4)
    .map((r) => {
      const defs = r.questIds.map((id) => QUEST_POOL.find((q) => q.id === id)).filter(Boolean);
      const done = defs.filter((q) => q.check(data, bw, r.weekKey)).length;
      return { weekKey: r.weekKey, done, total: defs.length };
    });

  return (
    <div>
      <Panel style={{ padding: 16, marginBottom: 14 }} accent={C.gold}>
        <Field label="NAME">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle}
              value={nameEdit}
              maxLength={16}
              onChange={(e) => setNameEdit(e.target.value)}
            />
            <Btn onClick={saveName} color={C.cyan} small>
              SET
            </Btn>
          </div>
        </Field>

        <div
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 15,
            color: C.boneDim,
            marginBottom: 6,
          }}
        >
          EQUIPPED TITLE
        </div>
        {equipped ? (
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 11,
              background: RARITY[equipped.rarity].color,
              color: C.bgDeep,
              padding: "8px 10px",
              display: "inline-block",
            }}
          >
            {equipped.name}
          </span>
        ) : (
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: C.boneDim }}>
            None equipped — pick one below.
          </div>
        )}
      </Panel>

      <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.cyan}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.cyan }}>
            WEEKLY QUESTS
          </span>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
            {completedThisWeek.length}/{thisWeekQuests.length}
          </span>
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginBottom: 10 }}>
          Any order, any day this week — no rush.
        </div>
        <XPBar
          pct={thisWeekQuests.length ? completedThisWeek.length / thisWeekQuests.length : 0}
          color={C.cyan}
          segments={5}
        />

        <div style={{ marginTop: 14 }}>
          {thisWeekQuests.map((q) => {
            const done = completedThisWeek.includes(q);
            return (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 0",
                  borderBottom: `1px solid ${C.panelHi}`,
                  opacity: done ? 1 : 0.85,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 10,
                      color: done ? C.green : C.boneDim,
                      width: 14,
                    }}
                  >
                    {done ? "✓" : "○"}
                  </span>
                  <span
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: 17,
                      color: done ? C.boneDim : C.bone,
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {q.text}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 9,
                    color: done ? C.green : C.cyan,
                    whiteSpace: "nowrap",
                  }}
                >
                  +{q.xp}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.panelHi}` }}>
          {data.profile.gymAccess ? (
            <>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim, marginBottom: 8 }}>
                Gym-based quests unlocked.
              </div>
              <Btn onClick={toggleGymAccess} color={C.panelHi} small>
                Lost gym access again
              </Btn>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim, marginBottom: 8 }}>
                🔒 Gym-based quests locked — only hangboard/weighted training right now.
              </div>
              <Btn onClick={toggleGymAccess} color={C.cyan} small>
                I'm back in the gym
              </Btn>
            </>
          )}
        </div>

        {pastWeeks.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.panelHi}` }}>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginBottom: 6 }}>
              PAST WEEKS
            </div>
            {pastWeeks.map((w) => (
              <div
                key={w.weekKey}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "'VT323', monospace",
                  fontSize: 15,
                  color: C.boneDim,
                  padding: "3px 0",
                }}
              >
                <span>Week {w.weekKey.split("-")[1]}</span>
                <span>{w.done}/{w.total} completed</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.gold}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.gold }}>
          LOOT
        </span>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, margin: "6px 0 14px" }}>
          Three chest tiers, each earned a different way. Drops are cosmetic items — banked now, spendable
          on the Gear Rack and Spray Wall.
        </div>

        {[
          {
            tier: CHEST_TIERS.daily,
            desc: "Log your first session of a day. Never drops legendary.",
            earned: earnedByTier.daily,
          },
          {
            tier: CHEST_TIERS.standard,
            desc: "1 per Training Level gained, +1 per week you fully clear all 5 quests.",
            earned: earnedByTier.standard,
          },
          {
            tier: CHEST_TIERS.rankup,
            desc: "1 per genuine new rank on any benchmark. Never common — weighted toward epic/legendary.",
            earned: earnedByTier.rankup,
          },
        ].map(({ tier, desc }) => (
          <div key={tier.key} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.panelHi}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: tier.color }}>
                {tier.label}
              </span>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
                {unopenedByTier[tier.key]} unopened
              </span>
            </div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: C.boneDim, marginBottom: 8 }}>
              {desc}
            </div>
            <Btn
              onClick={() => openChest(tier.key)}
              color={tier.color}
              disabled={unopenedByTier[tier.key] <= 0}
              full
            >
              {unopenedByTier[tier.key] > 0 ? `Open (${unopenedByTier[tier.key]} left)` : "No chests to open"}
            </Btn>
          </div>
        ))}

        {lootItems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 8,
                color: C.boneDim,
                marginBottom: 8,
              }}
            >
              INVENTORY — {lootItems.length}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {[["all", "ALL"], ...GEAR_SLOTS.map((s) => [s.key, s.label]), ["wall", "WALL"]].map(
                ([key, label]) => (
                  <Btn
                    key={key}
                    small
                    color={invFilterSlot === key ? C.cyan : C.panelHi}
                    onClick={() => setInvFilterSlot(key)}
                  >
                    {label}
                  </Btn>
                )
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {[["all", "ALL"], ["common", "COMMON"], ["rare", "RARE"], ["epic", "EPIC"], ["legendary", "LEGENDARY"]].map(
                ([key, label]) => (
                  <Btn
                    key={key}
                    small
                    color={invFilterRarity === key ? (key === "all" ? C.cyan : RARITY[key].color) : C.panelHi}
                    onClick={() => setInvFilterRarity(key)}
                  >
                    {label}
                  </Btn>
                )
              )}
            </div>

            {(() => {
              const invFiltered = lootItems
                .filter((item) => invFilterSlot === "all" || item.slot === invFilterSlot)
                .filter((item) => invFilterRarity === "all" || item.rarity === invFilterRarity)
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1));

              return (
                <>
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: `1px solid ${C.panelHi}`,
                      padding: 8,
                    }}
                  >
                    {invFiltered.length === 0 ? (
                      <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
                        Nothing matches these filters.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {invFiltered.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setInvSelectedId(invSelectedId === item.id ? null : item.id)}
                            title={item.name}
                            style={{
                              width: 48,
                              height: 48,
                              border: `2px solid ${invSelectedId === item.id ? C.cyan : RARITY[item.rarity].color}`,
                              background: C.bgDeep,
                              padding: 3,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", imageRendering: "pixelated" }}
                              />
                            ) : (
                              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: C.boneDim }}>
                                ?
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {invSelectedId &&
                    (() => {
                      const item = invFiltered.find((i) => i.id === invSelectedId);
                      if (!item) return null;
                      const canEquip = GEAR_SLOTS.some((s) => s.key === item.slot);
                      const isEquipped = equippedItems[item.slot] === item.id;
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: `1px solid ${C.panelHi}`,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              style={{ width: 48, height: 48, objectFit: "contain", imageRendering: "pixelated", flexShrink: 0 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'VT323', monospace", fontSize: 17, color: C.bone }}>
                              {item.name ||
                                `${GEAR_SLOTS.find((s) => s.key === item.slot)?.label || item.slot.toUpperCase()} TOKEN`}
                            </div>
                            <div style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: RARITY[item.rarity].color }}>
                              {RARITY[item.rarity].label}
                            </div>
                            {canEquip && (
                              <div style={{ marginTop: 6 }}>
                                <Btn
                                  small
                                  color={isEquipped ? C.gold : C.cyan}
                                  onClick={() => (isEquipped ? unequipGearSlot(item.slot) : equipGearItem(item))}
                                >
                                  {isEquipped ? "Equipped — tap for auto" : "Equip to Gear Rack"}
                                </Btn>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </>
              );
            })()}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.panelHi}` }}>
          <Btn onClick={resetItems} color={confirmingReset ? C.red : C.panelHi} small>
            {confirmingReset ? "Tap again to confirm reset" : "Reset items"}
          </Btn>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: C.boneDim, marginTop: 6 }}>
            Clears all unlocked items and placed wall holds back to the starter set — use this if a
            catalog art update left you with stale images. Doesn't touch your benchmarks or training log.
          </div>
        </div>
      </Panel>

      <GearRack name={data.profile.name} lootItems={lootItems} equippedItems={data.equippedItems} />

      <Panel style={{ padding: 14, marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            color: C.magenta,
            marginBottom: 12,
          }}
        >
          TRAINING XP BREAKDOWN
        </div>
        {[
          ["Sessions & benchmarks logged", xpBreakdown.activity, `capped at ${DAILY_ACTIVITY_XP_CAP}/day — rest days count too`],
          ["New ranks reached", xpBreakdown.rankUps, `${RANK_UP_XP} XP each, once per new best`],
          ["Weeks trained", xpBreakdown.consistency, `${CONSISTENCY_XP_PER_WEEK} XP per distinct week active`],
          ["Weekly quests completed", xpBreakdown.quests, "varies per quest — see WEEKLY QUESTS above"],
        ].map(([label, val, note]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              padding: "8px 0",
              borderBottom: `1px solid ${C.panelHi}`,
            }}
          >
            <div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: C.bone }}>{label}</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim }}>{note}</div>
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: C.magenta }}>
              +{val}
            </div>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: 10,
          }}
        >
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: C.boneDim }}>TOTAL</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: C.bone }}>
            {xpBreakdown.total} XP
          </span>
        </div>
      </Panel>

      <Panel style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.bone }}>
            TITLES
          </span>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
            {earnedSet.size}/{TITLES.length}
          </span>
        </div>
        <XPBar pct={earnedSet.size / TITLES.length} color={C.gold} segments={TITLES.length} />

        <div style={{ marginTop: 16, maxHeight: 320, overflowY: "auto" }}>
          {TITLES.map((t) => {
            const earned = earnedSet.has(t.id);
            const rarity = RARITY[t.rarity];
            const isEquipped = data.profile.equippedTitleId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => earned && toggleEquip(t.id)}
                style={{
                  padding: "10px 10px",
                  marginBottom: 6,
                  background: isEquipped ? rarity.color : "transparent",
                  borderLeft: `4px solid ${earned ? rarity.color : C.panelHi}`,
                  cursor: earned ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 9,
                      color: isEquipped ? C.bgDeep : earned ? C.bone : C.boneDim,
                    }}
                  >
                    {earned ? "" : "🔒 "}
                    {t.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 7,
                      color: isEquipped ? C.bgDeep : rarity.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rarity.label}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: 15,
                    color: isEquipped ? C.bgDeep : C.boneDim,
                    marginTop: 4,
                  }}
                >
                  {t.desc}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* --------------------------- STATS -------------------------------- */

function StatsTab({ data, bw, persist }) {
  const [open, setOpen] = useState(null);
  const [bwEdit, setBwEdit] = useState(String(bw));

  const saveBw = () => {
    const v = parseFloat(bwEdit);
    if (!isNaN(v) && v > 0) {
      persist((prev) => ({ ...prev, profile: { ...prev.profile, bodyweight: v } }));
    }
  };

  const addEntry = (scaleKey, vals, hand, date, note) => {
    const entry = { id: uid(), scale: scaleKey, date, hand: hand || "", note: note || "", ...vals };
    persist((prev) => ({ ...prev, entries: [...prev.entries, entry] }));
  };

  const delEntry = (id) => {
    persist((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  };

  return (
    <div>
      <Panel style={{ padding: 12, marginBottom: 14 }}>
        <Field label="BODYWEIGHT (KG)">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={bwEdit}
              onChange={(e) => setBwEdit(e.target.value)}
            />
            <Btn onClick={saveBw} color={C.cyan} small>
              SET
            </Btn>
          </div>
        </Field>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
          Every % below is calculated against this number.
        </div>
      </Panel>

      {SCALE_ORDER.map((k) => (
        <ScaleCard
          key={k}
          scale={SCALES[k]}
          entries={data.entries}
          bw={bw}
          open={open === k}
          onToggle={() => setOpen(open === k ? null : k)}
          onAdd={addEntry}
          onDelete={delEntry}
        />
      ))}
    </div>
  );
}

function ScaleCard({ scale, entries, bw, open, onToggle, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [vals, setVals] = useState({});
  const [hand, setHand] = useState("R");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");

  const mine = entries
    .filter((e) => e.scale === scale.key)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const isSplit = !!scale.splitByHand;

  const best = bestFor(entries, scale, bw);
  const bestMetric = best ? scale.metric(best, bw) : null;
  const ti = bestMetric != null ? tierIndex(scale, bestMetric) : 0;
  const tier = scale.tiers[ti];
  const next = scale.tiers[ti + 1];

  const pct = next && bestMetric != null
    ? (bestMetric - tier.min) / (next.min - tier.min)
    : bestMetric != null
    ? 1
    : 0;

  // Per-hand breakdown (one-arm max tracks left/right separately)
  const bestR = isSplit ? bestForHand(entries, scale, bw, "R") : null;
  const bestL = isSplit ? bestForHand(entries, scale, bw, "L") : null;
  const metricR = bestR ? scale.metric(bestR, bw) : null;
  const metricL = bestL ? scale.metric(bestL, bw) : null;
  const tiR = metricR != null ? tierIndex(scale, metricR) : null;
  const tiL = metricL != null ? tierIndex(scale, metricL) : null;
  const maxTi = isSplit ? Math.max(tiR ?? -1, tiL ?? -1) : ti;

  const submit = () => {
    const parsed = {};
    let ok = true;
    scale.fields.forEach((f) => {
      const v = parseFloat(vals[f.id]);
      if (isNaN(v)) ok = false;
      parsed[f.id] = v;
    });
    if (!ok) return;
    onAdd(scale.key, parsed, scale.hasHand ? hand : "", date, note);
    setVals({});
    setNote("");
    setAdding(false);
  };

  return (
    <Panel style={{ padding: 14, marginBottom: 14 }} accent={open ? scale.color : null}>
      <div
        onClick={onToggle}
        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 11,
              color: scale.color,
              marginBottom: 6,
            }}
          >
            {scale.name}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
            {scale.sub}
          </div>
        </div>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 10,
            color: C.boneDim,
            paddingLeft: 8,
          }}
        >
          {open ? "▲" : "▼"}
        </div>
      </div>

      {/* current rank */}
      <div style={{ marginTop: 14 }}>
        {isSplit ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              ["RIGHT", metricR, tiR],
              ["LEFT", metricL, tiL],
            ].map(([label, m, tIdx]) => {
              if (m == null) {
                return (
                  <div key={label}>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim, marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: 17, color: C.boneDim }}>
                      No entries yet
                    </div>
                  </div>
                );
              }
              const t = scale.tiers[tIdx];
              const n = scale.tiers[tIdx + 1];
              const p = n ? (m - t.min) / (n.min - t.min) : 1;
              return (
                <div key={label}>
                  <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim, marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 11,
                        background: scale.color,
                        color: C.bgDeep,
                        padding: "6px 8px",
                      }}
                    >
                      {t.name}
                    </span>
                    <span style={{ fontFamily: "'VT323', monospace", fontSize: 22, color: C.bone }}>
                      {scale.fmt(m)}
                    </span>
                  </div>
                  <XPBar pct={p} color={scale.color} segments={10} />
                  <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginTop: 5 }}>
                    {n ? `${scale.fmt(n.min - m)} to ${n.name}` : "Ladder maxed"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : bestMetric == null ? (
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: C.boneDim }}>
            No entries yet. Log one to get a rank.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 14,
                  background: scale.color,
                  color: C.bgDeep,
                  padding: "8px 10px",
                }}
              >
                {tier.name}
              </span>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: 26, color: C.bone }}>
                {scale.fmt(bestMetric)}
              </span>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>
                best · {scale.metricLabel.toLowerCase()}
              </span>
            </div>

            <div style={{ marginTop: 12 }}>
              <XPBar pct={pct} color={scale.color} segments={18} />
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: 17,
                  color: C.boneDim,
                  marginTop: 6,
                }}
              >
                {next
                  ? `${scale.fmt(next.min - bestMetric)} to ${next.name}`
                  : "Ladder maxed. Nothing above this."}
              </div>
            </div>
          </>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 18 }}>
          {/* source honesty tag */}
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 15,
              color: scale.sourceTone === "invented" ? C.gold : C.cyan,
              background: C.bgDeep,
              border: `2px solid ${scale.sourceTone === "invented" ? C.gold : C.cyan}`,
              padding: 8,
              marginBottom: 14,
              lineHeight: 1.4,
            }}
          >
            SOURCE: {scale.source}
          </div>

          {/* ladder */}
          <div style={{ marginBottom: 16 }}>
            {scale.tiers.map((t, i) => {
              const reached = isSplit ? i <= maxTi : bestMetric != null && i <= ti;
              const current = !isSplit && i === ti && bestMetric != null;
              const isR = isSplit && i === tiR;
              const isL = isSplit && i === tiL;
              return (
                <div
                  key={t.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 8px",
                    background: current ? scale.color : "transparent",
                    borderLeft: `4px solid ${reached ? scale.color : C.panelHi}`,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 8,
                      color: current ? C.bgDeep : reached ? C.bone : C.boneDim,
                      flex: 1,
                    }}
                  >
                    {reached ? "" : "🔒 "}
                    {t.name}
                  </span>
                  {isSplit && (isR || isL) && (
                    <span style={{ display: "flex", gap: 4 }}>
                      {isR && (
                        <span
                          style={{
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 7,
                            background: scale.color,
                            color: C.bgDeep,
                            padding: "2px 5px",
                          }}
                        >
                          R
                        </span>
                      )}
                      {isL && (
                        <span
                          style={{
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: 7,
                            background: C.bone,
                            color: C.bgDeep,
                            padding: "2px 5px",
                          }}
                        >
                          L
                        </span>
                      )}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: 17,
                      color: current ? C.bgDeep : C.boneDim,
                    }}
                  >
                    {t.min > 0 ? scale.fmt(t.min) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* add form */}
          {!adding ? (
            <Btn onClick={() => setAdding(true)} color={scale.color} full>
              + Log entry
            </Btn>
          ) : (
            <Panel style={{ padding: 12, background: C.bgDeep }}>
              {scale.fields.map((f) => (
                <Field key={f.id} label={f.label}>
                  <input
                    style={inputStyle}
                    inputMode="decimal"
                    step={f.step}
                    value={vals[f.id] ?? ""}
                    onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })}
                  />
                </Field>
              ))}

              {scale.hasHand && (
                <Field label="HAND">
                  <div style={{ display: "flex", gap: 8 }}>
                    {["R", "L"].map((h) => (
                      <Btn
                        key={h}
                        small
                        color={hand === h ? scale.color : C.panelHi}
                        onClick={() => setHand(h)}
                      >
                        {h === "R" ? "RIGHT" : "LEFT"}
                      </Btn>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="DATE">
                <input
                  type="date"
                  style={inputStyle}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>

              <Field label="NOTE (readiness, conditions...)">
                <input
                  style={inputStyle}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 7/10 readiness, tendons fine"
                />
              </Field>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn onClick={submit} color={scale.color} small>
                  Save
                </Btn>
                <Btn onClick={() => setAdding(false)} color={C.panelHi} small>
                  Cancel
                </Btn>
              </div>
            </Panel>
          )}

          {/* history */}
          {mine.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                  color: C.boneDim,
                  marginBottom: 8,
                }}
              >
                HISTORY
              </div>
              {mine.map((e) => {
                const m = scale.metric(e, bw);
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "8px 0",
                      borderBottom: `1px solid ${C.panelHi}`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: "'VT323', monospace",
                          fontSize: 19,
                          color: C.bone,
                        }}
                      >
                        {scale.fmt(m)}
                        {e.hand ? ` · ${e.hand}` : ""}{" "}
                        <span style={{ color: C.boneDim, fontSize: 16 }}>{e.date}</span>
                      </div>
                      {e.note && (
                        <div
                          style={{
                            fontFamily: "'VT323', monospace",
                            fontSize: 16,
                            color: C.boneDim,
                            lineHeight: 1.3,
                          }}
                        >
                          {e.note}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onDelete(e.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: C.red,
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 8,
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      DEL
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* --------------------------- TIMER -------------------------------- */

function TimerTab() {
  const [work, setWork] = useState(7);
  const [rest, setRest] = useState(3);
  const [reps, setReps] = useState(6);
  const [sets, setSets] = useState(5);
  const [betweenSets, setBetweenSets] = useState(150);
  const [sound, setSound] = useState(true);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | hang | rest | setrest | done
  const [left, setLeft] = useState(0);
  const [rep, setRep] = useState(1);
  const [set, setSet] = useState(1);

  const audioRef = useRef(null);

  const beep = useCallback(
    (freq, dur = 0.09) => {
      if (!sound) return;
      try {
        if (!audioRef.current) {
          audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioRef.current;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = freq;
        g.gain.value = 0.06;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + dur);
      } catch {
        /* audio unavailable — silent */
      }
    },
    [sound]
  );

  const reset = () => {
    setRunning(false);
    setPhase("idle");
    setLeft(0);
    setRep(1);
    setSet(1);
  };

  const start = () => {
    setPhase("hang");
    setLeft(work);
    setRep(1);
    setSet(1);
    setRunning(true);
    beep(880);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (left > 1) {
        if (left <= 4) beep(440, 0.05);
        setLeft(left - 1);
        return;
      }

      // countdown hit zero — advance the phase
      if (phase === "hang") {
        if (rep >= reps) {
          if (set >= sets) {
            setRunning(false);
            setPhase("done");
            beep(1200, 0.4);
            return;
          }
          setPhase("setrest");
          setLeft(betweenSets);
          beep(660, 0.2);
          return;
        }
        setPhase("rest");
        setLeft(rest);
        beep(330);
        return;
      }

      if (phase === "rest") {
        setRep(rep + 1);
        setPhase("hang");
        setLeft(work);
        beep(880);
        return;
      }

      if (phase === "setrest") {
        setSet(set + 1);
        setRep(1);
        setPhase("hang");
        setLeft(work);
        beep(880);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, left, phase, rep, set, reps, sets, work, rest, betweenSets, beep]);

  const phaseColor =
    phase === "hang" ? C.magenta : phase === "rest" ? C.cyan : phase === "setrest" ? C.gold : C.boneDim;

  const phaseLabel =
    phase === "hang"
      ? "HANG"
      : phase === "rest"
      ? "REST"
      : phase === "setrest"
      ? "SET REST"
      : phase === "done"
      ? "DONE"
      : "READY";

  return (
    <div>
      <Panel style={{ padding: 20, marginBottom: 14, textAlign: "center" }} accent={phaseColor}>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 14,
            color: phaseColor,
            marginBottom: 16,
          }}
        >
          {phaseLabel}
        </div>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 52,
            color: C.bone,
            lineHeight: 1.1,
            textShadow: `4px 4px 0 ${phaseColor}`,
            marginBottom: 18,
          }}
        >
          {phase === "idle" ? work : phase === "done" ? "★" : left}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>REP</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: C.bone }}>
              {rep}/{reps}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim }}>SET</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: C.bone }}>
              {set}/{sets}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {!running && phase !== "done" && (
            <Btn onClick={start} color={C.magenta}>
              Start
            </Btn>
          )}
          {running && (
            <Btn onClick={() => setRunning(false)} color={C.gold}>
              Pause
            </Btn>
          )}
          {!running && phase !== "idle" && phase !== "done" && (
            <Btn onClick={() => setRunning(true)} color={C.green}>
              Resume
            </Btn>
          )}
          <Btn onClick={reset} color={C.panelHi}>
            Reset
          </Btn>
          <Btn onClick={() => setSound(!sound)} color={sound ? C.cyan : C.panelHi} small>
            {sound ? "🔊" : "🔇"}
          </Btn>
        </div>
      </Panel>

      <Panel style={{ padding: 14 }}>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            color: C.boneDim,
            marginBottom: 12,
          }}
        >
          PROTOCOL
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["HANG (S)", work, setWork],
            ["REST (S)", rest, setRest],
            ["REPS / SET", reps, setReps],
            ["SETS", sets, setSets],
            ["SET REST (S)", betweenSets, setBetweenSets],
          ].map(([label, val, setter], i) => (
            <Field key={i} label={label}>
              <input
                style={inputStyle}
                inputMode="numeric"
                value={val}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setter(isNaN(v) ? 0 : v);
                }}
                disabled={running}
              />
            </Field>
          ))}
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 17, color: C.boneDim, lineHeight: 1.4 }}>
          Defaults are your endurance protocol: 5×6 at 7s on / 3s off, 50–60% of
          max load, 2–3 min between sets.
        </div>
      </Panel>
    </div>
  );
}

/* ----------------------------- LOG -------------------------------- */

function LogTab({ data, persist }) {
  const [form, setForm] = useState({
    date: today(),
    type: "MAX HANGS",
    sets: "",
    reps: "",
    load: "",
    readiness: 7,
    note: "",
  });

  const add = () => {
    const s = { id: uid(), ...form };
    persist((prev) => ({ ...prev, sessions: [s, ...prev.sessions] }));
    setForm({ ...form, sets: "", reps: "", load: "", note: "" });
  };

  const del = (id) =>
    persist((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) }));

  const sessions = [...data.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <Panel style={{ padding: 14, marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            color: C.magenta,
            marginBottom: 14,
          }}
        >
          NEW SESSION
        </div>

        <Field label="TYPE">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SESSION_TYPES.map((t) => (
              <Btn
                key={t}
                small
                color={form.type === t ? C.magenta : C.panelHi}
                onClick={() => setForm({ ...form, type: t })}
              >
                {t}
              </Btn>
            ))}
          </div>
        </Field>

        <Field label="DATE">
          <input
            type="date"
            style={inputStyle}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="SETS">
            <input
              style={inputStyle}
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => setForm({ ...form, sets: e.target.value })}
            />
          </Field>
          <Field label="REPS / SET">
            <input
              style={inputStyle}
              inputMode="numeric"
              value={form.reps}
              onChange={(e) => setForm({ ...form, reps: e.target.value })}
            />
          </Field>
        </div>

        <Field label="LOAD">
          <input
            style={inputStyle}
            value={form.load}
            onChange={(e) => setForm({ ...form, load: e.target.value })}
            placeholder="e.g. bodyweight, +20kg, 13kg assist"
          />
        </Field>

        <Field label={`READINESS — ${form.readiness}/10`}>
          <input
            type="range"
            min="1"
            max="10"
            value={form.readiness}
            onChange={(e) => setForm({ ...form, readiness: parseInt(e.target.value, 10) })}
            style={{ width: "100%", accentColor: C.gold }}
          />
        </Field>

        <Field label="NOTE">
          <input
            style={inputStyle}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="how the fingers felt, pump, anything off"
          />
        </Field>

        <Btn onClick={add} color={C.magenta} full>
          Save session
        </Btn>
      </Panel>

      {sessions.length === 0 ? (
        <Panel style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: C.boneDim }}>
            No sessions logged. Train something.
          </div>
        </Panel>
      ) : (
        sessions.map((s) => (
          <Panel key={s.id} style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 9,
                    color: C.cyan,
                    marginBottom: 6,
                  }}
                >
                  {s.type}
                </div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 19, color: C.bone }}>
                  {s.date}
                  {s.sets && s.reps ? ` · ${s.sets}×${s.reps}` : ""}
                  {s.load ? ` · ${s.load}` : ""}
                </div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 17, color: C.gold }}>
                  readiness {s.readiness}/10
                </div>
                {s.note && (
                  <div
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: 17,
                      color: C.boneDim,
                      lineHeight: 1.3,
                      marginTop: 4,
                    }}
                  >
                    {s.note}
                  </div>
                )}
              </div>
              <button
                onClick={() => del(s.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.red,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                DEL
              </button>
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}

/* ---------------------------- CHARTS ------------------------------ */

const PixelDot = ({ cx, cy, fill }) => (
  <rect x={cx - 3} y={cy - 3} width={6} height={6} fill={fill} />
);

function ChartsTab({ data, bw }) {
  return (
    <div>
      {SCALE_ORDER.map((k) => {
        const scale = SCALES[k];
        const filtered = data.entries.filter((e) => e.scale === k);
        const isSplit = !!scale.splitByHand;

        let rows;
        if (isSplit) {
          // merge by date so R and L can share an x-axis; missing side = gap
          const byDate = {};
          filtered
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .forEach((e) => {
              if (!byDate[e.date]) byDate[e.date] = { date: e.date };
              const v = parseFloat(scale.metric(e, bw).toFixed(1));
              if (e.hand === "R") byDate[e.date].r = v;
              else if (e.hand === "L") byDate[e.date].l = v;
            });
          rows = Object.values(byDate)
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((r) => ({ ...r, date: r.date.slice(5) }));
        } else {
          rows = filtered
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((e) => ({
              date: e.date.slice(5),
              v: parseFloat(scale.metric(e, bw).toFixed(1)),
            }));
        }

        return (
          <Panel key={k} style={{ padding: 14, marginBottom: 14 }}>
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 10,
                color: scale.color,
                marginBottom: 4,
              }}
            >
              {scale.name}
            </div>
            <div
              style={{
                fontFamily: "'VT323', monospace",
                fontSize: 16,
                color: C.boneDim,
                marginBottom: isSplit ? 6 : 12,
              }}
            >
              {scale.metricLabel} · {scale.unit}
            </div>

            {isSplit && (
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 18, height: 3, background: scale.color, display: "inline-block" }} />
                  <span style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
                    RIGHT
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 18,
                      height: 3,
                      background: `repeating-linear-gradient(90deg, ${C.bone} 0 4px, transparent 4px 7px)`,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
                    LEFT
                  </span>
                </span>
              </div>
            )}

            {filtered.length < 2 ? (
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: 19,
                  color: C.boneDim,
                  padding: "20px 0",
                }}
              >
                {filtered.length === 0
                  ? "No data yet."
                  : "One point so far. Log another to draw a line."}
              </div>
            ) : (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke={C.panelHi} strokeDasharray="2 3" />
                    <XAxis
                      dataKey="date"
                      stroke={C.boneDim}
                      tick={{ fontFamily: "'VT323', monospace", fontSize: 14, fill: C.boneDim }}
                    />
                    <YAxis
                      stroke={C.boneDim}
                      domain={["dataMin - 5", "dataMax + 5"]}
                      tick={{ fontFamily: "'VT323', monospace", fontSize: 14, fill: C.boneDim }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: C.bgDeep,
                        border: `2px solid ${scale.color}`,
                        borderRadius: 0,
                        fontFamily: "'VT323', monospace",
                        fontSize: 16,
                        color: C.bone,
                      }}
                      labelStyle={{ color: C.boneDim }}
                    />
                    {isSplit ? (
                      <>
                        <Line
                          type="linear"
                          dataKey="r"
                          name="Right"
                          stroke={scale.color}
                          strokeWidth={3}
                          dot={<PixelDot fill={scale.color} />}
                          activeDot={<PixelDot fill={C.bone} />}
                          connectNulls
                          isAnimationActive={false}
                        />
                        <Line
                          type="linear"
                          dataKey="l"
                          name="Left"
                          stroke={C.bone}
                          strokeWidth={3}
                          strokeDasharray="6 4"
                          dot={<PixelDot fill={C.bone} />}
                          activeDot={<PixelDot fill={C.bone} />}
                          connectNulls
                          isAnimationActive={false}
                        />
                      </>
                    ) : (
                      <Line
                        type="linear"
                        dataKey="v"
                        stroke={scale.color}
                        strokeWidth={3}
                        dot={<PixelDot fill={scale.color} />}
                        activeDot={<PixelDot fill={C.bone} />}
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
