const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { db, processCheckoutTransaction, recordEmiPayment } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get local network IPv4 addresses
function getLocalNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  return addresses;
}

/* =========================================================
   CATEGORY ROUTES
========================================================= */
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const result = stmt.run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ACCESSORIES & GENERAL STOCK ROUTES
========================================================= */
app.get('/api/items', (req, res) => {
  try {
    const { search, category_id, low_stock } = req.query;
    let sql = `
      SELECT items.*, categories.name as category_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (items.title LIKE ? OR items.sku_or_barcode LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      sql += ` AND items.category_id = ?`;
      params.push(category_id);
    }

    if (low_stock === '1' || low_stock === 'true') {
      sql += ` AND items.stock_quantity <= items.min_alert_threshold`;
    }

    sql += ` ORDER BY items.title ASC`;

    const items = db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', (req, res) => {
  try {
    const {
      sku_or_barcode,
      title,
      category_id,
      cost_price = 0,
      selling_price = 0,
      stock_quantity = 0,
      min_alert_threshold = 5,
      rack_location = '',
      image = ''
    } = req.body;

    if (!sku_or_barcode || !sku_or_barcode.trim()) {
      return res.status(400).json({ error: 'SKU or Barcode is required.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Item title is required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO items (sku_or_barcode, title, category_id, cost_price, selling_price, stock_quantity, min_alert_threshold, rack_location, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      sku_or_barcode.trim(),
      title.trim(),
      category_id || null,
      parseFloat(cost_price) || 0,
      parseFloat(selling_price) || 0,
      parseInt(stock_quantity, 10) || 0,
      parseInt(min_alert_threshold, 10) || 5,
      (rack_location || '').trim(),
      image || ''
    );

    const newItem = db.prepare(`
      SELECT items.*, categories.name as category_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      WHERE items.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newItem);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'An item with this SKU/Barcode already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', (req, res) => {
  try {
    const id = req.params.id;
    const {
      sku_or_barcode,
      title,
      category_id,
      cost_price,
      selling_price,
      stock_quantity,
      min_alert_threshold,
      rack_location = '',
      image = ''
    } = req.body;

    const stmt = db.prepare(`
      UPDATE items
      SET sku_or_barcode = ?, title = ?, category_id = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, min_alert_threshold = ?, rack_location = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(
      sku_or_barcode.trim(),
      title.trim(),
      category_id || null,
      parseFloat(cost_price) || 0,
      parseFloat(selling_price) || 0,
      parseInt(stock_quantity, 10) || 0,
      parseInt(min_alert_threshold, 10) || 5,
      (rack_location || '').trim(),
      image || '',
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const updated = db.prepare(`
      SELECT items.*, categories.name as category_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      WHERE items.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU/Barcode already in use by another item.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items/:id/adjust-stock', (req, res) => {
  try {
    const id = req.params.id;
    const { delta } = req.body;
    const change = parseInt(delta, 10);
    if (isNaN(change)) {
      return res.status(400).json({ error: 'Valid delta number required.' });
    }

    const stmt = db.prepare(`
      UPDATE items
      SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(change, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', (req, res) => {
  try {
    const id = req.params.id;
    const stmt = db.prepare('DELETE FROM items WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    res.json({ success: true, message: 'Item deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   USED PHONES & IMEI TRACKING ROUTES
========================================================= */
app.get('/api/phones', (req, res) => {
  try {
    const { status, search, brand, grade } = req.query;
    let sql = 'SELECT * FROM phones WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (brand) {
      sql += ' AND brand = ?';
      params.push(brand);
    }
    if (grade) {
      sql += ' AND condition_grade = ?';
      params.push(grade);
    }
    if (search) {
      sql += ' AND (imei_number LIKE ? OR model LIKE ? OR brand LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const phones = db.prepare(sql).all(...params);
    res.json(phones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/phones/check-imei/:imei', (req, res) => {
  try {
    const imei = req.params.imei.trim();
    const existing = db.prepare('SELECT id, brand, model, status FROM phones WHERE imei_number = ?').get(imei);
    res.json({ exists: !!existing, phone: existing || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/phones', (req, res) => {
  try {
    const {
      imei_number,
      brand,
      model,
      storage_capacity,
      color = 'Standard',
      condition_grade = 'Brand New (Sealed)',
      battery_health = 100,
      warranty_type = 'Official 1-Year',
      purchase_cost = 0,
      selling_price = 0,
      status = 'In-Stock',
      notes = '',
      image = ''
    } = req.body;

    if (!imei_number || !imei_number.trim()) {
      return res.status(400).json({ error: 'IMEI Number is required.' });
    }
    if (!brand || !brand.trim() || !model || !model.trim()) {
      return res.status(400).json({ error: 'Brand and Model are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO phones (imei_number, brand, model, storage_capacity, color, condition_grade, battery_health, warranty_type, purchase_cost, selling_price, status, notes, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      imei_number.trim(),
      brand.trim(),
      model.trim(),
      (storage_capacity || '128GB').trim(),
      color.trim(),
      condition_grade,
      parseInt(battery_health, 10) || 100,
      (warranty_type || 'Official 1-Year').trim(),
      parseFloat(purchase_cost) || 0,
      parseFloat(selling_price) || 0,
      status,
      notes ? notes.trim() : '',
      image || ''
    );

    const newPhone = db.prepare('SELECT * FROM phones WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newPhone);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A handset with this exact IMEI is already registered.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/phones/:id', (req, res) => {
  try {
    const id = req.params.id;
    const {
      imei_number,
      brand,
      model,
      storage_capacity,
      color,
      condition_grade,
      battery_health,
      warranty_type,
      purchase_cost,
      selling_price,
      status,
      notes,
      image = ''
    } = req.body;

    const stmt = db.prepare(`
      UPDATE phones
      SET imei_number = ?, brand = ?, model = ?, storage_capacity = ?, color = ?, condition_grade = ?, battery_health = ?, warranty_type = ?, purchase_cost = ?, selling_price = ?, status = ?, notes = ?, image = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      imei_number.trim(),
      brand.trim(),
      model.trim(),
      storage_capacity.trim(),
      color,
      condition_grade,
      parseInt(battery_health, 10) || 100,
      (warranty_type || 'Official 1-Year').trim(),
      parseFloat(purchase_cost) || 0,
      parseFloat(selling_price) || 0,
      status,
      notes || '',
      image || '',
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Phone not found.' });
    }

    const updated = db.prepare('SELECT * FROM phones WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'IMEI already belongs to another handset.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/phones/:id', (req, res) => {
  try {
    const id = req.params.id;
    const phone = db.prepare('SELECT status FROM phones WHERE id = ?').get(id);
    if (!phone) {
      return res.status(404).json({ error: 'Phone not found.' });
    }
    if (phone.status === 'Sold') {
      return res.status(400).json({ error: 'Cannot delete a sold phone linked to sales history.' });
    }

    db.prepare('DELETE FROM phones WHERE id = ?').run(id);
    res.json({ success: true, message: 'Handset removed from inventory.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   POS UNIFIED SEARCH (Scanner / Barcode / IMEI / Title)
========================================================= */
app.get('/api/pos/search', (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      // Return top available accessories and in-stock phones
      const defaultAccessories = db.prepare(`
        SELECT id, sku_or_barcode as code, title, category_id, 'accessory' as type, selling_price, stock_quantity, cost_price, image
        FROM items
        WHERE stock_quantity > 0
        ORDER BY stock_quantity DESC
        LIMIT 100
      `).all();

      const defaultPhones = db.prepare(`
        SELECT id, imei_number as code, brand || ' ' || model || ' (' || storage_capacity || ')' as title,
               'phone' as type, selling_price, 1 as stock_quantity, purchase_cost as cost_price, condition_grade, battery_health, warranty_type, image
        FROM phones
        WHERE status = 'In-Stock'
        ORDER BY created_at DESC
        LIMIT 50
      `).all();

      return res.json([...defaultAccessories, ...defaultPhones]);
    }

    // 1. Direct barcode / SKU search
    const exactAccessory = db.prepare(`
      SELECT id, sku_or_barcode as code, title, category_id, 'accessory' as type, selling_price, stock_quantity, cost_price, image
      FROM items
      WHERE sku_or_barcode = ?
    `).get(query);

    // 2. Direct IMEI match
    const exactPhone = db.prepare(`
      SELECT id, imei_number as code, brand || ' ' || model || ' (' || storage_capacity || ')' as title,
             'phone' as type, selling_price, 1 as stock_quantity, purchase_cost as cost_price, condition_grade, battery_health, warranty_type, status, image
      FROM phones
      WHERE imei_number = ?
    `).get(query);

    // If exact single scan match:
    if (exactPhone && exactPhone.status === 'In-Stock') {
      return res.json([exactPhone]);
    }
    if (exactAccessory) {
      return res.json([exactAccessory]);
    }

    // Otherwise, broader fuzzy search on both tables
    const pattern = `%${query}%`;

    const accessories = db.prepare(`
      SELECT id, sku_or_barcode as code, title, category_id, 'accessory' as type, selling_price, stock_quantity, cost_price, image
      FROM items
      WHERE title LIKE ? OR sku_or_barcode LIKE ?
      LIMIT 50
    `).all(pattern, pattern);

    const phones = db.prepare(`
      SELECT id, imei_number as code, brand || ' ' || model || ' (' || storage_capacity || ')' as title,
             'phone' as type, selling_price, 1 as stock_quantity, purchase_cost as cost_price, condition_grade, battery_health, warranty_type, image
      FROM phones
      WHERE status = 'In-Stock' AND (imei_number LIKE ? OR brand LIKE ? OR model LIKE ?)
      LIMIT 25
    `).all(pattern, pattern, pattern);

    res.json([...accessories, ...phones]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   SALES & ORDERS CHECKOUT
========================================================= */
app.post('/api/orders', (req, res) => {
  try {
    const completedOrder = processCheckoutTransaction(req.body);
    res.status(201).json(completedOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    const { date_from, date_to, search, is_emi, limit = 50 } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (date_from) {
      sql += ' AND date(created_at) >= date(?)';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND date(created_at) <= date(?)';
      params.push(date_to);
    }
    if (is_emi !== undefined && is_emi !== '') {
      sql += ' AND is_emi = ?';
      params.push(parseInt(is_emi, 10));
    }
    if (search) {
      sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_nid LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const orders = db.prepare(sql).all(...params);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const identifier = req.params.id;
    let order;
    if (isNaN(identifier)) {
      order = db.prepare('SELECT * FROM orders WHERE invoice_number = ?').get(identifier);
    } else {
      order = db.prepare('SELECT * FROM orders WHERE id = ?').get(identifier);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order / Invoice not found.' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    let payments = [];
    if (order.is_emi) {
      payments = db.prepare('SELECT * FROM emi_payments WHERE order_id = ? ORDER BY payment_date ASC').all(order.id);
    }
    res.json({ ...order, items, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   EMI & INSTALLMENTS ROUTES
========================================================= */
app.get('/api/emi/orders', (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM orders WHERE is_emi = 1';
    const params = [];

    if (status) {
      sql += ' AND emi_status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_nid LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const orders = db.prepare(sql).all(...params);

    const getPayments = db.prepare('SELECT * FROM emi_payments WHERE order_id = ? ORDER BY payment_date ASC');
    const enriched = orders.map(o => ({
      ...o,
      payments: getPayments.all(o.id)
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/emi/collect', (req, res) => {
  try {
    const result = recordEmiPayment(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/emi/orders/:id/payments', (req, res) => {
  try {
    const payments = db.prepare('SELECT * FROM emi_payments WHERE order_id = ? ORDER BY payment_date ASC').all(req.params.id);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   REPORTS & ANALYTICS
========================================================= */
app.get('/api/reports/summary', (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const filterYear = year ? parseInt(year, 10) : now.getFullYear();
    const filterMonth = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${filterYear}-${filterMonth}`;

    // Monthly orders summary
    const monthlyStats = db.prepare(`
      SELECT 
        COUNT(id) as total_orders,
        COALESCE(SUM(subtotal), 0) as subtotal,
        COALESCE(SUM(discount), 0) as discount,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(total_cost), 0) as total_cogs,
        COALESCE(SUM(profit_margin), 0) as gross_profit
      FROM orders
      WHERE strftime('%Y-%m', created_at) = ?
    `).get(monthPrefix);

    const profitMarginPct = monthlyStats.total_revenue > 0
      ? ((monthlyStats.gross_profit / monthlyStats.total_revenue) * 100).toFixed(1)
      : 0;

    // Items sold in that month
    const itemsCount = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total_items
      FROM order_items
      WHERE order_id IN (SELECT id FROM orders WHERE strftime('%Y-%m', created_at) = ?)
    `).get(monthPrefix).total_items;

    // Top selling accessories this month (or overall if zero in month)
    let topAccessories = db.prepare(`
      SELECT title, sku_or_imei, SUM(quantity) as units_sold, SUM(total_price) as revenue
      FROM order_items
      WHERE item_type = 'accessory' 
        AND order_id IN (SELECT id FROM orders WHERE strftime('%Y-%m', created_at) = ?)
      GROUP BY title, sku_or_imei
      ORDER BY units_sold DESC
      LIMIT 5
    `).all(monthPrefix);

    if (topAccessories.length === 0) {
      topAccessories = db.prepare(`
        SELECT title, sku_or_imei, SUM(quantity) as units_sold, SUM(total_price) as revenue
        FROM order_items
        WHERE item_type = 'accessory'
        GROUP BY title, sku_or_imei
        ORDER BY units_sold DESC
        LIMIT 5
      `).all();
    }

    // Handset Stats
    const handsetStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'In-Stock' THEN 1 END) as in_stock_count,
        COUNT(CASE WHEN status = 'Sold' THEN 1 END) as sold_count,
        COALESCE(SUM(CASE WHEN status = 'In-Stock' THEN purchase_cost ELSE 0 END), 0) as in_stock_cost_value,
        COALESCE(SUM(CASE WHEN status = 'In-Stock' THEN selling_price ELSE 0 END), 0) as in_stock_retail_value
      FROM phones
    `).get();

    // Accessories current stock valuation
    const stockValuation = db.prepare(`
      SELECT
        COALESCE(SUM(cost_price * stock_quantity), 0) as total_accessory_cost,
        COALESCE(SUM(selling_price * stock_quantity), 0) as total_accessory_retail,
        COALESCE(SUM(stock_quantity), 0) as total_pieces,
        COUNT(CASE WHEN stock_quantity <= min_alert_threshold THEN 1 END) as low_stock_items_count
      FROM items
    `).get();

    res.json({
      period: { year: filterYear, month: filterMonth, label: `${monthPrefix}` },
      sales: {
        total_orders: monthlyStats.total_orders,
        items_sold: itemsCount,
        total_revenue: monthlyStats.total_revenue,
        total_cogs: monthlyStats.total_cogs,
        gross_profit: monthlyStats.gross_profit,
        profit_margin_pct: parseFloat(profitMarginPct)
      },
      handsets: handsetStats,
      stock: stockValuation,
      top_accessories: topAccessories
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   CSV EXPORT ROUTES
========================================================= */
app.get('/api/reports/export/sales.csv', (req, res) => {
  try {
    const { month, year } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (month && year) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      sql += " AND strftime('%Y-%m', created_at) = ?";
      params.push(monthPrefix);
    }

    sql += ' ORDER BY created_at DESC';
    const orders = db.prepare(sql).all(...params);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${Date.now()}.csv"`);

    let csv = 'Invoice Number,Date,Customer Name,Phone,Payment Method,Subtotal,Discount,Total Amount,COGS,Profit Margin\r\n';
    for (const o of orders) {
      const row = [
        `"${o.invoice_number}"`,
        `"${o.created_at}"`,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${(o.customer_phone || '').replace(/"/g, '""')}"`,
        `"${o.payment_method}"`,
        o.subtotal.toFixed(2),
        o.discount.toFixed(2),
        o.total_amount.toFixed(2),
        o.total_cost.toFixed(2),
        o.profit_margin.toFixed(2)
      ].join(',');
      csv += row + '\r\n';
    }

    res.send(csv);
  } catch (err) {
    res.status(500).send(`Error exporting CSV: ${err.message}`);
  }
});

app.get('/api/reports/export/inventory.csv', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT items.*, categories.name as category_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      ORDER BY categories.name ASC, items.title ASC
    `).all();

    const phones = db.prepare(`
      SELECT * FROM phones ORDER BY status ASC, brand ASC, model ASC
    `).all();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-report-${Date.now()}.csv"`);

    let csv = 'Type,Code/IMEI,Name/Model,Category/Brand,Cost Price,Selling Price,Stock/Status,Alert Threshold\r\n';
    for (const i of items) {
      const row = [
        '"Accessory"',
        `"${i.sku_or_barcode}"`,
        `"${i.title.replace(/"/g, '""')}"`,
        `"${(i.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
        i.cost_price.toFixed(2),
        i.selling_price.toFixed(2),
        i.stock_quantity,
        i.min_alert_threshold
      ].join(',');
      csv += row + '\r\n';
    }

    for (const p of phones) {
      const isBrandNew = p.condition_grade && p.condition_grade.includes('Brand New');
      const phoneType = isBrandNew ? 'Brand New Phone' : 'Pre-Owned Phone';
      const detailStr = isBrandNew ? (p.warranty_type || 'Official 1-Year') : `Battery ${p.battery_health}%`;
      const phoneTitle = `${p.brand} ${p.model} ${p.storage_capacity} (${p.condition_grade}, ${detailStr})`;
      const row = [
        `"${phoneType}"`,
        `"${p.imei_number}"`,
        `"${phoneTitle.replace(/"/g, '""')}"`,
        `"${p.brand}"`,
        p.purchase_cost.toFixed(2),
        p.selling_price.toFixed(2),
        `"${p.status}"`,
        'N/A'
      ].join(',');
      csv += row + '\r\n';
    }

    res.send(csv);
  } catch (err) {
    res.status(500).send(`Error exporting CSV: ${err.message}`);
  }
});

app.post('/api/admin/reset-demo-data', (req, res) => {
  try {
    db.prepare("DELETE FROM order_items").run();
    db.prepare("DELETE FROM orders").run();
    db.prepare("DELETE FROM items").run();
    db.prepare("DELETE FROM phones").run();
    res.json({ success: true, message: 'All sample demo products cleared! Your inventory is now clean and empty.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let server = null;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    const lanIPs = getLocalNetworkIPs();
    console.log('\n================================================================');
    console.log('  📱 BIPLOB SHOP - MOBILE RETAIL & ACCESSORIES POS SYSTEM');
    console.log('================================================================');
    console.log(`  🚀 Server listening on all interfaces (0.0.0.0:${PORT})`);
    console.log('');
    console.log(`  👉 Localhost:    http://localhost:${PORT}`);
    if (lanIPs.length > 0) {
      lanIPs.forEach(net => {
        console.log(`  👉 Network (${net.interface}): http://${net.address}:${PORT}`);
      });
    } else {
      console.log(`  👉 Network:      http://<Your-LAN-IP>:${PORT}`);
    }
    console.log('');
    console.log('  ✨ Offline & Local-First: Zero cloud dependencies.');
    console.log('  📲 Multi-Device Ready: Open on phone, tablet, Mac or PC.');
    console.log('================================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [ERROR] Port ${PORT} is already in use by another instance of Biplob Shop or another program.`);
      console.error(`   If the app is already running in another window, simply open: http://localhost:${PORT}`);
      console.error(`   Otherwise, close the existing window and try again.\n`);
    } else {
      console.error('\n❌ Server error:', err.message);
    }
  });
}

module.exports = { app, server };

