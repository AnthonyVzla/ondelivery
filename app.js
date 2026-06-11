window.onerror = function(msg, url, line) { alert("Error: " + msg + "\nLínea: " + line); return true; };

// CONFIGURACIÓN SUPABASE
const supabaseUrl = 'https://magwwelvdqpcjrhabnju.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3d3ZWx2ZHFwY2pyaGFibmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzM0OTYsImV4cCI6MjA5NjUwOTQ5Nn0.OPYjHKVRQ8Ryqh5-0sXJFidUhSUehGr64ApWozO3h5k'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActual = null;
let perfilActual = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-ingresar').addEventListener('click', iniciarSesion);
});

// AUTENTICACIÓN
async function iniciarSesion() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  if(!email || !password) return alert("Ingresa correo y contraseña.");
  
  document.getElementById('btn-ingresar').innerText = "Cargando...";
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Error: ' + error.message);
    document.getElementById('btn-ingresar').innerText = "Ingresar";
    return;
  }
  usuarioActual = data.user;
  obtenerPerfil(usuarioActual.id);
}

async function obtenerPerfil(userId) {
  if (usuarioActual.email === 'ondeliveryve@gmail.com') {
    perfilActual = { id: userId, rol: 'admin', nombre: 'Admin' };
    mostrarVista('admin');
    cargarZonas();
    return;
  }

  const { data, error } = await supabase.from('perfiles').select('*').eq('id', userId).single();
  if (data) {
    perfilActual = data;
    mostrarVista(data.rol);
    if(data.rol === 'aliado') cargarZonas();
  } else {
    alert("Perfil no encontrado en BD.");
  }
}

function mostrarVista(rol) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  if (rol === 'admin') document.getElementById('admin-view').classList.add('active');
  if (rol === 'aliado') document.getElementById('aliado-view').classList.add('active');
  if (rol === 'supervisor') document.getElementById('supervisor-view').classList.add('active');
  if (rol === 'motorizado') document.getElementById('motorizado-view').classList.add('active');
}

// FUNCIONES ADMINISTRADOR (¡AQUÍ SE ARREGLA EL ERROR DE TU CAPTURA!)
window.crearNuevoUsuario = async function() {
  const nombre = document.getElementById('admin_nuevo_nombre').value;
  const correo = document.getElementById('admin_nuevo_correo').value;
  const pass = document.getElementById('admin_nuevo_pass').value;
  const tel = document.getElementById('admin_nuevo_tel').value;
  const rol = document.getElementById('admin_nuevo_rol').value;

  if(!nombre || !correo || !pass) return alert("Completa nombre, correo y contraseña");

  // 1. Crear en Autenticación
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: correo,
    password: pass
  });

  if(authError) return alert("Error creando credenciales: " + authError.message);

  // 2. Guardar en tabla perfiles
  if(authData.user) {
    const { error: dbError } = await supabase.from('perfiles').insert([{
      id: authData.user.id,
      nombre: nombre,
      rol: rol,
      correo: correo,
      telefono: tel,
      activo: true
    }]);

    if(dbError) alert("Error guardando perfil: " + dbError.message);
    else alert("¡Usuario creado con éxito!");
  }
};

window.crearZonaTabulador = async function() {
  const nombre = document.getElementById('admin_zona_nombre').value;
  const precio = document.getElementById('admin_zona_precio').value;

  if(!nombre || !precio) return alert("Ingresa nombre y precio de la zona");

  const { error } = await supabase.from('tabulador_zonas').insert([{
    nombre_zona: nombre,
    precio_base: parseFloat(precio)
  }]);

  if(error) alert("Error: " + error.message);
  else alert("Zona creada exitosamente");
};

// FUNCIONES ALIADO
window.abrirFormularioPedido = function() {
  const form = document.getElementById('form-solicitud');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

async function cargarZonas() {
  const select = document.getElementById('p_zona');
  if(!select) return;
  const { data } = await supabase.from('tabulador_zonas').select('*');
  if(data) {
    select.innerHTML = '<option value="">-- Selecciona Zona --</option>';
    data.forEach(z => {
      select.innerHTML += `<option value="${z.id}" data-precio="${z.precio_base}">${z.nombre_zona} ($${z.precio_base})</option>`;
    });
  }
}

window.enviarPedido = async function() {
  const nombre = document.getElementById('p_nombre').value;
  const tel = document.getElementById('p_tel').value;
  const sector = document.getElementById('p_sector').value;
  const ref = document.getElementById('p_ref').value;
  const maps = document.getElementById('p_maps').value;
  const zonaSelect = document.getElementById('p_zona');
  const precio = zonaSelect.options[zonaSelect.selectedIndex]?.dataset.precio;

  if(!nombre || !sector || !precio) return alert("Faltan datos obligatorios.");

  const { error } = await supabase.from('pedidos').insert([{
    aliado_id: perfilActual.id,
    cliente_nombre: nombre,
    cliente_telefono: tel,
    sector: sector,
    referencia: ref,
    ubicacion_maps_url: maps,
    costo_delivery: parseFloat(precio)
  }]);

  if(error) alert("Error: " + error.message);
  else {
    alert("Pedido enviado.");
    document.getElementById('form-solicitud').style.display = 'none';
  }
};
