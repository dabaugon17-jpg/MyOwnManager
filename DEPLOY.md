# 🚀 Desplegar en Vercel (gratis)

Esta app es **100% frontend** (React + Supabase). No tiene backend que mantener: la base de datos, auth y almacenamiento de imágenes los gestiona Supabase.

---

## ✅ Requisitos previos

1. Cuenta en https://vercel.com (gratis con GitHub)
2. El esquema SQL ejecutado en tu proyecto Supabase (archivo `/app/SUPABASE_SCHEMA.sql`)
3. URLs de redirección configuradas en Supabase → **Authentication → URL Configuration**

---

## 📦 Paso 1 — Sube el código a GitHub

Usa el botón **"Save to GitHub"** del chat de Emergent (arriba a la derecha). Eso publicará el repo entero, incluyendo la carpeta `frontend/`.

---

## 🌐 Paso 2 — Importar en Vercel

1. Entra en https://vercel.com/new
2. Selecciona el repo de GitHub que acabas de subir.
3. Vercel detectará Create React App. En la pantalla de configuración:
   - **Root Directory** → `frontend`
   - **Framework Preset** → Create React App (auto)
   - **Build Command** → `yarn build` (auto)
   - **Output Directory** → `build` (auto)

---

## 🔑 Paso 3 — Variables de entorno

En la pestaña **Environment Variables** añade EXACTAMENTE estas dos (sin comillas):

| Nombre | Valor |
|---|---|
| `REACT_APP_SUPABASE_URL` | `https://raxvxcmwtqczztskkyde.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | `sb_publishable_V9ynYwOcGoG6DPVTwd_K7Q_LIA9EmY3` |

> Marca las tres casillas: **Production**, **Preview**, **Development**.

Pulsa **Deploy**.

---

## 🔁 Paso 4 — Vincular el dominio definitivo en Supabase

Cuando Vercel termine, copia tu URL final (ej. `https://mi-app.vercel.app`) y vuelve a Supabase:

**Authentication → URL Configuration**:
- **Site URL** → `https://mi-app.vercel.app`
- **Redirect URLs** → añade `https://mi-app.vercel.app/**`

Guarda. Listo.

---

## ✅ Comprueba que funciona

1. Abre la URL de Vercel.
2. Crea una cuenta (email + contraseña, o Google si lo tienes habilitado en Supabase).
3. Crea un negocio o únete con código.
4. Añade un producto, véndelo, mira el dashboard.

---

## 🐛 Troubleshooting

- **"Faltan variables de entorno"** en consola → revisa que las dos `REACT_APP_*` están en Vercel y haz un **Redeploy**.
- **Login con Google falla** → revisa que en **Supabase → Authentication → Providers → Google** está activado y que el dominio de Vercel está en **Redirect URLs**.
- **Productos no se ven** → asegúrate de haber ejecutado `SUPABASE_SCHEMA.sql` y de que el usuario está en un grupo (`profiles.codigo_grupo` no debe ser NULL).

---

## 🆓 Coste

- **Vercel**: plan Hobby es gratis (100GB de banda al mes, ilimitados deploys).
- **Supabase**: plan Free es gratis (500MB DB, 1GB Storage, 50.000 usuarios).

Para una app de inventario pequeña es más que suficiente.
