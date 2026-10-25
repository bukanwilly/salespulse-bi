# Changelog — SalesPulse BI

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0.0] — 2024-12 — Phase 3: Advanced Analytics

### Added
- **Revenue Forecasting** — 3-month linear regression projection with R² score,
  trend line, and forecast zone chart (3 datasets: actual / trend / forecast).
- **Customer Cohort Analysis** — Segment × Month revenue heatmap with
  5-level blue intensity normalised to global max; total row and column.
- **Cross-Sell & Basket Analysis** — Product pair co-occurrence table with
  support %, lift indicator, and visual bar. Based on date + salesperson baskets.
- **What-If Revenue Simulator** — Three interactive sliders:
  volume change (−50 → +100%), price/AOV change (−30 → +50%),
  discount change (−10 → +10 pp). Live projected revenue with delta.
- **Sheet Selection Modal** — Replaced `window.prompt()` with a proper modal
  dialog for Excel multi-sheet selection.
- **`_cust` key** added to normalised pipeline rows (maps `customer_id` column).
- `initWhatIf()` called in `DOMContentLoaded` boot sequence.
- `btn-collapse-advanced` wired to collapse/expand Advanced Analytics section.

### Files added / changed
| File | Change |
|------|--------|
| `script.js` | +490 lines: Phase 3 functions + modal + pipeline _cust |
| `index.html` | +90 lines: Advanced Analytics section + sheet modal |
| `style.css`  | +230 lines: Phase 3 component styles |
| `tests/unit.test.js` | NEW — 60 unit tests, framework-agnostic |
| `tests/test-runner.html` | NEW — browser-based test UI |
| `data/sample.csv` | NEW — 20-row Q1 2024 test dataset |
| `package.json` | NEW — project metadata + Jest config |
| `.github/workflows/pages.yml` | NEW — CI: test + deploy to GitHub Pages |
| `.nojekyll` | NEW — bypass Jekyll on GitHub Pages |
| `CHANGELOG.md` | NEW — this file |

---

## [1.0.0] — 2024-11 — Phase 1+2: Core + Decision Intelligence

### Added
- Upload screen with drag-drop + file input (CSV/Excel, max 50 MB).
- Auto column detection with 16-role SYNONYMS map (English + Indonesian).
- Mapping screen: review/correct column assignments, validation warnings.
- Data pipeline: `rawData → filtered` (single source of truth).
- Data Quality panel with outlier detection (±3σ), duplicate signals, DQ badge.
- 6 KPI cards: Revenue, AOV, Transactions, Qty, Avg Discount, Growth.
  Each with ⓘ tooltip showing formula, unit, limitation.
- 8 Chart.js charts: Revenue Trend (monthly/quarterly/weekly dual-axis),
  Category Doughnut, Region Bar, Top 10 Products, Salesperson Leaderboard,
  Sales Channel, Discount vs Revenue Scatter.
- Executive Insights engine: max 5 structured insight cards with confidence badges.
- Smart alerts: discount > 10% warning, > 12% critical.
- Recommendations engine: prioritised action cards with eval KPIs + timelines.
- Global filters: Period (quarter), Region, Category, Segment, Channel, Sales Rep.
- Filter badges, row count, reset button.
- Detail table: sortable, searchable, 100-row cap, CSV export (formula-injection safe).
- Dark mode (localStorage `sp-theme` persistence).
- Collapsible sections (4 toggles).
- `tryLoadDemoData()` auto-loads `data/sales_data.csv` on boot.

### Files
| File | Description |
|------|-------------|
| `index.html` | 3-screen layout: Upload / Mapping / Dashboard |
| `style.css`  | Compact design system, light + dark mode, all components |
| `script.js`  | Full app logic — upload, detect, validate, render pipeline |
| `README.md`  | Feature docs, column synonyms, KPI formulas, deployment |
| `data/sales_data.csv` | 136-row FY2024 synthetic demo dataset |

---

## [0.1.0] — 2024-10 — Prototype

### Added
- Initial static HTML dashboard with hardcoded demo data.
- Basic Chart.js line chart and KPI cards.
- No file upload, no dynamic column detection.
