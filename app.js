/*
 * MiniShop — Fully client-side storefront
 * - Catalog from products.json (preferred) with inline <script id="products-data"> fallback
 * - Search, filter by category, sort
 * - Cart with localStorage persistence
 * - Checkout modal that emails order details (Formspree or custom backend)
 *
 * Tip: When using products.json, serve via a local server so fetch() works:
 *   python3 -m http.server 8080
 */

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const fmt = new Intl.NumberFormat(undefined, { style:'currency', currency:'USD' });

// ---- State
let PRODUCTS = [];
const state = {
  q: '',
  cat: '',
  sort: 'featured',
  cart: loadCart(), // { [id]: qty }
};

// ---- DOM refs
const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const qInput = document.getElementById('q');
const catSel = document.getElementById('cat');
const sortSel = document.getElementById('sort');
const cartBtn = document.getElementById('cartBtn');
const cartBadge = document.getElementById('cartBadge');
const drawer = document.getElementById('drawer');
const closeCartBtn = document.getElementById('closeCart');
const cartLines = document.getElementById('cartLines');
const subTotalEl = document.getElementById('subTotal');
const taxEl = document.getElementById('tax');
const grandEl = document.getElementById('grand');
const clearBtn = document.getElementById('clearCart');
const checkoutBtn = document.getElementById('checkout');
const demoAddBtn = document.getElementById('demoAdd');

// ---- Checkout modal DOM refs (make sure the dialog HTML exists in index.html)
const ckDialog = document.getElementById('checkoutDialog');
const ckForm   = document.getElementById('checkoutForm');
const ckClose  = ckForm ? ckForm.querySelector('.ck-close') : null;
const ckCancel = document.getElementById('ckCancel');
const ckItemsCount = document.getElementById('ckItemsCount');
const ckSub   = document.getElementById('ckSub');
const ckTax   = document.getElementById('ckTax');
const ckTotal = document.getElementById('ckTotal');

// ---- Data loading
async function loadCatalog() {
  // 1) Try products.json (recommended)
  try {
    const res = await fetch('./products.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.products) throw new Error('Invalid products.json shape');
    console.info('Loaded catalog from products.json');
    return data;
  } catch (err) {
    console.warn('Falling back to inline #products-data. Reason:', err);
  }

  // 2) Fallback to inline <script id="products-data"> if present
  const inline = document.getElementById('products-data');
  if (inline?.textContent?.trim()) {
    try {
      const data = JSON.parse(inline.textContent);
      if (!data?.products) throw new Error('Invalid inline catalog shape');
      console.info('Loaded catalog from inline script tag');
      return data;
    } catch (e) {
      console.error('Inline catalog parse error:', e);
    }
  }

  // 3) Final fallback: empty list
  console.error('No catalog found. Ensure products.json exists or keep the inline script.');
  return { products: [] };
}

// ---- Helpers
function saveCart(){ localStorage.setItem('minishop.cart', JSON.stringify(state.cart)); updateCartBadge(); }
function loadCart(){ try{ return JSON.parse(localStorage.getItem('minishop.cart')) || {} } catch{ return {} } }
function cartCount(){ return Object.values(state.cart).reduce((a,b)=>a+b,0) }

function categoryColor(cat){
  const map = {
    'Electronics':'#60a5fa',
    'Outdoors':'#34d399',
    'Apparel':'#f472b6',
    'Home & Living':'#f59e0b'
  };
  return map[cat] || '#a78bfa';
}
function placeholderImg(name, cat){
  const bg = categoryColor(cat);
  const text = encodeURIComponent(name.split(' ').slice(0,2).join('%20'));
  const svg = `<?xml version='1.0' encoding='UTF-8'?>
  <svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${bg}' stop-opacity='.25'/>
        <stop offset='1' stop-color='#0b1229'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(%23g)'/>
    <g fill='#e2e8f0' font-family='Inter, ui-sans-serif, system-ui' font-weight='800'>
      <text x='50%' y='54%' text-anchor='middle' font-size='48'>${text}</text>
    </g>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function updateCartBadge(){ cartBadge.textContent = cartCount(); }

function applyFilters(){
  const term = state.q.trim().toLowerCase();
  let list = PRODUCTS.filter(p => (
    (!state.cat || p.category === state.cat) &&
    (!term || p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term))
  ));
  switch(state.sort){
    case 'price-asc': list.sort((a,b)=>a.price-b.price); break;
    case 'price-desc': list.sort((a,b)=>b.price-a.price); break;
    case 'rating': list.sort((a,b)=>b.rating-a.rating); break;
    case 'new': list.sort((a,b)=> (b.new===true)-(a.new===true) || b.reviews-a.reviews ); break;
    default: // featured
      list.sort((a,b)=> (b.featured===true)-(a.featured===true) || b.reviews-a.reviews);
  }
  return list;
}

function render(){
  const items = applyFilters();
  grid.innerHTML = '';
  if(items.length === 0){ empty.hidden = false; return }
  empty.hidden = true;
  for(const p of items){
    const card = document.createElement('article');
    card.className = 'card'; card.setAttribute('aria-label', p.name);
    card.innerHTML = `
      <div class="thumb">
        <span class="pill">${p.category}</span>
        <img alt="${p.name}" src="${placeholderImg(p.name, p.category)}" loading="lazy" decoding="async" />
      </div>
      <div class="body">
        <div class="title">${p.name}</div>
        <div class="desc">${p.description}</div>
        <div class="price-row">
          <div>
            <div class="price">${fmt.format(p.price)}</div>
            <div class="rating">★ ${p.rating.toFixed(1)} <span style="color:var(--muted); font-weight:600">(${p.reviews})</span></div>
          </div>
          <button class="btn add" data-id="${p.id}" aria-label="Add ${p.name} to cart">Add</button>
        </div>
      </div>`;
    grid.appendChild(card);
  }
}

// ---- Cart ops
function addToCart(id, qty=1){ state.cart[id] = (state.cart[id]||0) + qty; saveCart(); flashCartBtn(); }
function removeFromCart(id){ delete state.cart[id]; saveCart(); renderCart(); }
function setQty(id, qty){ if(qty<=0) { removeFromCart(id); } else { state.cart[id]=qty; saveCart(); renderCartTotals(); } }

function renderCart(){
  cartLines.innerHTML = '';
  const ids = Object.keys(state.cart);
  if(ids.length===0){
    const div = document.createElement('div');
    div.className = 'empty'; div.textContent = 'Your cart is empty. Add some items!';
    cartLines.appendChild(div);
  } else {
    for(const id of ids){
      const p = PRODUCTS.find(x=>x.id===id); if(!p) continue;
      const qty = state.cart[id];
      const line = document.createElement('div');
      line.className = 'line'; line.innerHTML = `
        <div class="mini"><img src="${placeholderImg(p.name, p.category)}" alt="" width="56" height="56"/></div>
        <div>
          <div class="name">${p.name}</div>
          <div class="desc" style="margin-top:2px">${fmt.format(p.price)} • <span style="color:var(--muted)">${p.brand}</span></div>
        </div>
        <div style="display:grid; gap:6px; justify-items:end">
          <div class="qty">
            <button data-step="-1" data-id="${p.id}" aria-label="Decrease quantity">−</button>
            <input inputmode="numeric" pattern="[0-9]*" value="${qty}" data-id="${p.id}" aria-label="Quantity for ${p.name}" />
            <button data-step="1" data-id="${p.id}" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn" data-remove="${p.id}" aria-label="Remove ${p.name}">Remove</button>
        </div>`;
      cartLines.appendChild(line);
    }
  }
  renderCartTotals();
}

function renderCartTotals(){
  const lines = Object.entries(state.cart).map(([id,qty])=>{
    const p = PRODUCTS.find(x=>x.id===id); if(!p) return 0; return p.price*qty;
  });
  const sub = lines.reduce((a,b)=>a+b,0);
  const tax = +(sub * 0.07).toFixed(2); // 7% example tax
  const grand = sub + tax; 
  subTotalEl.textContent = fmt.format(sub);
  taxEl.textContent = fmt.format(tax);
  grandEl.textContent = fmt.format(grand);
  updateCartBadge();
}

function openCart(){ drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false'); renderCart(); }
function closeCart(){ drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
function flashCartBtn(){ cartBtn.animate([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:240}); }

// ---- Events
qInput.addEventListener('input', e=>{ state.q = e.target.value; render(); });
catSel.addEventListener('change', e=>{ state.cat = e.target.value; render(); });
sortSel.addEventListener('change', e=>{ state.sort = e.target.value; render(); });

grid.addEventListener('click', (e)=>{
  const btn = e.target.closest('.add');
  if(btn){ addToCart(btn.dataset.id, 1); }
});

cartBtn.addEventListener('click', openCart);
$('#drawer .scrim').addEventListener('click', closeCart);
closeCartBtn.addEventListener('click', closeCart);

cartLines.addEventListener('click', e=>{
  const rm = e.target.closest('[data-remove]');
  if(rm){ removeFromCart(rm.dataset.remove); }
  const stepBtn = e.target.closest('button[data-step]');
  if(stepBtn){
    const id = stepBtn.dataset.id; const step = parseInt(stepBtn.dataset.step,10);
    const current = state.cart[id]||1; setQty(id, current + step);
  }
});
cartLines.addEventListener('input', e=>{
  const inp = e.target.closest('input[data-id]');
  if(inp){ const id = inp.dataset.id; const val = Math.max(0, parseInt(inp.value||'0',10)); setQty(id, val); }
});

clearBtn.addEventListener('click', ()=>{ state.cart = {}; saveCart(); renderCart(); });

// Keyboard shortcuts
document.addEventListener('keydown', (e)=>{
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); qInput.focus(); }
  if(e.key.toLowerCase()==='c'){ openCart(); }
  if(e.key==='Escape'){ 
    // close topmost thing (dialog > drawer)
    if(ckDialog && ckDialog.open) ckDialog.close();
    else closeCart(); 
  }
});

// ---- Checkout helpers
function getOrderSnapshot(){
  const items = Object.entries(state.cart).map(([id, qty])=>{
    const p = PRODUCTS.find(x=>x.id===id);
    return p ? { id, name: p.name, price: p.price, qty, line: +(p.price*qty).toFixed(2) } : null;
  }).filter(Boolean);

  const sub = items.reduce((a,b)=>a+b.line,0);
  const tax = +(sub * 0.07).toFixed(2);
  const total = +(sub + tax).toFixed(2);
  const count = items.reduce((a,b)=>a+b.qty,0);

  return { items, sub, tax, total, count };
}

function orderAsText(order, customer, orderId){
  const lines = order.items.map(i => `• ${i.name} x${i.qty} — $${i.line.toFixed(2)}`).join('\n');
  return `
Order: ${orderId}
Name: ${customer.name}
Email: ${customer.email}
Address: ${customer.address1}${customer.address2 ? (', ' + customer.address2) : ''}, ${customer.city}, ${customer.state} ${customer.zip}
Notes: ${customer.notes || '-'}

Items (${order.count}):
${lines}

Subtotal: $${order.sub.toFixed(2)}
Tax: $${order.tax.toFixed(2)}
Shipping: Free
Total: $${order.total.toFixed(2)}
`.trim();
}

// ---- Checkout (email handoff)
// Replace with your Formspree endpoint or a backend route (see readme/instructions)
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/khiljiasad2@gmail.com';

if (checkoutBtn && ckDialog && ckForm) {
  checkoutBtn.addEventListener('click', ()=>{
    if(cartCount()===0){ alert('Your cart is empty.'); return; }
    // populate summary
    const snap = getOrderSnapshot();
    if (ckItemsCount) ckItemsCount.textContent = String(snap.count);
    if (ckSub)   ckSub.textContent  = fmt.format(snap.sub);
    if (ckTax)   ckTax.textContent  = fmt.format(snap.tax);
    if (ckTotal) ckTotal.textContent = fmt.format(snap.total);

    // open modal
    ckDialog.showModal();
    const firstField = ckForm.querySelector('#ckName');
    if (firstField) firstField.focus();
  });

  if (ckClose)  ckClose.addEventListener('click', ()=> ckDialog.close());
  if (ckCancel) ckCancel.addEventListener('click', ()=> ckDialog.close());

  ckForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = new FormData(ckForm);
    const customer = {
      name: form.get('name')?.toString().trim(),
      email: form.get('email')?.toString().trim(),
      address1: form.get('address1')?.toString().trim(),
      address2: form.get('address2')?.toString().trim(),
      city: form.get('city')?.toString().trim(),
      state: form.get('state')?.toString().trim(),
      zip: form.get('zip')?.toString().trim(),
      notes: form.get('notes')?.toString().trim(),
    };

    // Basic validation
    if(!customer.name || !customer.email || !customer.address1 || !customer.city || !customer.state || !customer.zip){
      alert('Please complete all required fields.');
      return;
    }

    const orderId = 'ORD-' + Math.random().toString(36).slice(2,8).toUpperCase();
    const snap = getOrderSnapshot();
    const emailText = orderAsText(snap, customer, orderId);

    // Payload: include both machine-readable and a text fallback
    const payload = {
      orderId,
      ...customer,
      items: snap.items,
      subtotal: snap.sub,
      tax: snap.tax,
      total: snap.total,
      message: emailText
    };

    const submitBtn = document.getElementById('ckSubmit');
    if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

    try{
      const res = await fetch(FORMSUBMIT_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
  body: JSON.stringify(payload)
});

      if(!res.ok){
        throw new Error(`Email send failed (${res.status})`);
      }

      alert(`Thank you! Your order ${orderId} was sent. We'll email you shortly.`);
      state.cart = {}; saveCart(); renderCart(); closeCart(); ckDialog.close();

    } catch(err){
      console.error(err);
      alert('Sorry, there was an issue sending your order. Please try again.');
    } finally {
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
    }
  });
}

// ---- Boot
(async function init(){
  const catalog = await loadCatalog();
  PRODUCTS = (catalog.products || []).map(p => ({...p}));

  // Populate categories after products load
  const categories = Array.from(new Set(PRODUCTS.map(p => p.category))).sort();
  for(const c of categories){
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c; catSel.appendChild(opt);
  }

  render();
  updateCartBadge();
})();

// Demo add after init (kept same)
if (demoAddBtn){
  demoAddBtn.addEventListener('click', ()=>{
    const picks = PRODUCTS.filter(p=>p.featured).sort(()=>Math.random()-.5).slice(0,3);
    picks.forEach(p=>addToCart(p.id, 1));
    openCart();
  });
}
