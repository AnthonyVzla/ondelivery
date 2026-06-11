// 1. Configuración de Supabase
const supabaseUrl = 'https://magwwelvdqpcjrhabnju.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3d3ZWx2ZHFwY2pyaGFibmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzM0OTYsImV4cCI6MjA5NjUwOTQ5Nn0.OPYjHKVRQ8Ryqh5-0sXJFidUhSUehGr64ApWozO3h5k'; // IMPORTANTE: Reemplazar
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActual = null;
let perfilActual = null;

// 2. Lógica de Autenticación
async function iniciarSesion() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert('Error al iniciar sesión: ' + error.message);
    return;
  }

  usuarioActual = data.user;
  await obtenerPerfilUsuario(usuarioActual.id);
}

async function obtenerPerfilUsuario(userId) {
  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error al obtener perfil', error);
    return;
  }

  perfilActual = perfil;
  mostrarVistaSegunRol(perfil.rol);
  iniciarEscuchaPedidos(); // Iniciar tiempo real para notificaciones
}

// 3. Control de Vistas (Esconder todas y mostrar la correspondiente)
function mostrarVistaSegunRol(rol) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  if (rol === 'admin') {
    document.getElementById('admin-view').classList.add('active');
  } else if (rol === 'supervisor') {
    document.getElementById('supervisor-view').classList.add('active');
  } else if (rol === 'motorizado') {
    document.getElementById('motorizado-view').classList.add('active');
  } else if (rol === 'aliado') {
    document.getElementById('aliado-view').classList.add('active');
  }
}

// 4. Funciones específicas del Aliado
function abrirFormularioPedido() {
  document.getElementById('form-solicitud').style.display = 'block';
}

function solicitarCosto() {
  // Según tu solicitud, redirige a WhatsApp según horario
  const hora = new Date().getHours();
  let numero = '';
  // Turno mañana 7 AM a 4:30 PM (16.5)
  if (hora >= 7 && hora < 16 || (hora === 16 && new Date().getMinutes() <= 30)) {
    numero = '584128481584';
  } else { // Turno noche 4:30 PM a 11:30 PM
    numero = '584124896096';
  }
  window.open(`https://wa.me/${numero}?text=Hola,%20necesito%20solicitar%20el%20costo%20de%20un%20delivery.`, '_blank');
}

async function enviarPedido() {
  // Aquí recolectarías los valores del HTML: p_nombre.value, etc.
  // ...
  // Lógica de inserción a Supabase
  const { data, error } = await supabase
    .from('pedidos')
    .insert([
      { 
        aliado_id: usuarioActual.id, 
        cliente_nombre: document.getElementById('p_nombre').value,
        cliente_telefono: document.getElementById('p_tel').value,
        sector: document.getElementById('p_sector').value,
        estado: 'activo'
      }
    ]);
    
  if(!error) {
    alert("Pedido solicitado con éxito. Notificando a supervisores...");
    document.getElementById('form-solicitud').style.display = 'none';
  }
}

// 5. Motor de Notificaciones en Tiempo Real (Supabase Realtime)
function iniciarEscuchaPedidos() {
  supabase
    .channel('custom-all-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pedidos' },
      (payload) => {
        // Lógica de validación según el rol
        if (perfilActual.rol === 'admin' || perfilActual.rol === 'supervisor') {
          reproducirTimbre(); // Llama a la función del index.html
          if(Notification.permission === 'granted'){
            new Notification("¡Nuevo pedido entrante!", {
              body: `Nuevo delivery para el sector ${payload.new.sector}`
            });
          }
          // Actualizar UI...
        }
      }
    )
    .subscribe();
}