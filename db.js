const fs = require('fs');
const path = require('path');

// Universal SQLite Loader: Prefers better-sqlite3 if compiled; falls back smoothly to Node.js native DatabaseSync
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  const { DatabaseSync } = require('node:sqlite');
  Database = class NodeSqliteAdapter {
    constructor(filePath, options = {}) {
      this._db = new DatabaseSync(filePath, options);
    }
    exec(sql) {
      return this._db.exec(sql);
    }
    prepare(sql) {
      const stmt = this._db.prepare(sql);
      return {
        run: (...params) => {
          const res = stmt.run(...params);
          return {
            changes: Number(res.changes),
            lastInsertRowid: Number(res.lastInsertRowid)
          };
        },
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params)
      };
    }
    pragma(sql) {
      return this._db.exec(`PRAGMA ${sql};`);
    }
    transaction(fn) {
      return (...args) => {
        const isNested = !!this._inTransaction;
        const spName = 'sp_' + (++this._spCount || (this._spCount = 1));
        if (!isNested) {
          this._inTransaction = true;
          this._db.exec('BEGIN IMMEDIATE');
        } else {
          this._db.exec(`SAVEPOINT ${spName}`);
        }
        try {
          const result = fn(...args);
          if (!isNested) {
            this._db.exec('COMMIT');
            this._inTransaction = false;
          } else {
            this._db.exec(`RELEASE ${spName}`);
          }
          return result;
        } catch (err) {
          if (!isNested) {
            try {
              this._db.exec('ROLLBACK');
            } catch (_) {}
            this._inTransaction = false;
          } else {
            try {
              this._db.exec(`ROLLBACK TO ${spName}; RELEASE ${spName};`);
            } catch (_) {}
          }
          throw err;
        }
      };
    }
    close() {
      return this._db.close();
    }
  };
}

const DB_PATH = path.join(__dirname, 'shop_inventory.db');
const isFirstRun = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);

// Enable WAL mode for high read/write concurrency and Foreign Keys
try {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.warn('Note on SQLite pragmas:', err.message);
}

/**
 * Initialize Database Tables
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku_or_barcode TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      cost_price REAL NOT NULL DEFAULT 0.00,
      selling_price REAL NOT NULL DEFAULT 0.00,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      min_alert_threshold INTEGER NOT NULL DEFAULT 5,
      rack_location TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS phones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imei_number TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      storage_capacity TEXT NOT NULL,
      color TEXT DEFAULT 'Standard',
      condition_grade TEXT NOT NULL DEFAULT 'Brand New (Sealed)',
      battery_health INTEGER DEFAULT 100,
      warranty_type TEXT DEFAULT 'Official 1-Year',
      purchase_cost REAL NOT NULL DEFAULT 0.00,
      selling_price REAL NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'In-Stock' CHECK(status IN ('In-Stock', 'Sold', 'Returned')),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sold_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_name TEXT DEFAULT 'Walk-in Customer',
      customer_phone TEXT DEFAULT '',
      payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Card', 'Mobile Banking', 'Mixed', 'EMI')),
      subtotal REAL NOT NULL DEFAULT 0.00,
      discount REAL NOT NULL DEFAULT 0.00,
      total_amount REAL NOT NULL DEFAULT 0.00,
      total_cost REAL NOT NULL DEFAULT 0.00,
      profit_margin REAL NOT NULL DEFAULT 0.00,
      notes TEXT DEFAULT '',
      is_emi INTEGER DEFAULT 0,
      emi_type TEXT DEFAULT '',
      emi_bank_name TEXT DEFAULT '',
      emi_card_last4 TEXT DEFAULT '',
      emi_tenure_months INTEGER DEFAULT 0,
      emi_down_payment REAL DEFAULT 0.00,
      emi_monthly_amount REAL DEFAULT 0.00,
      emi_remaining_due REAL DEFAULT 0.00,
      customer_nid TEXT DEFAULT '',
      guarantor_info TEXT DEFAULT '',
      emi_status TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emi_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      amount_paid REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      remaining_balance REAL NOT NULL,
      notes TEXT DEFAULT '',
      collected_by TEXT DEFAULT 'Shop Admin'
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK(item_type IN ('accessory', 'phone', 'service')),
      item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      phone_id INTEGER REFERENCES phones(id) ON DELETE SET NULL,
      sku_or_imei TEXT NOT NULL,
      title TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL DEFAULT 0.00,
      unit_price REAL NOT NULL DEFAULT 0.00,
      total_price REAL NOT NULL DEFAULT 0.00
    );

    CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku_or_barcode);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
    CREATE INDEX IF NOT EXISTS idx_phones_imei ON phones(imei_number);
    CREATE INDEX IF NOT EXISTS idx_phones_status ON phones(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_emi_payments_order ON emi_payments(order_id);
  `);
}

/**
 * Seed initial categories & sample catalog if new database
 */
function seedInitialData() {
  const defaultCategories = [
    'Cases',
    'Screen Protectors',
    'Chargers & Cables',
    'Used Phones',
    'Repairs',
    'Audio & Earphones',
    'Power Banks'
  ];

  const insertCategory = db.prepare(`INSERT OR IGNORE INTO categories (name) VALUES (?)`);
  for (const cat of defaultCategories) {
    insertCategory.run(cat);
  }

  // Check if we need sample starter stock
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM items').get().count;
  if (itemCount === 0) {
    const catMap = {};
    db.prepare('SELECT id, name FROM categories').all().forEach(c => {
      catMap[c.name] = c.id;
    });

    const sampleAccessories = [
      { sku: 'CS-IP15-CLR', title: 'iPhone 15 Clear MagSafe Case', cat: 'Cases', cost: 350, price: 850, stock: 24, min: 5 },
      { sku: 'CS-S24-SIL', title: 'Galaxy S24 Matte Silicone Case', cat: 'Cases', cost: 280, price: 650, stock: 15, min: 4 },
      { sku: 'SP-IP15-PRM', title: 'iPhone 15 Pro 9H Privacy Glass', cat: 'Screen Protectors', cost: 120, price: 450, stock: 4, min: 10 }, // low stock trigger
      { sku: 'SP-A54-CLR', title: 'Galaxy A54 Full Cover Tempered Glass', cat: 'Screen Protectors', cost: 80, price: 250, stock: 35, min: 8 },
      { sku: 'CB-20W-TYPC', title: 'Apple 20W Type-C Fast Charger & Cable', cat: 'Chargers & Cables', cost: 650, price: 1500, stock: 18, min: 6 },
      { sku: 'CB-AN-BRAID', title: 'Anker PowerLine III USB-C to Lightning 1m', cat: 'Chargers & Cables', cost: 500, price: 1100, stock: 12, min: 4 },
      { sku: 'CB-65W-GAN', title: 'Baseus 65W GaN Dual Port Fast Adapter', cat: 'Chargers & Cables', cost: 1100, price: 2200, stock: 3, min: 5 }, // low stock trigger
      { sku: 'AD-AP-PRO2', title: 'Apple AirPods Pro 2 (Lightning)', cat: 'Audio & Earphones', cost: 18500, price: 22900, stock: 5, min: 2 },
      { sku: 'PB-MI-20K', title: 'Xiaomi 20,000mAh 18W Fast Power Bank', cat: 'Power Banks', cost: 1400, price: 2400, stock: 9, min: 3 }
    ];

    const insertItem = db.prepare(`
      INSERT INTO items (sku_or_barcode, title, category_id, cost_price, selling_price, stock_quantity, min_alert_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of sampleAccessories) {
      insertItem.run(item.sku, item.title, catMap[item.cat] || null, item.cost, item.price, item.stock, item.min);
    }
  }

  // Seed sample used phones if empty
  const phoneCount = db.prepare('SELECT COUNT(*) as count FROM phones').get().count;
  if (phoneCount === 0) {
    const samplePhones = [
      { imei: '354890102938471', brand: 'Apple', model: 'iPhone 13 Pro', storage: '128GB', color: 'Sierra Blue', grade: 'Grade A', battery: 89, cost: 55000, price: 68000, status: 'In-Stock', notes: 'Original screen, minor frame scuff' },
      { imei: '358721094837261', brand: 'Apple', model: 'iPhone 12', storage: '64GB', color: 'Black', grade: 'Grade B', battery: 84, cost: 32000, price: 41000, status: 'In-Stock', notes: 'FaceID working, battery serviced' },
      { imei: '864920193847562', brand: 'Samsung', model: 'Galaxy S23 Ultra', storage: '256GB', color: 'Phantom Black', grade: 'Grade A', battery: 94, cost: 68000, price: 82000, status: 'In-Stock', notes: 'Complete box with S-Pen' },
      { imei: '861029384712093', brand: 'Google', model: 'Pixel 7', storage: '128GB', color: 'Lemongrass', grade: 'Grade B', battery: 90, cost: 28000, price: 36500, status: 'In-Stock', notes: 'Tiny glass scratch near bottom' }
    ];

    const insertPhone = db.prepare(`
      INSERT INTO phones (imei_number, brand, model, storage_capacity, color, condition_grade, battery_health, purchase_cost, selling_price, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of samplePhones) {
      insertPhone.run(p.imei, p.brand, p.model, p.storage, p.color, p.grade, p.battery, p.cost, p.price, p.status, p.notes);
    }
  }
}

// Run schema and seed
initSchema();

// Safe migrations for existing databases
try {
  db.exec("ALTER TABLE items ADD COLUMN rack_location TEXT DEFAULT ''");
} catch (_) {}

try {
  db.exec("ALTER TABLE phones ADD COLUMN warranty_type TEXT DEFAULT 'Official 1-Year'");
} catch (_) {}

// Migrate orders table for EMI payment method check constraint if needed
try {
  const ordersMaster = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get();
  if (ordersMaster && ordersMaster.sql && !ordersMaster.sql.includes("'EMI'")) {
    try {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE orders_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT UNIQUE NOT NULL,
          customer_name TEXT DEFAULT 'Walk-in Customer',
          customer_phone TEXT DEFAULT '',
          payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Card', 'Mobile Banking', 'Mixed', 'EMI')),
          subtotal REAL NOT NULL DEFAULT 0.00,
          discount REAL NOT NULL DEFAULT 0.00,
          total_amount REAL NOT NULL DEFAULT 0.00,
          total_cost REAL NOT NULL DEFAULT 0.00,
          profit_margin REAL NOT NULL DEFAULT 0.00,
          notes TEXT DEFAULT '',
          is_emi INTEGER DEFAULT 0,
          emi_type TEXT DEFAULT '',
          emi_bank_name TEXT DEFAULT '',
          emi_card_last4 TEXT DEFAULT '',
          emi_tenure_months INTEGER DEFAULT 0,
          emi_down_payment REAL DEFAULT 0.00,
          emi_monthly_amount REAL DEFAULT 0.00,
          emi_remaining_due REAL DEFAULT 0.00,
          customer_nid TEXT DEFAULT '',
          guarantor_info TEXT DEFAULT '',
          emi_status TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO orders_migrated (id, invoice_number, customer_name, customer_phone, payment_method, subtotal, discount, total_amount, total_cost, profit_margin, notes, created_at)
        SELECT id, invoice_number, customer_name, customer_phone, payment_method, subtotal, discount, total_amount, total_cost, profit_margin, notes, created_at
        FROM orders;

        DROP TABLE orders;
        ALTER TABLE orders_migrated RENAME TO orders;
        CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
        PRAGMA foreign_keys = ON;
      `);
    } catch (_) {}
  }
} catch (_) {}

// Ensure EMI columns exist on orders table
try {
  const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  const emiCols = [
    { name: 'is_emi', type: 'INTEGER DEFAULT 0' },
    { name: 'emi_type', type: "TEXT DEFAULT ''" },
    { name: 'emi_bank_name', type: "TEXT DEFAULT ''" },
    { name: 'emi_card_last4', type: "TEXT DEFAULT ''" },
    { name: 'emi_tenure_months', type: 'INTEGER DEFAULT 0' },
    { name: 'emi_down_payment', type: 'REAL DEFAULT 0.00' },
    { name: 'emi_monthly_amount', type: 'REAL DEFAULT 0.00' },
    { name: 'emi_remaining_due', type: 'REAL DEFAULT 0.00' },
    { name: 'customer_nid', type: "TEXT DEFAULT ''" },
    { name: 'guarantor_info', type: "TEXT DEFAULT ''" },
    { name: 'emi_status', type: "TEXT DEFAULT ''" }
  ];
  for (const col of emiCols) {
    if (!orderCols.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`);
      } catch (_) {}
    }
  }
} catch (_) {}

// Ensure emi_payments table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS emi_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      amount_paid REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      remaining_balance REAL NOT NULL,
      notes TEXT DEFAULT '',
      collected_by TEXT DEFAULT 'Shop Admin'
    );
    CREATE INDEX IF NOT EXISTS idx_emi_payments_order ON emi_payments(order_id);
  `);
} catch (_) {}

if (isFirstRun) {
  seedInitialData();
  console.log('Zero-config initialization complete: Created shop_inventory.db with schema and initial catalog.');
}

/**
 * Execute complete POS order within an immediate database transaction.
 * Updates accessory stock quantities and marks serialized phones as 'Sold'.
 */
const processCheckoutTransaction = db.transaction((orderData) => {
  const {
    customer_name = 'Walk-in Customer',
    customer_phone = '',
    payment_method = 'Cash',
    discount = 0,
    items = [],
    notes = '',
    is_emi = 0,
    emi_type = '',
    emi_bank_name = '',
    emi_card_last4 = '',
    emi_tenure_months = 0,
    emi_down_payment = 0,
    emi_monthly_amount = 0,
    customer_nid = '',
    guarantor_info = ''
  } = orderData;

  if (!items || items.length === 0) {
    throw new Error('Cannot checkout an empty cart.');
  }

  // Generate unique invoice number: INV-YYYYMMDD-XXXXX
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const invoice_number = `INV-${dateStr}-${randomSuffix}`;

  let calculatedSubtotal = 0;
  let calculatedTotalCost = 0;
  const processedItems = [];

  // Validate items and calculate accurate prices & costs from DB snapshot
  for (const cartItem of items) {
    if (cartItem.item_type === 'accessory') {
      const targetId = cartItem.id || cartItem.item_id;
      const dbItem = db.prepare('SELECT * FROM items WHERE id = ?').get(targetId);
      if (!dbItem) {
        throw new Error(`Item with ID ${targetId} not found.`);
      }
      const qty = parseInt(cartItem.quantity, 10) || 1;
      if (dbItem.stock_quantity < qty) {
        throw new Error(`Insufficient stock for "${dbItem.title}". In stock: ${dbItem.stock_quantity}, requested: ${qty}`);
      }

      const unit_price = cartItem.unit_price !== undefined ? parseFloat(cartItem.unit_price) : dbItem.selling_price;
      const unit_cost = dbItem.cost_price;
      const total_price = unit_price * qty;
      const total_cost = unit_cost * qty;

      calculatedSubtotal += total_price;
      calculatedTotalCost += total_cost;

      processedItems.push({
        item_type: 'accessory',
        item_id: dbItem.id,
        phone_id: null,
        sku_or_imei: dbItem.sku_or_barcode,
        title: dbItem.title,
        quantity: qty,
        unit_cost,
        unit_price,
        total_price
      });
    } else if (cartItem.item_type === 'phone') {
      const targetId = cartItem.id || cartItem.phone_id;
      const dbPhone = db.prepare('SELECT * FROM phones WHERE id = ?').get(targetId);
      if (!dbPhone) {
        throw new Error(`Handset with ID ${targetId} not found.`);
      }
      if (dbPhone.status !== 'In-Stock') {
        throw new Error(`Handset "${dbPhone.brand} ${dbPhone.model}" (IMEI: ${dbPhone.imei_number}) is not available (Status: ${dbPhone.status}).`);
      }

      const unit_price = cartItem.unit_price !== undefined ? parseFloat(cartItem.unit_price) : dbPhone.selling_price;
      const unit_cost = dbPhone.purchase_cost;
      const total_price = unit_price;
      const total_cost = unit_cost;

      calculatedSubtotal += total_price;
      calculatedTotalCost += total_cost;

      const warrantySuffix = dbPhone.warranty_type ? ` - ${dbPhone.warranty_type}` : '';
      const phoneTitle = `${dbPhone.brand} ${dbPhone.model} (${dbPhone.storage_capacity}, ${dbPhone.condition_grade}${warrantySuffix})`;

      processedItems.push({
        item_type: 'phone',
        item_id: null,
        phone_id: dbPhone.id,
        sku_or_imei: dbPhone.imei_number,
        title: phoneTitle,
        quantity: 1,
        unit_cost,
        unit_price,
        total_price
      });
    } else if (cartItem.item_type === 'service') {
      const unit_price = parseFloat(cartItem.unit_price) || 0;
      const unit_cost = parseFloat(cartItem.unit_cost) || 0;
      const qty = parseInt(cartItem.quantity, 10) || 1;
      const total_price = unit_price * qty;
      const total_cost = unit_cost * qty;

      calculatedSubtotal += total_price;
      calculatedTotalCost += total_cost;

      processedItems.push({
        item_type: 'service',
        item_id: null,
        phone_id: null,
        sku_or_imei: cartItem.sku_or_imei || 'SERVICE',
        title: cartItem.title || 'Repair / Service Charge',
        quantity: qty,
        unit_cost,
        unit_price,
        total_price
      });
    }
  }

  const numDiscount = Math.max(0, parseFloat(discount) || 0);
  const total_amount = Math.max(0, calculatedSubtotal - numDiscount);
  const profit_margin = total_amount - calculatedTotalCost;

  let calcEmiRemainingDue = 0;
  let calcEmiStatus = '';
  const numDownPayment = Math.max(0, parseFloat(emi_down_payment) || 0);

  if (is_emi) {
    if (emi_type === 'Bank EMI') {
      calcEmiRemainingDue = 0;
      calcEmiStatus = 'Completed';
    } else {
      // Shop In-House Installment
      calcEmiRemainingDue = Math.max(0, total_amount - numDownPayment);
      calcEmiStatus = calcEmiRemainingDue <= 0 ? 'Completed' : 'Active';
    }
  }

  // 1. Insert order
  const orderStmt = db.prepare(`
    INSERT INTO orders (
      invoice_number, customer_name, customer_phone, payment_method, subtotal, discount, total_amount, total_cost, profit_margin, notes,
      is_emi, emi_type, emi_bank_name, emi_card_last4, emi_tenure_months, emi_down_payment, emi_monthly_amount, emi_remaining_due, customer_nid, guarantor_info, emi_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const orderRes = orderStmt.run(
    invoice_number,
    customer_name,
    customer_phone,
    payment_method,
    calculatedSubtotal,
    numDiscount,
    total_amount,
    calculatedTotalCost,
    profit_margin,
    notes,
    is_emi ? 1 : 0,
    emi_type || '',
    emi_bank_name || '',
    emi_card_last4 || '',
    parseInt(emi_tenure_months, 10) || 0,
    numDownPayment,
    parseFloat(emi_monthly_amount) || 0,
    calcEmiRemainingDue,
    customer_nid || '',
    guarantor_info || '',
    calcEmiStatus
  );

  const orderId = orderRes.lastInsertRowid;

  // Record initial down payment in emi_payments if Shop Installment
  if (is_emi && emi_type !== 'Bank EMI' && numDownPayment > 0) {
    try {
      db.prepare(`
        INSERT INTO emi_payments (order_id, invoice_number, amount_paid, payment_method, remaining_balance, notes, collected_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        invoice_number,
        numDownPayment,
        payment_method === 'EMI' ? 'Cash (Down Payment)' : payment_method,
        calcEmiRemainingDue,
        'Initial Down Payment at Sale',
        'Shop Admin'
      );
    } catch (_) {}
  }

  // 2. Insert order items & adjust inventory
  const orderItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, item_type, item_id, phone_id, sku_or_imei, title, quantity, unit_cost, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const decrementStockStmt = db.prepare(`
    UPDATE items
    SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const markPhoneSoldStmt = db.prepare(`
    UPDATE phones
    SET status = 'Sold', sold_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  for (const item of processedItems) {
    orderItemStmt.run(
      orderId,
      item.item_type,
      item.item_id,
      item.phone_id,
      item.sku_or_imei,
      item.title,
      item.quantity,
      item.unit_cost,
      item.unit_price,
      item.total_price
    );

    if (item.item_type === 'accessory' && item.item_id) {
      decrementStockStmt.run(item.quantity, item.item_id);
    } else if (item.item_type === 'phone' && item.phone_id) {
      markPhoneSoldStmt.run(item.phone_id);
    }
  }

  return {
    order_id: orderId,
    invoice_number,
    customer_name,
    customer_phone,
    payment_method,
    subtotal: calculatedSubtotal,
    discount: numDiscount,
    total_amount,
    total_cost: calculatedTotalCost,
    profit_margin,
    is_emi: is_emi ? 1 : 0,
    emi_type,
    emi_bank_name,
    emi_card_last4,
    emi_tenure_months: parseInt(emi_tenure_months, 10) || 0,
    emi_down_payment: numDownPayment,
    emi_monthly_amount: parseFloat(emi_monthly_amount) || 0,
    emi_remaining_due: calcEmiRemainingDue,
    customer_nid,
    guarantor_info,
    emi_status: calcEmiStatus,
    items: processedItems,
    created_at: new Date().toISOString()
  };
});

/**
 * Record an installment collection payment for an active EMI order
 */
const recordEmiPayment = db.transaction((paymentData) => {
  const { order_id, payment_method = 'Cash', collected_by = 'Shop Admin' } = paymentData;
  const rawAmount = paymentData.amount_paid !== undefined ? paymentData.amount_paid : paymentData.amount;
  const notes = paymentData.notes !== undefined ? paymentData.notes : (paymentData.note || '');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) throw new Error('Order not found');
  if (!order.is_emi) throw new Error('This invoice is not an installment/EMI sale');

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Please enter a valid installment payment amount');
  }

  const newDue = Math.max(0, order.emi_remaining_due - amount);
  const newStatus = newDue <= 0 ? 'Completed' : 'Active';

  db.prepare(`
    UPDATE orders
    SET emi_remaining_due = ?, emi_status = ?
    WHERE id = ?
  `).run(newDue, newStatus, order_id);

  const paymentRes = db.prepare(`
    INSERT INTO emi_payments (order_id, invoice_number, amount_paid, payment_method, remaining_balance, notes, collected_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(order_id, order.invoice_number, amount, payment_method, newDue, notes || 'Installment Collection', collected_by);

  return {
    payment_id: paymentRes.lastInsertRowid,
    order_id,
    invoice_number: order.invoice_number,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    amount_paid: amount,
    payment_method,
    remaining_balance: newDue,
    emi_status: newStatus,
    payment_date: new Date().toISOString()
  };
});

module.exports = {
  db,
  isFirstRun,
  processCheckoutTransaction,
  recordEmiPayment
};
