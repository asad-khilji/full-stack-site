/* -------------------------------------------------------------
   MiniShop — Vanilla E-Commerce (HTML • CSS • JS • JSON)
   Now with: sticky header, product detail page (#/p/:id) routing.
---------------------------------------------------------------- */

(() => {
  // ====== DOM ======
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const elGrid      = $('#grid');
  const elEmpty     = $('#empty');
  const elQ         = $('#q');
  const elCat       = $('#cat');
  const elSort      = $('#sort');

  const elCartBtn   = $('#cartBtn');
  const elCartBadge = $('#cartBadge');
  const elDrawer    = $('#drawer');
  const elScrim     = $('#drawer .scrim');
  const elPanel     = $('#drawer .panel');
  const elCloseCart = $('#closeCart');
  const elCartLines = $('#cartLines');

  const elSubTotal  = $('#subTotal');
  const elTax       = $('#tax');
  const elShip      = $('#ship');
  const elGrand     = $('#grand');

  const elDemoAdd   = $('#demoAdd');

  const elCheckoutBtn = $('#checkout');
  const ckDialog    = $('#checkoutDialog');
  const ckForm      = $('#checkoutForm');
  const ckCloseBtn  = $('#checkoutDialog .ck-close');
  const ckCancelBtn = $('#ckCancel');

  const ckItemsCount = $('#ckItemsCount');
  const ckSub        = $('#ckSub');
  const ckTax        = $('#ckTax');
  const ckTotal      = $('#ckTotal');

  // New: containers for list vs. product page
  const elMain      = document.querySelector('main');
  const elProductPage = document.getElementById('productPage');

  // ====== Config ======
  const CART_KEY     = 'minishop:cart';
  const TAX_RATE     = 0.00; // set your tax rate here
  const SHIP_LABEL   = 'Free';

  // ====== State ======
  let PRODUCTS = [];
  let FILTERED = [];
  let currencySymbol = '$';

  // ====== Utils ======
  const fmt = (n) => `${currencySymbol}${Number(n || 0).toFixed(2)}`;
  const by = (k, dir = 1, proj = (x)=>x[k]) => (a,b) => (proj(a) > proj(b) ? 1 : proj(a) < proj(b) ? -1 : 0) * dir;

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
  }

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  }

  function setCart(arr) {
    localStorage.setItem(CART_KEY, JSON.stringify(arr));
    updateCartBadge();
  }

  function addToCart(item) {
    const cart = getCart();
    const found = cart.find(x => x.id === item.id);
    if (found) found.qty += item.qty || 1;
    else cart.push({ id: item.id, title: item.title, price: Number(item.price), qty: item.qty || 1, image: item.image || '' });
    setCart(cart);
    renderCartLines();
  }

  function removeFromCart(id) {
    setCart(getCart().filter(x => x.id !== id));
    renderCartLines();
  }

  function updateQty(id, qty) {
    const cart = getCart();
    const line = cart.find(x => x.id === id);
    if (!line) return;
    line.qty = Math.max(1, Number(qty) || 1);
    setCart(cart);
    renderCartLines();
  }

  function clearCart() {
    setCart([]);
    renderCartLines();
  }

  function totals(cart) {
    const subtotal = cart.reduce((s,i) => s + Number(i.price) * Number(i.qty), 0);
    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const grand = +(subtotal + tax).toFixed(2);
    return { subtotal, tax, grand };
  }

  function updateCartBadge() {
    const count = getCart().reduce((s,i)=>s+Number(i.qty),0);
    elCartBadge.textContent = String(count);
  }

  // ====== Catalog ======
  function renderProducts(items) {
    elGrid.innerHTML = '';
    if (!items.length) {
      elEmpty.hidden = false;
      return;
    }
    elEmpty.hidden = true;

    const frag = document.createDocumentFragment();
    items.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <a class="card-link" href="#/p/${encodeURIComponent(p.id)}" aria-label="Open ${p.title}">
          <div class="thumb">
            ${p.badge ? `<span class="pill">${p.badge}</span>` : ''}
            ${p.image ? `<img src="${p.image}" alt="${p.title}">` : ''}
          </div>
          <div class="body">
            <div class="title">${p.title}</div>
            <div class="price-row">
              <div class="price">${fmt(p.price)}</div>
            </div>
          </div>
        </a>
        <div class="card-actions">
          <button class="btn primary add" aria-label="Add ${p.title} to cart">Add to Cart</button>
        </div>
      `;
      // prevent navigation when adding to cart from card
      $('.add', card).addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({ id:p.id, title:p.title, price:p.price, qty:1, image:p.image });
      });
      frag.appendChild(card);
    });
    elGrid.appendChild(frag);
  }

  function applyFilters() {
    const q = (elQ.value || '').trim().toLowerCase();
    const cat = elCat.value || '';
    let arr = PRODUCTS.slice();

    if (q) {
      arr = arr.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    if (cat) {
      arr = arr.filter(p => String(p.category) === cat);
    }

    switch (elSort.value) {
      case 'price-asc':  arr.sort(by('price', +1, x=>Number(x.price))); break;
      case 'price-desc': arr.sort(by('price', -1, x=>Number(x.price))); break;
      case 'rating':     arr.sort(by('rating', -1, x=>Number(x.rating || 0))); break;
      case 'new':        arr.sort(by('createdAt', -1, x=>new Date(x.createdAt||0).getTime())); break;
      default:           arr.sort(by('featured', -1, x=>(x.featured?1:0))); break;
    }

    FILTERED = arr;
    renderProducts(FILTERED);
  }

  function populateCategories() {
    const cats = [...new Set(PRODUCTS.map(p => String(p.category || '')))].filter(Boolean).sort();
    elCat.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // ====== Drawer (Cart) ======
  function openDrawer() {
    elDrawer.classList.add('open');
    elDrawer.setAttribute('aria-hidden', 'false');
    renderCartLines();
  }
  function closeDrawer() {
    elDrawer.classList.remove('open');
    elDrawer.setAttribute('aria-hidden', 'true');
  }

  function renderCartLines() {
    const cart = getCart();
    const { subtotal, tax, grand } = totals(cart);

    elCartLines.innerHTML = '';

    if (!cart.length) {
      elCartLines.innerHTML = `<div class="empty">Your cart is empty.</div>`;
    } else {
      const frag = document.createDocumentFragment();
      cart.forEach(line => {
        const row = document.createElement('div');
        row.className = 'line';
        row.innerHTML = `
          <div class="mini">${line.image ? `<img src="${line.image}" alt="" style="max-width:70%; max-height:70%; object-fit:contain">` : ''}</div>
          <div>
            <div class="name">${line.title}</div>
            <div class="desc">${fmt(line.price)} each</div>
            <div class="qty" aria-label="Quantity controls">
              <button type="button" aria-label="Decrease">−</button>
              <input type="number" min="1" value="${line.qty}">
              <button type="button" aria-label="Increase">+</button>
            </div>
          </div>
          <div style="display:grid; gap:8px; justify-items:end">
            <div><strong>${fmt(line.price * line.qty)}</strong></div>
            <button class="btn" type="button">Remove</button>
          </div>
        `;
        const [decBtn, qtyInput, incBtn] = $$('.qty button, .qty input', row);
        decBtn.addEventListener('click', () => updateQty(line.id, line.qty - 1));
        incBtn.addEventListener('click', () => updateQty(line.id, line.qty + 1));
        qtyInput.addEventListener('change', (e) => updateQty(line.id, e.target.value));
        $('.btn', row).addEventListener('click', () => removeFromCart(line.id));
        frag.appendChild(row);
      });
      elCartLines.appendChild(frag);
    }

    elSubTotal.textContent = fmt(subtotal);
    elTax.textContent      = fmt(tax);
    elShip.textContent     = SHIP_LABEL;
    elGrand.textContent    = fmt(grand);

    if (ckDialog?.open) {
      ckItemsCount.textContent = String(cart.reduce((s,i)=>s+Number(i.qty),0));
      ckSub.textContent   = fmt(subtotal);
      ckTax.textContent   = fmt(tax);
      ckTotal.textContent = fmt(grand);
    }
  }

  // ====== Checkout (FormSubmit wiring; native POST) ======
  const COPY_ME = ''; // e.g. 'orders@yourdomain.com' or leave empty

  const FORMSUBMIT_ACTION = 'https://formsubmit.co/'; // enforced
  if (ckForm) {
    const currentAction = ckForm.getAttribute('action') || '';
    if (!/^https:\/\/formsubmit\.co\//i.test(currentAction)) {
      ckForm.setAttribute('action', FORMSUBMIT_ACTION);
    }
    ckForm.setAttribute('method', 'POST');
  }

  function ensureHidden(name, value) {
    let input = ckForm.querySelector(`input[name="${name}"]`);
    if (!input) {
      input = document.createElement('input'); input.type = 'hidden'; input.name = name; ckForm.appendChild(input);
    }
    input.value = value;
  }

  function cartToText(items) {
    if (!items.length) return '(no items)';
    return items.map(i => `${i.title} × ${i.qty} — ${fmt(Number(i.price) * Number(i.qty))}`).join('\n');
  }

  function cartToJSON(items, t) {
    return JSON.stringify({
      items: items.map(i => ({
        id: i.id, title: i.title, qty: Number(i.qty),
        price: Number(i.price),
        lineTotal: +(Number(i.price) * Number(i.qty)).toFixed(2)
      })),
      totals: {
        subtotal: +t.subtotal.toFixed(2),
        tax: +t.tax.toFixed(2),
        total: +t.grand.toFixed(2),
        currency: 'USD'
      },
      createdAt: new Date().toISOString()
    });
  }

  function openCheckout() {
    const cart = getCart();
    const t = totals(cart);
    ckItemsCount.textContent = String(cart.reduce((s,i)=>s+Number(i.qty),0));
    ckSub.textContent   = fmt(t.subtotal);
    ckTax.textContent   = fmt(t.tax);
    ckTotal.textContent = fmt(t.grand);
    if (ckDialog && typeof ckDialog.showModal === 'function') ckDialog.showModal();
  }
  function closeCheckout() { try { ckDialog?.close(); } catch {} }

  ckForm?.addEventListener('submit', () => {
    const cart = getCart();
    const t = totals(cart);
    ensureHidden('order_items', cartToText(cart));
    ensureHidden('order_json',  cartToJSON(cart, t));
    ensureHidden('subtotal',    t.subtotal.toFixed(2));
    ensureHidden('tax',         t.tax.toFixed(2));
    ensureHidden('total',       t.grand.toFixed(2));
    if (COPY_ME) ensureHidden('_cc', COPY_ME);
    const emailField = ckForm.querySelector('input[name="email"]');
    if (emailField?.value) ensureHidden('_replyto', emailField.value);
    localStorage.removeItem(CART_KEY); // clear on submit
  });

  // ====== Events / Wiring ======
  elQ?.addEventListener('input', () => { applyFilters(); announceCount(); });
  elCat?.addEventListener('change', () => { applyFilters(); announceCount(); });
  elSort?.addEventListener('change', () => { applyFilters(); announceCount(); });

  elCartBtn?.addEventListener('click', openDrawer);
  elCloseCart?.addEventListener('click', closeDrawer);
  elScrim?.addEventListener('click', closeDrawer);

  $('#clearCart')?.addEventListener('click', clearCart);
  elCheckoutBtn?.addEventListener('click', (e) => { e.preventDefault(); openCheckout(); });
  ckCloseBtn?.addEventListener('click', closeCheckout);
  ckCancelBtn?.addEventListener('click', closeCheckout);

  elDemoAdd?.addEventListener('click', async () => {
    if (!FILTERED.length) return;
    const picks = FILTERED.slice(0, Math.min(3, FILTERED.length));
    picks.forEach(p => addToCart({ id:p.id, title:p.title, price:p.price, qty:1, image:p.image }));
    openDrawer();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); elQ?.focus(); elQ?.select(); }
    if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c') {
      const isOpen = elDrawer.classList.contains('open'); isOpen ? closeDrawer() : openDrawer();
    }
  });

  // ====== Simple Hash Router for Product Page ======
  function go(route) { location.hash = route; }
  function currentRoute() { return location.hash.replace(/^#/, '') || '/'; }
  function findProduct(id) { return PRODUCTS.find(p => String(p.id) === String(id)); }

  function showList() {
    if (elMain) elMain.hidden = false;
    if (elProductPage) elProductPage.hidden = true;
  }

  function showProduct(id) {
    const p = findProduct(id);
    if (!elProductPage) return;

    if (!p) {
      elProductPage.innerHTML = `<div class="empty">Product not found.</div>`;
    } else {
      elProductPage.innerHTML = `
        <div class="pp-wrap">
          <nav class="pp-breadcrumb">
            <a href="#/" class="pp-back" aria-label="Back to products">← Back</a>
          </nav>
          <article class="pp-card">
            <div class="pp-media">
              ${p.image ? `<img src="${p.image}" alt="${p.title}">` : `<div class="pp-placeholder">No image</div>`}
              ${p.badge ? `<span class="pill">${p.badge}</span>` : ''}
            </div>
            <div class="pp-body">
              <h1 class="pp-title">${p.title}</h1>
              <div class="pp-meta">
                <span class="pp-price">${fmt(p.price)}</span>
              </div>
              ${p.category ? `<div class="pp-cat">Category: <strong>${p.category}</strong></div>` : ''}
              <p class="pp-desc">${p.description || ''}</p>
              <div class="pp-actions">
                <button class="btn primary" id="ppAdd">Add to Cart</button>
                <button class="btn" id="ppBuy">Buy Now</button>
              </div>
            </div>
          </article>
        </div>
      `;

      elProductPage.querySelector('#ppAdd')?.addEventListener('click', () => {
        addToCart({ id: p.id, title: p.title, price: p.price, qty: 1, image: p.image });
      });
      elProductPage.querySelector('#ppBuy')?.addEventListener('click', () => {
        addToCart({ id: p.id, title: p.title, price: p.price, qty: 1, image: p.image });
        openDrawer();
      });
    }

    if (elMain) elMain.hidden = true;
    elProductPage.hidden = false;
    document.title = p ? `${p.title} — MiniShop` : 'MiniShop';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function handleRoute() {
    const route = currentRoute();
    const m = route.match(/^\/?p\/(.+)$/);
    if (m) showProduct(decodeURIComponent(m[1]));
    else { document.title = 'MiniShop'; showList(); }
  }

  window.addEventListener('hashchange', handleRoute);

  // ====== Accessibility helper ======
  function announceCount(){
    const c = FILTERED.length;
    elGrid?.setAttribute('aria-label', `${c} product${c===1?'':'s'} shown`);
  }

  // ====== Init ======
  (async function init() {
    try {
      const data = await fetchJSON('./products.json');
      const raw = Array.isArray(data) ? data : (data.products || []);

      const code = (Array.isArray(data) ? null : data.currency) || 'USD';
      const map = { USD:'$', EUR:'€', GBP:'£', CAD:'$', AUD:'$', JPY:'¥' };
      currencySymbol = map[String(code).toUpperCase()] || '$';

      const updatedAt = Array.isArray(data) ? new Date().toISOString() : (data.updatedAt || new Date().toISOString());
      PRODUCTS = raw.map(p => ({
        ...p,
        id: p.id,
        title: p.title ?? p.name ?? 'Untitled',
        description: p.description ?? '',
        category: p.category ?? '',
        price: Number(p.price),
        rating: Number(p.rating || 0),
        reviews: Number(p.reviews || 0),
        featured: Boolean(p.featured),
        image: p.image ?? '',
        badge: p.badge ?? (p.new ? 'New' : ''),
        createdAt: p.createdAt ?? updatedAt
      }));

      populateCategories();
      applyFilters();
      updateCartBadge();
      renderCartLines();
      announceCount();

      // route after products are ready (supports deep-link)
      handleRoute();

    } catch (err) {
      console.error('Init error:', err);
      if (elGrid) elGrid.innerHTML = `<div class="empty">Could not load products.</div>`;
      elEmpty.hidden = true;
    }
  })();
})();
