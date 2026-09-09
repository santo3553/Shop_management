/* =========================================================
   BIPLOB SHOP - POS SECURITY & ACCESS CONTROL ENGINE
   Role-Based PIN Protection, Manager Override, Auto-Lock, & Audit Log
   ========================================================= */

const AuthSecurity = {
  SALT: '_biplob_pos_salt_2026_',
  STORAGE_KEY: 'biplob_pos_security_config',
  AUDIT_STORAGE_KEY: 'biplob_pos_audit_logs',
  AUTO_LOCK_TIMEOUT_MS: 2 * 60 * 1000, // 2 minutes

  // Active session role: 'staff' (default) | 'owner'
  currentRole: 'staff',
  autoLockTimer: null,
  roleListeners: [],
  activeChallengeResolver: null,

  // Default salted hashes (Owner: '1234', Staff: '0000')
  // Computed via SHA-256(PIN + SALT)
  credentials: {
    ownerPinHash: '',
    staffPinHash: '',
    updatedAt: ''
  },

  /**
   * Initializes security engine, sets default PINs if empty, and starts auto-lock
   */
  async init() {
    // 1. Calculate default hashes if not yet loaded
    const defaultOwnerHash = await this.hashPin('1234');
    const defaultStaffHash = await this.hashPin('0000');

    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.credentials = JSON.parse(saved);
      }
    } catch (_) {}

    if (!this.credentials.ownerPinHash) {
      this.credentials.ownerPinHash = defaultOwnerHash;
    }
    if (!this.credentials.staffPinHash) {
      this.credentials.staffPinHash = defaultStaffHash;
    }
    this._saveLocal();

    // Default to Staff Mode on start
    this.currentRole = 'staff';
    this._setupAutoLockListeners();
    this.updateUI();

    // Try synchronizing with Firestore cloud config if available
    this._syncFromCloud();
  },

  /**
   * Cryptographically hashes a PIN string using SHA-256 + salt
   */
  async hashPin(pin) {
    if (!pin) return '';
    const salted = String(pin).trim() + this.SALT;
    const encoder = new TextEncoder();
    const data = encoder.encode(salted);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Verifies if candidate PIN matches the Owner PIN hash
   */
  async verifyOwnerPin(pin) {
    if (!pin) return false;
    const hash = await this.hashPin(pin);
    return hash === this.credentials.ownerPinHash;
  },

  /**
   * Verifies if candidate PIN matches the Staff PIN hash
   */
  async verifyStaffPin(pin) {
    if (!pin) return false;
    const hash = await this.hashPin(pin);
    return hash === this.credentials.staffPinHash;
  },

  /**
   * Updates Owner PIN (requires old Owner PIN)
   */
  async changeOwnerPin(oldPin, newPin) {
    if (!(await this.verifyOwnerPin(oldPin))) {
      throw new Error('Current Owner PIN is incorrect');
    }
    if (!newPin || String(newPin).length < 4) {
      throw new Error('New PIN must be at least 4 digits');
    }
    this.credentials.ownerPinHash = await this.hashPin(newPin);
    this.credentials.updatedAt = new Date().toISOString();
    this._saveLocal();
    await this._syncToCloud();
    await this.logAudit('OWNER_PIN_CHANGED', 'Owner PIN was updated successfully');
    return true;
  },

  /**
   * Updates Staff PIN (requires Owner authorization)
   */
  async changeStaffPin(ownerPin, newStaffPin) {
    if (!(await this.verifyOwnerPin(ownerPin))) {
      throw new Error('Owner PIN required to update Staff PIN');
    }
    if (!newStaffPin || String(newStaffPin).length < 4) {
      throw new Error('New Staff PIN must be at least 4 digits');
    }
    this.credentials.staffPinHash = await this.hashPin(newStaffPin);
    this.credentials.updatedAt = new Date().toISOString();
    this._saveLocal();
    await this._syncToCloud();
    await this.logAudit('STAFF_PIN_CHANGED', 'Staff PIN was updated by Owner');
    return true;
  },

  isOwner() {
    return this.currentRole === 'owner';
  },

  isStaff() {
    return this.currentRole === 'staff';
  },

  /**
   * Switches active session to Owner mode upon PIN entry
   */
  async loginAsOwner(pin) {
    const valid = await this.verifyOwnerPin(pin);
    if (!valid) return false;
    this.currentRole = 'owner';
    this._resetAutoLockTimer();
    this.updateUI();
    this._notifyListeners();
    await this.logAudit('OWNER_LOGIN', 'Owner mode unlocked');
    return true;
  },

  /**
   * Drops active session back to Staff mode
   */
  logoutToStaff() {
    if (this.currentRole === 'staff') return;
    this.currentRole = 'staff';
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.updateUI();
    this._notifyListeners();
  },

  /**
   * One-Time Manager Override:
   * Requests Owner PIN to approve a single sensitive operation (e.g. discount > 10% or invoice void)
   * WITHOUT switching the permanent role to Owner.
   */
  requestOwnerOverride(actionTitle = 'Owner Authorization Required', subtext = '') {
    return new Promise((resolve) => {
      // If already in Owner mode, approve automatically
      if (this.isOwner()) {
        resolve(true);
        return;
      }

      this.activeChallengeResolver = resolve;
      this._openPinModal(actionTitle, subtext, false);
    });
  },

  /**
   * Requests Owner PIN to permanently switch session into Owner Mode
   */
  requestOwnerLogin(actionTitle = 'Enter Owner PIN to Unlock Full Access') {
    return new Promise((resolve) => {
      if (this.isOwner()) {
        resolve(true);
        return;
      }

      this.activeChallengeResolver = async (success) => {
        if (success) {
          this.currentRole = 'owner';
          this._resetAutoLockTimer();
          this.updateUI();
          this._notifyListeners();
          await this.logAudit('OWNER_LOGIN', 'Owner mode unlocked via PIN');
        }
        resolve(success);
      };
      this._openPinModal(actionTitle, 'Unlocks Wholesale Costs, Profit Reports & System Settings', true);
    });
  },

  _openPinModal(title, subtext, isRoleSwitch = false) {
    const modal = document.getElementById('modalPinChallenge');
    if (!modal) {
      // Fallback to prompt if modal HTML not yet inserted
      const input = prompt(`${title}\n${subtext}\nEnter Owner PIN:`);
      this.verifyOwnerPin(input).then(valid => {
        if (this.activeChallengeResolver) this.activeChallengeResolver(valid);
        this.activeChallengeResolver = null;
      });
      return;
    }

    const titleEl = document.getElementById('pinChallengeTitle');
    const subEl = document.getElementById('pinChallengeSubtitle');
    const inputEl = document.getElementById('pinChallengeInput');
    const errEl = document.getElementById('pinChallengeError');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtext || 'Please enter Owner PIN to proceed';
    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    if (errEl) errEl.classList.add('hidden');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (inputEl) setTimeout(() => inputEl.focus(), 100);
  },

  /**
   * Called when user submits the PIN in the PIN modal
   */
  async submitPinChallenge() {
    const inputEl = document.getElementById('pinChallengeInput');
    const errEl = document.getElementById('pinChallengeError');
    const pin = inputEl ? inputEl.value.trim() : '';

    const isValid = await this.verifyOwnerPin(pin);
    if (isValid) {
      this.closePinModal();
      if (this.activeChallengeResolver) {
        this.activeChallengeResolver(true);
        this.activeChallengeResolver = null;
      }
    } else {
      if (errEl) {
        errEl.textContent = '❌ Incorrect Owner PIN. Try again.';
        errEl.classList.remove('hidden');
      }
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
    }
  },

  closePinModal() {
    const modal = document.getElementById('modalPinChallenge');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    if (this.activeChallengeResolver) {
      this.activeChallengeResolver(false);
      this.activeChallengeResolver = null;
    }
  },

  /**
   * Auto-Lock setup: drops to Staff mode after 2 minutes of idle inactivity
   */
  _setupAutoLockListeners() {
    const resetTimer = () => {
      if (this.isOwner()) {
        this._resetAutoLockTimer();
      }
    };

    ['touchstart', 'mousedown', 'keydown', 'scroll'].forEach(evt => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    // Auto-lock when phone screen turns off or app is minimized
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isOwner()) {
        this.logoutToStaff();
        if (window.showToast) window.showToast('Locked to Staff Mode for security.', '🔒');
      }
    });
  },

  _resetAutoLockTimer() {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = setTimeout(() => {
      if (this.isOwner()) {
        this.logoutToStaff();
        if (window.showToast) window.showToast('Auto-locked to Staff Mode after 2m idle.', '🔒');
      }
    }, this.AUTO_LOCK_TIMEOUT_MS);
  },

  /**
   * Masking helpers for Staff view
   */
  maskNid(nid) {
    if (!nid) return '';
    if (this.isOwner()) return nid;
    const str = String(nid).trim();
    if (str.length <= 4) return '••••';
    return '••••••••' + str.slice(-4);
  },

  maskGuarantor(val) {
    if (!val) return '';
    if (this.isOwner()) return val;
    const str = String(val).trim();
    if (str.length <= 4) return '••••';
    return '••••••' + str.slice(-4);
  },

  /**
   * Updates UI badges, hides/reveals cost and profit metrics
   */
  updateUI() {
    // 1. Role Badge in top navbar
    const badge = document.getElementById('roleBadge');
    if (badge) {
      if (this.isOwner()) {
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span class="text-amber-200 font-bold">👑 Owner View</span>
        `;
        badge.className = 'flex items-center space-x-1.5 bg-amber-950/80 text-amber-200 px-2.5 py-1 rounded-md border border-amber-600/60 text-[11px] font-semibold cursor-pointer hover:bg-amber-900 transition shadow-sm';
        badge.title = 'Owner mode active. Click to lock to Staff Mode.';
      } else {
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-blue-400"></span>
          <span class="text-indigo-200 font-medium">👤 Staff Mode</span>
        `;
        badge.className = 'flex items-center space-x-1.5 bg-indigo-950/70 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-700/50 text-[11px] font-semibold cursor-pointer hover:bg-indigo-900 transition shadow-sm';
        badge.title = 'Staff mode. Click to unlock Owner View with PIN.';
      }
    }

    // 2. Hide or show elements with class 'owner-only-stat'
    document.querySelectorAll('.owner-only-stat').forEach(el => {
      if (this.isOwner()) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // 3. Body class for CSS-level visibility rules
    if (this.isOwner()) {
      document.body.classList.add('role-owner');
      document.body.classList.remove('role-staff');
    } else {
      document.body.classList.add('role-staff');
      document.body.classList.remove('role-owner');
    }
  },

  onRoleChange(cb) {
    if (typeof cb === 'function') this.roleListeners.push(cb);
  },

  _notifyListeners() {
    this.roleListeners.forEach(cb => {
      try { cb(this.currentRole); } catch (_) {}
    });
  },

  _saveLocal() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.credentials));
    } catch (_) {}
  },

  /**
   * Cloud sync security credentials via Firestore config/security
   */
  async _syncFromCloud() {
    if (!window.FirebaseDB || !window.FirebaseDB.db) return;
    try {
      const doc = await window.FirebaseDB.db.collection('config').doc('security').get();
      if (doc.exists) {
        const data = doc.data();
        if (data.ownerPinHash) {
          this.credentials.ownerPinHash = data.ownerPinHash;
        }
        if (data.staffPinHash) {
          this.credentials.staffPinHash = data.staffPinHash;
        }
        this._saveLocal();
      }
    } catch (e) {
      console.warn('Security cloud fetch notice:', e.message);
    }
  },

  async _syncToCloud() {
    if (!window.FirebaseDB || !window.FirebaseDB.db) return;
    try {
      await window.FirebaseDB.db.collection('config').doc('security').set({
        ownerPinHash: this.credentials.ownerPinHash,
        staffPinHash: this.credentials.staffPinHash,
        updatedAt: this.credentials.updatedAt || new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Security cloud save notice:', e.message);
    }
  },

  /**
   * Logs a security audit event
   */
  async logAudit(eventType, details) {
    const entry = {
      id: 'AUD-' + Date.now(),
      timestamp: new Date().toISOString(),
      event_type: eventType,
      role: this.currentRole,
      details: typeof details === 'object' ? JSON.stringify(details) : String(details),
      device: navigator.userAgent.slice(0, 80)
    };

    // 1. Local storage queue (last 200 logs)
    try {
      let logs = JSON.parse(localStorage.getItem(this.AUDIT_STORAGE_KEY) || '[]');
      logs.unshift(entry);
      if (logs.length > 200) logs = logs.slice(0, 200);
      localStorage.setItem(this.AUDIT_STORAGE_KEY, JSON.stringify(logs));
    } catch (_) {}

    // 2. Cloud Firestore log
    if (window.FirebaseDB && window.FirebaseDB.db) {
      try {
        await window.FirebaseDB.db.collection('audit_logs').doc(entry.id).set(entry);
      } catch (_) {}
    }
  }
};

window.AuthSecurity = AuthSecurity;
document.addEventListener('DOMContentLoaded', () => {
  AuthSecurity.init().catch(console.error);
});
