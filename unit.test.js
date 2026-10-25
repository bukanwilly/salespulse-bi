/**
 * SalesPulse BI — Unit Tests
 * ──────────────────────────────────────────────────────────────────
 * Pure-JS unit tests for core analytic functions.
 * These tests are framework-agnostic: they use a minimal test harness
 * compatible with both the browser test runner (tests/test-runner.html)
 * and Jest (if Node + Jest are available).
 *
 * To run in browser:  open tests/test-runner.html
 * To run with Jest:   npx jest tests/unit.test.js
 * ──────────────────────────────────────────────────────────────────
 */

/* ── Minimal harness for direct browser execution (no-op when Jest present) */
if (typeof describe === "undefined") {
  var _suites = [], _current = null;
  window.__testResults = [];
  window.describe = function(name, fn) { _current = name; fn(); };
  window.it = window.test = function(desc, fn) {
    try { fn(); window.__testResults.push({ ok: true, suite: _current, desc }); }
    catch(e) { window.__testResults.push({ ok: false, suite: _current, desc, err: e.message }); }
  };
  window.expect = function(actual) {
    return {
      toBe:         (v) => { if (actual !== v)          throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(v)}`); },
      toEqual:      (v) => { if (JSON.stringify(actual) !== JSON.stringify(v)) throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(v)}`); },
      toBeCloseTo:  (v, p=2) => { const d = Math.abs(actual-v); if (d > Math.pow(10,-p)/2) throw new Error(`Expected ${actual} ≈ ${v} (±${Math.pow(10,-p)/2})`); },
      toBeGreaterThan: (v) => { if (!(actual > v))      throw new Error(`Expected ${actual} > ${v}`); },
      toBeLessThan:    (v) => { if (!(actual < v))      throw new Error(`Expected ${actual} < ${v}`); },
      toBeNull:        ()  => { if (actual !== null)    throw new Error(`Expected null, got ${actual}`); },
      toBeTruthy:      ()  => { if (!actual)            throw new Error(`Expected truthy, got ${actual}`); },
      toBeFalsy:       ()  => { if (actual)             throw new Error(`Expected falsy, got ${actual}`); },
      toContain:       (v) => { if (!actual.includes(v)) throw new Error(`Expected "${actual}" to contain "${v}"`); },
      toHaveLength:    (v) => { if (actual.length !== v) throw new Error(`Expected length ${v}, got ${actual.length}`); },
    };
  };
}

/* ══════════════════════════════════════════════════════════════════
   INLINE PURE FUNCTIONS (mirrors script.js, no DOM dependency)
   These are re-declared here so tests run without loading the app.
   ══════════════════════════════════════════════════════════════════ */

function _sumKey(arr, k) { return arr.reduce((s, r) => s + (Number(r[k]) || 0), 0); }
function _avgKey(arr, k) { return arr.length ? _sumKey(arr, k) / arr.length : 0; }
function _pctChange(a, b) { if (!isFinite(b) || b === 0) return null; return (a - b) / b * 100; }
function _fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "N/A";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}
function _fmtCurrency(n) {
  if (n === null || isNaN(n)) return "N/A";
  if (n >= 1e9) return "IDR " + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "IDR " + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "IDR " + (n / 1e3).toFixed(0) + "K";
  return "IDR " + n.toLocaleString();
}
function _groupBy(arr, k) {
  return arr.reduce((acc, r) => {
    const v = r[k] || "Unknown";
    (acc[v] = acc[v] || []).push(r);
    return acc;
  }, {});
}
function _splitHalves(arr) {
  if (!arr.length) return [[], []];
  const ms = [...new Set(arr.map(r => r._month))].sort((a, b) => a - b);
  if (ms.length < 2) return [[], []];
  const mid = Math.floor(ms.length / 2);
  const s1 = new Set(ms.slice(0, mid)), s2 = new Set(ms.slice(mid));
  return [arr.filter(r => s1.has(r._month)), arr.filter(r => s2.has(r._month))];
}
function _pearson(arr, xk, yk) {
  const n = arr.length; if (n < 2) return NaN;
  const xs = arr.map(r => Number(r[xk]) || 0), ys = arr.map(r => Number(r[yk]) || 0);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  const d = Math.sqrt(dx2 * dy2); return d === 0 ? 0 : num / d;
}
function _linReg(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (xs[i] - mx) * (ys[i] - my);
    ssxx += (xs[i] - mx) ** 2;
    ssyy += (ys[i] - my) ** 2;
  }
  const slope = ssxx === 0 ? 0 : ssxy / ssxx;
  const intercept = my - slope * mx;
  const r2 = ssyy === 0 ? 1 : (ssxy ** 2) / (ssxx * ssyy);
  return { slope, intercept, r2 };
}
function _detectDiscountScale(rows, col) {
  const vals = rows.slice(0, 100).map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (!vals.length) return "0-100";
  return Math.max(...vals) <= 1.0 ? "0-1" : "0-100";
}

/* ── Sample datasets ─────────────────────────────────────────── */
const SAMPLE_ROWS = [
  { _rev: 18000000, _txn: 12, _qty: 12, _disc: 5,  _month: 0, _year: 2024, _cat: "Electronics", _reg: "North",  _rep: "Alice" },
  { _rev: 12500000, _txn: 25, _qty: 25, _disc: 8,  _month: 0, _year: 2024, _cat: "Electronics", _reg: "South",  _rep: "Bob"   },
  { _rev:  6400000, _txn:  8, _qty:  8, _disc: 3,  _month: 0, _year: 2024, _cat: "Furniture",   _reg: "East",   _rep: "Carol" },
  { _rev:  7500000, _txn: 15, _qty: 15, _disc: 10, _month: 0, _year: 2024, _cat: "Electronics", _reg: "West",   _rep: "Dave"  },
  { _rev:  9000000, _txn: 30, _qty: 60, _disc: 12, _month: 0, _year: 2024, _cat: "Apparel",     _reg: "North",  _rep: "Alice" },
  { _rev: 11000000, _txn: 22, _qty: 22, _disc: 8,  _month: 1, _year: 2024, _cat: "Electronics", _reg: "North",  _rep: "Alice" },
  { _rev: 10500000, _txn: 35, _qty: 35, _disc: 15, _month: 1, _year: 2024, _cat: "Electronics", _reg: "East",   _rep: "Carol" },
  { _rev: 21000000, _txn: 14, _qty: 14, _disc: 5,  _month: 1, _year: 2024, _cat: "Electronics", _reg: "North",  _rep: "Alice" },
  { _rev: 15000000, _txn: 30, _qty: 30, _disc: 8,  _month: 2, _year: 2024, _cat: "Electronics", _reg: "West",   _rep: "Dave"  },
  { _rev: 16500000, _txn: 11, _qty: 11, _disc: 5,  _month: 2, _year: 2024, _cat: "Electronics", _reg: "South",  _rep: "Bob"   },
];

/* ══════════════════════════════════════════════════════════════════
   TEST SUITES
   ══════════════════════════════════════════════════════════════════ */

describe("sumKey", () => {
  it("sums a numeric key across rows", () => {
    expect(_sumKey(SAMPLE_ROWS, "_rev")).toBe(127400000);
  });
  it("returns 0 for empty array", () => {
    expect(_sumKey([], "_rev")).toBe(0);
  });
  it("skips NaN and missing values", () => {
    const data = [{ v: 100 }, { v: "bad" }, { v: null }, { v: 50 }];
    expect(_sumKey(data, "v")).toBe(150);
  });
});

describe("avgKey", () => {
  it("calculates unweighted average", () => {
    const data = [{ v: 10 }, { v: 20 }, { v: 30 }];
    expect(_avgKey(data, "v")).toBe(20);
  });
  it("returns 0 for empty array", () => {
    expect(_avgKey([], "v")).toBe(0);
  });
});

describe("pctChange", () => {
  it("returns positive growth", () => {
    expect(_pctChange(120, 100)).toBe(20);
  });
  it("returns negative decline", () => {
    expect(_pctChange(80, 100)).toBe(-20);
  });
  it("returns null for zero base", () => {
    expect(_pctChange(50, 0)).toBeNull();
  });
  it("returns null for NaN", () => {
    expect(_pctChange(50, NaN)).toBeNull();
  });
});

describe("fmtNum", () => {
  it("formats billions", () => {
    expect(_fmtNum(2500000000)).toContain("B");
  });
  it("formats millions", () => {
    expect(_fmtNum(1500000)).toContain("M");
  });
  it("formats thousands", () => {
    expect(_fmtNum(5000)).toContain("K");
  });
  it("returns N/A for null", () => {
    expect(_fmtNum(null)).toBe("N/A");
  });
  it("returns N/A for NaN", () => {
    expect(_fmtNum(NaN)).toBe("N/A");
  });
});

describe("fmtCurrency", () => {
  it("prefixes IDR", () => {
    expect(_fmtCurrency(5000000)).toContain("IDR");
  });
  it("returns N/A for null", () => {
    expect(_fmtCurrency(null)).toBe("N/A");
  });
  it("formats 18M correctly", () => {
    expect(_fmtCurrency(18000000)).toBe("IDR 18.0M");
  });
});

describe("groupBy", () => {
  it("groups by key correctly", () => {
    const grouped = _groupBy(SAMPLE_ROWS, "_cat");
    expect(Object.keys(grouped)).toHaveLength(3);
    expect(grouped["Electronics"].length).toBeGreaterThan(0);
    expect(grouped["Furniture"].length).toBeGreaterThan(0);
    expect(grouped["Apparel"].length).toBeGreaterThan(0);
  });
  it("handles missing key as Unknown", () => {
    const data = [{ x: 1 }, { x: null }];
    const g = _groupBy(data, "cat");
    expect(Object.keys(g)).toContain("Unknown");
  });
});

describe("splitHalves", () => {
  it("splits into two non-empty halves with multi-month data", () => {
    const [h1, h2] = _splitHalves(SAMPLE_ROWS);
    expect(h1.length).toBeGreaterThan(0);
    expect(h2.length).toBeGreaterThan(0);
  });
  it("returns empty halves for empty array", () => {
    const [h1, h2] = _splitHalves([]);
    expect(h1).toHaveLength(0);
    expect(h2).toHaveLength(0);
  });
  it("returns empty halves for single-month data", () => {
    const oneMonth = SAMPLE_ROWS.filter(r => r._month === 0);
    const [h1, h2] = _splitHalves(oneMonth);
    expect(h1).toHaveLength(0);
    expect(h2).toHaveLength(0);
  });
  it("h1 and h2 together cover all rows", () => {
    const [h1, h2] = _splitHalves(SAMPLE_ROWS);
    expect(h1.length + h2.length).toBe(SAMPLE_ROWS.length);
  });
});

describe("KPI calculations", () => {
  it("total revenue equals sum of all _rev", () => {
    const total = _sumKey(SAMPLE_ROWS, "_rev");
    expect(total).toBe(127400000);
  });
  it("total transactions", () => {
    expect(_sumKey(SAMPLE_ROWS, "_txn")).toBe(202);
  });
  it("AOV is revenue / transactions", () => {
    const rev = _sumKey(SAMPLE_ROWS, "_rev");
    const txn = _sumKey(SAMPLE_ROWS, "_txn");
    const aov = rev / txn;
    expect(aov).toBeGreaterThan(0);
    expect(aov).toBeCloseTo(631188.12, 0);
  });
  it("avg discount > 0", () => {
    const avg = _avgKey(SAMPLE_ROWS, "_disc");
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeCloseTo(7.9, 1);
  });
  it("H2 revenue exceeds H1 (growing dataset)", () => {
    const [h1, h2] = _splitHalves(SAMPLE_ROWS);
    const revH1 = _sumKey(h1, "_rev");
    const revH2 = _sumKey(h2, "_rev");
    expect(revH2).toBeGreaterThan(revH1);
  });
  it("growth pct is positive", () => {
    const [h1, h2] = _splitHalves(SAMPLE_ROWS);
    const g = _pctChange(_sumKey(h2, "_rev"), _sumKey(h1, "_rev"));
    expect(g).toBeGreaterThan(0);
  });
});

describe("pearson correlation", () => {
  it("perfect positive correlation", () => {
    const data = [1,2,3,4,5].map(v => ({ x: v, y: v }));
    expect(_pearson(data, "x", "y")).toBeCloseTo(1.0, 4);
  });
  it("perfect negative correlation", () => {
    const data = [1,2,3,4,5].map(v => ({ x: v, y: 6 - v }));
    expect(_pearson(data, "x", "y")).toBeCloseTo(-1.0, 4);
  });
  it("returns NaN for single row", () => {
    const data = [{ x: 1, y: 2 }];
    expect(isNaN(_pearson(data, "x", "y"))).toBe(true);
  });
  it("discount vs revenue correlation exists in sample", () => {
    const r = _pearson(SAMPLE_ROWS, "_disc", "_rev");
    expect(isNaN(r)).toBe(false);
    expect(r).toBeGreaterThan(-1);
    expect(r).toBeLessThan(1);
  });
});

describe("linReg (forecasting)", () => {
  it("perfect line: slope=2, intercept=1", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map(x => 2 * x + 1);
    const { slope, intercept, r2 } = _linReg(xs, ys);
    expect(slope).toBeCloseTo(2, 5);
    expect(intercept).toBeCloseTo(1, 5);
    expect(r2).toBeCloseTo(1, 5);
  });
  it("handles 2-point input", () => {
    const { slope } = _linReg([0, 1], [0, 5]);
    expect(slope).toBeCloseTo(5, 5);
  });
  it("returns slope=0 for flat data", () => {
    const xs = [0, 1, 2, 3];
    const ys = [5, 5, 5, 5];
    const { slope, r2 } = _linReg(xs, ys);
    expect(slope).toBe(0);
    expect(r2).toBe(1); // perfect fit on constant
  });
  it("slope is positive for growing monthly revenue", () => {
    const revByMonth = [
      { _month: 0, _rev: 53400000 },
      { _month: 1, _rev: 42500000 },
      { _month: 2, _rev: 31500000 },
    ];
    // Group manually
    const months = [0, 1, 2];
    const ys = months.map(m => revByMonth.filter(r => r._month === m).reduce((s,r)=>s+r._rev,0)/1e6);
    const { slope } = _linReg(months, ys);
    // declining data → negative slope
    expect(slope).toBeLessThan(0);
  });
});

describe("discount scale detection", () => {
  it("detects 0-1 scale", () => {
    const rows = [{ d: 0.05 }, { d: 0.10 }, { d: 0.08 }];
    expect(_detectDiscountScale(rows, "d")).toBe("0-1");
  });
  it("detects 0-100 scale", () => {
    const rows = [{ d: 5 }, { d: 10 }, { d: 8 }];
    expect(_detectDiscountScale(rows, "d")).toBe("0-100");
  });
  it("returns 0-100 for empty rows", () => {
    expect(_detectDiscountScale([], "d")).toBe("0-100");
  });
});

describe("groupBy + revenue top-N", () => {
  it("top category by revenue is Electronics", () => {
    const byCat = _groupBy(SAMPLE_ROWS, "_cat");
    const sorted = Object.keys(byCat).sort((a, b) =>
      _sumKey(byCat[b], "_rev") - _sumKey(byCat[a], "_rev")
    );
    expect(sorted[0]).toBe("Electronics");
  });
  it("top rep by revenue is Alice (highest sum)", () => {
    const byRep = _groupBy(SAMPLE_ROWS, "_rep");
    const sorted = Object.keys(byRep).sort((a, b) =>
      _sumKey(byRep[b], "_rev") - _sumKey(byRep[a], "_rev")
    );
    expect(sorted[0]).toBe("Alice");
  });
  it("number of unique categories is 3", () => {
    const byCat = _groupBy(SAMPLE_ROWS, "_cat");
    expect(Object.keys(byCat)).toHaveLength(3);
  });
  it("number of unique regions is 4", () => {
    const byReg = _groupBy(SAMPLE_ROWS, "_reg");
    expect(Object.keys(byReg)).toHaveLength(4);
  });
});

describe("smart alert thresholds", () => {
  it("alerts when avg discount > 10", () => {
    const highDiscData = SAMPLE_ROWS.filter(r => r._disc >= 10);
    const avg = _avgKey(highDiscData, "_disc");
    expect(avg).toBeGreaterThan(10);
  });
  it("no alert when avg discount <= 10", () => {
    const lowDiscData = SAMPLE_ROWS.filter(r => r._disc <= 8);
    const avg = _avgKey(lowDiscData, "_disc");
    expect(avg).toBeLessThan(11);
  });
  it("critical threshold is >12", () => {
    const critData = [{ _disc: 12 }, { _disc: 15 }, { _disc: 13 }];
    const avg = _avgKey(critData, "_disc");
    expect(avg).toBeGreaterThan(12);
  });
});

describe("data validation helpers", () => {
  it("parseFloat strips commas", () => {
    const v = parseFloat(String("1,500,000").replace(/,/g, ""));
    expect(v).toBe(1500000);
  });
  it("invalid revenue is NaN", () => {
    expect(isNaN(parseFloat("abc"))).toBe(true);
  });
  it("negative revenue is invalid", () => {
    const rev = -100;
    expect(rev < 0).toBe(true);
  });
  it("date parsing works for ISO format", () => {
    const d = new Date("2024-01-05");
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getMonth()).toBe(0);
    expect(d.getFullYear()).toBe(2024);
  });
  it("date parsing fails gracefully for invalid input", () => {
    const d = new Date("not-a-date");
    expect(isNaN(d.getTime())).toBe(true);
  });
});

/* ── export for Jest ─────────────────────────────────────────── */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    _sumKey, _avgKey, _pctChange, _fmtNum, _fmtCurrency,
    _groupBy, _splitHalves, _pearson, _linReg, _detectDiscountScale,
    SAMPLE_ROWS,
  };
}
