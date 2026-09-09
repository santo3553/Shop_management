/* =========================================================
   BIPLOB SHOP - GOOGLE FIREBASE CLIENT CONFIGURATION
   100% Free Spark Plan ($0/Month Forever - Zero Credit Card Required)
   =========================================================
   INSTRUCTIONS FOR SHOP OWNER:
   You can either:
   1. Paste your Firebase Web App credentials in the DEFAULT_CONFIG below, OR
   2. Open the app -> Tap the Cloud Sync Badge in the top header -> Paste them in the Cloud Settings modal!
   ========================================================= */

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBX20ItWV9PwnaxVxherqUmSOZ8-RrpQ78",
  authDomain: "mobile-decor-and-tech.firebaseapp.com",
  projectId: "mobile-decor-and-tech",
  storageBucket: "mobile-decor-and-tech.firebasestorage.app",
  messagingSenderId: "169839397452",
  appId: "1:169839397452:web:b558969bb7818dd40682e9",
  measurementId: "G-2K4Z96QXHJ"
};

const FirebaseConfig = {
  STORAGE_KEY: 'biplob_firebase_config',

  /**
   * Returns active Firebase configuration, preferring user-saved settings from localStorage
   */
  get() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.projectId && parsed.apiKey && !parsed.apiKey.includes('YOUR_FIREBASE_API_KEY')) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved Firebase config:', e);
    }
    return DEFAULT_FIREBASE_CONFIG;
  },

  /**
   * Checks if valid non-placeholder Firebase credentials have been configured
   */
  isConfigured() {
    const cfg = this.get();
    return !!(
      cfg &&
      cfg.projectId &&
      cfg.apiKey &&
      !cfg.projectId.includes('your-shop-pos') &&
      !cfg.apiKey.includes('YOUR_FIREBASE_API_KEY')
    );
  },

  /**
   * Saves updated Firebase configuration to localStorage
   */
  save(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') {
      throw new Error('Invalid Firebase configuration object.');
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
    return true;
  },

  /**
   * Clears saved custom configuration, reverting to default
   */
  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

window.FirebaseConfig = FirebaseConfig;
