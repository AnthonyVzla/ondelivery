// 0. DETECTOR DE ERRORES (Solo para pruebas en el celular)
// Si algo falla, saltará un mensaje en tu pantalla.
alert("¡El archivo JS sí está cargando!");
window.onerror = function(mensaje, fuente, linea) {
  alert("Error en el código:\n" + mensaje + "\nLínea: " + linea);
  return true; 
};

// 1. CONFIGURACIÓN DE SUPABASE
const supabaseUrl = 'https://magwwelvdqpcjrhabnju.supabase.co';
// IMPORTANTE: Si esto sigue diciendo 'COLOCA_AQUI_TU_VERDADERA_ANON_KEY', la app se colgará y no hará nada.
const supabaseKey = 'COLOCA_AQUI_TU_VERDADERA_ANON_KEY'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioActual = null;
let perfilActual = null;

// 2. CONECTAR LOS BOTONES AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
  
  // Botón de Ingresar
  const btnIngresar = document.getElementById('btn-ingresar');
  if(btnIngresar) {
    btnIngresar.addEventListener('click', iniciarSesion);
  }

  // Botón de Notificaciones
  const btnNotif = document.getElementById('btn-notificaciones');
  if(btnNotif) {
    btnNotif.addEventListener('click', solicitarPermisoNotificaciones);
  }
});

// 3. LÓGICA DE LOS BOTONES
async function iniciarSesion() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if(!email || !password) {
    alert("Por favor, ingresa correo y contraseña");
    return;
  }

  // Mostramos que está cargando
  document.getElementById('btn-ingresar').innerText = "Cargando...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert('Error al iniciar sesión: ' + error.message);
    document.getElementById('btn-ingresar').innerText = "Ingresar"; // Restaurar botón
    return;
  }

  usuarioActual = data.user;
  alert("¡Sesión iniciada con éxito! Obteniendo tu rol...");
  // Aquí llamaría a obtenerPerfilUsuario(usuarioActual.id) que te pasé antes
}

function solicitarPermisoNotificaciones() {
  // Comprobamos si el navegador soporta notificaciones
  if (!("Notification" in window)) {
    alert("Este navegador no soporta notificaciones de escritorio/móvil.");
    return;
  }

  Notification.requestPermission().then(permission => {
    if(permission === 'granted') {
      alert('¡Notificaciones habilitadas correctamente!');
      // Reproducir el sonido en silencio para desbloquear el AudioContext del navegador
      const audio = document.getElementById('audio-notif');
      if(audio) {
        audio.play().catch(()=>{}).then(()=>{
          audio.pause();
          audio.currentTime = 0;
        });
      }
    } else if (permission === 'denied') {
      alert('Permiso de notificaciones denegado. Debes habilitarlo en los ajustes de tu navegador.');
    }
  });
}
