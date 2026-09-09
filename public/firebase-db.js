/* =========================================================
   BIPLOB SHOP - GOOGLE FIREBASE FIRESTORE SYNC ENGINE
   100% Free Spark Tier ($0/Month Forever)
   Multi-Device Real-Time Sync & Offline-First Concurrency Engine
   ========================================================= */

const FirebaseDB = {
  db: null,
  app: null,
  isInitialized: false,
  syncState: 'local_only', // 'connected' | 'offline' | 'local_only'
  listeners: [],
  unsubscribers: [],

  // In-memory cache for 0-read searches and instant UI rendering
  cache: {
    items: [],
    phones: [],
    categories: [
      { id: 1, name: 'Cases' },
      { id: 2, name: 'Screen Protectors' },
      { id: 3, name: 'Chargers & Cables' },
      { id: 4, name: 'Used Phones' },
      { id: 5, name: 'Repairs' },
      { id: 6, name: 'Audio & Earphones' },
      { id: 7, name: 'Power Banks' }
    ],
    orders: []
  },

  /**
   * Initializes Firebase and enables offline IndexedDB persistence
   */
  async init() {
    if (!window.FirebaseConfig || !window.FirebaseConfig.isConfigured()) {
      console.log('Firebase credentials not configured; operating in local on-device mode.');
      this.syncState = 'local_only';
      this._updateStatusUI();
      return false;
    }

    if (!window.firebase) {
      console.warn('Firebase SDK not available.');
      this.syncState = 'local_only';
      this._updateStatusUI();
      return false;
    }

    try {
      const config = window.FirebaseConfig.get();
      
      // Initialize or get default app
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();

      // Enable multi-tab IndexedDB offline persistence
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
        console.log('Firestore offline IndexedDB persistence enabled!');
      } catch (err) {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence notice: Multiple tabs open; primary tab has persistence.');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence unsupported in this browser environment.');
        } else {
          console.warn('Firestore persistence notice:', err);
        }
      }

      this.isInitialized = true;
      this.syncState = navigator.onLine ? 'connected' : 'offline';
      this._setupNetworkListeners();
      this.startRealtimeSync();
      this._updateStatusUI();
      return true;
    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.syncState = 'local_only';
      this._updateStatusUI();
      return false;
    }
  },

  isConfigured() {
    return this.isInitialized && !!this.db;
  },

  _setupNetworkListeners() {
    window.addEventListener('online', () => {
      if (this.isConfigured()) {
        this.syncState = 'connected';
        this._updateStatusUI();
      }
    });
    window.addEventListener('offline', () => {
      if (this.isConfigured()) {
        this.syncState = 'offline';
        this._updateStatusUI();
      }
    });
  },

  _updateStatusUI() {
    const badge = document.getElementById('cloudSyncBadge');
    const badgeText = document.getElementById('cloudSyncText');
    const badgeDot = document.getElementById('cloudSyncDot');
    if (!badge || !badgeText || !badgeDot) return;

    if (this.syncState === 'connected') {
      badgeDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      badgeText.textContent = 'Cloud Synced';
      badge.title = 'Real-time multi-device cloud synchronization active (Firebase Spark Plan)';
      badge.className = 'flex items-center space-x-1.5 bg-emerald-900/70 text-emerald-200 px-2.5 py-1 rounded-md border border-emerald-600/50 text-[11px] font-semibold cursor-pointer hover:bg-emerald-900 transition';
    } else if (this.syncState === 'offline') {
      badgeDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
      badgeText.textContent = 'Offline (Queued)';
      badge.title = 'Offline mode: changes will sync automatically when reconnected';
      badge.className = 'flex items-center space-x-1.5 bg-amber-900/70 text-amber-200 px-2.5 py-1 rounded-md border border-amber-600/50 text-[11px] font-semibold cursor-pointer hover:bg-amber-900 transition';
    } else {
      badgeDot.className = 'w-2 h-2 rounded-full bg-gray-400';
      badgeText.textContent = 'Local Mode';
      badge.title = 'Click to connect Firebase Cloud Sync for multi-phone sync';
      badge.className = 'flex items-center space-x-1.5 bg-indigo-900/60 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-700/50 text-[11px] font-semibold cursor-pointer hover:bg-indigo-800 transition';
    }
  },

  /**
   * Real-time listener for multi-phone synchronization
   * Subscribes to items, phones, orders, and categories
   */
  startRealtimeSync() {
    if (!this.db) return;

    // Clean up existing listeners if any
    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
    this.unsubscribers = [];

    // 1. Sync Accessories (items collection)
    const unsubItems = this.db.collection('items').onSnapshot((snapshot) => {
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      this.cache.items = items;
      this.syncState = snapshot.metadata.fromCache ? (navigator.onLine ? 'connected' : 'offline') : 'connected';
      this._updateStatusUI();
      this._notifyListeners('items', items);
    }, (err) => {
      console.warn('Firestore items sync notice:', err);
    });
    this.unsubscribers.push(unsubItems);

    // 2. Sync Mobile Handsets (phones collection)
    const unsubPhones = this.db.collection('phones').onSnapshot((snapshot) => {
      const phones = [];
      snapshot.forEach(doc => {
        phones.push({ id: doc.id, ...doc.data() });
      });
      this.cache.phones = phones;
      this._updateStatusUI();
      this._notifyListeners('phones', phones);
    }, (err) => {
      console.warn('Firestore phones sync notice:', err);
    });
    this.unsubscribers.push(unsubPhones);

    // 3. Sync Categories
    const unsubCats = this.db.collection('config').doc('categories').onSnapshot((doc) => {
      if (doc.exists && Array.isArray(doc.data().list)) {
        this.cache.categories = doc.data().list;
        this._notifyListeners('categories', this.cache.categories);
      } else {
        this.db.collection('config').doc('categories').set({ list: this.cache.categories }, { merge: true });
      }
    }, (err) => {
      console.warn('Firestore categories sync notice:', err);
    });
    this.unsubscribers.push(unsubCats);

    // 4. Sync Orders (Recent invoices)
    const unsubOrders = this.db.collection('orders').orderBy('created_at', 'desc').limit(200).onSnapshot((snapshot) => {
      const orders = [];
      snapshot.forEach(doc => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      this.cache.orders = orders;
      this._notifyListeners('orders', orders);
    }, (err) => {
      console.warn('Firestore orders sync notice:', err);
    });
    this.unsubscribers.push(unsubOrders);
  },

  onSync(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  },

  _notifyListeners(type, data) {
    this.listeners.forEach(cb => {
      try { cb(type, data); } catch (e) { console.error('Listener callback error:', e); }
    });
  },

  /**
   * Client-Side Image Compression (<40 KB WebP)
   * Prevents Firestore quota bloat and keeps photo sync lightning-fast across mobile data
   */
  compressImageToWebP(dataUrlOrFile, maxDimension = 600, quality = 0.6) {
    return new Promise((resolve) => {
      if (!dataUrlOrFile) return resolve('');

      const processImg = (img) => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first; fallback to JPEG
          let result = canvas.toDataURL('image/webp', quality);
          if (!result.startsWith('data:image/webp')) {
            result = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(result);
        } catch (err) {
          console.warn('Image compression fallback:', err);
          resolve(typeof dataUrlOrFile === 'string' ? dataUrlOrFile : '');
        }
      };

      if (typeof dataUrlOrFile === 'string') {
        const img = new Image();
        img.onload = () => processImg(img);
        img.onerror = () => resolve(dataUrlOrFile);
        img.src = dataUrlOrFile;
      } else if (dataUrlOrFile instanceof Blob || dataUrlOrFile instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => processImg(img);
          img.onerror = () => resolve(e.target.result);
          img.src = e.target.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(dataUrlOrFile);
      } else {
        resolve('');
      }
    });
  },

  /**
   * ATOMIC CHECKOUT ENGINE (Firestore Concurrency Safe)
   */
  async executeCheckout(cart, orderDetails) {
    if (!this.isConfigured()) {
      throw new Error('Firebase is not configured. Please connect Firebase or use local mode.');
    }

    return await this.db.runTransaction(async (transaction) => {
      // 1. ALL READS FIRST (Required by Firestore Transaction Architecture)
      const readPlan = [];

      for (const item of cart) {
        if (item.item_type === 'phone' || item.imei_number) {
          const imei = String(item.imei_number || item.id).trim();
          const phoneRef = this.db.collection('phones').doc(imei);
          const phoneDoc = await transaction.get(phoneRef);

          if (!phoneDoc.exists) {
            throw new Error('Mobile Handset with IMEI ' + imei + ' was not found in cloud inventory.');
          }
          const pData = phoneDoc.data();
          if (pData.status !== 'In-Stock') {
            throw new Error('Handset ' + (pData.brand || '') + ' ' + (pData.model || '') + ' (IMEI: ' + imei + ') was already marked SOLD by another staff member!');
          }
          readPlan.push({ type: 'phone', ref: phoneRef, data: pData, cartItem: item });
        } else {
          const itemId = String(item.id);
          const itemRef = this.db.collection('items').doc(itemId);
          const itemDoc = await transaction.get(itemRef);

          if (!itemDoc.exists) {
            throw new Error('Accessory "' + (item.title || item.name) + '" not found in inventory.');
          }
          const iData = itemDoc.data();
          const currentStock = Number(iData.stock_quantity || 0);
          const requestedQty = Number(item.quantity || 1);

          if (currentStock < requestedQty) {
            throw new Error('Insufficient stock for "' + iData.title + '". Available: ' + currentStock + ', Requested: ' + requestedQty + '.');
          }
          readPlan.push({
            type: 'accessory',
            ref: itemRef,
            data: iData,
            newStock: currentStock - requestedQty,
            cartItem: item
          });
        }
      }

      // 2. ALL WRITES AFTER READS
      const nowIso = new Date().toISOString();
      const invoiceNumber = orderDetails.invoice_number || ('INV-' + Date.now());

      for (const task of readPlan) {
        if (task.type === 'phone') {
          transaction.update(task.ref, {
            status: 'Sold',
            sold_at: nowIso,
            sold_invoice: invoiceNumber,
            sold_customer_name: orderDetails.customer_name || 'Walk-in Customer',
            sold_customer_phone: orderDetails.customer_phone || ''
          });
        } else {
          transaction.update(task.ref, {
            stock_quantity: task.newStock,
            updated_at: nowIso
          });
        }
      }

      // 3. Create Order Document
      const orderRef = this.db.collection('orders').doc(invoiceNumber);
      const cleanOrder = {
        id: invoiceNumber,
        invoice_number: invoiceNumber,
        customer_name: orderDetails.customer_name || 'Walk-in Customer',
        customer_phone: orderDetails.customer_phone || '',
        customer_nid: orderDetails.customer_nid || '',
        guarantor_name: orderDetails.guarantor_name || '',
        guarantor_phone: orderDetails.guarantor_phone || '',
        subtotal: Number(orderDetails.subtotal || 0),
        discount_amount: Number(orderDetails.discount_amount || 0),
        final_amount: Number(orderDetails.final_amount || 0),
        paid_amount: Number(orderDetails.paid_amount || 0),
        payment_method: orderDetails.payment_method || 'Cash',
        is_emi: !!orderDetails.is_emi,
        emi_type: orderDetails.emi_type || 'Full Payment',
        emi_tenure_months: Number(orderDetails.emi_tenure_months || 0),
        emi_monthly_amount: Number(orderDetails.emi_monthly_amount || 0),
        emi_remaining_due: Number(orderDetails.emi_remaining_due || 0),
        items: cart,
        created_at: nowIso
      };

      transaction.set(orderRef, cleanOrder);

      return {
        order_id: invoiceNumber,
        invoice_number: invoiceNumber,
        order: cleanOrder
      };
    });
  },

  // --- ACCESSORY OPERATIONS ---
  async addAccessory(data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const docId = String(Date.now());
    const cleanImg = await this.compressImageToWebP(data.image_url || '');

    const record = {
      id: docId,
      sku_or_barcode: (data.sku_or_barcode || '').trim(),
      title: (data.title || '').trim(),
      category_id: data.category_id || '',
      category_name: data.category_name || 'General',
      cost_price: Number(data.cost_price || 0),
      selling_price: Number(data.selling_price || 0),
      stock_quantity: Number(data.stock_quantity || 0),
      min_alert_threshold: Number(data.min_alert_threshold || 5),
      rack_location: (data.rack_location || '-').trim(),
      image_url: cleanImg,
      is_active: 1,
      created_at: new Date().toISOString()
    };

    await this.db.collection('items').doc(docId).set(record);
    return record;
  },

  async updateAccessory(id, data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const updates = { ...data, updated_at: new Date().toISOString() };
    if (updates.image_url && updates.image_url.startsWith('data:')) {
      updates.image_url = await this.compressImageToWebP(updates.image_url);
    }
    await this.db.collection('items').doc(String(id)).update(updates);
    return { success: true };
  },

  async adjustStock(id, delta, reason = 'Adjustment') {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const ref = this.db.collection('items').doc(String(id));
    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) throw new Error('Item not found');
      const cur = Number(doc.data().stock_quantity || 0);
      const nextStock = Math.max(0, cur + Number(delta));
      transaction.update(ref, {
        stock_quantity: nextStock,
        updated_at: new Date().toISOString()
      });
    });
    return { success: true };
  },

  async deleteAccessory(id) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    await this.db.collection('items').doc(String(id)).delete();
    return { success: true };
  },

  // --- MOBILE HANDSET (IMEI) OPERATIONS ---
  async addPhone(data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const imei = String(data.imei_number || '').trim();
    if (!imei) throw new Error('15-digit IMEI number is required.');

    const docRef = this.db.collection('phones').doc(imei);
    const existing = await docRef.get();
    if (existing.exists) {
      throw new Error('Handset with IMEI ' + imei + ' already exists in inventory!');
    }

    const cleanImg = await this.compressImageToWebP(data.image_url || '');

    const record = {
      id: imei,
      imei_number: imei,
      brand: (data.brand || '').trim(),
      model: (data.model || '').trim(),
      storage_capacity: (data.storage_capacity || '').trim(),
      color: (data.color || '').trim(),
      condition_grade: data.condition_grade || 'Brand New (Official)',
      battery_health: Number(data.battery_health || 100),
      warranty_type: data.warranty_type || 'Official 1-Year',
      purchase_cost: Number(data.purchase_cost || 0),
      selling_price: Number(data.selling_price || 0),
      status: 'In-Stock',
      image_url: cleanImg,
      created_at: new Date().toISOString()
    };

    await docRef.set(record);
    return record;
  },

  async updatePhone(idOrImei, data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const docRef = this.db.collection('phones').doc(String(idOrImei).trim());
    await docRef.update({ ...data, updated_at: new Date().toISOString() });
    return { success: true };
  },

  async deletePhone(idOrImei) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    await this.db.collection('phones').doc(String(idOrImei).trim()).delete();
    return { success: true };
  },

  async checkImei(imei) {
    const clean = String(imei || '').trim();
    if (!clean) return { exists: false };
    const found = this.cache.phones.find(p => p.imei_number === clean);
    if (found) {
      return { exists: true, phone: found };
    }
    if (this.isConfigured()) {
      const doc = await this.db.collection('phones').doc(clean).get();
      return { exists: doc.exists, phone: doc.exists ? doc.data() : null };
    }
    return { exists: false, phone: null };
  },

  // --- CATEGORIES ---
  async saveCategory(name) {
    const clean = name.trim();
    if (!clean) throw new Error('Category name required');
    const existing = this.cache.categories;
    if (existing.some(c => c.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Category already exists.');
    }
    const newCat = { id: Date.now(), name: clean };
    const updated = [...existing, newCat];
    this.cache.categories = updated;
    if (this.isConfigured()) {
      await this.db.collection('config').doc('categories').set({ list: updated });
    }
    return newCat;
  },

  // --- EMI COLLECTIONS ---
  async collectEmiPayment(orderId, paymentData) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const orderRef = this.db.collection('orders').doc(String(orderId));
    const nowIso = new Date().toISOString();

    return await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(orderRef);
      if (!doc.exists) throw new Error('Order not found');
      const oData = doc.data();

      const payAmount = Number(paymentData.amount || 0);
      const prevPaid = Number(oData.paid_amount || 0);
      const finalAmt = Number(oData.final_amount || 0);
      const newPaid = prevPaid + payAmount;
      const newDue = Math.max(0, finalAmt - newPaid);

      const paymentRecord = {
        id: 'PAY-' + Date.now(),
        order_id: String(orderId),
        amount_paid: payAmount,
        payment_method: paymentData.method || 'Cash',
        receipt_number: paymentData.receipt_number || ('REC-' + Date.now()),
        notes: paymentData.notes || '',
        payment_date: nowIso
      };

      const payments = oData.payments || [];
      payments.push(paymentRecord);

      transaction.update(orderRef, {
        paid_amount: newPaid,
        emi_remaining_due: newDue,
        payments: payments,
        updated_at: nowIso
      });

      return { success: true, payment: paymentRecord, remaining_due: newDue };
    });
  },

  // --- LOCAL TO CLOUD MIGRATION (1-Click Helper) ---
  async migrateFromLocalDB() {
    if (!this.isConfigured()) throw new Error('Connect Firebase first before migrating.');
    if (!window.MobileDB) throw new Error('No local database found.');

    const localItems = MobileDB._get(MobileDB.KEYS.ITEMS);
    const localPhones = MobileDB._get(MobileDB.KEYS.PHONES);
    const localCats = MobileDB.getCategories();
    const localOrders = MobileDB._get(MobileDB.KEYS.ORDERS);

    let count = 0;
    const batch = this.db.batch();

    // 1. Categories
    if (localCats.length) {
      batch.set(this.db.collection('config').doc('categories'), { list: localCats });
    }

    // 2. Accessories
    for (const item of localItems) {
      const ref = this.db.collection('items').doc(String(item.id || Date.now()));
      batch.set(ref, item, { merge: true });
      count++;
    }

    // 3. Phones
    for (const phone of localPhones) {
      const imei = String(phone.imei_number || phone.id).trim();
      if (imei) {
        const ref = this.db.collection('phones').doc(imei);
        batch.set(ref, phone, { merge: true });
        count++;
      }
    }

    // 4. Orders
    for (const order of localOrders) {
      const inv = String(order.invoice_number || order.id);
      const ref = this.db.collection('orders').doc(inv);
      batch.set(ref, order, { merge: true });
      count++;
    }

    await batch.commit();
    return { migratedCount: count };
  },

  // --- API DISPATCHER INTERCEPTOR ---
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
          return this._json(this.cache.categories);
        } else if (method === 'POST') {
          return this._json(await this.saveCategory(parsedBody.name), 201);
        }
      }

      // 2. Items (Accessories)
      if (pathname === '/api/items') {
        if (method === 'GET') {
          let items = [...this.cache.items];
          const search = (query.get('search') || '').toLowerCase();
          const category_id = query.get('category_id') || '';
          const low_stock = query.get('low_stock') === '1' || query.get('low_stock') === 'true';

          if (search) {
            items = items.filter(i => 
              (i.title && i.title.toLowerCase().includes(search)) || 
              (i.sku_or_barcode && i.sku_or_barcode.toLowerCase().includes(search))
            );
          }
          if (category_id) {
            items = items.filter(i => String(i.category_id) === String(category_id));
          }
          if (low_stock) {
            items = items.filter(i => Number(i.stock_quantity || 0) <= Number(i.min_alert_threshold || 5));
          }
          return this._json(items);
        } else if (method === 'POST') {
          return this._json(await this.addAccessory(parsedBody), 201);
        }
      }

      const itemAdjustMatch = pathname.match(/^\/api\/items\/([^/]+)\/adjust-stock$/);
      if (itemAdjustMatch && method === 'POST') {
        const id = itemAdjustMatch[1];
        return this._json(await this.adjustStock(id, parseInt(parsedBody.delta, 10) || 0, parsedBody.reason));
      }

      const itemMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
      if (itemMatch) {
        const id = itemMatch[1];
        if (method === 'GET') {
          const found = this.cache.items.find(i => String(i.id) === String(id));
          if (!found) return this._json({ error: 'Item not found' }, 404);
          return this._json(found);
        } else if (method === 'PUT') {
          return this._json(await this.updateAccessory(id, parsedBody));
        } else if (method === 'DELETE') {
          return this._json(await this.deleteAccessory(id));
        }
      }

      // 3. Out-of-Stock
      if (pathname === '/api/items/out-of-stock') {
        const type = query.get('type') || 'all';
        const search = (query.get('search') || '').toLowerCase();

        let outAccessories = this.cache.items
          .filter(i => Number(i.stock_quantity || 0) <= 0)
          .map(i => ({
            id: i.id,
            item_type: 'accessory',
            sku_or_barcode: i.sku_or_barcode,
            title: i.title,
            category_name: i.category_name || 'General',
            rack_location: i.rack_location || '-',
            cost_price: i.cost_price,
            selling_price: i.selling_price,
            stock_quantity: 0,
            min_alert_threshold: i.min_alert_threshold || 5,
            image_url: i.image_url
          }));

        let soldPhones = this.cache.phones
          .filter(p => p.status === 'Sold')
          .map(p => ({
            id: p.id || p.imei_number,
            item_type: 'phone',
            imei_number: p.imei_number,
            brand: p.brand,
            model: p.model,
            storage_capacity: p.storage_capacity,
            condition_grade: p.condition_grade,
            battery_health: p.battery_health,
            warranty_type: p.warranty_type,
            purchase_cost: p.purchase_cost,
            selling_price: p.selling_price,
            status: 'Sold',
            stock_quantity: 0,
            min_alert_threshold: 1,
            image_url: p.image_url,
            sold_at: p.sold_at
          }));

        let combined = [];
        if (type === 'all') combined = [...outAccessories, ...soldPhones];
        else if (type === 'accessories') combined = outAccessories;
        else if (type === 'phones') combined = soldPhones;

        if (search) {
          combined = combined.filter(i => {
            const name = i.title || (i.brand + ' ' + i.model);
            const code = i.sku_or_barcode || i.imei_number;
            return (name && name.toLowerCase().includes(search)) || (code && code.toLowerCase().includes(search));
          });
        }
        return this._json(combined);
      }

      // 4. Phones (IMEI Handsets)
      if (pathname === '/api/phones') {
        if (method === 'GET') {
          let phones = [...this.cache.phones];
          const search = (query.get('search') || '').toLowerCase();
          const status = query.get('status') || '';

          if (search) {
            phones = phones.filter(p => 
              (p.imei_number && p.imei_number.includes(search)) ||
              (p.brand && p.brand.toLowerCase().includes(search)) ||
              (p.model && p.model.toLowerCase().includes(search))
            );
          }
          if (status) {
            phones = phones.filter(p => p.status === status);
          }
          return this._json(phones);
        } else if (method === 'POST') {
          return this._json(await this.addPhone(parsedBody), 201);
        }
      }

      const imeiCheckMatch = pathname.match(/^\/api\/phones\/check-imei\/([^/]+)$/);
      if (imeiCheckMatch && method === 'GET') {
        const imei = decodeURIComponent(imeiCheckMatch[1]);
        return this._json(await this.checkImei(imei));
      }

      const phoneMatch = pathname.match(/^\/api\/phones\/([^/]+)$/);
      if (phoneMatch) {
        const id = decodeURIComponent(phoneMatch[1]);
        if (method === 'GET') {
          const found = this.cache.phones.find(p => p.imei_number === id || String(p.id) === id);
          if (!found) return this._json({ error: 'Phone not found' }, 404);
          return this._json(found);
        } else if (method === 'PUT') {
          return this._json(await this.updatePhone(id, parsedBody));
        } else if (method === 'DELETE') {
          return this._json(await this.deletePhone(id));
        }
      }

      // 5. POS Search
      if (pathname === '/api/pos/search') {
        const q = (query.get('q') || '').toLowerCase().trim();
        if (!q) return this._json([]);

        const results = [];
        this.cache.items.forEach(i => {
          if (Number(i.stock_quantity || 0) > 0) {
            const matches = (i.title && i.title.toLowerCase().includes(q)) || 
                            (i.sku_or_barcode && i.sku_or_barcode.toLowerCase().includes(q)) ||
                            (i.category_name && i.category_name.toLowerCase().includes(q));
            if (matches) {
              results.push({
                id: i.id,
                item_type: 'accessory',
                sku_or_imei: i.sku_or_barcode,
                title: i.title,
                category_name: i.category_name || 'General',
                unit_price: Number(i.selling_price || 0),
                unit_cost: Number(i.cost_price || 0),
                stock_quantity: Number(i.stock_quantity || 0),
                rack_location: i.rack_location || '-',
                image_url: i.image_url
              });
            }
          }
        });

        this.cache.phones.forEach(p => {
          if (p.status === 'In-Stock') {
            const matches = (p.imei_number && p.imei_number.includes(q)) ||
                            (p.brand && p.brand.toLowerCase().includes(q)) ||
                            (p.model && p.model.toLowerCase().includes(q));
            if (matches) {
              results.push({
                id: p.id || p.imei_number,
                item_type: 'phone',
                sku_or_imei: p.imei_number,
                title: (p.brand + ' ' + p.model + ' ' + (p.storage_capacity || '') + ' (' + (p.condition_grade || 'Standard') + ')').trim(),
                category_name: p.brand,
                unit_price: Number(p.selling_price || 0),
                unit_cost: Number(p.purchase_cost || 0),
                stock_quantity: 1,
                rack_location: '-',
                image_url: p.image_url
              });
            }
          }
        });

        return this._json(results.slice(0, 15));
      }

      // 6. Orders (Checkout & Invoices)
      if (pathname === '/api/orders') {
        if (method === 'POST') {
          const cart = parsedBody.items || [];
          const res = await this.executeCheckout(cart, parsedBody);
          return this._json(res, 201);
        } else if (method === 'GET') {
          return this._json(this.cache.orders);
        }
      }

      const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (orderMatch && method === 'GET') {
        const id = orderMatch[1];
        const found = this.cache.orders.find(o => String(o.id) === id || o.invoice_number === id);
        if (!found) return this._json({ error: 'Order not found' }, 404);
        return this._json(found);
      }

      // 7. EMI Collection
      if (pathname === '/api/emi/collect' && method === 'POST') {
        return this._json(await this.collectEmiPayment(parsedBody.order_id, parsedBody));
      }

      // 8. Reports Summary
      if (pathname === '/api/reports/summary') {
        const month = query.get('month') || '';
        const year = query.get('year') || '';
        let filtered = [...this.cache.orders];
        if (month && year) {
          filtered = filtered.filter(o => {
            const d = new Date(o.created_at);
            return (d.getMonth() + 1) === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
          });
        }
        const totalRevenue = filtered.reduce((sum, o) => sum + (Number(o.final_amount) || 0), 0);
        return this._json({
          sales: {
            total_orders: filtered.length,
            total_revenue: totalRevenue,
            total_cogs: 0,
            gross_profit: totalRevenue,
            profit_margin_pct: 100,
            items_sold: filtered.reduce((sum, o) => sum + (o.items ? o.items.length : 1), 0)
          },
          stock: {
            total_accessory_retail: this.cache.items.reduce((s, i) => s + (Number(i.selling_price) * Number(i.stock_quantity)), 0),
            total_accessory_cost: this.cache.items.reduce((s, i) => s + (Number(i.cost_price) * Number(i.stock_quantity)), 0)
          },
          handsets: {
            in_stock_count: this.cache.phones.filter(p => p.status === 'In-Stock').length,
            in_stock_cost_value: this.cache.phones.filter(p => p.status === 'In-Stock').reduce((s, p) => s + Number(p.purchase_cost || 0), 0),
            sold_count: this.cache.phones.filter(p => p.status === 'Sold').length
          }
        });
      }

      // Fallback
      if (window.MobileDB) {
        return MobileDB.handleApiRequest(urlStr, init);
      }
      return this._json({ error: 'Endpoint not found' }, 404);
    } catch (err) {
      console.error('FirebaseDB API Error:', err);
      return this._json({ error: err.message || 'Operation failed' }, 400);
    }
  },

  _json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

window.FirebaseDB = FirebaseDB;

document.addEventListener('DOMContentLoaded', () => {
  FirebaseDB.init().catch(console.error);
});
