/* =========================================================
   BIPLOB SHOP - STANDALONE ON-DEVICE STORAGE ENGINE (MobileDB)
   Allows the app to run 100% standalone on an Android phone
   without requiring any PC or local Express server.
========================================================= */

const MobileDB = {
  KEYS: {
    CATEGORIES: 'biplob_categories',
    ITEMS: 'biplob_items',
    PHONES: 'biplob_phones',
    ORDERS: 'biplob_orders',
    PAYMENTS: 'biplob_emi_payments',
    MODE: 'biplob_pos_mode',
    SERVER_URL: 'biplob_server_url'
  },

  isStandalone() {
    const forced = localStorage.getItem(this.KEYS.MODE);
    if (forced === 'standalone') return true;
    if (forced === 'server') return false;
    // Auto-detect Capacitor native Android container or file:// protocol
    const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    const isLocalFile = window.location.protocol === 'file:';
    return isCapacitor || isLocalFile;
  },

  init() {
    if (!localStorage.getItem(this.KEYS.CATEGORIES)) {
      const defaultCategories = [
        { id: 1, name: 'Cases' },
        { id: 2, name: 'Screen Protectors' },
        { id: 3, name: 'Chargers & Cables' },
        { id: 4, name: 'Used Phones' },
        { id: 5, name: 'Repairs' },
        { id: 6, name: 'Audio & Earphones' },
        { id: 7, name: 'Power Banks' }
      ];
      localStorage.setItem(this.KEYS.CATEGORIES, JSON.stringify(defaultCategories));
    }
    if (!localStorage.getItem(this.KEYS.ITEMS)) {
      localStorage.setItem(this.KEYS.ITEMS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.PHONES)) {
      localStorage.setItem(this.KEYS.PHONES, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.ORDERS)) {
      localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.PAYMENTS)) {
      localStorage.setItem(this.KEYS.PAYMENTS, JSON.stringify([]));
    }
  },

  _get(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (_) {
      return [];
    }
  },

  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // --- CATEGORIES ---
  getCategories() {
    const cats = this._get(this.KEYS.CATEGORIES);
    return Array.isArray(cats) ? cats : [];
  },

  saveCategory(name) {
    const categories = this.getCategories();
    const clean = name.trim();
    if (categories.some(c => c.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Category already exists.');
    }
    const newCat = { id: Date.now(), name: clean, created_at: new Date().toISOString() };
    categories.push(newCat);
    this._set(this.KEYS.CATEGORIES, categories);
    return newCat;
  },

  // --- ITEMS (ACCESSORIES) ---
  getItems(search = '', category_id = '', low_stock = false) {
    let items = this._get(this.KEYS.ITEMS);
    const categories = this.getCategories();
    const catMap = {};
    (categories || []).forEach(c => catMap[c.id] = c.name);

    items = (items || []).map(i => ({
      ...i,
      category_name: catMap[i.category_id] || 'General'
    }));

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => (i.title && i.title.toLowerCase().includes(q)) || (i.sku_or_barcode && i.sku_or_barcode.toLowerCase().includes(q)));
    }
    if (category_id) {
      items = items.filter(i => String(i.category_id) === String(category_id));
    }
    if (low_stock) {
      items = items.filter(i => i.stock_quantity <= i.min_alert_threshold);
    }
    return items;
  },

  saveItem(data) {
    const items = this._get(this.KEYS.ITEMS);
    const sku = data.sku_or_barcode.trim();
    const existing = items.find(i => i.sku_or_barcode.toLowerCase() === sku.toLowerCase() && i.id !== data.id);
    if (existing) {
      throw new Error('An item with this SKU / Barcode already exists.');
    }

    if (data.id) {
      const index = items.findIndex(i => i.id === data.id);
      if (index === -1) throw new Error('Item not found');
      items[index] = {
        ...items[index],
        ...data,
        updated_at: new Date().toISOString()
      };
      this._set(this.KEYS.ITEMS, items);
      return items[index];
    } else {
      const newItem = {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      items.push(newItem);
      this._set(this.KEYS.ITEMS, items);
      return newItem;
    }
  },

  deleteItem(id) {
    let items = this._get(this.KEYS.ITEMS);
    items = items.filter(i => i.id !== id);
    this._set(this.KEYS.ITEMS, items);
    return true;
  },

  adjustStock(id, delta) {
    const items = this._get(this.KEYS.ITEMS);
    const item = items.find(i => i.id === id);
    if (!item) throw new Error('Item not found');
    item.stock_quantity = Math.max(0, item.stock_quantity + delta);
    this._set(this.KEYS.ITEMS, items);
    return item;
  },

  // --- OUT OF STOCK ITEMS ---
  getOutOfStockItems(type = 'all', search = '') {
    const q = (search || '').toLowerCase();
    let results = [];

    if (type !== 'phones') {
      const items = this.getItems('', '', false);
      const outOfStockAcc = items.filter(i => (Number(i.stock_quantity) <= 0));
      const filteredAcc = outOfStockAcc.filter(i => {
        if (!q) return true;
        return (i.title && i.title.toLowerCase().includes(q)) ||
               (i.sku_or_barcode && i.sku_or_barcode.toLowerCase().includes(q));
      }).map(i => ({ ...i, item_type: 'accessory' }));
      results = results.concat(filteredAcc);
    }

    if (type !== 'accessories') {
      const phones = this.getPhones('Sold', '');
      const filteredPhones = phones.filter(p => {
        if (!q) return true;
        return (p.brand && p.brand.toLowerCase().includes(q)) ||
               (p.model && p.model.toLowerCase().includes(q)) ||
               (p.imei_number && p.imei_number.toLowerCase().includes(q));
      }).map(p => ({ ...p, item_type: 'phone' }));
      results = results.concat(filteredPhones);
    }

    return results;
  },

  // --- PHONES (SERIALIZED IMEI) ---
  getPhones(status = '', search = '') {
    let phones = this._get(this.KEYS.PHONES);
    if (status) {
      phones = phones.filter(p => p.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      phones = phones.filter(p =>
        (p.imei_number && p.imei_number.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q))
      );
    }
    return phones;
  },

  checkImei(imei) {
    const clean = (imei || '').trim();
    const phones = this._get(this.KEYS.PHONES);
    const found = phones.find(p => p.imei_number === clean);
    return { exists: !!found, phone: found || null };
  },

  savePhone(data) {
    const phones = this._get(this.KEYS.PHONES);
    const imei = data.imei_number.trim();
    const existing = phones.find(p => p.imei_number === imei && p.id !== data.id);
    if (existing) {
      throw new Error(`IMEI ${imei} already registered to ${existing.brand} ${existing.model}`);
    }

    if (data.id) {
      const idx = phones.findIndex(p => p.id === data.id);
      if (idx === -1) throw new Error('Handset not found');
      phones[idx] = { ...phones[idx], ...data };
      this._set(this.KEYS.PHONES, phones);
      return phones[idx];
    } else {
      const newPhone = {
        id: Date.now(),
        ...data,
        status: 'In-Stock',
        created_at: new Date().toISOString()
      };
      phones.push(newPhone);
      this._set(this.KEYS.PHONES, phones);
      return newPhone;
    }
  },

  deletePhone(id) {
    let phones = this._get(this.KEYS.PHONES);
    phones = phones.filter(p => p.id !== id);
    this._set(this.KEYS.PHONES, phones);
    return true;
  },

  // --- POS UNIFIED SEARCH ---
  searchPos(query = '') {
    const q = (query || '').trim().toLowerCase();
    const accessories = this.getItems().filter(i => i.stock_quantity > 0);
    const phones = this.getPhones('In-Stock');

    const mappedAcc = accessories.map(a => ({
      id: a.id,
      code: a.sku_or_barcode,
      title: a.title,
      category_id: a.category_id,
      type: 'accessory',
      selling_price: parseFloat(a.selling_price) || 0,
      stock_quantity: parseInt(a.stock_quantity, 10) || 0,
      cost_price: parseFloat(a.cost_price) || 0,
      image: a.image || ''
    }));

    const mappedPhones = phones.map(p => ({
      id: p.id,
      code: p.imei_number,
      title: `${p.brand} ${p.model} (${p.storage_capacity})`,
      category_id: null,
      type: 'phone',
      selling_price: parseFloat(p.selling_price) || 0,
      stock_quantity: 1,
      cost_price: parseFloat(p.purchase_cost) || 0,
      condition_grade: p.condition_grade,
      battery_health: p.battery_health,
      warranty_type: p.warranty_type,
      image: p.image || ''
    }));

    if (!q) {
      return [...mappedAcc, ...mappedPhones];
    }

    // Exact code match check
    const exactPhone = mappedPhones.find(p => p.code.toLowerCase() === q);
    if (exactPhone) return [exactPhone];
    const exactAcc = mappedAcc.find(a => a.code.toLowerCase() === q);
    if (exactAcc) return [exactAcc];

    // Fuzzy matches
    const filteredAcc = mappedAcc.filter(a => a.title.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
    const filteredPhones = mappedPhones.filter(p => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    return [...filteredAcc, ...filteredPhones];
  },

  // --- ORDERS & EMI CHECKOUT TRANSACTION ---
  createOrder(payload) {
    const items = this._get(this.KEYS.ITEMS);
    const phones = this._get(this.KEYS.PHONES);
    const orders = this._get(this.KEYS.ORDERS);
    const payments = this._get(this.KEYS.PAYMENTS);

    let calculatedSubtotal = 0;
    let calculatedCost = 0;
    const processedItems = [];

    for (const item of payload.items) {
      if (item.item_type === 'accessory') {
        const dbItem = items.find(i => i.id === (item.id || item.item_id));
        if (!dbItem) throw new Error('Accessory not found in stock');
        if (dbItem.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${dbItem.title}`);
        }
        dbItem.stock_quantity -= item.quantity;
        const total_price = dbItem.selling_price * item.quantity;
        calculatedSubtotal += total_price;
        calculatedCost += (dbItem.cost_price * item.quantity);

        processedItems.push({
          item_type: 'accessory',
          item_id: dbItem.id,
          sku_or_imei: dbItem.sku_or_barcode,
          title: dbItem.title,
          quantity: item.quantity,
          unit_price: dbItem.selling_price,
          total_price
        });
      } else if (item.item_type === 'phone') {
        const dbPhone = phones.find(p => p.id === (item.id || item.phone_id));
        if (!dbPhone || dbPhone.status !== 'In-Stock') {
          throw new Error('Handset is not available');
        }
        dbPhone.status = 'Sold';
        dbPhone.sold_at = new Date().toISOString();
        calculatedSubtotal += dbPhone.selling_price;
        calculatedCost += dbPhone.purchase_cost;

        processedItems.push({
          item_type: 'phone',
          phone_id: dbPhone.id,
          sku_or_imei: dbPhone.imei_number,
          title: `${dbPhone.brand} ${dbPhone.model} (${dbPhone.storage_capacity})`,
          quantity: 1,
          unit_price: dbPhone.selling_price,
          total_price: dbPhone.selling_price
        });
      }
    }

    const discount = Math.max(0, parseFloat(payload.discount) || 0);
    const totalAmount = Math.max(0, calculatedSubtotal - discount);
    const isEmi = payload.is_emi ? 1 : 0;
    const isBankEmi = isEmi && payload.emi_type === 'Bank EMI';

    let downPayment = parseFloat(payload.emi_down_payment) || 0;
    let remainingDue = 0;
    let emiStatus = '';

    if (isEmi) {
      if (isBankEmi) {
        downPayment = totalAmount;
        remainingDue = 0;
        emiStatus = 'Completed';
      } else {
        remainingDue = Math.max(0, totalAmount - downPayment);
        emiStatus = remainingDue <= 0 ? 'Completed' : 'Active';
      }
    }

    const invoiceNumber = 'INV-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);
    const orderId = Date.now();

    const orderRecord = {
      id: orderId,
      invoice_number: invoiceNumber,
      customer_name: payload.customer_name || 'Walk-in Customer',
      customer_phone: payload.customer_phone || '',
      payment_method: payload.payment_method || 'Cash',
      subtotal: calculatedSubtotal,
      discount,
      total_amount: totalAmount,
      total_cost: calculatedCost,
      profit_margin: totalAmount - calculatedCost,
      is_emi: isEmi,
      emi_type: payload.emi_type || '',
      emi_bank_name: payload.emi_bank_name || '',
      emi_card_last4: payload.emi_card_last4 || '',
      emi_tenure_months: parseInt(payload.emi_tenure_months, 10) || 0,
      emi_down_payment: downPayment,
      emi_monthly_amount: parseFloat(payload.emi_monthly_amount) || 0,
      emi_remaining_due: remainingDue,
      customer_nid: payload.customer_nid || '',
      guarantor_info: payload.guarantor_info || '',
      emi_status: emiStatus,
      items: processedItems,
      created_at: new Date().toISOString()
    };

    // Log initial down payment in emi_payments if shop installment
    if (isEmi && !isBankEmi && downPayment > 0) {
      payments.push({
        id: Date.now(),
        order_id: orderId,
        invoice_number: invoiceNumber,
        amount_paid: downPayment,
        payment_method: payload.payment_method === 'EMI' ? 'Cash' : payload.payment_method,
        remaining_balance: remainingDue,
        notes: 'Initial Down Payment at Sale',
        payment_date: new Date().toISOString()
      });
      this._set(this.KEYS.PAYMENTS, payments);
    }

    orders.unshift(orderRecord);
    this._set(this.KEYS.ORDERS, orders);
    this._set(this.KEYS.ITEMS, items);
    this._set(this.KEYS.PHONES, phones);

    return orderRecord;
  },

  getOrders(is_emi = '', search = '') {
    let orders = this._get(this.KEYS.ORDERS);
    if (is_emi === '1') {
      orders = orders.filter(o => o.is_emi == 1);
    }
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        (o.invoice_number && o.invoice_number.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (o.customer_nid && o.customer_nid.toLowerCase().includes(q))
      );
    }
    return orders;
  },

  getOrderById(id) {
    const orders = this._get(this.KEYS.ORDERS);
    const order = orders.find(o => o.id == id);
    if (!order) throw new Error('Order not found');
    const payments = this._get(this.KEYS.PAYMENTS).filter(p => p.order_id == id);
    return { ...order, payments };
  },

  getEmiOrders(status = '', search = '') {
    let orders = this.getOrders('1', search);
    if (status) {
      orders = orders.filter(o => o.emi_status === status);
    }
    const allPayments = this._get(this.KEYS.PAYMENTS);
    return orders.map(o => ({
      ...o,
      payments: allPayments.filter(p => p.order_id == o.id)
    }));
  },

  collectEmiPayment(data) {
    const orders = this._get(this.KEYS.ORDERS);
    const payments = this._get(this.KEYS.PAYMENTS);
    const order = orders.find(o => o.id == data.order_id);
    if (!order) throw new Error('Order not found');

    const amount = parseFloat(data.amount || data.amount_paid) || 0;
    if (amount <= 0) throw new Error('Valid payment amount required');

    const newDue = Math.max(0, order.emi_remaining_due - amount);
    const newStatus = newDue <= 0 ? 'Completed' : 'Active';
    order.emi_remaining_due = newDue;
    order.emi_status = newStatus;

    const paymentRecord = {
      id: Date.now(),
      order_id: order.id,
      invoice_number: order.invoice_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_nid: order.customer_nid,
      amount_paid: amount,
      payment_method: data.payment_method || 'Cash',
      remaining_balance: newDue,
      notes: data.note || data.notes || 'Installment Collection',
      payment_date: new Date().toISOString()
    };

    payments.push(paymentRecord);
    this._set(this.KEYS.ORDERS, orders);
    this._set(this.KEYS.PAYMENTS, payments);

    return paymentRecord;
  },

  voidOrder(orderId, voidDetails = {}) {
    const orders = this._get(this.KEYS.ORDERS);
    const phones = this._get(this.KEYS.PHONES);
    const items = this._get(this.KEYS.ITEMS);

    const order = orders.find(o => String(o.id) === String(orderId) || o.invoice_number === String(orderId));
    if (!order) throw new Error('Order not found');
    if (order.status === 'VOID') throw new Error('Invoice is already voided');

    const voidReason = voidDetails.reason || voidDetails.void_reason || 'Cancelled by Store Authority';
    const nowIso = new Date().toISOString();

    order.status = 'VOID';
    order.voided_at = nowIso;
    order.void_reason = voidReason;
    order.voided_by = 'Owner';

    // Replenish inventory
    (order.items || []).forEach(it => {
      const isPhone = it.item_type === 'phone' || !!it.imei_number;
      if (isPhone) {
        const phone = phones.find(p => p.imei_number === (it.imei_number || it.sku_or_imei) || String(p.id) === String(it.id));
        if (phone) {
          phone.status = 'In-Stock';
          delete phone.sold_at;
          delete phone.order_id;
        }
      } else {
        const acc = items.find(a => String(a.id) === String(it.id));
        if (acc) {
          acc.stock_quantity = (Number(acc.stock_quantity) || 0) + (Number(it.quantity) || 1);
        }
      }
    });

    this._set(this.KEYS.ORDERS, orders);
    this._set(this.KEYS.PHONES, phones);
    this._set(this.KEYS.ITEMS, items);

    return {
      success: true,
      message: `Invoice ${order.invoice_number} voided and inventory replenished.`,
      order
    };
  },

  deleteOrder(orderId) {
    const key = String(orderId).trim();
    let orders = this._get(this.KEYS.ORDERS);
    orders = orders.filter(o => String(o.id) !== key && String(o.invoice_number) !== key);
    this._set(this.KEYS.ORDERS, orders);
    return true;
  },

  exportBackup() {
    return {
      format: 'BIPLOB_SHOP_POS_BACKUP',
      version: '2.0',
      timestamp: new Date().toISOString(),
      counts: {
        items: this._get(this.KEYS.ITEMS).length,
        phones: this._get(this.KEYS.PHONES).length,
        categories: this._get(this.KEYS.CATEGORIES).length,
        orders: this._get(this.KEYS.ORDERS).length
      },
      items: this._get(this.KEYS.ITEMS),
      phones: this._get(this.KEYS.PHONES),
      categories: this._get(this.KEYS.CATEGORIES),
      orders: this._get(this.KEYS.ORDERS),
      payments: this._get(this.KEYS.PAYMENTS)
    };
  },

  restoreBackup(backupData) {
    if (!backupData || (!backupData.items && !backupData.phones)) {
      throw new Error('Invalid backup format: missing items or phones data');
    }
    if (Array.isArray(backupData.items)) this._set(this.KEYS.ITEMS, backupData.items);
    if (Array.isArray(backupData.phones)) this._set(this.KEYS.PHONES, backupData.phones);
    if (Array.isArray(backupData.categories)) this._set(this.KEYS.CATEGORIES, backupData.categories);
    if (Array.isArray(backupData.orders)) this._set(this.KEYS.ORDERS, backupData.orders);
    if (Array.isArray(backupData.payments)) this._set(this.KEYS.PAYMENTS, backupData.payments);

    return {
      success: true,
      restoredCount: (backupData.items || []).length + (backupData.phones || []).length + (backupData.orders || []).length
    };
  },

  getReportsSummary(month, year) {
    const orders = this._get(this.KEYS.ORDERS);
    const phones = this._get(this.KEYS.PHONES);
    const items = this._get(this.KEYS.ITEMS);

    const now = new Date();
    const filterYear = year ? parseInt(year, 10) : now.getFullYear();
    const filterMonth = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${filterYear}-${filterMonth}`;

    const monthOrders = orders.filter(o => o.status !== 'VOID' && o.created_at && o.created_at.startsWith(prefix));

    const totalOrders = monthOrders.length;
    const totalRevenue = monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalCogs = monthOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    const grossProfit = totalRevenue - totalCogs;
    const profitMarginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    let itemsSold = 0;
    const accSalesMap = {};

    (monthOrders || []).forEach(o => {
      (o.items || []).forEach(it => {
        itemsSold += it.quantity;
        if (it.item_type === 'accessory') {
          if (!accSalesMap[it.title]) {
            accSalesMap[it.title] = { title: it.title, sku_or_imei: it.sku_or_imei, units_sold: 0, revenue: 0 };
          }
          accSalesMap[it.title].units_sold += it.quantity;
          accSalesMap[it.title].revenue += it.total_price;
        }
      });
    });

    const topAccessories = Object.values(accSalesMap).sort((a, b) => b.units_sold - a.units_sold).slice(0, 5);

    const inStockPhones = phones.filter(p => p.status === 'In-Stock');
    const inStockCost = inStockPhones.reduce((sum, p) => sum + (p.purchase_cost || 0), 0);
    const soldPhones = phones.filter(p => p.status === 'Sold');

    const totalAccRetail = items.reduce((sum, i) => sum + (i.selling_price * i.stock_quantity), 0);
    const totalAccCost = items.reduce((sum, i) => sum + (i.cost_price * i.stock_quantity), 0);

    return {
      sales: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        profit_margin_pct: profitMarginPct,
        items_sold: itemsSold
      },
      stock: {
        total_accessory_retail: totalAccRetail,
        total_accessory_cost: totalAccCost
      },
      handsets: {
        in_stock_count: inStockPhones.length,
        in_stock_cost_value: inStockCost,
        sold_count: soldPhones.length
      },
      top_accessories: topAccessories
    };
  },

  // --- API REQUEST DISPATCHER ---
  async handleApiRequest(urlStr, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    let parsedBody = {};
    if (init.body) {
      try {
        parsedBody = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch (_) {}
    }

    const dummyBase = 'http://localhost';
    const parsedUrl = new URL(urlStr, dummyBase);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.searchParams;

    try {
      // 1. Categories
      if (pathname === '/api/categories') {
        if (method === 'GET') {
          return this._json(this.getCategories());
        } else if (method === 'POST') {
          return this._json(this.saveCategory(parsedBody.name), 201);
        }
      }

      // 2. Items (Accessories)
      if (pathname === '/api/items') {
        if (method === 'GET') {
          const search = query.get('search') || '';
          const category_id = query.get('category_id') || '';
          const low_stock = query.get('low_stock') === '1' || query.get('low_stock') === 'true';
          return this._json(this.getItems(search, category_id, low_stock));
        } else if (method === 'POST') {
          return this._json(this.saveItem(parsedBody), 201);
        }
      }

      const itemAdjustMatch = pathname.match(/^\/api\/items\/(\d+)\/adjust-stock$/);
      if (itemAdjustMatch && method === 'POST') {
        const id = parseInt(itemAdjustMatch[1], 10);
        return this._json(this.adjustStock(id, parseInt(parsedBody.delta, 10) || 0));
      }

      const itemMatch = pathname.match(/^\/api\/items\/(\d+)$/);
      if (itemMatch) {
        const id = parseInt(itemMatch[1], 10);
        if (method === 'PUT') {
          return this._json(this.saveItem({ ...parsedBody, id }));
        } else if (method === 'DELETE') {
          this.deleteItem(id);
          return this._json({ success: true, message: 'Item deleted.' });
        }
      }

      if (pathname === '/api/items/out-of-stock') {
        const type = query.get('type') || 'all';
        const search = query.get('search') || '';
        return this._json(this.getOutOfStockItems(type, search));
      }

      // 3. Phones
      if (pathname === '/api/phones') {
        if (method === 'GET') {
          const status = query.get('status') || '';
          const search = query.get('search') || '';
          return this._json(this.getPhones(status, search));
        } else if (method === 'POST') {
          return this._json(this.savePhone(parsedBody), 201);
        }
      }

      const checkImeiMatch = pathname.match(/^\/api\/phones\/(?:check-imei|check)\/(.+)$/);
      if (checkImeiMatch && method === 'GET') {
        const imei = decodeURIComponent(checkImeiMatch[1]);
        return this._json(this.checkImei(imei));
      }

      const phoneMatch = pathname.match(/^\/api\/phones\/(\d+)$/);
      if (phoneMatch) {
        const id = parseInt(phoneMatch[1], 10);
        if (method === 'PUT') {
          return this._json(this.savePhone({ ...parsedBody, id }));
        } else if (method === 'DELETE') {
          this.deletePhone(id);
          return this._json({ success: true, message: 'Handset removed.' });
        }
      }

      // 4. POS Search
      if (pathname === '/api/pos/search') {
        const q = query.get('q') || '';
        return this._json(this.searchPos(q));
      }

      // 5. Orders
      if (pathname === '/api/orders') {
        if (method === 'POST') {
          return this._json(this.createOrder(parsedBody), 201);
        } else if (method === 'GET') {
          const is_emi = query.get('is_emi') || '';
          const search = query.get('search') || '';
          return this._json(this.getOrders(is_emi, search));
        }
      }

      const voidMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/void$/);
      if (voidMatch && method === 'POST') {
        const id = voidMatch[1];
        return this._json(this.voidOrder(id, parsedBody));
      }

      const orderMatch = pathname.match(/^\/api\/orders\/([^\/]+)$/);
      if (orderMatch) {
        const id = orderMatch[1];
        if (method === 'GET') {
          return this._json(this.getOrderById(id));
        } else if (method === 'DELETE') {
          this.deleteOrder(id);
          return this._json({ success: true, message: 'Order deleted permanently.' });
        }
      }

      // 6. EMI
      if (pathname === '/api/emi/orders') {
        const status = query.get('status') || '';
        const search = query.get('search') || '';
        return this._json(this.getEmiOrders(status, search));
      }

      const emiPaymentsMatch = pathname.match(/^\/api\/emi\/orders\/(\d+)\/payments$/);
      if (emiPaymentsMatch && method === 'GET') {
        const id = emiPaymentsMatch[1];
        const order = this.getOrderById(id);
        return this._json(order.payments || []);
      }

      if ((pathname === '/api/emi/collect' || pathname === '/api/emi/payments') && method === 'POST') {
        return this._json(this.collectEmiPayment(parsedBody));
      }

      // 7. Reports
      if (pathname === '/api/reports/summary') {
        const month = query.get('month');
        const year = query.get('year');
        return this._json(this.getReportsSummary(month, year));
      }

      if (pathname === '/api/reports/export/inventory.csv') {
        const items = this.getItems('', '', false);
        const phones = this.getPhones('', '');
        let csv = '\uFEFFType,Code or IMEI,Name or Model,Category or Brand,Tak or Location,Cost Price (BDT),Selling Price (BDT),Stock or Status,Alert Limit\r\n';
        for (const i of items) {
          csv += `"Accessory","${i.sku_or_barcode || ''}","${(i.title || '').replace(/"/g, '""')}","${(i.category_name || 'General').replace(/"/g, '""')}","${(i.rack_location || '-').replace(/"/g, '""')}",${Number(i.cost_price || 0).toFixed(2)},${Number(i.selling_price || 0).toFixed(2)},"${i.stock_quantity ?? 0}","${i.min_alert_threshold ?? 5}"\r\n`;
        }
        for (const p of phones) {
          const isBrandNew = p.condition_grade && p.condition_grade.includes('Brand New');
          const phoneType = isBrandNew ? 'Brand New Handset' : 'Pre-Owned Handset';
          const detailStr = isBrandNew ? (p.warranty_type || 'Official 1-Year') : `Battery ${p.battery_health}%`;
          const phoneTitle = `${p.brand || ''} ${p.model || ''} ${p.storage_capacity || ''} (${p.condition_grade || 'Standard'}, ${detailStr})`.trim();
          csv += `"${phoneType}","${p.imei_number || ''}","${phoneTitle.replace(/"/g, '""')}","${p.brand || ''}","-",${Number(p.purchase_cost || 0).toFixed(2)},${Number(p.selling_price || 0).toFixed(2)},"${p.status || 'In-Stock'}","1"\r\n`;
        }
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="inventory-report-${Date.now()}.csv"`
          }
        });
      }

      if (pathname === '/api/reports/export/sales.csv') {
        const month = query.get('month');
        const year = query.get('year');
        let orders = this.getOrders('', '').filter(o => o.status !== 'VOID');
        if (month && year) {
          orders = orders.filter(o => {
            const d = new Date(o.created_at);
            return (d.getMonth() + 1) === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
          });
        }
        let csv = '\uFEFFInvoice #,Date,Customer,Phone,Items Count,Subtotal (BDT),Discount,Final Total (BDT),Payment Method,EMI Type,Remaining Due\r\n';
        for (const o of orders) {
          const itemsCount = (o.items && Array.isArray(o.items)) ? o.items.length : (o.item_count || 1);
          csv += `"${o.invoice_number || ''}","${new Date(o.created_at).toLocaleString()}","${(o.customer_name || 'Walk-in Customer').replace(/"/g, '""')}","${o.customer_phone || ''}",${itemsCount},${Number(o.subtotal || o.final_amount || 0).toFixed(2)},${Number(o.discount_amount || 0).toFixed(2)},${Number(o.final_amount || 0).toFixed(2)},"${o.payment_method || 'Cash'}","${o.is_emi ? (o.emi_type || 'EMI') : 'Full Payment'}",${Number(o.emi_remaining_due || 0).toFixed(2)}\r\n`;
        }
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="sales-report-${Date.now()}.csv"`
          }
        });
      }

      // Backup & Restore API
      if (pathname === '/api/backup/export' && method === 'GET') {
        return this._json(this.exportBackup());
      }

      if (pathname === '/api/backup/restore' && method === 'POST') {
        return this._json(this.restoreBackup(parsedBody));
      }

      if (pathname === '/api/reports/export/outofstock.csv') {
        const items = this.getOutOfStockItems('all', '');
        let csv = '\uFEFFItem Type,SKU or IMEI,Product Name / Model,Category or Brand,Tak / Location,Cost Price (BDT),Selling Price (BDT),Current Stock,Min Alert Limit,Suggested Reorder Qty\r\n';
        for (const i of items) {
          const isPhone = i.item_type === 'phone' || !!i.imei_number;
          const type = isPhone ? 'Mobile Handset' : 'Accessory';
          const code = isPhone ? i.imei_number : (i.sku_or_barcode || '');
          const name = isPhone ? `${i.brand} ${i.model} ${i.storage_capacity || ''} (${i.condition_grade || 'Pre-Owned'})` : (i.title || '');
          const cat = isPhone ? i.brand : (i.category_name || 'General');
          const loc = isPhone ? '-' : (i.rack_location || '-');
          const cost = Number(isPhone ? i.purchase_cost : i.cost_price || 0).toFixed(2);
          const price = Number(i.selling_price || 0).toFixed(2);
          const stock = isPhone ? '0 (Sold)' : (i.stock_quantity || 0);
          const alert = isPhone ? '1' : (i.min_alert_threshold || 5);
          const reorder = isPhone ? '1' : Math.max(10, (i.min_alert_threshold || 5) * 2);
          csv += `"${type}","${code}","${name.replace(/"/g, '""')}","${cat.replace(/"/g, '""')}","${loc.replace(/"/g, '""')}",${cost},${price},"${stock}",${alert},${reorder}\r\n`;
        }
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="outofstock-products-${Date.now()}.csv"`
          }
        });
      }

      // 8. Admin Reset Demo Data
      if (pathname === '/api/admin/reset-demo-data' && method === 'POST') {
        this._set(this.KEYS.ITEMS, []);
        this._set(this.KEYS.PHONES, []);
        this._set(this.KEYS.ORDERS, []);
        this._set(this.KEYS.PAYMENTS, []);
        return this._json({ success: true, message: 'All local demo data cleared.' });
      }

      // 9. System info
      if (pathname === '/api/system/network-info' || pathname === '/api/system/info') {
        return this._json({
          server_ip: 'Mobile Localhost',
          port: 3000,
          network_ips: ['Mobile Device'],
          mode: 'Standalone Mobile App'
        });
      }

      return this._json({ error: `Route ${pathname} not found in MobileDB` }, 404);
    } catch (err) {
      return this._json({ error: err.message || 'Internal error' }, 400);
    }
  },

  _json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

MobileDB.init();
window.MobileDB = MobileDB;

// Intercept window.fetch for cloud sync and offline standalone mobile app
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(resource, init) {
    const urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    if (urlStr.startsWith('/api/') || urlStr.includes('/api/')) {
      // 1. If Firebase Cloud Sync is configured, route via FirebaseDB
      if (window.FirebaseDB && window.FirebaseDB.isConfigured()) {
        try {
          return await FirebaseDB.handleApiRequest(urlStr, init);
        } catch (fbErr) {
          console.warn('FirebaseDB handler error, falling back to MobileDB:', fbErr);
        }
      }

      // 2. Standalone on-device mode (MobileDB)
      if (MobileDB.isStandalone()) {
        return MobileDB.handleApiRequest(urlStr, init);
      }

      // 3. Counter PC Express Server mode
      try {
        return await originalFetch(resource, init);
      } catch (networkErr) {
        console.warn('Network fetch failed, falling back to local MobileDB:', networkErr);
        return MobileDB.handleApiRequest(urlStr, init);
      }
    }
    return originalFetch(resource, init);
  };
})();
