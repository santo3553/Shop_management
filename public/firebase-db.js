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

      // Connect to project's custom database (e.g. 'default' instead of '(default)')
      const targetDb = config.databaseId || 'default';
      if (this.db && this.db._delegate && this.db._delegate._databaseId) {
        this.db._delegate._databaseId.database = targetDb;
      }

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
    (this.unsubscribers || []).forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
    this.unsubscribers = [];

    let hasCheckedAutoMigrate = false;

    // 1. Sync Accessories (items collection)
    const unsubItems = this.db.collection('items').onSnapshot(async (snapshot) => {
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      this.cache.items = items;
      this.syncState = snapshot.metadata.fromCache ? (navigator.onLine ? 'connected' : 'offline') : 'connected';
      this._updateStatusUI();
      this._notifyListeners('items', items);

      // Auto-upload local products if Firestore is fresh/empty
      if (!hasCheckedAutoMigrate && snapshot.empty && window.MobileDB) {
        hasCheckedAutoMigrate = true;
        const localItems = window.MobileDB._get(window.MobileDB.KEYS.ITEMS);
        const localPhones = window.MobileDB._get(window.MobileDB.KEYS.PHONES);
        if ((localItems && localItems.length > 0) || (localPhones && localPhones.length > 0)) {
          console.log('[FirebaseDB] Fresh cloud database detected. Auto-uploading local inventory...');
          try {
            await this.migrateFromLocalDB();
            console.log('[FirebaseDB] Auto-upload complete!');
          } catch (mErr) {
            console.warn('[FirebaseDB] Auto-upload note:', mErr);
          }
        }
      }
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
    (this.listeners || []).forEach(cb => {
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

      // Calculate financial totals
      let calculatedSubtotal = 0;
      let calculatedTotalCost = 0;
      const processedCart = cart.map(item => {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitPrice = Math.max(0, parseFloat(item.unit_price || item.selling_price) || 0);
        const unitCost = Math.max(0, parseFloat(item.unit_cost || item.cost_price) || 0);
        const lineTotal = Math.max(0, parseFloat(item.total_price) || (unitPrice * qty));
        calculatedSubtotal += lineTotal;
        calculatedTotalCost += (unitCost * qty);
        return {
          ...item,
          quantity: qty,
          unit_price: unitPrice,
          unit_cost: unitCost,
          total_price: lineTotal
        };
      });

      const discount = Math.max(0, parseFloat(orderDetails.discount || orderDetails.discount_amount) || 0);
      const subtotal = Math.max(0, parseFloat(orderDetails.subtotal) || calculatedSubtotal);
      const finalAmount = Math.max(0, parseFloat(orderDetails.final_amount || orderDetails.total_amount) || (subtotal - discount));
      const totalCost = Math.max(0, parseFloat(orderDetails.total_cost) || calculatedTotalCost);
      const profitMargin = finalAmount - totalCost;

      const isEmi = !!orderDetails.is_emi;
      let remainingDue = 0;
      let paidAmount = finalAmount;
      if (isEmi) {
        if (orderDetails.emi_type === 'Bank EMI') {
          remainingDue = 0;
          paidAmount = finalAmount;
        } else {
          const downPayment = Math.max(0, parseFloat(orderDetails.emi_down_payment) || 0);
          remainingDue = Math.max(0, finalAmount - downPayment);
          paidAmount = downPayment;
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
        subtotal: subtotal,
        discount: discount,
        discount_amount: discount,
        total_amount: finalAmount,
        final_amount: finalAmount,
        total_cost: totalCost,
        profit_margin: profitMargin,
        paid_amount: paidAmount,
        payment_method: orderDetails.payment_method || 'Cash',
        is_emi: isEmi,
        emi_type: orderDetails.emi_type || (isEmi ? 'Shop Installment' : 'Full Payment'),
        emi_tenure_months: Number(orderDetails.emi_tenure_months || 0),
        emi_monthly_amount: Number(orderDetails.emi_monthly_amount || 0),
        emi_remaining_due: remainingDue,
        emi_down_payment: Number(orderDetails.emi_down_payment || 0),
        items: processedCart,
        created_at: nowIso
      };

      transaction.set(orderRef, cleanOrder);

      return {
        ...cleanOrder,
        order_id: invoiceNumber,
        invoice_number: invoiceNumber,
        order: cleanOrder
      };
    });
  },

  /**
   * Soft-voids a sales invoice, logs audit trail, and restores stock
   */
  async voidOrder(orderId, voidDetails = {}) {
    const order = this.cache.orders.find(o => String(o.id) === String(orderId) || o.invoice_number === String(orderId));
    if (!order) throw new Error('Order not found');
    if (order.status === 'VOID') throw new Error('Invoice is already voided');

    const voidReason = voidDetails.reason || voidDetails.void_reason || 'Cancelled by Store Authority';
    const nowIso = new Date().toISOString();

    // 1. If Firebase active, update Firestore
    if (this.db) {
      const batch = this.db.batch();
      const orderRef = this.db.collection('orders').doc(order.invoice_number || String(order.id));
      batch.update(orderRef, {
        status: 'VOID',
        voided_at: nowIso,
        void_reason: voidReason,
        voided_by: 'Owner'
      });

      // Restore sold products
      const items = Array.isArray(order.items) ? order.items : [];
      for (const it of items) {
        const isPhone = it.item_type === 'phone' || !!it.imei_number;
        if (isPhone) {
          const phoneId = it.imei_number || it.sku_or_imei || it.id;
          if (phoneId) {
            const phoneRef = this.db.collection('phones').doc(String(phoneId));
            batch.update(phoneRef, {
              status: 'In-Stock',
              sold_at: null,
              order_id: null
            });
          }
        } else if (it.id) {
          const accRef = this.db.collection('items').doc(String(it.id));
          const currentAcc = this.cache.items.find(a => String(a.id) === String(it.id));
          const newQty = (currentAcc ? Number(currentAcc.stock_quantity || 0) : 0) + (Number(it.quantity) || 1);
          batch.update(accRef, { stock_quantity: newQty });
        }
      }
      await batch.commit();
    }

    // 2. Update local cache
    order.status = 'VOID';
    order.voided_at = nowIso;
    order.void_reason = voidReason;
    order.voided_by = 'Owner';

    const items = Array.isArray(order.items) ? order.items : [];
    for (const it of items) {
      const isPhone = it.item_type === 'phone' || !!it.imei_number;
      if (isPhone) {
        const phone = this.cache.phones.find(p => p.imei_number === (it.imei_number || it.sku_or_imei) || String(p.id) === String(it.id));
        if (phone) {
          phone.status = 'In-Stock';
          delete phone.sold_at;
          delete phone.order_id;
        }
      } else {
        const acc = this.cache.items.find(a => String(a.id) === String(it.id));
        if (acc) {
          acc.stock_quantity = (Number(acc.stock_quantity) || 0) + (Number(it.quantity) || 1);
        }
      }
    }

    // Also update MobileDB if available
    if (window.MobileDB) {
      try {
        window.MobileDB.voidOrder(order.id || order.invoice_number, { reason: voidReason });
      } catch (_) {}
    }

    // Log security audit event
    if (window.AuthSecurity) {
      await window.AuthSecurity.logAudit('INVOICE_VOIDED', {
        invoice_number: order.invoice_number,
        total_amount: order.total_amount || order.final_amount,
        reason: voidReason
      });
    }

    return {
      success: true,
      message: `Invoice ${order.invoice_number} voided and inventory replenished.`,
      order
    };
  },

  /**
   * Generates a complete database snapshot for backup
   */
  exportFullDatabase() {
    return {
      format: 'BIPLOB_SHOP_POS_BACKUP',
      version: '2.0',
      timestamp: new Date().toISOString(),
      counts: {
        items: this.cache.items.length,
        phones: this.cache.phones.length,
        categories: this.cache.categories.length,
        orders: this.cache.orders.length
      },
      items: this.cache.items,
      phones: this.cache.phones,
      categories: this.cache.categories,
      orders: this.cache.orders
    };
  },

  /**
   * Restores full database snapshot from backup file
   */
  async restoreFullDatabase(backupData) {
    if (!backupData || (!backupData.items && !backupData.phones)) {
      throw new Error('Invalid backup format: missing items or phones data');
    }

    if (Array.isArray(backupData.items)) this.cache.items = backupData.items;
    if (Array.isArray(backupData.phones)) this.cache.phones = backupData.phones;
    if (Array.isArray(backupData.categories)) this.cache.categories = backupData.categories;
    if (Array.isArray(backupData.orders)) this.cache.orders = backupData.orders;

    if (this.db) {
      for (const item of (backupData.items || [])) {
        if (item.id) await this.db.collection('items').doc(String(item.id)).set(item, { merge: true });
      }
      for (const phone of (backupData.phones || [])) {
        const id = phone.imei_number || phone.id;
        if (id) await this.db.collection('phones').doc(String(id)).set(phone, { merge: true });
      }
      for (const order of (backupData.orders || [])) {
        const id = order.invoice_number || order.id;
        if (id) await this.db.collection('orders').doc(String(id)).set(order, { merge: true });
      }
    }

    if (window.MobileDB) {
      if (Array.isArray(backupData.items)) window.MobileDB._set(window.MobileDB.KEYS.ITEMS, backupData.items);
      if (Array.isArray(backupData.phones)) window.MobileDB._set(window.MobileDB.KEYS.PHONES, backupData.phones);
      if (Array.isArray(backupData.categories)) window.MobileDB._set(window.MobileDB.KEYS.CATEGORIES, backupData.categories);
      if (Array.isArray(backupData.orders)) window.MobileDB._set(window.MobileDB.KEYS.ORDERS, backupData.orders);
    }

    if (window.AuthSecurity) {
      await window.AuthSecurity.logAudit('DATABASE_RESTORED', {
        restored_items: (backupData.items || []).length,
        restored_phones: (backupData.phones || []).length,
        restored_orders: (backupData.orders || []).length
      });
    }

    return {
      success: true,
      restoredCount: (backupData.items || []).length + (backupData.phones || []).length + (backupData.orders || []).length
    };
  },

  // --- ACCESSORY OPERATIONS ---
  async addAccessory(data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const docId = String(Date.now());
    const rawImg = data.image_url || data.image || '';
    const cleanImg = await this.compressImageToWebP(rawImg);

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
      image: cleanImg,
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
    const rawImg = updates.image || updates.image_url;
    if (rawImg && rawImg.startsWith('data:')) {
      const cleanImg = await this.compressImageToWebP(rawImg);
      updates.image = cleanImg;
      updates.image_url = cleanImg;
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

    const rawImg = data.image_url || data.image || '';
    const cleanImg = await this.compressImageToWebP(rawImg);

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
      image: cleanImg,
      image_url: cleanImg,
      created_at: new Date().toISOString()
    };

    await docRef.set(record);
    return record;
  },

  async updatePhone(idOrImei, data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const updates = { ...data, updated_at: new Date().toISOString() };
    const rawImg = updates.image || updates.image_url;
    if (rawImg && rawImg.startsWith('data:')) {
      const cleanImg = await this.compressImageToWebP(rawImg);
      updates.image = cleanImg;
      updates.image_url = cleanImg;
    }
    const docRef = this.db.collection('phones').doc(String(idOrImei).trim());
    await docRef.update(updates);
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

  // --- LOCAL TO CLOUD MIGRATION (1-Click Helper & Auto-Upload) ---
  async migrateFromLocalDB() {
    if (!this.isConfigured()) throw new Error('Connect Firebase first before migrating.');
    if (!window.MobileDB) throw new Error('No local database found.');

    const localItems = window.MobileDB._get(window.MobileDB.KEYS.ITEMS) || [];
    const localPhones = window.MobileDB._get(window.MobileDB.KEYS.PHONES) || [];
    const localCats = window.MobileDB.getCategories() || [];
    const localOrders = window.MobileDB._get(window.MobileDB.KEYS.ORDERS) || [];

    let count = 0;
    const batch = this.db.batch();

    // 1. Categories
    if (localCats.length) {
      batch.set(this.db.collection('config').doc('categories'), { list: localCats }, { merge: true });
    }

    // 2. Accessories
    for (const item of localItems) {
      const docId = String(item.id || Date.now());
      const cleanImg = item.image || item.image_url || '';
      const cleanItem = {
        id: docId,
        sku_or_barcode: (item.sku_or_barcode || '').trim(),
        title: (item.title || '').trim(),
        category_id: item.category_id || '',
        category_name: item.category_name || 'General',
        cost_price: Number(item.cost_price || 0),
        selling_price: Number(item.selling_price || 0),
        stock_quantity: Number(item.stock_quantity || 0),
        min_alert_threshold: Number(item.min_alert_threshold || 5),
        rack_location: (item.rack_location || '-').trim(),
        image: cleanImg,
        image_url: cleanImg,
        is_active: 1,
        created_at: item.created_at || new Date().toISOString()
      };
      const ref = this.db.collection('items').doc(docId);
      batch.set(ref, cleanItem, { merge: true });
      count++;
    }

    // 3. Phones
    for (const phone of localPhones) {
      const imei = String(phone.imei_number || phone.id).trim();
      if (imei) {
        const cleanImg = phone.image || phone.image_url || '';
        const cleanPhone = {
          id: imei,
          imei_number: imei,
          brand: (phone.brand || '').trim(),
          model: (phone.model || '').trim(),
          storage_capacity: (phone.storage_capacity || '').trim(),
          color: (phone.color || '').trim(),
          condition_grade: phone.condition_grade || 'Brand New (Official)',
          battery_health: Number(phone.battery_health || 100),
          warranty_type: phone.warranty_type || 'Official 1-Year',
          purchase_cost: Number(phone.purchase_cost || 0),
          selling_price: Number(phone.selling_price || 0),
          status: phone.status || 'In-Stock',
          image: cleanImg,
          image_url: cleanImg,
          created_at: phone.created_at || new Date().toISOString()
        };
        const ref = this.db.collection('phones').doc(imei);
        batch.set(ref, cleanPhone, { merge: true });
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

    if (count > 0 || localCats.length > 0) {
      await batch.commit();
    }
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

      // 3. Out-of-Stock (Must be evaluated before /api/items/:id)
      if (pathname === '/api/items/out-of-stock' || pathname === '/api/items/out-of-stock/') {
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

      const itemMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
      if (itemMatch && itemMatch[1] !== 'out-of-stock') {
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

        const mapAcc = (i) => ({
          id: i.id,
          code: i.sku_or_barcode || '',
          sku_or_imei: i.sku_or_barcode || '',
          title: i.title || '',
          category_id: i.category_id || '',
          category_name: i.category_name || 'General',
          type: 'accessory',
          item_type: 'accessory',
          selling_price: parseFloat(i.selling_price) || 0,
          unit_price: parseFloat(i.selling_price) || 0,
          cost_price: parseFloat(i.cost_price) || 0,
          unit_cost: parseFloat(i.cost_price) || 0,
          stock_quantity: parseInt(i.stock_quantity, 10) || 0,
          rack_location: i.rack_location || '-',
          image: i.image || i.image_url || '',
          image_url: i.image || i.image_url || ''
        });

        const mapPhone = (p) => ({
          id: p.id || p.imei_number,
          code: p.imei_number || '',
          sku_or_imei: p.imei_number || '',
          title: `${p.brand || ''} ${p.model || ''} ${p.storage_capacity ? '(' + p.storage_capacity + ')' : ''}`.trim(),
          category_id: null,
          category_name: p.brand || 'Handset',
          type: 'phone',
          item_type: 'phone',
          selling_price: parseFloat(p.selling_price) || 0,
          unit_price: parseFloat(p.selling_price) || 0,
          cost_price: parseFloat(p.purchase_cost) || 0,
          unit_cost: parseFloat(p.purchase_cost) || 0,
          stock_quantity: 1,
          condition_grade: p.condition_grade || 'Brand New (Official)',
          battery_health: p.battery_health || 100,
          warranty_type: p.warranty_type || 'Official 1-Year',
          status: p.status || 'In-Stock',
          rack_location: '-',
          image: p.image || p.image_url || '',
          image_url: p.image || p.image_url || ''
        });

        const inStockAccessories = this.cache.items
          .filter(i => Number(i.stock_quantity || 0) > 0)
          .map(mapAcc);

        const inStockPhones = this.cache.phones
          .filter(p => p.status === 'In-Stock')
          .map(mapPhone);

        if (!q) {
          return this._json([...inStockAccessories, ...inStockPhones]);
        }

        // Exact code match
        const exactPhone = inStockPhones.find(p => p.code.toLowerCase() === q);
        if (exactPhone) return this._json([exactPhone]);

        const exactAcc = inStockAccessories.find(a => a.code.toLowerCase() === q);
        if (exactAcc) return this._json([exactAcc]);

        // Fuzzy matches
        const filteredAcc = inStockAccessories.filter(a =>
          a.title.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          a.category_name.toLowerCase().includes(q)
        );
        const filteredPhones = inStockPhones.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category_name.toLowerCase().includes(q)
        );

        return this._json([...filteredAcc, ...filteredPhones]);
      }

      // 6. Orders (Checkout & Invoices)
      if (pathname === '/api/orders') {
        if (method === 'POST') {
          const cart = parsedBody.items || [];
          const res = await this.executeCheckout(cart, parsedBody);
          return this._json(res, 201);
        } else if (method === 'GET') {
          const search = (query.get('search') || '').toLowerCase();
          const isEmi = query.get('is_emi');
          let orders = [...this.cache.orders];
          if (isEmi === '1' || isEmi === 'true') {
            orders = orders.filter(o => !!o.is_emi);
          }
          if (search) {
            orders = orders.filter(o =>
              (o.invoice_number && o.invoice_number.toLowerCase().includes(search)) ||
              (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
              (o.customer_phone && o.customer_phone.includes(search))
            );
          }
          return this._json(orders);
        }
      }

      // 6b. Active EMI Orders
      if (pathname === '/api/emi/orders' && method === 'GET') {
        const search = (query.get('search') || '').toLowerCase();
        let orders = this.cache.orders.filter(o => o.is_emi && (o.emi_type === 'Shop Installment' || !o.emi_type));
        if (search) {
          orders = orders.filter(o =>
            (o.invoice_number && o.invoice_number.toLowerCase().includes(search)) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
            (o.customer_phone && o.customer_phone.includes(search))
          );
        }
        return this._json(orders);
      }

      const voidMatch = pathname.match(/^\/api\/orders\/([^/]+)\/void$/);
      if (voidMatch && method === 'POST') {
        const id = voidMatch[1];
        return this._json(await this.voidOrder(id, parsedBody));
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
        let filtered = this.cache.orders.filter(o => o.status !== 'VOID');
        if (month && year) {
          filtered = filtered.filter(o => {
            if (!o.created_at) return false;
            const d = new Date(o.created_at);
            return (d.getMonth() + 1) === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
          });
        }

        let totalRevenue = 0;
        let totalCogs = 0;
        let itemsSold = 0;
        const accSalesMap = {};

        filtered.forEach(o => {
          const items = Array.isArray(o.items) ? o.items : [];
          const calculatedSubtotal = items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.unit_price || 0) * Number(it.quantity || 1))), 0);
          const orderDiscount = Number(o.discount || o.discount_amount || 0);
          const orderRevenue = Number(o.total_amount || o.final_amount) || Math.max(0, calculatedSubtotal - orderDiscount);
          totalRevenue += orderRevenue;

          const calculatedCost = items.reduce((s, it) => s + (Number(it.unit_cost || it.cost_price || 0) * Number(it.quantity || 1)), 0);
          const orderCost = Number(o.total_cost) || calculatedCost;
          totalCogs += orderCost;

          items.forEach(it => {
            const qty = Number(it.quantity || 1);
            itemsSold += qty;
            const title = it.title || it.name || 'Product';
            const sku = it.sku_or_imei || it.code || '-';
            const lineRev = Number(it.total_price) || (Number(it.unit_price || 0) * qty);

            if (!accSalesMap[title]) {
              accSalesMap[title] = { title, sku_or_imei: sku, units_sold: 0, revenue: 0 };
            }
            accSalesMap[title].units_sold += qty;
            accSalesMap[title].revenue += lineRev;
          });
        });

        const grossProfit = totalRevenue - totalCogs;
        const profitMarginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
        const topAccessories = Object.values(accSalesMap).sort((a, b) => b.units_sold - a.units_sold).slice(0, 10);

        const inStockPhones = this.cache.phones.filter(p => p.status === 'In-Stock');
        const inStockCost = inStockPhones.reduce((s, p) => s + Number(p.purchase_cost || 0), 0);
        const soldPhones = this.cache.phones.filter(p => p.status === 'Sold');

        const totalAccRetail = this.cache.items.reduce((s, i) => s + (Number(i.selling_price || 0) * Number(i.stock_quantity || 0)), 0);
        const totalAccCost = this.cache.items.reduce((s, i) => s + (Number(i.cost_price || 0) * Number(i.stock_quantity || 0)), 0);

        return this._json({
          sales: {
            total_orders: filtered.length,
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
        });
      }

      // 9. Cloud CSV Exports
      if (pathname === '/api/reports/export/inventory.csv') {
        const items = this.cache.items;
        const phones = this.cache.phones;
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
        let orders = this.cache.orders.filter(o => o.status !== 'VOID');
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

      // 10. Database Backup & Restore API
      if (pathname === '/api/backup/export' && method === 'GET') {
        return this._json(this.exportFullDatabase());
      }

      if (pathname === '/api/backup/restore' && method === 'POST') {
        return this._json(await this.restoreFullDatabase(parsedBody));
      }

      if (pathname === '/api/reports/export/outofstock.csv') {
        const outAccessories = this.cache.items.filter(i => Number(i.stock_quantity || 0) <= 0);
        const soldPhones = this.cache.phones.filter(p => p.status === 'Sold');
        let csv = '\uFEFFItem Type,SKU or IMEI,Product Name / Model,Category or Brand,Tak / Location,Cost Price (BDT),Selling Price (BDT),Current Stock,Min Alert Limit,Suggested Reorder Qty\r\n';
        for (const i of outAccessories) {
          const cost = Number(i.cost_price || 0).toFixed(2);
          const price = Number(i.selling_price || 0).toFixed(2);
          const alert = i.min_alert_threshold || 5;
          const reorder = Math.max(10, alert * 2);
          csv += `"Accessory","${i.sku_or_barcode || ''}","${(i.title || '').replace(/"/g, '""')}","${(i.category_name || 'General').replace(/"/g, '""')}","${(i.rack_location || '-').replace(/"/g, '""')}",${cost},${price},"0",${alert},${reorder}\r\n`;
        }
        for (const p of soldPhones) {
          const cost = Number(p.purchase_cost || 0).toFixed(2);
          const price = Number(p.selling_price || 0).toFixed(2);
          const name = `${p.brand || ''} ${p.model || ''} ${p.storage_capacity || ''} (${p.condition_grade || 'Pre-Owned'})`;
          csv += `"Mobile Handset","${p.imei_number || ''}","${name.replace(/"/g, '""')}","${p.brand || ''}","-",${cost},${price},"0 (Sold)",1,1\r\n`;
        }
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="outofstock-products-${Date.now()}.csv"`
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
