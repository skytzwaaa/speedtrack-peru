# SpeedTrack Perú · V2

Evolución del proyecto original de Física I: React + Vite + TypeScript, estilo oscuro/verde, actividad deportiva, movilidad y cinemática. Conserva la navegación, las demos, los idiomas, la voz y las pantallas de la V1. Se desarrolla exclusivamente en `feature/speedtrack-v2`; `main` permanece estable.

## Ejecutar

Estado revisado, correcciones desde `77c03d1` y acciones externas pendientes: [docs/estado-v2.md](docs/estado-v2.md).

Requisitos: Node **22.12+** (probado con Node 24), npm y Git.

```sh
git clone https://github.com/zetas13/speedtrack-peru.git
cd speedtrack-peru
git switch feature/speedtrack-v2
npm install
```

Copiar `.env.example` a `.env` (`Copy-Item .env.example .env` en PowerShell; `cp .env.example .env` en macOS/Linux). El modo local funciona con las variables vacías.

```sh
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
```

En Windows, si PowerShell bloquea `npm.ps1`, usar `npm.cmd` y `npx.cmd`. No es necesario cambiar la política del sistema. Para instalaciones reproducibles después de clonar, también se puede usar `npm ci`.

## Funciones

- Caminar y correr: ritmo, duración activa, distancia, velocidad, splits interpolados por kilómetro y gráfico de ritmo.
- Bicicleta: velocidad actual/promedio/máxima, recorrido y ETA según velocidad reciente.
- Vehículo: velocidad, aceleración escalar, frenadas, eventos, límite configurable y navegación. El límite es una referencia del usuario, no información vial oficial.
- Simulación de los cuatro modos: 45 segundos reales; deporte representa 30 minutos. Las demos se identifican y se excluyen de las estadísticas reales.
- Mapa mundial MapLibre + OpenFreeMap/OSM: calles, punto X, destino Y, seguimiento, centrar, ruta realizada y ruta prevista.
- Registro, login, logout, recuperación de contraseña, sesión persistente, nombre de perfil y preferencias mediante Supabase.
- Historial separado por usuario, estadísticas totales, últimos siete días y mes actual, con actividades por tipo.
- Física: distancia frente a desplazamiento, rapidez frente a velocidad vectorial, MRU/MRUV, aceleración, conversiones e incertidumbre.
- Voz con SpeechSynthesis: kilómetros, pausa, reanudación, eventos y proximidad de llegada. Depende de las voces disponibles en el dispositivo.
- Español e inglés; quechua Cusco-Collao parcial, con fallback explícito al español en términos pendientes de revisión lingüística.
- Web y Android Capacitor, sin reescribir la aplicación en otro framework.

## Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar **completa y una sola vez** la migración `supabase/migrations/202610270001_speedtrack_v2.sql` en SQL Editor. `docs/schema.sql` solo indica dónde está el esquema vigente.
3. En Authentication, activar Email/Password y confirmar el comportamiento de confirmación de correo. Configurar SMTP propio para un uso real según los límites del servicio.
4. Configurar Site URL y Redirect URLs con la web publicada y `http://localhost:5173` para desarrollo.
5. En `.env`, completar:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICABLE_O_ANON
VITE_AUTH_REDIRECT_URL=https://TU-WEB.vercel.app
```

Reiniciar Vite o reconstruir después de cambiar variables. No poner una clave `service_role`, secreta o privada. Todo valor `VITE_*` se incluye en el frontend y es visible.

Las tablas son `profiles`, `sessions`, `measurements`, `splits`, `events` y `user_settings`. `sessions` contiene columnas indexables y el documento completo del recorrido; las tablas hijas conservan sus datos en JSONB para mantener compatibilidad con V1. El destino y la geometría prevista viven en el documento de la sesión: no necesitan otra tabla.

RLS compara `auth.uid()` con el propietario en todas las tablas. Las claves foráneas compuestas impiden vincular mediciones a sesiones de otro usuario. `save_activity` usa **security invoker** y una transacción para guardar sesión e hijos atómicamente; un reintento con el mismo ID no duplica datos. El trigger de registro crea el perfil. No se almacenan contraseñas manualmente.

La recuperación envía un enlace; al abrirlo en la web, la aplicación permite establecer la nueva contraseña. Para Android, configurar `VITE_AUTH_REDIRECT_URL` con la web HTTPS: el correo se confirma o recupera en el navegador y luego se inicia sesión en la app. Esta versión no registra enlaces profundos de recuperación nativos.

### Local, caché y sincronización

- Invitado: conserva `speedtrack.sessions.v1` y sus ejemplos existentes.
- Autenticado: caché, borrador, preferencias y cola de subida usan claves con el ID del propietario. Un cambio de cuenta desmonta el espacio de trabajo anterior.
- Primero se muestra la caché; después se sincroniza con Supabase. Hay reintentos al recuperar conexión, cada minuto y con el indicador de sincronización.
- El botón de Perfil **Importar mis recorridos locales** importa solo actividades reales y completas. Es explícito para evitar atribuir a una cuenta datos de otra persona que haya usado el dispositivo. Se conservan los originales y no se importan demos.
- Las nuevas importaciones tienen identificadores estables por cuenta para evitar colisiones entre usuarios. Si falla la escritura de la cola al finalizar, se conserva el borrador para recuperarlo antes de iniciar otra actividad.
- Una actividad en curso se guarda aproximadamente cada cinco segundos y al pausar. Tras cerrar o recargar, **Recuperar actividad interrumpida** la guarda en el historial; no inventa el tramo sin muestras. Es necesario recuperarla antes de iniciar otra.
- Las preferencias modificadas sin conexión se conservan y se sincronizan posteriormente.
- Supabase almacena el historial de la cuenta; localStorage es caché y cola. No borrar datos del navegador antes de sincronizar. El almacenamiento local no está cifrado y tiene cuota limitada: si se agota, se muestra el error y se conserva la sesión en memoria. Para uso compartido, utilizar perfiles separados del navegador/dispositivo.
- No hay eliminación de actividades desde la interfaz en esta versión.

## GPS y Física

Se pide ubicación al iniciar un recorrido real o al pulsar centrar mapa; una demo no requiere permiso. En web hace falta **HTTPS o localhost**. La IP HTTP del PC abierta desde otro teléfono no suele ser un contexto seguro.

Unidades internas: kilómetros, segundos activos, km/h y m/s².

```text
d = Haversine(punto_anterior, punto_actual)
v = Δd / Δt                  (con conversión km/s → km/h)
a = (v_actual - v_anterior) / 3.6 / Δt
v_promedio = distancia_total / tiempo_activo × 3600
ritmo = 3600 / velocidad_kmh  (segundos por km)
ETA_usuario = distancia_restante_km / velocidad_filtrada_kmh × 3600
```

El filtro rechaza coordenadas inválidas, precisión peor de 50 m, muestras fuera de orden y saltos incompatibles con el modo. Usa la velocidad del dispositivo cuando es válida, distancia geográfica en otro caso y suavizado exponencial de unos tres segundos. La estimación de aceleración también tiene límites de plausibilidad. Los saltos rechazados no se convierten en la siguiente referencia.

Después de una pausa o un corte GPS mayor de 15 segundos se establece una nueva referencia sin sumar una línea entre posiciones no observadas. Una señal de más de diez segundos no alimenta el ETA. La velocidad reciente usa hasta veinte segundos y al menos tres muestras; detenido se muestra “Esperando movimiento”.

La distancia restante se calcula proyectando X sobre la polilínea de la ruta y sumando sus segmentos restantes. A más de 100 m de la ruta se solicita recalcular y no se muestra un ETA personal engañoso. No es navegación giro a giro ni map-matching profesional; cruces y rutas que se superponen pueden introducir ambigüedad.

La app prioriza **primer plano**: al ocultarse, pausa y conserva el borrador; al volver se debe reanudar. No solicita ubicación permanente en segundo plano. La suspensión del sistema, túneles, edificios y GPS impreciso pueden dejar tramos sin registrar. La rapidez es escalar; no se confunde con velocidad vectorial. Ninguna medición es certificada.

## Mapas, destinos y rutas

La cartografía usa `https://tiles.openfreemap.org/styles/liberty`, con atribución visible a OpenFreeMap, OpenMapTiles y OpenStreetMap. Se carga de forma diferida para no descargar MapLibre en Inicio.

El mapa y el registro no necesitan clave de rutas. Para calcular caminos y habilitar búsqueda de destinos, configurar un proveedor compatible con **OpenRouteService**:

```dotenv
VITE_ROUTING_URL=https://api.openrouteservice.org
VITE_ROUTING_API_KEY=TU_CLAVE_PUBLICA_RESTRINGIDA
```

`routingService` abstrae el proveedor. Caminar/correr usan `foot-walking`, bicicleta `cycling-regular` y vehículo `driving-car`. Seleccionar destino en el mapa, centrar la ubicación y pulsar **Calcular ruta**. Al cambiar de modo no se reutiliza la ruta de otro perfil.

La clave en la web es visible: aplicar las restricciones y cuotas del proveedor o usar un proxy propio compatible. La aplicación no dibuja una línea recta haciéndola pasar por una ruta si el proveedor no está configurado o falla. Búsqueda, rutas y teselas necesitan conexión. No hay descarga de mapas offline ni garantía de disponibilidad de servicios públicos.

## Tráfico opcional

Sin `VITE_TRAFFIC_URL` se indica que no está disponible; el GPS y el ETA personal siguen funcionando. No se fabrican condiciones de tráfico.

`trafficService` admite un proxy HTTPS propio que consulte un proveedor real. Configurar CORS para la web y `https://localhost` de Capacitor. Las credenciales secretas del proveedor deben vivir **en ese servidor**, nunca en variables `VITE_*`.

```http
POST <VITE_TRAFFIC_URL>
Content-Type: application/json

{"from":[-77.03,-12.12],"to":[-77.02,-12.11]}
```

Respuesta:

```json
{
  "etaSeconds": 720,
  "condition": "moderate",
  "incidents": ["Descripción real proporcionada por la API"],
  "updatedAt": "2026-10-27T22:00:00Z"
}
```

`condition` es opcional (`flow`, `moderate`, `congested`); `incidents` también. Solo devolver datos que el proveedor realmente suministre, incluidos cierres cuando existan. El adaptador descarta respuestas inválidas o de más de cinco minutos. Consulta aproximadamente cada minuto en modo vehículo con destino y muestra **ETA con tráfico** separado de **ETA según tu velocidad**. El ejemplo de fecha es ilustrativo; el servidor debe enviar el instante real de actualización. El repositorio no incluye un contrato comercial de tráfico ni un proxy ya desplegado.

## Android / APK

Proyecto nativo: `android/`. ID: `pe.speedtrack.app`. Nombre: **SpeedTrack Perú**. Android mínimo API 24, compilación/target API 36, Java 21. Icono vectorial y splash oscuros; solo permisos INTERNET, ubicación aproximada y precisa. Backups automáticos desactivados para no copiar la caché de ubicaciones.

Instalar Android Studio o las herramientas Android SDK, SDK Platform 36 y Build Tools compatibles. Configurar `JAVA_HOME` con Java 21 y `ANDROID_HOME` con el SDK. Alternativamente, crear `android/local.properties` (ignorado por Git):

```properties
sdk.dir=C:/Users/TU_USUARIO/AppData/Local/Android/Sdk
```

```sh
npm run android:sync
npm run android:open
npm run android:apk
```

`android:apk` reconstruye la web, sincroniza Capacitor y ejecuta el Gradle Wrapper incluido. En macOS/Linux, si es necesario: `chmod +x android/gradlew`.

Salida instalable de desarrollo:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

El APK debug se pudo compilar en este entorno con Java 21 y SDK instalado. No se sube a Git. Para distribución pública se requiere firma release propia y las validaciones del canal de distribución; no hay claves de firma en el repositorio. La prueba con GPS físico debe realizarse en un teléfono: no había dispositivo ni AVD conectado durante el desarrollo.

Geolocalización tiene adaptador nativo `@capacitor/geolocation` y fallback web. La voz web puede no estar disponible en algunos WebViews Android; la UI lo indica. No hay servicio de tracking permanente.

## Vercel

Importar el repositorio y seleccionar **`feature/speedtrack-v2` como rama de preview**. Instalar con `npm ci`, compilar con `npm run build`, salida `dist`. Añadir las variables públicas en el entorno de Preview y registrar esa URL en Supabase Auth. `vercel.json` contiene salida, rewrite SPA y cabeceras básicas. No es necesario cambiar ni fusionar `main` para revisar V2. El despliegue no se realizó automáticamente.

## Pruebas y límites de validación

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

- Vitest verifica física, filtros, conversiones, ritmo, ETA, perfiles de rutas, validación, cachés aisladas, cola y reintentos.
- PGlite ejecuta la migración SQL real con roles simulados `authenticated`/`anon` y dos identidades; comprueba RLS, FK y RPC idempotente. No sustituye comprobar el proyecto Supabase desplegado y sus ajustes Auth/SMTP.
- Playwright prueba demo, pausa, guardado, idiomas, GPS emulado y recuperación, cambio de cuentas y routing. Supabase/routing se simulan en estas pruebas; no prueban envío de correos reales ni facturación/credenciales de APIs.
- La cartografía pública también se revisó en Chromium con coordenadas emuladas, sin errores JavaScript.
- El build puede advertir del tamaño del módulo MapLibre, que se descarga únicamente al abrir un mapa.
- Unidades métricas en esta versión; no hay avatar subido, giro a giro, mapas descargables, comandos de voz ni seguimiento continuo con pantalla apagada. Son extensiones futuras, no funciones anunciadas como disponibles.

## Arquitectura y colaboración

`pages/` y `components/` conservan las pantallas originales. `useSession` administra el ciclo de tracking y los avisos; `GpsFilter` filtra las muestras; `useActivityStore` coordina caché/outbox/nube; `useSettings` sincroniza preferencias; `useAuth` usa Supabase Auth. Servicios independientes aíslan GPS, routing, tráfico, voz, borradores y almacenamiento. Diccionarios tipados viven en `src/i18n`.

No subir `.env`, `node_modules`, `dist`, APK, cachés, `local.properties` ni claves. Sí versionar migraciones, lockfile, proyecto Android y su wrapper. Ejecutar verificaciones antes de cada bloque estable y hacer push exclusivamente a `origin/feature/speedtrack-v2`.

Referencias oficiales: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [OpenFreeMap](https://openfreemap.org/quick_start/), [MapLibre](https://maplibre.org/maplibre-gl-js/docs/), [Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [Geolocation](https://capacitorjs.com/docs/apis/geolocation), [OpenRouteService](https://openrouteservice.org/).
