# Gunny Bag Weighing System — Documentation

**Project:** United Rubber Industries — Unit 1  
**Version:** 1.0  
**Date:** September 2026  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Requirements](#2-requirements)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Environment Configuration](#5-environment-configuration)
6. [Database Schema](#6-database-schema)
7. [Modules & Features](#7-modules--features)
   - 7.1 [Dashboard](#71-dashboard)
   - 7.2 [Master List](#72-master-list)
   - 7.3 [Inventory](#73-inventory)
   - 7.4 [Live Weighing](#74-live-weighing)
   - 7.5 [Weighing History](#75-weighing-history)
   - 7.6 [Label Printing](#76-label-printing)
8. [API Reference](#8-api-reference)
9. [Scale Integration](#9-scale-integration)
10. [Utility Modules](#10-utility-modules)
11. [Deployment & Setup](#11-deployment--setup)
12. [Known Constraints & Notes](#12-known-constraints--notes)

---

## 1. Project Overview

The **Gunny Bag Weighing System** is a web-based application for United Rubber Industries (Unit 1) that manages the complete workflow of weighing rubber compound bags:

- Maintains a **master parts list** with allowed weight tolerances per part
- Reads **live weight** from a Modbus RTU weighing scale over serial port
- Automatically **records and validates** each bag weigh-in against min/max thresholds
- **Prints thermal labels** (TSC printer, 100×50mm) on each accepted weigh-in
- Tracks full **weighing history** with filtering, CSV export, and PDF download
- Provides a real-time **dashboard** with statistics and recent activity

The system is designed to run as a local server on a Windows machine connected to both the scale (USB/RS-485) and the label printer (Ethernet).

---

## 2. Requirements

### Functional Requirements

| # | Requirement |
|---|---|
| FR-01 | Maintain a master list of rubber compound parts with part number, description, weight tolerances, and bag quantity |
| FR-02 | Add, edit, and delete parts from the master list |
| FR-03 | Display a read-only inventory view of all parts |
| FR-04 | Connect to a Modbus RTU weighing scale over a serial port |
| FR-05 | Display live weight readings updated every second |
| FR-06 | Determine bag status: OK, UNDERWEIGHT, or OVERWEIGHT based on bag-level min/max thresholds |
| FR-07 | Auto-save a weighing record and print a label when the scale is stable for 5 seconds |
| FR-08 | Allow manual recording of a weigh-in with operator name and remarks |
| FR-09 | Print a thermal label (TSC, 100×50mm) with part details, QR code, and measured weight |
| FR-10 | Support batch label printing for multiple parts at once |
| FR-11 | Maintain a searchable, filterable weighing history (up to 500 records per query) |
| FR-12 | Export weighing history as CSV |
| FR-13 | Generate and download PDF labels and weighing record documents |
| FR-14 | Show dashboard statistics: total parts, total weighings, status breakdown, today's count |
| FR-15 | Support printer calibration (gap sensor re-teach) |
| FR-16 | Fall back to mock scale readings when the physical scale is offline (dev/test mode) |

### Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-01 | Auto-migrate database schema on startup — no manual migration commands needed |
| NFR-02 | All timestamps stored in UTC and displayed in IST (Asia/Kolkata) |
| NFR-03 | Printer communication via raw TCP socket — no print driver required |
| NFR-04 | Scale polling must be non-overlapping to prevent read queue build-up |
| NFR-05 | Weight stability detection must track full min/max range, not just consecutive differences, to prevent drift-triggered false positives |
| NFR-06 | Label QR codes must be machine-scannable (ECC M, Model 2) |
| NFR-07 | UI must be responsive and usable on standard desktop / wide monitors |

---

## 3. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.6 | Full-stack React framework (App Router) |
| React | 19.2.6 | UI library |
| Tailwind CSS | 4.1.17 | Utility-first styling |
| Lucide React | 1.39.0 | Icon library |
| qrcode.react | 4.2.0 | QR code rendering in browser |
| date-fns | 4.4.0 | Date formatting utilities |

### Backend / API
| Technology | Version | Purpose |
|---|---|---|
| Next.js API Routes | 16.2.6 | Server-side REST API (Node.js runtime) |
| Drizzle ORM | 0.45.2 | Type-safe database ORM |
| drizzle-kit | 0.31.10 | Schema migrations |
| pg | 8.20.0 | PostgreSQL Node.js driver |
| modbus-serial | 8.0.25 | Modbus RTU over serial port (scale) |
| pdfkit | 0.20.2 | Server-side PDF generation |
| qrcode | 1.5.4 | Server-side QR code matrix generation |

### Database
| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | 14+ | Primary relational database |

### Runtime & Tooling
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | JavaScript runtime |
| TypeScript | 5.9.3 | Static typing |
| ESLint | 9.39.4 | Code linting |

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js Client)                  │
│  Dashboard │ Master List │ Inventory │ Weighing │ History    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / fetch
┌────────────────────────▼────────────────────────────────────┐
│                  Next.js App Server                          │
│                                                              │
│  API Routes (/api/*)                                         │
│  ├── /api/health          Health check                       │
│  ├── /api/parts           CRUD for master parts list         │
│  ├── /api/history         Weighing history CRUD + filters    │
│  ├── /api/scale           Live scale reading                 │
│  ├── /api/stats           Dashboard aggregates               │
│  ├── /api/print           Thermal label printing             │
│  └── /api/parts/[id]/label-pdf  PDF label generation        │
│                                                              │
│  Background Services (globalThis)                            │
│  └── ScaleService  ──────────────────────────────────────┐  │
└──────────────────────────────────────┬──────────────────│──┘
                                       │                  │
              ┌────────────────────────┘                  │
              │                                           │
┌─────────────▼──────────┐         ┌─────────────────────▼──┐
│     PostgreSQL DB       │         │   Hardware Devices      │
│  - parts                │         │  ┌─────────────────┐   │
│  - weighing_history     │         │  │ Weighing Scale   │   │
│                         │         │  │ Modbus RTU/RS-485│   │
└─────────────────────────┘         │  │ COM7, 9600 baud  │   │
                                    │  └─────────────────┘   │
                                    │  ┌─────────────────┐   │
                                    │  │ TSC Printer      │   │
                                    │  │ Ethernet TCP     │   │
                                    │  │ 192.168.1.75:9100│   │
                                    │  └─────────────────┘   │
                                    └─────────────────────────┘
```

### Key Architectural Decisions

- **Single server process:** The scale service runs as a singleton on `globalThis` to survive Next.js Hot Module Replacement (HMR) in development.
- **Auto-migration:** `instrumentation.ts` triggers database migrations on startup — no manual setup required after first run.
- **No print driver:** The TSC printer is addressed directly via raw TCP (port 9100) using TSPL commands. No OS printer driver or CUPS is needed.
- **Denormalized history:** `weighing_history` stores `part_number` and `description` alongside `part_id` so historical records remain intact even if the part is renamed or deleted.

---

## 5. Environment Configuration

Create a `.env` file in the project root based on `.env.example`:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5432/gunny_db

# TSC thermal printer (Ethernet)
PRINTER_IP=192.168.1.75
PRINTER_PORT=9100

# Weighing scale (Modbus RTU over USB-serial)
SCALE_DRIVER=modbus
SCALE_PORT=COM7
SCALE_BAUD_RATE=9600
SCALE_SLAVE_ID=1
SCALE_FUNCTION=4          # 3 = Holding Registers, 4 = Input Registers
SCALE_REGISTER=0          # Starting register address
SCALE_QUANTITY=1          # Number of registers to read
SCALE_REGISTER_FORMAT=u16 # u16 | s16 | u32be | u32le | s32be | s32le
SCALE_DIVISOR=100         # Raw value ÷ divisor = kg  (e.g. 5000 → 50.00 kg)
SCALE_POLL_MS=1000        # Poll interval in milliseconds
SCALE_RECONNECT_MS=5000   # Reconnect delay after failure
SCALE_MOCK=false          # true = use random mock readings when scale offline
```

### Variable Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `PRINTER_IP` | `192.168.1.75` | TSC printer IP address |
| `PRINTER_PORT` | `9100` | TSC printer TCP port |
| `SCALE_DRIVER` | `modbus` | Scale communication driver |
| `SCALE_PORT` | `COM7` | Serial port (Windows: `COM7`, Linux: `/dev/ttyUSB0`) |
| `SCALE_BAUD_RATE` | `9600` | Serial communication baud rate |
| `SCALE_SLAVE_ID` | `1` | Modbus device slave/unit ID |
| `SCALE_FUNCTION` | `4` | Modbus function code (3=Holding, 4=Input) |
| `SCALE_REGISTER` | `0` | Register address to read |
| `SCALE_QUANTITY` | `1` | Number of registers to read |
| `SCALE_REGISTER_FORMAT` | `u16` | Register decode format |
| `SCALE_DIVISOR` | `100` | Divisor to convert raw value to kg |
| `SCALE_POLL_MS` | `1000` | Scale poll interval (ms) |
| `SCALE_RECONNECT_MS` | `5000` | Delay before reconnect attempt (ms) |
| `SCALE_MOCK` | `true` | Enable mock mode when scale is offline |

---

## 6. Database Schema

### `parts` — Master Parts List

```sql
CREATE TABLE parts (
  id            SERIAL PRIMARY KEY,
  part_number   VARCHAR(100) NOT NULL UNIQUE,
  description   VARCHAR(500) NOT NULL,
  min_weight    NUMERIC(10,3) NOT NULL,  -- per-item min weight (kg)
  max_weight    NUMERIC(10,3) NOT NULL,  -- per-item max weight (kg)
  quantity      INTEGER NOT NULL,        -- pieces per bag
  actual_weight NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Business rules enforced at API level:**
- `part_number` stored as uppercase, trimmed
- `min_weight < max_weight` required
- `quantity >= 1` required

### `weighing_history` — All Weighing Records

```sql
CREATE TABLE weighing_history (
  id            SERIAL PRIMARY KEY,
  part_id       INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  part_number   VARCHAR(100) NOT NULL,   -- denormalized
  description   VARCHAR(500) NOT NULL,   -- denormalized
  actual_weight NUMERIC(10,3) NOT NULL,  -- measured bag weight (kg)
  quantity      INTEGER NOT NULL,        -- pieces in this bag at time of weighing
  status        VARCHAR(20) NOT NULL,    -- OK | UNDERWEIGHT | OVERWEIGHT
  operator_name VARCHAR(200),
  remarks       TEXT,
  recorded_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Status computation:**
```
bag_min = min_weight × quantity
bag_max = max_weight × quantity

if actual_weight < bag_min  → UNDERWEIGHT
if actual_weight > bag_max  → OVERWEIGHT
else                        → OK
```

### Migrations

Migrations run automatically on server startup via `instrumentation.ts` → `runMigrations()`. The process:

1. Attempts Drizzle Kit file-based migrations from the `./drizzle` folder.
2. Falls back to `CREATE TABLE IF NOT EXISTS` for each table.
3. Handles backward compatibility: removes legacy `max_bag_weight` column, adds `actual_weight`, converts naive timestamps to `TIMESTAMP WITH TIME ZONE` (treats existing values as IST).

---

## 7. Modules & Features

### 7.1 Dashboard

**Route:** `/`  
**API:** `GET /api/stats`

The dashboard is the home screen, providing a quick overview of system activity.

**Features:**
- **6 Stat Cards:**
  - Total Parts (master list count)
  - Total Weighings (all time)
  - Today's Weighings (records from today in IST)
  - OK count
  - Overweight count
  - Underweight count
- **Quick Action Cards:** Links to Live Weighing, Master List, and History
- **Recent Activity Table:** Last 5 weighing records with part number, weight, status badge, and timestamp

**Status badges are colour-coded:**
- ✅ OK → green
- ⚠️ UNDERWEIGHT → amber
- 🔴 OVERWEIGHT → red

---

### 7.2 Master List

**Route:** `/master`  
**APIs:** `GET/POST /api/parts`, `GET/PUT/DELETE /api/parts/[id]`, `POST /api/print`, `POST /api/print/calibrate`

The master list is the primary configuration screen for managing rubber compound parts.

**Features:**

| Feature | Description |
|---|---|
| Search | Debounced 350ms text search across part number and description |
| Create Part | Modal form with live bag-weight preview as you type |
| Edit Part | Pre-filled edit modal with same validation |
| Delete Part | Confirmation modal warning that history records will also be deleted |
| Part Detail Modal | Click any row to view computed bag weights (colour-coded tiles), quick links to Record Weighing and Print Label |
| Batch Select | Checkbox per row + select-all in header |
| Batch Print | Prints one label per selected part (400ms delay between prints) |
| Print Label | Single-part label print from Actions column or Part Detail Modal |
| Download PDF | A6 PDF label download from Part Detail Modal |
| Calibrate Printer | Sends TSPL calibration sequence — use when printer feeds blank labels after loading a new roll |

**Create/Edit form fields:**

| Field | Required | Notes |
|---|---|---|
| Part Number | Yes | Stored uppercase, must be unique |
| Description | Yes | |
| Min Weight (kg) | Yes | Per-item, must be < Max Weight |
| Max Weight (kg) | Yes | Per-item |
| Quantity (pcs/bag) | Yes | ≥ 1 |

**Computed bag weight preview (live in modal):**
- Min Bag Weight = `min_weight × quantity`
- Max Bag Weight = `max_weight × quantity`

---

### 7.3 Inventory

**Route:** `/inventory`  
**API:** `GET /api/parts`

A read-only view of all parts with client-side filtering. Intended for quick reference — all edits are done via Master List.

**Features:**
- **Summary Cards:** Parts shown, total pieces (sum of all quantities), current filter state
- **Filter Panel:**
  - Text search (part number / description)
  - Min/Max quantity range
  - Min/Max weight range
  - All filters applied client-side (no additional API calls)
- **Table Columns:** Part Number, Description, Quantity, Actual Weight, Allowed Range (min–max kg), Max Bag Weight
- **Refresh Button:** Re-fetches data from the API

---

### 7.4 Live Weighing

**Route:** `/weighing`  
**APIs:** `GET /api/scale` (polled every 500ms), `POST /api/history`, `POST /api/print`

The core operational screen used by operators on the production floor.

**Features:**

#### Scale Status Bar
Shows live connection state at the top: serial port, baud rate, slave ID, divisor, mock indicator. Pause/Resume button to temporarily stop polling.

#### Part Selection
- Search modal to find and select a part from the master list
- Pre-select via URL param: `/weighing?part=PN-0001`

#### Live Weight Display
- Large monospace display (7xl font) for easy reading from a distance
- Updates every 500ms
- Shows current reading in kg with 3 decimal places

#### Stability Indicator
Uses `WeightStability` class:
- Tracks the full min/max spread of readings over a rolling 5-second window
- Only reports stable when spread ≤ 0.005 kg for 5 continuous seconds
- Prevents drift from triggering false positives

#### Status Banner
Real-time status based on selected part's thresholds:
- **WAITING** — No part selected or weight near zero
- **OK** (green) — Within min/max bag weight range
- **UNDERWEIGHT** (amber) — Below minimum bag weight
- **OVERWEIGHT** (red) — Above maximum bag weight

#### Auto-Print (Production Mode)
When **all** of these conditions are met simultaneously:
1. A part is selected
2. Scale reading is real (not mock)
3. Weight has been stable for 5 seconds

The system automatically:
- Saves a `weighing_history` record
- Sends the label to the TSC printer
- Resets and waits for weight to return to ≤ 0.005 kg before arming again

This prevents duplicate labels for a single bag.

#### Manual Controls
- **Record Weighing** button — saves without printing
- **Print Label** button — prints label for current part/weight
- **Operator Name** field — optional, saved with the record
- **Remarks** field — optional, saved with the record

---

### 7.5 Weighing History

**Route:** `/history`  
**APIs:** `GET /api/history`, `DELETE /api/history/[id]`, `GET /api/history/[id]/pdf`

Full audit trail of all weighing records with search, filter, export, and PDF download.

**Features:**

| Feature | Description |
|---|---|
| Part number filter | Case-insensitive text search (ILIKE) |
| Status filter | All / OK / OVERWEIGHT / UNDERWEIGHT |
| Date range filter | From date / To date pickers |
| Reset filters | Clears all filters and reloads |
| Summary chips | Total records / OK / Overweight / Underweight counts for current filter |
| Pagination | 15 records per page with Previous/Next navigation |
| Export CSV | Downloads all matching records (not just current page) as CSV with ISO and locale timestamps |
| PDF download | Downloads full A4 record PDF for any individual record |
| Delete record | Confirmation modal before deletion |

**Table Columns:**
`#` · Part No. · Description · Weight (kg) · Qty · Status · Operator · Date & Time · Remarks · Actions

**CSV Export columns:**
ID, Part Number, Description, Actual Weight (kg), Quantity, Status, Operator, Remarks, Recorded At (ISO), Recorded At (Local)

**Record limit:** API returns up to 500 records per query. UI paginates at 15/page.

---

### 7.6 Label Printing

**APIs:** `POST /api/print`, `POST /api/print/calibrate`, `GET /api/parts/[id]/label-pdf`

#### Thermal Label (TSC Printer)

**Label size:** 100mm × 50mm at 203 dpi (800 × 400 dots)

**Label layout:**
```
┌──────────────────────── 800 dots (100 mm) ──────────────────────────┐
│           UNITED RUBBER INDUSTRIES                                   │
│ ────────────────────────────────────────────────────────────────── │
│  ┌────────┐ │  Part No.        : PN-0001                            │
│  │        │ │  Qty/Bag         : 100 pcs                            │
│  │   QR   │ │  Min - Max (kg)  : 0.50 - 1.00                       │
│  │  code  │ │  Exp. Bag (kg)   : 50.00 - 100.00                    │
│  │        │ │  Date            : 10-09-2026                         │
│  └────────┘ │  Actual Wt. (kg) : 52.45  ← if record linked         │
│             │  Status          : OK      ← if record linked         │
└─────────────────────────────────────────────────────────────────────┘
```

**QR code:** Encodes the part number. ECC M, Model 2. Cell size auto-calculated to maximize QR within the left panel.

**Print modes:**
- **Single** (`{partId, recordId?}`) — prints one label. If `recordId` omitted, enriches with most recent history record for the part.
- **Batch** (`{partIds: [...]}`) — prints one label per part with 400ms inter-label delay to avoid printer buffer overrun.

**Communication:** Raw TCP socket to `PRINTER_IP:PRINTER_PORT` (default `192.168.1.75:9100`). No OS print driver required. 5-second connection timeout.

#### PDF Label (Download)

**Route:** `GET /api/parts/[id]/label-pdf?recordId=`

Generates an A6 landscape PDF label using PDFKit. Content mirrors the thermal label with additional styling:
- Outer border
- "UNITED RUBBER" header
- QR code (left)
- Data column (right): Material, Batch, Qty, Min-Max, Max Bag, Date, Actual weight, colour-coded Status pill

#### Printer Calibration

**Route:** `POST /api/print/calibrate`

Sends a TSPL `SIZE` / `GAP` / `FORM` sequence to re-teach the gap sensor. Use this when the printer starts feeding blank labels after loading a new paper roll.

---

## 8. API Reference

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | DB connectivity check. Returns `{status: "ok", db: "connected"}` or 500. |

### Parts

| Method | Path | Body / Query | Description |
|---|---|---|---|
| GET | `/api/parts` | `?q=` | List all parts, optional text filter |
| POST | `/api/parts` | `{partNumber, description, minWeight, maxWeight, quantity}` | Create part |
| GET | `/api/parts/[id]` | — | Get single part |
| PUT | `/api/parts/[id]` | Same as POST | Update part |
| DELETE | `/api/parts/[id]` | — | Delete part (cascades history) |
| GET | `/api/parts/[id]/label-pdf` | `?recordId=` | Download A6 PDF label |

### History

| Method | Path | Body / Query | Description |
|---|---|---|---|
| GET | `/api/history` | `?partNumber=&status=&dateFrom=&dateTo=` | List records (max 500) |
| POST | `/api/history` | `{partId, actualWeight, quantity, operatorName?, remarks?}` | Create record |
| DELETE | `/api/history/[id]` | — | Delete record |
| GET | `/api/history/[id]/pdf` | — | Download A4 record PDF |

### Scale

| Method | Path | Description |
|---|---|---|
| GET | `/api/scale` | Current weight reading `{weight, unit, source, timestamp}` |
| GET | `/api/scale/status` | Diagnostic: `{connected, port, baudRate, slaveId, divisor, mockEnabled, lastError}` |

### Print

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/print` | `{partId, recordId?}` or `{partIds: []}` | Print label(s) |
| GET | `/api/print` | `?test=1` | Test print to confirm printer reachability |
| POST | `/api/print/calibrate` | — | Calibrate printer gap sensor |

### Stats

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Dashboard aggregates and 5 recent records |

---

## 9. Scale Integration

### Hardware Requirements

- **Scale** with Modbus RTU output
- **Interface:** RS-485 or RS-232 → USB adapter (e.g. USB-RS485 dongle)
- **Windows:** Shows as `COM7` (or similar) in Device Manager
- **Linux:** Shows as `/dev/ttyUSB0` or `/dev/ttyS0`

### Communication Parameters

The scale service uses the `modbus-serial` library with `connectRTUBuffered`:

| Parameter | Default | Notes |
|---|---|---|
| Port | COM7 | Set via `SCALE_PORT` |
| Baud Rate | 9600 | Set via `SCALE_BAUD_RATE` |
| Slave ID | 1 | Set via `SCALE_SLAVE_ID` |
| Function Code | 4 (Input Registers) | Set `SCALE_FUNCTION=3` for Holding Registers |
| Register | 0 | Set via `SCALE_REGISTER` |
| Format | u16 | `SCALE_REGISTER_FORMAT`: u16/s16/u32be/u32le/s32be/s32le |
| Divisor | 100 | Raw ÷ divisor = kg. E.g. raw=5000 → 50.00 kg |

### Service Lifecycle

The scale service runs as a singleton on `globalThis.scaleService` to survive Next.js HMR reloads:

```
startup
  └─ connect()
       └─ poll loop every SCALE_POLL_MS
            ├─ readOnce() → updates lastReading
            └─ on error → close() → schedule reconnect after SCALE_RECONNECT_MS
```

- Poll loop is non-overlapping: skips the next tick if a read is already in progress.
- Error logs are throttled to once every 30 seconds to avoid log flooding.

### Weight Stability Algorithm

Used by the Live Weighing page to determine when a bag has settled:

```
STABLE_DURATION_MS   = 5000ms
WEIGHT_TOLERANCE_KG  = 0.005 kg
MAX_READING_AGE_MS   = 2000ms

on each reading:
  - add to rolling buffer
  - remove readings older than STABLE_DURATION_MS
  - if any reading is older than MAX_READING_AGE_MS → NOT STABLE (stale data)
  - compute spread = max(readings) - min(readings)
  - if spread ≤ WEIGHT_TOLERANCE_KG AND buffer covers ≥ STABLE_DURATION_MS → STABLE
```

This tracks the full min/max spread rather than consecutive differences, preventing gradual drift from triggering false-stable events.

### Mock Mode

Set `SCALE_MOCK=true` in `.env`. When the physical scale is offline and mock is enabled:
- `getCurrentReading()` returns a random 0–100 kg value with `source: "mock"`
- Mock readings are displayed on the Live Weighing page with a "MOCK" indicator
- **Mock readings never trigger auto-save or auto-print** — this prevents phantom records during development

---

## 10. Utility Modules

### `src/utils/printer.ts`

| Export | Description |
|---|---|
| `tscPrinterClient.send(ip, port, tspl)` | Opens raw TCP socket, writes TSPL as ASCII, closes. 5s timeout. |
| `generateGunnyBagTSPL(data)` | Builds complete 100×50mm TSPL label string for master-list labels |
| `getPrinter()` | Returns `{ip, port}` from env with defaults |

### `src/utils/label.ts`

| Export | Description |
|---|---|
| `LABEL` | Constants: width=800, height=400, textX=280, textFont="2", borderLeft=26, borderRight=774 |
| `cleanLabelText(value)` | Strips non-ASCII/control chars, replaces `"` → `'` for TSPL safety |
| `buildLabel(data)` | Generates QR `BAR` squares + text rows array for 100×50mm label |

### `src/utils/pdf.ts`

| Export | Description |
|---|---|
| `writeLabelPDF(payload)` | A6 landscape PDF label with QR code, border, data column, colour status pill |
| `writeRecordPDF(payload)` | A4 full record PDF with navy header, status banner, two-column layout, QR |

### `src/utils/weightStability.ts`

| Export | Description |
|---|---|
| `WeightStability` | Class: tracks min/max spread over rolling 5s window. `update(weight)` → `isStable: boolean` |

---

## 11. Deployment & Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (default port 5432)
- TSC thermal label printer on the local network (Ethernet)
- Modbus RTU weighing scale connected via USB-serial adapter

### First-Time Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd Gunny_bag_weighing

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your DATABASE_URL, PRINTER_IP, SCALE_PORT, etc.

# 4. Start the development server
npm run dev
# Database tables are auto-created on first startup
```

### Production Build

```bash
npm run build
npm start
```

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev` | Development server with HMR |
| `build` | `next build` | Production build |
| `start` | `next start` | Run production build |
| `lint` | `eslint .` | Run ESLint |
| `typecheck` | `tsc --noEmit` | TypeScript type check |

### Printer Setup

1. Connect the TSC printer to the local network via Ethernet.
2. Set `PRINTER_IP` in `.env` to match the printer's IP address.
3. Verify connectivity: open `http://localhost:3000/api/print?test=1` — should return `{success: true}` and print a test label.
4. If the printer feeds blank labels after a paper roll change, use the **Calibrate Printer** button on the Master List page.

### Scale Setup

1. Connect the scale to the PC via USB-RS485 adapter.
2. Identify the COM port in Windows Device Manager (e.g. `COM7`).
3. Set `SCALE_PORT=COM7` (or appropriate port) in `.env`.
4. Confirm Modbus parameters with the scale manufacturer (slave ID, function code, register, divisor).
5. Set `SCALE_MOCK=false` in production.
6. The scale status is visible on the Live Weighing page's status bar.

---

## 12. Known Constraints & Notes

| # | Note |
|---|---|
| 1 | **Windows only for scale:** `modbus-serial` with `connectRTUBuffered` targets Windows COM ports. On Linux, change `SCALE_PORT` to `/dev/ttyUSB0`. |
| 2 | **History limit:** `/api/history` returns at most 500 records per query. For full export use the CSV export feature. |
| 3 | **QR code on thermal label:** Encodes only the part number. If the part number is too long (QR matrix too large for the label), label generation throws an error. Keep part numbers short (< 20 characters). |
| 4 | **Auto-print rearm:** After an auto-print, the Live Weighing page waits for the weight to drop to ≤ 0.005 kg before arming again. The operator must remove the bag from the scale to trigger the next auto-print cycle. |
| 5 | **Printer TCP timeout:** 5 seconds. If the printer is unreachable, print calls return a 500 error with a "Printer unreachable" message. |
| 6 | **Database connection:** Uses a `pg.Pool` stored on `globalThis` to survive Next.js HMR. In production, a single pool is created at startup. |
| 7 | **All timestamps in UTC:** Stored as `TIMESTAMP WITH TIME ZONE`. All API responses and UI display in IST (Asia/Kolkata, UTC+5:30). |
| 8 | **Label PDF vs thermal label:** The PDF label (`/api/parts/[id]/label-pdf`) is for digital download/archiving. The thermal label (`POST /api/print`) is sent to the physical TSC printer. Both contain the same data but differ in format and output medium. |

---

*Documentation generated: September 2026 — United Rubber Industries, Unit 1*
