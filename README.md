# On Delivery — Instrucciones de pruebas y despliegue

Este proyecto es una PWA mínima (vanilla JS) llamada *On Delivery*. Contiene roles: `aliado`, `motorizado`, `contabilidad` y `master`.

Resumen rápido de estado
- Interfaz móvil-first, paleta blanco/negro/rojo, fuente Poppins.
- Login por `username`/`password` (creados por Master desde el panel).
- Master con acceso rápido por clave `27146006` (botón "Portal Master" en header).
- Al crear `aliado` se guarda `commerceLocationUrl` usado como ubicación del comercio.
- Exportación `.xlsx` con SheetJS y fallback CSV.
- Cliente Supabase integrado (lectura/escritura y suscripción realtime a `orders`).

IMPORTANTE: actualmente el proyecto incluye la `anon key` y `URL` de Supabase proporcionada; para producción mueva la clave fuera del código.

Requisitos locales
- Navegador moderno (Chrome/Edge/Firefox móvil preferible)
- Servidor estático para servir los archivos (Live Server en VSCode, Python `http.server`, o GitHub Pages)

Probar localmente (rápido)
1. Abrir la carpeta `appon` en VSCode.
2. Usar la extensión Live Server o ejecutar desde terminal:

```powershell
# desde la carpeta c:\Users\EQUIPO\Desktop\appon
python -m http.server 8000
# luego abrir http://localhost:8000 en el navegador
```

3. En la pantalla de login crear usuarios desde el panel Master (botón "Portal Master" → clave `27146006`).
   - Crear un `aliado` con `username` y `password` y rellenar `URL ubicación del comercio`.
   - Crear un `motorizado` con porcentaje (50–100%) y asignarlo al `aliado` si se desea.
4. Iniciar sesión con el `aliado` (username/password) y crear pedidos; comprobar que el `motorizado` vea los pedidos disponibles (según asignación).
5. Desde Contabilidad descargar `.xlsx`.

Supabase — crear tablas (SQL)
Ejecute el archivo `create_tables.sql` en el SQL editor de Supabase para crear las tablas mínimas.

Supabase: configuración recomendada
- En Dashboard → API: copiar `URL` y `anon key` (si quiere reemplazar la que está en el código).
- En Realtime: habilitar para las tablas `orders`.
- CORS: permitir el dominio donde desplegará (GitHub Pages / su dominio).
- Policies (RLS): para pruebas puede desactivar RLS o crear reglas específicas. Para producción, implemente RLS por roles.

Despliegue a GitHub Pages
1. Inicialice git, cree un repo y haga push:

```bash
git init
git add .
git commit -m "Initial On Delivery PWA"
# crear repo en GitHub y luego
git remote add origin https://github.com/<tuusuario>/<repo>.git
git push -u origin main
```

2. En GitHub: Settings → Pages → seleccionar branch `main` (root) y guardar. GitHub Pages servirá `index.html`.
3. Alternativa: usar `gh-pages` npm package para publicar a `gh-pages` branch.

Conectar Supabase en producción
- Reemplace en `app.js` las constantes `SUPABASE_URL` y `SUPABASE_KEY` por las de su proyecto.
- (Recomendado) no exponga la anon key en público si no es necesario; considere proxy o reglas estrictas.

SQL: `create_tables.sql`
Ver `create_tables.sql` en este mismo directorio.

Notas finales y QA antes de la presentación
- Yo preparé el cliente y las instrucciones; sin embargo necesito que usted pruebe en su navegador móvil real (o use emulación) y confirme que las tablas en Supabase existen y que las credenciales funcionan.
- Si quiere, puedo:
  - Generar y commitear un `gh-pages` deploy workflow (GitHub Actions) para publicar automáticamente.
  - Ayudar a preparar reglas RLS seguras para Supabase.

Contacto rápido
- Para cualquier corrección urgente (antes de presentar), dígame qué flujo falla y lo corrijo inmediatamente.
