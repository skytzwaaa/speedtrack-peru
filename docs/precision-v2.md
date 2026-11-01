# Precisión, navegación, voz e idiomas — 2026-11-01

Esta ronda reutiliza `gpsService`, `GpsFilter`, `routingService`, `WorldMap`, `useSession` y los diccionarios existentes. No cambia de proveedor ni incorpora reconocimiento de comandos: el proyecto solo tenía una tarjeta de función futura, no una implementación de reconocimiento.

## GPS y física

`GpsFilter` recibe dos políticas inyectables en su constructor: `gpsPolicy` y límites por modo. Son decisiones conservadoras de producto para un teléfono de consumo, no garantías del fabricante ni límites legales. Deben calibrarse con recorridos exteriores de referencia.

| Parámetro predeterminado | Motivo y compromiso |
| --- | --- |
| Precisión máxima: 35 m | Descarta ubicaciones demasiado inciertas para medir deporte. Una precisión peor sigue visible en pantalla, pero no suma distancia. Reduce cobertura en interiores y cañones urbanos. |
| Intervalo mínimo: 0,5 s | Evita derivadas inestables con duplicados o ráfagas; GPS solicitado aproximadamente cada segundo. |
| Corte: 15 s desde última muestra aceptada | Reinicia referencia sin inventar un segmento durante pérdida de señal. El reloj del ancla estacionaria es independiente del reloj de recepción. |
| Umbral espacial: máximo de 2 m y 0,5 × menor precisión de los dos puntos | Evita acumular pequeños desplazamientos inciertos. Se conserva el ancla para que pasos lentos lleguen a superar el umbral. No equivale a una prueba estadística de movimiento: deriva mayor que el radio puede seguir pareciendo desplazamiento real. |
| Velocidad del dispositivo menor de 0,7 km/h | Indicio adicional de parada; nunca se usa una velocidad positiva del dispositivo para sumar ruido de posición. |
| Retención de velocidad: hasta 3 s | Mantiene una estimación ya establecida entre pasos menores que el ruido; pasado ese plazo sin desplazamiento confirmado muestra cero. Una parada explícita del dispositivo borra la estimación inmediatamente. |
| Suavizado exponencial: constante de 3 s | Reduce fluctuación sin retrasar excesivamente cambios. La primera velocidad tras reposo puede subestimar movimiento hasta confirmar un nuevo segmento. |
| Techos: caminar 15, correr 45, bicicleta 110, vehículo 250 km/h | Filtros amplios de plausibilidad por actividad, conservados de la versión anterior. Rechazo tanto entre observaciones consecutivas como contra el ancla de distancia. |
| Aceleración máxima absoluta: 6 m/s² deporte, 12 m/s² vehículo | Rechaza discontinuidades físicas grandes antes de suavizar y en el resultado filtrado. No identifica accidentes ni determina infracciones. |

La velocidad instantánea es `Δd / Δt` entre posiciones aceptadas, en km/h. La filtrada usa un promedio exponencial dependiente del tiempo. La promedio es distancia acumulada / tiempo activo. La aceleración es `Δv / Δt`, convirtiendo km/h a m/s, con tiempos de observación válidos. El GPS conserva por separado precisión en metros y velocidad reportada por el dispositivo.

El adaptador Android especifica `interval: 1000` y `minimumUpdateInterval: 1000`, independientemente de `timeout: 12000`. La implementación instalada de `@capacitor/geolocation` 8.2.4 usa el timeout como intervalo deseado si se omite `interval`; mantenerlo omitido solicitaba actualizaciones cada 12 segundos. Los tests del adaptador también comprueban cancelación durante permisos y permisos denegados.

Pausar, ocultar la app, cambiar de modo o perder señal inicia un tramo nuevo. Reanudar espera una muestra válida: no muestra velocidad ni ETA de la etapa anterior. Los intervalos sin observación tampoco suman tiempo sobre el límite del vehículo. La aplicación sigue siendo de **primer plano**; ocultarla la pausa, tanto en web como en Android.

## Mapa y ETA

Mapa principal, tarjeta de tiempo/distancia/ritmo o velocidad y controles de pausa/reanudación/finalización. El análisis detallado se despliega bajo demanda. Mover el mapa desactiva seguimiento, sin borrar puntos ni ruta; recentrar lo reactiva. Los segmentos de distancia cero no añaden líneas de ruido al recorrido.

Marcadores O (origen), X (posición) e Y (destino). Verde: recorrido registrado; azul: ruta del proveedor; blanco discontinuo: tramo restante proyectado sobre esa ruta. No se unen pausas/cortes. El mapa, sus controles accesibles y los estados de carga usan i18n.

Destino opcional por búsqueda o toque, modificable/eliminable antes y durante la actividad. La ruta se solicita con «Calcular ruta» y se puede recalcular si se sale de ella. Cambiar de modo invalida una ruta incompatible, conservando destino. Caminar/correr usan `foot-walking`, bicicleta `cycling-regular`, vehículo `driving-car`, dentro de `routingService`.

ETA personal: distancia de la polilínea restante / velocidad reciente filtrada. Ventana de 20 s, mínimo tres muestras desde la última pausa/corte, señal de máximo 10 s y velocidad mínima de 1 km/h para evitar predicciones enormes al detenerse. Desviación de más de 100 m suspende ETA y solicita recalcular. Estos valores son heurísticas de estabilidad; no hay map-matching profesional y los cruces/autosuperposiciones pueden ser ambiguos. Llegada por voz exige menos de 20 m tanto de ruta restante como de separación real al destino y precisión de hasta 25 m. No equivale a certificar una llegada exacta.

## Voz

Una cola central serializa anuncios, prioriza seguridad y elimina pendientes al pausar/finalizar/cambiar idioma. Máximo 12 pendientes; duplicados pendientes se agrupan. Fallos de un proveedor no bloquean el siguiente mensaje. Un límite de 30 s libera motores que no notifican finalización; los avisos son cortos.

Web usa SpeechSynthesis con voz compatible y eventos de finalización/error. Android usa el plugin local `SpeedTrackVoice`, respaldado por `TextToSpeech`, consulta de idioma y callbacks nativos. Es preferible a depender de las capacidades de SpeechSynthesis de un WebView. Referencias: [Android TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech), [plugins locales Capacitor](https://capacitorjs.com/docs/android/custom-code).

La voz sigue el idioma actual de la app. `voice_language` se conserva únicamente por compatibilidad de datos antiguos. `voice_fallback` permite silencio, español o inglés si falta la voz solicitada. El texto del anuncio se traduce al idioma alternativo: no se envía Quechua a un sintetizador español. La interfaz sigue en Quechua. Perfil informa falta de voz y permite probarla.

Inicio, pausa, reanudación, finalización, kilometraje, llegada y baja precisión GPS están centralizados. `progress_alerts` habilita cada minuto distancia, duración, velocidad, ritmo peatonal, distancia restante y ETA disponible; alertas de vehículo conservan sus preferencias. No se solicitan permisos de micrófono.

## Idiomas

Diccionarios explícitos español, inglés y Quechua Cusco-Collao: sin herencia masiva del español. El fallback de emergencia usa español, y una clave desconocida devuelve su nombre sin romper React. Pruebas verifican claves, textos no vacíos, variables de interpolación y texto JSX fuera del sistema (solo marcas, unidades y fórmulas permitidas). Días de semana traducidos; fechas quechuas numéricas para no depender de meses españoles del sistema.

La traducción quechua es un **borrador completo de interfaz**, pendiente de revisión lingüística nativa; cobertura técnica no implica traducción certificada.

## Activar rutas y búsqueda reales

1. Servicio conservado: **OpenRouteService / HeiGIT**, Directions y geocodificación Pelias.
2. Cuenta personal HeiGIT y API key Standard con acceso a ambos servicios.
3. Obtenerla en [registro HeiGIT](https://account.heigit.org/signup) y [panel de cuenta](https://account.heigit.org/). Son los enlaces actuales publicados por [OpenRouteService](https://openrouteservice.org/).
4. Configurar `.env`: `VITE_ROUTING_API_KEY=tu_clave`; mantener `VITE_ROUTING_URL=https://api.openrouteservice.org`. Las variables `VITE_*` son visibles en el cliente, no secretos de servidor. También configurarlas en el entorno Preview de Vercel de esta rama y reconstruir web/APK.

Sin clave no se fabrica ninguna ruta ni ETA navegable. Se pueden registrar actividades, ver el mapa y seleccionar destinos. Los fallos de conexión, cuota o servicio producen estados recuperables.

## Validación y límites

Validaciones automatizadas: build Vite/TypeScript, ESLint, Vitest (GPS, física, ETA, rutas, idiomas, voz, persistencia/RLS), Playwright (incluidos los siete escenarios anteriores y nuevas regresiones de GPS/mapa/Quechua) y Gradle `assembleDebug` mediante `npm run android:apk`.

Resultado de esta revisión: **55 tests unitarios/integración y 9 E2E aprobados**, build web, lint, TypeScript y build Android correctos. Además se abrió el build de producción con Playwright, cartografía real de OpenFreeMap y ubicación controlada del navegador, sin errores JavaScript; se inspeccionó su captura móvil. El APK pasó integridad ZIP y su `assets/public/index.html` coincide con el build web final. SHA-256: `e5beac1697c6767e4ddb4bcc4d812cf20e30790f04e36593fa474b3e46e36046`.

Vercel conserva salida `dist`, build de Vite y fallback SPA; no se requiere servidor Node ni servicio de voz externo. El APK está en `android/app/build/outputs/apk/debug/app-debug.apk` (artefacto ignorado por Git). No hay teléfono conectado por ADB en esta revisión; faltan pruebas de GPS exterior, audio nativo/permisos reales y servicios con una clave real. La prueba de mapa de navegador usa cartografía/routing controlados; no acredita cobertura cartográfica de una ubicación concreta.
