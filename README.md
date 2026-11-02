# SpeedTrack Perú · V2

Evolución del proyecto original de Física I: React + Vite + TypeScript, estilo oscuro/verde, actividad deportiva, movilidad y cinemática. Conserva la navegación, las demos, los idiomas, la voz y las pantallas de la V1. V2 fue integrada en `main` mediante el merge `8001ba6`; esta revisión continúa en `feature/speedtrack-mejoras-paralelas`.

## Ejecutar

Ronda de precisión/mapa/voz/idiomas: [docs/precision-v2.md](docs/precision-v2.md). Estado anterior y acciones externas pendientes: [docs/estado-v2.md](docs/estado-v2.md).

Requisitos: Node **22.12+** (probado con Node 24), npm y Git.

```sh
git clone https://github.com/zetas13/speedtrack-peru.git
cd speedtrack-peru
git switch feature/speedtrack-mejoras-paralelas
npm ci
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
- Voz centralizada con SpeechSynthesis en web y TextToSpeech nativo en Android: inicio, pausa/reanudación, finalización, kilómetros, progreso/ETA, precisión GPS y alertas. Cola con prioridades y alternativa de idioma configurable.
- Español, inglés y diccionario completo Quechua Cusco-Collao (borrador pendiente de revisión lingüística). Claves/interpolaciones comprobadas; fallback seguro de emergencia.
- Web y Android Capacitor, sin reescribir la aplicación en otro framework.

## Supabase

1. Crear un proyecto en Supabase.
2. Autenticar y enlazar la CLI (`npx supabase login`, `npx supabase link --project-ref TU_PROJECT_REF`), revisar `npx supabase migration list --linked` y aplicar pendientes con `npx supabase db push --linked`. La migración `202610270001_speedtrack_v2.sql` ya está aplicada al proyecto `hpcpikyxntyvpynzcvyt`; no volver a ejecutarla manualmente. `docs/schema.sql` solo indica dónde está el esquema vigente.
3. En Authentication, activar Email/Password y confirmar el comportamiento de confirmación de correo. Configurar SMTP propio para un uso real según los límites del servicio.
4. Configurar Site URL y Redirect URLs con la web publicada y `http://localhost:5173` para desarrollo.
5. En `.env`, completar:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
VITE_AUTH_REDIRECT_URL=https://TU-WEB.vercel.app
```

Reiniciar Vite o reconstruir después de cambiar variables. Se admite `VITE_SUPABASE_ANON_KEY` como alternativa legacy. No poner una clave `service_role`, secreta o privada: el arranque y build rechazan claves privilegiadas en estas variables. Todo valor `VITE_*` se incluye en el frontend y es visible.

Las tablas son `profiles`, `sessions`, `measurements`, `splits`, `events` y `user_settings`. `sessions` contiene columnas indexables y el documento completo del recorrido; las tablas hijas conservan sus datos en JSONB para mantener compatibilidad con V1. El destino y la geometría prevista viven en el documento de la sesión: no necesitan otra tabla.

RLS compara `auth.uid()` con el propietario en todas las tablas. Las claves foráneas compuestas impiden vincular mediciones a sesiones de otro usuario. `save_activity` usa **security invoker** y una transacción para guardar sesión e hijos atómicamente; un reintento con el mismo ID no duplica datos. El trigger de registro crea el perfil. No se almacenan contraseñas manualmente.

La recuperación envía un enlace; al abrirlo en la web, la aplicación permite establecer la nueva contraseña. Android registra el enlace profundo `pe.speedtrack.app://auth/callback`; debe autorizarse en las Redirect URLs de Supabase y probarse en un dispositivo. La configuración web `VITE_AUTH_REDIRECT_URL` no sustituye esa dirección nativa. El flujo nativo no se ha validado en un dispositivo en esta revisión.

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

El filtro rechaza coordenadas inválidas, precisión peor de 35 m, muestras fuera de orden, saltos y aceleraciones incompatibles con el modo. Calcula velocidad instantánea con desplazamiento/tiempo válido y la distingue de velocidad filtrada, promedio y precisión GPS. La velocidad del dispositivo solo confirma parada o descarta valores imposibles. El ancla acumula pasos pequeños sin sumar ruido; parámetros configurables y sus compromisos están documentados en [precisión V2](docs/precision-v2.md).

Después de una pausa o un corte GPS mayor de 15 segundos se establece una nueva referencia sin sumar una línea entre posiciones no observadas. Una señal de más de diez segundos no alimenta el ETA. La velocidad reciente usa hasta veinte segundos y al menos tres muestras; detenido se muestra “Esperando movimiento”.

La distancia restante se calcula proyectando X sobre la polilínea de la ruta y sumando sus segmentos restantes. A más de 100 m de la ruta se solicita recalcular y no se muestra un ETA personal engañoso. No es navegación giro a giro ni map-matching profesional; cruces y rutas que se superponen pueden introducir ambigüedad.

La app prioriza **primer plano**: al ocultarse, pausa y conserva el borrador; al volver se debe reanudar. No solicita ubicación permanente en segundo plano. La suspensión del sistema, túneles, edificios y GPS impreciso pueden dejar tramos sin registrar. La rapidez es escalar; no se confunde con velocidad vectorial. Ninguna medición es certificada.

## Sensor de movimiento

Complementa al GPS con el acelerómetro del teléfono (`DeviceMotionEvent`, sin permisos en Android): indica si hay movimiento y, al caminar o correr, cuenta pasos y muestra una distancia **estimada** (0,72 m por paso al caminar, 1,0 m al correr). Funciona bajo techo. Si el sensor detecta movimiento pero el GPS no confirma posición, avisa en pantalla. No suma a la distancia oficial: en bicicleta y vehículo solo indica movimiento, porque la aceleración no permite calcular una distancia fiable. Los umbrales son heurísticos y están sin calibrar con recorridos reales; en iOS requiere permiso de movimiento. Solo funciona en primer plano y con la pantalla encendida. Código: `src/services/motionService.ts`.

## Mapas, destinos y rutas

La cartografía usa `https://tiles.openfreemap.org/styles/liberty`, con atribución visible a OpenFreeMap, OpenMapTiles y OpenStreetMap. Se carga de forma diferida para no descargar MapLibre en Inicio.

El mapa y el registro no necesitan clave de rutas. Para calcular caminos y habilitar búsqueda de destinos, configurar un proveedor compatible con **OpenRouteService**:

```dotenv
VITE_ROUTING_URL=https://api.heigit.org/openrouteservice
VITE_GEOCODING_URL=https://api.heigit.org/pelias/v1
VITE_ROUTING_API_KEY=TU_CLAVE_PUBLICA_RESTRINGIDA
```

`routingService` abstrae el proveedor. Caminar/correr usan `foot-walking`, bicicleta `cycling-regular` y vehículo `driving-car`. Seleccionar destino en el mapa, centrar la ubicación y pulsar **Calcular ruta**. Al cambiar de modo no se reutiliza la ruta de otro perfil.

Las URL de rutas y búsqueda son independientes: HeiGIT sirve la búsqueda en Pelias. Para un proveedor alternativo configurar ambas bases por separado. El contrato de migración está documentado por [HeiGIT](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912); sin una clave válida no se ha verificado una respuesta real de búsqueda o ruta en esta revisión.

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

Geolocalización tiene adaptador nativo `@capacitor/geolocation` y fallback web. Android usa un plugin TTS nativo que consulta disponibilidad de idioma, sin depender del SpeechSynthesis del WebView. No hay servicio de tracking permanente.

## Vercel

Importar el repositorio y seleccionar la rama de trabajo como preview. Instalar con `npm ci`, compilar con `npm run build`, salida `dist`. Añadir las variables públicas en el entorno de Preview y registrar esa URL en Supabase Auth. `vercel.json` contiene salida, rewrite SPA y cabeceras básicas. No se realizó ni verificó un despliegue en esta revisión.

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

En la revisión del 2026-11-01, con Node 22.23.4, pasaron typecheck, lint, build y 71 pruebas Vitest; Chromium pasó 14 pruebas E2E con proveedores simulados. `npm audit` reportó 14 vulnerabilidades moderadas en dependencias de desarrollo (`minimatch`/`glob` y sus dependientes); `npm audit --omit=dev` reportó cero. No se aplicó la actualización automática que propone cambios incompatibles. El build advierte sobre chunks mayores de 500 kB.

El APK debug se compiló con Java 21 y SDK 36, y su firma se verificó con `apksigner`. En este equipo no había `.env`, proyecto Supabase enlazado ni dispositivo Android conectado: la compilación funciona en modo local y no acredita correo, backend real, instalación, GPS, voz o enlaces profundos. La validación real descrita en `docs/supabase-validation.md` corresponde a una sesión anterior. Para volver a verificar con servicios reales, usar credenciales y usuarios de prueba autorizados; no ejecutar migraciones remotas sin revisar el historial y contar con autorización.

## Arquitectura y colaboración

### Validación del proyecto real

Resultados y límites de una validación anterior: [validación Supabase](docs/supabase-validation.md). La configuración incluida en cada APK depende de las variables presentes al compilar; sin ellas funciona en modo local.

Con la CLI autenticada, el proyecto enlazado y `.env` apuntando al mismo proyecto:

```sh
node scripts/validate-supabase.mjs --linked
```

Esta prueba crea dos usuarios temporales y elimina únicamente esos usuarios y sus datos al finalizar. Usa la clave administrativa de la CLI solo en memoria para preparar/confirmar/limpiar las cuentas; comprueba RLS usando la clave pública y los JWT de cada usuario. Verifica las seis tablas, aislamiento bidireccional, anon, escrituras ajenas, claves foráneas, rollback, reintentos, refresh, logout/login y recuperación.

Para incluir Chromium con el backend real, ejecutar primero `npm run build` y `npx vite preview --host 127.0.0.1 --port 4174 --strictPort`. En otra terminal PowerShell:

```powershell
$env:SPEEDTRACK_TEST_URL='http://127.0.0.1:4174'
node scripts/validate-supabase.mjs --linked
```

El navegador guarda una actividad y la recupera después de logout, borrado de caché y nuevo login. Los datos son sintéticos y se eliminan al finalizar. Si el registro público rechaza el destinatario ficticio o limita envíos, la prueba lo informa y prepara usuarios mediante Admin API; esto **no acredita registro público ni entrega de correo** y no modifica la configuración de confirmación de email.

`pages/` y `components/` conservan las pantallas originales. `useSession` administra el ciclo de tracking y los avisos; `GpsFilter` filtra las muestras; `useActivityStore` coordina caché/outbox/nube; `useSettings` sincroniza preferencias; `useAuth` usa Supabase Auth. Servicios independientes aíslan GPS, routing, tráfico, voz, borradores y almacenamiento. Diccionarios tipados viven en `src/i18n`.

No subir `.env`, `node_modules`, `dist`, APK, cachés, `local.properties` ni claves. Sí versionar migraciones, lockfile, proyecto Android y su wrapper. Comprobar las ramas del equipo antes de integrar cambios y publicar esta revisión únicamente en `origin/feature/speedtrack-mejoras-paralelas`.

Referencias oficiales: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [OpenFreeMap](https://openfreemap.org/quick_start/), [MapLibre](https://maplibre.org/maplibre-gl-js/docs/), [Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [Geolocation](https://capacitorjs.com/docs/apis/geolocation), [OpenRouteService](https://openrouteservice.org/).
