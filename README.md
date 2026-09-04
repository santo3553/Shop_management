# 📱 Biplob Shop - Mobile Retail & Accessories POS System

A fast, lightweight, local-first inventory management and Point-of-Sale (POS) web application designed specifically for mobile phone retail and accessories shops. Built with Node.js, Express, SQLite, and responsive Tailwind styling.

---

## ⚡ Quick Start

### Windows
Double-click `start.bat`.
- Automatically checks for Node.js.
- Installs dependencies on first run.
- Starts the local server and opens `http://localhost:3000` in your default browser.

### macOS & Linux
Double-click `start.command` (or run `./start.command` in Terminal).
> *Tip: If macOS blocks execution on first run, open Terminal in this folder and run `chmod +x start.command`.*

### Manual Terminal Start
```bash
npm install --no-optional
npm start
```

---

## 🌐 Local Network / Multi-Device Access (Wi-Fi)
The server binds to `0.0.0.0:3000`, making it immediately accessible to all devices connected to the shop's local Wi-Fi or router.

When the server starts, it prints your local network IP:
```text
================================================================
  📱 BIPLOB SHOP - MOBILE RETAIL & ACCESSORIES POS SYSTEM
================================================================
  🚀 Server listening on all interfaces (0.0.0.0:3000)

  👉 Localhost:    http://localhost:3000
  👉 Network:      http://192.168.0.103:3000
================================================================
```
Cashiers and staff can open `http://192.168.0.103:3000` (your IP) on **iPads, Android tablets, iPhones, MacBooks, or secondary Windows PCs** to scan barcodes, view stock, or manage checkout simultaneously!

---

## 🛠 Key Features

### 1. Zero-Config First Run
- Automatically creates `shop_inventory.db` on first boot.
- Applies schema with WAL mode enabled for rapid concurrency.
- Pre-seeds essential retail categories:
  - Cases
  - Screen Protectors
  - Chargers & Cables
  - Used Phones
  - Repairs
  - Audio & Earphones
  - Power Banks

### 2. Dual-Track Inventory Management
- **Accessories & General Stock**:
  - SKU / Barcode tracking with auto-generated contextual SKUs.
  - Optional rack / shelf location tracking (e.g. `R-01`, `S-03`).
  - Cost price, selling price, real-time stock counts.
  - Visual low-stock alert badges when stock reaches the alert limit.
  - Quick `+` / `-` stock adjuster buttons.
- **Smartphones & Handsets (IMEI Tracking)**:
  - **Brand New (Sealed)**: Tracks official brand warranties (Official 1-Year Brand Warranty, International, etc.), intact seal status, and 100% battery health.
  - **Pre-Owned / Used**: Tracks cosmetic grading (Grade A / B / C), tested battery health %, and shop service warranty.
  - Strict unique 15-digit IMEI number validation (prevents duplicate intake).
  - Status lifecycle (`In-Stock` ➡️ `Sold` ➡️ `Returned`).

### 3. Smartphone EMI & In-House Installments System
- **Bank Card 0% EMI (POS Terminal)**:
  - Supports partner banks (City Bank Amex, BRAC Bank, Eastern Bank EBL, Dutch-Bangla DBBL, Standard Chartered, and others).
  - Flexible tenures (3, 6, 9, 12, 18, 24, 36 months).
  - Records card last 4 digits; automatically calculates monthly payment and marks sale as settled by bank.
- **Shop In-House Installments**:
  - Custom down payment with smart 30% calculation at checkout (via Cash, bKash, or Card).
  - Flexible monthly tenure (2, 3, 4, 6, 9, 12 months).
  - Customer National ID (NID) and mobile phone verification.
  - Optional guarantor / reference contact recording.
  - Live preview of remaining due and monthly installment amount.
- **Installment Collection Workflow (`💰 Collect`)**:
  - Filter active installment debts in the Invoices tab with 1-click.
  - Quick collection modal with past payment history and automatic installment suggestion.
  - Generates official **Installment Money Receipt Slips** (80mm thermal format).
  - Automatically marks status as `Completed` (`✅ Fully Paid`) when the balance reaches zero.

### 4. High-Speed POS & Barcode Scanner
- Dedicated scanner input with **Enter-to-Add** functionality for USB/Bluetooth 1D & 2D barcode scanners.
- Supports instant search by:
  - Accessory barcode / SKU
  - Handset IMEI number
  - Product title or model
- Live cart with customer name and phone logging (essential for warranties).
- Payment method selector: Cash, Card, Mobile Banking (bKash/Nagad/Rocket), Mixed, and EMI.
- Single-click checkout with instant stock decrement and phone status update.

### 5. Dual Thermal Receipt Printing (80mm & Standard)
- Printable receipt preview with store name, invoice number, customer contact, and cashier details.
- **Serialized IMEI Guarantee**: Phone IMEI numbers are explicitly printed on the receipt for legal compliance and warranty verification.
- **EMI & Installment Breakdown**: Prints financing terms, customer NID, down payment, remaining due, and signature agreement lines.
- **Installment Collection Slips**: Standalone money receipts upon installment collection.
- Clean `@media print` rules formatted for standard 80mm thermal receipt printers.

### 6. Financial Reports & Analytics
- Monthly KPI Cards: Total Revenue, Total Cost of Goods Sold (COGS), Net Gross Profit, and Profit Margin %.
- Top-Selling Accessories ranking by units sold and revenue.
- Handset Turnaround Stats (total in-stock value vs sold turnover).
- **1-Click CSV Exports**:
  - Full Sales Ledger CSV export.
  - Complete Inventory Valuation CSV export.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **F2** | Switch to POS Checkout & focus Barcode Scanner |
| **F3** | Switch to Inventory Manager |
| **F4** | Switch to Financial Reports & Analytics |
| **Ctrl + Enter** | Quick Complete Sale & Print Receipt |
| **Esc** | Close any open modal / receipt preview |

---

## 📂 Project Structure

```
Biplob Shop/
├── db.js             # SQLite3 schema, seed engine & transactional checkout
├── server.js         # Express server, LAN IP discovery & REST endpoints
├── package.json      # Dependencies and startup scripts
├── start.bat         # Windows one-click launcher
├── start.command     # macOS/Linux launcher
├── shop_inventory.db # Local SQLite database (WAL mode)
└── public/
    ├── index.html    # Single-page application interface
    ├── styles.css    # Thermal receipt print styles & responsive rules
    └── app.js        # POS state, cart engine, scanner, and reports
```
