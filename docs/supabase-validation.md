# Validación de Supabase real — 2026-11-01

Proyecto: `hpcpikyxntyvpynzcvyt`. Rama: `feature/speedtrack-v2`.

## Migración y seguridad

- Se revisó el estado remoto y el dry-run antes de aplicar `202610270001_speedtrack_v2.sql` con `supabase db push --linked`.
- El historial de migraciones local y remoto coincide. No hicieron falta migraciones adicionales.
- Se consultó el catálogo real: `profiles`, `sessions`, `measurements`, `splits`, `events` y `user_settings` tienen RLS habilitado y políticas `USING`/`WITH CHECK` que comparan `auth.uid()` con el propietario.
- Las pruebas REST usan la clave pública y JWT reales: A y B ven exclusivamente sus filas, incluso consultando explícitamente al otro propietario. Se bloquearon inserciones, actualizaciones, eliminaciones y RPC sobre datos ajenos.
- `anon` no pudo leer ni insertar datos privados ni ejecutar `save_activity`.
- Se verificaron claves foráneas compuestas, rollback de una actividad con hijos inválidos y guardado idempotente sin duplicar hijos.

## Auth y persistencia

- Email/password está habilitado; la confirmación de correo está activada y se conservó así.
- Login, validación del JWT, refresh, logout local, invalidación del refresh token y nuevo login pasaron contra Auth real.
- El trigger creó perfiles y se comprobaron actualizaciones propias de perfil y preferencias.
- Chromium ejecutó login → guardar actividad → logout → borrar localStorage → login → recuperar actividad desde Supabase → cambiar a B sin mostrar datos de A.
- La prueba utiliza datos sintéticos marcados como demo, y elimina sus dos usuarios temporales y todos sus datos al terminar.
- Se conservan caché por propietario, outbox, recuperación de borradores, reintentos y modo invitado. Los E2E existentes cubren errores de red/cuota y recuperación local.

**Pendiente de validación:** registro público y entrega/confirmación de email en un buzón controlado. El endpoint público rechazó los correos ficticios `@example.com` (`email_address_invalid`) y posteriormente devolvió `over_email_send_rate_limit`. Para comprobar el resto se usó `generateLink(type: signup)` y confirmación administrativa exclusivamente de las cuentas temporales. Esto no prueba entrega de correo ni el flujo completo de registro público. No se modificaron SMTP, límites ni confirmación global. Se solicitó un correo de prueba al propietario.

## Verificaciones

- Vitest: 60 pruebas, 11 archivos, incluyendo SQL/RLS en PGlite.
- Playwright: 14 casos funcionales con servicios simulados, más el recorrido real de Chromium descrito arriba.
- ESLint y TypeScript: sin errores.
- Build web y Android `assembleDebug`: correctos. Avisos no bloqueantes de tamaño de chunks, futura carga nativa de configuración Vite y repositorios Gradle `flatDir`.
- El primer intento Android falló por `uv_os_get_passwd` dentro del sandbox de Windows. La ejecución autorizada fuera del sandbox completó Capacitor y Gradle.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 5 926 779 bytes, generado con configuración pública real.
- SHA-256: `76cdf1490632cf13fa1fb608e376052fc04b0460a91d4b7a8affb7be103e0c7b`.
- No se validó instalación/GPS en un teléfono físico en esta sesión.

## Repetir

Ver comandos en README y `scripts/validate-supabase.mjs --linked`. El script exige `SPEEDTRACK_TEST_PROJECT_REF` igual al proyecto enlazado, para no ejecutarse nunca contra el proyecto con cuentas reales. La clave administrativa se obtiene de la CLI en memoria para preparación y limpieza, nunca se agrega a `.env`, al frontend, al APK ni a Git. `.env`, APK y estado temporal de la CLI están ignorados.
