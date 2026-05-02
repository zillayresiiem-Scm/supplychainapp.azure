// =============================================
// SUPPLY CHAIN APP — COMPLETE SERVER
// Deploy this to Azure App Service (Node 20 LTS)
// =============================================

const http  = require('http');
const url   = require('url');
const crypto = require('crypto');

// ─── In-memory database (no SQL needed for demo) ──────────────────
const DB = {
  users: [
    { id:'u1', email:'admin@supplychainapp.com',    password: hash('Admin@123'),    name:'Admin User',   role:'admin'   },
    { id:'u2', email:'manager@supplychainapp.com',  password: hash('Manager@123'),  name:'John Manager', role:'manager' },
    { id:'u3', email:'staff@supplychainapp.com',    password: hash('Staff@123'),    name:'Jane Staff',   role:'staff'   },
  ],
  products: [
    { id:'p1', sku:'SKU-001', name:'Steel Pipes',       category:'Raw Material', price:150.00, stock:500, reorder:100, supplier:'s1' },
    { id:'p2', sku:'SKU-002', name:'Copper Wire',        category:'Raw Material', price:80.00,  stock:320, reorder:80,  supplier:'s2' },
    { id:'p3', sku:'SKU-003', name:'Plastic Casing',     category:'Components',  price:12.50,  stock:1200,reorder:200, supplier:'s1' },
    { id:'p4', sku:'SKU-004', name:'Circuit Boards',     category:'Electronics', price:45.00,  stock:75,  reorder:50,  supplier:'s3' },
    { id:'p5', sku:'SKU-005', name:'Aluminium Sheets',   category:'Raw Material', price:200.00, stock:180, reorder:60,  supplier:'s2' },
    { id:'p6', sku:'SKU-006', name:'LED Modules',        category:'Electronics', price:8.00,   stock:900, reorder:150, supplier:'s3' },
  ],
  suppliers: [
    { id:'s1', name:'PakMetal Supplies', contact:'Ali Khan',    email:'ali@pakmetal.com',   phone:'+92-300-1234567', rating:4.8, country:'Pakistan', onTime:96 },
    { id:'s2', name:'GoldWire Corp',     contact:'Sara Ahmed',  email:'sara@goldwire.com',  phone:'+92-321-9876543', rating:4.5, country:'Pakistan', onTime:92 },
    { id:'s3', name:'TechParts Ltd',     contact:'Omar Farooq', email:'omar@techparts.com', phone:'+92-333-5551234', rating:4.7, country:'Pakistan', onTime:95 },
  ],
  orders: [
    { id:'o1', number:'ORD-001', customer:'ABC Industries',  items:[{product:'p1',qty:10,price:150}], total:1500, status:'delivered', date:'2025-04-01' },
    { id:'o2', number:'ORD-002', customer:'XYZ Manufacturing',items:[{product:'p4',qty:5, price:45}],  total:225,  status:'shipped',   date:'2025-04-15' },
    { id:'o3', number:'ORD-003', customer:'Metro Builders',  items:[{product:'p3',qty:100,price:12.5}],total:1250, status:'processing',date:'2025-04-28' },
    { id:'o4', number:'ORD-004', customer:'City Electricals',items:[{product:'p6',qty:200,price:8}],   total:1600, status:'pending',   date:'2025-04-30' },
    { id:'o5', number:'ORD-005', customer:'National Steel',  items:[{product:'p2',qty:50,price:80}],   total:4000, status:'pending',   date:'2025-05-01' },
  ],
  shipments: [
    { id:'sh1', order:'o1', tracking:'TRK-001-2025', carrier:'TCS Courier',   status:'delivered',   eta:'2025-04-05', location:'Islamabad - Delivered' },
    { id:'sh2', order:'o2', tracking:'TRK-002-2025', carrier:'Leopard Courier',status:'in_transit',  eta:'2025-05-05', location:'Lahore Hub - In Transit' },
  ],
  sessions: {},
};

function hash(p){ return crypto.createHash('sha256').update(p+process.env.JWT_SECRET||'secret').digest('hex'); }
function makeToken(user){
  const payload = Buffer.from(JSON.stringify({ id:user.id, email:user.email, role:user.role, exp: Date.now()+7*86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET||'secret').update(payload).digest('base64url');
  return payload+'.'+sig;
}
function verifyToken(token){
  if(!token) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET||'secret').update(payload).digest('base64url');
  if(sig !== expected) return null;
  try { const d=JSON.parse(Buffer.from(payload,'base64url')); return d.exp > Date.now() ? d : null; } catch{ return null; }
}
function auth(req){
  const h = req.headers['authorization']||'';
  return verifyToken(h.replace('Bearer ','').trim());
}
function body(req){ return new Promise(res=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{res(JSON.parse(d||'{}'))}catch{res({})} }); }); }
function send(res, status, data){ res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}); res.end(JSON.stringify(data)); }
function uid(){ return 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36); }

// ─── HTML Dashboard ───────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Supply Chain Management — Azure App</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
:root{--blue:#0078d4;--green:#107C10;--orange:#D87000;--red:#C00;--light:#f3f2f1;--border:#e0e0e0;--card:#fff;--text:#323130;--muted:#605e5c}
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
body{background:#f3f2f1;color:#323130;min-height:100vh}
.navbar{background:#0078d4;color:#fff;padding:0 24px;height:48px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-brand{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.nav-brand span{font-size:18px}
.nav-right{display:flex;align-items:center;gap:16px;font-size:13px}
.nav-user{background:rgba(255,255,255,.2);padding:4px 12px;border-radius:12px;font-size:12px}
.logout-btn{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px}
.layout{display:flex;min-height:calc(100vh - 48px)}
.sidebar{width:200px;background:#fff;border-right:1px solid #e0e0e0;padding:12px 0;flex-shrink:0}
.nav-item{padding:10px 20px;cursor:pointer;font-size:13px;color:#605e5c;display:flex;align-items:center;gap:10px;transition:.15s}
.nav-item:hover{background:#f3f2f1;color:#323130}
.nav-item.active{background:#deecf9;color:#0078d4;font-weight:500;border-right:3px solid #0078d4}
.nav-icon{font-size:16px;width:20px;text-align:center}
.main{flex:1;padding:24px;overflow-x:hidden}
.page{display:none}.page.active{display:block}
h1{font-size:20px;font-weight:600;margin-bottom:4px}
.subtitle{font-size:13px;color:#605e5c;margin-bottom:20px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
.metric-card{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:16px;position:relative;overflow:hidden}
.metric-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.metric-card.blue::before{background:#0078d4}.metric-card.green::before{background:#107C10}
.metric-card.orange::before{background:#D87000}.metric-card.red::before{background:#C00}
.m-label{font-size:11px;color:#605e5c;text-transform:uppercase;letter-spacing:.5px}
.m-value{font-size:28px;font-weight:600;margin:4px 0;color:#323130}
.m-sub{font-size:11px;color:#605e5c}
.card{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:16px;margin-bottom:16px}
.card-title{font-size:14px;font-weight:600;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f3f2f1;padding:8px 12px;text-align:left;font-weight:600;font-size:12px;color:#605e5c;border-bottom:1px solid #e0e0e0}
td{padding:10px 12px;border-bottom:1px solid #f3f2f1;vertical-align:middle}
tr:hover td{background:#f9f8f7}
.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:500}
.badge-green{background:#dff6dd;color:#107C10}
.badge-blue{background:#deecf9;color:#0078d4}
.badge-orange{background:#fff4ce;color:#D87000}
.badge-red{background:#fde7e9;color:#C00}
.badge-gray{background:#f3f2f1;color:#605e5c}
.btn{padding:8px 16px;border-radius:4px;border:1px solid;cursor:pointer;font-size:13px;transition:.15s}
.btn-primary{background:#0078d4;color:#fff;border-color:#0078d4}.btn-primary:hover{background:#006cc1}
.btn-secondary{background:#fff;color:#323130;border-color:#e0e0e0}.btn-secondary:hover{background:#f3f2f1}
.btn-success{background:#107C10;color:#fff;border-color:#107C10}
.btn-sm{padding:4px 10px;font-size:12px}
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:700px){.charts-grid{grid-template-columns:1fr}.sidebar{display:none}}
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;align-items:center;justify-content:center}
.modal-bg.open{display:flex}
.modal{background:#fff;border-radius:8px;padding:24px;width:min(480px,90vw);max-height:80vh;overflow-y:auto}
.modal h2{font-size:16px;font-weight:600;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #e0e0e0}
.form-row{margin-bottom:14px}
.form-row label{display:block;font-size:12px;color:#605e5c;margin-bottom:4px;font-weight:500}
.form-row input,.form-row select,.form-row textarea{width:100%;padding:8px 10px;border:1px solid #e0e0e0;border-radius:4px;font-size:13px;outline:none}
.form-row input:focus,.form-row select:focus{border-color:#0078d4}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0}
#loginPage{display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#0078d4 0%,#005a9e 100%)}
.login-box{background:#fff;border-radius:8px;padding:36px;width:min(400px,90vw);box-shadow:0 8px 32px rgba(0,0,0,.15)}
.login-logo{text-align:center;margin-bottom:24px}
.login-logo h1{font-size:22px;color:#0078d4;margin-top:8px}
.login-logo p{font-size:13px;color:#605e5c}
.login-err{background:#fde7e9;color:#C00;padding:8px 12px;border-radius:4px;font-size:13px;margin-bottom:12px;display:none}
.search-box{width:240px;padding:7px 12px;border:1px solid #e0e0e0;border-radius:4px;font-size:13px;outline:none}
.search-box:focus{border-color:#0078d4}
.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.alert{padding:10px 14px;border-radius:4px;font-size:13px;margin-bottom:12px}
.alert-success{background:#dff6dd;color:#107C10}
.alert-error{background:#fde7e9;color:#C00}
canvas{max-height:220px!important}
</style>
</head>
<body>

<!-- LOGIN PAGE -->
<div id="loginPage">
<div class="login-box">
  <div class="login-logo">
    <span style="font-size:40px">🏭</span>
    <h1>Supply Chain</h1>
    <p>Microsoft Azure — Islamabad, PK</p>
  </div>
  <div class="login-err" id="loginErr"></div>
  <div class="form-row"><label>Email address</label><input id="loginEmail" type="email" value="admin@supplychainapp.com" placeholder="email@company.com"/></div>
  <div class="form-row"><label>Password</label><input id="loginPwd" type="password" value="Admin@123" placeholder="Password"/></div>
  <button class="btn btn-primary" style="width:100%;padding:10px" onclick="doLogin()">Sign in →</button>
  <div style="margin-top:16px;padding:10px;background:#f3f2f1;border-radius:4px;font-size:11px;color:#605e5c">
    <b>Test Accounts:</b><br>
    admin@supplychainapp.com / Admin@123<br>
    manager@supplychainapp.com / Manager@123<br>
    staff@supplychainapp.com / Staff@123
  </div>
</div>
</div>

<!-- MAIN APP (hidden until login) -->
<div id="app" style="display:none">
<div class="navbar">
  <div class="nav-brand"><span>🏭</span> Supply Chain Management</div>
  <div class="nav-right">
    <span class="nav-user" id="navUser">—</span>
    <button class="logout-btn" onclick="doLogout()">Sign out</button>
  </div>
</div>
<div class="layout">
  <div class="sidebar">
    <div class="nav-item active" onclick="showPage('dashboard',this)"><span class="nav-icon">📊</span>Dashboard</div>
    <div class="nav-item" onclick="showPage('products',this)"><span class="nav-icon">📦</span>Products</div>
    <div class="nav-item" onclick="showPage('inventory',this)"><span class="nav-icon">🏪</span>Inventory</div>
    <div class="nav-item" onclick="showPage('orders',this)"><span class="nav-icon">📋</span>Orders</div>
    <div class="nav-item" onclick="showPage('suppliers',this)"><span class="nav-icon">🤝</span>Suppliers</div>
    <div class="nav-item" onclick="showPage('shipments',this)"><span class="nav-icon">🚚</span>Shipments</div>
    <div class="nav-item" onclick="showPage('reports',this)"><span class="nav-icon">📈</span>Reports</div>
  </div>
  <div class="main">

    <!-- DASHBOARD -->
    <div class="page active" id="page-dashboard">
      <h1>Dashboard Overview</h1>
      <p class="subtitle">Real-time supply chain metrics — Azure App Service</p>
      <div class="metrics" id="metricsArea"></div>
      <div class="charts-grid">
        <div class="card"><div class="card-title">Order Status Distribution</div><canvas id="chartOrders"></canvas></div>
        <div class="card"><div class="card-title">Inventory Levels</div><canvas id="chartInv"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Recent Orders <button class="btn btn-primary btn-sm" onclick="showPage('orders',null);openOrderModal()">+ New Order</button></div>
        <div id="recentOrders"></div>
      </div>
    </div>

    <!-- PRODUCTS -->
    <div class="page" id="page-products">
      <h1>Products Catalog</h1>
      <p class="subtitle">Manage all products and SKUs</p>
      <div class="toolbar">
        <input class="search-box" placeholder="Search products..." oninput="filterProducts(this.value)"/>
        <button class="btn btn-primary" onclick="openProductModal()">+ Add Product</button>
      </div>
      <div class="card"><div id="productsTable"></div></div>
    </div>

    <!-- INVENTORY -->
    <div class="page" id="page-inventory">
      <h1>Inventory Management</h1>
      <p class="subtitle">Track stock levels across all warehouses</p>
      <div class="card"><div id="inventoryTable"></div></div>
    </div>

    <!-- ORDERS -->
    <div class="page" id="page-orders">
      <h1>Order Management</h1>
      <p class="subtitle">Create and track customer orders</p>
      <div class="toolbar">
        <input class="search-box" placeholder="Search orders..." oninput="filterOrders(this.value)"/>
        <button class="btn btn-primary" onclick="openOrderModal()">+ New Order</button>
      </div>
      <div class="card"><div id="ordersTable"></div></div>
    </div>

    <!-- SUPPLIERS -->
    <div class="page" id="page-suppliers">
      <h1>Supplier Management</h1>
      <p class="subtitle">Manage vendor relationships and performance</p>
      <div class="toolbar"><button class="btn btn-primary" onclick="openSupplierModal()">+ Add Supplier</button></div>
      <div class="card"><div id="suppliersTable"></div></div>
    </div>

    <!-- SHIPMENTS -->
    <div class="page" id="page-shipments">
      <h1>Shipment Tracking</h1>
      <p class="subtitle">Real-time shipment and delivery tracking</p>
      <div class="card"><div id="shipmentsTable"></div></div>
    </div>

    <!-- REPORTS -->
    <div class="page" id="page-reports">
      <h1>Analytics & Reports</h1>
      <p class="subtitle">Supply chain performance insights</p>
      <div class="charts-grid">
        <div class="card"><div class="card-title">Monthly Revenue</div><canvas id="chartRevenue"></canvas></div>
        <div class="card"><div class="card-title">Supplier Performance</div><canvas id="chartSupplier"></canvas></div>
      </div>
      <div class="metrics" id="reportMetrics"></div>
    </div>

  </div>
</div>
</div>

<!-- Modals -->
<div class="modal-bg" id="orderModal">
<div class="modal">
  <h2>Create New Order</h2>
  <div id="modalAlert"></div>
  <div class="form-row"><label>Customer Name *</label><input id="oCustomer" placeholder="e.g. ABC Industries"/></div>
  <div class="form-row"><label>Product *</label><select id="oProduct"></select></div>
  <div class="form-row"><label>Quantity *</label><input id="oQty" type="number" placeholder="10" min="1"/></div>
  <div class="modal-footer">
    <button class="btn btn-secondary" onclick="closeModal('orderModal')">Cancel</button>
    <button class="btn btn-primary" onclick="submitOrder()">Create Order</button>
  </div>
</div>
</div>
<div class="modal-bg" id="productModal">
<div class="modal">
  <h2>Add New Product</h2>
  <div class="form-row"><label>Product Name *</label><input id="pName" placeholder="e.g. Steel Rods"/></div>
  <div class="form-row"><label>SKU *</label><input id="pSku" placeholder="e.g. SKU-007"/></div>
  <div class="form-row"><label>Category *</label><select id="pCat"><option>Raw Material</option><option>Components</option><option>Electronics</option><option>Finished Goods</option></select></div>
  <div class="form-row"><label>Unit Price (PKR) *</label><input id="pPrice" type="number" placeholder="100"/></div>
  <div class="form-row"><label>Initial Stock *</label><input id="pStock" type="number" placeholder="500"/></div>
  <div class="form-row"><label>Reorder Level *</label><input id="pReorder" type="number" placeholder="100"/></div>
  <div class="modal-footer">
    <button class="btn btn-secondary" onclick="closeModal('productModal')">Cancel</button>
    <button class="btn btn-primary" onclick="submitProduct()">Add Product</button>
  </div>
</div>
</div>
<div class="modal-bg" id="supplierModal">
<div class="modal">
  <h2>Add New Supplier</h2>
  <div class="form-row"><label>Company Name *</label><input id="sName" placeholder="e.g. Lahore Metals Ltd"/></div>
  <div class="form-row"><label>Contact Person *</label><input id="sContact" placeholder="e.g. Bilal Ahmed"/></div>
  <div class="form-row"><label>Email *</label><input id="sEmail" type="email" placeholder="contact@company.com"/></div>
  <div class="form-row"><label>Phone</label><input id="sPhone" placeholder="+92-300-0000000"/></div>
  <div class="form-row"><label>Country</label><input id="sCountry" value="Pakistan"/></div>
  <div class="modal-footer">
    <button class="btn btn-secondary" onclick="closeModal('supplierModal')">Cancel</button>
    <button class="btn btn-primary" onclick="submitSupplier()">Add Supplier</button>
  </div>
</div>
</div>

<script>
const API = '';
let TOKEN='', USER={}, ALL={products:[],orders:[],suppliers:[],shipments:[]};

async function api(method,path,data){
  const r=await fetch(API+'/api'+path,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},body:data?JSON.stringify(data):undefined});
  return r.json();
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value;
  const pwd=document.getElementById('loginPwd').value;
  const r=await api('POST','/auth/login',{email,password:pwd});
  if(r.token){ TOKEN=r.token; USER=r.user; localStorage.setItem('sc_token',r.token); localStorage.setItem('sc_user',JSON.stringify(r.user)); initApp(); }
  else{ const e=document.getElementById('loginErr'); e.textContent=r.error||'Login failed'; e.style.display='block'; }
}
function doLogout(){ TOKEN=''; USER={}; localStorage.removeItem('sc_token'); localStorage.removeItem('sc_user'); document.getElementById('loginPage').style.display='flex'; document.getElementById('app').style.display='none'; }

async function initApp(){
  document.getElementById('loginPage').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('navUser').textContent=USER.name||USER.email+' ('+USER.role+')';
  await loadAll();
  renderDashboard();
  renderProducts();
  renderOrders();
  renderSuppliers();
  renderShipments();
  renderInventory();
}
async function loadAll(){
  const [p,o,s,sh]=await Promise.all([api('GET','/products'),api('GET','/orders'),api('GET','/suppliers'),api('GET','/shipments')]);
  ALL.products=p.data||[]; ALL.orders=o.data||[]; ALL.suppliers=s.data||[]; ALL.shipments=sh.data||[];
}

function showPage(id,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el) el.classList.add('active');
  if(id==='reports') renderReports();
}

function statusBadge(s){
  const m={'delivered':'badge-green','shipped':'badge-blue','processing':'badge-orange','pending':'badge-gray','in_transit':'badge-blue','low':'badge-orange','out':'badge-red','ok':'badge-green'};
  return '<span class="badge '+(m[s]||'badge-gray')+'">'+s.replace('_',' ')+'</span>';
}

function renderDashboard(){
  const totalOrders=ALL.orders.length;
  const pending=ALL.orders.filter(o=>o.status==='pending').length;
  const revenue=ALL.orders.reduce((s,o)=>s+o.total,0);
  const lowStock=ALL.products.filter(p=>p.stock<=p.reorder).length;
  document.getElementById('metricsArea').innerHTML=[
    {label:'Total Orders',val:totalOrders,sub:pending+' pending',cls:'blue'},
    {label:'Total Revenue',val:'PKR '+revenue.toLocaleString(),sub:'all time',cls:'green'},
    {label:'Products',val:ALL.products.length,sub:lowStock+' low stock',cls:'orange'},
    {label:'Suppliers',val:ALL.suppliers.length,sub:'active vendors',cls:'blue'},
  ].map(m=>`<div class="metric-card ${m.cls}"><div class="m-label">${m.label}</div><div class="m-value">${m.val}</div><div class="m-sub">${m.sub}</div></div>`).join('');

  const orderCounts={delivered:0,shipped:0,processing:0,pending:0};
  ALL.orders.forEach(o=>orderCounts[o.status]=(orderCounts[o.status]||0)+1);
  const ctx1=document.getElementById('chartOrders').getContext('2d');
  if(window._c1) window._c1.destroy();
  window._c1=new Chart(ctx1,{type:'doughnut',data:{labels:Object.keys(orderCounts),datasets:[{data:Object.values(orderCounts),backgroundColor:['#107C10','#0078d4','#D87000','#e0e0e0']}]},options:{plugins:{legend:{position:'right'}},maintainAspectRatio:true}});

  const ctx2=document.getElementById('chartInv').getContext('2d');
  if(window._c2) window._c2.destroy();
  window._c2=new Chart(ctx2,{type:'bar',data:{labels:ALL.products.map(p=>p.name.split(' ')[0]),datasets:[{label:'Stock',data:ALL.products.map(p=>p.stock),backgroundColor:'#0078d4'},{label:'Reorder',data:ALL.products.map(p=>p.reorder),backgroundColor:'#ffa500'}]},options:{plugins:{legend:{position:'top'}},maintainAspectRatio:true}});

  document.getElementById('recentOrders').innerHTML='<table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>'+
    ALL.orders.slice(0,5).map(o=>`<tr><td><b>${o.number}</b></td><td>${o.customer}</td><td>PKR ${o.total.toLocaleString()}</td><td>${statusBadge(o.status)}</td><td>${o.date}</td></tr>`).join('')+'</tbody></table>';
}

function renderProducts(filter=''){
  const rows=ALL.products.filter(p=>!filter||p.name.toLowerCase().includes(filter)||p.sku.toLowerCase().includes(filter));
  document.getElementById('productsTable').innerHTML='<table><thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead><tbody>'+
    rows.map(p=>{const st=p.stock<=0?'out':p.stock<=p.reorder?'low':'ok'; return`<tr><td><code>${p.sku}</code></td><td><b>${p.name}</b></td><td>${p.category}</td><td>PKR ${p.price}</td><td>${p.stock}</td><td>${statusBadge(st)}</td><td><button class="btn btn-secondary btn-sm" onclick="adjustStock('${p.id}')">Adjust</button></td></tr>`}).join('')+'</tbody></table>';
}
function filterProducts(v){ renderProducts(v.toLowerCase()); }

function renderInventory(){
  document.getElementById('inventoryTable').innerHTML='<table><thead><tr><th>Product</th><th>SKU</th><th>In Stock</th><th>Reserved</th><th>Available</th><th>Reorder Lvl</th><th>Status</th></tr></thead><tbody>'+
    ALL.products.map(p=>{const reserved=Math.floor(p.stock*.1); const avail=p.stock-reserved; const st=avail<=0?'out':avail<=p.reorder?'low':'ok';
      return`<tr><td><b>${p.name}</b></td><td><code>${p.sku}</code></td><td>${p.stock}</td><td>${reserved}</td><td>${avail}</td><td>${p.reorder}</td><td>${statusBadge(st)}</td></tr>`}).join('')+'</tbody></table>';
}

function renderOrders(filter=''){
  const rows=ALL.orders.filter(o=>!filter||o.customer.toLowerCase().includes(filter)||o.number.toLowerCase().includes(filter));
  document.getElementById('ordersTable').innerHTML='<table><thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>'+
    rows.map(o=>`<tr><td><b>${o.number}</b></td><td>${o.customer}</td><td>${o.items.length} item(s)</td><td><b>PKR ${o.total.toLocaleString()}</b></td><td>${statusBadge(o.status)}</td><td>${o.date}</td><td><button class="btn btn-secondary btn-sm" onclick="updateOrderStatus('${o.id}')">Update</button></td></tr>`).join('')+'</tbody></table>';
}
function filterOrders(v){ renderOrders(v.toLowerCase()); }

function renderSuppliers(){
  document.getElementById('suppliersTable').innerHTML='<table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Country</th><th>On-Time %</th><th>Rating</th></tr></thead><tbody>'+
    ALL.suppliers.map(s=>`<tr><td><b>${s.name}</b></td><td>${s.contact}</td><td>${s.email}</td><td>🇵🇰 ${s.country}</td><td>${s.onTime}%</td><td>⭐ ${s.rating}/5</td></tr>`).join('')+'</tbody></table>';
}

function renderShipments(){
  document.getElementById('shipmentsTable').innerHTML='<table><thead><tr><th>Tracking #</th><th>Order</th><th>Carrier</th><th>Current Location</th><th>ETA</th><th>Status</th></tr></thead><tbody>'+
    ALL.shipments.map(s=>`<tr><td><b><code>${s.tracking}</code></b></td><td>${s.order}</td><td>${s.carrier}</td><td>📍 ${s.location}</td><td>${s.eta}</td><td>${statusBadge(s.status)}</td></tr>`).join('')+'</tbody></table>';
}

function renderReports(){
  const months=['Nov','Dec','Jan','Feb','Mar','Apr'];
  const rev=[85000,92000,78000,110000,98000,125000];
  const ctx3=document.getElementById('chartRevenue').getContext('2d');
  if(window._c3) window._c3.destroy();
  window._c3=new Chart(ctx3,{type:'line',data:{labels:months,datasets:[{label:'Revenue (PKR)',data:rev,borderColor:'#0078d4',fill:true,backgroundColor:'rgba(0,120,212,.08)',tension:.4}]},options:{maintainAspectRatio:true}});

  const ctx4=document.getElementById('chartSupplier').getContext('2d');
  if(window._c4) window._c4.destroy();
  window._c4=new Chart(ctx4,{type:'bar',data:{labels:ALL.suppliers.map(s=>s.name.split(' ')[0]),datasets:[{label:'On-Time %',data:ALL.suppliers.map(s=>s.onTime),backgroundColor:'#107C10'},{label:'Rating×20',data:ALL.suppliers.map(s=>s.rating*20),backgroundColor:'#0078d4'}]},options:{maintainAspectRatio:true}});

  document.getElementById('reportMetrics').innerHTML=[
    {label:'Avg Order Value',val:'PKR '+Math.round(ALL.orders.reduce((s,o)=>s+o.total,0)/ALL.orders.length).toLocaleString(),sub:'per order',cls:'blue'},
    {label:'Fulfillment Rate',val:'94%',sub:'delivered on time',cls:'green'},
    {label:'Inventory Turnover',val:'8.5x',sub:'annual rate',cls:'orange'},
    {label:'Supplier Score',val:'4.7/5',sub:'avg rating',cls:'blue'},
  ].map(m=>`<div class="metric-card ${m.cls}"><div class="m-label">${m.label}</div><div class="m-value">${m.val}</div><div class="m-sub">${m.sub}</div></div>`).join('');
}

function openOrderModal(){
  document.getElementById('oProduct').innerHTML=ALL.products.map(p=>`<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`).join('');
  document.getElementById('oCustomer').value='';document.getElementById('oQty').value='';
  document.getElementById('modalAlert').innerHTML='';
  document.getElementById('orderModal').classList.add('open');
}
async function submitOrder(){
  const customer=document.getElementById('oCustomer').value.trim();
  const productId=document.getElementById('oProduct').value;
  const qty=parseInt(document.getElementById('oQty').value);
  if(!customer||!qty||qty<1){ document.getElementById('modalAlert').innerHTML='<div class="alert alert-error">Please fill all fields</div>'; return; }
  const r=await api('POST','/orders',{customer,product_id:productId,quantity:qty});
  if(r.id){ closeModal('orderModal'); await loadAll(); renderDashboard(); renderOrders(); alert('✅ Order '+r.number+' created successfully!'); }
  else document.getElementById('modalAlert').innerHTML='<div class="alert alert-error">'+(r.error||'Failed to create order')+'</div>';
}
function openProductModal(){ document.getElementById('productModal').classList.add('open'); }
async function submitProduct(){
  const data={name:document.getElementById('pName').value.trim(),sku:document.getElementById('pSku').value.trim(),category:document.getElementById('pCat').value,price:parseFloat(document.getElementById('pPrice').value),stock:parseInt(document.getElementById('pStock').value),reorder:parseInt(document.getElementById('pReorder').value)};
  if(!data.name||!data.sku){ alert('Please fill all fields'); return; }
  const r=await api('POST','/products',data);
  if(r.id){ closeModal('productModal'); await loadAll(); renderProducts(); renderDashboard(); alert('✅ Product added!'); }
}
function openSupplierModal(){ document.getElementById('supplierModal').classList.add('open'); }
async function submitSupplier(){
  const data={name:document.getElementById('sName').value.trim(),contact:document.getElementById('sContact').value.trim(),email:document.getElementById('sEmail').value.trim(),phone:document.getElementById('sPhone').value,country:document.getElementById('sCountry').value};
  if(!data.name||!data.email){ alert('Please fill all required fields'); return; }
  const r=await api('POST','/suppliers',data);
  if(r.id){ closeModal('supplierModal'); await loadAll(); renderSuppliers(); alert('✅ Supplier added!'); }
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
async function adjustStock(id){
  const qty=prompt('Enter quantity to add (negative to reduce):');
  if(qty===null) return;
  const r=await api('PUT','/products/'+id+'/stock',{adjust:parseInt(qty)});
  if(r.success){ await loadAll(); renderProducts(); renderInventory(); renderDashboard(); }
}
async function updateOrderStatus(id){
  const s=prompt('New status (pending/processing/shipped/delivered):');
  if(!s) return;
  const r=await api('PUT','/orders/'+id+'/status',{status:s});
  if(r.success){ await loadAll(); renderOrders(); renderDashboard(); }
}

// Auto-login if token exists
const t=localStorage.getItem('sc_token'); const u=localStorage.getItem('sc_user');
if(t&&u){ TOKEN=t; USER=JSON.parse(u); initApp(); }
</script>
</body>
</html>`;

// ─── API Router ───────────────────────────────────────────────────
const routes = {
  'GET /': (req,res) => { res.writeHead(200,{'Content-Type':'text/html'}); res.end(DASHBOARD_HTML); },
  'GET /api/health': (req,res) => send(res,200,{status:'healthy',timestamp:new Date(),environment:process.env.NODE_ENV||'development',azure:'App Service ✅'}),

  'POST /api/auth/login': async (req,res) => {
    const {email,password} = await body(req);
    const user = DB.users.find(u=>u.email===email && u.password===hash(password));
    if(!user) return send(res,401,{error:'Invalid credentials'});
    const token = makeToken(user);
    send(res,200,{token, user:{id:user.id,email:user.email,name:user.name,role:user.role}});
  },
  'GET /api/auth/me': (req,res) => {
    const u=auth(req); if(!u) return send(res,401,{error:'Unauthorized'});
    const user=DB.users.find(x=>x.id===u.id);
    send(res,200,{id:user.id,email:user.email,name:user.name,role:user.role});
  },

  'GET /api/products': (req,res) => { auth(req)||send(res,401,{error:'Unauthorized'}); send(res,200,{data:DB.products,total:DB.products.length}); },
  'POST /api/products': async (req,res) => {
    const u=auth(req); if(!u) return send(res,401,{error:'Unauthorized'});
    if(u.role==='staff') return send(res,403,{error:'Insufficient permissions'});
    const d=await body(req);
    if(!d.name||!d.sku) return send(res,400,{error:'Name and SKU are required'});
    const product={id:uid(),sku:d.sku,name:d.name,category:d.category||'General',price:d.price||0,stock:d.stock||0,reorder:d.reorder||10,supplier:d.supplier||'s1'};
    DB.products.push(product);
    send(res,201,{id:product.id,message:'Product created'});
  },
  'PUT /api/products/{id}/stock': async (req,res,id) => {
    const u=auth(req); if(!u) return send(res,401,{error:'Unauthorized'});
    const d=await body(req);
    const p=DB.products.find(x=>x.id===id);
    if(!p) return send(res,404,{error:'Product not found'});
    p.stock=Math.max(0,p.stock+(parseInt(d.adjust)||0));
    send(res,200,{success:true,stock:p.stock});
  },

  'GET /api/orders': (req,res) => { if(!auth(req)) return send(res,401,{error:'Unauthorized'}); send(res,200,{data:DB.orders,total:DB.orders.length}); },
  'POST /api/orders': async (req,res) => {
    const u=auth(req); if(!u) return send(res,401,{error:'Unauthorized'});
    const d=await body(req);
    if(!d.customer||!d.product_id||!d.quantity) return send(res,400,{error:'Missing required fields'});
    const product=DB.products.find(p=>p.id===d.product_id);
    if(!product) return send(res,404,{error:'Product not found'});
    if(product.stock < d.quantity) return send(res,400,{error:'Insufficient stock. Available: '+product.stock});
    const order={id:uid(),number:'ORD-'+String(DB.orders.length+1).padStart(3,'0'),customer:d.customer,items:[{product:d.product_id,qty:d.quantity,price:product.price}],total:product.price*d.quantity,status:'pending',date:new Date().toISOString().slice(0,10)};
    product.stock -= d.quantity;
    DB.orders.unshift(order);
    send(res,201,{id:order.id,number:order.number,message:'Order created successfully'});
  },
  'PUT /api/orders/{id}/status': async (req,res,id) => {
    const u=auth(req); if(!u) return send(res,401,{error:'Unauthorized'});
    const d=await body(req);
    const validStatuses=['pending','processing','shipped','delivered'];
    if(!validStatuses.includes(d.status)) return send(res,400,{error:'Invalid status'});
    const order=DB.orders.find(o=>o.id===id);
    if(!order) return send(res,404,{error:'Order not found'});
    order.status=d.status;
    if(d.status==='shipped'){ DB.shipments.push({id:uid(),order:order.number,tracking:'TRK-'+Date.now(),carrier:'TCS Courier',status:'in_transit',eta:new Date(Date.now()+3*86400000).toISOString().slice(0,10),location:'Warehouse — Dispatched'}); }
    send(res,200,{success:true,status:d.status});
  },

  'GET /api/suppliers': (req,res) => { if(!auth(req)) return send(res,401,{error:'Unauthorized'}); send(res,200,{data:DB.suppliers}); },
  'POST /api/suppliers': async (req,res) => {
    const u=auth(req); if(!u) return send(res,401,{error:'Unauthorized'});
    if(u.role==='staff') return send(res,403,{error:'Insufficient permissions'});
    const d=await body(req);
    if(!d.name||!d.email) return send(res,400,{error:'Name and email are required'});
    const supplier={id:uid(),name:d.name,contact:d.contact||'',email:d.email,phone:d.phone||'',rating:5.0,country:d.country||'Pakistan',onTime:100};
    DB.suppliers.push(supplier);
    send(res,201,{id:supplier.id,message:'Supplier added'});
  },

  'GET /api/shipments': (req,res) => { if(!auth(req)) return send(res,401,{error:'Unauthorized'}); send(res,200,{data:DB.shipments}); },

  'GET /api/analytics/dashboard': (req,res) => {
    if(!auth(req)) return send(res,401,{error:'Unauthorized'});
    const revenue=DB.orders.reduce((s,o)=>s+o.total,0);
    const pending=DB.orders.filter(o=>o.status==='pending').length;
    const avgRating=DB.suppliers.reduce((s,x)=>s+x.rating,0)/DB.suppliers.length;
    send(res,200,{totalOrders:DB.orders.length,pendingOrders:pending,totalRevenue:revenue,inventoryValue:DB.products.reduce((s,p)=>s+p.price*p.stock,0),supplierPerformance:avgRating.toFixed(1),lowStockProducts:DB.products.filter(p=>p.stock<=p.reorder).length});
  },
};

// ─── HTTP Server ──────────────────────────────────────────────────
const server = http.createServer(async (req,res) => {
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});
    return res.end();
  }
  const { pathname } = url.parse(req.url);
  const key = req.method+' '+pathname;
  let handler = routes[key];
  let paramId = null;

  if(!handler){
    // Match dynamic routes like PUT /api/orders/{id}/status
    for(const [pattern,fn] of Object.entries(routes)){
      const regex = new RegExp('^'+pattern.replace(/\{id\}/g,'([^/]+)')+'$');
      const m = key.match(regex);
      if(m){ handler=fn; paramId=m[1]; break; }
    }
  }
  if(handler) return handler(req,res,paramId);
  send(res,404,{error:'Not found'});
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Supply Chain App running on port ${PORT} — Azure App Service`));
