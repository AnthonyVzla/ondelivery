const app = document.getElementById('app');
const loader = document.getElementById('loader');
const installToast = document.getElementById('install-toast');
const installButton = document.getElementById('install-button');
let deferredPrompt = null;

const DEFAULT_DATA = {
  users: [
    { id: 'master', name: 'Admin Master', role: 'master', zone: null, phone: '+584128481580' },
    { id: 'motorizado1', name: 'Motorizado Uno', role: 'motorizado', zone: null, phone: '+584128481581', active: true, profitPercent: 20, profilePhoto: null, documents: {} },
    { id: 'aliado1', name: 'Aliado Norte', role: 'aliado', zone: 'Zona Norte', phone: '+584128481582' },
    { id: 'contabilidad', name: 'Contabilidad', role: 'contabilidad', zone: null, phone: '+584128481583' }
  ],
  zones: [
    { name: 'Zona Norte', price: 8 },
    { name: 'Zona Sur', price: 10 },
    { name: 'Zona Este', price: 9 },
    { name: 'Zona Oeste', price: 12 }
  ],
  orders: []
};

// Supabase configuration (desde el usuario)
const SUPABASE_URL = 'https://pwiqiinajpyrmhdhgobx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3aXFpaW5hanB5cm1oZGhnb2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDMzODQsImV4cCI6MjA5ODQxOTM4NH0.eDbE4-1KyQ-XiEnRzbJlMcpgb06JikSu67e4FzVOUJM';
let SUPA = null;
let DATA = JSON.parse(localStorage.getItem('deliveryData')) || JSON.parse(JSON.stringify(DEFAULT_DATA));

async function initSupabase() {
  try {
    if (!window.supabase) return;
    SUPA = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // fetch users, zones, orders
    const [uRes, zRes, oRes] = await Promise.all([
      SUPA.from('users').select('*'),
      SUPA.from('zones').select('*'),
      SUPA.from('orders').select('*')
    ]);
    if (uRes.error || zRes.error || oRes.error) throw new Error('Supabase fetch error');
    if (uRes.data && uRes.data.length) DATA.users = uRes.data;
    if (zRes.data && zRes.data.length) DATA.zones = zRes.data;
    if (oRes.data && oRes.data.length) DATA.orders = oRes.data;

    // realtime subscriptions for orders
    try {
      SUPA.from('orders').on('INSERT', payload => {
        DATA.orders.push(payload.new);
        playNotificationSound();
      }).subscribe();
      SUPA.from('orders').on('UPDATE', payload => {
        const idx = DATA.orders.findIndex(o=>o.id===payload.new.id);
        if (idx!==-1) DATA.orders[idx] = payload.new;
      }).subscribe();
    } catch (e) { console.warn('Realtime subscription failed', e); }

    // persist locally snapshot
    localStorage.setItem('deliveryData', JSON.stringify(DATA));
  } catch (e) {
    console.warn('Supabase init failed, usando localStorage', e);
  }
}

function saveData(data) {
  localStorage.setItem('deliveryData', JSON.stringify(data));
  DATA = data;
  // push changes to Supabase in background if available
  if (SUPA) {
    (async () => {
      try {
        await SUPA.from('users').upsert(data.users, { onConflict: ['id'] });
        await SUPA.from('zones').upsert(data.zones, { onConflict: ['name'] });
        await SUPA.from('orders').upsert(data.orders, { onConflict: ['id'] });
      } catch (e) { console.error('Error sincronizando con Supabase', e); }
    })();
  }
}

function loadData() {
  if (!DATA || !DATA.users) {
    DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
    saveData(DATA);
  }
  return DATA;
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function updateUserInData(data, user) {
  const idx = data.users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    data.users[idx] = { ...data.users[idx], ...user };
    saveData(data);
    setCurrentUser(data.users[idx]);
    return data.users[idx];
  }
  return user;
}

function formatCurrency(value) {
  return `${value.toFixed(2)} USD`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('es-VE');
}

function playNotificationSound() {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 700;
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.05, context.currentTime);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch (error) {
    console.warn('No se pudo reproducir sonido de notificación.', error);
  }
}

function getTimeRangeDates(range) {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);
  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    default:
      start = null;
  }
  return { start, end };
}

function filterOrdersByRange(orders, range, customStart, customEnd) {
  if (range === 'range' && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    return orders.filter(order => {
      const date = new Date(order.createdAt);
      return date >= start && date <= end;
    });
  }
  const dates = getTimeRangeDates(range);
  if (!dates.start) return orders;
  return orders.filter(order => {
    const date = new Date(order.createdAt);
    return date >= dates.start && date <= dates.end;
  });
}

function renderLogin() {
  const data = DATA;
  app.innerHTML = `
    <div class="card">
      <h2>Iniciar sesión</h2>
      <form id="login-form" class="form-grid">
        <label>Usuario (nombre de usuario)<input name="username" required></label>
        <label>Contraseña <input name="password" type="password" required></label>
        <div style="display:flex; gap:8px;">
          <button id="login-button">Ingresar</button>
          <button type="button" id="wh-motorizado" class="secondary">Quiero ser motorizado</button>
          <button type="button" id="wh-aliado" class="secondary">Quiero ser aliado comercial</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const fd = new FormData(form);
    const username = fd.get('username');
    const password = fd.get('password');
    const user = data.users.find(u => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      renderDashboard(user);
    } else {
      alert('Credenciales inválidas.');
    }
  });
  document.getElementById('wh-motorizado').addEventListener('click', () => {
    window.open('https://wa.me/584128481584', '_blank');
  });
  document.getElementById('wh-aliado').addEventListener('click', () => {
    window.open('https://wa.me/584128481584', '_blank');
  });
}

function renderDashboard(user) {
  const data = loadData();
  const orders = data.orders;
  app.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content: space-between; gap:12px; flex-wrap: wrap;">
        <div>
          <h2>Bienvenido, ${user.name}</h2>
          <p>Rol: ${user.role}</p>
        </div>
        <div style="display:flex; gap:12px; flex-wrap: wrap; align-items:center;">
          <button class="secondary" id="logout-button">Salir</button>
        </div>
      </div>
    </div>
  `;

  if (user.role === 'aliado') {
    renderAliadoView(user, data, orders);
  } else if (user.role === 'motorizado') {
    renderMotorizadoView(user, data, orders);
  } else if (user.role === 'master') {
    renderMasterView(user, data, orders);
  } else if (user.role === 'contabilidad') {
    renderContabilidadView(user, data, orders);
    initContabilidadWhenShown();
  } else {
    renderPlaceholderView(user);
  }

  document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    renderLogin();
  });
}

function renderAliadoView(user, data, orders) {
  const zonePrice = data.zones.find(z => z.name === user.zone);
  app.innerHTML += `
    <div class="card">
      <h2>Aliado</h2>
      <div class="button-group">
        <button id="pending-orders-btn">Pedidos pendientes</button>
        <button id="completed-orders-btn">Pedidos realizados</button>
        <button id="request-delivery-btn">Solicitar delivery</button>
        <button id="request-price-btn">Solicitar precio</button>
      </div>
    </div>
    <div id="view-container"></div>
  `;

  const container = document.getElementById('view-container');
  function showSection(html) {
    container.innerHTML = html;
    attachAliadoEvents(user, data);
  }

  document.getElementById('pending-orders-btn').addEventListener('click', () => {
    const pendingOrders = orders.filter(order => order.aliadoId === user.id && order.status === 'accepted');
    showSection(renderOrderList('Pedidos pendientes', pendingOrders, true));
  });
  document.getElementById('completed-orders-btn').addEventListener('click', () => {
    const completed = orders.filter(order => order.aliadoId === user.id && order.status === 'completed');
    showSection(renderOrderList('Pedidos realizados', completed, false));
  });
  document.getElementById('request-delivery-btn').addEventListener('click', () => {
    showSection(renderDeliveryForm(user, zonePrice));
  });
  document.getElementById('request-price-btn').addEventListener('click', () => {
    showSection(renderPriceRequest(user));
  });

  showSection(renderOrderList('Pedidos pendientes', orders.filter(order => order.aliadoId === user.id && order.status === 'accepted'), true));
}

function renderOrderList(title, list, showStatus) {
  if (list.length === 0) {
    return `<div class="card"><h3>${title}</h3><p>No hay pedidos en esta lista.</p></div>`;
  }
  return `
    <div class="card">
      <h3>${title}</h3>
      ${list.map(order => `
        <div class="order-card">
          <strong>${order.receiverName}</strong>
          <div>Teléfono: ${order.receiverPhone}</div>
          <div>Sector: ${order.sector}</div>
          <div>Ubicación: <a href="${order.locationUrl}" target="_blank">Ver mapa</a></div>
          <div>Zona: ${order.zone}</div>
          <div>Delivery: ${order.price.toFixed(2)} USD</div>
          <div>Urgencia: ${order.urgency}</div>
          ${order.assignedToName || order.assignedTo ? `<div>Motorizado: ${order.assignedToName || order.assignedTo}</div>` : ''}
          ${showStatus ? `<div>Estado: ${order.status}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderDeliveryForm(user, zonePrice) {
  const zoneName = user.zone || 'Sin zona asignada';
  const priceText = zonePrice ? `${zonePrice.price} USD` : 'Zone sin precio';
  return `
    <div class="card">
      <h3>Solicitar delivery</h3>
      <form id="delivery-form" class="form-grid">
        <label>Nombre del comercio <input type="text" name="pickupName" required></label>
        <label>Teléfono del comercio <input type="tel" name="pickupPhone" required></label>
        <label>Ubicación GPS comercio (URL) <input type="url" name="pickupLocationUrl" required placeholder="https://maps.app.goo.gl/..." ></label>
        <label>Nombre quien recibe <input type="text" name="receiverName" required></label>
        <label>Teléfono <input type="tel" name="receiverPhone" required></label>
        <label>Sector de entrega <input type="text" name="sector" required></label>
        <label>Ubicación GPS cliente (URL) <input type="url" name="locationUrl" required placeholder="https://maps.app.goo.gl/..." ></label>
        <label>Descripción breve <textarea name="description" rows="3" required></textarea></label>
        <fieldset style="border:1px solid #d1d7e0; padding:12px; border-radius:10px;">
          <legend>Costo de delivery</legend>
          <div>Zona asignada: <strong>${zoneName}</strong></div>
          <div>Precio: <strong>${priceText}</strong></div>
          <button type="button" id="show-zone-costs" class="secondary">Ver precios por zona</button>
          <div id="zone-costs" class="hidden"></div>
        </fieldset>
        <label>Urgencia</label>
        <div>
          <label><input type="radio" name="urgency" value="Normal" checked> Normal</label>
          <label><input type="radio" name="urgency" value="Urgente"> Urgente</label>
        </div>
        <button type="submit">Enviar pedido</button>
      </form>
    </div>
  `;
}

function renderPriceRequest(user) {
  return `
    <div class="card">
      <h3>Solicitar precio de delivery</h3>
      <p>Contacta al supervisor según el turno.</p>
      <div class="button-group">
        <a class="button secondary" href="https://wa.me/584128481584" target="_blank">WhatsApp Mañana</a>
        <a class="button secondary" href="https://wa.me/584128481583" target="_blank">WhatsApp Tarde</a>
      </div>
    </div>
  `;
}

function attachAliadoEvents(user, data) {
  const form = document.getElementById('delivery-form');
  const showCosts = document.getElementById('show-zone-costs');
  const zoneCosts = document.getElementById('zone-costs');
  if (showCosts) {
    showCosts.addEventListener('click', () => {
      zoneCosts.classList.toggle('hidden');
      if (!zoneCosts.classList.contains('hidden')) {
        zoneCosts.innerHTML = `<ul>${data.zones.map(z => `<li>${z.name}: ${z.price} USD</li>`).join('')}</ul>`;
      }
    });
  }
  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(form);
      const pickupUrl = formData.get('pickupLocationUrl') || user.commerceLocationUrl || '';
      const newOrder = {
        id: Date.now().toString(),
        aliadoId: user.id,
        pickupName: formData.get('pickupName'),
        pickupPhone: formData.get('pickupPhone'),
        pickupLocationUrl: pickupUrl,
        receiverName: formData.get('receiverName'),
        receiverPhone: formData.get('receiverPhone'),
        sector: formData.get('sector'),
        locationUrl: formData.get('locationUrl'),
        description: formData.get('description'),
        urgency: formData.get('urgency'),
        zone: user.zone || 'Sin zona',
        price: (data.zones.find(z => z.name === user.zone)?.price) || 0,
        status: 'pending',
        assignedToId: null,
        assignedToName: null,
        canceledBy: null,
        createdAt: new Date().toISOString()
      };
      data.orders.push(newOrder);
      saveData(data);
      alert('Pedido enviado. Espera la asignación del motorizado.');
      renderDashboard(user);
    });
  }
}

function renderMotorizadoView(user, data, orders) {
  app.innerHTML += `
    <div class="card">
      <h2>Motorizado</h2>
      <div class="button-group">
        <button id="available-orders-btn">Pedidos disponibles</button>
        <button id="accepted-orders-btn">Pedidos aceptados</button>
        <button id="completed-orders-moto-btn">Pedidos realizados</button>
        <button id="cancelled-orders-btn">Pedidos cancelados</button>
        <button id="accounting-btn">Contabilidad</button>
        <button id="profile-btn">Perfil</button>
      </div>
    </div>
    <div id="view-container"></div>
  `;

  const container = document.getElementById('view-container');
  function showSection(html) {
    container.innerHTML = html;
    attachMotorizadoEvents(user, data);
  }

  document.getElementById('accepted-orders-btn').addEventListener('click', () => {
    showSection(renderMotorizadoAcceptedOrders(user, data));
  });
  document.getElementById('available-orders-btn').addEventListener('click', () => {
    showSection(renderMotorizadoAvailableOrders(user, data));
  });
  document.getElementById('completed-orders-moto-btn').addEventListener('click', () => {
    showSection(renderMotorizadoCompletedOrders(user, data));
  });
  document.getElementById('cancelled-orders-btn').addEventListener('click', () => {
    showSection(renderMotorizadoCancelledOrders(user, data));
  });
  document.getElementById('accounting-btn').addEventListener('click', () => {
    showSection(renderContabilidadView(user, data, orders));
    initContabilidadWhenShown();
  });
  document.getElementById('profile-btn').addEventListener('click', () => {
    showSection(renderMotorizadoProfile(user, data));
  });

  showSection(renderMotorizadoAvailableOrders(user, data));
  if (user.active && data.orders.some(order => order.status === 'pending' && !order.assignedToId)) {
    playNotificationSound();
  }
}

function renderMotorizadoAvailableOrders(user, data) {
  const available = data.orders.filter(order => order.status === 'pending' && !order.assignedToId && (user.assignedAliado ? order.aliadoId === user.assignedAliado : true));
  return `
    <div class="card">
      <h3>Pedidos disponibles</h3>
      <p>Estado de recepción: <strong>${user.active ? 'Activo' : 'No activo'}</strong></p>
      ${!user.active ? '<p>Activa tu perfil para recibir pedidos. No podrás aceptar pedidos mientras estás Off.</p>' : ''}
      ${available.length === 0 ? '<p>No hay pedidos disponibles.</p>' : available.map(order => `
        <div class="order-card">
          <strong>${order.receiverName}</strong>
          <div>Cliente: ${order.receiverName}</div>
          <div>Teléfono: ${order.receiverPhone}</div>
          <div>Origen: <a href="${order.pickupLocationUrl}" target="_blank">Ver comercio</a></div>
          <div>Destino: <a href="${order.locationUrl}" target="_blank">Ver cliente</a></div>
          <div>Costo total: ${formatCurrency(order.price)}</div>
          <div>Urgencia: ${order.urgency}</div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="secondary accept-order" data-id="${order.id}" ${user.active ? '' : 'disabled'}>Aceptar pedido</button>
            <button class="secondary cancel-order" data-id="${order.id}" ${user.active ? '' : 'disabled'}>Cancelar pedido</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMotorizadoAcceptedOrders(user, data) {
  const accepted = data.orders.filter(order => order.assignedToId === user.id && order.status === 'accepted');
  if (accepted.length === 0) {
    return `<div class="card"><h3>Pedidos aceptados</h3><p>No tienes pedidos en curso.</p></div>`;
  }
  return `
    <div class="card">
      <h3>Pedidos aceptados</h3>
      ${accepted.map(order => `
        <div class="order-card">
          <strong>${order.receiverName}</strong>
          <div>Origen: <a href="${order.pickupLocationUrl}" target="_blank">Comercio</a></div>
          <div>Destino: <a href="${order.locationUrl}" target="_blank">Cliente</a></div>
          <div>Cliente: ${order.receiverName} - ${order.receiverPhone}</div>
          <div>Costo total: ${formatCurrency(order.price)}</div>
          <div>Urgencia: ${order.urgency}</div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="secondary order-on-the-way" data-id="${order.id}">Pedido en camino</button>
            <button class="secondary order-delivered" data-id="${order.id}">Pedido entregado</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMotorizadoCompletedOrders(user, data) {
  const completed = data.orders.filter(order => order.assignedToId === user.id && order.status === 'completed');
  if (completed.length === 0) {
    return `<div class="card"><h3>Pedidos realizados</h3><p>No tienes pedidos finalizados.</p></div>`;
  }
  return `
    <div class="card">
      <h3>Pedidos realizados</h3>
      ${completed.map(order => `
        <div class="order-card">
          <strong>${order.receiverName}</strong>
          <div>Destino: <a href="${order.locationUrl}" target="_blank">Cliente</a></div>
          <div>Costo total: ${formatCurrency(order.price)}</div>
          <div>Finalizado el: ${formatDate(order.completedAt || order.updatedAt || order.createdAt)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMotorizadoCancelledOrders(user, data) {
  const cancelled = data.orders.filter(order => order.assignedToId === user.id && order.status === 'cancelled');
  if (cancelled.length === 0) {
    return `<div class="card"><h3>Pedidos cancelados</h3><p>No tienes pedidos cancelados.</p></div>`;
  }
  return `
    <div class="card">
      <h3>Pedidos cancelados</h3>
      ${cancelled.map(order => `
        <div class="order-card">
          <strong>${order.receiverName}</strong>
          <div>Razón: ${order.canceledBy || 'Cancelado'}</div>
          <div>Destino: <a href="${order.locationUrl}" target="_blank">Cliente</a></div>
          <div>Fecha: ${formatDate(order.updatedAt || order.createdAt)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMotorizadoProfile(user, data) {
  return `
    <div class="card">
      <h3>Perfil</h3>
      <form id="motorizado-profile-form" class="form-grid">
        <label>Activo para recibir pedidos
          <select name="active">
            <option value="true" ${user.active ? 'selected' : ''}>On</option>
            <option value="false" ${!user.active ? 'selected' : ''}>Off</option>
          </select>
        </label>
        <label>Foto de perfil <input type="file" name="profilePhoto" accept="image/*"></label>
        <label>Cédula <input type="file" name="document_cedula" accept="image/*"></label>
        <label>Certificado médico <input type="file" name="document_medico" accept="image/*"></label>
        <label>Carnet de circulación <input type="file" name="document_circulacion" accept="image/*"></label>
        <label>RCV <input type="file" name="document_rcv" accept="image/*"></label>
        <label>Foto de la moto <input type="file" name="document_moto" accept="image/*"></label>
        <button type="submit">Guardar perfil</button>
      </form>
      <div id="motorizado-preview"></div>
    </div>
  `;
}

function calculateAccountingData(data, range, customStart, customEnd) {
  const completed = filterOrdersByRange(data.orders.filter(order => order.status === 'completed'), range, customStart, customEnd);
  const totalGenerated = completed.reduce((sum, order) => sum + (order.price || 0), 0);
  const totalProfit = completed.reduce((sum, order) => {
    const motorizado = data.users.find(u => u.id === order.assignedToId);
    const percent = motorizado?.profitPercent ?? 0;
    return sum + ((order.price || 0) * percent) / 100;
  }, 0);
  return { totalGenerated, totalProfit, count: completed.length };
}

function renderContabilidadView(user, data, orders) {
  const motorizados = data.users.filter(u => u.role === 'motorizado');
  const aliados = data.users.filter(u => u.role === 'aliado');
  return `
    <div class="card">
      <h3>Contabilidad</h3>
      <div class="form-grid">
        <label>Mostrar
          <select id="accounting-view">
            <option value="orders">Pedidos realizados</option>
          </select>
        </label>
        <label>Filtrar motorizado
          <select id="accounting-motorizado">
            <option value="all">Todos</option>
            ${motorizados.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
          </select>
        </label>
        <label>Filtrar comercio
          <select id="accounting-aliado">
            <option value="all">Todos</option>
            ${aliados.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
        </label>
        <label>Periodo
          <select id="accounting-filter">
            <option value="today">Hoy</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="range">Rango personalizado</option>
          </select>
        </label>
        <label>Desde <input type="date" id="accounting-start" disabled></label>
        <label>Hasta <input type="date" id="accounting-end" disabled></label>
        <div style="display:flex; gap:8px;">
          <button id="accounting-apply" class="secondary">Aplicar filtro</button>
          <button id="accounting-download" class="secondary">Descargar</button>
        </div>
      </div>
      <div id="accounting-results">
        <div id="accounting-stats" class="card"></div>
        <div id="accounting-table" class="card"></div>
      </div>
    </div>
  `;
}

// Asegurarse de inicializar eventos cuando se muestre la vista desde el dashboard
// Se invoca desde renderMotorizadoView y desde renderDashboard para rol contabilidad
function initContabilidadWhenShown() {
  const el = document.getElementById('accounting-apply');
  if (el) {
    const data = loadData();
    attachContabilidadEvents(data);
  }
}

function ordersToTableHtml(list) {
  if (!list || list.length === 0) return '<p>No hay pedidos.</p>';
  const rows = list.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${o.pickupName || ''}</td>
      <td>${o.pickupPhone || ''}</td>
      <td><a href="${o.pickupLocationUrl || '#'}" target="_blank">mapa</a></td>
      <td>${o.receiverName || ''}</td>
      <td>${o.receiverPhone || ''}</td>
      <td>${o.sector || ''}</td>
      <td><a href="${o.locationUrl || '#'}" target="_blank">mapa</a></td>
      <td>${o.zone || ''}</td>
      <td>${formatCurrency(o.price || 0)}</td>
      <td>${o.urgency || ''}</td>
      <td>${o.assignedToName || ''}</td>
      <td>${o.status || ''}</td>
      <td>${o.canceledBy || ''}</td>
      <td>${formatDate(o.createdAt)}</td>
      <td>${formatDate(o.updatedAt || o.createdAt)}</td>
      <td>${o.completedAt ? formatDate(o.completedAt) : ''}</td>
    </tr>
  `).join('');
  return `
    <div style="overflow:auto">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th>ID</th><th>Comercio</th><th>Tel comercio</th><th>Mapa comercio</th><th>Cliente</th><th>Tel cliente</th><th>Sector</th><th>Mapa cliente</th><th>Zona</th><th>Precio</th><th>Urgencia</th><th>Motorizado</th><th>Estado</th><th>Cancelado por</th><th>Creado</th><th>Actualizado</th><th>Completado</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function exportOrdersToCSV(list) {
  if (!list || list.length === 0) return null;
  const headers = ['id','pickupName','pickupPhone','pickupLocationUrl','receiverName','receiverPhone','sector','locationUrl','zone','price','urgency','assignedToId','assignedToName','status','canceledBy','createdAt','updatedAt','completedAt'];
  const csv = [headers.join(',')].concat(list.map(o => headers.map(h => {
    const v = o[h] == null ? '' : o[h];
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  }).join(',')) ).join('\n');
  return csv;
}

function exportOrdersToXLSX(list) {
  if (!list || list.length === 0) return null;
  if (!window.XLSX) return null;
  try {
    const rows = list.map(o => ({
      id: o.id,
      aliadoId: o.aliadoId,
      pickupName: o.pickupName,
      pickupPhone: o.pickupPhone,
      pickupLocationUrl: o.pickupLocationUrl,
      receiverName: o.receiverName,
      receiverPhone: o.receiverPhone,
      sector: o.sector,
      locationUrl: o.locationUrl,
      zone: o.zone,
      price: o.price,
      urgency: o.urgency,
      assignedToId: o.assignedToId,
      assignedToName: o.assignedToName,
      status: o.status,
      canceledBy: o.canceledBy,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      completedAt: o.completedAt
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const filename = `pedidos_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    return true;
  } catch (e) {
    console.error('Error exporting XLSX', e);
    return null;
  }
}

function attachContabilidadEvents(data) {
  const view = document.getElementById('accounting-view');
  const motorizadoSel = document.getElementById('accounting-motorizado');
  const aliadoSel = document.getElementById('accounting-aliado');
  const filterSel = document.getElementById('accounting-filter');
  const startInput = document.getElementById('accounting-start');
  const endInput = document.getElementById('accounting-end');
  const applyBtn = document.getElementById('accounting-apply');
  const downloadBtn = document.getElementById('accounting-download');
  const stats = document.getElementById('accounting-stats');
  const table = document.getElementById('accounting-table');

  function refresh() {
    const motId = motorizadoSel.value;
    const aliId = aliadoSel.value;
    const range = filterSel.value;
    const start = startInput.value || null;
    const end = endInput.value || null;
    let list = data.orders.filter(o => o.status === 'completed');
    if (motId && motId !== 'all') list = list.filter(o => o.assignedToId === motId);
    if (aliId && aliId !== 'all') list = list.filter(o => o.aliadoId === aliId);
    if (range === 'range' && start && end) {
      list = list.filter(o => new Date(o.createdAt) >= new Date(start) && new Date(o.createdAt) <= new Date(end));
    } else {
      list = filterOrdersByRange(list, range);
    }
    const total = list.reduce((s, o) => s + (o.price || 0), 0);
    const profit = list.reduce((s, o) => {
      const mot = data.users.find(u => u.id === o.assignedToId);
      const p = mot?.profitPercent ?? 0;
      return s + ((o.price || 0) * p) / 100;
    }, 0);
    stats.innerHTML = `<p>Total generado: <strong>${formatCurrency(total)}</strong></p><p>Ganancia total: <strong>${formatCurrency(profit)}</strong></p><p>Pedidos: <strong>${list.length}</strong></p>`;
    table.innerHTML = ordersToTableHtml(list);
    downloadBtn.onclick = () => {
      // Try XLSX first
      if (window.XLSX) {
        const ok = exportOrdersToXLSX(list);
        if (ok) return;
      }
      const csv = exportOrdersToCSV(list);
      if (!csv) { alert('No hay datos para descargar.'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }

  filterSel.addEventListener('change', () => {
    const v = filterSel.value;
    startInput.disabled = v !== 'range';
    endInput.disabled = v !== 'range';
  });
  applyBtn.addEventListener('click', refresh);
  // initial
  refresh();
}

function attachMotorizadoEvents(user, data) {
  const acceptButtons = document.querySelectorAll('.accept-order');
  const cancelButtons = document.querySelectorAll('.cancel-order');
  const onTheWayButtons = document.querySelectorAll('.order-on-the-way');
  const deliveredButtons = document.querySelectorAll('.order-delivered');
  const profileForm = document.getElementById('motorizado-profile-form');
  const accountingFilter = document.getElementById('accounting-filter');
  const startInput = document.getElementById('accounting-start');
  const endInput = document.getElementById('accounting-end');
  const refreshButton = document.getElementById('accounting-refresh');

  if (acceptButtons.length && user.active) {
    acceptButtons.forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        const order = data.orders.find(o => o.id === id);
        if (!order) return;
        order.assignedToId = user.id;
        order.assignedToName = user.name;
        order.status = 'accepted';
        order.updatedAt = new Date().toISOString();
        user.active = false;
        updateUserInData(data, user);
        saveData(data);
        alert('Pedido aceptado. Tu estado cambió a off mientras está en curso.');
        renderDashboard(user);
      });
    });
  }

  if (cancelButtons.length) {
    cancelButtons.forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        const order = data.orders.find(o => o.id === id);
        if (!order) return;
        order.status = 'cancelled';
        order.canceledBy = user.name;
        order.updatedAt = new Date().toISOString();
        saveData(data);
        alert('Pedido cancelado.');
        renderDashboard(user);
      });
    });
  }

  if (onTheWayButtons.length) {
    onTheWayButtons.forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        const order = data.orders.find(o => o.id === id);
        if (!order) return;
        order.status = 'on-the-way';
        order.updatedAt = new Date().toISOString();
        saveData(data);
        alert('Pedido en camino.');
        renderDashboard(user);
      });
    });
  }

  if (deliveredButtons.length) {
    deliveredButtons.forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        const order = data.orders.find(o => o.id === id);
        if (!order) return;
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
        order.updatedAt = order.completedAt;
        saveData(data);
        user.active = true;
        updateUserInData(data, user);
        alert('Pedido entregado. Tu estado volvió a On.');
        renderDashboard(user);
      });
    });
  }

  if (profileForm) {
    profileForm.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      user.active = formData.get('active') === 'true';
      const documentKeys = ['profilePhoto', 'document_cedula', 'document_medico', 'document_circulacion', 'document_rcv', 'document_moto'];
      const promises = documentKeys.map(key => {
        const file = formData.get(key);
        if (file && file.size) {
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => {
              if (key === 'profilePhoto') {
                user.profilePhoto = reader.result;
              } else {
                user.documents = user.documents || {};
                user.documents[key] = reader.result;
              }
              resolve();
            };
            reader.readAsDataURL(file);
          });
        }
        return Promise.resolve();
      });
      Promise.all(promises).then(() => {
        updateUserInData(data, user);
        saveData(data);
        alert('Perfil guardado.');
        renderDashboard(user);
      });
    });
    const preview = document.getElementById('motorizado-preview');
    if (preview) {
      preview.innerHTML = `
        ${user.profilePhoto ? `<div><strong>Foto de perfil:</strong><img src="${user.profilePhoto}" style="max-width: 120px; display:block; margin-top:8px; border-radius:12px;"/></div>` : ''}
        ${Object.entries(user.documents || {}).map(([key, value]) => `<div><strong>${key.replace('document_', '').replace('_', ' ')}:</strong> ${value ? 'Cargado' : 'No cargado'}</div>`).join('')}
      `;
    }
  }

  if (accountingFilter) {
    accountingFilter.addEventListener('change', () => {
      const value = accountingFilter.value;
      startInput.disabled = value !== 'range';
      endInput.disabled = value !== 'range';
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      const rangeValue = accountingFilter.value;
      const startDate = startInput.value;
      const endDate = endInput.value;
      const results = calculateAccountingData(data, rangeValue, startDate, endDate);
      const resultsContainer = document.getElementById('accounting-results');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <p>Total generado: <strong>${formatCurrency(results.totalGenerated)}</strong></p>
          <p>Ganancia total: <strong>${formatCurrency(results.totalProfit)}</strong></p>
          <p>Pedidos completados: <strong>${results.count}</strong></p>
        `;
      }
    });
  }
}

function renderMasterView(user, data, orders) {
  app.innerHTML += `
    <div class="card">
      <h2>Panel Master</h2>
      <p>Gestiona usuarios, zonas de entrega y revisa pedidos.</p>
      <div class="button-group">
        <button id="manage-users-btn">Usuarios</button>
        <button id="manage-zones-btn">Zonas</button>
        <button id="review-orders-btn">Pedidos</button>
      </div>
    </div>
    <div id="master-container"></div>
  `;
  const container = document.getElementById('master-container');
  document.getElementById('manage-users-btn').addEventListener('click', () => {
    container.innerHTML = renderUserManagement(data);
    attachMasterUserEvents(data);
  });
  document.getElementById('manage-zones-btn').addEventListener('click', () => {
    container.innerHTML = renderZoneManagement(data);
    attachMasterZoneEvents(data);
  });
  document.getElementById('review-orders-btn').addEventListener('click', () => {
    container.innerHTML = renderOrdersManagement(data);
    attachMasterOrderEvents(data);
  });
  container.innerHTML = renderUserManagement(data);
  attachMasterUserEvents(data);
}

function renderUserManagement(data) {
  const aliados = data.users.filter(u => u.role === 'aliado');
  return `
    <div class="card">
      <h3>Usuarios</h3>
      <div id="user-list">
        ${data.users.map(user => `
          <div class="order-card">
            <strong>${user.name}</strong>
            <div>Rol: ${user.role}</div>
            <div>Zona: ${user.zone || 'No asignada'}</div>
            <div>Teléfono: ${user.phone}</div>
            ${user.role === 'motorizado' ? `<div>Activo: ${user.active ? 'Sí' : 'No'}</div><div>Ganancia: ${user.profitPercent ?? 0}%</div><div>Aliado asignado: ${user.assignedAliado ? (data.users.find(x=>x.id===user.assignedAliado)?.name || user.assignedAliado) : 'Todos'}</div>` : ''}
            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
              <button class="secondary edit-user" data-id="${user.id}">Editar</button>
              <button class="secondary delete-user" data-id="${user.id}">Eliminar</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <h4>Agregar usuario</h4>
        <form id="add-user-form" class="form-grid">
          <label>Nombre <input name="name" required></label>
          <label>Nombre de usuario <input name="username" required placeholder="usuario123"></label>
          <label>Contraseña <input type="password" name="password" required placeholder="********"></label>
          <label>Rol
            <select name="role" required>
              <option value="aliado">Aliado</option>
              <option value="motorizado">Motorizado</option>
              <option value="contabilidad">Contabilidad</option>
            </select>
          </label>
          <label>Zona asignada <input name="zone"></label>
          <label>Teléfono <input name="phone" required></label>
          <label>URL ubicación del comercio (solo aliados) <input name="commerceLocationUrl" placeholder="https://maps.app.goo.gl/..."> </label>
          <label>Porcentaje motorizado
            <select name="profitPercent">
              <option value="50">50%</option>
              <option value="60" selected>60%</option>
              <option value="70">70%</option>
              <option value="80">80%</option>
              <option value="90">90%</option>
              <option value="100">100%</option>
            </select>
          </label>
          <label>Asignar a aliado
            <select name="assignedAliado">
              <option value="">(Todos)</option>
              ${aliados.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
            </select>
          </label>
          <button type="submit">Agregar usuario</button>
        </form>
      </div>
    </div>
  `;
}

function renderZoneManagement(data) {
  return `
    <div class="card">
      <h3>Zonas de entrega</h3>
      <div id="zone-list">
        ${data.zones.map(zone => `
          <div class="order-card">
            <strong>${zone.name}</strong>
            <div>Precio: ${zone.price} USD</div>
            <button class="secondary edit-zone" data-name="${zone.name}">Editar</button>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <h4>Agregar / Actualizar zona</h4>
        <form id="add-zone-form" class="form-grid">
          <label>Nombre zona <input name="name" required></label>
          <label>Precio USD <input type="number" name="price" required min="0"></label>
          <button type="submit">Guardar zona</button>
        </form>
      </div>
    </div>
  `;
}

function renderOrdersManagement(data) {
  return `
    <div class="card">
      <h3>Pedidos</h3>
      ${data.orders.length === 0 ? '<p>No hay pedidos registrados.</p>' : data.orders.map(order => `
        <div class="order-card">
          <strong>${order.receiverName} (${order.zone})</strong>
          <div>Estado: ${order.status}</div>
          <div>Aliado: ${data.users.find(u => u.id === order.aliadoId)?.name || 'N/A'}</div>
          <div>Motorizado: ${order.assignedToName || order.assignedTo || 'Sin asignar'}</div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            ${order.status === 'pending' ? `<button class="secondary assign-order" data-id="${order.id}">Asignar motorizado</button>` : ''}
            ${order.status === 'accepted' ? `<button class="secondary complete-order" data-id="${order.id}">Marcar entregado</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function attachMasterUserEvents(data) {
  document.getElementById('add-user-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const id = `${formData.get('role')}-${Date.now()}`;
    data.users.push({
      id,
      name: formData.get('name'),
      username: formData.get('username') || '',
      password: formData.get('password') || '',
      role: formData.get('role'),
      zone: formData.get('zone') || null,
      phone: formData.get('phone'),
      commerceLocationUrl: formData.get('commerceLocationUrl') || null,
      active: formData.get('role') === 'motorizado',
      profitPercent: Number(formData.get('profitPercent')) || 60,
      assignedAliado: formData.get('assignedAliado') || null,
      profilePhoto: null,
      documents: {}
    });
    saveData(data);
    alert('Usuario creado.');
    renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
  });
  document.querySelectorAll('.edit-user').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;
      const usr = data.users.find(u => u.id === id);
      if (!usr) return;
      const name = prompt('Nombre', usr.name);
      if (name === null) return;
      const role = prompt('Rol (aliado, motorizado, contabilidad)', usr.role);
      if (role === null) return;
      const zone = prompt('Zona asignada', usr.zone || '');
      const phone = prompt('Teléfono', usr.phone);
      usr.name = name;
      usr.role = role;
      usr.zone = zone || null;
      usr.phone = phone;
      if (role === 'motorizado') {
        const profit = prompt('Porcentaje de ganancia (50,60,70,80,90,100)', (usr.profitPercent ?? 60).toString());
        usr.profitPercent = profit === null ? (usr.profitPercent ?? 60) : Number(profit);
        const active = prompt('Activo en app? (sí/no)', usr.active ? 'sí' : 'no');
        usr.active = active?.toLowerCase() === 'sí';
        const assigned = prompt('ID del aliado asignado (vacío = todos)', usr.assignedAliado || '');
        usr.assignedAliado = assigned === null || assigned === '' ? null : assigned;
      } else {
        usr.assignedAliado = null;
      }
      saveData(data);
      renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
    });
  });
  document.querySelectorAll('.delete-user').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;
      if (id === 'master') {
        alert('No puedes eliminar al master.');
        return;
      }
      if (!confirm('Eliminar este usuario?')) return;
      data.users = data.users.filter(u => u.id !== id);
      saveData(data);
      renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
    });
  });
}

function attachMasterZoneEvents(data) {
  document.getElementById('add-zone-form').addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = formData.get('name');
    const price = Number(formData.get('price'));
    const existing = data.zones.find(zone => zone.name === name);
    if (existing) {
      existing.price = price;
    } else {
      data.zones.push({ name, price });
    }
    saveData(data);
    alert('Zona guardada.');
    renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
  });
  document.querySelectorAll('.edit-zone').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.name;
      const zone = data.zones.find(z => z.name === name);
      if (!zone) return;
      const newName = prompt('Nombre de zona', zone.name);
      if (newName === null) return;
      const newPrice = prompt('Precio USD', zone.price.toString());
      if (newPrice === null) return;
      zone.name = newName;
      zone.price = Number(newPrice);
      saveData(data);
      renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
    });
  });
}

function attachMasterOrderEvents(data) {
  document.querySelectorAll('.assign-order').forEach(button => {
    button.addEventListener('click', () => {
      const orderId = button.dataset.id;
      const order = data.orders.find(o => o.id === orderId);
      if (!order) return;
      const motorizadoList = data.users.filter(u => u.role === 'motorizado');
      const selected = prompt(`Motorizados disponibles:\n${motorizadoList.map(m => `${m.id}: ${m.name}`).join('\n')}`);
      if (!selected) return;
      const motorizado = motorizadoList.find(m => m.id === selected);
      if (!motorizado) {
        alert('Motorizado no válido.');
        return;
      }
      order.assignedTo = motorizado.name;
      order.assignedToName = motorizado.name;
      order.assignedToId = motorizado.id;
      order.status = 'accepted';
      saveData(data);
      renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
    });
  });
  document.querySelectorAll('.complete-order').forEach(button => {
    button.addEventListener('click', () => {
      const orderId = button.dataset.id;
      const order = data.orders.find(o => o.id === orderId);
      if (!order) return;
      order.status = 'completed';
      saveData(data);
      renderDashboard(JSON.parse(localStorage.getItem('currentUser')));
    });
  });
}

function renderPlaceholderView(user) {
  app.innerHTML += `
    <div class="card">
      <h3>Vista para ${user.role}</h3>
      <p>Esta vista aún no está implementada. El rol ${user.role} verá aquí sus opciones propias en la siguiente fase.</p>
    </div>
  `;
}

window.addEventListener('DOMContentLoaded', () => {
  (async () => {
    loader.classList.add('hidden');
    await initSupabase();
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      renderDashboard(JSON.parse(currentUser));
    } else {
      renderLogin();
    }
    // master shortcut button
    const ms = document.getElementById('master-shortcut');
    if (ms) ms.addEventListener('click', () => {
      const key = prompt('Ingrese clave master:');
      if (key === '27146006') {
        // render master without user account
        renderMasterView({ id: 'master', name: 'Master', role: 'master' }, DATA, DATA.orders);
      } else {
        alert('Clave incorrecta.');
      }
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js');
    }
  })();
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installToast.classList.remove('hidden');
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;
  if (choiceResult.outcome === 'accepted') {
    installToast.classList.add('hidden');
  }
  deferredPrompt = null;
});
