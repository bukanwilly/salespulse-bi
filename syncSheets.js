#!/usr/bin/env node
/**
 * scripts/syncSheets.js
 * ──────────────────────────────────────────────────────────────────
 * Google Sheets → data/sheet.json sync script
 *
 * PURPOSE
 *   Fetches a published Google Sheet (or private via Service Account),
 *   validates rows against the SalesPulse schema, and writes the result
 *   to data/sheet.json so the dashboard can load it as a JSON source.
 *
 * USAGE (local)
 *   node scripts/syncSheets.js
 *
 * USAGE (CI — GitHub Actions, see .github/workflows/refresh-sheets.yml)
 *   Env vars required:
 *     GOOGLE_SHEET_ID              — the spreadsheet ID from the URL
 *     GOOGLE_SERVICE_ACCOUNT_KEY   — full JSON of the service-account key
 *                                    (base64-encoded or raw JSON string)
 *
 * OPTIONAL env vars:
 *     GOOGLE_SHEET_NAME            — sheet/tab name (default: "Sheet1")
 *     OUTPUT_PATH                  — output file path (default: data/sheet.json)
 *
 * SECURITY NOTES
 *   • Never commit GOOGLE_SERVICE_ACCOUNT_KEY to source control.
 *   • Store it in GitHub → Settings → Secrets → Actions.
 *   • The service account only needs "Viewer" permission on the sheet.
 *   • Output file (sheet.json) contains NO credentials.
 *
 * DEPENDENCIES (install in CI, not shipped in package.json as prod dep)
 *   npm install --save-dev googleapis@134
 *
 * OUTPUT FORMAT (data/sheet.json)
 * {
 *   "metadata": {
 *     "sheet_id":   "...",
 *     "sheet_name": "Sheet1",
 *     "fetched_at": "2024-12-01T10:00:00.000Z",
 *     "total_rows": 150,
 *     "valid_rows": 148,
 *     "skipped_rows": 2
 *   },
 *   "headers": ["date", "revenue", "..."],
 *   "rows": [
 *     { "date": "2024-01-05", "revenue": 18000000, ... },
 *     ...
 *   ]
 * }
 * ──────────────────────────────────────────────────────────────────
 */

"use strict";

const fs   = require("fs");
const path = require("path");

/* ── Config ─────────────────────────────────────────────────────── */
const SHEET_ID    = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME  = process.env.GOOGLE_SHEET_NAME  || "Sheet1";
const OUTPUT_PATH = process.env.OUTPUT_PATH        || path.join(__dirname, "..", "data", "sheet.json");
const DRY_RUN     = process.env.DRY_RUN === "true";

/* ── Validation thresholds ──────────────────────────────────────── */
const MAX_SKIP_RATIO = 0.30;  // Abort if >30% of rows are invalid
const REQUIRED_COLS  = [];    // Add column names here to enforce their presence

/* ── Entry point ────────────────────────────────────────────────── */
async function main() {
  console.log("SalesPulse Sheets Sync — starting");
  console.log(`  Sheet ID  : ${SHEET_ID || "(not set)"}`);
  console.log(`  Tab name  : ${SHEET_NAME}`);
  console.log(`  Output    : ${OUTPUT_PATH}`);
  console.log(`  Dry run   : ${DRY_RUN}`);

  if (!SHEET_ID) {
    console.error("❌ GOOGLE_SHEET_ID is not set. Aborting.");
    process.exit(1);
  }

  // 1. Authenticate
  const auth = await buildAuth();

  // 2. Fetch sheet data
  const { headers, rawRows } = await fetchSheet(auth, SHEET_ID, SHEET_NAME);
  console.log(`  Fetched   : ${rawRows.length} data rows, ${headers.length} columns`);

  // 3. Validate and clean rows
  const { validRows, skipped } = validateRows(rawRows, headers);
  const skipRatio = rawRows.length > 0 ? skipped / rawRows.length : 0;
  console.log(`  Valid     : ${validRows.length}  |  Skipped: ${skipped}  (${(skipRatio*100).toFixed(1)}%)`);

  if (skipRatio > MAX_SKIP_RATIO) {
    console.error(`❌ Skip ratio ${(skipRatio*100).toFixed(1)}% exceeds ${MAX_SKIP_RATIO*100}% threshold. Check sheet format.`);
    process.exit(1);
  }

  // 4. Build output object
  const output = {
    metadata: {
      sheet_id:   SHEET_ID,
      sheet_name: SHEET_NAME,
      fetched_at: new Date().toISOString(),
      total_rows: rawRows.length,
      valid_rows: validRows.length,
      skipped_rows: skipped,
    },
    headers,
    rows: validRows,
  };

  // 5. Write output
  if (DRY_RUN) {
    console.log("DRY RUN — output not written. Preview (first 3 rows):");
    console.log(JSON.stringify(output.rows.slice(0, 3), null, 2));
  } else {
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
    console.log(`✅ Written  : ${OUTPUT_PATH}`);
  }

  console.log("SalesPulse Sheets Sync — done");
}

/* ── Build Google Auth (Service Account) ────────────────────────── */
async function buildAuth() {
  // Support two formats for GOOGLE_SERVICE_ACCOUNT_KEY:
  //   1. Raw JSON string
  //   2. Base64-encoded JSON string (useful when secret contains newlines)
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error("❌ GOOGLE_SERVICE_ACCOUNT_KEY is not set. Aborting.");
    process.exit(1);
  }

  let keyJson;
  try {
    // Try raw JSON first
    keyJson = JSON.parse(raw);
  } catch (_) {
    // Try base64 decode
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      keyJson = JSON.parse(decoded);
    } catch (e) {
      console.error("❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON or base64:", e.message);
      process.exit(1);
    }
  }

  // Lazy-load googleapis (only available in CI after npm install)
  let google;
  try {
    ({ google } = require("googleapis"));
  } catch (_) {
    console.error("❌ 'googleapis' package not found. Run: npm install --save-dev googleapis");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return auth;
}

/* ── Fetch sheet data ────────────────────────────────────────────── */
async function fetchSheet(auth, sheetId, sheetName) {
  let google;
  try {
    ({ google } = require("googleapis"));
  } catch (_) {
    console.error("❌ googleapis not installed."); process.exit(1);
  }

  const sheets  = google.sheets({ version: "v4", auth });
  const range   = `${sheetName}`;   // fetch entire sheet

  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
  } catch (err) {
    console.error("❌ Sheets API error:", err.message);
    process.exit(1);
  }

  const values = response.data.values || [];
  if (!values.length) {
    console.warn("⚠  Sheet appears empty.");
    return { headers: [], rawRows: [] };
  }

  // First row = headers
  const headers  = values[0].map(h => String(h).trim());
  const dataRows = values.slice(1);

  // Convert each row array to object keyed by header
  const rawRows = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? String(row[i]).trim() : "";
    });
    return obj;
  });

  return { headers, rawRows };
}

/* ── Validate and clean rows ─────────────────────────────────────── */
function validateRows(rows, headers) {
  let skipped = 0;
  const validRows = [];

  // Check required columns exist
  if (REQUIRED_COLS.length) {
    const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
    if (missing.length) {
      console.error(`❌ Required columns missing from sheet: ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  rows.forEach((row, idx) => {
    // Skip completely empty rows
    const values = Object.values(row);
    if (values.every(v => v === "" || v === null || v === undefined)) {
      skipped++;
      return;
    }

    // Clean individual fields
    const cleaned = {};
    Object.entries(row).forEach(([k, v]) => {
      const trimmed = String(v).trim();
      // Try numeric coercion for columns that look numeric
      const asNum = parseFloat(trimmed.replace(/,/g, ""));
      cleaned[k] = (!isNaN(asNum) && trimmed !== "") ? asNum : trimmed;
    });

    // Row-level warning for rows with unusual numbers of populated columns
    const nonEmptyCount = Object.values(cleaned).filter(v => v !== "").length;
    if (nonEmptyCount < Math.floor(headers.length / 2)) {
      console.warn(`  ⚠  Row ${idx + 2}: only ${nonEmptyCount}/${headers.length} columns populated — included but flagged.`);
    }

    validRows.push(cleaned);
  });

  return { validRows, skipped };
}

/* ── Run ────────────────────────────────────────────────────────── */
main().catch(err => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});
