/**
 * ZEROØ FRAGRANCE - Demo Admin Controller
 * Handles auth state, navigation, CRUD operations, image handling, and UI sync.
 */

document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // Elements - Auth & Layout
  const loginView = document.getElementById("login-view");
  const appLayout = document.getElementById("app-layout");
  const loginForm = document.getElementById("login-form");
  const loginUsername = document.getElementById("login-username");
  const loginPassword = document.getElementById("login-password");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const logoutBtn = document.getElementById("logout-btn");
  const displayUser = document.getElementById("display-user");
  const avatarInitials = document.getElementById("avatar-initials");
  const mobileToggle = document.getElementById("mobile-toggle");
  const sidebar = document.getElementById("sidebar");

  // Navigation
  const navLinks = document.querySelectorAll("[data-nav]");
  const viewSections = document.querySelectorAll(".view-section");
  const pageTitle = document.getElementById("page-title");

  // Dashboard Stat Elements
  const statTotalProducts = document.getElementById("stat-total-products");
  const statInStock = document.getElementById("stat-in-stock");
  const statOutStock = document.getElementById("stat-out-stock");
  const statTotalUnits = document.getElementById("stat-total-units");
  const recentProductsList = document.getElementById("recent-products-list");
  const lowStockList = document.getElementById("low-stock-list");
  const lowStockBadge = document.getElementById("low-stock-count-badge");
  const btnDashAddProduct = document.getElementById("btn-dash-add-product");
  const btnResetDemo = document.getElementById("btn-reset-demo");

  // Product Management Elements
  const productsTableBody = document.getElementById("products-table-body");
  const searchInput = document.getElementById("search-input");
  const filterCategory = document.getElementById("filter-category");
  const filterStock = document.getElementById("filter-stock");
  const sortBy = document.getElementById("sort-by");
  const btnOpenAddModal = document.getElementById("btn-open-add-modal");
  const btnQuickAdd = document.getElementById("btn-quick-add");

  // Modals & Forms
  const productModal = document.getElementById("product-modal");
  const modalHeading = document.getElementById("modal-heading");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const productForm = document.getElementById("product-form");
  const formEditIndex = document.getElementById("form-edit-index");
  const formExistingImageId = document.getElementById("form-existing-image-id");

  // Form Inputs
  const prodName = document.getElementById("prod-name");
  const prodId = document.getElementById("prod-id");
  const prodPrice = document.getElementById("prod-price");
  const prodStock = document.getElementById("prod-stock");
  const prodCategory = document.getElementById("prod-category");
  const prodStatus = document.getElementById("prod-status");
  const prodDescription = document.getElementById("prod-description");
  const prodNotes = document.getElementById("prod-notes");
  const prodImageFile = document.getElementById("prod-image-file");
  const btnTriggerUpload = document.getElementById("btn-trigger-upload");
  const btnRemoveImage = document.getElementById("btn-remove-image");
  const imagePreviewBox = document.getElementById("image-preview-box");

  // Confirm Modal
  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmCloseBtn = document.getElementById("confirm-close-btn");
  const btnConfirmCancel = document.getElementById("btn-confirm-cancel");
  const btnConfirmAction = document.getElementById("btn-confirm-action");
  let onConfirmCallback = null;

  // Toast
  const adminToast = document.getElementById("admin-toast");
  const toastMessage = document.getElementById("toast-message");
  let toastTimer = null;

  // State
  let products = [];
  let pendingImageBlob = null;
  const imageCache = new Map(); // imageId -> objectURL

  // --- INITIALIZATION ---
  await window.AdminStorage.dbReady;
  products = window.AdminStorage.getProducts();

  // Check login
  if (window.AdminStorage.isLoggedIn()) {
    showAppLayout();
  } else {
    showLoginView();
  }

  // Pre-load images from IndexedDB into memory
  await preloadImages();
  renderAll();

  // Listen for updates from other tabs or storefront
  if (typeof window.AdminStorage.subscribe === "function") {
    window.AdminStorage.subscribe(async (event) => {
      if (event && event.source !== "local") {
        products = window.AdminStorage.getProducts();
        await preloadImages();
        renderAll();
      }
    });
  }

  // --- AUTH METHODS ---
  function showLoginView() {
    loginView.style.display = "flex";
    appLayout.style.display = "none";
  }

  function showAppLayout() {
    loginView.style.display = "none";
    appLayout.style.display = "flex";
    const user = window.AdminStorage.getUser();
    displayUser.textContent = user;
    avatarInitials.textContent = user.substring(0, 2).toUpperCase();
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const res = window.AdminStorage.login(loginUsername.value, loginPassword.value);
    if (res.success) {
      showToast("Signed in to Demo Admin.");
      showAppLayout();
      renderAll();
    } else {
      showToast(res.error, true);
    }
  });

  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = loginPassword.type === "password";
    loginPassword.type = isPassword ? "text" : "password";
    togglePasswordBtn.textContent = isPassword ? "🔒" : "👁";
  });

  logoutBtn.addEventListener("click", () => {
    window.AdminStorage.logout();
    showLoginView();
    showToast("Logged out successfully.");
  });

  // Mobile menu toggle
  mobileToggle.addEventListener("click", () => {
    sidebar.classList.toggle("mobile-open");
  });

  // Navigation switching
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetNav = link.getAttribute("data-nav");
      if (!targetNav) return; // external link
      e.preventDefault();
      switchSection(targetNav);
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("mobile-open");
      }
    });
  });

  document.querySelectorAll("[data-nav-target]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-nav-target");
      switchSection(target);
    });
  });

  function switchSection(sectionId) {
    navLinks.forEach((l) => l.classList.remove("active"));
    const activeNav = document.querySelector(`[data-nav="${sectionId}"]`);
    if (activeNav) activeNav.classList.add("active");

    viewSections.forEach((s) => s.classList.remove("active"));
    const activeSection = document.getElementById(`view-${sectionId}`);
    if (activeSection) activeSection.classList.add("active");

    if (sectionId === "dashboard") {
      pageTitle.textContent = "Executive Dashboard";
      btnQuickAdd.style.display = "none";
    } else if (sectionId === "products") {
      pageTitle.textContent = "Product Catalog";
      btnQuickAdd.style.display = "none";
    }
  }

  // --- IMAGE PRELOADING ---
  async function preloadImages() {
    for (const p of products) {
      if (p.imageId && !imageCache.has(p.imageId)) {
        const url = await window.AdminStorage.getImage(p.imageId);
        if (url) imageCache.set(p.imageId, url);
      }
    }
  }

  function getProductImageUrl(prod) {
    if (prod.imageId && imageCache.has(prod.imageId)) {
      return imageCache.get(prod.imageId);
    }
    if (prod.image) {
      return prod.image;
    }
    return null;
  }

  // --- STOCK STATUS HELPER ---
  function getStockStatus(stock) {
    const qty = Number(stock) || 0;
    if (qty <= 0) return { label: "OUT OF STOCK", class: "status-out-of-stock", key: "out_of_stock" };
    if (qty <= 5) return { label: "LOW STOCK", class: "status-low-stock", key: "low_stock" };
    return { label: "IN STOCK", class: "status-in-stock", key: "in_stock" };
  }

  // --- RENDER FUNCTIONS ---
  function renderAll() {
    renderStats();
    renderRecentAndLowStock();
    renderProductsTable();
  }

  function renderStats() {
    const totalCount = products.length;
    let inStockCount = 0;
    let outStockCount = 0;
    let totalUnits = 0;

    products.forEach((p) => {
      const q = Number(p.stock) || 0;
      totalUnits += q;
      if (q > 5) inStockCount++;
      else if (q === 0) outStockCount++;
    });

    statTotalProducts.textContent = totalCount;
    statInStock.textContent = inStockCount;
    statOutStock.textContent = outStockCount;
    statTotalUnits.textContent = totalUnits.toLocaleString("en-BD");
  }

  function renderRecentAndLowStock() {
    // Recent 4 products
    const sortedByDate = [...products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const recent = sortedByDate.slice(0, 4);

    if (recent.length === 0) {
      recentProductsList.innerHTML = `<div class="empty-state"><p>No fragrances found.</p></div>`;
    } else {
      recentProductsList.innerHTML = recent.map((p) => renderMiniItem(p)).join("");
    }

    // Low stock items (1-5)
    const lowItems = products.filter((p) => {
      const q = Number(p.stock) || 0;
      return q >= 1 && q <= 5;
    });

    lowStockBadge.textContent = `${lowItems.length} items`;
    if (lowItems.length === 0) {
      lowStockList.innerHTML = `<div class="empty-state" style="padding: 1.5rem;"><p style="font-size: 0.85rem; color: var(--text-muted);">All inventory levels healthy (no items with 1-5 pcs).</p></div>`;
    } else {
      lowStockList.innerHTML = lowItems.map((p) => renderMiniItem(p)).join("");
    }
  }

  function renderMiniItem(p) {
    const imgUrl = getProductImageUrl(p);
    const status = getStockStatus(p.stock);
    return `
      <div class="mini-item">
        <div class="mini-info">
          <div class="mini-thumb">
            ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}">` : `<span class="mini-bottle-icon">ZERØ<br>${escapeHtml(p.name.substring(0, 4).toUpperCase())}</span>`}
          </div>
          <div>
            <div class="mini-title">${escapeHtml(p.name)}</div>
            <div class="mini-meta">৳${Number(p.price).toLocaleString("en-BD")} · ${p.category || "Signature"}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 0.82rem; font-weight: 600;">${p.stock} pcs</span>
          <span class="status-pill ${status.class}">${status.label}</span>
        </div>
      </div>
    `;
  }

  function renderProductsTable() {
    const query = searchInput.value.toLowerCase().trim();
    const cat = filterCategory.value;
    const stockFilter = filterStock.value;
    const sort = sortBy.value;

    let filtered = products.filter((p) => {
      // Search
      const matchSearch =
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        (p.notes && p.notes.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query));

      if (!matchSearch) return false;

      // Category filter
      if (cat !== "all" && p.category !== cat) return false;

      // Stock filter
      if (stockFilter !== "all") {
        const s = getStockStatus(p.stock);
        if (s.key !== stockFilter) return false;
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "price_asc") return Number(a.price) - Number(b.price);
      if (sort === "price_desc") return Number(b.price) - Number(a.price);
      if (sort === "stock_desc") return Number(b.stock) - Number(a.stock);
      if (sort === "stock_asc") return Number(a.stock) - Number(b.stock);
      // default: date_desc
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (filtered.length === 0) {
      productsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-icon">❖</div>
              <h4>No matching fragrances found</h4>
              <p style="font-size: 0.85rem; margin-top: 0.25rem;">Try modifying your search or filter criteria.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    productsTableBody.innerHTML = filtered
      .map((p) => {
        const index = products.findIndex((item) => item.id === p.id);
        const imgUrl = getProductImageUrl(p);
        const stockStatus = getStockStatus(p.stock);
        const isInactive = p.status === "inactive";
        const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" }) : "N/A";

        return `
        <tr>
          <td>
            <div class="cell-product">
              <div class="cell-thumb">
                ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}">` : `<span style="font-size: 0.6rem; color: var(--accent-gold); text-align: center; font-weight: 600;">ZERØ<br>${escapeHtml(p.name.substring(0, 4).toUpperCase())}</span>`}
              </div>
              <div class="cell-details">
                <span class="cell-title">${escapeHtml(p.name)}</span>
                <span class="cell-id">ID: ${escapeHtml(p.id)}</span>
                ${p.notes ? `<span style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">${escapeHtml(p.notes)}</span>` : ""}
              </div>
            </div>
          </td>
          <td><span style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(p.category || "Signature")}</span></td>
          <td><span class="cell-price">৳${Number(p.price).toLocaleString("en-BD")}</span></td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-weight: 600;">${p.stock} units</span>
              <span class="status-pill ${stockStatus.class}">${stockStatus.label}</span>
            </div>
          </td>
          <td>
            ${isInactive ? `<span class="status-pill status-inactive">Hidden (Inactive)</span>` : `<span class="status-pill status-in-stock">Storefront Active</span>`}
          </td>
          <td><span style="font-size: 0.78rem; color: var(--text-dim);">${dateStr}</span></td>
          <td>
            <div class="cell-actions" style="justify-content: flex-end;">
              <button type="button" class="btn-icon" data-edit-idx="${index}" title="Edit product">✎</button>
              <button type="button" class="btn-icon delete" data-delete-idx="${index}" title="Delete product">🗑</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    // Bind action buttons
    productsTableBody.querySelectorAll("[data-edit-idx]").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(Number(btn.dataset.editIdx)));
    });

    productsTableBody.querySelectorAll("[data-delete-idx]").forEach((btn) => {
      btn.addEventListener("click", () => confirmDeleteProduct(Number(btn.dataset.deleteIdx)));
    });
  }

  // --- FILTERS & SEARCH LISTENERS ---
  searchInput.addEventListener("input", renderProductsTable);
  filterCategory.addEventListener("change", renderProductsTable);
  filterStock.addEventListener("change", renderProductsTable);
  sortBy.addEventListener("change", renderProductsTable);

  // --- ADD / EDIT PRODUCT MODAL ---
  function openAddModal() {
    modalHeading.textContent = "Add New Fragrance";
    formEditIndex.value = "-1";
    formExistingImageId.value = "";
    productForm.reset();
    prodId.disabled = false;
    pendingImageBlob = null;
    clearImagePreview();
    productModal.classList.add("open");
    prodName.focus();
  }

  async function openEditModal(index) {
    const p = products[index];
    if (!p) return;

    modalHeading.textContent = `Edit Fragrance: ${p.name}`;
    formEditIndex.value = String(index);
    formExistingImageId.value = p.imageId || "";
    pendingImageBlob = null;

    prodName.value = p.name || "";
    prodId.value = p.id || "";
    prodId.disabled = true; // prevent changing unique ID on existing items
    prodPrice.value = p.price || "";
    prodStock.value = p.stock !== undefined ? p.stock : 0;
    prodCategory.value = p.category || "Signature Scents";
    prodStatus.value = p.status || "active";
    prodDescription.value = p.description || "";
    prodNotes.value = p.notes || "";

    const imgUrl = getProductImageUrl(p);
    if (imgUrl) {
      showImagePreview(imgUrl);
    } else {
      clearImagePreview();
    }

    productModal.classList.add("open");
  }

  function closeModal() {
    productModal.classList.remove("open");
    productForm.reset();
    pendingImageBlob = null;
    clearImagePreview();
  }

  btnOpenAddModal.addEventListener("click", openAddModal);
  btnDashAddProduct.addEventListener("click", openAddModal);
  btnQuickAdd.addEventListener("click", openAddModal);
  modalCloseBtn.addEventListener("click", closeModal);
  btnCancelModal.addEventListener("click", closeModal);

  // --- IMAGE UPLOAD & PREVIEW ---
  btnTriggerUpload.addEventListener("click", () => {
    prodImageFile.click();
  });

  prodImageFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file (PNG, JPG, WebP).", true);
      return;
    }

    pendingImageBlob = file;
    const tempUrl = URL.createObjectURL(file);
    showImagePreview(tempUrl);
    showToast("Image selected for preview.");
  });

  btnRemoveImage.addEventListener("click", () => {
    pendingImageBlob = null;
    formExistingImageId.value = "";
    clearImagePreview();
  });

  function showImagePreview(url) {
    imagePreviewBox.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview">`;
    btnRemoveImage.style.display = "inline-flex";
  }

  function clearImagePreview() {
    imagePreviewBox.innerHTML = `<span style="font-size: 0.65rem; color: var(--text-dim); text-align: center;">No Image Selected</span>`;
    btnRemoveImage.style.display = "none";
    prodImageFile.value = "";
  }

  // --- SAVE PRODUCT FORM ---
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = prodName.value.trim();
    const id = prodId.value.trim().toLowerCase();
    const price = Number(prodPrice.value);
    const stock = Number(prodStock.value);
    const category = prodCategory.value;
    const status = prodStatus.value;
    const description = prodDescription.value.trim();
    const notes = prodNotes.value.trim();
    const editIndex = Number(formEditIndex.value);

    // Validation
    if (!name || !id || !description) {
      showToast("Please fill in all required fields.", true);
      return;
    }

    if (isNaN(price) || price < 0) {
      showToast("Price cannot be negative.", true);
      return;
    }

    if (isNaN(stock) || stock < 0) {
      showToast("Stock quantity cannot be negative.", true);
      return;
    }

    // Check duplicate ID if new
    if (editIndex === -1) {
      const exists = products.some((p) => p.id === id);
      if (exists) {
        showToast(`Product ID "${id}" is already in use. Please use a unique ID.`, true);
        return;
      }
    }

    let finalImageId = formExistingImageId.value || null;

    // Handle Image persistence in IndexedDB
    if (pendingImageBlob) {
      const generatedImageId = `img_${id}_${Date.now()}`;
      const saved = await window.AdminStorage.saveImage(generatedImageId, pendingImageBlob);
      if (saved) {
        finalImageId = generatedImageId;
        imageCache.set(generatedImageId, URL.createObjectURL(pendingImageBlob));
      }
    }

    if (editIndex >= 0) {
      // Update existing
      products[editIndex] = {
        ...products[editIndex],
        name,
        price,
        stock,
        category,
        status,
        description,
        notes,
        imageId: finalImageId,
        updatedAt: new Date().toISOString()
      };
      showToast(`Fragrance "${name}" updated successfully.`);
    } else {
      // Add new
      const newProduct = {
        id,
        name,
        price,
        stock,
        category,
        family: "dark-art",
        status,
        description,
        notes,
        image: "",
        imageId: finalImageId,
        createdAt: new Date().toISOString()
      };
      products.unshift(newProduct);
      showToast(`Fragrance "${name}" created successfully.`);
    }

    // Persist to localStorage
    window.AdminStorage.saveProducts(products);
    closeModal();
    renderAll();
  });

  // --- DELETE CONFIRMATION ---
  function confirmDeleteProduct(index) {
    const p = products[index];
    if (!p) return;

    confirmTitle.textContent = "Delete Fragrance";
    confirmMessage.innerHTML = `Are you sure you want to permanently delete <strong>${escapeHtml(p.name)}</strong> (ID: ${escapeHtml(p.id)}) from demo products?`;
    onConfirmCallback = async () => {
      if (p.imageId) {
        await window.AdminStorage.deleteImage(p.imageId);
        imageCache.delete(p.imageId);
      }
      products.splice(index, 1);
      window.AdminStorage.saveProducts(products);
      renderAll();
      showToast(`Deleted "${p.name}".`);
      closeConfirmModal();
    };
    confirmModal.classList.add("open");
  }

  function closeConfirmModal() {
    confirmModal.classList.remove("open");
    onConfirmCallback = null;
  }

  confirmCloseBtn.addEventListener("click", closeConfirmModal);
  btnConfirmCancel.addEventListener("click", closeConfirmModal);
  btnConfirmAction.addEventListener("click", () => {
    if (typeof onConfirmCallback === "function") {
      onConfirmCallback();
    }
  });

  // --- RESET DEMO DATA ---
  btnResetDemo.addEventListener("click", () => {
    confirmTitle.textContent = "Reset Demo Data";
    confirmMessage.textContent = "Reset all catalog items, stock numbers, and test fragrances back to the default demo seed?";
    onConfirmCallback = () => {
      products = window.AdminStorage.resetDemoData();
      renderAll();
      showToast("Demo data restored to initial state.");
      closeConfirmModal();
    };
    confirmModal.classList.add("open");
  });

  // --- TOAST HELPER ---
  function showToast(msg, isError = false) {
    toastMessage.textContent = msg;
    adminToast.style.borderColor = isError ? "#ef4444" : "var(--border-gold)";
    adminToast.style.borderLeftColor = isError ? "#ef4444" : "var(--accent-gold)";
    adminToast.classList.add("show");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      adminToast.classList.remove("show");
    }, 3500);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }
});
