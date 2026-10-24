/**
 * ZEROØ FRAGRANCE - Demo Admin Storage
 * Handles localStorage for metadata and IndexedDB for uploaded images.
 * Keeps demo data clean, resilient, and non-blocking.
 */

const STORAGE_KEY_PRODUCTS = "zero_demo_admin_products_v1";
const STORAGE_KEY_AUTH = "zero_demo_admin_auth_v1";
const DB_NAME = "ZeroFragranceDemoDB";
const DB_VERSION = 1;
const STORE_IMAGES = "product_images";

// Initial Demo Products
const INITIAL_DEMO_PRODUCTS = [
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
    image: "", // uses bottle markup or uploaded image
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
    stock: 4, // low stock test
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
    stock: 0, // out of stock test
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

class AdminStorage {
  constructor() {
    this.db = null;
    this.dbReady = this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported in this browser. Falling back gracefully.");
        resolve(null);
        return;
      }
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => {
        console.error("IndexedDB error:", e);
        resolve(null);
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
        }
      };
    });
  }

  // Get products from localStorage or initialize with seed
  getProducts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (!raw) {
        this.saveProducts(INITIAL_DEMO_PRODUCTS);
        return JSON.parse(JSON.stringify(INITIAL_DEMO_PRODUCTS));
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load products from localStorage", e);
      return JSON.parse(JSON.stringify(INITIAL_DEMO_PRODUCTS));
    }
  }

  saveProducts(products) {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
      return true;
    } catch (e) {
      console.error("Failed to save products to localStorage", e);
      return false;
    }
  }

  resetDemoData() {
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTS);
      this.saveProducts(INITIAL_DEMO_PRODUCTS);
      return JSON.parse(JSON.stringify(INITIAL_DEMO_PRODUCTS));
    } catch (e) {
      console.error("Failed to reset demo data", e);
      return INITIAL_DEMO_PRODUCTS;
    }
  }

  // Image storage via IndexedDB
  async saveImage(imageId, fileBlob) {
    await this.dbReady;
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_IMAGES, "readwrite");
        const store = tx.objectStore(STORE_IMAGES);
        const record = {
          id: imageId,
          blob: fileBlob,
          updatedAt: Date.now()
        };
        const req = store.put(record);
        req.onsuccess = () => resolve(imageId);
        req.onerror = (err) => {
          console.error("Error saving image to IndexedDB", err);
          resolve(null);
        };
      } catch (err) {
        console.error("Transaction failed", err);
        resolve(null);
      }
    });
  }

  async getImage(imageId) {
    await this.dbReady;
    if (!this.db || !imageId) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_IMAGES, "readonly");
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(imageId);
        req.onsuccess = (e) => {
          const res = e.target.result;
          if (res && res.blob) {
            const url = URL.createObjectURL(res.blob);
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
    await this.dbReady;
    if (!this.db || !imageId) return;
    try {
      const tx = this.db.transaction(STORE_IMAGES, "readwrite");
      tx.objectStore(STORE_IMAGES).delete(imageId);
    } catch (e) {
      console.warn("Error deleting image", e);
    }
  }

  // Demo Auth
  isLoggedIn() {
    return sessionStorage.getItem(STORAGE_KEY_AUTH) === "true";
  }

  login(username, password) {
    // Demo-only authentication check
    // In production, authentication is handled via PHP session/JWT + secure password hashing
    if (username.trim() && password.trim()) {
      sessionStorage.setItem(STORAGE_KEY_AUTH, "true");
      sessionStorage.setItem("zero_demo_admin_user", username.trim());
      return { success: true };
    }
    return { success: false, error: "Please enter both username and password." };
  }

  logout() {
    sessionStorage.removeItem(STORAGE_KEY_AUTH);
    sessionStorage.removeItem("zero_demo_admin_user");
  }

  getUser() {
    return sessionStorage.getItem("zero_demo_admin_user") || "Admin";
  }
}

window.AdminStorage = new AdminStorage();
