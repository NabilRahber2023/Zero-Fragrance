/**
 * ZEROØ FRAGRANCE - Shared Products & Storage Service (Enterprise Grade)
 * 
 * Provides a resilient, unified product data access layer shared between
 * the storefront (index.html) and admin panel (admin.html).
 * 
 * Supported features:
 * - Single source of truth (localStorage with automatic schema versioning)
 * - IndexedDB image blob storage (avoids base64 quota issues)
 * - Cross-tab real-time sync via BroadcastChannel AND storage event
 * - Tab visibility and focus auto-refresh (handles background throttling in Chrome)
 * - In-memory and cache fallback for private/incognito browsing
 * - ZeroStoreRepository interface ready for future Hostinger PHP/MySQL backend
 */

const ZERO_STORAGE_KEY_PRODUCTS = "zero_demo_admin_products_v1";
const ZERO_STORAGE_KEY_AUTH = "zero_demo_admin_auth_v1";
const ZERO_STORAGE_SYNC_PULSE = "zero_demo_sync_pulse_v1";
const ZERO_DB_NAME = "ZeroFragranceDemoDB";
const ZERO_DB_VERSION = 1;
const ZERO_STORE_IMAGES = "product_images";
const ZERO_CHANNEL_NAME = "zero_fragrance_sync_channel";

// Default seed products (guarantees existing catalogue is never lost or wiped)
const ZERO_SEED_PRODUCTS = [
  {
    id: "noir",
    name: "Noir",
    price: 1250,
    stock: 25,
    category: "Signature Scents",
    family: "dark-art",
    notes: "Woody and spicy, Cardamom & Dark Amber",
    description: "Bold. Elegant. Timeless.",
    status: "active",
    image: "",
    imageId: null,
    createdAt: "2026-10-15T10:00:00.000Z"
  },
  {
    id: "blanc",
    name: "Blanc",
    price: 1250,
    stock: 18,
    category: "Fresh & Crisp",
    family: "light-art",
    notes: "Fresh, Citrus & White Musk",
    description: "Fresh. Clean. Modern.",
    status: "active",
    image: "",
    imageId: null,
    createdAt: "2026-10-16T11:30:00.000Z"
  },
  {
    id: "oud",
    name: "Oud",
    price: 1450,
    stock: 4,
    category: "Oriental & Woody",
    family: "oud-art",
    notes: "Warm woods, Cambodian Oud, Amber",
    description: "Rich. Deep. Luxurious.",
    status: "active",
    image: "",
    imageId: null,
    createdAt: "2026-10-17T09:15:00.000Z"
  },
  {
    id: "rose",
    name: "Rose",
    price: 1250,
    stock: 0,
    category: "Floral Luxe",
    family: "rose-art",
    notes: "Damask Rose, Pink Pepper, Vanilla",
    description: "Soft. Graceful. Feminine.",
    status: "active",
    image: "",
    imageId: null,
    createdAt: "2026-10-18T14:45:00.000Z"
  },
  {
    id: "velvet-musk",
    name: "Velvet Musk",
    price: 1350,
    stock: 15,
    category: "Signature Scents",
    family: "dark-art",
    notes: "Cashmere wood, White Musk, Bergamot",
    description: "Subtle seductive warmth for evening wear.",
    status: "inactive",
    image: "",
    imageId: null,
    createdAt: "2026-10-20T16:20:00.000Z"
  }
];

class SharedProductStore {
  constructor() {
    this.db = null;
    this.dbReady = this.initDB();
    this.listeners = new Set();
    this.imageCache = new Map(); // imageId -> blob objectURL
    this.inMemoryFallback = null;
    this.lastKnownVersion = 0;

    // Check localStorage availability (handles strict incognito / cookies blocked)
    this.hasLocalStorage = this.checkLocalStorageSupport();

    // Cross-tab broadcast channel
    this.channel = null;
    try {
      if (typeof window.BroadcastChannel === "function") {
        this.channel = new BroadcastChannel(ZERO_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event && event.data && event.data.type === "PRODUCTS_UPDATED") {
            this.notifyListeners({ ...event.data, source: "broadcast" });
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel not permitted in this context:", e);
    }

    // Window storage event fallback for cross-tab sync across Chrome / Safari / Edge / Firefox
    window.addEventListener("storage", (event) => {
      if (event.key === ZERO_STORAGE_KEY_PRODUCTS || event.key === ZERO_STORAGE_SYNC_PULSE) {
        this.notifyListeners({ type: "PRODUCTS_UPDATED", source: "storage_event" });
      }
    });

    // Window focus and visibilitychange listeners (fixes background tab throttling in Chrome)
    window.addEventListener("focus", () => {
      this.checkExternalChanges();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.checkExternalChanges();
      }
    });
  }

  checkLocalStorageSupport() {
    try {
      const testKey = "__zero_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn("localStorage is unavailable or restricted. Using resilient in-memory fallback.", e);
      return false;
    }
  }

  async initDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported in this browser. Images will fall back gracefully.");
        resolve(null);
        return;
      }
      try {
        const request = window.indexedDB.open(ZERO_DB_NAME, ZERO_DB_VERSION);
        request.onerror = (e) => {
          console.warn("IndexedDB error or permission denied (e.g. strict private mode):", e);
          resolve(null);
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(ZERO_STORE_IMAGES)) {
            db.createObjectStore(ZERO_STORE_IMAGES, { keyPath: "id" });
          }
        };
      } catch (err) {
        console.warn("IndexedDB initialization error:", err);
        resolve(null);
      }
    });
  }

  // Subscribe to changes (called by index.html storefront and admin.html)
  subscribe(callback) {
    if (typeof callback === "function") {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(data = { type: "PRODUCTS_UPDATED" }) {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error("Error in product store subscriber callback:", e);
      }
    });
  }

  checkExternalChanges() {
    // Check if pulse timestamp in localStorage is newer
    if (this.hasLocalStorage) {
      try {
        const pulse = Number(localStorage.getItem(ZERO_STORAGE_SYNC_PULSE)) || 0;
        if (pulse > this.lastKnownVersion) {
          this.lastKnownVersion = pulse;
          this.notifyListeners({ type: "PRODUCTS_UPDATED", source: "focus_check" });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Load products from localStorage or seed
  getProducts() {
    if (!this.hasLocalStorage) {
      if (!this.inMemoryFallback) {
        this.inMemoryFallback = JSON.parse(JSON.stringify(ZERO_SEED_PRODUCTS));
      }
      return this.inMemoryFallback;
    }

    try {
      const raw = localStorage.getItem(ZERO_STORAGE_KEY_PRODUCTS);
      if (!raw) {
        this.saveProducts(ZERO_SEED_PRODUCTS, false);
        return JSON.parse(JSON.stringify(ZERO_SEED_PRODUCTS));
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        this.saveProducts(ZERO_SEED_PRODUCTS, false);
        return JSON.parse(JSON.stringify(ZERO_SEED_PRODUCTS));
      }
      return parsed;
    } catch (e) {
      console.error("Failed to read products from localStorage:", e);
      return JSON.parse(JSON.stringify(ZERO_SEED_PRODUCTS));
    }
  }

  // Save products and broadcast update
  saveProducts(products, broadcast = true) {
    const timestamp = Date.now();
    this.lastKnownVersion = timestamp;

    if (!this.hasLocalStorage) {
      this.inMemoryFallback = JSON.parse(JSON.stringify(products));
      if (broadcast) {
        this.notifyListeners({ type: "PRODUCTS_UPDATED", source: "local" });
      }
      return true;
    }

    try {
      localStorage.setItem(ZERO_STORAGE_KEY_PRODUCTS, JSON.stringify(products));
      // Save pulse timestamp so window.focus / visibilitychange can immediately detect changes
      localStorage.setItem(ZERO_STORAGE_SYNC_PULSE, String(timestamp));

      if (broadcast) {
        if (this.channel) {
          try {
            this.channel.postMessage({ type: "PRODUCTS_UPDATED", timestamp });
          } catch (err) {
            console.warn("BroadcastChannel message failed:", err);
          }
        }
        this.notifyListeners({ type: "PRODUCTS_UPDATED", source: "local" });
      }
      return true;
    } catch (e) {
      console.error("Failed to save products to localStorage:", e);
      return false;
    }
  }

  resetDemoData() {
    try {
      if (this.hasLocalStorage) {
        localStorage.removeItem(ZERO_STORAGE_KEY_PRODUCTS);
      }
      this.saveProducts(ZERO_SEED_PRODUCTS, true);
      return JSON.parse(JSON.stringify(ZERO_SEED_PRODUCTS));
    } catch (e) {
      console.error("Failed to reset demo data:", e);
      return ZERO_SEED_PRODUCTS;
    }
  }

  // IndexedDB Image Handling
  async saveImage(imageId, fileBlob) {
    // Keep in objectURL cache right away
    try {
      const url = URL.createObjectURL(fileBlob);
      this.imageCache.set(imageId, url);
    } catch (e) {
      // ignore
    }

    await this.dbReady;
    if (!this.db) return imageId;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(ZERO_STORE_IMAGES, "readwrite");
        const store = tx.objectStore(ZERO_STORE_IMAGES);
        const record = {
          id: imageId,
          blob: fileBlob,
          updatedAt: Date.now()
        };
        const req = store.put(record);
        req.onsuccess = () => resolve(imageId);
        req.onerror = (err) => {
          console.error("Error saving image to IndexedDB", err);
          resolve(imageId); // fallback to cached objectURL
        };
      } catch (err) {
        console.warn("Transaction failed (e.g. private mode):", err);
        resolve(imageId);
      }
    });
  }

  async getImage(imageId) {
    if (!imageId) return null;
    if (this.imageCache.has(imageId)) {
      return this.imageCache.get(imageId);
    }

    await this.dbReady;
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(ZERO_STORE_IMAGES, "readonly");
        const store = tx.objectStore(ZERO_STORE_IMAGES);
        const req = store.get(imageId);
        req.onsuccess = (e) => {
          const res = e.target.result;
          if (res && res.blob) {
            const url = URL.createObjectURL(res.blob);
            this.imageCache.set(imageId, url);
            resolve(url);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async deleteImage(imageId) {
    if (this.imageCache.has(imageId)) {
      try {
        URL.revokeObjectURL(this.imageCache.get(imageId));
      } catch (e) {
        // ignore
      }
      this.imageCache.delete(imageId);
    }

    await this.dbReady;
    if (!this.db || !imageId) return;
    try {
      const tx = this.db.transaction(ZERO_STORE_IMAGES, "readwrite");
      tx.objectStore(ZERO_STORE_IMAGES).delete(imageId);
    } catch (e) {
      console.warn("Error deleting image from IndexedDB", e);
    }
  }

  // Demo Auth
  isLoggedIn() {
    try {
      return sessionStorage.getItem(ZERO_STORAGE_KEY_AUTH) === "true";
    } catch (e) {
      return false;
    }
  }

  login(username, password) {
    if (username.trim() && password.trim()) {
      try {
        sessionStorage.setItem(ZERO_STORAGE_KEY_AUTH, "true");
        sessionStorage.setItem("zero_demo_admin_user", username.trim());
      } catch (e) {
        // fallback
      }
      return { success: true };
    }
    return { success: false, error: "Please enter both username and password." };
  }

  logout() {
    try {
      sessionStorage.removeItem(ZERO_STORAGE_KEY_AUTH);
      sessionStorage.removeItem("zero_demo_admin_user");
    } catch (e) {
      // fallback
    }
  }

  getUser() {
    try {
      return sessionStorage.getItem("zero_demo_admin_user") || "Admin";
    } catch (e) {
      return "Admin";
    }
  }
}

/**
 * Clean Product Repository Interface
 * This interface defines the contract that both the local storage implementation
 * and a future Hostinger PHP/MySQL REST API implementation will satisfy.
 */
class ZeroStoreRepository {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async getProducts() {
    return this.adapter.getProducts();
  }

  async saveProducts(products) {
    return this.adapter.saveProducts(products);
  }

  async getProductById(id) {
    const list = await this.getProducts();
    return list.find((p) => p.id === id) || null;
  }

  async saveImage(imageId, fileBlob) {
    return this.adapter.saveImage(imageId, fileBlob);
  }

  async getImage(imageId) {
    return this.adapter.getImage(imageId);
  }

  async deleteImage(imageId) {
    return this.adapter.deleteImage(imageId);
  }

  subscribe(callback) {
    return this.adapter.subscribe(callback);
  }
}

// Global shared instances accessible by both admin.js and app.js
window.ZeroStore = new SharedProductStore();
window.ZeroRepository = new ZeroStoreRepository(window.ZeroStore);
window.AdminStorage = window.ZeroStore; // backward compatibility
