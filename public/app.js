/* =========================================================
   BIPLOB SHOP - FRONTEND APPLICATION JAVASCRIPT
========================================================= */

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
  if (modal) modal.showModal();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.close();
}

// Number & Currency Formatting
function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return '৳ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =========================================================
   TAB SWITCHING & NAVIGATION
========================================================= */
function switchTab(tabName) {
  state.activeTab = tabName;

  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-indigo-800', 'text-white');
    btn.classList.add('text-indigo-200');
  });

  const activeBtn = document.getElementById(`tabBtn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'text-white');
    activeBtn.classList.remove('text-indigo-200');
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
    } else {
      loadPhonesTable();
    }
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
  const viewAcc = document.getElementById('subView-accessories');
  const viewPhone = document.getElementById('subView-phones');
  const btnAddText = document.getElementById('btnAddItemText');

  if (subTab === 'accessories') {
    btnAcc.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-sm flex items-center space-x-2';
    btnPhone.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center space-x-2';
    viewAcc.classList.remove('hidden');
    viewPhone.classList.add('hidden');
    btnAddText.textContent = 'Add Accessory';
    loadAccessoriesTable();
  } else {
    btnPhone.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white shadow-sm flex items-center space-x-2';
    btnAcc.className = 'px-4 py-2 text-sm font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center space-x-2';
    viewPhone.classList.remove('hidden');
    viewAcc.classList.add('hidden');
    btnAddText.textContent = 'Add Handset (IMEI)';
    loadPhonesTable();
  }
}

/* =========================================================
   CATEGORY MANAGEMENT
========================================================= */
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    state.categories = categories;

    // Populate Category filter in Inventory
    const invCatFilter = document.getElementById('invCatFilter');
    invCatFilter.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Populate Item Modal category select
    const itemCatSelect = document.getElementById('itemCategory');
    itemCatSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Populate POS Category Pills
    renderPosCategoryPills();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function renderPosCategoryPills() {
  const container = document.getElementById('posCategoryPills');
  let html = `
    <button onclick="filterPosCatalog('all')" class="cat-pill ${state.posFilter === 'all' ? 'active bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-full font-medium whitespace-nowrap">
      All Items
    </button>
    <button onclick="filterPosCatalog('phone')" class="cat-pill ${state.posFilter === 'phone' ? 'active bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-full font-medium whitespace-nowrap flex items-center space-x-1">
      <span>📱 Mobile Handsets</span>
    </button>
  `;

  state.categories.forEach(cat => {
    const active = String(state.posFilter) === String(cat.id);
    html += `
      <button onclick="filterPosCatalog('${cat.id}')" class="cat-pill ${active ? 'active bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-full font-medium whitespace-nowrap">
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
          <span class="inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
            ✨ Brand New
          </span>
          <span class="inline-flex items-center text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded" title="${item.warranty_type || 'Official 1-Year'}">
            🛡️ ${item.warranty_type ? item.warranty_type.replace('Brand Warranty', 'Warranty').replace('Shop Service Warranty', 'Shop').slice(0, 16) : '1-Yr'}
          </span>
        `;
      } else {
        const gradeColor = item.condition_grade.includes('A') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
        badge = `
          <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeColor}">
            ${item.condition_grade}
          </span>
          <span class="inline-flex items-center text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            🔋 ${item.battery_health}%
          </span>
        `;
      }
    } else {
      badge = `
        <span class="text-[11px] font-medium ${item.stock_quantity <= 5 ? 'text-red-600 font-bold' : 'text-gray-500'}">
          Stock: ${item.stock_quantity}
        </span>
      `;
    }

    return `
      <div
        onclick="handleCatalogItemClick(${item.id}, '${item.type}')"
        class="bg-white border rounded-lg p-3 cursor-pointer hover:border-indigo-500 hover:shadow transition relative flex flex-col justify-between ${isOutOfStock ? 'opacity-50 pointer-events-none bg-gray-50' : 'border-gray-200'}"
      >
        <div>
          <div class="flex items-start justify-between gap-1 mb-1.5">
            <span class="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
              ${item.code}
            </span>
            <div class="flex items-center space-x-1">
              ${badge}
            </div>
          </div>
          <div class="flex items-center space-x-2.5">
            ${item.image ? `
              <img src="${item.image}" alt="" class="w-11 h-11 rounded-lg object-cover border border-gray-200 flex-shrink-0 shadow-xs">
            ` : `
              <div class="w-11 h-11 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-base flex-shrink-0 text-gray-400">
                ${isPhone ? '📱' : '📦'}
              </div>
            `}
            <h4 class="font-bold text-gray-800 text-xs line-clamp-2 leading-snug">${item.title}</h4>
          </div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span class="font-extrabold text-indigo-700 text-sm">${formatMoney(item.selling_price)}</span>
          <button class="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-xs font-bold px-2 py-1 rounded transition flex items-center space-x-1">
            <span>+ Add</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleCatalogItemClick(id, type) {
  const item = state.posCatalog.find(i => i.id === id && i.type === type);
  if (item) {
    addToCart(item);
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
    const exists = state.cart.find(c => c.type === 'phone' && c.id === product.id);
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
    const existingIndex = state.cart.findIndex(c => c.type === 'accessory' && c.id === product.id);

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
            <span class="text-xs font-bold text-gray-500 px-2 py-1 bg-gray-100 rounded">1 unit</span>
          ` : `
            <div class="flex items-center border border-gray-300 rounded bg-white">
              <button onclick="updateCartQuantity(${index}, -1)" class="px-2 py-0.5 text-gray-600 hover:bg-gray-100 font-bold">-</button>
              <span class="px-2 py-0.5 font-bold text-gray-800 min-w-[20px] text-center">${item.quantity}</span>
              <button onclick="updateCartQuantity(${index}, 1)" class="px-2 py-0.5 text-gray-600 hover:bg-gray-100 font-bold">+</button>
            </div>
          `}

          <div class="text-right min-w-[65px]">
            <span class="font-bold text-gray-900">${formatMoney(lineTotal)}</span>
          </div>

          <button onclick="removeFromCart(${index})" class="text-gray-400 hover:text-red-600 p-1 transition" title="Remove">
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
  const total = Math.max(0, subtotal - discount);

  const payload = {
    customer_name: custName,
    customer_phone: custPhone,
    payment_method: state.paymentMethod,
    discount,
    items: state.cart.map(c => ({
      id: c.id,
      item_type: c.type,
      quantity: c.quantity,
      unit_price: c.unit_price,
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

    // Render receipt
    renderReceipt(data);
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
  state.currentReceiptOrder = order;
  state.currentReceiptPayment = null;
  const container = document.getElementById('receiptPrintArea');
  const dateFormatted = new Date(order.created_at).toLocaleString();

  let itemsHtml = '';
  order.items.forEach(item => {
    const isPhone = item.item_type === 'phone';
    itemsHtml += `
      <div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: bold;">${item.title}</span>
        </div>
        ${isPhone ? `<div style="font-size: 10px; color: #333;">★ IMEI: ${item.sku_or_imei}</div>` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #444;">
          <span>${item.quantity} x ${formatMoney(item.unit_price)}</span>
          <span>${formatMoney(item.total_price)}</span>
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
      <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">BIPLOB SHOP</div>
      <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">MOBILE RETAIL & ACCESSORIES</div>
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
        <span>${formatMoney(order.subtotal)}</span>
      </div>
      ${order.discount > 0 ? `
      <div style="display: flex; justify-content: space-between; color: #d9534f;">
        <span>Discount:</span>
        <span>- ${formatMoney(order.discount)}</span>
      </div>` : ''}
      <div class="receipt-double-line"></div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;">
        <span>TOTAL PRICE:</span>
        <span>${formatMoney(order.total_amount)}</span>
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
      <div style="margin-top: 8px; font-weight: bold;">Thank You For Choosing Biplob Shop!</div>
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
      <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">BIPLOB SHOP</div>
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
      Biplob Shop POS System
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
`🧾 *BIPLOB SHOP - INSTALLMENT MONEY RECEIPT*
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
*Biplob Shop - Mobile & Accessories*`;

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
`🧾 *BIPLOB SHOP - SALES INVOICE*
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
Thank you for shopping with Biplob Shop!
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

/* =========================================================
   PRODUCT PHOTO HANDLING & CLIENT-SIDE COMPRESSION
========================================================= */
function handleProductImageFile(input, prefix = 'item') {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  compressAndLoadImage(file, (dataUrl) => {
    setProductImagePreview(prefix, dataUrl);
    showToast('Product photo attached!', '📷');
  });
  input.value = '';
}

function compressAndLoadImage(file, callback, maxWidth = 600, maxHeight = 600, quality = 0.75) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      callback(compressedDataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setProductImagePreview(prefix, dataUrl) {
  const hiddenInput = document.getElementById(`${prefix}ImageData`);
  const previewImg = document.getElementById(`${prefix}ImagePreview`);
  const placeholder = document.getElementById(`${prefix}ImagePlaceholder`);
  const removeBtn = document.getElementById(`${prefix}ImageRemoveBtn`);

  if (hiddenInput) hiddenInput.value = dataUrl || '';
  if (dataUrl) {
    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
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
    } else {
      loadPhonesTable();
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
    const items = await res.json();

    document.getElementById('invAccCountBadge').textContent = items.length;
    const tbody = document.getElementById('accessoriesTableBody');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">No accessories found.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isLow = item.stock_quantity <= item.min_alert_threshold;
      return `
        <tr class="hover:bg-gray-50 ${isLow ? 'bg-red-50/40' : ''}">
          <td class="px-4 py-3 font-mono font-semibold text-gray-800">${item.sku_or_barcode}</td>
          <td class="px-4 py-3">
            <div class="flex items-center space-x-2.5">
              ${item.image ? `<img src="${item.image}" alt="" class="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0 shadow-xs">` : `<div class="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs flex-shrink-0 text-gray-400">📦</div>`}
              <span class="font-bold text-gray-900">${item.title}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-gray-600">${item.category_name || 'General'}</td>
          <td class="px-4 py-3">
            ${item.rack_location ? `
              <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono text-[11px] font-semibold">
                📍 ${item.rack_location}
              </span>
            ` : `<span class="text-gray-400 italic text-[11px]">-</span>`}
          </td>
          <td class="px-4 py-3 text-right text-gray-600">${formatMoney(item.cost_price)}</td>
          <td class="px-4 py-3 text-right font-bold text-gray-900">${formatMoney(item.selling_price)}</td>
          <td class="px-4 py-3 text-center">
            <div class="inline-flex items-center space-x-1.5">
              <button onclick="quickAdjustStock(${item.id}, -1)" class="w-5 h-5 rounded bg-gray-200 text-gray-700 hover:bg-red-200 font-bold text-xs flex items-center justify-center">-</button>
              <span class="font-extrabold px-1.5 ${isLow ? 'text-red-600' : 'text-gray-900'}">${item.stock_quantity}</span>
              <button onclick="quickAdjustStock(${item.id}, 1)" class="w-5 h-5 rounded bg-gray-200 text-gray-700 hover:bg-emerald-200 font-bold text-xs flex items-center justify-center">+</button>
            </div>
          </td>
          <td class="px-4 py-3 text-center text-gray-500">${item.min_alert_threshold}</td>
          <td class="px-4 py-3 text-center">
            ${isLow ? `
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700">
                ⚠️ Low (${item.stock_quantity})
              </span>
            ` : `
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                In-Stock
              </span>
            `}
          </td>
          <td class="px-4 py-3 text-right space-x-1">
            <button onclick="openEditItemModal(${item.id})" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs">Edit</button>
            <span class="text-gray-300">|</span>
            <button onclick="deleteItem(${item.id})" class="text-red-600 hover:text-red-800 font-semibold text-xs">Del</button>
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
          <td class="px-4 py-3 text-right text-gray-600">${formatMoney(p.purchase_cost)}</td>
          <td class="px-4 py-3 text-right font-bold text-gray-900">${formatMoney(p.selling_price)}</td>
          <td class="px-4 py-3 text-right text-emerald-700 font-bold">${formatMoney(marginEst)}</td>
          <td class="px-4 py-3 text-center">
            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'In-Stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}">
              ${p.status}
            </span>
          </td>
          <td class="px-4 py-3 text-right space-x-1">
            <button onclick="openEditPhoneModal(${p.id})" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs">Edit</button>
            ${!isSold ? `
              <span class="text-gray-300">|</span>
              <button onclick="deletePhone(${p.id})" class="text-red-600 hover:text-red-800 font-semibold text-xs">Del</button>
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
   INVOICES & ORDERS HISTORY
========================================================= */
let orderSearchTimer;
function debouncedSearchOrders() {
  clearTimeout(orderSearchTimer);
  orderSearchTimer = setTimeout(() => {
    loadOrdersTable();
  }, 250);
}

async function loadOrdersTable() {
  const search = document.getElementById('orderSearchInput')?.value.trim() || '';
  const emiFilter = document.getElementById('orderEmiFilter')?.value || '';

  let url = '/api/orders?';
  const params = [];
  if (search) params.push(`search=${encodeURIComponent(search)}`);

  if (emiFilter === 'active_due') {
    url = `/api/emi/orders?status=Active`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
  } else {
    if (emiFilter === '1') params.push('is_emi=1');
    url += params.join('&');
  }

  try {
    const res = await fetch(url);
    const orders = await res.json();
    const tbody = document.getElementById('ordersTableBody');

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400 font-medium">No sales transactions found.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const isEmi = o.is_emi == 1 || o.is_emi === true;
      const isShopInstallment = isEmi && o.emi_type === 'Shop Installment';
      const isBankEmi = isEmi && o.emi_type === 'Bank EMI';
      const hasDue = isShopInstallment && (parseFloat(o.emi_remaining_due) > 0);

      // Payment / Plan Badge
      let paymentBadge = '';
      if (isBankEmi) {
        paymentBadge = `
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">🏦 Bank EMI (${o.emi_tenure_months}M)</span>
          <span class="block text-[10px] text-gray-500 font-medium mt-0.5">${o.emi_bank_name || 'Bank Card'}</span>
        `;
      } else if (isShopInstallment) {
        paymentBadge = `
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">📋 Installment (${o.emi_tenure_months}M)</span>
          <span class="block text-[10px] text-gray-500 font-medium mt-0.5">${formatMoney(o.emi_monthly_amount)}/mo</span>
        `;
      } else {
        paymentBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">${o.payment_method}</span>`;
      }

      // Due / Paid display
      let duePaidHtml = '';
      if (isShopInstallment) {
        if (hasDue) {
          duePaidHtml = `
            <span class="text-xs font-bold text-red-600 block">Due: ${formatMoney(o.emi_remaining_due)}</span>
            <span class="text-[10px] text-emerald-600 block font-medium">Paid: ${formatMoney(o.total_amount - o.emi_remaining_due)}</span>
          `;
        } else {
          duePaidHtml = `
            <span class="text-xs font-bold text-emerald-600 block">✅ Fully Paid</span>
            <span class="text-[10px] text-gray-400 block font-medium">Total: ${formatMoney(o.total_amount)}</span>
          `;
        }
      } else {
        duePaidHtml = `<span class="text-xs font-bold text-gray-800 block">${formatMoney(o.total_amount)}</span><span class="text-[10px] text-emerald-600 block font-medium">Paid</span>`;
      }

      // Actions button
      let actionButtons = '';
      if (hasDue) {
        actionButtons = `
          <div class="flex items-center justify-center space-x-1">
            <button onclick="openCollectEmiModal(${o.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded text-xs transition shadow-sm" title="Collect Monthly Installment">
              💰 Collect
            </button>
            <button onclick="reprintOrderReceipt(${o.id})" class="bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold px-2 py-1 rounded text-xs transition" title="Print Invoice">
              Receipt
            </button>
          </div>
        `;
      } else {
        actionButtons = `
          <button onclick="reprintOrderReceipt(${o.id})" class="bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold px-2 py-1 rounded text-xs transition">
            Receipt
          </button>
        `;
      }

      return `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 font-mono font-bold text-indigo-700">${o.invoice_number}</td>
          <td class="px-4 py-3 text-gray-600 text-[11px]">${new Date(o.created_at).toLocaleString()}</td>
          <td class="px-4 py-3">
            <span class="font-bold text-gray-900">${o.customer_name}</span>
            ${o.customer_phone ? `<span class="block text-[10px] text-gray-500 font-medium">${o.customer_phone}</span>` : ''}
            ${o.customer_nid ? `<span class="block text-[10px] text-gray-400 font-mono">NID: ${o.customer_nid}</span>` : ''}
          </td>
          <td class="px-4 py-3">
            ${paymentBadge}
          </td>
          <td class="px-4 py-3 text-right text-gray-600">${formatMoney(o.subtotal)}</td>
          <td class="px-4 py-3 text-right text-red-600 font-medium">${o.discount > 0 ? '-' + formatMoney(o.discount) : '৳ 0.00'}</td>
          <td class="px-4 py-3 text-right">
            ${duePaidHtml}
          </td>
          <td class="px-4 py-3 text-right text-emerald-700 font-bold">${formatMoney(o.profit_margin)}</td>
          <td class="px-4 py-3 text-center">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
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

    // Customer & Invoice summary
    const summaryBox = document.getElementById('emiCollectCustomerDetails');
    const itemsSummary = (order.items || []).map(i => i.title).join(', ');
    summaryBox.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <span class="font-bold text-indigo-900 text-sm">${order.customer_name}</span>
          <span class="block text-gray-500 text-[11px]">📞 ${order.customer_phone || 'No phone'} ${order.customer_nid ? `| NID: ${order.customer_nid}` : ''}</span>
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

function exportSalesCsv() {
  const month = document.getElementById('reportMonthSelect')?.value;
  const year = document.getElementById('reportYearSelect')?.value;
  let url = '/api/reports/export/sales.csv';
  if (month && year) url += `?month=${month}&year=${year}`;
  window.location.href = url;
}

function exportInventoryCsv() {
  window.location.href = '/api/reports/export/inventory.csv';
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

async function clearAllDemoData() {
  if (!confirm('Are you sure you want to remove all sample demo products and start with a completely empty shop?')) return;
  try {
    const res = await fetch('/api/admin/reset-demo-data', { method: 'POST' });
    const data = await res.json();
    showToast(data.message || 'Demo data cleared', '🧹');
    loadPosCatalog();
    loadAccessoriesTable();
    loadPhonesTable();
    if (state.activeTab === 'reports') loadReports();
  } catch (err) {
    showToast('Failed to reset data', '❌');
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

  // Show local IP from current location
  const host = window.location.hostname;
  const port = window.location.port || '3000';
  document.getElementById('lanIpDisplay').textContent = `http://${host}:${port}`;
});
