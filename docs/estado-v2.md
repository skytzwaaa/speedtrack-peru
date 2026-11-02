# Estado de SpeedTrack V2 — 2026-11-01

**Revisión posterior en `feature/speedtrack-mejoras-paralelas`:** `main` ya contiene V2 en el merge `8001ba6`. El contenido de esta página es histórico; sus instrucciones de ramas, configuración y validaciones deben leerse junto al README actual. La búsqueda HeiGIT usa ahora la base independiente `https://api.heigit.org/pelias/v1`, y Android registra el callback nativo `pe.speedtrack.app://auth/callback`.

**Conexión real posterior:** [validación Supabase](supabase-validation.md) actualiza el estado de migraciones, RLS, Auth, persistencia y APK descrito en este documento histórico.

**Actualización posterior:** la ronda de mapa, precisión, voz e idiomas está descrita en [precision-v2.md](precision-v2.md); reemplaza las limitaciones de voz y cobertura Quechua de este estado histórico.

Revisión desde `77c03d1`, exclusivamente en `feature/speedtrack-v2`. El repositorio ya contenía la implementación principal: esta continuación corrige defectos de persistencia y ETA sin sustituir las pantallas existentes.

| Requisito | Estado comprobado | Pendiente |
| --- | --- | --- |
| Supabase/Auth por usuario | Implementado: registro, acceso, recuperación, sesión persistente, perfil y separación de cuentas; contratos probados en navegador | Configurar un proyecto real y probar correos, refresh y acceso desde dos dispositivos |
| Persistencia e historial en BD | Implementado: RPC transaccional, RLS en todas las tablas, caché, cola y reintentos; SQL ejecutado con dos identidades en PGlite | Aplicar migración al proyecto Supabase y verificar allí aislamiento y sincronización |
| GPS real y precisión | Implementado: adaptadores web/nativo, límites por modo, precisión, suavizado, pausas y cortes | Validar precisión y permisos en teléfono, en exteriores |
| Caminar, correr, bicicleta y vehículo | Completos en código; GPS emulado, pausa, finalización e historial probados | Prueba física de cada modo |
| Mapa, ubicación, destino y rutas | Mapa y selección implementados; perfiles por modo y errores comprobados con proveedor simulado | Clave de OpenRouteService para rutas y búsqueda reales |
| ETA dinámico | Implementado; pruebas de velocidad filtrada, parada, pérdida de señal y nueva ventana tras pausa | Contrastar con recorridos físicos |
| Tráfico opcional | Adaptador y validación implementados; se informa indisponibilidad sin proveedor | Proveer proxy HTTPS que consulte datos reales; no hay servicio desplegado |
| Estadísticas e historial | Implementados, con aislamiento por cuenta | Validación con historial real en Supabase |
| Capacitor/Android | Proyecto nativo y APK debug compilados en este entorno | Instalación y pruebas en teléfono; firma release si se quiere distribuir |
| UX y optimización | Se conserva diseño, Física, voz e idiomas; mapa diferido y cálculo de velocidad limitado a ventana reciente | Quechua sigue parcial; comprobar voces del WebView del teléfono |
| Tests/build/documentación | Vitest, SQL/RLS, Playwright, TypeScript, ESLint y compilaciones web/Android | Validación externa con servicios configurados |

## Correcciones de esta continuación

- Nuevas importaciones locales usan IDs deterministas por cuenta, tanto para la sesión como para sus mediciones, splits y eventos. Repetir una importación no duplica datos; dos cuentas ya no compiten por las mismas claves primarias. Se conservan los IDs de importaciones anteriores ya presentes en la caché de esa cuenta.
- Si falla la escritura de la cola de subida, finalizar conserva el borrador recuperable. La prueba de navegador simula `QuotaExceededError`, recarga y recupera sin duplicar el historial.
- Una entrada nula dentro de una actividad corrupta ya no hace fallar la lectura de todo el historial: se descarta esa actividad y se preservan las válidas.
- El ETA espera tres muestras de la nueva ventana después de una pausa o corte GPS, sin mezclar velocidades del tramo anterior.
- Importar mantiene el botón ocupado durante el proceso; cerrar sesión maneja también excepciones de red.
- La prueba de recuperación abre el enlace como un documento nuevo, igual que al abrir un correo, en lugar de cambiar solamente el fragmento de una página ya inicializada.

## Acciones externas necesarias

1. Crear o seleccionar el proyecto Supabase. Si aún no se aplicó, ejecutar `supabase/migrations/202610270001_speedtrack_v2.sql` completo una sola vez; no volver a ejecutar una migración ya aplicada.
2. Copiar `.env.example` a `.env` y completar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` con la clave pública y `VITE_AUTH_REDIRECT_URL` con la URL web. Registrar esa URL y `http://localhost:5173` en Auth / Redirect URLs, habilitar Email/Password y configurar correo/SMTP según el uso previsto. No enviar claves privadas ni `service_role`.
3. Para búsqueda y rutas reales, completar `VITE_ROUTING_API_KEY`. Para tráfico, configurar opcionalmente `VITE_TRAFFIC_URL` con un proxy que cumpla el contrato del README. Sin él se muestra indisponibilidad.
4. Añadir las mismas variables públicas al entorno Preview de Vercel para `feature/speedtrack-v2`; reconstruir web y APK tras configurarlas. El APK generado en esta revisión funciona en modo local porque no hay `.env` de servicios reales.
5. Conectar un teléfono con depuración USB y ejecutar `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. Comprobar permisos, GPS exterior, pausa/reanudación, cierre/recuperación, voz y sincronización entre dos dispositivos. `adb devices` no detectó dispositivos durante esta revisión.

La validación local con mocks y PGlite no acredita que exista un backend desplegado ni que se hayan enviado correos reales. La compilación web mantiene la advertencia de tamaño del módulo diferido de MapLibre; Gradle emite advertencias de `flatDir` y versión XML de SDK, sin impedir la generación del APK.
