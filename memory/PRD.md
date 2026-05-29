# PRD — Inventario App

## Problema original (verbatim del usuario)
> "Arregla la web para que funcione y para que se puedan crear los usuarios que sea para todo el mundo"

Posteriormente el usuario pidió desplegar gratis en Vercel y aceptó la **Opción 3**:
migración completa del backend FastAPI+MongoDB a **Supabase** (Auth + Postgres + Storage)
para poder hostear el frontend en Vercel sin servidor.

## Arquitectura (actual — Feb 2026)
- **Frontend** React (CRA) en `/app/frontend/`, hosteable en Vercel
- **Backend** ❌ (eliminado tras la migración a Supabase)
- **DB / Auth / Storage** → Supabase
  - Tablas: `profiles`, `grupos`, `productos`, `incidencias`
  - RLS por `codigo_grupo` y rol (`creator`, `admin_total`, `admin_menor`, `member`)
  - RPCs SECURITY DEFINER: `create_group`, `join_group_by_code`, `delete_my_group`, `kick_member`, `set_member_role`
  - Trigger `handle_new_user` autocrea fila en `profiles` al registrarse
  - Storage bucket `product-images` (público) con políticas por carpeta = `auth.uid()`

## Funcionalidad implementada (Feb 2026)
- ✅ Auth email+contraseña y Google OAuth (Supabase)
- ✅ Crear/unirse a grupo (negocio) con código de 6 letras
- ✅ Inventario CRUD con foto (Supabase Storage), categoría, batch (cantidad N)
- ✅ Venta de producto con selección de vendedor
- ✅ Histórico de ventas + ranking de vendedores + export CSV
- ✅ Incidencias (devoluciones) con edición/eliminación
- ✅ Miembros: roles, expulsar, objetivo mensual
- ✅ Dashboard con KPIs y gráfico (día/semana/mes/año)
- ✅ Despliegue en Vercel: `frontend/vercel.json` + `/app/DEPLOY.md`

## Backlog
### P0 (necesita acción del usuario)
- Desactivar **"Confirm email"** en Supabase Auth para que los nuevos usuarios entren al vuelo (o dejar activado si se prefiere flujo con confirmación).
- Configurar **Site URL** y **Redirect URLs** en Supabase para el dominio definitivo de Vercel.

### P1 (mejoras)
- Eliminar carpeta `/app/backend/` (ya está orfana, se mantiene por seguridad hasta confirmar despliegue exitoso).
- Convertir `sellProduct`, `createIncidencia` y `deleteIncident` a RPCs SECURITY DEFINER para atomicidad y para evitar spoofing del `sold_by`.
- Plan de tests E2E con un usuario semilla pre-confirmado en Supabase.

### P2 (futuro)
- Notificaciones en tiempo real con Supabase Realtime (cuando se vende un producto, notificar a los demás miembros del grupo).
- Modo offline / PWA con cache local.
- Exportación PDF de informe mensual.
