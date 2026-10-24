/**
 * ZEROØ FRAGRANCE - Storefront Application
 * Connects directly to the shared ZeroStore service.
 * Supports dynamic rendering, live cross-tab updates, stock status rules, and WhatsApp ordering.
 */

(() => {
  "use strict";

  // Business WhatsApp number in international format (digits only)
  const WHATSAPP_NUMBER = "8801721491488";
  const CURRENCY = "৳";
  const MAX_ORDER_QUANTITY = 25;

  const grid = document.getElementById("product-grid");
  const dialog = document.getElementById("order-dialog");
  const form = document.getElementById("order-form");
  const qtyInput = document.getElementById("order-quantity");
  const errorBox = document.getElementById("form-error");
  let selectedProduct = null;
  let products = [];
  const imageUrlCache = new Map(); // imageId -> object URL

  const money = (amount) => `${CURRENCY}${Number(amount).toLocaleString("en-BD")}`;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function getStockStatus(stock) {
    const qty = Number(stock) || 0;
    if (qty <= 0) return { label: "OUT OF STOCK", available: false, class: "out-stock" };
    if (qty <= 5) return { label: `LOW STOCK · ${qty} left`, available: true, class: "low-stock" };
    return { label: `In stock · ${qty} pcs`, available: true, class: "in-stock" };
  }

  function bottleMarkup(product, extraClass = "") {
    const resolvedUrl = (product.imageId && imageUrlCache.get(product.imageId)) || product.image;
    if (resolvedUrl) {
      return `<img class="product-image ${extraClass}" src="${escapeHtml(resolvedUrl)}" alt="${escapeHtml(product.name)} perfume" loading="lazy">`;
    }
    return `<div class="mini-bottle" aria-label="${escapeHtml(product.name)} bottle illustration">
      <span class="mini-cap"></span><span class="mini-logo">ZERØ</span><span class="mini-label">FRAGRANCE</span>
      <span class="mini-rule"></span><span class="mini-name">${escapeHtml(product.name.toUpperCase())}</span>
    </div>`;
  }

  async function resolveImages(items) {
    if (!window.ZeroStore) return;
    for (const p of items) {
      if (p.imageId && !imageUrlCache.has(p.imageId)) {
        const url = await window.ZeroStore.getImage(p.imageId);
        if (url) imageUrlCache.set(p.imageId, url);
      }
    }
  }

  async function loadAndRenderProducts() {
    if (window.ZeroStore && typeof window.ZeroStore.getProducts === "function") {
      const all = window.ZeroStore.getProducts();
      // Filter out inactive products from public storefront
      products = all.filter((p) => p.status !== "inactive");
    } else if (Array.isArray(window.ZERO_PRODUCTS)) {
      products = window.ZERO_PRODUCTS;
    } else {
      products = [];
    }

    await resolveImages(products);
    renderProducts();

    // If order dialog is currently open, re-validate selected product
    if (dialog && dialog.open && selectedProduct) {
      const updated = products.find((p) => p.id === selectedProduct.id);
      if (!updated || Number(updated.stock) <= 0) {
        closeOrder();
        showToast("The product you were viewing is no longer available.");
      } else {
        selectedProduct = updated;
        updateOrderDialogContent();
      }
    }
  }

  function renderProducts() {
    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #888;">
        <p>No fragrances currently available in the collection.</p>
      </div>`;
      return;
    }

    grid.innerHTML = products
      .map((product) => {
        const stockStatus = getStockStatus(product.stock);
        const available = stockStatus.available;
        const family = ["dark-art", "light-art", "oud-art", "rose-art"].includes(product.family) ? product.family : "dark-art";

        return `<article class="product-card" data-product-id="${escapeHtml(product.id)}">
          <div class="product-art ${family}">${bottleMarkup(product)}</div>
          <div class="product-info">
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description || "")}</p>
            <div class="product-meta">
              <span class="price">${money(product.price)}</span>
              <span class="stock ${stockStatus.class}">${stockStatus.label}</span>
            </div>
            <button class="buy-button" type="button" data-buy="${escapeHtml(product.id)}" ${available ? "" : "disabled"}>
              ${available ? "BUY NOW  ↗" : "SOLD OUT"}
            </button>
          </div>
        </article>`;
      })
      .join("");

    grid.querySelectorAll("[data-buy]").forEach((button) => {
      button.addEventListener("click", () => openOrder(button.dataset.buy));
    });
  }

  function updateOrderDialogContent() {
    if (!selectedProduct) return;
    document.getElementById("selected-product").innerHTML = `
      <div class="selected-art ${escapeHtml(selectedProduct.family || "dark-art")}">${bottleMarkup(selectedProduct)}</div>
      <div class="selected-copy"><strong>${escapeHtml(selectedProduct.name)}</strong><small>${escapeHtml(selectedProduct.description || "")}</small></div>
      <span class="selected-price">${money(selectedProduct.price)}</span>`;
    updateTotal();
  }

  function openOrder(productId) {
    selectedProduct = products.find((product) => product.id === productId);
    if (!selectedProduct || Number(selectedProduct.stock) < 1) return;

    updateOrderDialogContent();
    qtyInput.max = String(Math.min(MAX_ORDER_QUANTITY, Number(selectedProduct.stock)));
    qtyInput.value = "1";
    updateTotal();
    errorBox.textContent = "";
    form.reset();
    qtyInput.value = "1";
    updateTotal();

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("dialog-open");
    setTimeout(() => {
      const nameInput = document.getElementById("customer-name");
      if (nameInput) nameInput.focus();
    }, 50);
  }

  function closeOrder() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("dialog-open");
    selectedProduct = null;
  }

  function updateTotal() {
    if (!selectedProduct) return;
    const max = Math.max(1, Math.min(MAX_ORDER_QUANTITY, Number(selectedProduct.stock) || 1));
    qtyInput.max = String(max);
    let qty = Number.parseInt(qtyInput.value, 10);
    if (!Number.isFinite(qty)) qty = 1;
    qty = Math.max(1, Math.min(max, qty));
    qtyInput.value = String(qty);
    document.getElementById("order-total").textContent = money(Number(selectedProduct.price) * qty);
  }

  const closeDialogBtn = document.getElementById("close-dialog");
  if (closeDialogBtn) closeDialogBtn.addEventListener("click", closeOrder);
  if (dialog) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeOrder();
    });
  }

  const qtyMinus = document.getElementById("qty-minus");
  if (qtyMinus) {
    qtyMinus.addEventListener("click", () => {
      qtyInput.value = String(Math.max(1, Number(qtyInput.value || 1) - 1));
      updateTotal();
    });
  }

  const qtyPlus = document.getElementById("qty-plus");
  if (qtyPlus) {
    qtyPlus.addEventListener("click", () => {
      qtyInput.value = String(Math.min(Number(qtyInput.max || MAX_ORDER_QUANTITY), Number(qtyInput.value || 1) + 1));
      updateTotal();
    });
  }

  if (qtyInput) qtyInput.addEventListener("input", updateTotal);

  // Form Submission
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      errorBox.textContent = "";

      // Re-fetch latest product state from storage to prevent race condition
      const currentProducts = window.ZeroStore ? window.ZeroStore.getProducts() : products;
      const latestProd = currentProducts.find((p) => p.id === selectedProduct.id && p.status !== "inactive");

      if (!latestProd || Number(latestProd.stock) < 1) {
        errorBox.textContent = "Sorry, this fragrance is currently out of stock or unavailable.";
        return;
      }

      const name = document.getElementById("customer-name").value.trim();
      const phone = document.getElementById("customer-phone").value.trim();
      const address = document.getElementById("customer-address").value.trim();
      const quantity = Number.parseInt(qtyInput.value, 10);

      if (!name || !phone || !address) {
        errorBox.textContent = "Please complete all required fields.";
        return;
      }
      if (!/^[+()\d\s.-]{7,25}$/.test(phone)) {
        errorBox.textContent = "Please enter a valid phone number.";
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(latestProd.stock) || quantity > MAX_ORDER_QUANTITY) {
        errorBox.textContent = `Please enter a quantity between 1 and ${Math.min(MAX_ORDER_QUANTITY, Number(latestProd.stock))}.`;
        return;
      }

      if (!/^880\d{10,13}$/.test(WHATSAPP_NUMBER)) {
        errorBox.textContent = "The business WhatsApp number has not been configured yet. Please update WHATSAPP_NUMBER in js/app.js.";
        return;
      }

      const subtotal = Number(latestProd.price) * quantity;
      const now = new Date();
      const orderDateStr = now.toLocaleString("en-BD", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      const messageLines = [
        "*ZEROØ FRAGRANCE — NEW ORDER*",
        "",
        "Hello! I would like to place an order.",
        "",
        "*CUSTOMER INFORMATION*",
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Delivery Address: ${address}`,
        "",
        "*ORDER DETAILS*",
        `Product: ${latestProd.name}`,
        `Product ID: ${latestProd.id}`,
        `Unit Price: ${money(latestProd.price)}`,
        `Quantity: ${quantity}`,
        `Subtotal: ${money(subtotal)}`,
        "Delivery Charge: Not included / To be confirmed",
        `*Total: ${money(subtotal)}*`,
        "",
        `Order Date: ${orderDateStr}`,
        "",
        "Please confirm my order and delivery details. Thank you!"
      ];

      const fullMessage = messageLines.join("\n");
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(fullMessage)}`;

      // Direct navigation to prevent popup blockers from silencing the checkout
      const newTab = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
        window.location.href = whatsappUrl;
      }
      closeOrder();
    });
  }

  const contactLink = document.getElementById("contact-whatsapp");
  if (contactLink) {
    contactLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (!/^880\d{10,13}$/.test(WHATSAPP_NUMBER)) {
        showToast("Set your business WhatsApp number in js/app.js first.");
        return;
      }
      window.open(`https://wa.me/${WHATSAPP_NUMBER}`, "_blank", "noopener,noreferrer");
    });
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Listen to shared store updates (via BroadcastChannel, localStorage event, or same tab)
  if (window.ZeroStore) {
    window.ZeroStore.subscribe(() => {
      loadAndRenderProducts();
    });
  }

  // Initial load
  loadAndRenderProducts();
})();
