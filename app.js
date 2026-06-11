// 0. DETECTOR DE ERRORES GLOBAL
window.onerror = function(mensaje, fuente, linea) {
  alert("Error en el código:\n" + mensaje + "\nLínea: " + linea);
  return true; 
};

// 1. CONFIGURACIÓN DE SUPABASE
const supabaseUrl = 'https://magwwelvdqpcjrhabnju.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3d3ZWx2ZHFwY2pyaGFibmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzM0OTYsImV4cCI6MjA5NjUwOTQ5Nn0.OPYjHKVRQ8Ryqh5-0sXJFidUhSUehGr64ApWozO3h5k'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActual = null;
let perfilActual = null;

// 2. INICIALIZACIÓN DE ESCUCHAS AL CARGAR EL DOM
document.addEventListener('DOMContentLoaded', () => {
  const btnIngresar = document.getElementById('btn-ingresar');
  if(btnIngresar) btnIngresar.addEventListener('click', iniciarSesion);

  const btnNotif = document.getElementById('btn-notificaciones');
  if(btnNotif) btnNotif.addEventListener('click', solicitarPermisoNotificaciones);
  
  // Verificar si ya hay una sesión activa de Supabase
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      usuarioActual = data.session.user;
      obtenerPerfilUsuario(usuarioActual.id);
    }
  });
});

// 3. AUTENTICACIÓN Y ROLES
async function iniciarSesion() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if(!email || !password) {
    alert("Por favor, ingresa correo y contraseña.");
    return;
  }

  const btn = document.getElementById('btn-ingresar');
  btn.innerText = "Cargando...";

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Error de acceso: ' + error.message);
    btn.innerText = "Ingresar";
    return;
  }

  usuarioActual = data.user;
  await obtenerPerfilUsuario(usuarioActual.id);
}

async function obtenerPerfilUsuario(userId) {
  // Comprobación de usuario maestro hardcodeada según requerimiento
  if (usuarioActual.email === 'ondeliveryve@gmail.com') {
    perfilActual = { id: userId, rol: 'admin', nombre: 'Master Admin', activo: true };
    mostrarVistaSegunRol('admin');
    cargarDatosAdmin();
    iniciarEscuchaRealtime();
    return;
  }

  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !perfil) {
    alert('No se encontró un perfil asociado a estas credenciales.');
    document.getElementById('btn-ingresar').innerText = "Ingresar";
    return;
  }

  if (!perfil.activo) {
    alert('Este usuario se encuentra suspendido. Contacte al administrador.');
    await supabase.auth.signOut();
    location.reload();
    return;
  }

  perfilActual = perfil;
  mostrarVistaSegunRol(perfil.rol);
  iniciarEscuchaRealtime();
  cargarDatosPorRol();
}

function mostrarVistaSegunRol(rol) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  if (rol === 'admin') {
    document.getElementById('admin-view').classList.add('active');
    document.getElementById('supervisor-view').classList.add('active'); // Admin hereda paneles de supervisor
  } else if (rol === 'supervisor') {
    document.getElementById('supervisor-view').classList.add('active');
  } else if (rol === 'motorizado') {
    document.getElementById('motorizado-view').classList.add('active');
  } else if (rol === 'aliado') {
    document.getElementById('aliado-view').classList.add('active');
  }
}

// 4. FLUJO DE DATOS Y CARGA SEGÚN ROL
function cargarDatosPorRol() {
  if (perfilActual.rol === 'aliado') {
    cargarPedidosAliado();
  } else if (perfilActual.rol === 'supervisor') {
    cargarPedidosSupervisor();
  } else if (perfilActual.rol === 'motorizado') {
    cargarPedidosMotorizado();
  }
}

function cargarDatosAdmin() {
  cargarPedidosSupervisor(); // Carga las listas operativas de logística
  // Aquí se disparan los listados de mantenimiento CRUD del Administrador
}

// 5. MÓDULO DEL ALIADO COMERCIAL
function abrirFormularioPedido() {
  const form = document.getElementById('form-solicitud');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  cargarZonasAsignadas();
}

function solicitarCosto() {
  const ahora = new Date();
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();
  const tiempoActual = hora + minutos / 60;
  
  let numeroWhatsapp = '';
  // Turno mañana: 7:00 AM a 4:30 PM (16.5)
  if (tiempoActual >= 7 && tiempoActual < 16.5) {
    numeroWhatsapp = '584128481584';
  } else { // Turno noche: 4:30 PM a 11:30 PM
    numeroWhatsapp = '584124896096';
  }
  
  window.open(`https://wa.me/${numeroWhatsapp}?text=Hola%20On%20Delivery,%20solicito%20el%20costo%20de%20un%20delivery%20fuera%20de%20zona.`, '_blank');
}

async function cargarZonasAsignadas() {
  const select = document.getElementById('p_zona');
  select.innerHTML = '<option value="">Cargando zonas...</option>';
  select.style.display = 'block';

  const { data, error } = await supabase
    .from('aliado_precios')
    .select('precio_personalizado, tabulador_zonas(id, nombre_zona)')
    .eq('aliado_id', perfilActual.id);

  if (error || !data) {
    select.innerHTML = '<option value="">Error al cargar zonas</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Selecciona la Zona de Entrega --</option>';
  data.forEach(item => {
    if(item.tabulador_zonas) {
      const option = document.createElement('option');
      option.value = item.tabulador_zonas.id;
      option.dataset.precio = item.precio_personalizado;
      option.innerText = `${item.tabulador_zonas.nombre_zona} ($${item.precio_personalizado})`;
      select.appendChild(option);
    }
  });
}

async function enviarPedido() {
  const nombre = document.getElementById('p_nombre').value.trim();
  const tel = document.getElementById('p_tel').value.trim();
  const sector = document.getElementById('p_sector').value.trim();
  const ref = document.getElementById('p_ref').value.trim();
  const maps = document.getElementById('p_maps').value.trim();
  const selectZona = document.getElementById('p_zona');
  const precio = selectZona.options[selectZona.selectedIndex]?.dataset.precio;

  if (!nombre || !tel || !sector || !maps || !precio) {
    alert("Por favor completa todos los campos requeridos y selecciona una zona.");
    return;
  }

  const { error } = await supabase
    .from('pedidos')
    .insert([{
      aliado_id: perfilActual.id,
      cliente_nombre: nombre,
      cliente_telefono: tel,
      sector: sector,
      referencia: ref,
      ubicacion_maps_url: maps,
      costo_delivery: parseFloat(precio)
    }]);

  if (error) {
    alert("Error al guardar pedido: " + error.message);
  } else {
    alert("Pedido solicitado con éxito.");
    document.getElementById('form-solicitud').style.display = 'none';
    cargarPedidosAliado();
  }
}

async function cargarPedidosAliado() {
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('*, perfiles(nombre)')
    .eq('aliado_id', perfilActual.id);

  if (error) return;

  const activosDiv = document.getElementById('aliado-en-camino');
  const finalizadosDiv = document.getElementById('aliado-finalizados');
  
  activosDiv.innerHTML = '';
  finalizadosDiv.innerHTML = '';

  pedidos.forEach(p => {
    const html = `
      <div style="border-bottom:1px solid #eee; padding: 10px 0;">
        <strong>Destino:</strong> ${p.sector} | <strong>Cliente:</strong> ${p.cliente_nombre}<br>
        <strong>Estado:</strong> <span style="color:red;font-weight:bold;">${p.estado.toUpperCase()}</span><br>
        ${p.motorizado_id ? `<strong>Motorizado:</strong> ${p.perfiles?.nombre || 'Asignado'}` : '<em>Buscando conductor...</em>'}
      </div>`;
    
    if (p.estado === 'entregado') {
      finalizadosDiv.innerHTML += html;
    } else {
      activosDiv.innerHTML += html;
    }
  });
}

// 6. MÓDULO LOGÍSTICO: SUPERVISORES Y MOTORIZADOS
async function cargarPedidosSupervisor() {
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('*, aliados_detalles(nombre_comercio)');

  if (error || !pedidos) return;

  const supActivos = document.getElementById('sup-activos');
  const supCamino = document.getElementById('sup-camino');

  supActivos.innerHTML = '';
  supCamino.innerHTML = '';

  pedidos.forEach(p => {
    if (p.estado === 'activo' || p.estado === 'espera_confirmacion') {
      supActivos.innerHTML += `
        <div class="card">
          <strong>Comercio:</strong> ${p.aliados_detalles?.nombre_comercio || 'Aliado'}<br>
          <strong>Sector:</strong> ${p.sector}<br>
          <button class="btn" onclick="gestionarPedido('${p.id}', 'tomar')">Tomar Pedido</button>
          <button class="btn btn-install" onclick="gestionarPedido('${p.id}', 'auto')">Asignación Automática</button>
          <button class="btn" style="background:#1a1a1a;" onclick="abrirAsignacionManual('${p.id}')">Asignar Manual</button>
        </div>`;
    } else if (p.estado === 'en_camino' || p.estado === 'asignado') {
      supCamino.innerHTML += `
        <div class="card">
          <strong>Sector:</strong> ${p.sector} | <strong>Estado:</strong> ${p.estado}<br>
          <a href="${p.ubicacion_maps_url}" target="_blank" style="color:red;">Ver Mapa GPS</a>
        </div>`;
    }
  });
}

async function gestionarPedido(pedidoId, accion) {
  if (accion === 'tomar') {
    await supabase.from('pedidos').update({ motorizado_id: perfilActual.id, estado: 'asignado' }).eq('id', pedidoId);
  } else if (accion === 'auto') {
    await supabase.from('pedidos').update({ estado: 'espera_confirmacion' }).eq('id', pedidoId);
  }
  cargarPedidosSupervisor();
}

async function abrirAsignacionManual(pedidoId) {
  const { data: motos } = await supabase.from('perfiles').select('*').eq('rol', 'motorizado').eq('activo', true);
  if(!motes || motos.length === 0) { alert("No hay motorizados disponibles activos."); return; }
  
  let opciones = motos.map(m => `${m.nombre} (ID: ${m.id})`).join('\n');
  let seleccion = prompt(`Escribe el ID del motorizado para asignación manual:\n\n${opciones}`);
  
  if(seleccion) {
    await supabase.from('pedidos').update({ motorizado_id: seleccion, estado: 'espera_confirmacion' }).eq('id', pedidoId);
    cargarPedidosSupervisor();
  }
}

async function cargarPedidosMotorizado() {
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('*, aliados_detalles(nombre_comercio)')
    .eq('motorizado_id', perfilActual.id);

  if (error || !pedidos) return;

  const motoAsignado = document.getElementById('moto-asignado');
  const motoHistorial = document.getElementById('moto-historial');

  motoAsignado.innerHTML = '';
  motoHistorial.innerHTML = '';

  pedidos.forEach(p => {
    if (p.estado === 'asignado' || p.estado === 'espera_confirmacion' || p.estado === 'en_camino') {
      motoAsignado.innerHTML += `
        <div class="card">
          <strong>Retirar en:</strong> ${p.aliados_detalles?.nombre_comercio}<br>
          <strong>Cliente:</strong> ${p.cliente_nombre} (${p.cliente_telefono})<br>
          <strong>Dirección:</strong> ${p.sector} - Ref: ${p.referencia}<br>
          <a href="${p.ubicacion_maps_url}" target="_blank" style="color:blue; font-weight:bold;">ABRIR UBICACIÓN GPS</a><br><br>
          ${p.estado !== 'en_camino' ? `<button class="btn" onclick="actualizarRutaMoto('${p.id}', 'en_camino')">Marcar: En Camino</button>` : ''}
          <button class="btn" style="background:green;" onclick="actualizarRutaMoto('${p.id}', 'entregado')">Marcar: Entregado</button>
        </div>`;
    } else if (p.estado === 'entregado') {
      motoHistorial.innerHTML += `<div>✓ Sector ${p.sector} - Entregado</div>`;
    }
  });
}

async function actualizarRutaMoto(pedidoId, nuevoEstado) {
  const updateData = { estado: nuevoEstado };
  if(nuevoEstado === 'entregado') {
    updateData.entregado_en = new Date().toISOString();
  }
  
  await supabase.from('pedidos').update(updateData).eq('id', pedidoId);
  
  // Actualizar dinámicamente el estado ocupacional del motorizado
  const estadoConductor = nuevoEstado === 'en_camino' ? 'en_transito' : 'sin_asignar';
  await supabase.from('motorizados_detalles').update({ estado_actual: estadoConductor }).eq('id', perfilActual.id);
  
  cargarPedidosMotorizado();
}

// 7. SISTEMA DE ALERTA TRANSMISIÓN REALTIME (SONIDO TIMBRE)
function iniciarEscuchaRealtime() {
  supabase
    .channel('cambios-logistica-delivery')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, payload => {
      // Alerta para supervisores y admins sobre nuevos pedidos del aliado
      if (perfilActual.rol === 'admin' || perfilActual.rol === 'supervisor') {
        ejecutarAlertaFlujo("¡Nuevo pedido entrante listo para asignación!");
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, payload => {
      // Alerta dirigida al motorizado cuando se le autoasigna o envía solicitud masiva
      if (perfilActual.rol === 'motorizado' && payload.new.motorizado_id === perfilActual.id && payload.new.estado === 'espera_confirmacion') {
        ejecutarAlertaFlujo("Tienes un nuevo pedido en espera de confirmación.");
      }
      cargarDatosPorRol();
    })
    .subscribe();
}

function ejecutarAlertaFlujo(textoNotificacion) {
  // Desencadenar timbre de audio físico (función nativa en index.html)
  if (typeof window.reproducirTimbre === 'function') {
    window.reproducirTimbre();
  } else {
    const audio = document.getElementById('audio-notif');
    if (audio) audio.play().catch(()=>{});
  }

  // Notificación nativa Push en Segundo Plano/Pantalla
  if (Notification.permission === 'granted') {
    new Notification("On Delivery Logística", {
      body: textoNotificacion,
      icon: 'https://i.postimg.cc/GhX8YJCV/Screenshot-20260611-123137-Instagram.jpg'
    });
  }
}

// 8. DESCARGA EXCEL/CSV COMPATIBLE CON EXCEL
function descargarReporteExcel(pedidosData) {
  // Generación limpia de CSV con BOM utf-8 para acentos castellanos y legibilidad en Excel
  let csvContent = "\uFEFF"; 
  csvContent += "Aliado,Cliente,Teléfono,Sector,Motorizado,Costo Delivery,Estado\n";
  
  pedidosData.forEach(p => {
    csvContent += `"${p.aliado_id}","${p.cliente_nombre}","${p.cliente_telefono}","${p.sector}","${p.motorizado_id || 'Sin asignar'}","${p.costo_delivery}","${p.estado}"\n`;
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Reporte_OnDelivery_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
