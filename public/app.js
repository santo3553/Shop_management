/* =========================================================
   BIPLOB SHOP - FRONTEND APPLICATION JAVASCRIPT
========================================================= */

// Native Mobile / Capacitor Safe Area Inset Initialization
(function initMobileSafeArea() {
  const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const isMobileScreen = window.innerWidth <= 768;
  if (isCapacitor || (isMobileScreen && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))) {
    document.documentElement.classList.add('is-native-mobile');
    const updateInsets = () => {
      const currentTop = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top');
      if (!currentTop || currentTop.trim() === '' || currentTop.trim() === '0px') {
        document.documentElement.style.setProperty('--safe-area-inset-top', '36px');
      }
    };
    updateInsets();
    setTimeout(updateInsets, 100);
    setTimeout(updateInsets, 500);
  }
})();

// Global State
const state = {
  activeTab: 'pos',
  inventorySubTab: 'accessories',
  cart: [],
  discount: 0,
  paymentMethod: 'Cash',
  categories: [],
  posCatalog: [],
  posFilter: 'all',
  editingItemId: null,
  editingPhoneId: null
};

// Audio chime for barcode scan and sale completion (Web Audio API - no external file needed)
function playBeep(freq = 880, type = 'sine', duration = 0.08) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

// Show Toast Notification
function showToast(message, icon = '✅') {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;
  toastIcon.textContent = icon;

  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// Modal Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  try {
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  } catch (err) {
    console.warn(`openModal(${id}) notice:`, err);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  try {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  } catch (err) {
    modal.removeAttribute('open');
  }
}

function openFabQuickActions() {
  openModal('modalFabActions');
}

// Auto-dismiss dialog when clicking on backdrop
document.addEventListener('click', (e) => {
  if (e.target && e.target.tagName === 'DIALOG' && e.target.hasAttribute('open')) {
    const rect = e.target.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      if (e.target.id === 'modalPinChallenge' && window.AuthSecurity) {
        window.AuthSecurity.closePinModal();
      } else if (typeof e.target.close === 'function') {
        e.target.close();
      } else {
        e.target.removeAttribute('open');
      }
    }
  }
});

// Number & Currency Formatting
function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return '৳ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =========================================================
   TAB SWITCHING & NAVIGATION
========================================================= */
async function switchTab(tabName) {
  if (tabName === 'reports' && window.AuthSecurity && !window.AuthSecurity.isOwner()) {
    const unlocked = await window.AuthSecurity.requestOwnerRole();
    if (!unlocked) {
      showToast('Owner PIN required to view Business Reports & Profit Analytics.', '🔒');
      return;
    }
  }

  state.activeTab = tabName;

  // Update dynamic header subtitle (concise to prevent truncation)
  const subTitleEl = document.getElementById('appHeaderSubtitle');
  if (subTitleEl) {
    const subtitles = {
      pos: 'POS Terminal',
      inventory: 'Inventory Stock',
      orders: 'Sales & Invoices',
      reports: 'Reports & Analytics'
    };
    subTitleEl.textContent = subtitles[tabName] || 'POS Terminal';
  }

  // Update desktop nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'text-blue-600', 'font-bold');
    btn.classList.add('text-gray-500', 'font-medium');
  });

  const activeBtn = document.getElementById(`tabBtn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'text-blue-600', 'font-bold');
    activeBtn.classList.remove('text-gray-500', 'font-medium');
  }

  // Update mobile bottom nav buttons
  document.querySelectorAll('.mob-tab-btn').forEach(btn => {
    btn.classList.remove('text-blue-600', 'font-bold');
    btn.classList.add('text-gray-400', 'hover:text-blue-600', 'font-medium');
    const pill = btn.querySelector('.mob-tab-icon-pill');
    if (pill) {
      pill.classList.remove('bg-blue-50', 'text-blue-600');
      pill.classList.add('text-gray-400');
    }
    const label = btn.querySelector('span');
    if (label) {
      label.classList.remove('font-bold', 'text-blue-600');
      label.classList.add('font-medium', 'text-gray-400');
    }
  });

  const activeMobBtn = document.getElementById(`mobTab-${tabName}`);
  if (activeMobBtn) {
    activeMobBtn.classList.remove('text-gray-400', 'hover:text-blue-600', 'font-medium');
    activeMobBtn.classList.add('text-blue-600', 'font-bold');
    const pill = activeMobBtn.querySelector('.mob-tab-icon-pill');
    if (pill) {
      pill.classList.add('bg-blue-50', 'text-blue-600');
      pill.classList.remove('text-gray-400');
    }
    const label = activeMobBtn.querySelector('span');
    if (label) {
      label.classList.remove('font-medium', 'text-gray-400');
      label.classList.add('font-bold', 'text-blue-600');
    }
  }

  // Update view panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.add('hidden');
    pane.classList.remove('active');
  });

  const activePane = document.getElementById(`tab-${tabName}`);
  if (activePane) {
    activePane.classList.remove('hidden');
    activePane.classList.add('active');
  }

  // Load relevant data on tab activate
  if (tabName === 'pos') {
    loadPosCatalog();
    setTimeout(() => document.getElementById('posSearchInput').focus(), 50);
  } else if (tabName === 'inventory') {
    if (state.inventorySubTab === 'accessories') {
      loadAccessoriesTable();
    } else if (state.inventorySubTab === 'phones') {
      loadPhonesTable();
    } else if (state.inventorySubTab === 'outofstock') {
      loadOutOfStockTable();
    }
    updateOutOfStockBadge();
  } else if (tabName === 'orders') {
    loadOrdersTable();
  } else if (tabName === 'reports') {
    loadReports();
  }
}

function switchInventorySubTab(subTab) {
  state.inventorySubTab = subTab;
  const btnAcc = document.getElementById('subTabBtn-accessories');
  const btnPhone = document.getElementById('subTabBtn-phones');
  const btnOutOfStock = document.getElementById('subTabBtn-outofstock');
  const viewAcc = document.getElementById('subView-accessories');
  const viewPhone = document.getElementById('subView-phones');
  const viewOutOfStock = document.getElementById('subView-outofstock');
  const btnAddText = document.getElementById('btnAddItemText');

  btnAcc.className = 'px-3.5 py-2 text-xs md:text-sm font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center space-x-2 transition';
  btnPhone.className = 'px-3.5 py-2 text-xs md:text-sm font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center space-x-2 transition';
  if (btnOutOfStock) {
    btnOutOfStock.className = 'px-3.5 py-2 text-xs md:text-sm font-bold rounded-lg bg-gray-100 text-red-700 hover:bg-red-50 flex items-center space-x-2 border border-transparent hover:border-red-200 transition';
  }

  viewAcc.classList.add('hidden');
  viewPhone.classList.add('hidden');
  if (viewOutOfStock) viewOutOfStock.classList.add('hidden');

  if (subTab === 'accessories') {
    btnAcc.className = 'px-3.5 py-2 text-xs md:text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-sm flex items-center space-x-2 transition';
    viewAcc.classList.remove('hidden');
    btnAddText.textContent = 'Add Accessory';
    loadAccessoriesTable();
  } else if (subTab === 'phones') {
    btnPhone.className = 'px-3.5 py-2 text-xs md:text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-sm flex items-center space-x-2 transition';
    viewPhone.classList.remove('hidden');
    btnAddText.textContent = 'Add Handset (IMEI)';
    loadPhonesTable();
  } else if (subTab === 'outofstock') {
    if (btnOutOfStock) {
      btnOutOfStock.className = 'px-3.5 py-2 text-xs md:text-sm font-bold rounded-lg bg-red-600 text-white shadow-sm flex items-center space-x-2 border border-red-700 transition';
    }
    if (viewOutOfStock) viewOutOfStock.classList.remove('hidden');
    btnAddText.textContent = 'Add Product';
    loadOutOfStockTable();
  }
  updateOutOfStockBadge();
}

/* =========================================================
   CATEGORY MANAGEMENT
========================================================= */
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    state.categories = Array.isArray(data) ? data : [];

    // Populate Category filter in Inventory
    const invCatFilter = document.getElementById('invCatFilter');
    if (invCatFilter) {
      invCatFilter.innerHTML = '<option value="">All Categories</option>' +
        state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Populate Item Modal category select
    const itemCatSelect = document.getElementById('itemCategory');
    if (itemCatSelect) {
      itemCatSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Populate POS Category Pills
    renderPosCategoryPills();
  } catch (err) {
    console.error('Failed to load categories:', err);
    if (!Array.isArray(state.categories)) state.categories = [];
    renderPosCategoryPills();
  }
}

function renderPosCategoryPills() {
  const container = document.getElementById('posCategoryPills');
  if (!container) return;
  let html = `
    <button onclick="filterPosCatalog('all')" class="cat-pill ${state.posFilter === 'all' ? 'active bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium'} px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition">
      All Items
    </button>
    <button onclick="filterPosCatalog('phone')" class="cat-pill ${state.posFilter === 'phone' ? 'active bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium'} px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap flex items-center space-x-1 transition">
      <span>📱 Mobile Handsets</span>
    </button>
  `;

  (state.categories || []).forEach(cat => {
    const active = String(state.posFilter) === String(cat.id);
    html += `
      <button onclick="filterPosCatalog('${cat.id}')" class="cat-pill ${active ? 'active bg-blue-600 text-white font-bold' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium'} px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition">
        ${cat.name}
      </button>
    `;
  });

  container.innerHTML = html;
}

function filterPosCatalog(filterId) {
  state.posFilter = String(filterId);

  // If there's an existing search input value, clear it so user sees the category catalog
  const posInput = document.getElementById('posSearchInput');
  if (posInput && posInput.value.trim()) {
    posInput.value = '';
    loadPosCatalog();
    return;
  }

  renderPosCategoryPills();
  renderPosCatalog();
}

/* =========================================================
   POS MODULE (SEARCH, CATALOG & SCANNER)
========================================================= */
async function loadPosCatalog(query = '') {
  try {
    const url = query ? `/api/pos/search?q=${encodeURIComponent(query)}` : '/api/pos/search';
    const res = await fetch(url);
    const items = await res.json();
    state.posCatalog = items;
    renderPosCatalog();
  } catch (err) {
    console.error('Error loading POS catalog:', err);
  }
}

function renderPosCatalog() {
  const grid = document.getElementById('posProductGrid');
  const countDisplay = document.getElementById('posCatalogCount');

  let items = state.posCatalog;

  // Apply active category pill filter
  if (state.posFilter === 'phone') {
    items = items.filter(i => i.type === 'phone');
  } else if (state.posFilter !== 'all') {
    const activeCat = state.categories.find(c => String(c.id) === String(state.posFilter));
    const isUsedPhoneCat = activeCat && activeCat.name.toLowerCase() === 'used phones';

    if (isUsedPhoneCat) {
      items = items.filter(i =>
        (i.type === 'phone' && (!i.condition_grade || !i.condition_grade.includes('Brand New'))) ||
        (i.type === 'accessory' && String(i.category_id) === String(state.posFilter))
      );
    } else {
      items = items.filter(i => i.type === 'accessory' && String(i.category_id) === String(state.posFilter));
    }
  }

  countDisplay.textContent = `CATALOG (${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'})`;

  if (items.length === 0) {
    let emptyMsg = 'No items found.';
    if (state.posFilter === 'phone') {
      emptyMsg = 'No mobile handsets currently in stock.';
    } else if (state.posFilter !== 'all') {
      const activeCat = state.categories.find(c => String(c.id) === String(state.posFilter));
      emptyMsg = `No items found in "${activeCat ? activeCat.name : 'this category'}".`;
    }

    grid.innerHTML = `
      <div class="col-span-2 text-center py-12 text-gray-400">
        <p class="font-medium">${emptyMsg}</p>
        <p class="text-xs mt-1">Select "All Items" or add items to this category in the Inventory tab.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const isPhone = item.type === 'phone';
    const isOutOfStock = item.stock_quantity <= 0;

    let badge = '';
    if (isPhone) {
      const isBrandNew = item.condition_grade && item.condition_grade.includes('Brand New');
      if (isBrandNew) {
        badge = `
          <span class="inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            ✨ Brand New
          </span>
          <span class="inline-flex items-center text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full" title="${item.warranty_type || 'Official 1-Year'}">
            🛡️ ${item.warranty_type ? item.warranty_type.replace('Brand Warranty', 'Warranty').replace('Shop Service Warranty', 'Shop').slice(0, 16) : '1-Yr'}
          </span>
        `;
      } else {
        const gradeColor = item.condition_grade.includes('A') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
        badge = `
          <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${gradeColor}">
            ${item.condition_grade}
          </span>
          <span class="inline-flex items-center text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            🔋 ${item.battery_health}%
          </span>
        `;
      }
    } else {
      badge = `
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${item.stock_quantity <= 3 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
          ${item.stock_quantity <= 0 ? 'Out of stock' : `Stock: ${item.stock_quantity}`}
        </span>
      `;
    }

    return `
      <div
        onclick="handleCatalogItemClick('${item.id}', '${item.type}')"
        class="modern-card p-3.5 cursor-pointer hover:border-blue-500 hover:shadow-md transition relative flex flex-col justify-between active:scale-[0.99] ${isOutOfStock ? 'opacity-50 pointer-events-none bg-gray-50' : 'bg-white'}"
      >
        <div>
          <div class="flex items-start justify-between gap-1 mb-2">
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
              ${item.code}
            </span>
            <div class="flex items-center space-x-1">
              ${badge}
            </div>
          </div>
          <div class="flex items-center space-x-3 my-1">
            ${item.image ? `
              <img src="${item.image}" alt="" class="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0 shadow-xs">
            ` : `
              <div class="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl flex-shrink-0 text-gray-400">
                ${isPhone ? '📱' : '📦'}
              </div>
            `}
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 leading-snug">${item.title}</h4>
              ${item.rack_location ? `<span class="tag-location mt-1 inline-block">📍 ${item.rack_location}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-gray-400 block font-medium">Price</span>
            <span class="font-black text-blue-600 text-sm sm:text-base">${formatMoney(item.selling_price)}</span>
          </div>
          <button type="button" onclick="event.stopPropagation(); handleCatalogItemClick('${item.id}', '${item.type}')" class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center space-x-1 shadow-sm cursor-pointer active:scale-95">
            <span>+ Add</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleCatalogItemClick(id, type) {
  const catalog = state.posCatalog || [];
  const item = catalog.find(i => String(i.id) === String(id) && (type ? i.type === type : true)) ||
               catalog.find(i => String(i.id) === String(id) || String(i.code) === String(id));
  if (item) {
    addToCart(item);
  } else {
    console.warn('Item not found in posCatalog for id:', id, 'type:', type, catalog);
  }
}

// Scanner Input Event Handling (Rapid barcode / IMEI scanning)
document.addEventListener('DOMContentLoaded', () => {
  const posInput = document.getElementById('posSearchInput');
  if (!posInput) return;

  posInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = posInput.value.trim();
      if (!query) return;

      try {
        // Direct search on server
        const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
        const results = await res.json();

        if (results.length > 0) {
          // If exact match or multiple, select the best match
          const exactCodeMatch = results.find(r => r.code.toLowerCase() === query.toLowerCase());
          const target = exactCodeMatch || results[0];

          addToCart(target);
          posInput.value = '';
          loadPosCatalog(); // Reset catalog view
        } else {
          showToast(`No item found matching "${query}"`, '⚠️');
        }
      } catch (err) {
        showToast('Error searching item', '❌');
      }
    }
  });

  // Debounced typing search for quick live filtering
  let searchTimer;
  posInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = posInput.value.trim();
      if (q && state.posFilter !== 'all') {
        state.posFilter = 'all';
        renderPosCategoryPills();
      }
      loadPosCatalog(q);
    }, 200);
  });
});

/* =========================================================
   CART MANAGEMENT
========================================================= */
function addToCart(product) {
  playBeep(880, 'sine', 0.06);

  if (product.type === 'phone') {
    // Check if handset already in cart
    const exists = state.cart.find(c => c.type === 'phone' && String(c.id) === String(product.id));
    if (exists) {
      showToast('This serialized handset (IMEI) is already in the cart.', '⚠️');
      return;
    }

    state.cart.push({
      id: product.id,
      type: 'phone',
      title: product.title,
      code: product.code,
      condition_grade: product.condition_grade || 'Brand New (Sealed)',
      battery_health: product.battery_health || 100,
      warranty_type: product.warranty_type || 'Official 1-Year',
      unit_price: parseFloat(product.selling_price) || 0,
      unit_cost: parseFloat(product.cost_price) || 0,
      quantity: 1,
      max_stock: 1,
      image: product.image || ''
    });

    showToast(`Added handset ${product.title}`);
  } else {
    // Accessory item
    const existingIndex = state.cart.findIndex(c => c.type === 'accessory' && String(c.id) === String(product.id));

    if (existingIndex > -1) {
      const current = state.cart[existingIndex];
      if (current.quantity + 1 > product.stock_quantity) {
        showToast(`Cannot add more. Only ${product.stock_quantity} available in stock!`, '⚠️');
        return;
      }
      current.quantity += 1;
    } else {
      if (product.stock_quantity <= 0) {
        showToast('Item is out of stock!', '⚠️');
        return;
      }
      state.cart.push({
        id: product.id,
        type: 'accessory',
        title: product.title,
        code: product.code,
        unit_price: parseFloat(product.selling_price) || 0,
        unit_cost: parseFloat(product.cost_price) || 0,
        quantity: 1,
        max_stock: product.stock_quantity,
        image: product.image || ''
      });
    }

    showToast(`Added ${product.title}`);
  }

  renderCart();
}

function updateCartQuantity(index, delta) {
  const item = state.cart[index];
  if (!item) return;

  if (item.type === 'phone') {
    // Handset is serialized, strictly 1
    return;
  }

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(index);
    return;
  }
  if (newQty > item.max_stock) {
    showToast(`Cannot exceed current stock (${item.max_stock})`, '⚠️');
    return;
  }

  item.quantity = newQty;
  renderCart();
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  renderCart();
}

function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  document.getElementById('cartDiscountInput').value = '0';
  renderCart();
  showToast('Cart cleared', '🗑️');
}

function renderCart() {
  const container = document.getElementById('cartItemList');
  const badge = document.getElementById('cartItemCountBadge');
  const btnCheckoutPrint = document.getElementById('btnCheckoutPrint');
  const btnCheckoutOnly = document.getElementById('btnCheckoutOnly');

  const totalPieces = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  badge.textContent = totalPieces;

  if (state.cart.length === 0) {
    btnCheckoutPrint.disabled = true;
    btnCheckoutOnly.disabled = true;
    container.innerHTML = `
      <div class="text-center py-16 text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <p class="text-sm font-medium">Cart is empty</p>
        <p class="text-xs text-gray-400 mt-1">Scan a barcode or click items to begin sale</p>
      </div>
    `;
    updateCartTotals();
    return;
  }

  btnCheckoutPrint.disabled = false;
  btnCheckoutOnly.disabled = false;

  container.innerHTML = state.cart.map((item, index) => {
    const isPhone = item.type === 'phone';
    const lineTotal = item.unit_price * item.quantity;

    return `
      <div class="py-2 flex items-center justify-between text-xs gap-2">
        <div class="flex items-center space-x-2 flex-1 min-w-0">
          ${item.image ? `
            <img src="${item.image}" alt="" class="w-8 h-8 rounded-md object-cover border border-gray-200 flex-shrink-0 shadow-xs">
          ` : `
            <div class="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-xs flex-shrink-0 text-gray-400">
              ${isPhone ? '📱' : '📦'}
            </div>
          `}
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-1.5">
              <span class="font-mono text-[10px] px-1 bg-gray-100 rounded text-gray-600">${item.code}</span>
              ${isPhone ? (
                item.condition_grade && item.condition_grade.includes('Brand New')
                  ? `<span class="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded">✨ Brand New</span><span class="text-gray-600 text-[10px] font-medium">🛡️ ${item.warranty_type || 'Official 1-Year'}</span>`
                  : `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">${item.condition_grade}</span><span class="text-gray-600 text-[10px] font-medium">🔋 ${item.battery_health}%</span>`
              ) : ''}
            </div>
            <p class="font-bold text-gray-800 truncate mt-0.5">${item.title}</p>
            <div class="text-[11px] text-gray-500 font-medium mt-0.5">
              ${formatMoney(item.unit_price)} each
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          ${isPhone ? `
            <span class="text-xs font-bold text-gray-500 px-2 py-1 bg-gray-100 rounded-lg">1 unit</span>
          ` : `
            <div class="flex items-center space-x-1 bg-gray-50 p-0.5 rounded-lg border border-gray-200">
              <button onclick="updateCartQuantity(${index}, -1)" class="stepper-btn text-gray-700 font-bold" title="Decrease">−</button>
              <span class="w-6 text-center font-bold text-gray-800 text-xs">${item.quantity}</span>
              <button onclick="updateCartQuantity(${index}, 1)" class="stepper-btn text-gray-700 font-bold" title="Increase">+</button>
            </div>
          `}

          <div class="text-right min-w-[70px]">
            <span class="font-extrabold text-blue-600 text-xs sm:text-sm">${formatMoney(lineTotal)}</span>
          </div>

          <button onclick="removeFromCart(${index})" class="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition" title="Remove">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = state.cart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const discountInput = document.getElementById('cartDiscountInput');
  const discount = Math.max(0, parseFloat(discountInput.value) || 0);
  const total = Math.max(0, subtotal - discount);

  document.getElementById('cartSubtotal').textContent = formatMoney(subtotal);
  document.getElementById('cartGrandTotal').textContent = formatMoney(total);

  if (state.paymentMethod === 'EMI') {
    calculateEmiPreview();
  }
}

function selectPaymentMethod(method) {
  state.paymentMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-indigo-600', 'text-white', 'border-indigo-600');
    btn.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
  });

  const activeBtn = Array.from(document.querySelectorAll('.pay-method-btn')).find(b => b.textContent.trim().includes(method));
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-indigo-600', 'text-white', 'border-indigo-600');
    activeBtn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
  }

  const emiBox = document.getElementById('emiConfigBox');
  if (emiBox) {
    if (method === 'EMI') {
      emiBox.classList.remove('hidden');
      calculateEmiPreview();
    } else {
      emiBox.classList.add('hidden');
    }
  }
}

function handleEmiModeChange() {
  const mode = document.querySelector('input[name="emiMode"]:checked')?.value || 'bank';
  const bankFields = document.getElementById('bankEmiFields');
  const shopFields = document.getElementById('shopEmiFields');

  if (mode === 'bank') {
    bankFields.classList.remove('hidden');
    shopFields.classList.add('hidden');
  } else {
    bankFields.classList.add('hidden');
    shopFields.classList.remove('hidden');

    const downPayInput = document.getElementById('shopEmiDownPayment');
    if (!downPayInput.value || parseFloat(downPayInput.value) <= 0) {
      const subtotal = state.cart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
      const discount = Math.max(0, parseFloat(document.getElementById('cartDiscountInput').value) || 0);
      const total = Math.max(0, subtotal - discount);
      downPayInput.value = Math.round((total * 0.3) / 500) * 500; // sensible 30% default
    }
  }
  calculateEmiPreview();
}

function calculateEmiPreview() {
  const subtotal = state.cart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const discount = Math.max(0, parseFloat(document.getElementById('cartDiscountInput').value) || 0);
  const total = Math.max(0, subtotal - discount);
  const summaryBox = document.getElementById('emiCalculationSummary');
  if (!summaryBox) return;

  const mode = document.querySelector('input[name="emiMode"]:checked')?.value || 'bank';

  if (mode === 'bank') {
    const bank = document.getElementById('bankEmiSelect').value;
    const months = parseInt(document.getElementById('bankEmiTenure').value, 10) || 6;
    const monthly = months > 0 ? Math.round(total / months) : total;

    summaryBox.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <div>
          <span class="text-indigo-900 font-bold block">🏦 ${bank}</span>
          <span class="text-gray-500 text-[11px]">${months} Months 0% Bank Card EMI</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-gray-500 block uppercase">Monthly Installment</span>
          <span class="text-sm font-extrabold text-indigo-700">${formatMoney(monthly)} / mo</span>
        </div>
      </div>
    `;
  } else {
    // Shop In-House Installment
    const downPayment = Math.max(0, parseFloat(document.getElementById('shopEmiDownPayment').value) || 0);
    const months = parseInt(document.getElementById('shopEmiTenure').value, 10) || 3;
    const remainingDue = Math.max(0, total - downPayment);
    const monthly = months > 0 ? Math.round(remainingDue / months) : remainingDue;

    summaryBox.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-emerald-700 font-bold text-[11px]">Down: ${formatMoney(downPayment)}</span>
            <span class="text-red-600 font-extrabold text-[11px]">Due: ${formatMoney(remainingDue)}</span>
          </div>
          <span class="text-gray-500 text-[11px] block mt-0.5">Plan: ${months} Monthly Installments</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-gray-500 block uppercase">Monthly Due</span>
          <span class="text-sm font-extrabold text-indigo-700">${formatMoney(monthly)} / mo</span>
        </div>
      </div>
    `;
  }
}

/* =========================================================
   CHECKOUT SUBMISSION & RECEIPT
========================================================= */
async function submitCheckout(printReceipt = false) {
  if (state.cart.length === 0) {
    showToast('Cart is empty!', '⚠️');
    return;
  }

  const custName = document.getElementById('custNameInput').value.trim() || 'Walk-in Customer';
  const custPhone = document.getElementById('custPhoneInput').value.trim() || '';
  const discount = Math.max(0, parseFloat(document.getElementById('cartDiscountInput').value) || 0);
  const subtotal = state.cart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

  // Security: Check if manual discount exceeds 10% threshold in Staff Mode
  if (subtotal > 0 && (discount / subtotal) > 0.10) {
    if (window.AuthSecurity && !window.AuthSecurity.isOwner()) {
      const discountPct = Math.round((discount / subtotal) * 100);
      const authorized = await window.AuthSecurity.requestOwnerOverride(
        'Manager Discount Authorization',
        `Discount of ৳${discount.toFixed(0)} (${discountPct}%) exceeds the 10% staff limit. Owner PIN authorization required.`
      );
      if (!authorized) {
        showToast('Discount > 10% requires Owner PIN authorization!', '🔒');
        return;
      }
      if (window.AuthSecurity.logAudit) {
        window.AuthSecurity.logAudit('DISCOUNT_OVERRIDE', {
          discount_amount: discount,
          discount_pct: discountPct,
          subtotal: subtotal,
          authorized_by: 'Owner'
        });
      }
    }
  }

  const total = Math.max(0, subtotal - discount);
  const totalCost = state.cart.reduce((sum, i) => sum + ((parseFloat(i.unit_cost) || 0) * i.quantity), 0);
  const profitMargin = total - totalCost;

  const payload = {
    customer_name: custName,
    customer_phone: custPhone,
    payment_method: state.paymentMethod,
    subtotal: subtotal,
    discount: discount,
    discount_amount: discount,
    final_amount: total,
    total_amount: total,
    total_cost: totalCost,
    profit_margin: profitMargin,
    paid_amount: total,
    items: state.cart.map(c => ({
      id: c.id,
      item_id: c.id,
      item_type: c.type,
      quantity: c.quantity,
      unit_price: c.unit_price,
      unit_cost: parseFloat(c.unit_cost) || 0,
      total_price: c.unit_price * c.quantity,
      sku_or_imei: c.code,
      title: c.title
    }))
  };

  // EMI Validation & Payload construction
  if (state.paymentMethod === 'EMI') {
    const mode = document.querySelector('input[name="emiMode"]:checked')?.value || 'bank';
    payload.is_emi = 1;

    if (mode === 'bank') {
      const months = parseInt(document.getElementById('bankEmiTenure').value, 10) || 6;
      payload.emi_type = 'Bank EMI';
      payload.emi_bank_name = document.getElementById('bankEmiSelect').value;
      payload.emi_card_last4 = document.getElementById('bankEmiCardLast4').value.trim();
      payload.emi_tenure_months = months;
      payload.emi_monthly_amount = months > 0 ? Math.round(total / months) : total;
      payload.emi_down_payment = total;
    } else {
      // Shop In-House Installment
      const nid = document.getElementById('shopEmiNid').value.trim();
      if (!nid) {
        showToast('Customer NID / ID number is required for Shop Installment!', '⚠️');
        document.getElementById('shopEmiNid').focus();
        return;
      }
      if (!custPhone) {
        showToast('Customer phone number is required for installment tracking!', '⚠️');
        document.getElementById('custPhoneInput').focus();
        return;
      }

      const months = parseInt(document.getElementById('shopEmiTenure').value, 10) || 3;
      const downPayment = Math.max(0, parseFloat(document.getElementById('shopEmiDownPayment').value) || 0);
      const remainingDue = Math.max(0, total - downPayment);

      payload.emi_type = 'Shop Installment';
      payload.emi_tenure_months = months;
      payload.emi_down_payment = downPayment;
      payload.emi_monthly_amount = months > 0 ? Math.round(remainingDue / months) : remainingDue;
      payload.customer_nid = nid;
      payload.guarantor_info = document.getElementById('shopEmiGuarantor').value.trim();
      payload.payment_method = document.getElementById('shopEmiDownPayMethod').value;
    }
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to complete checkout');
    }

    playBeep(1200, 'triangle', 0.15);
    showToast(`Order complete! Invoice: ${data.invoice_number}`, '🎉');

    // Reset Cart & Inputs
    state.cart = [];
    document.getElementById('custNameInput').value = 'Walk-in Customer';
    document.getElementById('custPhoneInput').value = '';
    document.getElementById('cartDiscountInput').value = '0';
    selectPaymentMethod('Cash');
    renderCart();
    loadPosCatalog();
    updateOutOfStockBadge();

    // Render receipt
    const receiptOrder = (data && data.order) ? { ...data.order, ...data } : data;
    renderReceipt(receiptOrder);
    openModal('modalReceipt');

    if (printReceipt) {
      setTimeout(() => {
        window.print();
      }, 350);
    }
  } catch (err) {
    showToast(err.message, '❌');
  }
}

/* =========================================================
   THERMAL RECEIPT GENERATOR (80mm)
========================================================= */
function renderReceipt(order) {
  if (!order) return;
  if (order.order) {
    order = { ...order.order, ...order };
  }
  state.currentReceiptOrder = order;
  state.currentReceiptPayment = null;
  const container = document.getElementById('receiptPrintArea');
  if (!container) return;
  const dateFormatted = order.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString();

  let itemsHtml = '';
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const computedSubtotal = orderItems.reduce((acc, it) => acc + (parseFloat(it.selling_price || it.unit_price || 0) * (parseInt(it.quantity, 10) || 1)), 0);
  const subtotalVal = (order.subtotal !== undefined && order.subtotal !== null && Number(order.subtotal) > 0)
    ? parseFloat(order.subtotal)
    : (computedSubtotal || parseFloat(order.total_amount || 0));
  const discountVal = parseFloat(order.discount || order.discount_amount || 0);
  const totalAmountVal = (order.total_amount !== undefined && order.total_amount !== null && Number(order.total_amount) > 0)
    ? parseFloat(order.total_amount)
    : (order.final_amount ? parseFloat(order.final_amount) : Math.max(0, subtotalVal - discountVal));

  orderItems.forEach(item => {
    const isPhone = item.item_type === 'phone' || !!item.imei_number;
    itemsHtml += `
      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: bold;">${item.title || item.name || 'Product'}</span>
        </div>
        ${isPhone ? `<div style="font-size: 10px; color: #333;">★ IMEI: ${item.sku_or_imei || item.code || item.imei_number}</div>` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #444;">
          <span>${item.quantity || 1} x ${formatMoney(item.unit_price || item.selling_price || 0)}</span>
          <span>${formatMoney(item.total_price || ((item.unit_price || item.selling_price || 0) * (item.quantity || 1)))}</span>
        </div>
      </div>
    `;
  });

  let emiSectionHtml = '';
  if (order.is_emi) {
    if (order.emi_type === 'Bank EMI') {
      emiSectionHtml = `
        <div style="margin-top: 8px; padding: 6px; background-color: #f0fdf4; border: 1px dashed #16a34a; border-radius: 4px; font-size: 10px; line-height: 1.4;">
          <div style="font-weight: bold; color: #15803d; border-bottom: 1px solid #bbf7d0; padding-bottom: 3px; margin-bottom: 4px;">
            🏦 BANK CARD 0% EMI PLAN
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Financing Bank:</span>
            <span style="font-weight: bold;">${order.emi_bank_name || 'Bank Card'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Tenure:</span>
            <span style="font-weight: bold;">${order.emi_tenure_months} Months</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Monthly Installment:</span>
            <span style="font-weight: bold; color: #15803d;">${formatMoney(order.emi_monthly_amount)} / mo</span>
          </div>
          ${order.emi_card_last4 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Card Number:</span>
            <span>**** **** **** ${order.emi_card_last4}</span>
          </div>` : ''}
          <div style="font-size: 8px; color: #555; margin-top: 3px;">
            * Financed via POS Bank Terminal. Full amount settled by bank.
          </div>
        </div>
      `;
    } else {
      // Shop In-House Installment
      emiSectionHtml = `
        <div style="margin-top: 8px; padding: 6px; background-color: #fffbeb; border: 1px dashed #d97706; border-radius: 4px; font-size: 10px; line-height: 1.4;">
          <div style="font-weight: bold; color: #b45309; border-bottom: 1px solid #fde68a; padding-bottom: 3px; margin-bottom: 4px; display: flex; justify-content: space-between;">
            <span>📋 IN-HOUSE INSTALLMENT AGREEMENT</span>
            <span style="background: #fef3c7; padding: 0 4px; border-radius: 2px;">${order.emi_status || 'Active'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Customer NID:</span>
            <span style="font-weight: bold; font-family: monospace;">${order.customer_nid || 'Recorded'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Down Payment Paid:</span>
            <span style="font-weight: bold; color: #047857;">${formatMoney(order.emi_down_payment)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Remaining Due Balance:</span>
            <span style="font-weight: bold; color: #dc2626;">${formatMoney(order.emi_remaining_due)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Installment Schedule:</span>
            <span style="font-weight: bold;">${order.emi_tenure_months} Months (${formatMoney(order.emi_monthly_amount)} / mo)</span>
          </div>
          ${order.guarantor_info ? `
          <div style="display: flex; justify-content: space-between; font-size: 9px; color: #555; margin-top: 2px;">
            <span>Guarantor:</span>
            <span>${order.guarantor_info}</span>
          </div>` : ''}
          <div style="margin-top: 18px; padding-top: 4px; border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; font-size: 8px; color: #555;">
            <span>Customer Signature</span>
            <span>Shop Authority</span>
          </div>
        </div>
      `;
    }
  }

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 10px;">
      <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">MOBILE DECOR & TECH</div>
      <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">SMARTPHONES, ACCESSORIES & TECH</div>
      <div style="font-size: 10px; color: #555;">Dhaka, Bangladesh | Support: 01700-000000</div>
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="font-size: 10px; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between;">
        <span>Invoice:</span>
        <span style="font-weight: bold;">${order.invoice_number}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Date:</span>
        <span>${dateFormatted}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Customer:</span>
        <span>${order.customer_name}</span>
      </div>
      ${order.customer_phone ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Mobile:</span>
        <span>${order.customer_phone}</span>
      </div>` : ''}
      <div style="display: flex; justify-content: space-between;">
        <span>Payment:</span>
        <span style="font-weight: bold;">${order.payment_method} ${order.is_emi ? `(${order.emi_type})` : ''}</span>
      </div>
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="margin: 8px 0;">
      ${itemsHtml}
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="font-size: 11px; line-height: 1.5;">
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal:</span>
        <span>${formatMoney(subtotalVal)}</span>
      </div>
      ${discountVal > 0 ? `
      <div style="display: flex; justify-content: space-between; color: #d9534f;">
        <span>Discount:</span>
        <span>- ${formatMoney(discountVal)}</span>
      </div>` : ''}
      <div class="receipt-double-line"></div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
        <span>TOTAL PRICE:</span>
        <span>${formatMoney(totalAmountVal)}</span>
      </div>
      ${order.is_emi && order.emi_type === 'Shop Installment' ? `
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #047857; margin-top: 3px;">
        <span>DOWN PAYMENT PAID:</span>
        <span>${formatMoney(order.emi_down_payment)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; color: #dc2626; margin-top: 2px;">
        <span>CURRENT REMAINING DUE:</span>
        <span>${formatMoney(order.emi_remaining_due)}</span>
      </div>` : ''}
    </div>

    ${emiSectionHtml}

    <div class="receipt-dashed-line"></div>

    <div style="text-align: center; font-size: 9px; line-height: 1.4; margin-top: 10px; color: #444;">
      <div style="font-weight: bold; margin-bottom: 2px;">*** WARRANTY POLICY ***</div>
      <div>Brand New Handsets: Official Brand Warranty</div>
      <div>Pre-Owned Handsets: 30 Days Hardware Service</div>
      <div>Accessories: 7 Days Replacement Warranty</div>
      <div style="font-size: 8px; color: #666; margin-top: 2px;">* Warranty void if IMEI seal is broken or tampered.</div>
      <div style="margin-top: 8px; font-weight: bold;">Thank You For Choosing Mobile Decor & Tech!</div>
    </div>
  `;
}

function renderEmiPaymentSlip(payment) {
  state.currentReceiptPayment = payment;
  state.currentReceiptOrder = null;
  const container = document.getElementById('receiptPrintArea');
  const dateFormatted = new Date(payment.payment_date || Date.now()).toLocaleString();
  const isCleared = payment.remaining_balance <= 0;

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 10px;">
      <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">MOBILE DECOR & TECH</div>
      <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">INSTALLMENT MONEY RECEIPT</div>
      <div style="font-size: 10px; color: #555;">Dhaka, Bangladesh | Support: 01700-000000</div>
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="font-size: 10px; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between;">
        <span>Receipt No:</span>
        <span style="font-weight: bold; font-family: monospace;">REC-${payment.payment_id || Date.now().toString().slice(-6)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Invoice Ref:</span>
        <span style="font-weight: bold; font-family: monospace;">${payment.invoice_number}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Date:</span>
        <span>${dateFormatted}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Customer:</span>
        <span style="font-weight: bold;">${payment.customer_name}</span>
      </div>
      ${payment.customer_phone ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Mobile:</span>
        <span>${payment.customer_phone}</span>
      </div>` : ''}
      ${payment.customer_nid ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Customer NID:</span>
        <span>${payment.customer_nid}</span>
      </div>` : ''}
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="padding: 8px 0; text-align: center;">
      <span style="font-size: 11px; color: #555; text-transform: uppercase; font-weight: bold;">Amount Collected</span>
      <div style="font-size: 20px; font-weight: 900; color: #047857; margin: 4px 0;">
        ${formatMoney(payment.amount_paid)}
      </div>
      <div style="font-size: 10px; color: #444;">
        Paid via <strong>${payment.payment_method}</strong>
      </div>
      ${payment.notes ? `<div style="font-size: 10px; color: #666; font-style: italic; margin-top: 2px;">Note: ${payment.notes}</div>` : ''}
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="font-size: 11px; line-height: 1.5;">
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>Remaining Balance Due:</span>
        <span style="color: ${isCleared ? '#047857' : '#dc2626'}; font-size: 13px;">
          ${isCleared ? '৳ 0.00 (PAID IN FULL)' : formatMoney(payment.remaining_balance)}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 2px;">
        <span>Account Status:</span>
        <span style="font-weight: bold; color: ${isCleared ? '#047857' : '#d97706'};">
          ${isCleared ? 'COMPLETED / FULLY PAID' : 'ACTIVE DUE'}
        </span>
      </div>
    </div>

    <div class="receipt-dashed-line"></div>

    <div style="margin-top: 28px; padding-top: 6px; border-top: 1px dashed #aaa; display: flex; justify-content: space-between; font-size: 9px; color: #555;">
      <span>Customer Signature</span>
      <span>Shop Authority</span>
    </div>

    <div style="text-align: center; font-size: 9px; color: #666; margin-top: 10px;">
      Official Computer Generated Money Receipt<br>
      Mobile Decor & Tech POS System
    </div>
  `;
}

/* =========================================================
   WHATSAPP DIGITAL RECEIPT SHARING & CAMERA SCANNER ACTIONS
========================================================= */
function shareReceiptWhatsApp() {
  if (state.currentReceiptPayment) {
    const p = state.currentReceiptPayment;
    const dateFormatted = new Date(p.payment_date || Date.now()).toLocaleString();
    const isCleared = p.remaining_balance <= 0;
    const text = 
`🧾 *MOBILE DECOR & TECH - INSTALLMENT MONEY RECEIPT*
━━━━━━━━━━━━━━━━━━━━
*Receipt No:* REC-${p.payment_id || Date.now().toString().slice(-6)}
*Invoice Ref:* ${p.invoice_number}
*Date:* ${dateFormatted}
*Customer:* ${p.customer_name || 'Valued Customer'}
*Phone:* ${p.customer_phone || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
*Amount Collected:* ৳ ${(p.amount_paid || 0).toLocaleString()}
*Payment Method:* ${p.payment_method || 'Cash'}
*Remaining Due:* ৳ ${(p.remaining_balance || 0).toLocaleString()}
*Status:* ${isCleared ? '✅ FULLY SETTLED' : '⚠️ ACTIVE INSTALLMENT'}
━━━━━━━━━━━━━━━━━━━━
Thank you for your payment!
*Mobile Decor & Tech - Smartphones & Accessories*`;

    let phone = (p.customer_phone || '').replace(/[^0-9]/g, '');
    if (phone.length === 11 && phone.startsWith('01')) {
      phone = '88' + phone;
    }
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    return;
  }

  if (state.currentReceiptOrder) {
    const o = state.currentReceiptOrder;
    const dateFormatted = new Date(o.created_at || Date.now()).toLocaleString();
    let itemsText = '';
    (o.items || []).forEach(it => {
      const isPhone = it.item_type === 'phone';
      itemsText += `• ${it.title} (x${it.quantity}) - ৳ ${(it.total_price || 0).toLocaleString()}` + (isPhone ? `\n  IMEI: ${it.sku_or_imei}` : '') + `\n`;
    });

    let emiExtra = '';
    if (o.is_emi) {
      if (o.emi_type === 'Bank EMI') {
        emiExtra = `\n🏦 *Bank EMI Plan:* ${o.emi_bank_name || 'Bank Card'} (${o.emi_tenure_months} Mo @ ৳ ${(o.emi_monthly_amount || 0).toLocaleString()}/mo)`;
      } else {
        emiExtra = `\n📋 *Shop Installment Plan:*\n• Down Payment: ৳ ${(o.emi_down_payment || 0).toLocaleString()}\n• Remaining Due: ৳ ${(o.emi_remaining_due || 0).toLocaleString()}\n• Tenure: ${o.emi_tenure_months} Mo @ ৳ ${(o.emi_monthly_amount || 0).toLocaleString()}/mo\n• Status: ${o.emi_status || 'Active'}`;
      }
    }

    const text = 
`🧾 *MOBILE DECOR & TECH - SALES INVOICE*
━━━━━━━━━━━━━━━━━━━━
*Invoice #:* ${o.invoice_number}
*Date:* ${dateFormatted}
*Customer:* ${o.customer_name || 'Valued Customer'}
*Phone:* ${o.customer_phone || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
*ITEMS PURCHASED:*
${itemsText.trim()}
━━━━━━━━━━━━━━━━━━━━
*Subtotal:* ৳ ${(o.subtotal || 0).toLocaleString()}
*Discount:* ৳ ${(o.discount || 0).toLocaleString()}
*Total Bill:* ৳ ${(o.total_amount || 0).toLocaleString()}${emiExtra}
━━━━━━━━━━━━━━━━━━━━
Thank you for shopping with Mobile Decor & Tech!
*Official Computer-Generated Receipt*`;

    let phone = (o.customer_phone || '').replace(/[^0-9]/g, '');
    if (phone.length === 11 && phone.startsWith('01')) {
      phone = '88' + phone;
    }
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    return;
  }

  showToast('No active receipt to share', '⚠️');
}

function startCameraScanForPos() {
  if (window.CameraScanner) {
    CameraScanner.open((code) => {
      const input = document.getElementById('posSearchInput');
      if (input) {
        input.value = code;
        handlePosSearch();
      }
    }, 'Scan Barcode / Handset IMEI');
  } else {
    showToast('Camera scanner not ready', '⚠️');
  }
}

function startCameraScanForAccessorySku() {
  if (window.CameraScanner) {
    CameraScanner.open((code) => {
      const input = document.getElementById('itemSku');
      if (input) {
        input.value = code;
        showToast(`Scanned SKU: ${code}`, '✅');
      }
    }, 'Scan Accessory Barcode');
  } else {
    showToast('Camera scanner not ready', '⚠️');
  }
}

function startCameraScanForPhoneImei() {
  if (window.CameraScanner) {
    CameraScanner.open((code) => {
      const input = document.getElementById('phoneImei');
      if (input) {
        input.value = code;
        checkImeiDuplicate(code);
        showToast(`Scanned IMEI: ${code}`, '✅');
      }
    }, 'Scan Handset IMEI Barcode');
  } else {
    showToast('Camera scanner not ready', '⚠️');
  }
}

function startCameraScanForOrders() {
  if (window.CameraScanner) {
    CameraScanner.open((code) => {
      const input = document.getElementById('orderSearchInput');
      if (input) {
        input.value = code;
        renderOrdersCards();
        showToast(`Filtered for: ${code}`, '🔍');
      }
    }, 'Scan Invoice Barcode or IMEI');
  } else {
    showToast('Camera scanner not ready', '⚠️');
  }
}

const APP_VERSION = '1.2.0';
window.APP_VERSION = APP_VERSION;

/* =========================================================
   PRODUCT PHOTO HANDLING & CLIENT-SIDE COMPRESSION (TARGET: 100 - 150 KB)
========================================================= */
function triggerItemCameraSnap() {
  if (window.AuthSecurity && typeof window.AuthSecurity.markPickerActive === 'function') {
    window.AuthSecurity.markPickerActive();
  }
  document.getElementById('itemImageCameraInput')?.click();
}

function triggerItemGallery() {
  if (window.AuthSecurity && typeof window.AuthSecurity.markPickerActive === 'function') {
    window.AuthSecurity.markPickerActive();
  }
  document.getElementById('itemImageGalleryInput')?.click();
}

function triggerPhoneCameraSnap() {
  if (window.AuthSecurity && typeof window.AuthSecurity.markPickerActive === 'function') {
    window.AuthSecurity.markPickerActive();
  }
  document.getElementById('phoneImageCameraInput')?.click();
}

function triggerPhoneGallery() {
  if (window.AuthSecurity && typeof window.AuthSecurity.markPickerActive === 'function') {
    window.AuthSecurity.markPickerActive();
  }
  document.getElementById('phoneImageGalleryInput')?.click();
}

function getDataUrlSizeBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64Len = dataUrl.length - (commaIdx + 1);
  return Math.round((base64Len * 3) / 4);
}

function handleProductImageFile(input, prefix = 'item') {
  if (window.AuthSecurity && typeof window.AuthSecurity.clearPickerActive === 'function') {
    window.AuthSecurity.clearPickerActive();
  }
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  showToast('Optimizing photo (<150 KB)...', '⏳');
  compressAndLoadImage(file, (dataUrl, sizeKb) => {
    setProductImagePreview(prefix, dataUrl);
    showToast(`Photo attached: ${sizeKb} KB (Under 150KB)`, '📷');
  });
  input.value = '';
}

function compressAndLoadImage(file, callback, targetMaxKb = 145, targetMinKb = 85) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // 1. Initial dimensions: high definition max 1080px for crisp details of device & packaging
      let maxDim = 1080;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      function redrawCanvas(targetW, targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        // Clean white background to prevent transparent PNGs turning black
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }

      redrawCanvas(width, height);

      // Check if browser/webview supports WebP
      const testWebp = canvas.toDataURL('image/webp', 0.85);
      const mimeType = testWebp.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';

      // 2. Iterative optimization to guarantee size strictly under 150 KB (targeting 100-145 KB)
      let quality = 0.85;
      let dataUrl = canvas.toDataURL(mimeType, quality);
      let sizeBytes = getDataUrlSizeBytes(dataUrl);
      let sizeKb = Math.round(sizeBytes / 1024);

      let attempts = 0;
      while (sizeKb > targetMaxKb && attempts < 8) {
        attempts++;
        if (quality > 0.45) {
          quality = Math.max(0.40, quality - 0.09);
        } else {
          // If quality is already low, reduce resolution by 15%
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
          redrawCanvas(width, height);
          quality = 0.65;
        }
        dataUrl = canvas.toDataURL(mimeType, quality);
        sizeBytes = getDataUrlSizeBytes(dataUrl);
        sizeKb = Math.round(sizeBytes / 1024);
      }

      callback(dataUrl, sizeKb);
    };
    img.onerror = function() {
      showToast('Failed to load image file', '❌');
    };
    img.src = e.target.result;
  };
  reader.onerror = function() {
    showToast('Failed to read image file', '❌');
  };
  reader.readAsDataURL(file);
}

function setProductImagePreview(prefix, dataUrl) {
  const hiddenInput = document.getElementById(`${prefix}ImageData`);
  const previewImg = document.getElementById(`${prefix}ImagePreview`);
  const placeholder = document.getElementById(`${prefix}ImagePlaceholder`);
  const removeBtn = document.getElementById(`${prefix}ImageRemoveBtn`);
  const sizeBadge = document.getElementById(`${prefix}ImageSizeBadge`);

  if (hiddenInput) hiddenInput.value = dataUrl || '';
  if (dataUrl) {
    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');

    if (sizeBadge) {
      const sizeBytes = getDataUrlSizeBytes(dataUrl);
      const sizeKb = Math.round(sizeBytes / 1024);
      sizeBadge.textContent = `📷 ${sizeKb} KB (<150KB)`;
      sizeBadge.classList.remove('hidden');
    }
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');

    if (sizeBadge) {
      sizeBadge.textContent = '';
      sizeBadge.classList.add('hidden');
    }
  }
}

/* =========================================================
   INVENTORY: ACCESSORIES TABLE & OPERATIONS
========================================================= */
let inventorySearchTimer;
function debouncedSearchInventory() {
  clearTimeout(inventorySearchTimer);
  inventorySearchTimer = setTimeout(() => {
    if (state.inventorySubTab === 'accessories') {
      loadAccessoriesTable();
    } else if (state.inventorySubTab === 'phones') {
      loadPhonesTable();
    } else if (state.inventorySubTab === 'outofstock') {
      loadOutOfStockTable();
    }
  }, 250);
}

async function loadAccessoriesTable() {
  const search = document.getElementById('invSearchInput').value.trim();
  const catId = document.getElementById('invCatFilter').value;
  const lowStockOnly = document.getElementById('invLowStockOnly').checked;

  let queryUrl = '/api/items?';
  if (search) queryUrl += `search=${encodeURIComponent(search)}&`;
  if (catId) queryUrl += `category_id=${catId}&`;
  if (lowStockOnly) queryUrl += 'low_stock=1&';

  try {
    const res = await fetch(queryUrl);
    const rawItems = await res.json();
    const allItems = Array.isArray(rawItems) ? rawItems : [];

    const inStockItems = allItems.filter(i => Number(i.stock_quantity || 0) > 0);
    const outOfStockItems = allItems.filter(i => Number(i.stock_quantity || 0) <= 0);

    // Update subtab badges
    const accBadge = document.getElementById('invAccCountBadge');
    if (accBadge) accBadge.textContent = inStockItems.length;
    updateOutOfStockBadge();

    // If not actively searching or filtering, show ONLY in-stock items under "Accessories & General"
    // Out-of-stock items go under "Out of Stock" section!
    let displayItems = allItems;
    if (!search && !lowStockOnly) {
      displayItems = inStockItems;
    }

    const tbody = document.getElementById('accessoriesTableBody');

    if (displayItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">No accessories found in this view.</td></tr>';
      return;
    }

    tbody.innerHTML = displayItems.map(item => {
      const isZero = Number(item.stock_quantity) <= 0;
      const isLow = Number(item.stock_quantity) <= Number(item.min_alert_threshold);
      const cost = Number(item.cost_price || 0);
      const price = Number(item.selling_price || 0);
      const profit = price - cost;
      const marginPct = cost > 0 ? Math.round((profit / cost) * 100) : 0;

      return `
        <tr class="hover:bg-gray-50 transition ${isZero ? 'bg-red-50/40' : isLow ? 'bg-amber-50/30' : ''}">
          <td class="px-4 py-3 font-mono font-bold text-gray-700">${item.sku_or_barcode}</td>
          <td class="px-4 py-3">
            <div class="flex items-center space-x-3">
              ${item.image ? `<img src="${item.image}" alt="" class="w-9 h-9 rounded-xl object-cover border border-gray-200 flex-shrink-0 shadow-xs">` : `<div class="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-sm flex-shrink-0 text-gray-400">📦</div>`}
              <div>
                <span class="font-bold text-gray-900 block leading-tight">${item.title}</span>
                <span class="text-[10px] text-gray-400 block">${item.category_name || 'General'}</span>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-gray-600 font-medium">${item.category_name || 'General'}</td>
          <td class="px-4 py-3">
            ${item.rack_location ? `
              <span class="tag-location">
                📍 ${item.rack_location}
              </span>
            ` : `<span class="text-gray-400 italic text-[11px]">-</span>`}
          </td>
          <td class="px-4 py-3 text-right text-gray-500 font-medium owner-only-stat">${formatMoney(item.cost_price)}</td>
          <td class="px-4 py-3 text-right">
            <span class="font-bold text-gray-900 block">${formatMoney(item.selling_price)}</span>
            <span class="text-[10px] text-emerald-600 font-bold block owner-only-stat">+${marginPct}%</span>
          </td>
          <td class="px-4 py-3 text-center">
            <div class="inline-flex items-center space-x-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button onclick="quickAdjustStock('${item.id}', -1)" class="stepper-btn text-gray-700 font-bold" title="Decrease">−</button>
              <span class="w-6 text-center font-extrabold text-xs ${isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}">${item.stock_quantity}</span>
              <button onclick="quickAdjustStock('${item.id}', 1)" class="stepper-btn text-gray-700 font-bold" title="Increase">+</button>
            </div>
          </td>
          <td class="px-4 py-3 text-center text-gray-400 font-mono text-xs">${item.min_alert_threshold}</td>
          <td class="px-4 py-3 text-center">
            ${isZero ? `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                ⚠️ Out of Stock (0)
              </span>
            ` : isLow ? `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                ⚠️ Low (${item.stock_quantity})
              </span>
            ` : `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                In-Stock
              </span>
            `}
          </td>
          <td class="px-4 py-3 text-right space-x-2">
            <button onclick="openEditItemModal('${item.id}')" class="text-blue-600 hover:text-blue-800 font-bold text-xs transition">Edit</button>
            <span class="text-gray-300">|</span>
            <button onclick="deleteItem('${item.id}')" class="text-red-600 hover:text-red-800 font-bold text-xs transition">Del</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

async function quickAdjustStock(id, delta) {
  try {
    const res = await fetch(`/api/items/${id}/adjust-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
    if (res.ok) {
      loadAccessoriesTable();
    }
  } catch (err) {
    showToast('Failed to adjust stock', '❌');
  }
}

function openAddItemModal() {
  if (state.inventorySubTab === 'phones') {
    openAddPhoneModal();
    return;
  }

  state.editingItemId = null;
  document.getElementById('modalItemTitle').textContent = 'Add New Accessory';
  document.getElementById('itemId').value = '';
  document.getElementById('itemTitle').value = '';
  document.getElementById('itemSku').value = '';
  document.getElementById('itemRack').value = '';
  document.getElementById('itemCost').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemStock').value = '10';
  document.getElementById('itemAlertLimit').value = '5';
  setProductImagePreview('item', '');
  toggleInlineCategoryBox(false);
  openModal('modalItem');
  setTimeout(() => document.getElementById('itemTitle').focus(), 50);
}

async function openEditItemModal(id) {
  try {
    const res = await fetch('/api/items');
    const items = await res.json();
    const item = items.find(i => i.id === id);
    if (!item) return;

    state.editingItemId = id;
    document.getElementById('modalItemTitle').textContent = 'Edit Accessory';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemTitle').value = item.title;
    document.getElementById('itemSku').value = item.sku_or_barcode;
    document.getElementById('itemCategory').value = item.category_id || '';
    document.getElementById('itemRack').value = item.rack_location || '';
    document.getElementById('itemCost').value = item.cost_price;
    document.getElementById('itemPrice').value = item.selling_price;
    document.getElementById('itemStock').value = item.stock_quantity;
    document.getElementById('itemAlertLimit').value = item.min_alert_threshold;
    setProductImagePreview('item', item.image || '');
    toggleInlineCategoryBox(false);

    openModal('modalItem');
  } catch (err) {
    showToast('Failed to load item details', '❌');
  }
}

async function handleSaveItem(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const payload = {
    sku_or_barcode: document.getElementById('itemSku').value.trim(),
    title: document.getElementById('itemTitle').value.trim(),
    category_id: document.getElementById('itemCategory').value || null,
    cost_price: parseFloat(document.getElementById('itemCost').value) || 0,
    selling_price: parseFloat(document.getElementById('itemPrice').value) || 0,
    stock_quantity: parseInt(document.getElementById('itemStock').value, 10) || 0,
    min_alert_threshold: parseInt(document.getElementById('itemAlertLimit').value, 10) || 5,
    rack_location: document.getElementById('itemRack').value.trim(),
    image: document.getElementById('itemImageData')?.value || ''
  };

  try {
    const url = id ? `/api/items/${id}` : '/api/items';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save item');

    closeModal('modalItem');
    showToast(id ? 'Accessory updated!' : 'Accessory added!');
    loadAccessoriesTable();
    loadPosCatalog();
  } catch (err) {
    showToast(err.message, '❌');
  }
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this accessory?')) return;
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Item deleted', '🗑️');
      loadAccessoriesTable();
      loadPosCatalog();
    }
  } catch (err) {
    showToast('Failed to delete item', '❌');
  }
}

function generateSmartSku() {
  const title = document.getElementById('itemTitle').value.trim();
  const categorySelect = document.getElementById('itemCategory');
  const catText = categorySelect.options[categorySelect.selectedIndex]?.text || '';

  let skuPrefix = '';

  if (title) {
    const cleanTokens = title
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0 && !['THE', 'A', 'AN', 'FOR', 'WITH', 'AND', 'OF', 'IN', 'ORIGINAL'].includes(w));

    const abbrevs = {
      'IPHONE': 'IPH',
      'SAMSUNG': 'SAM',
      'GALAXY': 'GLX',
      'GOOGLE': 'PIX',
      'PIXEL': 'PIX',
      'XIAOMI': 'MI',
      'REDMI': 'RMI',
      'ONEPLUS': '1P',
      'SILICONE': 'SIL',
      'CASE': 'CS',
      'COVER': 'CVR',
      'GLASS': 'GLS',
      'PRIVACY': 'PRV',
      'TEMPERED': 'TMP',
      'PROTECTOR': 'PRT',
      'CHARGER': 'CHG',
      'ADAPTER': 'ADP',
      'CABLE': 'CBL',
      'LIGHTNING': 'LTG',
      'TYPE-C': 'TYPC',
      'TYPEC': 'TYPC',
      'POWERBANK': 'PB',
      'POWER': 'PWR',
      'BANK': 'BNK',
      'EARPHONE': 'EP',
      'HEADPHONE': 'HP',
      'AIRPODS': 'AP',
      'WATCH': 'WCH'
    };

    if (cleanTokens.length === 1) {
      skuPrefix = cleanTokens[0].slice(0, 6);
    } else {
      const parts = cleanTokens.slice(0, 3).map(w => abbrevs[w] || (w.length <= 4 ? w : w.slice(0, 3)));
      skuPrefix = parts.join('-');
    }
  } else if (catText && catText !== 'All Categories') {
    skuPrefix = catText.toUpperCase().slice(0, 3);
  } else {
    skuPrefix = 'ACC';
  }

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const finalSku = `${skuPrefix}-${randomSuffix}`.replace(/--+/g, '-');

  document.getElementById('itemSku').value = finalSku;
  showToast(`Auto-generated SKU: ${finalSku}`, '⚡');
}

// Backward compatibility helper
function generateRandomSku() {
  generateSmartSku();
}

function toggleInlineCategoryBox(show) {
  const box = document.getElementById('inlineCategoryBox');
  if (show) {
    box.classList.remove('hidden');
    setTimeout(() => document.getElementById('inlineCategoryInput').focus(), 50);
  } else {
    box.classList.add('hidden');
    document.getElementById('inlineCategoryInput').value = '';
  }
}

async function saveInlineCategory() {
  const input = document.getElementById('inlineCategoryInput');
  const name = input.value.trim();
  if (!name) {
    showToast('Enter a category name', '⚠️');
    return;
  }
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create category');

    showToast(`Category "${data.name}" added!`, '🎉');
    input.value = '';
    toggleInlineCategoryBox(false);

    // Refresh categories and select the new one in the dropdown
    await loadCategories();
    document.getElementById('itemCategory').value = data.id;
  } catch (err) {
    showToast(err.message, '❌');
  }
}

/* =========================================================
   INVENTORY: MOBILE HANDSETS (IMEI TRACKING)
========================================================= */
async function loadPhonesTable() {
  const search = document.getElementById('invSearchInput').value.trim();
  const status = document.getElementById('phoneStatusFilter').value;
  const brand = document.getElementById('phoneBrandFilter').value;
  const grade = document.getElementById('phoneGradeFilter')?.value || '';

  let queryUrl = '/api/phones?';
  if (search) queryUrl += `search=${encodeURIComponent(search)}&`;
  if (status) queryUrl += `status=${encodeURIComponent(status)}&`;
  if (brand) queryUrl += `brand=${encodeURIComponent(brand)}&`;
  if (grade) queryUrl += `grade=${encodeURIComponent(grade)}&`;

  try {
    const res = await fetch(queryUrl);
    const phones = await res.json();

    document.getElementById('invPhoneCountBadge').textContent = phones.filter(p => p.status === 'In-Stock').length;
    updateOutOfStockBadge();
    const tbody = document.getElementById('phonesTableBody');

    if (phones.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-gray-400">No mobile handsets found.</td></tr>';
      return;
    }

    tbody.innerHTML = phones.map(p => {
      const marginEst = p.selling_price - p.purchase_cost;
      const isSold = p.status === 'Sold';
      const isBrandNew = p.condition_grade && p.condition_grade.includes('Brand New');

      const conditionBadge = isBrandNew
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800">✨ Brand New</span>`
        : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${p.condition_grade.includes('A') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${p.condition_grade}</span>`;

      const warrantyBatteryBadge = isBrandNew
        ? `<span class="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">🛡️ ${p.warranty_type || 'Official 1-Year'}</span>`
        : `<div class="flex flex-col items-center"><span class="font-bold text-gray-700 text-xs">🔋 ${p.battery_health}%</span><span class="text-[10px] text-gray-500">${p.warranty_type || '30D Service'}</span></div>`;

      return `
        <tr class="hover:bg-gray-50 ${isSold ? 'opacity-60 bg-gray-50' : ''}">
          <td class="px-4 py-3 font-mono font-bold text-gray-900">${p.imei_number}</td>
          <td class="px-4 py-3">
            <div class="flex items-center space-x-2.5">
              ${p.image ? `<img src="${p.image}" alt="" class="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0 shadow-xs">` : `<div class="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs flex-shrink-0 text-gray-400">📱</div>`}
              <div>
                <span class="font-bold text-gray-900">${p.brand} ${p.model}</span>
                ${p.notes ? `<p class="text-[10px] text-gray-500 truncate max-w-xs">${p.notes}</p>` : ''}
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-gray-600">${p.storage_capacity} / ${p.color || 'Standard'}</td>
          <td class="px-4 py-3 text-center">${conditionBadge}</td>
          <td class="px-4 py-3 text-center">${warrantyBatteryBadge}</td>
          <td class="px-4 py-3 text-right text-gray-600 owner-only-stat">${formatMoney(p.purchase_cost)}</td>
          <td class="px-4 py-3 text-right font-bold text-gray-900">${formatMoney(p.selling_price)}</td>
          <td class="px-4 py-3 text-right text-emerald-700 font-bold owner-only-stat">${formatMoney(marginEst)}</td>
          <td class="px-4 py-3 text-center">
            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'In-Stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}">
              ${p.status}
            </span>
          </td>
          <td class="px-4 py-3 text-right space-x-1">
            <button onclick="openEditPhoneModal('${p.id}')" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs">Edit</button>
            ${!isSold ? `
              <span class="text-gray-300">|</span>
              <button onclick="deletePhone('${p.id}')" class="text-red-600 hover:text-red-800 font-semibold text-xs">Del</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load phones:', err);
  }
}

function handlePhoneConditionChange() {
  const grade = document.getElementById('phoneGrade').value;
  const isBrandNew = grade.includes('Brand New');
  const batteryContainer = document.getElementById('phoneBatteryContainer');
  const banner = document.getElementById('phoneBrandNewBanner');
  const warrantySelect = document.getElementById('phoneWarranty');
  const batteryInput = document.getElementById('phoneBattery');

  if (isBrandNew) {
    batteryContainer.classList.add('hidden');
    banner.classList.remove('hidden');
    batteryInput.value = '100';
    if (!state.editingPhoneId) {
      warrantySelect.value = 'Official 1-Year Brand Warranty';
    }
  } else {
    batteryContainer.classList.remove('hidden');
    banner.classList.add('hidden');
    if (!state.editingPhoneId) {
      warrantySelect.value = 'Shop Service Warranty (30 Days)';
      if (batteryInput.value === '100') batteryInput.value = '88';
    }
  }
}

function openAddPhoneModal() {
  state.editingPhoneId = null;
  document.getElementById('modalPhoneTitle').textContent = 'Intake Mobile Handset (IMEI Tracking)';
  document.getElementById('phoneId').value = '';
  document.getElementById('phoneImei').value = '';
  document.getElementById('phoneImei').disabled = false;
  document.getElementById('phoneBrand').value = '';
  document.getElementById('phoneModel').value = '';
  document.getElementById('phoneStorage').value = '128GB';
  document.getElementById('phoneColor').value = '';
  document.getElementById('phoneGrade').value = 'Brand New (Sealed)';
  document.getElementById('phoneWarranty').value = 'Official 1-Year Brand Warranty';
  document.getElementById('phoneBattery').value = '100';
  document.getElementById('phoneCost').value = '';
  document.getElementById('phonePrice').value = '';
  document.getElementById('phoneNotes').value = '';
  setProductImagePreview('phone', '');
  document.getElementById('imeiFeedback').textContent = 'Must be unique per handset device.';
  document.getElementById('imeiFeedback').className = 'text-[11px] mt-1 text-gray-500';

  handlePhoneConditionChange();
  openModal('modalPhone');
  setTimeout(() => document.getElementById('phoneImei').focus(), 50);
}

async function openEditPhoneModal(id) {
  try {
    const res = await fetch('/api/phones');
    const phones = await res.json();
    const phone = phones.find(p => p.id === id);
    if (!phone) return;

    state.editingPhoneId = id;
    document.getElementById('modalPhoneTitle').textContent = 'Edit Handset Details';
    document.getElementById('phoneId').value = phone.id;
    document.getElementById('phoneImei').value = phone.imei_number;
    document.getElementById('phoneBrand').value = phone.brand;
    document.getElementById('phoneModel').value = phone.model;
    document.getElementById('phoneStorage').value = phone.storage_capacity;
    document.getElementById('phoneColor').value = phone.color || '';
    document.getElementById('phoneGrade').value = phone.condition_grade;
    document.getElementById('phoneWarranty').value = phone.warranty_type || 'Official 1-Year Brand Warranty';
    document.getElementById('phoneBattery').value = phone.battery_health;
    document.getElementById('phoneCost').value = phone.purchase_cost;
    document.getElementById('phonePrice').value = phone.selling_price;
    document.getElementById('phoneNotes').value = phone.notes || '';
    setProductImagePreview('phone', phone.image || '');

    handlePhoneConditionChange();
    openModal('modalPhone');
  } catch (err) {
    showToast('Failed to load phone details', '❌');
  }
}

async function checkImeiDuplicate(imei) {
  if (!imei || !imei.trim()) return;
  const currentId = document.getElementById('phoneId').value;
  try {
    const res = await fetch(`/api/phones/check-imei/${encodeURIComponent(imei.trim())}`);
    const data = await res.json();
    const feedback = document.getElementById('imeiFeedback');

    if (data.exists && (!currentId || data.phone.id != currentId)) {
      feedback.textContent = `⚠️ IMEI already registered to ${data.phone.brand} ${data.phone.model} (Status: ${data.phone.status})`;
      feedback.className = 'text-[11px] mt-1 text-red-600 font-bold';
      document.getElementById('btnSavePhone').disabled = true;
    } else {
      feedback.textContent = '✅ IMEI available for intake.';
      feedback.className = 'text-[11px] mt-1 text-emerald-600 font-bold';
      document.getElementById('btnSavePhone').disabled = false;
    }
  } catch (_) {}
}

async function handleSavePhone(e) {
  e.preventDefault();
  const id = document.getElementById('phoneId').value;
  const payload = {
    imei_number: document.getElementById('phoneImei').value.trim(),
    brand: document.getElementById('phoneBrand').value.trim(),
    model: document.getElementById('phoneModel').value.trim(),
    storage_capacity: document.getElementById('phoneStorage').value,
    color: document.getElementById('phoneColor').value.trim() || 'Standard',
    condition_grade: document.getElementById('phoneGrade').value,
    warranty_type: document.getElementById('phoneWarranty').value,
    battery_health: parseInt(document.getElementById('phoneBattery').value, 10) || 100,
    purchase_cost: parseFloat(document.getElementById('phoneCost').value) || 0,
    selling_price: parseFloat(document.getElementById('phonePrice').value) || 0,
    notes: document.getElementById('phoneNotes').value.trim(),
    image: document.getElementById('phoneImageData')?.value || ''
  };

  try {
    const url = id ? `/api/phones/${id}` : '/api/phones';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save handset');

    closeModal('modalPhone');
    showToast(id ? 'Handset updated!' : 'Handset registered into inventory!');
    loadPhonesTable();
  } catch (err) {
    showToast(err.message, '❌');
  }
}

async function deletePhone(id) {
  if (!confirm('Are you sure you want to remove this handset from inventory?')) return;
  try {
    const res = await fetch(`/api/phones/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete phone');

    showToast('Handset removed', '🗑️');
    loadPhonesTable();
  } catch (err) {
    showToast(err.message, '❌');
  }
}

/* =========================================================
   INVENTORY: OUT OF STOCK MANAGEMENT & CSV REORDER
========================================================= */
async function updateOutOfStockBadge() {
  try {
    const res = await fetch('/api/items/out-of-stock?type=all');
    const items = await res.json();
    const count = Array.isArray(items) ? items.length : 0;
    const badge = document.getElementById('invOutOfStockCountBadge');
    if (badge) {
      badge.textContent = count;
      if (count > 0) {
        badge.className = 'bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold';
      } else {
        badge.className = 'bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold';
      }
    }
  } catch (_) {}
}

async function loadOutOfStockTable() {
  const search = document.getElementById('invSearchInput')?.value.trim() || '';
  const typeFilter = document.getElementById('outOfStockTypeFilter')?.value || 'all';

  let queryUrl = `/api/items/out-of-stock?type=${encodeURIComponent(typeFilter)}&`;
  if (search) queryUrl += `search=${encodeURIComponent(search)}&`;

  const tbody = document.getElementById('outOfStockTableBody');
  const totalPill = document.getElementById('outOfStockTotalPill');

  try {
    const res = await fetch(queryUrl);
    const rawItems = await res.json();
    const items = Array.isArray(rawItems) ? rawItems : [];

    if (totalPill) {
      totalPill.textContent = `${items.length} Product${items.length === 1 ? '' : 's'}`;
    }

    const badge = document.getElementById('invOutOfStockCountBadge');
    if (badge && typeFilter === 'all' && !search) {
      badge.textContent = items.length;
      if (items.length > 0) {
        badge.className = 'bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold';
      } else {
        badge.className = 'bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold';
      }
    }

    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-12">
            <div class="flex flex-col items-center justify-center space-y-2 text-gray-400">
              <span class="text-3xl">🎉</span>
              <p class="text-sm font-semibold text-gray-600">Great job! No out-of-stock products in this view.</p>
              <p class="text-xs text-gray-400">All inventory items are well-stocked.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isPhone = item.item_type === 'phone' || !!item.imei_number;
      const thumb = item.image
        ? `<img src="${item.image}" alt="" class="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0 shadow-xs">`
        : `<div class="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs flex-shrink-0 text-gray-400">${isPhone ? '📱' : '📦'}</div>`;

      const title = isPhone
        ? `${item.brand} ${item.model} ${item.storage_capacity || ''}`
        : item.title;

      const subDetail = isPhone
        ? `<p class="text-[10px] text-gray-500">${item.condition_grade || 'Handset'} ${item.warranty_type ? '• ' + item.warranty_type : ''}</p>`
        : `<p class="text-[10px] text-gray-400 font-mono">Alert Limit: ${item.min_alert_threshold || 5} pcs</p>`;

      const code = isPhone ? item.imei_number : item.sku_or_barcode;
      const typeLabel = isPhone
        ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">📱 Handset</span>`
        : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">📦 Accessory</span>`;

      const category = isPhone ? (item.brand || 'Phone') : (item.category_name || 'General');
      const location = isPhone ? '-' : (item.rack_location ? `📍 ${item.rack_location}` : '-');
      const cost = isPhone ? item.purchase_cost : item.cost_price;
      const price = item.selling_price;

      const stockBadge = isPhone
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-200 text-gray-800">Sold (0)</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">0 Stock</span>`;

      const safeName = (isPhone ? `${item.brand} ${item.model}` : item.title).replace(/'/g, "\\'");
      const restockAction = isPhone
        ? `<button onclick="quickRestockPhone('${item.id}', '${safeName}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95" title="Mark back in stock">+ In-Stock</button>
           <button onclick="openEditPhoneModal('${item.id}')" class="text-gray-500 hover:text-indigo-600 font-semibold text-xs ml-1.5">Edit</button>`
        : `<button onclick="quickRestockItem('${item.id}', 'accessory', '${safeName}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95" title="Quick add inventory quantity">+ Restock</button>
           <button onclick="openEditItemModal('${item.id}')" class="text-gray-500 hover:text-indigo-600 font-semibold text-xs ml-1.5">Edit</button>`;

      return `
        <tr class="hover:bg-red-50/20 bg-red-50/10">
          <td class="px-4 py-3">
            <div class="flex items-center space-x-2.5">
              ${thumb}
              <div>
                <span class="font-bold text-gray-900">${title}</span>
                ${subDetail}
              </div>
            </div>
          </td>
          <td class="px-4 py-3">${typeLabel}</td>
          <td class="px-4 py-3 font-mono font-bold text-gray-800">${code}</td>
          <td class="px-4 py-3 text-gray-600">${category}</td>
          <td class="px-4 py-3 text-gray-600 font-mono text-[11px]">${location}</td>
          <td class="px-4 py-3 text-right text-gray-600 owner-only-stat">${formatMoney(cost)}</td>
          <td class="px-4 py-3 text-right font-bold text-gray-900">${formatMoney(price)}</td>
          <td class="px-4 py-3 text-center">${stockBadge}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            ${restockAction}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load out of stock items:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-red-500">Failed to load out-of-stock items: ${err.message}</td></tr>`;
  }
}

async function quickRestockItem(id, type, name) {
  const input = prompt(`Restock "${name}"\nEnter quantity to add to inventory:`, "10");
  if (input === null) return;
  const qty = parseInt(input.trim(), 10);
  if (isNaN(qty) || qty <= 0) {
    showToast('Please enter a valid positive quantity', '⚠️');
    return;
  }

  try {
    const res = await fetch(`/api/items/${id}/adjust-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: qty })
    });
    if (res.ok) {
      showToast(`Added +${qty} pcs to "${name}"! Back in active inventory.`, '✅');
      loadOutOfStockTable();
      loadAccessoriesTable();
      loadPosCatalog();
      updateOutOfStockBadge();
    } else {
      showToast('Failed to adjust stock', '❌');
    }
  } catch (err) {
    showToast('Error adjusting stock: ' + err.message, '❌');
  }
}

async function quickRestockPhone(id, name) {
  const confirmRestore = confirm(`Mark handset "${name}" back as "In-Stock"?\n(If this is a new IMEI handset unit, use "Add Handset" instead).`);
  if (!confirmRestore) return;
  try {
    const res = await fetch(`/api/phones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'In-Stock' })
    });
    if (res.ok) {
      showToast(`Handset "${name}" marked In-Stock!`, '✅');
      loadOutOfStockTable();
      loadPhonesTable();
      loadPosCatalog();
      updateOutOfStockBadge();
    } else {
      showToast('Failed to update handset status', '❌');
    }
  } catch (err) {
    showToast('Error: ' + err.message, '❌');
  }
}

async function exportOutOfStockCsv() {
  try {
    showToast('Generating Out-of-Stock CSV...', '⏳');
    const res = await fetch('/api/items/out-of-stock?type=all');
    const items = await res.json();

    if (!items || items.length === 0) {
      showToast('No out-of-stock products found to export!', 'ℹ️');
      return;
    }

    let csv = '\uFEFFItem Type,SKU or IMEI,Product Name / Model,Category or Brand,Tak / Location,Cost Price (BDT),Selling Price (BDT),Current Stock,Min Alert Limit,Suggested Reorder Qty\r\n';

    for (const item of items) {
      const isPhone = item.item_type === 'phone' || !!item.imei_number;
      const type = isPhone ? 'Mobile Handset' : 'Accessory';
      const code = isPhone ? item.imei_number : (item.sku_or_barcode || '');
      const name = isPhone ? `${item.brand} ${item.model} ${item.storage_capacity || ''} (${item.condition_grade || 'Pre-Owned'})` : (item.title || '');
      const category = isPhone ? item.brand : (item.category_name || 'General');
      const location = isPhone ? '-' : (item.rack_location || '-');
      const cost = Number(isPhone ? item.purchase_cost : item.cost_price || 0).toFixed(2);
      const price = Number(item.selling_price || 0).toFixed(2);
      const stock = isPhone ? '0 (Sold)' : (item.stock_quantity || 0);
      const alertLimit = isPhone ? '1' : (item.min_alert_threshold || 5);
      const reorderQty = isPhone ? '1' : Math.max(10, (item.min_alert_threshold || 5) * 2);

      const row = [
        `"${type}"`,
        `"${code}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${category.replace(/"/g, '""')}"`,
        `"${location.replace(/"/g, '""')}"`,
        cost,
        price,
        `"${stock}"`,
        alertLimit,
        reorderQty
      ].join(',');
      csv += row + '\r\n';
    }

    const filename = `outofstock-products-${new Date().toISOString().slice(0, 10)}.csv`;
    await downloadOrShareCsv(filename, csv);
  } catch (err) {
    console.error('Export CSV failed:', err);
    showToast('Failed to export CSV: ' + err.message, '❌');
  }
}

/* =========================================================
   INVOICES & ORDERS HISTORY (CARD-BASED VIEW - MOCKUP 4)
========================================================= */
state.orderFilterTab = 'all';

function filterOrdersTab(filterName) {
  state.orderFilterTab = filterName;
  ['all', 'paid', 'due', 'void'].forEach(f => {
    const btn = document.getElementById(`orderFilterBtn-${f}`);
    if (btn) {
      if (f === filterName) {
        btn.className = 'cat-pill active bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition';
      } else {
        btn.className = 'cat-pill bg-gray-100 text-gray-700 hover:bg-gray-200 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition';
      }
    }
  });
  renderOrdersCards();
}

let orderSearchTimer;
function debouncedSearchOrders() {
  clearTimeout(orderSearchTimer);
  orderSearchTimer = setTimeout(() => {
    renderOrdersCards();
  }, 250);
}

async function loadOrdersTable() {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    state.allOrders = Array.isArray(orders) ? orders : [];
    renderOrdersCards();
  } catch (err) {
    console.error('Failed to load orders:', err);
    const container = document.getElementById('ordersCardList');
    if (container) {
      container.innerHTML = `<div class="text-center py-8 text-red-500 font-medium bg-white rounded-2xl border border-gray-200">Failed to load sales records: ${err.message}</div>`;
    }
  }
}

function renderOrdersCards() {
  const container = document.getElementById('ordersCardList');
  if (!container) return;

  const orders = state.allOrders || [];

  // Update total count badge
  const totalCountEl = document.getElementById('ordersCount-all');
  if (totalCountEl) totalCountEl.textContent = orders.length;

  // 1. Calculate Today's KPI metrics for widget (Mockup 4)
  const todayIso = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.created_at && o.created_at.startsWith(todayIso) && o.status !== 'VOID');
  const todayGross = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount || o.final_amount || 0)), 0);
  const todayProfit = todayOrders.reduce((sum, o) => sum + (parseFloat(o.profit_margin || 0)), 0);
  const marginPct = todayGross > 0 ? ((todayProfit / todayGross) * 100).toFixed(1) + '%' : '0%';
  const paidTodayCount = todayOrders.filter(o => !o.is_emi || !o.emi_remaining_due || parseFloat(o.emi_remaining_due) <= 0).length;
  const paidPct = todayOrders.length > 0 ? Math.round((paidTodayCount / todayOrders.length) * 100) : 100;

  const kpiGrossEl = document.getElementById('kpiTodayGross');
  const kpiProfitEl = document.getElementById('kpiTodayProfit');
  const kpiCountEl = document.getElementById('kpiTodayCount');
  const kpiMarginSub = document.getElementById('kpiTodayMarginSub');
  const kpiPaidSub = document.getElementById('kpiTodayPaidSub');
  const dateBadge = document.getElementById('ordersTodayDateBadge');

  if (kpiGrossEl) kpiGrossEl.textContent = formatMoney(todayGross);
  if (kpiProfitEl) kpiProfitEl.textContent = '+ ' + formatMoney(todayProfit);
  if (kpiCountEl) kpiCountEl.textContent = todayOrders.length;
  if (kpiMarginSub) kpiMarginSub.textContent = `${marginPct} margin`;
  if (kpiPaidSub) kpiPaidSub.textContent = `${paidPct}% Paid`;
  if (dateBadge) {
    dateBadge.textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // 2. Filter orders
  let filtered = orders;
  const searchInput = document.getElementById('orderSearchInput')?.value.trim().toLowerCase() || '';
  if (searchInput) {
    filtered = filtered.filter(o => {
      const inv = (o.invoice_number || '').toLowerCase();
      const cust = (o.customer_name || '').toLowerCase();
      const phone = (o.customer_phone || '').toLowerCase();
      const nid = (o.customer_nid || '').toLowerCase();
      return inv.includes(searchInput) || cust.includes(searchInput) || phone.includes(searchInput) || nid.includes(searchInput);
    });
  }

  if (state.orderFilterTab === 'paid') {
    filtered = filtered.filter(o => o.status !== 'VOID' && (!o.is_emi || !o.emi_remaining_due || parseFloat(o.emi_remaining_due) <= 0));
  } else if (state.orderFilterTab === 'due') {
    filtered = filtered.filter(o => o.status !== 'VOID' && o.is_emi && parseFloat(o.emi_remaining_due || 0) > 0);
  } else if (state.orderFilterTab === 'void') {
    filtered = filtered.filter(o => o.status === 'VOID');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-xs">
        <span class="text-3xl block mb-2">📄</span>
        <p class="text-sm font-bold text-gray-700">No invoices found in this view</p>
        <p class="text-xs text-gray-400 mt-1">Try switching filter tabs or clear your search.</p>
      </div>
    `;
    return;
  }

  // 3. Render Cards matching Mockup 4
  container.innerHTML = filtered.map(o => {
    const isEmi = o.is_emi == 1 || o.is_emi === true;
    const isShopInstallment = isEmi && o.emi_type === 'Shop Installment';
    const isBankEmi = isEmi && o.emi_type === 'Bank EMI';
    const hasDue = isShopInstallment && (parseFloat(o.emi_remaining_due) > 0);
    const isVoid = o.status === 'VOID';
    const isOwner = window.AuthSecurity && window.AuthSecurity.isOwner();
    const displayNid = isOwner ? o.customer_nid : (window.AuthSecurity ? window.AuthSecurity.maskNid(o.customer_nid) : o.customer_nid);

    const itemsList = Array.isArray(o.items) ? o.items : [];
    const computedSubtotal = itemsList.reduce((acc, it) => acc + (parseFloat(it.selling_price || it.unit_price || 0) * (parseInt(it.quantity, 10) || 1)), 0);
    const subtotalVal = (o.subtotal !== undefined && o.subtotal !== null && Number(o.subtotal) > 0)
      ? parseFloat(o.subtotal)
      : (computedSubtotal || parseFloat(o.total_amount || 0));
    const discountVal = parseFloat(o.discount || o.discount_amount || 0);
    const totalAmountVal = (o.total_amount !== undefined && o.total_amount !== null && Number(o.total_amount) > 0)
      ? parseFloat(o.total_amount)
      : (o.final_amount ? parseFloat(o.final_amount) : Math.max(0, subtotalVal - discountVal));
    const computedCost = itemsList.reduce((acc, it) => acc + (parseFloat(it.cost_price || it.purchase_cost || it.unit_cost || 0) * (parseInt(it.quantity, 10) || 1)), 0);
    const costVal = parseFloat(o.total_cost || computedCost || 0);
    const profitVal = (o.profit_margin !== undefined && o.profit_margin !== null && Number(o.profit_margin) !== 0)
      ? parseFloat(o.profit_margin)
      : (totalAmountVal - costVal);
    const orderIdStr = String(o.id || o.invoice_number || '');

    const isHandset = itemsList.some(it => it.item_type === 'phone' || it.type === 'phone' || !!it.imei_number);
    const isHighValue = totalAmountVal >= 50000 || isHandset;

    // Time format
    let timeStr = '';
    try {
      timeStr = new Date(o.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (_) {
      timeStr = '';
    }

    // Status Pill & Summary
    let statusBadge = '';
    let statusSummaryHtml = '';
    if (isVoid) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">Void</span>';
      statusSummaryHtml = '<span class="w-2 h-2 rounded-full bg-red-500"></span><span class="font-bold text-red-600">Voided / Cancelled</span>';
    } else if (hasDue) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Due</span>';
      statusSummaryHtml = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span class="font-bold text-amber-700">Due: ${formatMoney(o.emi_remaining_due)}</span>`;
    } else {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Paid</span>';
      statusSummaryHtml = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="font-medium text-gray-600">Settled in full</span>';
    }

    // Payment method pill
    let paymentMethodPill = '';
    if (isBankEmi) {
      paymentMethodPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-100">Bank EMI (${o.emi_tenure_months}M)</span>`;
    } else if (isShopInstallment) {
      paymentMethodPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-100">Installment (${o.emi_tenure_months}M)</span>`;
    } else {
      paymentMethodPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700">${o.payment_method || 'Cash'}</span>`;
    }

    // Action buttons
    let actionButtons = '';
    if (isVoid) {
      actionButtons = `
        <button onclick="reprintOrderReceipt('${orderIdStr}')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 transition shadow-xs">
          <span>🖨️ Receipt</span>
        </button>
        <button onclick="deleteInvoice('${orderIdStr}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg text-xs font-bold transition active:scale-95" title="Permanently delete invoice">
          🗑️
        </button>
      `;
    } else if (hasDue) {
      actionButtons = `
        <button onclick="openCollectEmiModal('${orderIdStr}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 transition shadow-xs active:scale-95">
          <span>💰 Collect</span>
        </button>
        <button onclick="reprintOrderReceipt('${orderIdStr}')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 transition shadow-xs active:scale-95">
          <span>🖨️ Receipt</span>
        </button>
        <button onclick="openVoidInvoiceModal('${orderIdStr}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg text-xs font-bold transition active:scale-95" title="Void invoice">
          🚫
        </button>
        <button onclick="deleteInvoice('${orderIdStr}')" class="text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg text-xs font-bold transition active:scale-95" title="Permanently delete invoice">
          🗑️
        </button>
      `;
    } else {
      const receiptBtnClass = isHighValue
        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-xs';
      actionButtons = `
        <button onclick="reprintOrderReceipt('${orderIdStr}')" class="${receiptBtnClass} font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1 transition active:scale-95">
          <span>🖨️ Receipt</span>
        </button>
        <button onclick="openVoidInvoiceModal('${orderIdStr}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95" title="Void invoice">
          🚫 Void
        </button>
        <button onclick="deleteInvoice('${orderIdStr}')" class="text-gray-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95" title="Permanently delete invoice">
          🗑️
        </button>
      `;
    }

    return `
      <div class="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs hover:shadow-md transition relative space-y-3 ${isHighValue ? 'border-blue-300 ring-1 ring-blue-100' : ''}">
        ${isHighValue ? `
          <div class="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
            HIGH VALUE TRANSACTION
          </div>
        ` : ''}

        <!-- Top Row: Invoice #, Time, Customer Name & Phone, Status Badges -->
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                ${o.invoice_number}
              </span>
              <span class="text-[11px] text-gray-400 font-medium">
                ${timeStr}
              </span>
            </div>
            <div class="mt-1 text-xs text-gray-900 font-bold">
              <span>${o.customer_name || 'Walk-in Customer'}</span>
              ${o.customer_phone ? `<span class="text-gray-400 font-normal"> • ${o.customer_phone}</span>` : ''}
            </div>
            ${displayNid ? `<div class="text-[10px] text-gray-400 font-mono">NID: ${displayNid}</div>` : ''}
            ${isVoid && o.void_reason ? `<div class="text-[10px] text-red-500 italic mt-0.5">Void reason: ${o.void_reason}</div>` : ''}
          </div>

          <div class="flex flex-col items-end space-y-1">
            ${statusBadge}
            ${paymentMethodPill}
          </div>
        </div>

        <!-- Financial Metrics Row (TOTAL PRICE | NET PROFIT | DISCOUNT) -->
        <div class="grid grid-cols-3 gap-2 py-2.5 border-y border-gray-100 text-xs">
          <div>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">${isHandset ? 'TOTAL DEVICE' : 'TOTAL PRICE'}</span>
            <span class="font-black text-gray-900 text-sm sm:text-base block mt-0.5">${formatMoney(totalAmountVal)}</span>
          </div>
          <div class="owner-only-stat">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">NET PROFIT</span>
            <span class="font-black text-emerald-600 text-sm sm:text-base block mt-0.5">+ ${formatMoney(profitVal)}</span>
          </div>
          <div class="text-right">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">DISCOUNT</span>
            <span class="font-medium text-gray-600 text-sm sm:text-base block mt-0.5">${discountVal > 0 ? '-' + formatMoney(discountVal) : '৳ 0.00'}</span>
          </div>
        </div>

        <!-- Bottom Row: Status text on left, Actions on right -->
        <div class="flex items-center justify-between pt-0.5">
          <div class="flex items-center space-x-1.5 text-xs">
            ${statusSummaryHtml}
          </div>

          <div class="flex items-center space-x-2">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function reprintOrderReceipt(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const order = await res.json();
    if (!res.ok) throw new Error(order.error || 'Failed to fetch invoice');

    renderReceipt(order);
    openModal('modalReceipt');
  } catch (err) {
    showToast(err.message, '❌');
  }
}

async function openCollectEmiModal(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const order = await res.json();
    if (!res.ok) throw new Error(order.error || 'Failed to fetch order details');

    document.getElementById('emiCollectOrderId').value = order.id;

    const isOwner = window.AuthSecurity && window.AuthSecurity.isOwner();
    const displayNid = isOwner ? order.customer_nid : (window.AuthSecurity ? window.AuthSecurity.maskNid(order.customer_nid) : order.customer_nid);
    const displayPhone = isOwner ? (order.customer_phone || 'No phone') : (window.AuthSecurity ? window.AuthSecurity.maskPhone(order.customer_phone) : (order.customer_phone || 'No phone'));

    // Customer & Invoice summary
    const summaryBox = document.getElementById('emiCollectCustomerDetails');
    const itemsSummary = (order.items || []).map(i => i.title).join(', ');
    summaryBox.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <span class="font-bold text-indigo-900 text-sm">${order.customer_name}</span>
          <span class="block text-gray-500 text-[11px]">📞 ${displayPhone} ${displayNid ? `| NID: ${displayNid}` : ''}</span>
          <span class="block text-gray-600 text-[11px] font-medium mt-0.5 truncate max-w-[280px]">📦 ${itemsSummary}</span>
        </div>
        <span class="font-mono text-[11px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">${order.invoice_number}</span>
      </div>
      <div class="border-t border-indigo-200/60 pt-2 mt-2 grid grid-cols-3 gap-2 text-center">
        <div class="bg-white p-1.5 rounded border border-indigo-100">
          <span class="text-[10px] text-gray-500 block">Total Price</span>
          <span class="font-bold text-gray-800">${formatMoney(order.total_amount)}</span>
        </div>
        <div class="bg-white p-1.5 rounded border border-indigo-100">
          <span class="text-[10px] text-gray-500 block">Total Paid</span>
          <span class="font-bold text-emerald-600">${formatMoney(order.total_amount - order.emi_remaining_due)}</span>
        </div>
        <div class="bg-white p-1.5 rounded border border-red-200">
          <span class="text-[10px] text-red-600 block font-bold">Remaining Due</span>
          <span class="font-extrabold text-red-600">${formatMoney(order.emi_remaining_due)}</span>
        </div>
      </div>
      <div class="text-[11px] text-gray-600 text-right mt-1">
        Agreed Monthly Installment: <span class="font-bold text-indigo-800">${formatMoney(order.emi_monthly_amount)}</span> (${order.emi_tenure_months}M plan)
      </div>
    `;

    // Suggested amount: min of remaining due and regular monthly installment
    const suggestedAmount = Math.min(order.emi_remaining_due, order.emi_monthly_amount || order.emi_remaining_due);
    const amountInput = document.getElementById('emiCollectAmount');
    amountInput.value = suggestedAmount;
    amountInput.max = order.emi_remaining_due;

    // Default note
    const installmentNumber = (order.payments ? order.payments.length : 0) + 1;
    document.getElementById('emiCollectNote').value = `Installment #${installmentNumber}`;

    // Populate payment history
    const historyList = document.getElementById('emiCollectHistoryList');
    const historyCount = document.getElementById('emiCollectHistoryCount');
    const payments = order.payments || [];
    historyCount.textContent = `${payments.length} payment(s) recorded`;

    if (payments.length === 0) {
      historyList.innerHTML = '<div class="text-center py-2 text-gray-400">No installments recorded yet.</div>';
    } else {
      historyList.innerHTML = payments.map(p => {
        const pDate = new Date(p.created_at || p.payment_date).toLocaleDateString();
        return `
          <div class="flex justify-between items-center py-1.5 px-1 border-b border-gray-100 last:border-b-0">
            <div>
              <span class="font-bold text-gray-800">${formatMoney(p.amount_paid)}</span>
              <span class="text-gray-500 text-[10px]"> via ${p.payment_method}</span>
              ${p.notes ? `<span class="text-gray-400 text-[10px] block">${p.notes}</span>` : ''}
            </div>
            <div class="text-right text-[10px] text-gray-500">
              <span>${pDate}</span>
              <span class="block text-gray-400">Remaining: ${formatMoney(p.remaining_balance)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    openModal('modalCollectEmi');
    setTimeout(() => amountInput.focus(), 50);
  } catch (err) {
    showToast(err.message, '❌');
  }
}

async function handleSaveEmiPayment(e) {
  e.preventDefault();
  const orderId = document.getElementById('emiCollectOrderId').value;
  const amount = parseFloat(document.getElementById('emiCollectAmount').value) || 0;
  const payment_method = document.getElementById('emiCollectMethod').value;
  const note = document.getElementById('emiCollectNote').value.trim();

  if (!orderId || amount <= 0) {
    showToast('Please specify a valid payment amount', '⚠️');
    return;
  }

  const btn = document.getElementById('btnSubmitEmiCollection');
  btn.disabled = true;
  btn.textContent = 'Recording...';

  try {
    const res = await fetch('/api/emi/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: parseInt(orderId, 10),
        amount,
        payment_method,
        note
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record installment payment');

    closeModal('modalCollectEmi');
    playBeep(1200, 'triangle', 0.15);
    showToast(`Collected ${formatMoney(amount)}! Remaining: ${formatMoney(data.remaining_balance)}`, '🎉');

    // Refresh orders table
    loadOrdersTable();

    // Render thermal installment money receipt slip
    renderEmiPaymentSlip(data);
    openModal('modalReceipt');
  } catch (err) {
    showToast(err.message, '❌');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Confirm &amp; Print Slip</span>';
  }
}

/* =========================================================
   REPORTS & ANALYTICS
========================================================= */
async function loadReports() {
  const month = document.getElementById('reportMonthSelect').value;
  const year = document.getElementById('reportYearSelect').value;

  try {
    const res = await fetch(`/api/reports/summary?month=${month}&year=${year}`);
    const data = await res.json();

    // Populate KPI Cards
    document.getElementById('kpiRevenue').textContent = formatMoney(data.sales.total_revenue);
    document.getElementById('kpiOrdersCount').textContent = data.sales.total_orders;
    document.getElementById('kpiItemsSold').textContent = data.sales.items_sold;
    document.getElementById('kpiCogs').textContent = formatMoney(data.sales.total_cogs);
    document.getElementById('kpiProfit').textContent = formatMoney(data.sales.gross_profit);
    document.getElementById('kpiMarginPct').textContent = `${data.sales.profit_margin_pct}%`;
    document.getElementById('kpiStockRetail').textContent = formatMoney(data.stock.total_accessory_retail);
    document.getElementById('kpiStockCost').textContent = formatMoney(data.stock.total_accessory_cost);

    // Handset Stats
    document.getElementById('statHandsetsInStock').textContent = data.handsets.in_stock_count;
    document.getElementById('statHandsetCostValue').textContent = formatMoney(data.handsets.in_stock_cost_value);
    document.getElementById('statHandsetsSold').textContent = data.handsets.sold_count;

    // Top Accessories Table
    const topTbody = document.getElementById('topAccessoriesTable');
    if (data.top_accessories && data.top_accessories.length > 0) {
      topTbody.innerHTML = data.top_accessories.map(item => `
        <tr class="hover:bg-gray-50">
          <td class="py-2.5 px-3">
            <span class="font-bold text-gray-800">${item.title}</span>
            <span class="block text-[10px] text-gray-400 font-mono">${item.sku_or_imei}</span>
          </td>
          <td class="py-2.5 px-3 text-center font-bold text-indigo-600">${item.units_sold}</td>
          <td class="py-2.5 px-3 text-right font-extrabold text-gray-900">${formatMoney(item.revenue)}</td>
        </tr>
      `).join('');
    } else {
      topTbody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-gray-400">No accessories sold in this period.</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load reports:', err);
  }
}

/* =========================================================
   UNIVERSAL CSV EXPORT & DOWNLOAD PIPELINE
   Works across Native Android (Downloads & Share), Mobile Web & Desktop
========================================================= */
let currentExportCsvContent = '';
let currentExportCsvFilename = '';

async function downloadOrShareCsv(filename, csvContent) {
  const fullContent = csvContent.startsWith('\uFEFF') ? csvContent : ('\uFEFF' + csvContent);

  // 1. Capacitor Native Plugin (Official bridge for Android APK)
  try {
    const csvPlugin = (window.Capacitor && typeof window.Capacitor.registerPlugin === 'function')
      ? window.Capacitor.registerPlugin('CSVDownloader')
      : (window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.CSVDownloader : null);

    if (csvPlugin && typeof csvPlugin.saveAndShareCsv === 'function') {
      await csvPlugin.saveAndShareCsv({ filename, content: fullContent });
      showToast('CSV saved to Downloads & opened Share options!', '✅');
      return;
    }
  } catch (pluginErr) {
    console.warn('Capacitor CSVDownloader plugin failed:', pluginErr);
  }

  // 2. Android JavascriptInterface Bridge (Secondary native bridge for Android)
  if (window.AndroidCSVBridge && typeof window.AndroidCSVBridge.saveAndShareCsv === 'function') {
    try {
      window.AndroidCSVBridge.saveAndShareCsv(filename, fullContent);
      showToast('CSV saved to Downloads & opened Share options!', '✅');
      return;
    } catch (bridgeErr) {
      console.warn('Native AndroidCSVBridge failed, falling back:', bridgeErr);
    }
  }

  // 3. Modern Web Share API with files (Android Chrome, Mobile Edge, Safari)
  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([fullContent], filename, { type: 'text/csv;charset=utf-8;' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `Mobile Decor & Tech - ${filename}`
        });
        showToast('CSV shared successfully!', '✅');
        return;
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') return; // user closed dialog
      console.warn('navigator.share failed, trying fallback:', shareErr);
    }
  }

  // 4. Desktop Browser Blob Download (Only on web desktop/browsers where Capacitor is NOT present)
  // In Capacitor WebView, <a download> is silently ignored by Android, so we avoid fake download toasts
  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!isNativeApp) {
    try {
      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
      showToast(`CSV downloaded: ${filename}`, '📥');
      return;
    } catch (blobErr) {
      console.warn('Blob download failed:', blobErr);
    }
  }

  // 5. Fallback Modal: User can view, copy to clipboard, or share via WhatsApp
  openCsvFallbackModal(filename, fullContent);
}

function openCsvFallbackModal(filename, content) {
  currentExportCsvFilename = filename;
  currentExportCsvContent = content;
  const fnElem = document.getElementById('csvFallbackFilename');
  const taElem = document.getElementById('csvFallbackText');
  if (fnElem) fnElem.textContent = filename;
  if (taElem) taElem.value = content;
  openModal('modalCsvExport');
}

function copyCsvToClipboard() {
  if (!currentExportCsvContent) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentExportCsvContent).then(() => {
      showToast('CSV copied to clipboard! Paste directly into Excel or Google Sheets.', '📋');
    }).catch(() => fallbackExecCopy());
  } else {
    fallbackExecCopy();
  }
}

function fallbackExecCopy() {
  const ta = document.getElementById('csvFallbackText');
  if (ta) {
    ta.select();
    document.execCommand('copy');
    showToast('CSV copied to clipboard!', '📋');
  }
}

function shareCsvToWhatsApp() {
  if (!currentExportCsvContent) return;
  const preview = currentExportCsvContent.length > 2500 ? currentExportCsvContent.slice(0, 2500) + '\n...[truncated]' : currentExportCsvContent;
  const encoded = encodeURIComponent(`*Mobile Decor & Tech - ${currentExportCsvFilename}*\n\n` + preview);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}

async function exportInventoryCsv() {
  try {
    showToast('Generating inventory CSV...', '⏳');
    const [accRes, phoneRes] = await Promise.all([
      fetch('/api/items'),
      fetch('/api/phones')
    ]);
    const items = await accRes.json();
    const phones = await phoneRes.json();

    let csv = '\uFEFFType,Code or IMEI,Name or Model,Category or Brand,Tak or Location,Cost Price (BDT),Selling Price (BDT),Stock or Status,Alert Limit\r\n';

    if (Array.isArray(items)) {
      for (const i of items) {
        const row = [
          '"Accessory"',
          `"${i.sku_or_barcode || ''}"`,
          `"${(i.title || '').replace(/"/g, '""')}"`,
          `"${(i.category_name || 'General').replace(/"/g, '""')}"`,
          `"${(i.rack_location || '-').replace(/"/g, '""')}"`,
          Number(i.cost_price || 0).toFixed(2),
          Number(i.selling_price || 0).toFixed(2),
          `"${i.stock_quantity ?? 0}"`,
          `"${i.min_alert_threshold ?? 5}"`
        ].join(',');
        csv += row + '\r\n';
      }
    }

    if (Array.isArray(phones)) {
      for (const p of phones) {
        const isBrandNew = p.condition_grade && p.condition_grade.includes('Brand New');
        const phoneType = isBrandNew ? 'Brand New Handset' : 'Pre-Owned Handset';
        const detailStr = isBrandNew ? (p.warranty_type || 'Official 1-Year') : `Battery ${p.battery_health}%`;
        const phoneTitle = `${p.brand || ''} ${p.model || ''} ${p.storage_capacity || ''} (${p.condition_grade || 'Standard'}, ${detailStr})`.trim();
        const row = [
          `"${phoneType}"`,
          `"${p.imei_number || ''}"`,
          `"${phoneTitle.replace(/"/g, '""')}"`,
          `"${p.brand || ''}"`,
          '"-"',
          Number(p.purchase_cost || 0).toFixed(2),
          Number(p.selling_price || 0).toFixed(2),
          `"${p.status || 'In-Stock'}"`,
          '"1"'
        ].join(',');
        csv += row + '\r\n';
      }
    }

    const filename = `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`;
    await downloadOrShareCsv(filename, csv);
  } catch (err) {
    console.error('Inventory CSV export error:', err);
    showToast('Failed to export inventory CSV: ' + err.message, '❌');
  }
}

async function exportSalesCsv() {
  try {
    showToast('Generating sales report CSV...', '⏳');
    const month = document.getElementById('reportMonthSelect')?.value || '';
    const year = document.getElementById('reportYearSelect')?.value || '';

    const res = await fetch('/api/orders');
    let orders = await res.json();

    if (month && year && Array.isArray(orders)) {
      orders = orders.filter(o => {
        const d = new Date(o.created_at);
        return (d.getMonth() + 1) === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
      });
    }

    if (!orders || orders.length === 0) {
      showToast('No sales records found for this period to export!', 'ℹ️');
      return;
    }

    let csv = '\uFEFFInvoice #,Date,Customer,Phone,Items Count,Subtotal (BDT),Discount,Final Total (BDT),Payment Method,EMI Type,Remaining Due\r\n';
    for (const o of orders) {
      const itemsCount = (o.items && Array.isArray(o.items)) ? o.items.length : (o.item_count || 1);
      const row = [
        `"${o.invoice_number || ''}"`,
        `"${new Date(o.created_at).toLocaleString()}"`,
        `"${(o.customer_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
        `"${o.customer_phone || ''}"`,
        itemsCount,
        Number(o.subtotal || o.final_amount || 0).toFixed(2),
        Number(o.discount_amount || 0).toFixed(2),
        Number(o.final_amount || 0).toFixed(2),
        `"${o.payment_method || 'Cash'}"`,
        `"${o.is_emi ? (o.emi_type || 'EMI') : 'Full Payment'}"`,
        Number(o.emi_remaining_due || 0).toFixed(2)
      ].join(',');
      csv += row + '\r\n';
    }

    const dateSuffix = (year && month) ? `${year}-${String(month).padStart(2, '0')}` : new Date().toISOString().slice(0, 10);
    const filename = `sales-report-${dateSuffix}.csv`;
    await downloadOrShareCsv(filename, csv);
  } catch (err) {
    console.error('Sales CSV export error:', err);
    showToast('Failed to export sales CSV: ' + err.message, '❌');
  }
}

/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */
document.addEventListener('keydown', (e) => {
  // Ignore shortcuts if typing inside modals or text inputs
  const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

  if (e.key === 'F2') {
    e.preventDefault();
    switchTab('pos');
  } else if (e.key === 'F3') {
    e.preventDefault();
    switchTab('inventory');
  } else if (e.key === 'F4') {
    e.preventDefault();
    switchTab('reports');
  } else if (e.key === 'Escape') {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  } else if (e.ctrlKey && e.key === 'Enter') {
    // Quick checkout shortcut
    if (state.activeTab === 'pos') {
      e.preventDefault();
      submitCheckout(true);
    }
  }
});

async function deleteInvoice(orderId) {
  if (window.AuthSecurity && !window.AuthSecurity.isOwner()) {
    const authorized = await window.AuthSecurity.requestOwnerRole('Authorize Invoice Deletion');
    if (!authorized) {
      showToast('Owner PIN required to delete invoice.', '🔒');
      return;
    }
  }

  const confirmed = confirm(`Are you sure you want to PERMANENTLY delete Invoice ${orderId}?\n\nThis will remove it completely from all sales records, inventory, and reports.`);
  if (!confirmed) return;

  try {
    showToast('Deleting invoice...', '⏳');
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Invoice deleted permanently', '🗑️');
      await loadOrdersTable();
      if (typeof loadReports === 'function') loadReports();
    } else {
      showToast(data.error || 'Failed to delete invoice', '❌');
    }
  } catch (err) {
    showToast('Failed to delete invoice: ' + err.message, '❌');
  }
}

async function clearAllDemoData() {
  if (window.AuthSecurity && !window.AuthSecurity.isOwner()) {
    const authorized = await window.AuthSecurity.requestOwnerRole('Authorize Database Reset');
    if (!authorized) {
      showToast('Owner PIN required for database reset.', '🔒');
      return;
    }
  }
  if (!confirm('⚠️ WARNING: This will permanently wipe ALL products, phone handsets, invoices, and sales reports from Cloud & Device to start with a fresh, completely clean shop.\n\nAre you sure you want to proceed?')) return;
  try {
    showToast('Clearing all shop data...', '⏳');
    const res = await fetch('/api/admin/reset-demo-data', { method: 'POST' });
    const data = await res.json();
    showToast(data.message || 'All shop data cleared!', '🧹');
    
    // Refresh all views immediately
    if (typeof loadPosCatalog === 'function') loadPosCatalog();
    if (typeof loadAccessoriesTable === 'function') loadAccessoriesTable();
    if (typeof loadPhonesTable === 'function') loadPhonesTable();
    if (typeof loadOrdersTable === 'function') loadOrdersTable();
    if (typeof loadReports === 'function') loadReports();
    if (typeof updateOutOfStockBadge === 'function') updateOutOfStockBadge();
  } catch (err) {
    showToast('Failed to reset data: ' + err.message, '❌');
  }
}

/* =========================================================
   INITIALIZATION ON LOAD
========================================================= */
window.addEventListener('DOMContentLoaded', async () => {
  // Sync reporting dropdown to current month and year
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const monthSelect = document.getElementById('reportMonthSelect');
  const yearSelect = document.getElementById('reportYearSelect');
  if (monthSelect) monthSelect.value = String(curMonth);
  if (yearSelect) yearSelect.value = String(curYear);

  // Fetch Categories first
  await loadCategories();

  // Load initial POS catalog
  loadPosCatalog();

  // Preload inventory counts and tables
  loadAccessoriesTable();
  loadPhonesTable();
  updateOutOfStockBadge();

  // Show local IP from current location
  const host = window.location.hostname;
  const port = window.location.port || '3000';
  document.getElementById('lanIpDisplay').textContent = `http://${host}:${port}`;
});

/* =========================================================
   FIREBASE CLOUD SYNC & MULTI-DEVICE CONTROLLER
========================================================= */

function openCloudSyncModal() {
  const cfg = (window.FirebaseConfig && window.FirebaseConfig.get) ? window.FirebaseConfig.get() : {};
  const isConfigured = window.FirebaseConfig && window.FirebaseConfig.isConfigured();

  const idInp = document.getElementById('fbCfgProjectId');
  const keyInp = document.getElementById('fbCfgApiKey');
  const authInp = document.getElementById('fbCfgAuthDomain');
  const appInp = document.getElementById('fbCfgAppId');

  if (idInp) idInp.value = (cfg.projectId && !cfg.projectId.includes('your-shop-pos')) ? cfg.projectId : '';
  if (keyInp) keyInp.value = (cfg.apiKey && !cfg.apiKey.includes('YOUR_FIREBASE_API_KEY')) ? cfg.apiKey : '';
  if (authInp) authInp.value = (cfg.authDomain && !cfg.authDomain.includes('your-shop-pos')) ? cfg.authDomain : '';
  if (appInp) appInp.value = (cfg.appId && !cfg.appId.includes('1:123456789012')) ? cfg.appId : '';

  const statusTitle = document.getElementById('cloudModalStatusTitle');
  const statusDesc = document.getElementById('cloudModalStatusDesc');
  const statusDot = document.getElementById('cloudModalStatusDot');

  if (statusTitle && statusDesc && statusDot) {
    if (window.FirebaseDB && window.FirebaseDB.isConfigured()) {
      if (window.FirebaseDB.syncState === 'connected') {
        statusDot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse';
        statusTitle.textContent = 'Cloud Synced Across Devices';
        statusDesc.textContent = `Connected to Firebase project "${cfg.projectId}". All phones sync in real time.`;
      } else {
        statusDot.className = 'w-3 h-3 rounded-full bg-amber-500 animate-pulse';
        statusTitle.textContent = 'Offline (IndexedDB Persistence)';
        statusDesc.textContent = 'Working offline. Pending transactions will auto-sync when network returns.';
      }
    } else {
      statusDot.className = 'w-3 h-3 rounded-full bg-indigo-500';
      statusTitle.textContent = 'Local-Only Mode Active';
      statusDesc.textContent = 'Data is stored on this phone. Enter your free Firebase credentials below to sync across all phones!';
    }
  }

  openModal('modalCloudSync');
}

async function saveAndConnectFirebase() {
  const projectId = (document.getElementById('fbCfgProjectId')?.value || '').trim();
  const apiKey = (document.getElementById('fbCfgApiKey')?.value || '').trim();
  const authDomain = (document.getElementById('fbCfgAuthDomain')?.value || '').trim() || `${projectId}.firebaseapp.com`;
  const appId = (document.getElementById('fbCfgAppId')?.value || '').trim();
  const storageBucket = `${projectId}.appspot.com`;

  if (!projectId || !apiKey || !appId) {
    showToast('Please provide Project ID, API Key, and App ID.', '⚠️');
    return;
  }

  const newConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    appId
  };

  try {
    showToast('Connecting to Firebase Cloud...', '⏳');
    window.FirebaseConfig.save(newConfig);

    const success = await window.FirebaseDB.init();
    if (success) {
      showToast('Firebase Cloud Connected & Synced!', '☁️');
      closeModal('modalCloudSync');
      loadPosCatalog();
      loadAccessoriesTable();
      loadPhonesTable();
      updateOutOfStockBadge();
    } else {
      showToast('Connection failed. Check your Firebase credentials or network.', '❌');
    }
  } catch (err) {
    console.error('Firebase save error:', err);
    showToast('Failed to connect: ' + err.message, '❌');
  }
}

async function triggerLocalToCloudMigration() {
  if (!window.FirebaseDB || !window.FirebaseDB.isConfigured()) {
    showToast('Please connect Firebase Cloud first before uploading local stock.', '⚠️');
    return;
  }

  if (!confirm('Upload all existing products and handsets from this phone to Firebase Cloud? Other phones will immediately receive them.')) {
    return;
  }

  try {
    showToast('Uploading local inventory to Firebase Cloud...', '⏳');
    const result = await window.FirebaseDB.migrateFromLocalDB();
    showToast(`Successfully uploaded ${result.migratedCount} items to Cloud!`, '🚀');
    loadPosCatalog();
    loadAccessoriesTable();
    loadPhonesTable();
    updateOutOfStockBadge();
  } catch (err) {
    console.error('Migration error:', err);
    showToast('Upload failed: ' + err.message, '❌');
  }
}

async function resetFirebaseToLocal() {
  if (window.AuthSecurity && !window.AuthSecurity.isOwner()) {
    const authorized = await window.AuthSecurity.requestOwnerOverride('Manager Cloud Disconnect', 'Switching back to Local-Only mode requires Owner PIN verification.');
    if (!authorized) {
      showToast('Owner PIN required to disconnect cloud mode.', '🔒');
      return;
    }
  }
  if (!confirm('Disconnect from Firebase Cloud and switch back to Local-Only mode on this phone?')) return;
  if (window.FirebaseConfig) window.FirebaseConfig.clear();
  if (window.FirebaseDB) {
    window.FirebaseDB.syncState = 'local_only';
    window.FirebaseDB._updateStatusUI();
  }
  showToast('Switched to Local-Only mode.', '📱');
  closeModal('modalCloudSync');
  loadPosCatalog();
  loadAccessoriesTable();
  loadPhonesTable();
  updateOutOfStockBadge();
}

// Attach Real-Time Multi-Device Listener
if (window.FirebaseDB && window.FirebaseDB.onSync) {
  window.FirebaseDB.onSync((type, data) => {
    console.log(`[Realtime Sync Event] Received updated ${type} from Cloud`);
    if (type === 'items' || type === 'phones') {
      loadPosCatalog();
      if (state.activeTab === 'inventory') {
        loadAccessoriesTable();
        loadPhonesTable();
        loadOutOfStockTable();
      }
      updateOutOfStockBadge();
    } else if (type === 'categories') {
      loadCategories();
    } else if (type === 'orders') {
      if (state.activeTab === 'orders') loadOrdersTable();
      if (state.activeTab === 'reports') loadReports();
    }
  });
}

/* =========================================================
   SECURITY & ROLE ACCESS CONTROL CONTROLLERS
========================================================= */

function updateSecurityUI(role) {
  const isOwner = role === 'owner';
  const roleBadge = document.getElementById('roleBadge');
  const roleText = document.getElementById('roleBadgeText');
  const roleIcon = document.getElementById('roleBadgeIcon');
  const secRoleText = document.getElementById('secCurrentRoleText');
  const secRoleDesc = document.getElementById('secRoleDesc');
  const secRoleBtn = document.getElementById('secRoleBtn');

  if (roleBadge) {
    if (isOwner) {
      roleBadge.className = 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200 transition shadow-xs cursor-pointer flex-shrink-0 text-sm';
      roleBadge.innerHTML = '👑';
      roleBadge.title = 'Owner Mode (Active). Tap to manage security.';
    } else {
      roleBadge.className = 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center border border-gray-200 transition shadow-xs cursor-pointer flex-shrink-0 text-sm';
      roleBadge.innerHTML = '👤';
      roleBadge.title = 'Staff Mode. Tap to enter Owner PIN.';
    }
  }

  if (secRoleText) {
    secRoleText.textContent = isOwner ? '👑 Owner / Admin Mode' : '👤 Staff Mode';
    secRoleText.className = isOwner ? 'text-sm font-black text-amber-700' : 'text-sm font-black text-gray-800';
  }
  if (secRoleDesc) {
    secRoleDesc.textContent = isOwner
      ? 'All financial margins, wholesale cost prices, and management controls are unlocked.'
      : 'Wholesale costs, profit analytics, and sensitive records are concealed.';
  }
  if (secRoleBtn) {
    secRoleBtn.textContent = isOwner ? '🔒 Lock to Staff' : '👑 Unlock Owner';
    secRoleBtn.className = isOwner
      ? 'px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg text-xs shadow-sm transition'
      : 'px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition';
  }

  // Refresh active views so owner-only elements and masked fields update
  if (state.activeTab === 'inventory') {
    if (state.inventorySubTab === 'accessories') loadAccessoriesTable();
    else if (state.inventorySubTab === 'phones') loadPhonesTable();
    else if (state.inventorySubTab === 'outofstock') loadOutOfStockTable();
  } else if (state.activeTab === 'orders') {
    loadOrdersTable();
  } else if (state.activeTab === 'reports') {
    if (isOwner) loadReports();
    else switchTab('pos');
  }
}

// Hook into security role change listener
if (window.AuthSecurity) {
  window.AuthSecurity.onRoleChange((newRole) => {
    updateSecurityUI(newRole);
  });
}

function openSecurityModal() {
  const isOwner = window.AuthSecurity && window.AuthSecurity.isOwner();
  updateSecurityUI(isOwner ? 'owner' : 'staff');

  const oldInp = document.getElementById('secOldOwnerPin');
  const newInp = document.getElementById('secNewOwnerPin');
  const staffAuthInp = document.getElementById('secStaffOwnerAuthPin');
  const newStaffInp = document.getElementById('secNewStaffPin');
  if (oldInp) oldInp.value = '';
  if (newInp) newInp.value = '';
  if (staffAuthInp) staffAuthInp.value = '';
  if (newStaffInp) newStaffInp.value = '';

  if (window.AuthSecurity && typeof window.AuthSecurity.updateBiometricSettingsUI === 'function') {
    window.AuthSecurity.updateBiometricSettingsUI();
  }

  openModal('modalSecuritySettings');
}

async function switchRoleAction() {
  if (!window.AuthSecurity) return;
  if (window.AuthSecurity.isOwner()) {
    window.AuthSecurity.logoutToStaff();
    closeModal('modalSecuritySettings');
    showToast('Locked to Staff Mode. Wholesale costs hidden.', '🔒');
  } else {
    closeModal('modalSecuritySettings');
    const success = await window.AuthSecurity.requestOwnerRole('Switch to Owner Mode');
    if (success) {
      showToast('Welcome, Owner! All management tools unlocked.', '👑');
    }
  }
}

async function handleUpdateOwnerPin() {
  const oldPin = (document.getElementById('secOldOwnerPin')?.value || '').trim();
  const newPin = (document.getElementById('secNewOwnerPin')?.value || '').trim();

  if (!oldPin || !newPin) {
    showToast('Please enter both Old PIN and New PIN.', '⚠️');
    return;
  }
  if (!/^\d{4,6}$/.test(newPin)) {
    showToast('New PIN must be 4 to 6 numeric digits.', '⚠️');
    return;
  }

  try {
    const ok = await window.AuthSecurity.changeOwnerPin(oldPin, newPin);
    if (ok) {
      showToast('Owner PIN updated & synced to Cloud!', '✅');
      document.getElementById('secOldOwnerPin').value = '';
      document.getElementById('secNewOwnerPin').value = '';
    } else {
      showToast('Incorrect Old Owner PIN.', '❌');
    }
  } catch (err) {
    showToast('Failed to change PIN: ' + err.message, '❌');
  }
}

async function handleUpdateStaffPin() {
  const ownerPin = (document.getElementById('secStaffOwnerAuthPin')?.value || '').trim();
  const newStaffPin = (document.getElementById('secNewStaffPin')?.value || '').trim();

  if (!ownerPin || !newStaffPin) {
    showToast('Please enter Owner PIN and New Staff PIN.', '⚠️');
    return;
  }
  if (!/^\d{4,6}$/.test(newStaffPin)) {
    showToast('Staff PIN must be 4 to 6 numeric digits.', '⚠️');
    return;
  }

  try {
    const ok = await window.AuthSecurity.changeStaffPin(ownerPin, newStaffPin);
    if (ok) {
      showToast('Staff PIN updated & synced to Cloud!', '✅');
      document.getElementById('secStaffOwnerAuthPin').value = '';
      document.getElementById('secNewStaffPin').value = '';
    } else {
      showToast('Incorrect Owner Authorization PIN.', '❌');
    }
  } catch (err) {
    showToast('Failed to update Staff PIN: ' + err.message, '❌');
  }
}

/* =========================================================
   INVOICE VOIDING & AUDIT TRAIL
========================================================= */
let pendingVoidOrderId = null;

function openVoidInvoiceModal(orderId) {
  pendingVoidOrderId = orderId;
  const inputElem = document.getElementById('voidInvoiceId');
  const subElem = document.getElementById('voidInvoiceSubtitle');
  const notesElem = document.getElementById('voidNotesInput');
  const reasonElem = document.getElementById('voidReasonSelect');

  if (inputElem) inputElem.value = orderId;
  if (subElem) subElem.textContent = `Invoice: ${orderId}`;
  if (notesElem) notesElem.value = '';
  if (reasonElem) reasonElem.selectedIndex = 0;

  openModal('modalVoidInvoice');
}

async function executeVoidInvoice() {
  const orderId = pendingVoidOrderId || document.getElementById('voidInvoiceId')?.value;
  if (!orderId) {
    showToast('No order selected to void', '⚠️');
    return;
  }

  const reason = document.getElementById('voidReasonSelect')?.value || 'Store Return';
  const notes = document.getElementById('voidNotesInput')?.value.trim() || '';
  const fullReason = notes ? `${reason} (${notes})` : reason;

  // Verify Owner authorization
  if (window.AuthSecurity && !window.AuthSecurity.isOwner()) {
    closeModal('modalVoidInvoice');
    const authorized = await window.AuthSecurity.requestOwnerOverride(
      'Manager Void Authorization',
      `Owner PIN required to void invoice ${orderId} and replenish inventory.`
    );
    if (!authorized) {
      showToast('Invoice voiding aborted: Owner PIN required.', '🔒');
      return;
    }
  } else {
    closeModal('modalVoidInvoice');
  }

  try {
    showToast('Voiding invoice and restocking...', '⏳');
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: fullReason, notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to void invoice');

    playBeep(880, 'sine', 0.15);
    showToast(`Invoice ${orderId} voided! Inventory replenished.`, '✅');

    // Reload tables and POS catalog
    loadOrdersTable();
    loadPosCatalog();
    loadAccessoriesTable();
    loadPhonesTable();
    loadOutOfStockTable();
    updateOutOfStockBadge();
    if (state.activeTab === 'reports') loadReports();
  } catch (err) {
    console.error('Void invoice error:', err);
    showToast('Void failed: ' + err.message, '❌');
  }
}

/* =========================================================
   1-TAP DAILY ENCRYPTED BACKUP & DISASTER RECOVERY
========================================================= */

async function triggerDailyBackup() {
  try {
    showToast('Generating secure daily backup...', '⏳');
    const res = await fetch('/api/backup/export');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to export backup');

    const timestampStr = new Date().toISOString().slice(0, 10);
    const filename = `Biplob-POS-Backup-${timestampStr}.posbak`;
    const jsonStr = JSON.stringify(data, null, 2);

    const counts = data.counts || {
      items: (data.items || []).length,
      phones: (data.phones || []).length,
      orders: (data.orders || []).length
    };
    const caption = `*Mobile Decor & Tech - POS Daily Backup*\n📅 Date: ${timestampStr}\n📦 Accessories: ${counts.items}\n📱 Handsets: ${counts.phones}\n🧾 Total Invoices: ${counts.orders}\n🔒 Encrypted format: .posbak`;

    // 1. Capacitor Native Android Plugin
    try {
      const csvPlugin = (window.Capacitor && typeof window.Capacitor.registerPlugin === 'function')
        ? window.Capacitor.registerPlugin('CSVDownloader')
        : (window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.CSVDownloader : null);

      if (csvPlugin && typeof csvPlugin.saveAndShareBackup === 'function') {
        await csvPlugin.saveAndShareBackup({ filename, content: jsonStr, caption });
        showToast('Backup saved to Downloads & opened Share Sheet!', '✅');
        if (window.AuthSecurity) {
          window.AuthSecurity.logAudit('DATABASE_BACKUP_EXPORTED', { filename, counts });
        }
        return;
      }
    } catch (pluginErr) {
      console.warn('Capacitor saveAndShareBackup failed:', pluginErr);
    }

    // 2. Android JavascriptInterface Bridge
    if (window.AndroidCSVBridge && typeof window.AndroidCSVBridge.saveAndShareBackup === 'function') {
      try {
        window.AndroidCSVBridge.saveAndShareBackup(filename, jsonStr, caption);
        showToast('Backup saved to Downloads & opened Share Sheet!', '✅');
        if (window.AuthSecurity) {
          window.AuthSecurity.logAudit('DATABASE_BACKUP_EXPORTED', { filename, counts });
        }
        return;
      } catch (bridgeErr) {
        console.warn('AndroidCSVBridge saveAndShareBackup failed:', bridgeErr);
      }
    }

    // 3. Web Share API with File
    if (navigator.canShare && navigator.share) {
      try {
        const file = new File([jsonStr], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: caption
          });
          showToast('Backup shared successfully!', '✅');
          if (window.AuthSecurity) {
            window.AuthSecurity.logAudit('DATABASE_BACKUP_EXPORTED', { filename, counts });
          }
          return;
        }
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') return;
      }
    }

    // 4. Desktop Browser Blob Download fallback
    const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!isNativeApp) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
      showToast(`Backup downloaded: ${filename}`, '📥');
      return;
    }

    // 5. Fallback CSV/JSON modal
    openCsvFallbackModal(filename, jsonStr);
  } catch (err) {
    console.error('Backup error:', err);
    showToast('Backup failed: ' + err.message, '❌');
  }
}

function openRestoreModal() {
  const fileInput = document.getElementById('restoreFileInput');
  const passInput = document.getElementById('restorePasswordInput');
  if (fileInput) fileInput.value = '';
  if (passInput) passInput.value = '';
  openModal('modalRestoreBackup');
}

async function executeRestoreBackup() {
  const fileInput = document.getElementById('restoreFileInput');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a backup file (.posbak or .json).', '⚠️');
    return;
  }

  // Owner PIN challenge
  if (window.AuthSecurity && !window.AuthSecurity.isOwner()) {
    const authorized = await window.AuthSecurity.requestOwnerOverride(
      'Manager Restore Authorization',
      'Owner PIN is required to restore database and replace current records.'
    );
    if (!authorized) {
      showToast('Database restore cancelled: Owner authorization required.', '🔒');
      return;
    }
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      showToast('Restoring database snapshot...', '⏳');
      const text = e.target.result;
      const parsedData = JSON.parse(text);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to restore database');

      closeModal('modalRestoreBackup');
      closeModal('modalSecuritySettings');
      playBeep(1200, 'triangle', 0.2);
      showToast(`Database restored! Loaded ${result.restoredCount || 'all'} records.`, '🎉');

      // Reload UI tables
      loadPosCatalog();
      loadAccessoriesTable();
      loadPhonesTable();
      loadOutOfStockTable();
      loadOrdersTable();
      updateOutOfStockBadge();
      if (state.activeTab === 'reports') loadReports();
    } catch (parseErr) {
      console.error('Restore error:', parseErr);
      showToast('Failed to restore backup: ' + parseErr.message, '❌');
    }
  };

  reader.onerror = () => {
    showToast('Could not read selected file.', '❌');
  };

  reader.readAsText(file);
}
