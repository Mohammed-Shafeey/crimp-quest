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
const holdDisplayPct = (item, wallScale = 1) => {
  if (!item.w) return 4.5 * wallScale; // legacy items with no stored native size
  const pct = item.w * HOLD_PX_TO_WALL_PCT * wallScale;
  return Math.max(HOLD_MIN_PCT * wallScale, Math.min(HOLD_MAX_PCT * wallScale, pct));
};
/* Four independent chest tiers, each earned a different way:
   - DAILY: earned by logging your first session of a calendar day.
     Can't drop legendary — this is the low-stakes, frequent chest.
   - STANDARD: earned per Training Level gained, plus a bonus for
     fully completing a week's 5 quests. The "normal" chest.
   - RANK: earned per genuine rank-up event on any benchmark (same
     events that already grant Rank-Up XP). No commons at all, and
     weighted hard toward epic/legendary — this is the reward for
     actually getting stronger, not just logging activity.
   - HOLDBOX: earned once per calendar day the app is opened at all —
     doesn't require logging a session or entry, just showing up. Only
     ever drops wall slot items (holds, or a boulder prefab on a
     legendary roll) — never gear. */
const CHEST_TIERS = {
  daily: {
    key: "daily",
    label: "COMMON CHEST",
    image: "data:image/png;base64,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",
    color: C.cyan,
    weights: [
      ["common", 60],
      ["rare", 30],
      ["epic", 10],
    ],
  },
  standard: {
    key: "standard",
    label: "GOLD CHEST",
    image: "data:image/png;base64,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",
    color: C.gold,
    weights: [
      ["common", 52],
      ["rare", 30],
      ["epic", 15],
      ["legendary", 3],
    ],
  },
  rankup: {
    key: "rankup",
    label: "MYTHICAL CHEST",
    image: "data:image/png;base64,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",
    color: C.magenta,
    weights: [
      ["rare", 50],
      ["epic", 38],
      ["legendary", 12],
    ],
  },
  holdbox: {
    key: "holdbox",
    label: "MYSTERY HOLD BOX",
    image: "data:image/png;base64,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",
    color: C.green,
    weights: [
      ["common", 55],
      ["rare", 30],
      ["epic", 12],
      ["legendary", 3],
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

/* Backyard spray wall — a smaller pegboard in a residential backyard,
   unlocked from the start (the default wall). Holds render a bit
   bigger here since the wall itself is smaller. */
const BACKYARD_WALL_BG = "data:image/jpeg;base64,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";
/* Beachside spray wall — a glass-walled gym overlooking the water,
   unlocked at Training Level 10. Holds render a bit smaller here
   since the wall itself is bigger. */
const BEACHSIDE_WALL_BG = "data:image/jpeg;base64,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";

/* All three spray walls a user can fill independently — holds placed
   on one stay put when switching to another (wallHolds entries carry
   their own wallId). holdScale nudges hold display size per wall so
   holds read proportionally right against each wall's real size. */
const WALL_DEFS = {
  backyard: { key: "backyard", label: "BACKYARD", image: BACKYARD_WALL_BG, aspect: "1024 / 559", holdScale: 1.18, unlockLevel: 0 },
  basement: { key: "basement", label: "BASEMENT", image: WALL_BG, aspect: "256 / 136", holdScale: 1, unlockLevel: 5 },
  beachside: { key: "beachside", label: "BEACHSIDE", image: BEACHSIDE_WALL_BG, aspect: "1024 / 559", holdScale: 0.85, unlockLevel: 10 },
};
const WALL_ORDER = ["backyard", "basement", "beachside"];

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
      {
        id: "yellow_v4",
        name: "Yellow V4",
        w: 120,
        h: 179,
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
      {
        id: "bd_focus",
        name: "Black Diamond Focus",
        image: "data:image/png;base64,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",
      },
    ],
    legendary: [
      {
        id: "drago",
        name: "La Sportiva Drago",
        image: "data:image/png;base64,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",
      },
      {
        id: "scarpa_drago_lv",
        name: "Scarpa Drago LV",
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAABECAYAAADHsbZQAAAAAXNSR0IArs4c6QAADC1JREFUaIHNml2MHNlVx3/3o6r6c9yzztgzXntWGwsSPqQgFBQk8gLinQceQXkAnoAH8hDxSAQK2odIkQJBfINALA/ZCKSQBxSQkAAhhAhssOOw2l1j79o78fhzeqarq+ree3i4XdXV3WN7PPbYe6RWV1fdunX+dc/H/5zbcERJOz1JOz056vjnJeoog2rFJYBNO0x/5hdWxshfffFIcz1r0Y8bkHZ6YrQFoConqsr3MTdvYG7eoPqjz564go8T+6iLSZpKOZ0svNnEaIqwh5z/AbLPfAGy3slq+Bh55Ar4cPj5MPUA5H/5m+higi4mz1yxo8pjTehhooanyH7pNcKHeQVq26+l21sTh8b21rn8cz/Kha2NF/r24TE+sCw+OEQZQq/DD732BqrbPSm9jixHNqH+cE0kgKjo0x8G5eGIK5B2elKUAsogsprL/Bu/90JyADxmBUQZbDYUj0UbgxLPxubW89LtSPJYE1JaIcEhEji/OaIn+2z86+vI7jUkz5+Hjo+UhwLo9tZE6WgZWpmFa2l3hPm3b9I7uPrCQRxqu2mnJ0HmSgfxdDPLmfUBrvLYxPD+7j5KHOiUcnL/hfnAihN3By+JDwENiASssRw82GE42sJVMQPX36LsY9ng+unTUpYVVeXwWGaLigRBScGdW9dZG20e+wUsALDZUHwIiASCgIjwxl//MfvjMWmaYBODqzw37owxJt4qEtBpT0I5WVHi1e1z8ua3v8VguI62HXTSxbeuu+mUTm8ASgkixwKx4ANKPCKRAGkFiOfC1tmVm9QsQ0uQ2VizMsaaVL721a9y+sw2w9EGwXuspvkYYzFJRqgcr/32F46je9SlPkh7Iwneo40heE/twINewt3dq7y08SqDNCr+vQcFhkDlJY7zDh8cwZUKoNvtyb//x7/wiU98CqUU1lpC5SjLMeBqiJw+c44rl99kc+sCz2YFtIomoTzF/gcrg20S3/TZUxlOaEAGbdEmw2ZDsSaVq1ff4pOf/DSj0RpGgwuQpJbhaAOTjrDpabTtcO2dy5zZ2ODmte8cR/c5gCSdl4pKaURZ9sdjbGPnGdfeucz9g6K5cWY9WAU/9WMfJ0sVwRe8f+NdLmx/lFA5puMDinxMZuDB3evcu/UunTTBmEBwU06f2cakA8698oNPB8D7gJGSg7vv4sNiETDNK4ajDTqZ5S9+9zXu7se4v31mgBJHp5vw3bev8Y2/fZ23Lv0zWy+/SpGPKcsxB/kDwOEF7j6Ycnt3l4P9e9h0wNe//g2K6RRf7vOzv/hrxwYQRSkRvyu++EB0NhSd9mTv/o4ok0ja6YlOe1LmtyX4Aynz2/KVL39JvvLlL8lvfP7zzbmb16+Itqns3d+Rf/rHvxNtU0EpCSGINh359qVviTKJaJvKzs77cvP6FUEp+fXPfU606Yg16VM0DJQSX3wg4ncbAGmnJ8EfNADSTk8k7EnwhUjYaz5lflvc5IZom0qSphJ8ISGE2MFQSlBKtE0l7fREmUSsSRtw9UuRsCf9tQvHAmB12pNQ5fiQgKtiAtOWOlpUVYVNu7iypDc4TxloklGQeHzlv77JdHwToyuy7hAfwBUx4ijlQQpQGaE6AGCa5yTZGv1T5xpFRGV0047k5fSJopGy2VBgHlGaCYNQTnaw6WlMms4WKgatOlcAeO9AGXAVxgSKfAxA1l2PvpWmKKVxxRRjNN4Hsiyl8jJTXGF0nNcQyCd7TwRAK61mjFOWLnhcmaOZKysSs7RSuhlvjEUDJk157/q7ZN11TDrAK4O2CRIEcSXaJngf+Juvvc6f/NkfkCTJwrwAzjmeVFSdwGoQ9UpYFScspzsk3ZdRWmEVeFZXQYKgTcwRwUeyoLRCiUOUBT/lz3//D/nJn/4Umy9v0x9s4FW6AuC9q99hc/P8E62AFQkorQgyT8tKaTyxoKmKkiAeg43JS80fqJSe8SZPTXKSJIHguH3zv8nSDGXmuVLZNTr9DdBps5LteY4jVikdqUPrZD1ZEE+SpWQEHDPuo8N8pUKJAn7ni3Mu88u/8vNMxuMF5bW1oDJMdxOj5wy2Xq1Y7T25+QDYcnK/ceRlMcaS9TaZ5ndI+lvo2UoZY3DlBFdOUezPUBcE5/BlTpZZ4pJEAL7MSQcX0HZu90rp5mW4Yso//P2fEsox3W5P8nyV2T5MIpUwisSolUjUwomaFfP1t0k69PsDqqLET8f4oly5S0KFthalkwXlGxDi0MpjTGD7/MXZySfq9Mwtp9tbE9/idj4ElAhaeaYHu3SGL+NDaEIeRBNQ4rl/6xKdbhcJ1eoDdEIyvAjKoJRCiSBKNbkEP6XI7+HKnP6pbTyQWXvkcNpok0/2lEggeN/YpiiFKEt/uNVwpDqU1n7igdHWjzTKrjzAWpS2qFk/qY773jtSC0V+j/3xmM6pbUQZjInB4qiyQKerfE+5Ytwg1yo6bnvC1Xxh8N4xWP8YB/nqSwvOoYNDq2h+SgSRgDGWD957i1Dc5+y5718okiQIR91MObQr4Yqx8tM9ZRVNfNcqftp+EsNvXC2P5u3/fWf1AdZS5tdIbRxfz1eL6Qzjt9YxGulH+eKqHG2HpjeSdtyuzWd5NXDw4M6bsyjUeohO0Ekf09nEGEsdurXyFJMdRAzD0RZlK5JaxZH84ImyXtrpibSiRDtztwFN719uFK8dW+kEHxIG69u4umUjnozAZHqLqijjtRDDt/cOWmXqw+SJ9gfq3ZraTmFO8KKSClGKbP2HKQqH+AAzZSVUaCYUB9fAVTEiaUuBJu18hKrY497OJSASRK0M6MeH1GMV0t3BS+L84ZlTgjR+Mb51iSzNFh84y86d0ccaOg5gjWV863/Q2Yisu4GyaWOqVf5wUzrWDk2+f1e13/yyK9QR5TO/+lugfPy0lAfI71xZuMe7Kb2Xvg/FhDK/hnNlJJTlo1uXT9USTLprh4a62jd8NaU6uIb4sKB8M262CdcdvUrQnVmodezfuw5A/9Q5nBc63SH5/t1DdX3qnmYbRK34Ai33JZP8PcKM60uoonPPlK+BDUYXcdiG1E0P7qHYI+u/QlVViK9OBkC3tyaRZh9OiX1ZEkJBOdnF6GpF8Vq0tQTn6J66iJtN46c7APT6mzgf96mX5z/2LmUt+SQmvLbySummatM2QacDOqe2F+6rgdTf9QpND3Zj31UZ0s4mSMHB/i5pdnhEemoAEDf/aqeuHVokzDOrUmhl0EkfZfRikWM04kPzUcpT7O+SJQkeSAeRpQYfV3v52c+sr5/2RiuTt3us80ZwjEj/99Z/AnDmI2sL95gspTe8SOVjmdrU4FLXDuMFnU8MwLJJ1QrUtbLHYrRm/87baIktS2U0Sf8VlO0s0Pb2XMs54ZnurOi0J9Yu1rvL0qbqWs3aMoDPr+GLks76xxvKXXfLaxBKacSVC878THygUa6cKKM11tg54Wu9vZpxNh0MiUlPK0M6uEhRFs242odEYhHVvBCzRBSfJQCINIPg8OgF1lpObtMfbkR+s3S9lnb+aMxtZn5N82FmgjUve6YrAJFmoO1i20QrUIvV2nT8PayKtLmW5VqhlrrN35hTC/czBwBAcFgVW4V1Tuj0Bgtvvw2o2N9tjhdAz6Qmjs2Ktra0TgRAXYgslKLK4rzDSVSk0xvgZN7pU0pjCBDm3Y06pwSZO3/8PT8+mRXg8AxdK1oDghmY4dk4zpVMJ7HPFGsO1zhxLRIEY2xTM58YgAZEK2q0W4ltqf3FtxTFFbhp3EyvI1Jb6v8ynSgAoKHBy2QvyCzS1LxJAkEMWX8EgEcaRb13K83k2jxPHEBUQi9SAgmrHQ6lF34nSUKnN0AbcPkuVtHiW55P//hPxPueBwA4vG6oFW+Da58DSC2M7+/SH27EANAq/1wxfki+PwGp8ugP1tgF5RtQEhbMqT6uvKYzPIsnZvgqv7Ew73MDANEfnJ9T7/aOz0J34xAn9yFwWCPhuQKAGZtsxXoJstBrbUv7XO0evf5m/F13DE9Q14dKOZ0opWKDt+E7S62N+q8+y8Ac0QTNbO/uhf1RqZa6jmg7cC3Lzt2Wui54ISvQlvrfXst+sVyJwZzUteWFA4AIok0XallJXoc48Qs3oWVJumvivWv+EdaWOn+0y8oPHYC21D2ntpxoTXwSknTXpPaFw5q8/w+nuqjuoySS+AAAAABJRU5ErkJggg==",
      },
    ],
    rare: [
      {
        id: "ocun_sigma",
        name: "Ocun Sigma",
        image: "data:image/png;base64,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",
      },
    ],
    epic: [
      {
        id: "boreal_mutant",
        name: "Boreal Mutant",
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
      {
        id: "bd_momentum",
        name: "Black Diamond Momentum",
        image: "data:image/png;base64,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",
      },
    ],
    epic: [
      {
        id: "igazu_epic",
        name: "Edelrid Igazu",
        image: "data:image/png;base64,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",
      },
    ],
    common: [
      {
        id: "rental_harness",
        name: "Rental Harness",
        image: "data:image/png;base64,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",
      },
      {
        id: "via_ferrata_harness",
        name: "Via Ferrata Harness",
        image: "data:image/png;base64,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",
      },
    ],
    legendary: [
      {
        id: "petzl_astro_bod",
        name: "Petzl Astro Bod",
        image: "data:image/png;base64,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",
      },
    ],
  },
  chalk: {
    common: [
      {
        id: "temu_chalk_bag",
        name: "Chalk Bag From Temu",
        image: "data:image/png;base64,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",
      },
    ],
    rare: [
      {
        id: "shark_chalk_bag",
        name: "Shark",
        image: "data:image/png;base64,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",
      },
    ],
    epic: [
      {
        id: "fancy_chalk_bag",
        name: "Fancy Chalk Bag",
        image: "data:image/png;base64,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",
      },
      {
        id: "rugne_chalk_bucket",
        name: "Rugne Chalk Bucket",
        image: "data:image/png;base64,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",
      },
      {
        id: "rugne_prism_bucket",
        name: "Rugne Prism Chalk Bucket",
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAABMCAYAAADTAs/KAAAAAXNSR0IArs4c6QAAFDtJREFUeJztm3uUHFWdxz9Vt55d3dMz05NMEkJICOERlBVRUMFFl5WIoAi77CLIygK74hGNiHLcheNxEZZ1FUEQRRERMBJE8eCurEB4yEMEgotEXsFAyGsyk+nM9Ex317tq/6iu6unp7plBOezuOfmeM2fqceve+733d3+vexv2YA/2YA/24P8wjnqiEh/069H4f7sfryekbi+OeqISA9giAMAMlez6qcNKXb+bCw57qhwviCf4xduW/Un1vFZ0bOzQo/46tr5+Q3ZviwAzVNrK2SIgd8lFLFrxTvr0iMPedBCeF/DJjx3VlcRBvx6Nc7pE3U2E5vl3DbxhhNsZALoaZQRtEVAeLwNQ6i0BZMTNUKHmTHLEiiUoqmBo1xi9eYurv/9QHPhh0oAqCPyQz378vRKAbe8mp5fI6W/opCZ96fRwIgopvjrCBlXDCCrERhHJqVAGFhcGKQc+JUVtVqKK7DrwQwo9JpjgeQGapuCJgMu/dV/cY+kMP70R0zTRhYxuqJx10yMxMKM0vF7oSBag8o0vsEgtkcvnASgaOv5++zJu5SkvWkq5UW5ZnMu+KRULuI6f3YdhhOcl61wXMsOj4yiqoMfSAShXJsnrBgBXf/+hFmUohPy6D0DXyt666vT4/aecxgK5QK1BYN1da/CEBoBqFijHCmJ8Cx89+RzcMMpmS9OaY5iSdR2f8WoNRRUZQQA3jOix9GyQdEMlDCOEkAnDCEikRVEFN27ehvP+Y1ukCqAc+OyrTc6q8LrObK5o8dA9d/Kxk87KGjvx5DPbOvG9H13F9bffknyTz3P8u4/FNE0sQ2X78AhLFi0gDCOqrtNstCH2NcdHb9SXPpuoudnMp9CNhNz4ppfZaxpRgNHb12CfcNxMPGcm+8iPvyu9ddXp8R82b8OyLNRQyzohhJyR7TMtXlp9EfuXBgC4PWiI8RcvpEdOCGim4L1/fkKzc2MT2bXd+N+bt1BUgW3bDPRZQFMqUvQEtY59tXuXIG0b/uPJAvz27jXS+95zUgzgBx7QOuJuGGHHEu6UPmUi9q9Xsq3qYBoC2wm579/Pp1rcJ2nUbXZ6n72XUBAGI5aFpib1u5sdLMvKJApAVTSkCZfKfT+neMyHmkRFwN7veze1r17MpWsfjS8+9ciuojwj2akoFQst9xM1N7vus/JsqzoszhstZQzNAhLCu794NeVKBSCTAoChbTu48oiYk866DADNswljK3sva806Vc9B+sWdbHniURbWQuRzP8tWM9EhC7W+WTnMStZ2PSzLypQGJFo08ENcz8FxqhBXMM3+FufDFgGS7BNHBgNaYnPL04gCiMWLmFeY4LHbvkYcV3jgxRrLdl/Dfuoof3flfM5XJvlClGOi6nPy35yJ3ujDmv/6GfF3LmUxYEoxuwODO2781p9GFhIRGq/W6M1b1BwfVdEAD9cDw8jze/McAKRIAgkCkcy6our8PjyYM8WXMUMlIzrdTmuKD2FE4E5y9MoFaI+PAnDLOZuQbt2Lw8cN1uFnRAFOP+6kzAIAXH/7Ldhh6zKbDnmml+dc+N0YYGhkmMAP2T48gm3b2LZN4IfomoHm2W3fKaGO0mj4QO23XFj9aeKJNZTXdNORQRTQpAjecW0yeAtiJGkXl3oxQqoxXq01BlGgqAJdyNmaPuW4k3l+3fdnND0zkgUwdQ1T13A9B9v1sud7LxpAUQWuL+NFieMR+3Hbn3A03u88TrkSdGuCNz/d03LvxTJCr+BFecKLdaT5FdYc8O6MaOCHmfJK3dLevNVW73R0FeNzL7oxBtA1g4G+nmy9prBtD1XRUBQT6bLl+IBQE1sq1W3C/qTxyPcxHIuDv1znZa9VybVAhCiYAGhSRPi2m9Ae+xhUJTh/gt/8Wz/jCwYZ6OvJHBGgxe7PhhlnVlN1XM/p+t4PPHryKoEeoBSabmKcM5sNqCpK3ubaq2/oVEUToWi59QKVyZxOVOtBCmIe7x9DEfnMEYHEK5vq4MyGGckesGwJg/2lju9SFzJ1H2Nn9sY6oRz4HSMgTYrQD/wm+8lfJ3SLXHXGFl55YR3Q9Kh0Q81Eei6Ydc0CbSIMiWMf+CGRm3hDkiGIDDn7SxH5Pn4QMW/Cxu4wIKmyOmJjvu2dopiM1QU/1RInokc03cswjChXJqm6DlXXaYm8XjNZTdUznzUMoxYnIgyjTDNmz+icwVEVGU0KMMbqmEZrh9LMRwbRPhh9Vp5PbT6IKCoCrQpKVTRURWtzeLphxpndPjxCzfEJ/BCrITphGFFz/Ez916uJhhaNACry/ZY/P4jwYoUg19NW/9QkwEzYFRRY8YN3sMkJqTl+FlQkLuzc0bGVU8+9IjZ1DcuysBrrIiWaNpJlIpREGcVOSHThS2hyFQBJTcinDgYAzufn3LEgsKlVh1n/9uV8OL+M0QM+g3vxJ7j3oV/y4WM/CEDJKGT96rTUpqNrCcuysrhz6noQQiavJ+ZIUQW+OQ89aoqjFDTFOfbjzMEI6/2zpmK2j00JAxUTy8zRS0hR3g3A5KXfJhp/pY1Y4IdzMj9dyQZ+iDutgrSRVBsC6OEkgQiRDIEyVm4pn85uipnE1QwVTt452PJM0ecDcOcB7d2cTnguM9s54WYk9lVRBduHx1re9RaT6MKaQjiMdRQnwDv6JxhPnoZkdp7BblnKFDO9c7wapiEI9YEswA/DKHFbjS7u5zR0rN11XB584G4AIs9pCbNSHH/CyS33gQjRpAj/sB+jPve3bbOq6zV0+0m2eYe2hYItEGGbgwFw358JjvldyNbV/8K93/0aHz72g5necB1/ToS7DuWqVScy0Jdo0OkismXHTja9vAnXcYk8B3I9KKHAPeNq9Fs+jfOmNZgvfrStzvu5mgPjq9gwnCixNw8OtJXphsXCxzTUzFanfXrd3EUh5I5rYcmiBRx2yCGsXLkSITXtreIqeLGc+LYH3kx44M2gHdb2/cK+QRaViry0fRMbhkfn1FGAX+4zQt2tsmHhYtbe8cPMi5vLeoUuZNded4E0sntX5qmkmKi5bf6o68st2ng67GXnt95PVBnbtZFXdoziKImjsH7LEOu3DFEOfLygszgK4bFXj8WOQzYy9Ln9Ee5o1qeJmjun2Z3RmqeJsVSc/cDDDwC3NaQKfQOhOgjVofaJb8K3z0viUhIf193vO4k9DmxeBSJhISKF8tBu3rLZoM9KlJ7thKx80ua5t5vZ99MR6APo1WcA2FWuMa80e2g3J7Ip0dQ1TDIUCenxag3TTBwKpd7MFhYrHtu2/W5OjQ+NuPzchM+vG+HFI48FIKcXuffVVzl+aWKGKuObKfYuBWD7RA2wyIv9WHfD2fzl2TfwFx84Oxv4a296JJ4psT4jWddzCHwr8z2bWi+JJYdHxwFw+nIYWkzshEgVD0Vr+qqBNwlAvtDuv75lfkLoh/N1Dn+xQiXMMVEbY//eGtu3bsjKVSc3kC8UOPqlA1mcN1i/ReZQOSZ2o2wCgFlFedaZTSMK0cj2t3w8xbNyPClLtJZKCYladRirdxBEK9FaNcnx1uw6kAzEE4cbHP2CTKm3xLwVeXoJW2Y1COwskFi6YDFDXg1T9PL0y9s4cuWypMwsoV5XsoHvU6lOomsG49UapWKhxYiHYcRPH32IB/ZZjuonDnmEjKgka1KToqyj05E+D0ONOK4gSUXygGmqlCsBuThu25hRFJNypUJcGESSHcZqVcZWX4RxydkcufKSpMwsYd6MOruYb85IuTLZMrtCyFR0hbzfjDwi32+rYyYI4UE4iRAeQng8vTL5PlVO0wdr6ztzWVr2zYMDLCoV0fP92YzOZoK6vvU9j0p1kh3DOwBa1kYKaZbUZRDY2V83pP5v0lmPP7y9exoI2mPgnXsfzPd+dBWBH7ZsqHXCjEMRNGYq8EP8wGtRAFOvxTSZ0xQfL5aJhIWimCiKmRGeifhcYTthls4prf4Mu+O5mZ85b39AYncHB3qBRGTqO4eQLQUaikMJBbINK59uD9RLSvJdObDI6RKP7199LU032vRQdz6K7e3Lzt05iqJObBTJLV3Oz+66jVNPbndRp6LrzLqO23I/NYCf6kVBMyUj1ZNZs52QkqJSrlSy/Z0UJUXFDJWOOae54LHCN9i5+HyKoo5Z3IucnoczzyNyJ9A0hetv/U3XEz4zirHvJcpnx/COFk1X6DE7lk9TqHW32hCzPDk9z45yhY3lUTaWExevHPjZAZLXhEaOKvZjhnpWU3cT6RirzU1KupLVjabyUVSVWq3p8Nt2My2ze7JdAy+3u+eGUsKQZBRHazMruakQz/49mEmXpR6ZiVrSdp+Vx45nP5Ewa7jgex6B72O7XrYzYJoaiipQZZf+QtPRkOo2UY9Hv1/OQrF09KeiXKlQUlTqbszx2+cWeMsbzmi2o0qEequj0iO53Lz2B20b2C11zNaIqmkoqornN9fw1AoDEWb2Nc6ZxDmTm267F0j3ZzsjneF0/T4ZzSMM280bQOCOtCUDAIqinl0/t/or1CVtRvPTkWy6eweJCGcVbtrUuRJVJfJ9JD1Gqtv0lUcgThRTf2GQPitZu25Ayy49NO3mWc/WedcmrWmapuSQ9Vc+19amcCcxe/IYmoWhWZSKRQLdmnFmOw6D73mompaJcCfiAIW41fEOJYHoz8Nw0mFJThyE9KhBCjcAvdFyuRJkPm/djZGkIl4coD36SQIzQrFlwsECcrUZWUmqRCBcFukvMyb3N59PuC3J/DmR7ViwQXTLjp0sWbSAwA8Z8xxkNQnAZVVFICV7PkWNZ6/5Dq6loNcCNg72cN6Bh2MvHcwCdjcgM0t1F3JayFhdMP/hpL1NNx5GjzKBhARx0LLfEJOI5IPS3fhesmRcS2FlbSe2bfOJy9bE377o9Da5n9FdNK3mmgt8PzvgkYZ2U5F6UZIhkAyBqkUUfR9D9Tlkd5lfPfBLnv/JbfTlQnQlmdlUpN0A6l6rEy+bU9xGSWn+TWvT0GIMLaZn0mG7lufn6+7vRqk7WVXTWkQYaFFSc0I8JXmuJx1af+0aclrYQjRFOgj6FE4hjTg5qCf1dSGeoiblOj6HOe7iAeRyeTRVx3a97MySHs7yeaNDoSTwgwhJj+krj/Chh9e3kZquuCK7mW6NDJlAMZv1EXfdSAN47JGnOj6fUYynKySApQsXtmzvA4i4S9A8ZWZlVcUPIpivctUzD7HihY1tBFNtndNCDj7jxJZ304MNmEJ6dzVzVa24jmrv6tidrmRNyyLw/TbCm4eGmp0TUUbU971sQzok7tg5VWk2d/89D7a9T2e67glio9iV5Ey4x3EY8TvP+qxinBKu15ue0PbhkeTQpZ5jq9mD46sooSAQIX4azE+ZVRGHbbM/aTbFNBXp1P0DkJwKvjete406BVI2CMq0kLHUsNvpmZCp6Gp67IYvrGqJV5PLNaOUqUcPlq86DYC7b/0P3lvfhF/QMmJS2Oojx6LpIRVsB9f10XW1hSQkomwAplwjcnR8WUGOAkAiEB6qIhO7EqJuE/sC5uZxdt/rgSQY6LZ2AeS8wkDOoRLmWPWRZM90090/YsFkYprUySiLhKS6jdTTOUDQdRXXbSU8WjcIL34agFyoE/sxkioh+zHYMb5eQNxRQn6mcwQ23ZJ0Jbv2ugukU8+9IgYyW+v5LpqqM9Dfl50si6oB6xZ+j2Ne/AhlJZnt5atOQ9Wb4regr3ld6i3x8IrEn61LEtydLI3pRAEGcg5hvR9NrhJP0bzS0wXiB4poYQ/xRMOD8xs2Wg2b1x0wc97YcSn29rfY11qtRm+xKY5L4o1sWX45Szb9E7uCArKh4btRRnjnWISuq+gKjO0YR97XJxJNZ6U64bYMTirasVFkn12XMjT4mWaH7AhWfJGtJxZYeNdW4lMOAZIMxjiCvhMuy4qmsfhUzKqgpjsSU0+5+VHiUel6jZ2L/7mlnO82/WbX9Zmo+biuT+99ICKlrYzvRtl9dcJlouYzWm/d2owVibvmLeL6B1/hklzAi5MhY47EGXfeTyEUycwCOVNjMmxP3M3ZN57qLgLZrnwh9oh9wJSIDlnN6EiOp3gHx4+f0kJmKnK/GGPLoXkiJxk4n6akpFLhVhqn5YKYWJGId0r48y0eXf8Msglf+tCbeM/Zl7DsiCPJD/QyVo+ZB5RliUlJ5o5rPtdms7qSTdetXatlGnk6VNlFUqVMeQAMzK+zivsJ5t/PQes/xe5c8+jAhDUPSOJQSWquw8jxkA0tu05P2I8vviYZSD9GKsZsu/lgzr78CKSKw3PjMH9wf678x2MIJpsC+skFgxR2vdqxv7Na7FPPvSLWDT0L4jVVZ2Fjj+ban93K5k9vQM5pYEotAXYgXISjZYc401M02DH3PglLjjyWlRs/mJFMiQLIhkYpKLNj0VeQ5QqSCvE1exOPTUvS+U3RTfG+gSL3r/1qR16zrtm1110g3XTVeRIkolyvV3lh4/MMjQzjRzrj2zwktSFujZOoQHYEV5OraHI1O0UjqdAzEbOovrmFaCdIk8mmWOwDYXt6NiPc0MBOPvlFStf6ZiPbCaeee0U8Mr6TsW2voCgmj12wETmnIU0zx7FP9ixuWBdJTa4vW7OMLx3zBaA5o9MR9K0mVh0k34BvHYBfaPzMZtLjH5T5/CFOBmNCFuSNXvzaVh6/5/qunP7kHwm95bjPxiUxzt0ffzYjHFY8MOaBs4vxbU0igdtMkm0rreDs/5zfqcpm5yZaLYEeJuSCnEnoKnzgr45hbHicxx55irhH53e3XT4jn9flF1FHnXRJrOmTHCs9yDl/HvDS1qYdHVcWc8GvbMy+fYjtMmZDMaWpTzXO4dXHyOWTWTMUA09o7LVwBWuvu+CN+cXWH4NzL7oxfvLZ/yZ0k3Xj+onb2CMLNFPw8J3XvfG/NtyDPdiDPfj/gP8BWOQ6B3sHP/MAAAAASUVORK5CYII=",
      },
      {
        id: "sloth_chalk_bag",
        name: "Sloth",
        image: "data:image/png;base64,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",
      },
    ],
    legendary: [
      {
        id: "moritz_chalk_bag",
        name: "Moritz",
        image: "data:image/png;base64,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",
      },
    ],
  },
  trainingTool: {
    common: [
      {
        id: "resistance_band",
        name: "Resistance Band",
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAdCAYAAAATksqNAAAAAXNSR0IArs4c6QAACg1JREFUWIXtmXmsXFUdxz/n3HPnzkxn3kaRttgSQYNLwRoWERd8xCgWrQIa3BLjQvQPqoCJCIZaq9ZK1CgBV1yioIa4lliwLiSiYGoVVBQiEdxA+0rmzXvzZubO3HPOzz/OfTO9b2uJGIzx99e995zzW77nt51z4f9UIPVoF+iJC0XsNBhQkTmEUwSASA/pZSgTD4bEZjB726OW9XiQOfwUYGRS8Cn4GJ+USd6yFR3nAJSHhvddDwWUM43PHH66hU57uHaE+3EsAOJbYfLcnf+VAK0IiD56szA2QXzOhRAJfm4uDKTgMxueMzeYH2cCscLNNcP68TruwRbEdaCLPvU8zDOegr3vIdydiB7dAIDqthAewTf2Pe4gLauAHj9T4nMvovbCTczd8zekK9RP24C1hvRn+5FVE6iSHsyXvkdcG12rUdu4HluN6dywF2lr5O/3UrrwFfQ+fy1qZD1m88uorBtj7uafwTHHonqP4FPgd9/Bm7BHqtd+XABaUqCaeLHot2+jNOFwf3qIyjNPghFFeteDkAm6agahotJssM5nrhBKqloKA402ANXj1zL9vl2QdRi/dDvT6T/gmp2Iq6GNwWx+NYyvBiDqVeh+8+qQfyDkpAhQFsRAD2R272MO2GKG8YmSXPJRys96ErPfu5WJV26h9dP9waAN6wFIs5T0Ex9ARWVwBEUBelC77oPoqIr6yzRplhI/aZRVq8pILWL6O78Z8Jj58JWUtrwZveEYup/ZBTZnYh3oDB0rogsuRtdqBfV01eBbDt/IsLt3IjKfw9ow99t/G6BCDlEjL5Zo4+RglwFW1ROaszOMTZ7B9Ec+Bu0WknYxT31pDmClwLB92XaIY5LLLiM5bi3tb/+c0gWTtH5wLxMv2cj0t39F6YynQVKhv/vrKDNO9Pad6Lv34X/xIzh6/YCX3X09iEHFi1OdSJf4dVdhZBUAWXsW/bsfS/bIg/mMGLEtZOonjwqkBZK6qLEEnzmMCu7ebvXQlVFsNYbXvSYA963bsPfsRZkYVRkfLs86RKe9CAB/YJb2L+4bDKmSJms4fDlBm1XgQBuD3nAC9vM7SM57N703bES+uh01cRIA+pgzC9oVyjxgb/4slhgIYeUyGL/sA+GZDgCzV6eCShBiFM3D5qXCoKqfKtFLLkIfXSd5xvF07rwLgLHJM5i5dV+YM1ZHxeBmZwCQW24arI/Ovygo09eYSoXKWSeQ7vklLu0zes7pzNz4XVRllNIpp9C57kPB6E3nQFRFfn8LkDGy9QpaH78yMFxzVpgT+SCL0rKGiAtVzx+4I+QYQKmEkUvfTbfRxJRH6N/8A+wDt6NNHdfYs3T+PPRFj58pYvtMfO5ruD8foHziKI0f3oObncGoMnrT8SSZpntgGv3EUfyBWfQxI5hyUmCqJ0Lc9+/5K2bdBKVywsyt+4jKJUpnPI25HVeipIw4i950DqpaHaz1v97NyNYriKjS2Pk2lCkRHffCoeELQJkHYmBQZFD0EUr4g/ei+g8P9TrtPKS2BhWXcXs+GuRN31F0igK32nPkqPdeS+Nz2xi5fBdquomrx6R3P4A0W/jqKLozw+gFk3AwIz34COWnrw1r222sDTtjjKXTnA3gNZqQ9yc6juhd/2nUxkm4+0dh3aYXIeVRVJYhcYxuTuH/fDsQM/6endBOaXz8CpRrwrrno1QxZy2khWElzqIigzg78B7tDLzhEuSWr+Dvv2F5QNTI86X6zg+SzvSQb34CMlCvvQRpNoh9F8ZX47stpBm6TUk80cjossrFq48FwLZmyG76Aqgy6umT4DoFQLxN0EmExHnFUAbEwv23QSdj/PJt2NXC7CXvOMRSg15z+mEBWYrcX+8AC9ELzsfv+z5+6uYBDsUqY3qkLlQY8/K3AdD/4vtQlTrurAuIAP+EDZTXOg5H3rXpXnsFqARMDTaeCxJyAdEwRJTTqEgFMCyQVxQVGfTp5wPQ+PDFUK4yeun7iaiSdkLH3L7uKqJIcE4Rb3hewGkFnebDS5kEhSN68jr8XdXCnAIgnjIRRUredCVWJbhv7MLawLBjBZJKLiRF56skikFZxFo0KTzrzSAeyTLUPBhLkdLBrbHBM1Rxl83ZW3FRn5lrtg0/OsVRV3+Sftqj5OtMb38TYmqhTLP40Jkri3Kwasc2bNrDH5hdpEpBsl4ER2jJI7rIc99KxDCB+V7eQVpQknerueMU41Cj4kNOvnGMSkOF8tjQfEZA2oV8nspPBK6TElXLAESuBGdvHfLJ0tAXAe12i/HtXxrKbKcAdOI5qmMj9NPe0EazCtPXzH1kG7jgLcsCshLpHAyxQ6dUWYaoGHHFjVARyHxUreAZigz/h72w/ixYuwYkT4A9i0oMymZAeem1cZkoDymZmWJ6VyjVknXDuEqo79iJtaHfmafWjssRm6JPehlq9Rr8bTcU+BYAEaOWPNz4qXxHe9kwaXV7YDRkPVB6CAAUnoN2YctVNIxxZ7uDOxKVToni1XDcerAZmGF1OCKqjhBNvjHwffifaN8HYPaqdw3CR7AoDPrZW/A+hshAZhexWlCjVlZA1yr4ue5A0UWGL0VKBy/JQdO1GEkhHG9zsa39Sv+tIqq8GT/2hCNgukBEHLxIsnQABgAnnouOhh7tdd7D5DlKrKAW2FCsMqXxwqCfbgcUY4Of66JjA90eQu+QRXoYFkqzEqmIQRVZSO7g7aqSzUg/HoVNrw8KqyMooZ0UNTdMjpLUg9fm6jgnuWyF9n2k46EcD0z3tuglCzykBXOdwasvayiX0K0+JBV8RhGAw1HuGYcCpeIyfuqhJW/Mus1wWtX7nchJr0e5LozVl2Xvp6ZQgNRGQr5Ju4vmqEghOShel9Cuj7B8SBa21D+8R8ktXwmMSuE8AoRd7WfQbBbBEL/y+/w38vyhYvj9fpj++7JGQt5O3/s9pN9DsnTRuGu2cM0WUhuB8nz5t4hdeqNUtERmXMb7Fn3199+gdLsh7tmvwddDzPm5bkiiR0rznjH/ah1iQX79KSiVj+gmTA7uVQrE/aaB2RIqiJ9tDcvzAoNCxSuG7LxnDOYsBcwCWhIm//AeJT9PRZk6bNyySMhyjMUJ+DwmtUGZCLEOdd+tiO3B3G/VEQZb4Hcw3IjZ3Ttl/pDn1p1QAEMZtag7XQjE4HuW4UfH8+piITGILXrgYSGrjJ0sqR+Fk18F2gwNXkDzLfSAtEHuvAaS5DG5yQKg9hzBh+ZNl9einrsZyKOy00acoJMI38tLh7eLdNaVJIQuoO76Mu7g7Sucdlei6gtEmYC8HOJYCotgwmURGSqyiDN4HDR++p+7JFbPlGj8WCQC6bXg5Feh4hhldABkmY1TpQT55fWouI5vLP5X9Lhf+z9WpOqnCvnVgORgmFMuhLxz9anG//FG9GFy2P8MIEtS7WTRpaMQYoT0P+ux/6v0L1JEZ4vDekrUAAAAAElFTkSuQmCC",
      },
      {
        id: "resistance_rings",
        name: "Resistance Rings",
        image: "data:image/png;base64,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",
      },
    ],
    rare: [
      {
        id: "beastmaker_1000",
        name: "BeastMaker 1000",
        image: "data:image/png;base64,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",
      },
    ],
    epic: [
      {
        id: "beastmaker_2000",
        name: "BeastMaker 2000",
        image: "data:image/png;base64,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",
      },
      {
        id: "crimp_battle",
        name: "Crimp Battle",
        image: "data:image/png;base64,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",
      },
      {
        id: "quad_block",
        name: "Quad Block",
        image: "data:image/png;base64,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",
      },
    ],
    legendary: [
      {
        id: "woodclimb_v2",
        name: "WoodClimb Change V2",
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
  // Mystery Hold Box only ever drops wall items — never rolls a gear slot.
  const slot = tierKey === "holdbox" ? "wall" : LOOT_SLOTS[Math.floor(Math.random() * LOOT_SLOTS.length)];

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
   Chests) and the XP total (used in the Training XP breakdown).

   The first entry in a series only establishes a baseline — it isn't a
   "rank up" yet, since there's nothing prior to improve on. Without this,
   logging your starting numbers across all benchmarks (up to 6 series,
   counting both hands) pays out a rank-up for every single one in one
   sitting, which is a wall of free XP/chests for onboarding rather than
   the reward for genuinely getting stronger. */
const rankUpEventsForSeries = (entries, scale, bw) => {
  const sorted = entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  let bestTier = -1;
  let count = 0;
  sorted.forEach((e) => {
    const t = tierIndex(scale, scale.metric(e, bw));
    if (t > bestTier) {
      if (bestTier >= 0) count += 1;
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
    name: "CLIMBER",
    equippedTitleId: null,
    // No gym access right now — quest pool stays home-only until this
    // is flipped on. Toggle lives on the Profile tab.
    gymAccess: false,
  },
  entries: [],
  sessions: [],
  quests: [], // weekly quest draws: [{ weekKey, questIds: [...5] }]
  loot: defaultLoot(), // opened chest items: [{ id, rarity, slot, date, itemId?, name?, image? }]
  wallHolds: [], // placed holds: [{ id, lootItemId, x, y }] — x/y are 0-1 fractions of the wall image
  customItems: [], // user-added catalog items: [{ id, slot, rarity, name, image, w, h }]
  equippedItems: {}, // manual gear-rack picks: { shoes: lootItemId, chalk: ..., harness: ..., trainingTool: ... } — falls back to highest-rarity owned if a slot has no entry
  loginDates: [], // calendar dates the app was opened — earn-rate for the Mystery Hold Box, independent of logging a session
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

/* Shared short WebAudio blip for passive feedback (XP toast, level-up
   reveal) — separate from TimerTab's own beep, which has its own local
   mute toggle scoped to the timer only. */
let sharedAudioCtx = null;
const playTone = (freq, dur = 0.09, gain = 0.05) => {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = sharedAudioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* audio unavailable — silent */
  }
};

/* Plays a short sequence of notes via playTone. Each entry is either a
   single frequency or an array of frequencies played together (a chord).
   The final note rings out longer than the rest for a satisfying finish. */
const playJingle = (notes, opts = {}) => {
  const { step = 100, noteDur = 0.11, gain = 0.05 } = opts;
  notes.forEach((note, i) => {
    const freqs = Array.isArray(note) ? note : [note];
    const isLast = i === notes.length - 1;
    setTimeout(() => {
      freqs.forEach((f) => playTone(f, isLast ? noteDur * 2.5 : noteDur, gain));
    }, i * step);
  });
};

/* Loot-reveal jingle — an ascending arpeggio that gets longer and ends in
   a bigger chord the higher the rarity, so cracking a legendary feels
   more rewarding than a common. */
const RARITY_JINGLE = {
  common: [523.25, 659.25],
  rare: [523.25, 659.25, 783.99],
  epic: [523.25, 659.25, 783.99, 1046.5],
  legendary: [523.25, 659.25, 783.99, 1046.5, 1318.51, [1046.5, 1318.51, 1567.98]],
};

/* Fanfare played on the full-screen level-up reveal — fixed length since
   there's no rarity axis for a level-up, just a bigger finish than the
   plain XP toast's two-note chime. */
const LEVEL_UP_JINGLE = [523.25, 659.25, 783.99, 1046.5, [783.99, 1046.5, 1318.51]];

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
            transition: "background 0.2s ease",
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
  <div style={{ display: "block", marginBottom: 10 }}>
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
  </div>
);

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
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

  /* -------- daily login streak — records today's date the first time the
     app is opened each day, independent of whether a session/entry gets
     logged. Drives the Mystery Hold Box earn-rate. -------- */
  useEffect(() => {
    if (!data) return;
    const t = today();
    if (!(data.loginDates || []).includes(t)) {
      persist((prev) => ({ ...prev, loginDates: [...(prev.loginDates || []), t] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data && (data.loginDates || []).includes(today())]);

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

  /* -------- XP gain / level-up feedback — compares this render's
     training XP/level against the last one it saw, so any action
     anywhere in the app (not just Profile) can trigger the toast or
     the level-up reveal. First render after data loads just sets the
     baseline silently — a returning high-level user shouldn't get a
     level-up popup just for opening the app. -------- */
  const [xpToast, setXpToast] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const xpTrackRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    if (xpTrackRef.current === null) {
      xpTrackRef.current = { xp: trainingXP, level: trainingLevel };
      return;
    }
    const prev = xpTrackRef.current;
    if (trainingXP === prev.xp) return;
    const delta = trainingXP - prev.xp;
    xpTrackRef.current = { xp: trainingXP, level: trainingLevel };
    if (delta <= 0) return; // only celebrate gains — imports/edits can lower recomputed XP

    if (trainingLevel > prev.level) {
      setLevelUp({ level: trainingLevel, chestsUnlocked: trainingLevel - prev.level });
    } else {
      const prevThresh = trainingLevelThreshold(prev.level);
      const prevNextThresh =
        prev.level < TRAINING_LEVEL_MAX ? trainingLevelThreshold(prev.level + 1) : prevThresh;
      const prevPct =
        prev.level >= TRAINING_LEVEL_MAX ? 1 : (prev.xp - prevThresh) / (prevNextThresh - prevThresh);
      setXpToast({ id: uid(), delta, prevPct, nextPct: trainingPct });
    }
    // `loading` is in the deps (not just for its own sake) so this still
    // fires the instant data becomes available even for a brand-new
    // account sitting at exactly 0 XP both before and after load — without
    // it, trainingXP/trainingLevel would be identical across that
    // transition and the baseline would never actually get set, silently
    // swallowing that account's very first real XP gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, trainingXP, trainingLevel]);

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
      {tab === "wall" && <WallTab data={data} persist={persist} trainingLevel={trainingLevel} />}
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

      {xpToast && <XPToast toast={xpToast} onDone={() => setXpToast(null)} />}
      <LevelUpReveal info={levelUp} onClose={() => setLevelUp(null)} />
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
        .cq-rays { animation: cqspin 14s linear infinite; }
        @keyframes cqspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cq-pop { animation: cqpop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes cqpop { 0% { transform: scale(0.2); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .cq-toast-in { animation: cqtoastin 0.3s ease-out; }
        @keyframes cqtoastin { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .cq-toast-out { animation: cqtoastout 0.4s ease-in forwards; }
        @keyframes cqtoastout { from { transform: translateY(0); opacity: 1; } to { transform: translateY(10px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .cq-blink { animation: none; }
          .cq-rays { animation: none; }
          .cq-pop { animation: none; }
          .cq-toast-in { animation: none; }
          .cq-toast-out { animation: none; }
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
              {featured && (
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: RARITY[featured.rarity].color }}>
                  {featured.name || `${slot.label} TOKEN`}
                </div>
              )}
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

function WallTab({ data, persist, trainingLevel }) {
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [msg, setMsg] = useState("");

  const unlockedWalls = WALL_ORDER.filter((k) => trainingLevel >= WALL_DEFS[k].unlockLevel);
  const activeWall = unlockedWalls.includes(data.activeWall) ? data.activeWall : "backyard";
  const wallDef = WALL_DEFS[activeWall];

  const switchWall = (key) => {
    const def = WALL_DEFS[key];
    if (trainingLevel < def.unlockLevel) {
      setMsg(`Reach Training Level ${def.unlockLevel} to unlock the ${def.label} wall.`);
      return;
    }
    persist((prev) => ({ ...prev, activeWall: key }));
    setSelected(null);
    setMovingId(null);
    setEditMode(false);
    setMsg("");
  };

  const allWallHolds = data.wallHolds || [];
  // Older saves predate multiple walls — those holds implicitly belong to
  // the one wall that existed back then.
  const wallHolds = allWallHolds.filter((w) => (w.wallId || "basement") === activeWall);
  const lootItems = data.loot || [];
  const placedIds = new Set(allWallHolds.map((w) => w.lootItemId));
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
      wallHolds: [...(prev.wallHolds || []), { id: uid(), lootItemId: selected, x, y, wallId: activeWall }],
    }));
    setSelected(null);
    setMsg("Placed.");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {WALL_ORDER.map((key) => {
          const def = WALL_DEFS[key];
          const unlocked = trainingLevel >= def.unlockLevel;
          const isActive = key === activeWall;
          return (
            <button
              key={key}
              onClick={() => switchWall(key)}
              style={{
                flex: 1,
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 8,
                padding: "10px 2px",
                background: isActive ? C.cyan : C.panel,
                color: isActive ? C.bgDeep : C.boneDim,
                border: "none",
                borderTop: `3px solid ${isActive ? "rgba(255,255,255,0.35)" : C.panelHi}`,
                borderLeft: `3px solid ${isActive ? "rgba(255,255,255,0.35)" : C.panelHi}`,
                borderRight: `3px solid ${C.bgDeep}`,
                borderBottom: `3px solid ${C.bgDeep}`,
                opacity: unlocked ? 1 : 0.55,
                cursor: "pointer",
              }}
            >
              {unlocked ? def.label : `🔒 LV.${def.unlockLevel}`}
            </button>
          );
        })}
      </div>

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
            {wallDef.label} SPRAY WALL
          </span>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 15, color: C.boneDim }}>
            {wallHolds.length} placed
          </span>
        </div>

        <div style={{ margin: "8px 0" }}>
          <Btn onClick={toggleEditMode} color={editMode ? C.gold : C.panelHi} small>
            {editMode ? "Done editing" : "Edit mode — move or remove holds"}
          </Btn>
        </div>

        <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginBottom: 10 }}>
          {editMode
            ? movingId
              ? "Tap a new spot on the wall to move it there, or remove it below."
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
            aspectRatio: wallDef.aspect,
            backgroundImage: `url(${wallDef.image})`,
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
            const widthPct = item.isPrefab ? "32%" : `${holdDisplayPct(item, wallDef.holdScale)}%`;
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

        {editMode && movingId && (
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

/* ------------------------- EXPORT / IMPORT -------------------------- */
/* Whole-save backup as a plain JSON file — no account, no network. The
   only way data currently moves between devices. */

function DataPanel({ data, persist }) {
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crimpquest-export-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: "success", text: "Export downloaded." });
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // clear so re-selecting the same file still fires onChange
    if (!file) return;
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        setMessage({ type: "error", text: "That file isn't valid JSON." });
        return;
      }
      if (!parsed || typeof parsed !== "object" || !parsed.profile || !Array.isArray(parsed.entries)) {
        setMessage({ type: "error", text: "That doesn't look like a Crimp Quest export." });
        return;
      }
      if (!window.confirm("This replaces everything on this device with the imported file. Continue?")) return;
      persist(() => parsed);
      setMessage({ type: "success", text: "Import complete." });
    };
    reader.onerror = () => setMessage({ type: "error", text: "Couldn't read that file." });
    reader.readAsText(file);
  };

  return (
    <Panel style={{ padding: 14, marginBottom: 14 }} accent={C.cyan}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.cyan, marginBottom: 4 }}>
        EXPORT / IMPORT
      </div>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginBottom: 12 }}>
        Download your whole save — custom items included — as a file, or load one back in. Handy for
        moving to a new device or keeping a backup. Doesn't sync automatically — you move the file
        yourself.
      </div>

      {message && (
        <div
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 15,
            color: message.type === "error" ? C.red : C.green,
            marginBottom: 10,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={exportData} color={C.cyan} small>
          Export data
        </Btn>
        <Btn onClick={triggerImport} color={C.panelHi} small>
          Import data
        </Btn>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />
    </Panel>
  );
}

/* -------------------------- LOOT REVEAL ----------------------------- */
/* Full-screen chest-opening reveal — spinning rarity-colored sunburst
   behind the item, tap anywhere to dismiss. Purely cosmetic; the loot
   item itself is already persisted by the time this renders. */

function LootReveal({ item, onClose }) {
  useEffect(() => {
    if (!item) return;
    playJingle(RARITY_JINGLE[item.rarity] || RARITY_JINGLE.common);
  }, [item]);

  if (!item) return null;
  const rarity = RARITY[item.rarity];
  const color = rarity.color;
  const slotLabel = item.isPrefab
    ? "WALL PREFAB"
    : GEAR_SLOTS.find((s) => s.key === item.slot)?.label || (item.slot || "").toUpperCase();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(12,10,28,0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 320,
          height: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="cq-rays"
          style={{
            position: "absolute",
            inset: -80,
            borderRadius: "50%",
            background: `repeating-conic-gradient(${color}55 0deg 6deg, transparent 6deg 24deg)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -25,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}66 0%, transparent 70%)`,
          }}
        />
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="cq-pop"
            style={{
              position: "relative",
              width: 260,
              height: 260,
              objectFit: "contain",
              imageRendering: "pixelated",
              filter: `drop-shadow(0 0 20px ${color})`,
            }}
          />
        ) : (
          <div
            className="cq-pop"
            style={{
              position: "relative",
              width: 140,
              height: 140,
              background: C.panelHi,
              border: `4px solid ${color}`,
            }}
          />
        )}
      </div>

      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10,
          color,
          marginTop: 22,
          letterSpacing: 1,
        }}
      >
        {rarity.label}
      </div>
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 14,
          color: C.bone,
          marginTop: 10,
          textAlign: "center",
        }}
      >
        {item.name || `${slotLabel} TOKEN`}
      </div>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: C.boneDim, marginTop: 4 }}>
        {slotLabel}
      </div>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginTop: 26 }}>
        Tap anywhere to continue
      </div>
    </div>
  );
}

/* Small transient card at the bottom of the screen whenever Training XP
   increases — shows the XP gained and animates the training bar filling
   from its old position to its new one. Auto-dismisses; no interaction
   needed. Skipped in favor of LevelUpReveal when the gain also crosses a
   level threshold, so the two never stack. */
function XPToast({ toast, onDone }) {
  const [animPct, setAnimPct] = useState(toast.prevPct);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    playTone(660, 0.07, 0.045);
    const chime = setTimeout(() => playTone(880, 0.09, 0.045), 90);

    const DURATION = 650;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 2);
      setAnimPct(toast.prevPct + (toast.nextPct - toast.prevPct) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const closeTimer = setTimeout(() => setClosing(true), 2400);
    const doneTimer = setTimeout(onDone, 2800);

    return () => {
      clearTimeout(chime);
      clearTimeout(closeTimer);
      clearTimeout(doneTimer);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 20,
        transform: "translateX(-50%)",
        zIndex: 150,
        width: "min(340px, calc(100vw - 32px))",
        pointerEvents: "none",
      }}
    >
      <div
        className={closing ? "cq-toast-out" : "cq-toast-in"}
        style={{
          background: C.panel,
          border: `2px solid ${C.magenta}`,
          boxShadow: `0 0 0 2px ${C.bgDeep}, 0 8px 24px rgba(0,0,0,0.5)`,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.magenta }}>
            TRAINING XP
          </span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: C.green }}>
            +{toast.delta}
          </span>
        </div>
        <XPBar pct={animPct} color={C.magenta} segments={16} />
      </div>
    </div>
  );
}

/* Full-screen level-up reveal — same sunburst treatment as LootReveal,
   fired when Training Level actually increases (not just XP gained).
   Shows the new level and the Gold Chest(s) it unlocks — Training Level
   is already the earn-rate for the standard chest tier (see CHEST_TIERS),
   so this is a real reward already granted, not something invented for
   the popup. */
function LevelUpReveal({ info, onClose }) {
  useEffect(() => {
    if (!info) return;
    playJingle(LEVEL_UP_JINGLE);
  }, [info]);

  if (!info) return null;
  const color = C.magenta;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 210,
        background: "rgba(12,10,28,0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 240,
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="cq-rays"
          style={{
            position: "absolute",
            inset: -80,
            borderRadius: "50%",
            background: `repeating-conic-gradient(${color}55 0deg 6deg, transparent 6deg 24deg)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -25,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}66 0%, transparent 70%)`,
          }}
        />
        <div
          className="cq-pop"
          style={{
            position: "relative",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 64,
            color: C.bone,
            textShadow: `4px 4px 0 ${color}`,
          }}
        >
          {info.level}
        </div>
      </div>

      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color, marginTop: 18, letterSpacing: 1 }}>
        LEVEL UP
      </div>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: C.bone, marginTop: 6 }}>
        TRAINING LVL {info.level}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
        <img
          src={CHEST_TIERS.standard.image}
          alt=""
          style={{ width: 40, height: 40, objectFit: "contain", imageRendering: "pixelated" }}
        />
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: C.gold }}>
          +{info.chestsUnlocked} GOLD CHEST{info.chestsUnlocked > 1 ? "S" : ""}
        </div>
      </div>

      <div style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim, marginTop: 26 }}>
        Tap anywhere to continue
      </div>
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
    holdbox: (data.loginDates || []).length,
  };
  // Legacy items (opened before tiers existed) have no .tier — treat them
  // as standard so they still count against that pool rather than vanishing.
  const openedByTier = {
    daily: lootItems.filter((i) => i.tier === "daily").length,
    standard: lootItems.filter((i) => i.tier === "standard" || !i.tier).length,
    rankup: lootItems.filter((i) => i.tier === "rankup").length,
    holdbox: lootItems.filter((i) => i.tier === "holdbox").length,
  };
  const unopenedByTier = {
    daily: Math.max(0, earnedByTier.daily - openedByTier.daily),
    standard: Math.max(0, earnedByTier.standard - openedByTier.standard),
    rankup: Math.max(0, earnedByTier.rankup - openedByTier.rankup),
    holdbox: Math.max(0, earnedByTier.holdbox - openedByTier.holdbox),
  };

  const [revealItem, setRevealItem] = useState(null);
  const openChest = (tierKey) => {
    if (unopenedByTier[tierKey] <= 0) return;
    // Rolled once here (not inside persist's updater) so the reveal shows
    // exactly the item that got saved, not a second independent roll.
    const item = rollLoot(tierKey, data);
    persist((prev) => ({ ...prev, loot: [...(prev.loot || []), item] }));
    setRevealItem(item);
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

      <GearRack name={data.profile.name} lootItems={lootItems} equippedItems={data.equippedItems} />

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
            desc: "First session of the day. Never legendary.",
            earned: earnedByTier.daily,
          },
          {
            tier: CHEST_TIERS.standard,
            desc: "1 per Training Level, +1 per full quest week.",
            earned: earnedByTier.standard,
          },
          {
            tier: CHEST_TIERS.rankup,
            desc: "1 per new rank. No commons — mostly epic/legendary.",
            earned: earnedByTier.rankup,
          },
          {
            tier: CHEST_TIERS.holdbox,
            desc: "1 per day you open the app. Holds & prefabs only.",
            earned: earnedByTier.holdbox,
          },
        ].map(({ tier, desc }) => (
          <div key={tier.key} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.panelHi}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {tier.image && (
                  <img
                    src={tier.image}
                    alt=""
                    style={{ width: 28, height: 28, objectFit: "contain", imageRendering: "pixelated" }}
                  />
                )}
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: tier.color }}>
                  {tier.label}
                </span>
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

      <DataPanel data={data} persist={persist} />

      <LootReveal item={revealItem} onClose={() => setRevealItem(null)} />
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

const GRACE_SECONDS = 5;

function TimerTab() {
  const [work, setWork] = useState(7);
  const [rest, setRest] = useState(3);
  const [reps, setReps] = useState(6);
  const [sets, setSets] = useState(5);
  const [betweenSets, setBetweenSets] = useState(150);
  const [sound, setSound] = useState(true);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | grace | hang | rest | setrest | done
  const [left, setLeft] = useState(0);
  const [rep, setRep] = useState(1);
  const [set, setSet] = useState(1);

  // Tracks whether `phase` just changed this render — lets the swipe-fill
  // below skip its transition for exactly one render, so it teleports back
  // to the start instead of animating backward across the whole card.
  const prevPhaseRef = useRef(phase);
  const phaseJustChanged = phase !== prevPhaseRef.current;
  useEffect(() => {
    prevPhaseRef.current = phase;
  }, [phase]);

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
    setPhase("grace");
    setLeft(GRACE_SECONDS);
    setRep(1);
    setSet(1);
    setRunning(true);
    beep(220);
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
      if (phase === "grace") {
        setPhase("hang");
        setLeft(work);
        beep(880);
        return;
      }

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
    phase === "grace"
      ? C.red
      : phase === "hang"
      ? C.magenta
      : phase === "rest"
      ? C.cyan
      : phase === "setrest"
      ? C.gold
      : C.boneDim;

  const phaseLabel =
    phase === "grace"
      ? "GET READY"
      : phase === "hang"
      ? "HANG"
      : phase === "rest"
      ? "REST"
      : phase === "setrest"
      ? "SET REST"
      : phase === "done"
      ? "DONE"
      : "READY";

  // Total seconds for whatever phase is active — drives the swipe-fill
  // below, which grows toward 100% as `left` approaches 0. Denominator is
  // (total - 1), not total, so the fill actually reaches the right edge on
  // the last displayed second instead of capping just short of it.
  const phaseTotal =
    phase === "grace" ? GRACE_SECONDS : phase === "hang" ? work : phase === "rest" ? rest : phase === "setrest" ? betweenSets : 0;
  const fillPct =
    phaseTotal > 1
      ? Math.min(100, Math.max(0, ((phaseTotal - left) / (phaseTotal - 1)) * 100))
      : phaseTotal === 1
      ? 100
      : 0;

  return (
    <div>
      <Panel
        style={{ padding: 20, marginBottom: 14, textAlign: "center", position: "relative", overflow: "hidden" }}
        accent={phaseColor}
      >
        {phaseTotal > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${fillPct}%`,
              background: `${phaseColor}33`,
              // Skip the transition for the one render where the phase just
              // changed, so the bar teleports back to empty instead of
              // sliding backward across the whole card.
              transition: phaseJustChanged ? "none" : "width 1s linear",
              pointerEvents: "none",
            }}
          />
        )}
        <div style={{ position: "relative" }}>
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

/* GitHub-style contribution grid — one column per week, one cell per
   day, colored by how many sessions were logged that day. A full year
   doesn't fit a phone screen, so the grid scrolls horizontally inside
   its own container instead of squeezing the rest of the page. */
const ACTIVITY_WEEKS = 53;
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const activityColor = (count) => {
  if (count <= 0) return C.panelHi;
  if (count === 1) return `${C.green}50`;
  if (count === 2) return `${C.green}9A`;
  return C.green;
};

function ActivityGrid({ sessions }) {
  const byDate = {};
  sessions.forEach((s) => {
    byDate[s.date] = (byDate[s.date] || 0) + 1;
  });

  const todayD = new Date(today() + "T00:00:00");
  const end = new Date(todayD);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - (ACTIVITY_WEEKS * 7 - 1));

  const weeks = [];
  const cursor = new Date(start);
  for (let w = 0; w < ACTIVITY_WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        count: byDate[dateStr] || 0,
        future: cursor > todayD,
        isFirstOfMonth: cursor.getDate() === 1,
        month: cursor.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }

  let lastMonth = -1;
  const monthLabels = weeks.map((days) => {
    const marker = days.find((d) => d.isFirstOfMonth);
    if (marker && marker.month !== lastMonth) {
      lastMonth = marker.month;
      return MONTH_ABBR[marker.month];
    }
    return "";
  });

  return (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div style={{ display: "flex", gap: 3, width: "max-content" }}>
        {weeks.map((days, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div
              style={{
                height: 12,
                fontFamily: "'VT323', monospace",
                fontSize: 11,
                color: C.boneDim,
                whiteSpace: "nowrap",
              }}
            >
              {monthLabels[wi]}
            </div>
            {days.map((day) => (
              <div
                key={day.date}
                title={day.future ? "" : `${day.date} — ${day.count} session${day.count === 1 ? "" : "s"}`}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2,
                  background: day.future ? "transparent" : activityColor(day.count),
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
        <span style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim }}>Less</span>
        {[0, 1, 2, 3].map((lvl) => (
          <div key={lvl} style={{ width: 11, height: 11, borderRadius: 2, background: activityColor(lvl) }} />
        ))}
        <span style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: C.boneDim }}>More</span>
      </div>
    </div>
  );
}

const formatDayHeader = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
};

const LOG_DAYS_PER_PAGE = 5;

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
  const [page, setPage] = useState(0);

  const add = () => {
    const s = { id: uid(), ...form };
    persist((prev) => ({ ...prev, sessions: [s, ...prev.sessions] }));
    setForm({ ...form, sets: "", reps: "", load: "", note: "" });
    setPage(0);
  };

  const del = (id) =>
    persist((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) }));

  const sessions = [...data.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const grouped = {};
  sessions.forEach((s) => {
    (grouped[s.date] = grouped[s.date] || []).push(s);
  });
  const dates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  const pageCount = Math.max(1, Math.ceil(dates.length / LOG_DAYS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageDates = dates.slice(safePage * LOG_DAYS_PER_PAGE, safePage * LOG_DAYS_PER_PAGE + LOG_DAYS_PER_PAGE);

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

      <Panel style={{ padding: 14, marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            color: C.green,
            marginBottom: 12,
          }}
        >
          ACTIVITY
        </div>
        <ActivityGrid sessions={sessions} />
      </Panel>

      {dates.length === 0 ? (
        <Panel style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: C.boneDim }}>
            No sessions logged. Train something.
          </div>
        </Panel>
      ) : (
        pageDates.map((date) => (
          <Panel key={date} style={{ padding: 12, marginBottom: 8 }}>
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 9,
                color: C.gold,
                marginBottom: 10,
              }}
            >
              {formatDayHeader(date)}
            </div>
            {grouped[date].map((s, i) => {
              const parts = [];
              if (s.sets && s.reps) parts.push(`${s.sets}×${s.reps}`);
              if (s.load) parts.push(s.load);
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    paddingTop: i > 0 ? 10 : 0,
                    marginTop: i > 0 ? 10 : 0,
                    borderTop: i > 0 ? `1px solid ${C.panelHi}` : "none",
                  }}
                >
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
                    {parts.length > 0 && (
                      <div style={{ fontFamily: "'VT323', monospace", fontSize: 19, color: C.bone }}>
                        {parts.join(" · ")}
                      </div>
                    )}
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
              );
            })}
          </Panel>
        ))
      )}

      {pageCount > 1 && (
        <Panel style={{ padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Btn small disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Prev
          </Btn>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 17, color: C.boneDim }}>
            Page {safePage + 1} / {pageCount}
          </div>
          <Btn small disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
            Next
          </Btn>
        </Panel>
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
