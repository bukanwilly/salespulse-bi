/**
 * SalesPulse BI — script.js  (Master Edition v2.0)
 * ─────────────────────────────────────────────────────────────────
 * Phase 1+2+3 — Complete Implementation
 *
 * PHASE 1 (Core Analytics)
 *  UPLOAD  → drag-drop, file-input, CSV (PapaParse), Excel (SheetJS)
 *  SCHEMA  → auto column detection, 16-role synonym map (EN+ID)
 *  MAPPING → UI for user to review/correct column assignments
 *  VALIDATE→ data quality report, missing values, duplicates, outliers
 *  PIPELINE→ rawData → filtered (single source of truth)
 *  KPI     → revenue, AOV, transactions, qty, discount, growth
 *  CHARTS  → 8 Chart.js charts (destroy-recreate pattern)
 *  INSIGHTS→ max 5 structured insight cards + smart alerts
 *  RECS    → prioritised recommendation cards with evidence
 *  DQ      → data quality panel + KPI definitions
 *  EXPORT  → CSV export with formula-injection guard
 *  UX      → dark mode, collapse/expand, filter badges, table sort/search
 *
 * PHASE 2 (Decision Intelligence)
 *  ALERTS  → discount governance thresholds (>10% warn, >12% critical)
 *  RECS    → H1/H2 growth, top product concentration, regional gap
 *  DQ      → outlier detection ±3σ, discount scale auto-detect (0-1 vs 0-100)
 *
 * PHASE 3 (Advanced Analytics)
 *  FORECAST→ 3-month linear regression projection with R², trend line
 *  COHORT  → Segment × Month revenue heatmap (5-level intensity)
 *  BASKET  → Cross-sell product pair analysis (support %, lift)
 *  WHATIF  → Revenue simulator: volume × price × discount sliders
 *  MODAL   → Sheet selector modal (replaces window.prompt)
 *
 * Security: no eval-function, no innerHTML for CSV values, textContent only.
 *           CSV export formula-injection guard. 50 MB file size limit.
 *           No API keys. All processing client-side.
 * ─────────────────────────────────────────────────────────────────
 */
"use strict";

/* ════════════════════════════════════════════════════════════════
   COLUMN SYNONYM MAP
   Key = internal role. Values = lowercase synonyms to match against.
   ════════════════════════════════════════════════════════════════ */
const SYNONYMS = {
  date:        ["date","tanggal","order date","transaction date","sale date","tgl","invoice date","order_date","tanggal_transaksi","trans date","order date","date de vente"],
  revenue:     ["revenue","sales","total sales","amount","total","gross sales","net sales","pendapatan","total revenue","penjualan","sales amount","gross revenue","nilai penjualan"],
  transactions:["transactions","orders","order count","txn","transaction count","jumlah transaksi","num orders","qty orders","order qty","num transactions"],
  quantity:    ["quantity","qty","units","units sold","quantity sold","jumlah","volume","pieces","kuantitas","num units","items sold"],
  discount:    ["discount","discount rate","discount pct","discount %","diskon","discount_pct","disc","discount percent","rebate"],
  profit:      ["profit","net profit","gross profit","laba","keuntungan","earnings","net income","margin amount"],
  cost:        ["cost","cogs","cost of goods","cost of goods sold","biaya","harga pokok"],
  category:    ["category","product category","item category","kategori","product type","type","produk kategori","cat"],
  product:     ["product","product name","item","product_name","item name","nama produk","sku","product id","barang"],
  salesperson: ["salesperson","sales rep","rep","agent","staff","karyawan","sales person","employee","sales agent","nama karyawan"],
  region:      ["region","territory","area","wilayah","zone","location","daerah","branch","cabang","kota","city"],
  channel:     ["channel","sales channel","medium","platform","metode penjualan","saluran"],
  segment:     ["segment","customer segment","customer type","customer category","tipe pelanggan","client type"],
  payment:     ["payment","payment method","payment type","cara bayar","metode pembayaran"],
  order_id:    ["order id","transaction id","invoice id","order_id","txn_id","id transaksi","id pesanan","receipt","bill no"],
  customer_id: ["customer id","client id","customer_id","pelanggan id","cust id","id pelanggan"],
};

/* Internal role → display label + KPI metadata */
const ROLE_META = {
  date:        { label: "Date",         kpi: true,  required: true,  icon: "&#9654;", color: "#2563eb" },
  revenue:     { label: "Revenue",      kpi: true,  required: true,  icon: "&#8657;", color: "#2563eb" },
  transactions:{ label: "Transactions", kpi: true,  required: false, icon: "&#9632;", color: "#7c3aed" },
  quantity:    { label: "Quantity",     kpi: true,  required: false, icon: "&#9670;", color: "#0284c7" },
  discount:    { label: "Discount %",   kpi: true,  required: false, icon: "&#9660;", color: "#d97706" },
  profit:      { label: "Profit",       kpi: true,  required: false, icon: "&#9650;", color: "#16a34a" },
  cost:        { label: "Cost",         kpi: false, required: false, icon: "", color: "#64748b" },
  category:    { label: "Category",     kpi: false, required: false, icon: "", color: "#64748b" },
  product:     { label: "Product",      kpi: false, required: false, icon: "", color: "#64748b" },
  salesperson: { label: "Salesperson",  kpi: false, required: false, icon: "", color: "#64748b" },
  region:      { label: "Region",       kpi: false, required: false, icon: "", color: "#64748b" },
  channel:     { label: "Channel",      kpi: false, required: false, icon: "", color: "#64748b" },
  segment:     { label: "Segment",      kpi: false, required: false, icon: "", color: "#64748b" },
  payment:     { label: "Payment",      kpi: false, required: false, icon: "", color: "#64748b" },
  order_id:    { label: "Order ID",     kpi: false, required: false, icon: "", color: "#64748b" },
  customer_id: { label: "Customer ID",  kpi: false, required: false, icon: "", color: "#64748b" },
};

const KPI_DEFS = {
  revenue:     { formula: "SUM(revenue column)", unit: "currency", limitation: "Gross revenue only; no cost/margin data." },
  aov:         { formula: "SUM(revenue) ÷ SUM(transactions)", unit: "currency per transaction", limitation: "Uses transactions column if present; else row count as proxy." },
  transactions:{ formula: "SUM(transactions column)", unit: "count", limitation: "If no transactions column, row count is used as proxy." },
  quantity:    { formula: "SUM(quantity column)", unit: "units", limitation: "Units not normalised across categories." },
  discount:    { formula: "MEAN(discount column) — unweighted simple average", unit: "percent (0–100)", limitation: "Unweighted; stored as 0–100 not 0–1." },
  profit:      { formula: "SUM(profit column)", unit: "currency", limitation: "Direct from column; not derived from revenue minus cost." },
  growth:      { formula: "(SUM_rev_H2 − SUM_rev_H1) ÷ SUM_rev_H1 × 100", unit: "percent", limitation: "H1/H2 split of filtered view — not fixed YoY." },
};

/* ════════════════════════════════════════════════════════════════
   COLOUR PALETTE
   ════════════════════════════════════════════════════════════════ */
const PAL = ["#2563eb","#0d9488","#7c3aed","#d97706","#e11d48","#16a34a","#0284c7","#64748b"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ════════════════════════════════════════════════════════════════
   APP STATE
   ════════════════════════════════════════════════════════════════ */
let state = {
  rawHeaders: [],       // original column names from file
  rawRows:    [],       // raw parsed rows (array of objects)
  mapping:    {},       // role → column name (user-confirmed)
  rawData:    [],       // normalised, validated rows
  filtered:   [],       // active filtered slice (single source of truth)
  dqReport:   {},       // data quality metadata
  fileName:   "",
  fileSize:   0,
  sheets:     [],       // sheet names (Excel only)
  activeSheet: "",
  tableSort:  { col: null, asc: true },
  tableSearch: "",
  trendGran:  "month",
};

const charts = {};

/* ════════════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════════════ */
/** Escape for safe innerHTML insertion */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmtNum(n, short = true) {
  if (n === null || n === undefined || isNaN(n)) return "N/A";
  if (!short) return n.toLocaleString();
  if (n >= 1e9) return (n/1e9).toFixed(2)+"B";
  if (n >= 1e6) return (n/1e6).toFixed(1)+"M";
  if (n >= 1e3) return (n/1e3).toFixed(1)+"K";
  return n.toLocaleString();
}
function fmtCurrency(n) {
  if (n === null || isNaN(n)) return "N/A";
  if (n >= 1e9) return "IDR "+(n/1e9).toFixed(2)+"B";
  if (n >= 1e6) return "IDR "+(n/1e6).toFixed(1)+"M";
  if (n >= 1e3) return "IDR "+(n/1e3).toFixed(0)+"K";
  return "IDR "+n.toLocaleString();
}
function pctChange(a, b) {
  if (!isFinite(b) || b === 0 || b === null) return null;
  return (a - b) / b * 100;
}
function sumKey(arr, k) { return arr.reduce((s,r)=>s+(Number(r[k])||0), 0); }
function avgKey(arr, k) { return arr.length ? sumKey(arr,k)/arr.length : 0; }
function groupBy(arr, k) {
  return arr.reduce((acc,r)=>{ const v=r[k]||"Unknown"; (acc[v]=acc[v]||[]).push(r); return acc; }, {});
}
function splitHalves(arr) {
  if (!arr.length) return [[],[]];
  // Use year-month composite keys to correctly handle multi-year datasets.
  const ymKeys = [...new Set(arr.map(r => r._year != null && r._month != null
    ? `${r._year}-${String(r._month).padStart(2,"0")}`
    : null
  ).filter(Boolean))].sort();
  if (ymKeys.length < 2) return [[],[]];
  const mid = Math.floor(ymKeys.length / 2);
  const s1 = new Set(ymKeys.slice(0, mid));
  const s2 = new Set(ymKeys.slice(mid));
  const toKey = r => r._year != null && r._month != null
    ? `${r._year}-${String(r._month).padStart(2,"0")}`
    : null;
  return [arr.filter(r => s1.has(toKey(r))), arr.filter(r => s2.has(toKey(r)))];
}
function pearson(arr, xk, yk) {
  const n = arr.length; if (n<2) return NaN;
  const xs = arr.map(r=>Number(r[xk])||0), ys = arr.map(r=>Number(r[yk])||0);
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0,dx2=0,dy2=0;
  for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;num+=dx*dy;dx2+=dx*dx;dy2+=dy*dy;}
  const d = Math.sqrt(dx2*dy2); return d===0?0:num/d;
}
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function getCol(role) { return state.mapping[role] || null; }
function getVal(row, role) {
  const c = getCol(role); return c ? row[c] : undefined;
}
function colExists(role) { return !!getCol(role); }

/* ════════════════════════════════════════════════════════════════
   SCREEN NAVIGATION
   ════════════════════════════════════════════════════════════════ */
function showScreen(id) {
  ["upload-screen","mapping-screen","dashboard-screen"].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? (id === "upload-screen" ? "flex" : "block") : "none";
  });
  const btnClear = document.getElementById("btn-clear-data");
  const btnNew   = document.getElementById("btn-new-file");
  const isDB = id === "dashboard-screen";
  if (btnClear) btnClear.style.display = (id !== "upload-screen") ? "inline-flex" : "none";
  if (btnNew)   btnNew.style.display   = isDB ? "inline-block" : "none";
}

/* ════════════════════════════════════════════════════════════════
   FILE UPLOAD — drag-drop + input
   ════════════════════════════════════════════════════════════════ */
function initUpload() {
  const zone  = document.getElementById("drop-zone");
  const input = document.getElementById("file-input");
  if (!zone || !input) return;

  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault(); zone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  });
  zone.addEventListener("keydown", e => { if (e.key==="Enter"||e.key===" ") input.click(); });
  input.addEventListener("change", e => { const f=e.target.files[0]; if(f) handleFile(f); e.target.value=""; });
}

function handleFile(file) {
  const MAX = 50 * 1024 * 1024; // 50 MB
  clearUploadError();
  if (file.size > MAX) { showUploadError("File is too large (max 50 MB). Please reduce file size."); return; }
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["csv","xlsx","xls"].includes(ext)) { showUploadError("Unsupported format. Please upload .csv, .xlsx, or .xls."); return; }

  state.fileName = file.name;
  state.fileSize = file.size;
  showProgress(10, "Reading file…");

  if (ext === "csv") readCSV(file);
  else readExcel(file);
}

function readCSV(file) {
  showProgress(30, "Parsing CSV…");
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: h => h.trim(),
    complete: res => {
      showProgress(80, "Validating…");
      if (!res.data.length) { showUploadError("CSV appears empty or has no valid rows."); hideProgress(); return; }
      state.sheets    = [];
      state.activeSheet = "";
      state.rawHeaders = res.meta.fields || [];
      state.rawRows    = res.data;
      showProgress(100, "Done");
      setTimeout(() => { hideProgress(); goToMapping(); }, 300);
    },
    error: err => { showUploadError("CSV parse error: " + err.message); hideProgress(); },
  });
}

function readExcel(file) {
  showProgress(30, "Reading Excel…");
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      showProgress(60, "Parsing workbook…");
      const data  = new Uint8Array(e.target.result);
      const wb    = XLSX.read(data, { type: "array", cellDates: true });
      state.sheets = wb.SheetNames;

      // If multiple sheets, show modal picker
      if (wb.SheetNames.length > 1) {
        const chosen = await promptSheetChoice(wb.SheetNames);
        if (!chosen) { hideProgress(); return; }
        state.activeSheet = chosen;
      } else {
        state.activeSheet = wb.SheetNames[0];
      }

      showProgress(85, "Extracting rows…");
      const ws   = wb.Sheets[state.activeSheet];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      if (!json.length) { showUploadError("Selected sheet appears empty."); hideProgress(); return; }
      state.rawHeaders = Object.keys(json[0]);
      state.rawRows    = json;
      showProgress(100, "Done");
      setTimeout(() => { hideProgress(); goToMapping(); }, 300);
    } catch (err) {
      showUploadError("Excel read error: " + err.message);
      hideProgress();
    }
  };
  reader.onerror = () => { showUploadError("Failed to read file."); hideProgress(); };
  reader.readAsArrayBuffer(file);
}

function promptSheetChoice(sheets) {
  // Returns a Promise that resolves to the chosen sheet name, or null on cancel
  return new Promise(resolve => {
    const overlay = document.getElementById("sheet-modal");
    const list    = document.getElementById("sheet-modal-list");
    const cancel  = document.getElementById("sheet-modal-cancel");
    if (!overlay || !list) {
      // Fallback: resolve with first sheet
      resolve(sheets[0]);
      return;
    }

    list.innerHTML = "";
    sheets.forEach(name => {
      const btn = document.createElement("button");
      btn.className = "sheet-btn";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        overlay.style.display = "none";
        resolve(name);
      });
      list.appendChild(btn);
    });

    const cleanup = () => { overlay.style.display = "none"; resolve(null); };
    cancel.onclick = cleanup;
    overlay.onclick = e => { if (e.target === overlay) cleanup(); };
    overlay.style.display = "flex";
  });
}

/* ════════════════════════════════════════════════════════════════
   COLUMN DETECTION (synonym matching)
   ════════════════════════════════════════════════════════════════ */
function detectMapping(headers, sampleRows) {
  const mapping = {};     // role → colName
  const confidence = {};  // role → "high"|"medium"|"none"
  const used = new Set();

  // Exact + fuzzy match per role
  for (const [role, syns] of Object.entries(SYNONYMS)) {
    let bestCol = null, bestScore = 0;
    for (const header of headers) {
      if (used.has(header)) continue; // skip already-claimed columns early
      const h = header.toLowerCase().trim();
      // Exact match
      if (syns.includes(h)) {
        bestCol = header; bestScore = 2; break;
      }
      // Substring match — require min 3 chars on both sides to avoid false positives
      // e.g. "id" (2 chars) must not greedily match "period" or "product_id" for wrong role
      for (const syn of syns) {
        if (syn.length >= 3 && h.length >= 3 && (h.includes(syn) || syn.includes(h))) {
          if (bestScore < 1) { bestCol = header; bestScore = 1; }
        }
      }
    }
    if (bestCol && !used.has(bestCol)) {
      // Extra validation: verify data type makes sense
      if (["revenue","transactions","quantity","discount","profit","cost"].includes(role)) {
        const valid = sampleRows.slice(0,5).some(r => {
          const v = r[bestCol]; return v !== "" && !isNaN(parseFloat(String(v).replace(/,/g,"")));
        });
        if (!valid) { bestScore = 0; bestCol = null; }
      }
      if (role === "date" && bestCol) {
        const valid = sampleRows.slice(0,5).some(r => {
          const v = r[bestCol]; return v && !isNaN(new Date(v).getTime());
        });
        if (!valid) { bestScore = 0; bestCol = null; }
      }
    }
    if (bestCol && bestScore > 0) {
      mapping[role]     = bestCol;
      confidence[role]  = bestScore === 2 ? "high" : "medium";
      used.add(bestCol);
    } else {
      confidence[role]  = "none";
    }
  }
  return { mapping, confidence };
}

/* ════════════════════════════════════════════════════════════════
   MAPPING SCREEN
   ════════════════════════════════════════════════════════════════ */
function goToMapping() {
  const { mapping, confidence } = detectMapping(state.rawHeaders, state.rawRows);
  state.mapping = mapping;

  // Update file info
  const fi = document.getElementById("mapping-file-info");
  if (fi) {
    const size = (state.fileSize / 1024).toFixed(1);
    fi.textContent = `${esc(state.fileName)}  ·  ${state.rawRows.length.toLocaleString()} rows  ·  ${state.rawHeaders.length} columns  ·  ${size} KB${state.activeSheet ? "  · Sheet: "+state.activeSheet : ""}`;
  }

  renderPreviewTable();
  renderMappingGrid(confidence);
  renderValidationWarnings();
  renderMappingSummary();
  showScreen("mapping-screen");
}

function renderPreviewTable() {
  const wrap = document.getElementById("preview-table-wrap");
  if (!wrap) return;
  const preview = state.rawRows.slice(0, 5);
  if (!preview.length) { wrap.textContent = "No preview available."; return; }

  let html = '<table class="data-table"><thead><tr>';
  state.rawHeaders.forEach(h => { html += `<th>${esc(h)}</th>`; });
  html += "</tr></thead><tbody>";
  preview.forEach(row => {
    html += "<tr>";
    state.rawHeaders.forEach(h => {
      const v = row[h] ?? "";
      html += `<td>${esc(String(v).slice(0,40))}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrap.innerHTML = html;
}

function renderMappingGrid(confidence) {
  const grid = document.getElementById("mapping-grid");
  if (!grid) return;

  const allRoles = Object.keys(SYNONYMS);
  const opts = ["(not used)", ...state.rawHeaders];

  let html = "";
  allRoles.forEach(role => {
    const meta = ROLE_META[role] || {};
    const currentCol = state.mapping[role] || "";
    const conf = confidence[role] || "none";
    const confLabel = conf === "high" ? "Detected" : conf === "medium" ? "Possible" : "Not found";
    const sample = currentCol && state.rawRows[0] ? String(state.rawRows[0][currentCol] ?? "").slice(0,30) : "—";

    let selectHtml = `<select class="mapping-select" data-role="${esc(role)}" aria-label="Assign column for ${esc(meta.label||role)}">`;
    opts.forEach(o => {
      const sel = o === currentCol ? " selected" : "";
      selectHtml += `<option value="${esc(o)}"${sel}>${esc(o)}</option>`;
    });
    selectHtml += "</select>";

    html += `
      <div class="mapping-row">
        <div class="mapping-row-header">
          <span class="mapping-col-name" title="${esc(meta.label||role)}">${esc(meta.label||role)}</span>
          <span class="mapping-confidence conf-${conf}">${esc(confLabel)}</span>
        </div>
        ${selectHtml}
        <div class="mapping-sample">Sample: ${esc(sample)}</div>
      </div>`;
  });
  grid.innerHTML = html;

  // Live-update mapping when user changes a select
  grid.querySelectorAll(".mapping-select").forEach(sel => {
    sel.addEventListener("change", () => {
      const role = sel.dataset.role;
      const val  = sel.value;
      if (val === "(not used)") delete state.mapping[role];
      else state.mapping[role] = val;
      renderMappingSummary();
    });
  });
}

function renderValidationWarnings() {
  const panel = document.getElementById("validation-warnings");
  const list  = document.getElementById("validation-list");
  if (!panel || !list) return;

  const warns = [];
  // Check required columns
  if (!state.mapping.date)    warns.push("Date column not mapped — trend charts will be unavailable.");
  if (!state.mapping.revenue) warns.push("Revenue column not mapped — most KPIs will be unavailable.");

  // Sample data checks
  if (state.mapping.revenue) {
    const col = state.mapping.revenue;
    let badCount = 0;
    state.rawRows.slice(0,100).forEach(r => { if (isNaN(parseFloat(String(r[col]||"").replace(/,/g,"")))) badCount++; });
    if (badCount > 5) warns.push(`Revenue column has ${badCount} non-numeric values in first 100 rows.`);
  }
  if (state.mapping.date) {
    const col = state.mapping.date;
    let badDate = 0;
    state.rawRows.slice(0,100).forEach(r => { if (isNaN(new Date(r[col]).getTime())) badDate++; });
    if (badDate > 5) warns.push(`Date column has ${badDate} unparseable dates in first 100 rows.`);
  }
  // Discount range check
  if (state.mapping.discount) {
    const col = state.mapping.discount;
    const vals = state.rawRows.slice(0,100).map(r=>parseFloat(r[col])).filter(v=>!isNaN(v));
    const max = Math.max(...vals);
    if (max <= 1.0 && max > 0) warns.push("Discount values appear to be in 0–1 range (e.g. 0.10). Will be multiplied ×100 and stored as 0–100.");
  }

  if (!warns.length) { panel.style.display = "none"; return; }
  list.innerHTML = warns.map(w => `<div class="warning-item">${esc(w)}</div>`).join("");
  panel.style.display = "block";
}

function renderMappingSummary() {
  const el = document.getElementById("mapping-summary");
  if (!el) return;
  const mapped = Object.entries(state.mapping).filter(([,v])=>v).length;
  const note   = document.getElementById("mapping-note");
  const canGen = !!state.mapping.revenue;

  const btn = document.getElementById("btn-generate");
  if (btn) {
    btn.disabled = !canGen;
    btn.style.opacity = canGen ? "1" : ".5";
    btn.title = canGen ? "" : "Revenue column is required to generate dashboard.";
  }
  if (note) note.textContent = canGen ? "" : "Revenue column must be mapped to generate dashboard.";

  el.innerHTML = `<strong>${mapped}</strong> of ${Object.keys(SYNONYMS).length} columns mapped · <strong>${state.rawRows.length.toLocaleString()}</strong> rows will be analysed`;
}

/* ════════════════════════════════════════════════════════════════
   DATA PIPELINE: validate & normalise → rawData
   ════════════════════════════════════════════════════════════════ */
function buildPipeline() {
  const dq = {
    fileName: state.fileName,
    totalRows: state.rawRows.length,
    validRows: 0,
    invalidRows: 0,
    invalidDetails: [],
    duplicates: 0,
    missingRevenue: 0,
    missingDate: 0,
    numericErrors: 0,
    dateMin: null,
    dateMax: null,
    loadedAt: new Date().toISOString(),
    status: "pass",
    outliers: [],
    discountScale: "0-100",
  };

  // Detect discount scale
  if (state.mapping.discount) {
    const vals = state.rawRows.slice(0,100)
      .map(r=>parseFloat(String(r[state.mapping.discount]||"").replace(/,/g,"")))
      .filter(v=>!isNaN(v));
    if (vals.length && Math.max(...vals) <= 1.0) dq.discountScale = "0-1";
  }

  const seen  = new Set();
  const valid = [];

  state.rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2;
    const errs   = [];

    // Revenue
    const revRaw = state.mapping.revenue ? String(raw[state.mapping.revenue]||"").replace(/,/g,"") : "";
    const rev    = parseFloat(revRaw);
    if (!state.mapping.revenue || isNaN(rev) || rev < 0) {
      errs.push("invalid revenue"); dq.numericErrors++; dq.missingRevenue++;
    }

    // Date
    let dateObj = null;
    if (state.mapping.date) {
      const dv = raw[state.mapping.date];
      dateObj  = dv ? new Date(dv) : null;
      if (!dateObj || isNaN(dateObj.getTime())) { errs.push("invalid date"); dq.missingDate++; }
    }

    if (errs.length) {
      dq.invalidRows++;
      if (dq.invalidDetails.length < 5) dq.invalidDetails.push({ rowNum, errs });
      return;
    }

    // Optionals
    const txnRaw = state.mapping.transactions ? parseFloat(String(raw[state.mapping.transactions]||"").replace(/,/g,"")) : NaN;
    const qty    = state.mapping.quantity    ? parseFloat(String(raw[state.mapping.quantity]||"").replace(/,/g,""))    : NaN;
    let   disc   = state.mapping.discount    ? parseFloat(String(raw[state.mapping.discount]||"").replace(/,/g,""))    : NaN;
    if (!isNaN(disc) && dq.discountScale === "0-1") disc = disc * 100;
    if (!isNaN(disc)) disc = Math.max(0, Math.min(100, disc));
    const prof   = state.mapping.profit ? parseFloat(String(raw[state.mapping.profit]||"").replace(/,/g,"")) : NaN;

    // Duplicate key: date + product + salesperson
    const dupKey = [
      dateObj ? dateObj.toISOString().slice(0,10) : "",
      state.mapping.product    ? String(raw[state.mapping.product]||"")    : "",
      state.mapping.salesperson? String(raw[state.mapping.salesperson]||""): "",
    ].join("|");
    if (seen.has(dupKey)) dq.duplicates++;
    seen.add(dupKey);

    // Build normalised row
    const norm = {
      _rev:    rev,
      _txn:    isNaN(txnRaw) || txnRaw <= 0 ? 1 : txnRaw,  // proxy = 1 if missing
      _qty:    isNaN(qty)   ? 0 : qty,
      _disc:   isNaN(disc)  ? 0 : disc,
      _prof:   isNaN(prof)  ? null : prof,
      _date:   dateObj,
      _month:  dateObj ? dateObj.getMonth() : null,
      _year:   dateObj ? dateObj.getFullYear() : null,
      _dateStr:dateObj ? dateObj.toISOString().slice(0,10) : "",
      // all original mapped strings
      _cat:    state.mapping.category    ? String(raw[state.mapping.category]||"Unknown").trim()    : null,
      _prod:   state.mapping.product     ? String(raw[state.mapping.product]||"Unknown").trim()     : null,
      _rep:    state.mapping.salesperson ? String(raw[state.mapping.salesperson]||"Unknown").trim() : null,
      _region: state.mapping.region      ? String(raw[state.mapping.region]||"Unknown").trim()      : null,
      _chan:   state.mapping.channel     ? String(raw[state.mapping.channel]||"Unknown").trim()     : null,
      _seg:    state.mapping.segment     ? String(raw[state.mapping.segment]||"Unknown").trim()     : null,
      _pay:    state.mapping.payment     ? String(raw[state.mapping.payment]||"Unknown").trim()     : null,
      _cust:   state.mapping.customer_id ? String(raw[state.mapping.customer_id]||"Unknown").trim() : null,
      _rawRow: raw,
    };
    valid.push(norm);

    if (!dq.dateMin || dateObj < dq.dateMin) dq.dateMin = dateObj;
    if (!dq.dateMax || dateObj > dq.dateMax) dq.dateMax = dateObj;
  });

  dq.validRows = valid.length;
  if (dq.invalidRows || dq.duplicates) dq.status = dq.invalidRows > dq.validRows * .3 ? "fail" : "warn";

  // Outlier candidates (±3σ on revenue)
  const revs = valid.map(r=>r._rev);
  const mu   = revs.reduce((a,b)=>a+b,0)/(revs.length||1);
  const sig  = Math.sqrt(revs.map(v=>(v-mu)**2).reduce((a,b)=>a+b,0)/(revs.length||1));
  valid.forEach(r => { if (Math.abs(r._rev - mu) > 3*sig) dq.outliers.push({ date:r._dateStr, rev:r._rev }); });

  state.rawData  = valid;
  state.filtered = [...valid];
  state.dqReport = dq;
}

/* ════════════════════════════════════════════════════════════════
   GENERATE DASHBOARD
   ════════════════════════════════════════════════════════════════ */
function generateDashboard() {
  buildPipeline();
  if (!state.rawData.length) {
    alert("No valid rows found. Check column mapping and data format.");
    return;
  }

  // Topbar file info
  const tfi = document.getElementById("topbar-file-info");
  if (tfi) {
    const s = (state.fileSize/1024).toFixed(1);
    tfi.textContent = `${state.fileName}  ·  ${state.rawData.length.toLocaleString()} rows  ·  ${s} KB`;
  }

  buildFilters();
  showScreen("dashboard-screen");

  // Restore persisted filter selection (URL params or localStorage) now that
  // filter <select> elements have been built into the DOM by buildFilters().
  // If restoration succeeds, applyFilters() re-slices rawData → filtered.
  // If nothing to restore, filtered is already = [...rawData] from buildPipeline.
  const hadSaved = (() => {
    let raw = window.location.search.slice(1);
    if (!raw) { try { raw = localStorage.getItem("sp-filters") || ""; } catch (_) {} }
    return !!raw;
  })();
  if (hadSaved) {
    restoreFilterState();
    applyFilters(); // re-slices filtered and calls renderAll(true) internally
  } else {
    renderAll(); // initial render — no user-driven filter change, don't persist
  }
}

/* ════════════════════════════════════════════════════════════════
   FILTER ENGINE
   ════════════════════════════════════════════════════════════════ */
function buildFilters() {
  const ctrl = document.getElementById("filter-controls");
  if (!ctrl) return;
  ctrl.innerHTML = "";

  const filterDims = [
    { id: "f-date",   label: "Period", role: "date",     type: "quarter" },
    { id: "f-region", label: "Region",   role: "region"   },
    { id: "f-cat",    label: "Category", role: "category" },
    { id: "f-seg",    label: "Segment",  role: "segment"  },
    { id: "f-chan",   label: "Channel",  role: "channel"  },
    { id: "f-rep",    label: "Sales Rep",role: "salesperson"},
  ];

  filterDims.forEach(dim => {
    // For date: use quarter selector
    if (dim.type === "quarter") {
      if (!colExists("date")) return;
      const wrap = document.createElement("div");
      wrap.className = "filter-item";
      wrap.innerHTML = `<label class="filter-label" for="${esc(dim.id)}">${esc(dim.label)}</label>
        <select class="filter-select" id="${esc(dim.id)}" aria-label="${esc(dim.label)}">
          <option value="all">All Periods</option>
          <option value="Q1">Q1 (Jan–Mar)</option>
          <option value="Q2">Q2 (Apr–Jun)</option>
          <option value="Q3">Q3 (Jul–Sep)</option>
          <option value="Q4">Q4 (Oct–Dec)</option>
        </select>`;
      ctrl.appendChild(wrap);
      wrap.querySelector("select").addEventListener("change", applyFilters);
      return;
    }

    // Dimension filters: only show if column mapped + has multiple values
    if (!colExists(dim.role)) return;
    const vals = [...new Set(state.rawData.map(r => r["_"+dim.role.replace("region","region").replace("salesperson","rep")] || "Unknown"))].filter(Boolean).sort();
    if (vals.length < 2 || vals.length > 100) return;

    // Map role to data key
    const keyMap = {region:"_region",category:"_cat",segment:"_seg",channel:"_chan",salesperson:"_rep"};
    const dataKey = keyMap[dim.role] || ("_"+dim.role);

    const wrap = document.createElement("div");
    wrap.className = "filter-item";
    let opts = `<option value="all">All ${esc(dim.label)}s</option>`;
    vals.forEach(v => { opts += `<option value="${esc(v)}">${esc(v)}</option>`; });
    wrap.innerHTML = `<label class="filter-label" for="${esc(dim.id)}">${esc(dim.label)}</label>
      <select class="filter-select" id="${esc(dim.id)}" data-key="${esc(dataKey)}" aria-label="${esc(dim.label)}">${opts}</select>`;
    ctrl.appendChild(wrap);
    wrap.querySelector("select").addEventListener("change", applyFilters);
  });
}

function applyFilters() {
  const QM = { Q1:[0,1,2], Q2:[3,4,5], Q3:[6,7,8], Q4:[9,10,11] };
  const periodEl = document.getElementById("f-date");
  const period   = periodEl ? periodEl.value : "all";

  // Collect all dimension filters
  const dimFilters = [];
  document.querySelectorAll(".filter-select[data-key]").forEach(sel => {
    if (sel.value !== "all") dimFilters.push({ key: sel.dataset.key, val: sel.value });
  });

  state.filtered = state.rawData.filter(r => {
    if (period !== "all" && r._month !== null && !QM[period].includes(r._month)) return false;
    for (const df of dimFilters) {
      if ((r[df.key]||"Unknown") !== df.val) return false;
    }
    return true;
  });

  renderAll(true); // user-driven: persist filter state
}

function resetFilters() {
  document.querySelectorAll(".filter-select").forEach(el => el.value = "all");
  state.filtered = [...state.rawData];
  renderAll(true); // user-driven: persist filter state
}

function renderFilterBadges() {
  const badges = document.getElementById("active-filter-badges");
  const scope  = document.getElementById("topbar-scope");
  const count  = document.getElementById("filter-row-count");

  if (count) count.textContent = `${state.filtered.length.toLocaleString()} rows`;

  const active = [];
  document.querySelectorAll(".filter-select").forEach(sel => {
    if (sel.value !== "all") {
      const label = sel.closest(".filter-item")?.querySelector(".filter-label")?.textContent || sel.id;
      active.push(`${label}: ${sel.value}`);
    }
  });

  if (badges) {
    badges.innerHTML = active.map(a => `<span class="active-badge">${esc(a)}</span>`).join("");
  }
  if (scope) {
    if (active.length) { scope.textContent = active.length + " filter"+(active.length>1?"s":"")+" active"; scope.style.display="inline-block"; }
    else scope.style.display = "none";
  }
}

/* ════════════════════════════════════════════════════════════════
   KPI ENGINE
   ════════════════════════════════════════════════════════════════ */
function renderKPIs() {
  const row = document.getElementById("kpi-row");
  if (!row) return;
  row.innerHTML = "";

  const f = state.filtered;
  if (!f.length) {
    row.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:8px;">No data for current filters.</div>';
    return;
  }

  const totalRev  = sumKey(f,"_rev");
  const totalTxn  = sumKey(f,"_txn");
  const totalQty  = sumKey(f,"_qty");
  const avgDisc   = avgKey(f,"_disc");
  const profArr   = f.filter(r=>r._prof!==null);
  const totalProf = profArr.length ? sumKey(profArr,"_prof") : null;
  const aov       = totalTxn > 0 ? totalRev / totalTxn : null;

  const [h1, h2]  = splitHalves(f);
  const hasSplit  = h1.length > 0 && h2.length > 0;

  const revGrowth = hasSplit ? pctChange(sumKey(h2,"_rev"), sumKey(h1,"_rev")) : null;

  const QKPIS = [
    { id: "kpi-rev",   label: "Revenue",      val: fmtCurrency(totalRev), deltaVal: revGrowth,      inv: false, def: "revenue",      color: "#2563eb", warn: null },
    { id: "kpi-aov",   label: "Avg Order Val", val: aov!==null?fmtCurrency(Math.round(aov)):"N/A",
      deltaVal: hasSplit&&sumKey(h1,"_txn")>0 ? pctChange(sumKey(h2,"_rev")/sumKey(h2,"_txn"), sumKey(h1,"_rev")/sumKey(h1,"_txn")) : null,
      inv: false, def: "aov", color: "#0d9488", warn: null },
    { id: "kpi-txn",   label: "Transactions",  val: fmtNum(totalTxn), deltaVal: hasSplit ? pctChange(sumKey(h2,"_txn"),sumKey(h1,"_txn")) : null, inv: false, def: "transactions", color: "#7c3aed", warn: null },
    { id: "kpi-qty",   label: "Qty Sold",       val: colExists("quantity") ? fmtNum(totalQty)+" units" : "N/A",
      deltaVal: hasSplit&&colExists("quantity") ? pctChange(sumKey(h2,"_qty"),sumKey(h1,"_qty")) : null,
      inv: false, def: "quantity", color: "#0284c7", warn: null },
    { id: "kpi-disc",  label: "Avg Discount",   val: colExists("discount") ? avgDisc.toFixed(1)+"%" : "N/A",
      deltaVal: null, inv: true, def: "discount", color: "#d97706",
      warn: colExists("discount") && avgDisc > 10 ? (avgDisc>12?"Critical >12%":"⚠ >10%") : null },
  ];
  if (totalProf !== null) {
    QKPIS.push({ id: "kpi-profit", label: "Profit",   val: fmtCurrency(totalProf), deltaVal: null, inv: false, def: "profit", color: "#16a34a", warn: null });
  }
  if (revGrowth !== null) {
    QKPIS.push({ id: "kpi-growth", label: "Revenue Growth", val: (revGrowth>=0?"+":"")+revGrowth.toFixed(1)+"%", deltaVal: null, inv: false, def: "growth", color: revGrowth>=0?"#16a34a":"#e11d48", warn: null });
  }

  // One shared document-click handler to close all open KPI tooltips.
  // Stored on the row element so it can be removed before each re-render.
  if (row._docClickHandler) {
    document.removeEventListener("click", row._docClickHandler);
  }
  row._docClickHandler = e => {
    if (!e.target.closest(".kpi-card")) {
      row.querySelectorAll(".kpi-tooltip-popup.visible").forEach(p => {
        p.classList.remove("visible");
        p.previousElementSibling?.setAttribute("aria-expanded", "false");
      });
    }
  };
  document.addEventListener("click", row._docClickHandler, { passive: true });

  QKPIS.forEach(kpi => {
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.id = kpi.id;
    card.style.borderTopColor = kpi.color;
    card.setAttribute("role","listitem");

    let deltaHtml = "";
    if (kpi.warn) {
      deltaHtml = `<span class="kpi-card-delta neg">${esc(kpi.warn)}</span>`;
    } else if (kpi.deltaVal !== null && kpi.deltaVal !== undefined && isFinite(kpi.deltaVal)) {
      const up = kpi.deltaVal > 0;
      const isPos = kpi.inv ? !up : up;
      const arrow = up ? "▲ +" : "▼ ";
      deltaHtml = `<span class="kpi-card-delta ${isPos?"pos":"neg"}">${esc(arrow)}${Math.abs(kpi.deltaVal).toFixed(1)}% H1→H2</span>`;
    } else if (kpi.deltaVal === null && !kpi.warn && ["kpi-rev","kpi-txn","kpi-qty","kpi-aov"].includes(kpi.id)) {
      deltaHtml = `<span class="kpi-na">N/A — need ≥2 months</span>`;
    }

    const def = KPI_DEFS[kpi.def] || {};
    card.innerHTML = `
      <div class="kpi-card-label">${esc(kpi.label)}</div>
      <div class="kpi-card-value">${esc(kpi.val)}</div>
      ${deltaHtml}
      <button class="kpi-tooltip-btn" aria-label="Show definition for ${esc(kpi.label)}" aria-expanded="false">&#9432;</button>
      <div class="kpi-tooltip-popup" role="tooltip">
        <div class="kpi-tooltip-popup-title">${esc(kpi.label)}</div>
        <div><strong>Formula:</strong> ${esc(def.formula||"")}</div>
        <div><strong>Unit:</strong> ${esc(def.unit||"")}</div>
        ${def.limitation?`<div style="color:var(--warn);margin-top:4px;">&#9888; ${esc(def.limitation)}</div>`:""}
      </div>`;

    // Tooltip toggle — no per-card document listener (shared handler above handles close)
    const btn     = card.querySelector(".kpi-tooltip-btn");
    const tooltip = card.querySelector(".kpi-tooltip-popup");
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const open = tooltip.classList.toggle("visible");
      btn.setAttribute("aria-expanded", String(open));
      // Position: push left if near right edge
      const rect = card.getBoundingClientRect();
      if (rect.right + 280 > window.innerWidth) {
        tooltip.style.left = "auto"; tooltip.style.right = "0";
      } else {
        tooltip.style.left = "0"; tooltip.style.right = "auto";
      }
    });

    row.appendChild(card);
  });
}

/* ════════════════════════════════════════════════════════════════
   INSIGHT ENGINE — max 5 concise insights
   ════════════════════════════════════════════════════════════════ */
function renderInsights() {
  const container = document.getElementById("insight-cards");
  const alertBox  = document.getElementById("smart-alerts");
  if (!container) return;
  container.innerHTML = "";
  if (alertBox) { alertBox.innerHTML = ""; alertBox.style.display = "none"; }

  const f = state.filtered;
  if (!f.length) {
    container.innerHTML = `<div class="insight-card ic-neutral"><div class="insight-headline">No data for current filters</div><div class="insight-evidence">Reset filters to restore data.</div></div>`;
    return;
  }

  const totalRev = sumKey(f,"_rev");
  const totalTxn = sumKey(f,"_txn");
  const avgDisc  = avgKey(f,"_disc");
  const [h1,h2]  = splitHalves(f);
  const hasSplit = h1.length>0 && h2.length>0;
  const revGrowth= hasSplit ? pctChange(sumKey(h2,"_rev"),sumKey(h1,"_rev")) : null;

  const byCat    = groupBy(f.filter(r=>r._cat),  "_cat");
  const byReg    = groupBy(f.filter(r=>r._region),"_region");
  const byProd   = groupBy(f.filter(r=>r._prod),  "_prod");
  const byRep    = groupBy(f.filter(r=>r._rep),   "_rep");

  const catsSorted = Object.keys(byCat).sort((a,b)=>sumKey(byCat[b],"_rev")-sumKey(byCat[a],"_rev"));
  const regsSorted = Object.keys(byReg).sort((a,b)=>sumKey(byReg[b],"_rev")-sumKey(byReg[a],"_rev"));
  const prodsSorted= Object.keys(byProd).sort((a,b)=>sumKey(byProd[b],"_rev")-sumKey(byProd[a],"_rev"));
  const repsSorted = Object.keys(byRep).sort((a,b)=>sumKey(byRep[b],"_rev")-sumKey(byRep[a],"_rev"));

  const topCat  = catsSorted[0], topReg  = regsSorted[0];
  const topProd = prodsSorted[0], topRep  = repsSorted[0];
  const botRep  = repsSorted[repsSorted.length-1];

  const insights = [];

  // Smart alert: high discount
  if (colExists("discount") && avgDisc > 10) {
    const msg = avgDisc > 12
      ? `&#9888; <strong>Critical:</strong> Avg discount ${avgDisc.toFixed(1)}% — critically above 12% threshold. Immediate governance review recommended.`
      : `&#9888; <strong>Alert:</strong> Avg discount ${avgDisc.toFixed(1)}% exceeds 10% margin-protection guideline.`;
    if (alertBox) { alertBox.innerHTML = msg; alertBox.style.display = "block"; }
  }

  // 1. Revenue growth/decline
  if (revGrowth !== null) {
    const dir = revGrowth >= 0 ? "grew" : "declined";
    const cls = revGrowth >= 5 ? "ic-good" : revGrowth >= 0 ? "ic-info" : "ic-risk";
    insights.push({
      cls, headline: `Revenue ${revGrowth>=0?"+":""}${revGrowth.toFixed(1)}% (H1→H2)`,
      evidence: `H1: ${fmtCurrency(sumKey(h1,"_rev"))} → H2: ${fmtCurrency(sumKey(h2,"_rev"))} · Δ ${fmtCurrency(Math.abs(sumKey(h2,"_rev")-sumKey(h1,"_rev")))}`,
      action: revGrowth < 0
        ? "Investigate pipeline: review by region and category to isolate decline drivers."
        : "Maintain momentum. Ensure supply chain supports continued demand.",
      conf: Math.abs(revGrowth) > 5 ? "high" : "medium",
    });
  }

  // 2. Top category concentration — use plain strings; rendering uses textContent
  if (topCat && totalRev > 0) {
    const share = (sumKey(byCat[topCat],"_rev")/totalRev*100).toFixed(1);
    const cls   = parseFloat(share) > 60 ? "ic-warn" : "ic-info";
    insights.push({
      cls, headline: `${topCat} drives ${share}% of revenue`,
      evidence: `${topCat}: ${fmtCurrency(sumKey(byCat[topCat],"_rev"))} of ${fmtCurrency(totalRev)} total.`,
      action: parseFloat(share)>60 ? "Revenue is highly concentrated. Diversify cross-category sales to reduce single-category dependency." : "Monitor category mix. Grow share of under-performing categories.",
      conf: "high",
    });
  }

  // 3. Top product concentration — use plain strings; rendering uses textContent
  if (topProd && prodsSorted.length >= 2 && totalRev > 0) {
    const share = (sumKey(byProd[topProd],"_rev")/totalRev*100).toFixed(1);
    if (parseFloat(share) > 20) {
      insights.push({
        cls: "ic-warn", headline: `${topProd} at ${share}% of revenue`,
        evidence: `${topProd}: ${fmtCurrency(sumKey(byProd[topProd],"_rev"))}. Next: ${prodsSorted[1]} at ${(sumKey(byProd[prodsSorted[1]],"_rev")/totalRev*100).toFixed(1)}%.`,
        action: `Secure inventory for ${topProd}. Promote adjacent products to reduce single-SKU risk.`,
        conf: "high",
      });
    }
  }

  // 4. Regional gap — use plain strings; rendering uses textContent
  if (regsSorted.length >= 2 && totalRev > 0) {
    const top = regsSorted[0], bot = regsSorted[regsSorted.length-1];
    const gap = pctChange(sumKey(byReg[top],"_rev"), sumKey(byReg[bot],"_rev"));
    insights.push({
      cls: "ic-info", headline: `Regional gap: ${top} vs ${bot}`,
      evidence: `${top}: ${fmtCurrency(sumKey(byReg[top],"_rev"))} · ${bot}: ${fmtCurrency(sumKey(byReg[bot],"_rev"))}. Gap: ${gap!==null?Math.abs(gap).toFixed(0)+"%":"N/A"} higher.`,
      action: `Investigate ${bot} pipeline. Assess territory coverage, headcount, and product availability.`,
      conf: "medium",
    });
  }

  // 5. Salesperson gap — use plain strings; rendering uses textContent
  if (repsSorted.length >= 2 && topRep !== botRep) {
    const topRevRep = sumKey(byRep[topRep],"_rev");
    const botRevRep = sumKey(byRep[botRep],"_rev");
    const gap = pctChange(topRevRep, botRevRep);
    insights.push({
      cls: "ic-info", headline: `Rep gap: ${topRep} vs ${botRep}`,
      evidence: `${topRep}: ${fmtCurrency(topRevRep)} · ${botRep}: ${fmtCurrency(botRevRep)}. Gap: ${gap!==null?Math.abs(gap).toFixed(0)+"%":"N/A"}.`,
      action: `Review ${botRep}'s territory and pipeline. Consider coaching or quota reassessment.`,
      conf: "medium",
    });
  }

  // Cap at 5 most impactful
  const top5 = insights.slice(0, 5);
  top5.forEach(ins => {
    const confClass = ins.conf === "high" ? "conf-badge-high" : ins.conf === "medium" ? "conf-badge-medium" : "conf-badge-low";
    const card = document.createElement("div");
    card.className = `insight-card ${ins.cls}`;
    const titleEl = document.createElement("div");
    titleEl.className = "insight-headline";
    titleEl.textContent = ins.headline;
    const evEl = document.createElement("div");
    evEl.className = "insight-evidence";
    evEl.textContent = ins.evidence;
    const actEl = document.createElement("div");
    actEl.className = "insight-action";
    actEl.innerHTML = `&#8594; ${esc(ins.action)}`;
    const confEl = document.createElement("span");
    confEl.className = `insight-conf ${confClass}`;
    confEl.textContent = `Confidence: ${ins.conf}`;
    card.appendChild(titleEl);
    card.appendChild(evEl);
    card.appendChild(actEl);
    card.appendChild(confEl);
    container.appendChild(card);
  });

  if (!top5.length) {
    container.innerHTML = `<div class="insight-card ic-neutral"><div class="insight-headline">Insufficient data for insights</div><div class="insight-evidence">Map more columns or expand filters to enable insights.</div></div>`;
  }
}

/* ════════════════════════════════════════════════════════════════
   CHART ENGINE — 8 charts
   ════════════════════════════════════════════════════════════════ */
function renderCharts() {
  renderTrendChart();
  renderCategoryChart();
  renderRegionChart();
  renderTopProductsChart();
  renderSalespersonChart();
  renderChannelChart();
  renderDiscountScatter();
}

function renderTrendChart() {
  destroyChart("trend");
  const canvas = document.getElementById("chart-trend");
  const titleEl = document.getElementById("title-trend");
  const subEl   = document.getElementById("sub-trend");
  const granWrap= document.getElementById("trend-granularity-wrap");
  if (!canvas || !colExists("date")) {
    const wrap = document.getElementById("wrap-trend");
    if (wrap) wrap.innerHTML = `<div class="feature-unavailable">Date column not mapped — trend chart unavailable.</div>`;
    return;
  }
  if (granWrap) granWrap.style.display = "inline-flex";
  if (titleEl)  titleEl.textContent = "Revenue Trend — " + (state.trendGran === "month" ? "Monthly" : state.trendGran === "quarter" ? "Quarterly" : "Weekly");
  if (subEl)    subEl.textContent   = "Revenue vs Quantity (dual-axis)";

  const gran = state.trendGran;
  const groups = {};
  state.filtered.forEach(r => {
    if (!r._date) return;
    let key;
    if (gran === "month")   key = `${r._year}-${String(r._month+1).padStart(2,"0")}`;
    else if (gran === "quarter") {
      const q = Math.floor(r._month/3)+1;
      key = `${r._year}-Q${q}`;
    } else {
      // weekly: ISO week
      const d = r._date, jan1 = new Date(d.getFullYear(),0,1);
      const w = Math.ceil(((d-jan1)/86400000 + jan1.getDay()+1)/7);
      key = `${r._year}-W${String(w).padStart(2,"0")}`;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  const labels = Object.keys(groups).sort();
  const revData = labels.map(k => +(sumKey(groups[k],"_rev")/1e6).toFixed(2));
  const qtyData = labels.map(k => sumKey(groups[k],"_qty"));

  const ctx = canvas.getContext("2d");
  const datasets = [
    { type:"line", label:"Revenue (M)", data:revData, borderColor:PAL[0], backgroundColor:"rgba(37,99,235,.1)", tension:.35, fill:true, yAxisID:"y", pointRadius:3 },
  ];
  if (colExists("quantity")) {
    datasets.push({ type:"bar", label:"Qty Sold", data:qtyData, backgroundColor:PAL[1]+"99", yAxisID:"y2", borderRadius:3 });
  }
  charts["trend"] = new Chart(ctx, {
    data: { labels, datasets },
    options: {
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{position:"top"}, tooltip:{mode:"index"} },
      scales:{
        y:{position:"left",title:{display:true,text:"Revenue (M)"}},
        y2:{position:"right",title:{display:true,text:"Qty"},grid:{drawOnChartArea:false},display:colExists("quantity")},
      },
    },
  });
}

function renderCategoryChart() {
  destroyChart("category");
  const canvas = document.getElementById("chart-category");
  const wrap   = document.getElementById("wrap-category");
  if (!canvas || !colExists("category")) { if (wrap) wrap.style.display="none"; return; }
  if (wrap) wrap.style.display = "";
  const byCat = groupBy(state.filtered.filter(r=>r._cat), "_cat");
  const labels = Object.keys(byCat);
  const data   = labels.map(k => sumKey(byCat[k],"_rev"));
  if (!labels.length) return;
  charts["category"] = new Chart(canvas.getContext("2d"), {
    type:"doughnut",
    data:{ labels, datasets:[{data, backgroundColor:PAL, borderWidth:2}] },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{
        legend:{position:"bottom"},
        tooltip:{callbacks:{label: ctx => {
          const sum = ctx.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${fmtCurrency(ctx.raw)} (${(ctx.raw/sum*100).toFixed(1)}%)`;
        }}},
      },
    },
  });
}

function renderRegionChart() {
  destroyChart("region");
  const canvas = document.getElementById("chart-region");
  const wrap   = document.getElementById("wrap-region");
  if (!canvas || !colExists("region")) { if (wrap) wrap.style.display="none"; return; }
  if (wrap) wrap.style.display = "";
  const byReg = groupBy(state.filtered.filter(r=>r._region), "_region");
  const sorted = Object.keys(byReg).sort((a,b)=>sumKey(byReg[b],"_rev")-sumKey(byReg[a],"_rev"));
  const revD   = sorted.map(k => +(sumKey(byReg[k],"_rev")/1e6).toFixed(1));
  const txnD   = sorted.map(k => sumKey(byReg[k],"_txn"));
  charts["region"] = new Chart(canvas.getContext("2d"), {
    type:"bar",
    data:{labels:sorted, datasets:[
      {label:"Revenue (M)", data:revD, backgroundColor:PAL[0]+"cc", borderRadius:3, yAxisID:"y"},
      {label:"Transactions",data:txnD, backgroundColor:PAL[1]+"99", borderRadius:3, yAxisID:"y2"},
    ]},
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{legend:{position:"top"}},
      scales:{
        y:{position:"left",title:{display:true,text:"Revenue M"}},
        y2:{position:"right",title:{display:true,text:"Txn"},grid:{drawOnChartArea:false}},
      },
    },
  });
}

function renderTopProductsChart() {
  destroyChart("top-products");
  const canvas = document.getElementById("chart-top-products");
  const wrap   = document.getElementById("wrap-top-products");
  if (!canvas || !colExists("product")) { if (wrap) wrap.style.display="none"; return; }
  if (wrap) wrap.style.display = "";
  const byProd = groupBy(state.filtered.filter(r=>r._prod), "_prod");
  const top    = Object.keys(byProd).sort((a,b)=>sumKey(byProd[b],"_rev")-sumKey(byProd[a],"_rev")).slice(0,10);
  const data   = top.map(k => +(sumKey(byProd[k],"_rev")/1e6).toFixed(1));
  charts["top-products"] = new Chart(canvas.getContext("2d"), {
    type:"bar",
    data:{labels:top, datasets:[{label:"Revenue (M)", data, backgroundColor:PAL[0]+"cc", borderRadius:3}]},
    options:{
      indexAxis:"y", responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false}},
      scales:{x:{title:{display:true,text:"Revenue M"}}},
    },
  });
}

function renderSalespersonChart() {
  destroyChart("salesperson");
  const canvas = document.getElementById("chart-salesperson");
  const wrap   = document.getElementById("wrap-salesperson");
  if (!canvas || !colExists("salesperson")) { if (wrap) wrap.style.display="none"; return; }
  if (wrap) wrap.style.display = "";
  const byRep = groupBy(state.filtered.filter(r=>r._rep), "_rep");
  const sorted= Object.keys(byRep).sort((a,b)=>sumKey(byRep[b],"_rev")-sumKey(byRep[a],"_rev")).slice(0,10);
  const data  = sorted.map(k => +(sumKey(byRep[k],"_rev")/1e6).toFixed(1));
  charts["salesperson"] = new Chart(canvas.getContext("2d"), {
    type:"bar",
    data:{labels:sorted, datasets:[{label:"Revenue (M)", data, backgroundColor:sorted.map((_,i)=>PAL[i%PAL.length]+"cc"), borderRadius:3}]},
    options:{
      indexAxis:"y", responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false}},
      scales:{x:{title:{display:true,text:"Revenue M"}}},
    },
  });
}

function renderChannelChart() {
  destroyChart("channel");
  const canvas = document.getElementById("chart-channel");
  const wrap   = document.getElementById("wrap-channel");
  if (!canvas || !colExists("channel")) { if (wrap) wrap.style.display="none"; return; }
  if (wrap) wrap.style.display = "";
  const byChan = groupBy(state.filtered.filter(r=>r._chan), "_chan");
  const labels = Object.keys(byChan);
  const data   = labels.map(k => +(sumKey(byChan[k],"_rev")/1e6).toFixed(1));
  charts["channel"] = new Chart(canvas.getContext("2d"), {
    type:"doughnut",
    data:{labels, datasets:[{data, backgroundColor:PAL, borderWidth:2}]},
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{
        legend:{position:"bottom"},
        tooltip:{callbacks:{label: ctx => {
          const sum = ctx.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${ctx.raw}M (${(ctx.raw/sum*100).toFixed(1)}%)`;
        }}},
      },
    },
  });
}

function renderDiscountScatter() {
  destroyChart("discount-scatter");
  const canvas = document.getElementById("chart-discount-scatter");
  const wrap   = document.getElementById("wrap-discount-scatter");
  if (!canvas || !colExists("discount")) { if (wrap) wrap.style.display="none"; return; }
  if (wrap) wrap.style.display = "";
  const pts = state.filtered.map(r => ({ x: r._disc, y: +(r._rev/1e6).toFixed(2) }));
  charts["discount-scatter"] = new Chart(canvas.getContext("2d"), {
    type:"scatter",
    data:{datasets:[{label:"Disc% vs Rev", data:pts, backgroundColor:PAL[2]+"99", pointRadius:4}]},
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false}},
      scales:{
        x:{title:{display:true,text:"Discount %"}},
        y:{title:{display:true,text:"Revenue M"}},
      },
    },
  });
}

/* ════════════════════════════════════════════════════════════════
   RECOMMENDATIONS
   ════════════════════════════════════════════════════════════════ */
function renderRecommendations() {
  const container = document.getElementById("rec-cards");
  if (!container) return;
  container.innerHTML = "";

  const f = state.filtered;
  if (!f.length) return;

  const avgDisc   = avgKey(f,"_disc");
  const totalRev  = sumKey(f,"_rev");
  const [h1,h2]   = splitHalves(f);
  const revGrowth = (h1.length&&h2.length) ? pctChange(sumKey(h2,"_rev"),sumKey(h1,"_rev")) : null;

  const byProd = groupBy(f.filter(r=>r._prod), "_prod");
  const topProd = Object.keys(byProd).sort((a,b)=>sumKey(byProd[b],"_rev")-sumKey(byProd[a],"_rev"))[0];
  const byReg   = groupBy(f.filter(r=>r._region),"_region");
  const botReg  = Object.keys(byReg).sort((a,b)=>sumKey(byReg[a],"_rev")-sumKey(byReg[b],"_rev"))[0];
  const byRep   = groupBy(f.filter(r=>r._rep),"_rep");
  const botRep  = Object.keys(byRep).sort((a,b)=>sumKey(byRep[a],"_rev")-sumKey(byRep[b],"_rev"))[0];

  const recs = [];

  if (colExists("discount") && avgDisc > 10) {
    recs.push({ pri:"high", title:"Implement Discount Governance",
      body:`Avg discount ${avgDisc.toFixed(1)}% exceeds margin-protection threshold. Introduce tiered approval gates (manager for >10%, VP for >12%).`,
      kpi:"Avg discount % · Gross margin %", timeline:"30 days" });
  }
  if (topProd && totalRev>0 && sumKey(byProd[topProd],"_rev")/totalRev > 0.2) {
    const share = (sumKey(byProd[topProd],"_rev")/totalRev*100).toFixed(0);
    recs.push({ pri:"medium", title:`Secure inventory: ${topProd}`,
      body:`${topProd} drives ${share}% of revenue. Increase safety stock and review procurement cycles to avoid stockout in peak periods.`,
      kpi:"Units sold MoM · Stockout rate", timeline:"14 days" });
  }
  if (revGrowth !== null && revGrowth < 0) {
    recs.push({ pri:"high", title:"Revenue decline: investigation required",
      body:`Revenue declined ${Math.abs(revGrowth).toFixed(1)}% (H1→H2). Conduct pipeline review by region and category to isolate root causes.`,
      kpi:"Revenue MoM · Pipeline coverage", timeline:"7 days" });
  }
  if (botReg) {
    recs.push({ pri:"medium", title:`Grow ${botReg} region`,
      body:`${botReg} is the lowest-revenue region. Assess territory coverage, salesperson allocation, and product availability.`,
      kpi:"Regional revenue growth % · Transactions", timeline:"60–90 days" });
  }
  if (botRep) {
    recs.push({ pri:"medium", title:`Coach ${botRep} — performance review`,
      body:`${botRep} is the lowest-revenue rep. Schedule pipeline review and consider mentoring with top-performing rep.`,
      kpi:"Rep revenue MoM · Quota attainment", timeline:"30 days" });
  }

  if (!recs.length) {
    container.innerHTML = `<div class="rec-card pri-low"><div class="rec-card-title">No high-priority actions identified</div><div class="rec-card-body">All monitored indicators are within acceptable bounds for the current filter view.</div></div>`;
    return;
  }

  recs.forEach(r => {
    const card = document.createElement("div");
    card.className = `rec-card pri-${r.pri}`;
    const titleEl = document.createElement("div");
    titleEl.className = "rec-card-title";
    const priB = document.createElement("span");
    priB.className = `pri-badge-${r.pri}`;
    priB.textContent = r.pri.charAt(0).toUpperCase()+r.pri.slice(1);
    titleEl.appendChild(priB);
    titleEl.appendChild(document.createTextNode(" " + r.title));

    const bodyEl = document.createElement("div");
    bodyEl.className = "rec-card-body";
    bodyEl.textContent = r.body;

    const kpiEl = document.createElement("div");
    kpiEl.className = "rec-kpi-line";
    kpiEl.textContent = `Eval KPI: ${r.kpi}  ·  Timeline: ${r.timeline}`;

    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    card.appendChild(kpiEl);
    container.appendChild(card);
  });
}

/* ════════════════════════════════════════════════════════════════
   DETAIL TABLE — with sort & search
   ════════════════════════════════════════════════════════════════ */
function renderDetailTable() {
  const wrap = document.getElementById("detail-table-wrap");
  const countEl = document.getElementById("table-count-label");
  if (!wrap) return;

  let rows = [...state.filtered];

  // Search
  const q = state.tableSearch.toLowerCase().trim();
  if (q) {
    rows = rows.filter(r => {
      return [r._dateStr, r._cat, r._prod, r._rep, r._region, r._chan, r._seg]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }

  // Sort
  const { col, asc } = state.tableSort;
  if (col) {
    const keyMap = { Date:"_dateStr", Revenue:"_rev", Transactions:"_txn", Quantity:"_qty", Discount:"_disc",
      Category:"_cat", Product:"_prod", Salesperson:"_rep", Region:"_region", Channel:"_chan", Segment:"_seg" };
    const k = keyMap[col];
    if (k) rows = rows.slice().sort((a,b) => {
      const va = a[k] ?? "", vb = b[k] ?? "";
      return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  const display = rows.slice(0, 100);
  if (countEl) countEl.textContent = `Showing ${display.length} of ${rows.length} rows`;

  // Determine which columns to show
  const cols = [
    { label:"Date",        key:"_dateStr", always:true  },
    { label:"Revenue",     key:"_rev",     always:true,  fmt: v => fmtCurrency(v) },
    { label:"Transactions",key:"_txn",     always:false, fmt: v => v.toLocaleString() },
    { label:"Quantity",    key:"_qty",     always:false, fmt: v => v.toLocaleString() },
    { label:"Discount",    key:"_disc",    always:false, fmt: v => v.toFixed(1)+"%" },
    { label:"Category",    key:"_cat",     always:false },
    { label:"Product",     key:"_prod",    always:false },
    { label:"Salesperson", key:"_rep",     always:false },
    { label:"Region",      key:"_region",  always:false },
    { label:"Channel",     key:"_chan",     always:false },
    { label:"Segment",     key:"_seg",     always:false },
  ].filter(c => c.always || (state.filtered[0] && state.filtered[0][c.key] !== null && state.filtered[0][c.key] !== undefined));

  let html = '<table class="data-table"><thead><tr>';
  cols.forEach(c => {
    const sortClass = state.tableSort.col === c.label ? (state.tableSort.asc ? "sort-asc" : "sort-desc") : "";
    html += `<th data-col="${esc(c.label)}" class="${sortClass}" scope="col">${esc(c.label)}</th>`;
  });
  html += "</tr></thead><tbody>";

  display.forEach(r => {
    html += "<tr>";
    cols.forEach(c => {
      const raw = r[c.key];
      const val = raw === null || raw === undefined ? "—" : (c.fmt ? c.fmt(raw) : String(raw));
      html += `<td>${esc(val)}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrap.innerHTML = html;

  // Sort listeners
  wrap.querySelectorAll("thead th[data-col]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (state.tableSort.col === col) state.tableSort.asc = !state.tableSort.asc;
      else { state.tableSort.col = col; state.tableSort.asc = true; }
      renderDetailTable();
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   DATA QUALITY PANEL
   ════════════════════════════════════════════════════════════════ */
function renderDQPanel() {
  const statsEl   = document.getElementById("dq-stats");
  const mapEl     = document.getElementById("dq-mapping");
  const kpiDefsEl = document.getElementById("dq-kpidefs");
  const dq = state.dqReport;

  if (statsEl && dq.totalRows) {
    const fmt = d => d ? new Date(d).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}) : "N/A";
    const badge = dq.status === "pass" ? '<span class="dq-badge dq-pass">✔ PASS</span>'
                : dq.status === "warn" ? '<span class="dq-badge dq-warn-badge">⚠ WARNING</span>'
                : '<span class="dq-badge dq-fail">✖ FAIL</span>';
    const lines = [
      ["File",              esc(dq.fileName)],
      ["Loaded",            esc(new Date(dq.loadedAt).toLocaleString())],
      ["Total rows",        dq.totalRows.toLocaleString()],
      ["Valid rows",        dq.validRows.toLocaleString(), "dq-good"],
      ["Invalid rows",      dq.invalidRows.toLocaleString(), dq.invalidRows>0?"dq-warn":"dq-good"],
      ["Duplicate sigs",    dq.duplicates.toLocaleString(), dq.duplicates>0?"dq-warn":"dq-good"],
      ["Date range",        fmt(dq.dateMin)+" – "+fmt(dq.dateMax)],
      ["Outliers (±3σ rev)",dq.outliers.length.toLocaleString(), dq.outliers.length>0?"dq-warn":"dq-good"],
      ["Discount scale",    esc(dq.discountScale)],
    ];
    statsEl.innerHTML = lines.map(([k,v,cls="dq-muted"]) =>
      `<div class="dq-line"><span class="dq-key">${k}</span><span class="dq-val ${cls}">${v}</span></div>`
    ).join("") + badge;
  }

  if (mapEl) {
    const mapped   = Object.entries(state.mapping).filter(([,v])=>v);
    const unmapped = Object.keys(SYNONYMS).filter(k => !state.mapping[k]);
    mapEl.innerHTML = mapped.map(([role,col]) =>
      `<div class="dq-line"><span class="dq-key">${esc(ROLE_META[role]?.label||role)}</span><span class="dq-val dq-good">${esc(col)}</span></div>`
    ).join("") + unmapped.map(role =>
      `<div class="dq-line"><span class="dq-key" style="color:var(--text-3);">${esc(ROLE_META[role]?.label||role)}</span><span class="dq-val dq-muted">not mapped</span></div>`
    ).join("");
  }

  if (kpiDefsEl) {
    kpiDefsEl.innerHTML = Object.entries(KPI_DEFS).map(([id,def]) =>
      `<div style="margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid var(--border);">
        <div style="font-weight:700;font-size:12px;margin-bottom:3px;">${esc(id.charAt(0).toUpperCase()+id.slice(1))}</div>
        <div class="dq-line"><span class="dq-key">Formula</span><span class="dq-val dq-muted">${esc(def.formula)}</span></div>
        <div class="dq-line"><span class="dq-key">Unit</span><span class="dq-val dq-muted">${esc(def.unit)}</span></div>
        <div style="font-size:11px;color:var(--warn);margin-top:2px;">&#9888; ${esc(def.limitation)}</div>
      </div>`
    ).join("");
  }
}

/* ════════════════════════════════════════════════════════════════
   CSV EXPORT (formula-injection safe)
   ════════════════════════════════════════════════════════════════ */
let _exportInProgress = false;
function exportCSV() {
  if (_exportInProgress) return; // prevent double-click duplicate download
  _exportInProgress = true;
  setTimeout(() => { _exportInProgress = false; }, 1000);

  const cols = [
    { label:"Date",         fn: r => r._dateStr },
    { label:"Revenue",      fn: r => r._rev },
    { label:"Transactions", fn: r => r._txn },
    { label:"Quantity",     fn: r => r._qty },
    { label:"Discount%",    fn: r => r._disc },
    { label:"Category",     fn: r => r._cat||"" },
    { label:"Product",      fn: r => r._prod||"" },
    { label:"Salesperson",  fn: r => r._rep||"" },
    { label:"Region",       fn: r => r._region||"" },
    { label:"Channel",      fn: r => r._chan||"" },
    { label:"Segment",      fn: r => r._seg||"" },
  ];
  const rows = [cols.map(c=>c.label).join(",")];
  state.filtered.forEach(r => {
    rows.push(cols.map(c => {
      const v = String(c.fn(r) ?? "");
      const safe = /^[=+\-@]/.test(v) ? "\t"+v : v;
      return `"${safe.replace(/"/g,'""')}"`;
    }).join(","));
  });
  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "salespulse_export_" + new Date().toISOString().slice(0,10) + ".csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ════════════════════════════════════════════════════════════════
   COLLAPSE / EXPAND SECTIONS
   ════════════════════════════════════════════════════════════════ */
function initCollapseButtons() {
  const pairs = [
    ["btn-collapse-insights", "insight-body"],
    ["btn-collapse-advanced", "advanced-body"],
    ["btn-collapse-recs",     "recs-body"],
    ["btn-collapse-table",    "detail-body"],
    ["btn-collapse-dq",       "dq-body"],
  ];
  pairs.forEach(([btnId, bodyId]) => {
    const btn  = document.getElementById(btnId);
    const body = document.getElementById(bodyId);
    if (!btn || !body) return;
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      body.style.display = expanded ? "none" : "block";
      btn.setAttribute("aria-expanded", String(!expanded));
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   DARK MODE
   ════════════════════════════════════════════════════════════════ */
function initDarkMode() {
  const btn = document.getElementById("btn-theme");
  if (!btn) return;
  const saved = localStorage.getItem("sp-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  btn.textContent = saved === "dark" ? "☀" : "☾";
  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next    = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "☀" : "☾";
    localStorage.setItem("sp-theme", next);
    // Redraw ALL charts (including advanced) on theme change
    if (state.rawData.length) {
      renderCharts();
      renderForecast();
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   PROGRESS HELPERS
   ════════════════════════════════════════════════════════════════ */
function showProgress(pct, msg) {
  const prog = document.getElementById("upload-progress");
  const bar  = document.getElementById("progress-bar");
  const txt  = document.getElementById("progress-text");
  if (!prog) return;
  prog.style.display = "flex";
  if (bar) bar.style.width = pct + "%";
  if (txt) txt.textContent = msg || "";
}
function hideProgress() {
  const prog = document.getElementById("upload-progress");
  if (prog) prog.style.display = "none";
}
function showUploadError(msg) {
  const el  = document.getElementById("upload-error");
  const txt = document.getElementById("upload-error-text");
  if (!el || !txt) return;
  txt.textContent = msg;
  el.style.display = "flex";
}
function clearUploadError() {
  const el = document.getElementById("upload-error");
  if (el) el.style.display = "none";
}

/* ════════════════════════════════════════════════════════════════
   CLEAR DATA
   ════════════════════════════════════════════════════════════════ */
function clearData() {
  state = { rawHeaders:[], rawRows:[], mapping:{}, rawData:[], filtered:[],
    dqReport:{}, fileName:"", fileSize:0, sheets:[], activeSheet:"",
    tableSort:{col:null,asc:true}, tableSearch:"", trendGran:"month" };
  Object.keys(charts).forEach(id => { charts[id].destroy(); delete charts[id]; });
  // Remove the shared KPI tooltip listener if it was set
  const kpiRow = document.getElementById("kpi-row");
  if (kpiRow && kpiRow._docClickHandler) {
    document.removeEventListener("click", kpiRow._docClickHandler);
    kpiRow._docClickHandler = null;
  }
  const tfi = document.getElementById("topbar-file-info");
  if (tfi) tfi.textContent = "";
  showScreen("upload-screen");
}

/* ════════════════════════════════════════════════════════════════
   PHASE 3: ADVANCED ANALYTICS
   ════════════════════════════════════════════════════════════════ */

/* ── Linear regression helpers ───────────────────────────────── */
function linReg(xs, ys) {
  // Returns { slope, intercept, r2 }
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let ssxy=0, ssxx=0, ssyy=0;
  for (let i=0;i<n;i++){
    ssxy += (xs[i]-mx)*(ys[i]-my);
    ssxx += (xs[i]-mx)**2;
    ssyy += (ys[i]-my)**2;
  }
  const slope = ssxx===0 ? 0 : ssxy/ssxx;
  const intercept = my - slope*mx;
  const r2 = ssyy===0 ? 1 : (ssxy**2)/(ssxx*ssyy);
  return { slope, intercept, r2 };
}

/* ── FORECAST (3-month linear regression projection) ─────────── */
function renderForecast() {
  destroyChart("forecast");
  const canvas   = document.getElementById("chart-forecast");
  const titleEl  = document.getElementById("title-forecast");
  const subEl    = document.getElementById("sub-forecast");
  const summaryEl= document.getElementById("forecast-summary");
  const wrapEl   = document.getElementById("wrap-forecast");

  if (!canvas || !colExists("date")) {
    if (wrapEl) wrapEl.innerHTML = `<div class="feature-unavailable">Forecast requires the <strong>date</strong> column to be mapped.</div>`;
    if (summaryEl) summaryEl.innerHTML = "";
    return;
  }

  // Build monthly buckets from filtered data
  const groups = {};
  state.filtered.forEach(r => {
    if (!r._date) return;
    const key = `${r._year}-${String(r._month+1).padStart(2,"0")}`;
    if (!groups[key]) groups[key] = 0;
    groups[key] += r._rev;
  });

  const sortedKeys = Object.keys(groups).sort();
  if (sortedKeys.length < 3) {
    if (wrapEl) wrapEl.innerHTML = `<div class="feature-unavailable">Forecast needs at least 3 months of data. Current view has ${sortedKeys.length}.</div>`;
    if (summaryEl) summaryEl.innerHTML = "";
    return;
  }

  // Restore canvas element if a previous "unavailable" message replaced it
  if (wrapEl) {
    const existing = wrapEl.querySelector(".feature-unavailable");
    if (existing) {
      // Re-use the chart-card-header if it exists; rebuild the canvas only
      const header = wrapEl.querySelector(".chart-card-header");
      wrapEl.innerHTML = "";
      if (header) wrapEl.appendChild(header);
      const c = document.createElement("canvas");
      c.id = "chart-forecast"; c.setAttribute("role","img");
      c.setAttribute("aria-label","Revenue forecast chart");
      wrapEl.appendChild(c);
    }
  }

  // Always resolve the canvas after any DOM repair above
  const freshCanvas = document.getElementById("chart-forecast");
  if (!freshCanvas) return; // safety: canvas not in DOM

  const actRevs = sortedKeys.map(k => groups[k]);
  const xs = sortedKeys.map((_,i) => i);

  const { slope, intercept, r2 } = linReg(xs, actRevs.map(v => v/1e6));

  // Projected next 3 months
  const lastKey = sortedKeys[sortedKeys.length-1];
  const [ly, lm] = lastKey.split("-").map(Number);
  const projLabels = [], projVals = [];
  for (let i=1;i<=3;i++) {
    const d = new Date(ly, lm-1+i, 1);
    const lbl = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    projLabels.push(lbl);
    const x = sortedKeys.length - 1 + i;
    projVals.push(Math.max(0, slope*x + intercept));
  }

  const trendVals = xs.map(x => slope*x + intercept);
  const allLabels = [...sortedKeys, ...projLabels];

  // Format labels for display (YYYY-MM → Mon YYYY)
  const displayLabels = allLabels.map(k => {
    if (k.includes("-") && k.length === 7) {
      const [y,m] = k.split("-").map(Number);
      return `${MONTHS[m-1]} ${y}`;
    }
    return k;
  });

  const ctx = freshCanvas.getContext("2d");
  charts["forecast"] = new Chart(ctx, {
    type: "line",
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: "Actual Revenue (M)",
          data: [...actRevs.map(v=>+(v/1e6).toFixed(2)), ...Array(3).fill(null)],
          borderColor: PAL[0], backgroundColor: "rgba(37,99,235,.12)",
          tension: .3, fill: true, pointRadius: 3, borderWidth: 2,
        },
        {
          label: "Trend line",
          data: [...trendVals.map(v=>+v.toFixed(2)), ...projVals.map(v=>+v.toFixed(2))],
          borderColor: PAL[4], backgroundColor: "transparent",
          borderDash: [4,4], tension: 0, pointRadius: 0, borderWidth: 1.5,
        },
        {
          label: "Forecast (3 mo)",
          data: [...Array(sortedKeys.length).fill(null), ...projVals.map(v=>+v.toFixed(2))],
          borderColor: PAL[2], backgroundColor: "rgba(124,58,237,.15)",
          tension: .25, fill: true, pointRadius: 5, borderWidth: 2,
          pointBackgroundColor: PAL[2],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: "top" },
        tooltip: { mode: "index" },
        annotation: undefined,
      },
      scales: {
        y: { title: { display: true, text: "Revenue (M IDR)" }, beginAtZero: false },
      },
    },
  });

  // Summary strip
  const lastActual = actRevs[actRevs.length-1];
  const proj1 = projVals[0] * 1e6;
  const proj3 = projVals[2] * 1e6;
  const growthDir = slope >= 0;
  const r2pct = (r2*100).toFixed(0);
  const posNeg = growthDir ? "adv-pill-pos" : "adv-pill-neg";

  if (summaryEl) {
    summaryEl.innerHTML = [
      `<span class="adv-summary-pill">Trend slope: <strong>${(slope>=0?"+":"")}${(slope*1e6/1e6).toFixed(2)}M/mo</strong></span>`,
      `<span class="adv-summary-pill ${posNeg}">Next month proj: <strong>${fmtCurrency(proj1)}</strong></span>`,
      `<span class="adv-summary-pill ${posNeg}">Month+3 proj: <strong>${fmtCurrency(proj3)}</strong></span>`,
      `<span class="adv-summary-pill">Model fit R²: <strong>${r2pct}%</strong></span>`,
      `<span class="adv-summary-pill" style="font-size:10px;color:var(--text-3);">&#9888; Linear projection only — does not capture seasonality or market shocks.</span>`,
    ].join("");
  }

  if (titleEl) titleEl.textContent = "Revenue Trend + 3-Month Forecast";
  if (subEl)   subEl.textContent   = `${sortedKeys.length} months historical · R²=${r2pct}%`;
}

/* ── COHORT ANALYSIS ─────────────────────────────────────────── */
function renderCohort() {
  const wrap     = document.getElementById("cohort-table-wrap");
  const unavail  = document.getElementById("cohort-unavail");
  if (!wrap || !unavail) return;

  // Need segment or customer_id
  const hasSegment   = colExists("segment");
  const hasCustId    = colExists("customer_id");
  const hasDate      = colExists("date");

  if ((!hasSegment && !hasCustId) || !hasDate) {
    wrap.innerHTML = "";
    unavail.style.display = "block";
    return;
  }
  unavail.style.display = "none";

  // Cohort dimension = segment if available, else customer_id
  const dimKey = hasSegment ? "_seg" : "_cust";
  // Ensure _cust key is present if needed
  const f = state.filtered.filter(r => r._date && r[dimKey]);

  if (!f.length) { wrap.innerHTML = `<div class="feature-unavailable">No data for cohort analysis in current filter view.</div>`; return; }

  // Get sorted months and segments
  const months   = [...new Set(f.map(r => `${r._year}-${String(r._month+1).padStart(2,"0")}`))].sort();
  const segments = [...new Set(f.map(r => r[dimKey]))].sort();

  if (months.length > 18) {
    // Cap to last 18 months for readability
    months.splice(0, months.length - 18);
  }

  // Build matrix: rows = segments, cols = months
  const matrix = {};
  segments.forEach(s => {
    matrix[s] = {};
    months.forEach(m => { matrix[s][m] = 0; });
  });
  f.forEach(r => {
    const mkey = `${r._year}-${String(r._month+1).padStart(2,"0")}`;
    if (matrix[r[dimKey]] && months.includes(mkey)) {
      matrix[r[dimKey]][mkey] = (matrix[r[dimKey]][mkey] || 0) + r._rev;
    }
  });

  // Compute max per segment for heat intensity
  const segMaxes = {};
  segments.forEach(s => {
    segMaxes[s] = Math.max(...months.map(m => matrix[s][m]||0), 1);
  });

  // Overall max for global normalisation
  const globalMax = Math.max(...segments.map(s => segMaxes[s]), 1);

  // Format month label
  const fmtMo = k => { const [y,m] = k.split("-").map(Number); return `${MONTHS[m-1]}\n${y}`; };

  let html = '<table class="cohort-table"><thead><tr><th>Segment / Month</th>';
  months.forEach(m => { html += `<th>${esc(fmtMo(m).replace("\n"," "))}</th>`; });
  html += '<th>Total</th></tr></thead><tbody>';

  segments.forEach(s => {
    html += `<tr><td>${esc(s)}</td>`;
    let rowTotal = 0;
    months.forEach(m => {
      const v = matrix[s][m] || 0;
      rowTotal += v;
      const intensity = Math.floor((v / globalMax) * 4);
      const cls = v > 0 ? `cohort-cell-${intensity}` : "";
      html += `<td class="${cls}">${v > 0 ? fmtCurrency(v) : "—"}</td>`;
    });
    html += `<td style="font-weight:700;">${fmtCurrency(rowTotal)}</td>`;
    html += "</tr>";
  });

  // Total row
  html += "<tr><td><strong>Total</strong></td>";
  months.forEach(m => {
    const t = segments.reduce((acc,s) => acc+(matrix[s][m]||0), 0);
    html += `<td><strong>${fmtCurrency(t)}</strong></td>`;
  });
  const grandTotal = segments.reduce((acc,s) => acc + months.reduce((a,m) => a+(matrix[s][m]||0), 0), 0);
  html += `<td style="font-weight:700;">${fmtCurrency(grandTotal)}</td>`;
  html += "</tr></tbody></table>";

  wrap.innerHTML = html;
}

/* ── BASKET / CROSS-SELL ANALYSIS ────────────────────────────── */
function renderBasket() {
  const wrap    = document.getElementById("basket-table-wrap");
  const unavail = document.getElementById("basket-unavail");
  if (!wrap || !unavail) return;

  if (!colExists("product") || !colExists("date")) {
    wrap.innerHTML = "";
    unavail.style.display = "block";
    return;
  }
  unavail.style.display = "none";

  const f = state.filtered.filter(r => r._prod && r._dateStr);
  if (f.length < 2) { wrap.innerHTML = `<div class="feature-unavailable">Not enough data for basket analysis.</div>`; return; }

  // Group rows by (date + salesperson) as a "transaction basket"
  const buckets = {};
  f.forEach(r => {
    const bkey = `${r._dateStr}|${r._rep||"_"}`;
    if (!buckets[bkey]) buckets[bkey] = new Set();
    buckets[bkey].add(r._prod);
  });

  // Count co-occurrences of product pairs
  const pairCounts = {};
  const prodFreq   = {};
  Object.values(buckets).forEach(prods => {
    const arr = [...prods];
    arr.forEach(p => { prodFreq[p] = (prodFreq[p]||0) + 1; });
    for (let i=0;i<arr.length;i++) {
      for (let j=i+1;j<arr.length;j++) {
        const pk = arr[i] < arr[j] ? `${arr[i]}|||${arr[j]}` : `${arr[j]}|||${arr[i]}`;
        pairCounts[pk] = (pairCounts[pk]||0) + 1;
      }
    }
  });

  const totalBaskets = Object.keys(buckets).length;

  // Sort pairs by count desc, take top 15
  const sorted = Object.entries(pairCounts)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 15);

  if (!sorted.length) {
    wrap.innerHTML = `<div class="feature-unavailable">No product pairs found — each basket appears to have a single product.</div>`;
    return;
  }

  // Build table
  let html = '<table class="basket-table"><thead><tr>' +
    '<th class="basket-rank">#</th>' +
    '<th>Product A</th><th>Product B</th>' +
    '<th>Co-occurrences</th><th>Support %</th>' +
    '<th>Lift indicator</th></tr></thead><tbody>';

  sorted.forEach(([pk, count], idx) => {
    const [a, b] = pk.split("|||");
    const support = (count / totalBaskets * 100).toFixed(1);
    // Lift = P(A∩B) / (P(A)*P(B)) approximation
    const pA = (prodFreq[a]||1) / totalBaskets;
    const pB = (prodFreq[b]||1) / totalBaskets;
    const lift = ((count/totalBaskets) / (pA * pB)).toFixed(2);
    const barW = Math.min(100, parseFloat(support) * 3); // capped at 100px
    html += `<tr>
      <td class="basket-rank">${idx+1}</td>
      <td>${esc(a)}</td>
      <td>${esc(b)}</td>
      <td style="font-weight:700;">${count}</td>
      <td>${support}%</td>
      <td><span class="basket-conf" style="--basket-bar-w:${barW}px;"></span>${esc(lift)}×</td>
    </tr>`;
  });

  html += `</tbody></table>
    <div style="font-size:11px;color:var(--text-3);margin-top:6px;padding:4px 0;">
      Support = (co-occurrences ÷ total baskets) × 100. Lift &gt; 1 means products appear together more than by chance.
      Based on ${totalBaskets.toLocaleString()} transaction baskets.
    </div>`;

  wrap.innerHTML = html;
}

/* ── WHAT-IF REVENUE SIMULATOR ───────────────────────────────── */
function renderWhatIf() {
  const baseVal  = document.getElementById("wi-base-val");
  const projVal  = document.getElementById("wi-proj-val");
  const deltaLbl = document.getElementById("wi-delta-label");
  if (!baseVal || !projVal || !deltaLbl) return;

  const f = state.filtered;
  if (!f.length) { baseVal.textContent = "N/A"; projVal.textContent = "N/A"; deltaLbl.textContent = "—"; return; }

  const baseRevenue = sumKey(f,"_rev");
  const baseTxn     = sumKey(f,"_txn");
  const baseAOV     = baseTxn > 0 ? baseRevenue / baseTxn : 0;

  baseVal.textContent = fmtCurrency(baseRevenue);

  // Read slider values
  const volPct  = parseInt(document.getElementById("wi-volume")?.value  || 0, 10);
  const pricePct= parseInt(document.getElementById("wi-price")?.value   || 0, 10);
  const discPp  = parseInt(document.getElementById("wi-discount")?.value|| 0, 10);

  // Projected: Revenue = base_txn × (1+vol%) × base_AOV × (1+price%)
  // Discount adjustment: each +1pp discount ≈ −0.7% revenue (conservative estimate)
  const volMult   = 1 + volPct/100;
  const priceMult = 1 + pricePct/100;
  const discMult  = 1 + (discPp * -0.007); // -0.7% per pp discount increase
  const projected = baseRevenue * volMult * priceMult * discMult;
  const delta     = projected - baseRevenue;
  const deltaPct  = baseRevenue > 0 ? (delta/baseRevenue*100) : 0;

  projVal.textContent = fmtCurrency(Math.round(projected));
  const sign = delta >= 0 ? "+" : "";
  const cls  = delta >= 0 ? "wi-delta-pos" : "wi-delta-neg";
  deltaLbl.innerHTML = `<span class="${cls}">${sign}${fmtCurrency(Math.round(delta))} (${sign}${deltaPct.toFixed(1)}%)</span>`;
}

function initWhatIf() {
  const ids = ["wi-volume","wi-price","wi-discount"];
  const labels = {
    "wi-volume":   { el: "wi-volume-val",   suffix: "%",  sign: true  },
    "wi-price":    { el: "wi-price-val",    suffix: "%",  sign: true  },
    "wi-discount": { el: "wi-discount-val", suffix: " pp",sign: true  },
  };

  ids.forEach(id => {
    const input = document.getElementById(id);
    const cfg   = labels[id];
    const lbl   = document.getElementById(cfg.el);
    if (!input || !lbl) return;
    const update = () => {
      const v = parseInt(input.value, 10);
      lbl.textContent = (v >= 0 ? "+" : "") + v + cfg.suffix;
      lbl.style.color = id === "wi-discount"
        ? (v > 0 ? "var(--risk)" : v < 0 ? "var(--good)" : "var(--c-blue)")
        : (v > 0 ? "var(--good)" : v < 0 ? "var(--risk)" : "var(--c-blue)");
      renderWhatIf();
    };
    input.addEventListener("input", update);
  });

  const resetBtn = document.getElementById("btn-wi-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      ids.forEach(id => {
        const el = document.getElementById(id); if(el) el.value = 0;
      });
      Object.values(labels).forEach(cfg => {
        const lbl = document.getElementById(cfg.el);
        if (lbl) { lbl.textContent = "+0"+(cfg.suffix); lbl.style.color = "var(--c-blue)"; }
      });
      renderWhatIf();
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   URL STATE PERSISTENCE  (step 7 — bookmark/share filter state)
   Encodes active filters into ?region=North&period=Q1 …
   Reads them back on load and restores filter selects.
   ════════════════════════════════════════════════════════════════ */

/** Persist active filter state to URL + localStorage */
function saveFilterState() {
  const params = new URLSearchParams();
  document.querySelectorAll(".filter-select").forEach(sel => {
    if (sel.value !== "all") params.set(sel.id, sel.value);
  });
  // Save trend granularity
  if (state.trendGran !== "month") params.set("gran", state.trendGran);

  const url = params.toString()
    ? window.location.pathname + "?" + params.toString()
    : window.location.pathname;
  try {
    window.history.replaceState(null, "", url);
  } catch (_) { /* security: cross-origin */ }

  // Also persist to localStorage so the selection survives page reload
  try {
    localStorage.setItem("sp-filters", params.toString());
  } catch (_) { /* private browsing */ }
}

/** Restore filter state from URL params (preferred) or localStorage */
function restoreFilterState() {
  let raw = window.location.search.slice(1);           // strip leading "?"
  if (!raw) {
    try { raw = localStorage.getItem("sp-filters") || ""; } catch (_) {}
  }
  if (!raw) return;

  const params = new URLSearchParams(raw);
  params.forEach((val, key) => {
    if (key === "gran") {
      state.trendGran = val;
      const granSel = document.getElementById("trend-gran");
      if (granSel) granSel.value = val;
      return;
    }
    const el = document.getElementById(key);
    if (el) el.value = val;
  });
}

/** Clear persisted filter state */
function clearFilterState() {
  try { window.history.replaceState(null, "", window.location.pathname); } catch (_) {}
  try { localStorage.removeItem("sp-filters"); } catch (_) {}
}

/* ════════════════════════════════════════════════════════════════
   CHART PNG EXPORT  (step 7 — export any chart as PNG)
   ════════════════════════════════════════════════════════════════ */

/** Export a specific chart canvas to PNG download */
function exportChartPNG(chartId, filename) {
  const chartObj = charts[chartId];
  if (!chartObj) {
    console.warn("exportChartPNG: chart not found —", chartId);
    return;
  }
  const canvas = chartObj.canvas;
  if (!canvas) return;

  // Create a white-background composite (canvas may have transparent bg)
  const offscreen = document.createElement("canvas");
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  const ctx = offscreen.getContext("2d");
  ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark"
    ? "#0f172a"
    : "#ffffff";
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  ctx.drawImage(canvas, 0, 0);

  const url = offscreen.toDataURL("image/png");
  const a   = document.createElement("a");
  a.href     = url;
  a.download = (filename || chartId) + "_" + new Date().toISOString().slice(0, 10) + ".png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Inject a tiny "📷 PNG" button into every .chart-card-header after charts render */
function injectChartExportButtons() {
  const CHART_ID_MAP = {
    "wrap-trend":           "trend",
    "wrap-category":        "category",
    "wrap-region":          "region",
    "wrap-top-products":    "top-products",
    "wrap-salesperson":     "salesperson",
    "wrap-channel":         "channel",
    "wrap-discount-scatter":"discount-scatter",
    "wrap-forecast":        "forecast",
  };

  Object.entries(CHART_ID_MAP).forEach(([wrapId, chartId]) => {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    if (wrap.querySelector(".btn-chart-png")) return; // already injected

    const header = wrap.querySelector(".chart-card-header");
    if (!header) return;

    const btn = document.createElement("button");
    btn.className   = "btn-chart-png";
    btn.title       = "Export chart as PNG";
    btn.setAttribute("aria-label", "Export this chart as PNG image");
    btn.textContent = "↓ PNG";
    btn.addEventListener("click", () => {
      const label = header.querySelector(".chart-title")?.textContent || chartId;
      const fname = label.trim().replace(/\s+/g, "_").toLowerCase();
      exportChartPNG(chartId, fname);
    });
    header.appendChild(btn);
  });
}

/* ════════════════════════════════════════════════════════════════
   CHART CLICK-TO-FILTER  (step 4 — click chart element → filter)
   Attaches onClick to category, region, channel, top-products,
   salesperson charts after they render.
   ════════════════════════════════════════════════════════════════ */

/**
 * Map from chartId → { filterSelectId, dataKeyInChart }
 * When a user clicks a bar/slice, we find the matching filter select
 * and set its value, then applyFilters().
 */
const CHART_CLICK_MAP = {
  category:        { selectId: "f-cat" },
  region:          { selectId: "f-region" },
  channel:         { selectId: "f-chan" },
  salesperson:     { selectId: "f-rep" },
  "top-products":  { selectId: null },   // no direct filter for product (not a filter dim)
};

function attachChartClickHandlers() {
  Object.entries(CHART_CLICK_MAP).forEach(([chartId, cfg]) => {
    const chartObj = charts[chartId];
    if (!chartObj || !cfg.selectId) return;

    // Remove previous onClick if exists
    chartObj.options.onClick = (evt, elements) => {
      if (!elements || !elements.length) return;
      const idx   = elements[0].index;
      const label = chartObj.data.labels[idx];
      if (!label) return;

      const sel = document.getElementById(cfg.selectId);
      if (!sel) return;

      // If already filtering by this value → toggle off (reset to all)
      if (sel.value === label) {
        sel.value = "all";
      } else {
        sel.value = label;
      }
      applyFilters();
      saveFilterState();
    };
    chartObj.update();
  });
}

/* ════════════════════════════════════════════════════════════════
   RENDER ALL (single pipeline, single call)
   ════════════════════════════════════════════════════════════════ */
/**
 * renderAll — single render pipeline.
 * @param {boolean} [persistFilters=false] — only save filter state when called
 *   from an explicit user action (applyFilters, resetFilters), NOT on initial
 *   programmatic render from generateDashboard/tryLoadDemoData.
 */
function renderAll(persistFilters = false) {
  renderFilterBadges();
  renderKPIs();
  renderInsights();
  renderCharts();
  renderRecommendations();
  renderDetailTable();
  renderDQPanel();
  // Phase 3
  renderForecast();
  renderCohort();
  renderBasket();
  renderWhatIf();
  // Phase 4: post-render hooks
  injectChartExportButtons();
  attachChartClickHandlers();
  if (persistFilters) saveFilterState();
}

/* ════════════════════════════════════════════════════════════════
   BOOT — EVENT LISTENERS
   ════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initUpload();
  initDarkMode();
  initCollapseButtons();
  initWhatIf();

  // Mapping → generate
  const btnGen = document.getElementById("btn-generate");
  if (btnGen) btnGen.addEventListener("click", generateDashboard);

  // Mapping → back
  const btnBack = document.getElementById("btn-back-upload");
  if (btnBack) btnBack.addEventListener("click", () => showScreen("upload-screen"));

  // Clear data
  document.getElementById("btn-clear-data")?.addEventListener("click", clearData);
  document.getElementById("btn-new-file")?.addEventListener("click", clearData);

  // Reset filters — also clear persisted state
  document.getElementById("btn-reset-filters")?.addEventListener("click", () => {
    resetFilters();
    clearFilterState();
  });

  // Export
  document.getElementById("btn-export-csv")?.addEventListener("click", exportCSV);

  // Table search
  const tSearch = document.getElementById("table-search");
  if (tSearch) {
    tSearch.addEventListener("input", e => {
      state.tableSearch = e.target.value;
      renderDetailTable();
    });
  }

  // Trend granularity
  const granSel = document.getElementById("trend-gran");
  if (granSel) granSel.addEventListener("change", () => { state.trendGran = granSel.value; renderTrendChart(); });

  // Try to auto-load the existing demo CSV (gracefully ignored if not present)
  tryLoadDemoData();

  // After demo data loads and generateDashboard is called, restoreFilterState()
  // is invoked from generateDashboard via the overridden flow below.
});

/* ── generateDashboard: built-in filter restore after pipeline builds ── */
// The DOMContentLoaded handler below binds btn-generate → generateDashboard.
// After buildFilters() runs, we restore any previously saved filter state so
// the user's last selection survives a page refresh.  No second listener or
// window-level override is needed.

/* ── Demo data auto-load ──────────────────────────────────────── */
async function tryLoadDemoData() {
  try {
    const res = await fetch("data/sales_data.csv");
    if (!res.ok) return;
    const text = await res.text();
    state.fileName = "sales_data.csv (demo)";
    state.fileSize = text.length;
    const parsed = Papa.parse(text.trim(), { header:true, skipEmptyLines:true, dynamicTyping:false, transformHeader:h=>h.trim() });
    if (!parsed.data.length) return;
    state.rawHeaders = parsed.meta.fields || [];
    state.rawRows    = parsed.data;
    goToMapping();
  } catch (_) {
    // No demo data available — stay on upload screen
  }
}
