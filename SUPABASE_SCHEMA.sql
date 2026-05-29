-- ============================================================================
-- INVENTARIO APP - SUPABASE SCHEMA (consolidado, idempotente)
-- Cómo ejecutarlo:
--   1. Ve a tu proyecto Supabase → SQL Editor → + New query
--   2. Copia/pega TODO este archivo
--   3. Click "Run" (abajo a la derecha)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  picture text,
  codigo_grupo text,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grupos (
  group_id text PRIMARY KEY,
  nombre_negocio text NOT NULL,
  codigo_union text UNIQUE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  objetivo_mensual numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  product_id text PRIMARY KEY,
  nombre text NOT NULL,
  precio_compra numeric NOT NULL,
  precio_venta numeric,
  estado text DEFAULT 'inventario',
  foto_url text,
  file_id text,
  categoria text DEFAULT 'Otros',
  codigo_grupo text NOT NULL REFERENCES grupos(codigo_union) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sold_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sold_by_name text,
  sold_at timestamptz,
  batch_index integer DEFAULT 1,
  batch_total integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidencias (
  incidencia_id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES productos(product_id) ON DELETE CASCADE,
  codigo_grupo text NOT NULL REFERENCES grupos(codigo_union) ON DELETE CASCADE,
  motivo text NOT NULL,
  producto_nombre text,
  precio_venta numeric,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_codigo_grupo ON profiles(codigo_grupo);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_grupo ON productos(codigo_grupo);
CREATE INDEX IF NOT EXISTS idx_productos_estado ON productos(estado);
CREATE INDEX IF NOT EXISTS idx_productos_sold_at ON productos(sold_at);
CREATE INDEX IF NOT EXISTS idx_incidencias_codigo_grupo ON incidencias(codigo_grupo);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (re-creating them to be idempotent)
DROP POLICY IF EXISTS "profiles_select_self"        ON profiles;
DROP POLICY IF EXISTS "profiles_select_group"       ON profiles;
DROP POLICY IF EXISTS "profiles_update_self"        ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self"        ON profiles;
DROP POLICY IF EXISTS "grupos_select_member"       ON grupos;
DROP POLICY IF EXISTS "grupos_update_admin"        ON grupos;
DROP POLICY IF EXISTS "productos_select_member"    ON productos;
DROP POLICY IF EXISTS "productos_insert_member"    ON productos;
DROP POLICY IF EXISTS "productos_update_member"    ON productos;
DROP POLICY IF EXISTS "productos_delete_admin"     ON productos;
DROP POLICY IF EXISTS "incidencias_select_member"  ON incidencias;
DROP POLICY IF EXISTS "incidencias_insert_member"  ON incidencias;
DROP POLICY IF EXISTS "incidencias_update_admin"   ON incidencias;
DROP POLICY IF EXISTS "incidencias_delete_admin"   ON incidencias;
-- (clean up legacy policy names from the previous schema too)
DROP POLICY IF EXISTS "Users can view own profile"            ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"          ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"          ON profiles;
DROP POLICY IF EXISTS "Group members can view their group"    ON grupos;
DROP POLICY IF EXISTS "Group creators can insert groups"      ON grupos;
DROP POLICY IF EXISTS "Group admins can update groups"        ON grupos;
DROP POLICY IF EXISTS "Group creators can delete groups"      ON grupos;
DROP POLICY IF EXISTS "Group members can view products"       ON productos;
DROP POLICY IF EXISTS "Group members can insert products"     ON productos;
DROP POLICY IF EXISTS "Group admins can update products"      ON productos;
DROP POLICY IF EXISTS "Group admins can delete products"      ON productos;
DROP POLICY IF EXISTS "Group members can update product status" ON productos;
DROP POLICY IF EXISTS "Group members can view incidents"      ON incidencias;
DROP POLICY IF EXISTS "Group members can create incidents"    ON incidencias;
DROP POLICY IF EXISTS "Group admins can update incidents"     ON incidencias;
DROP POLICY IF EXISTS "Group admins can delete incidents"     ON incidencias;

-- profiles
CREATE POLICY "profiles_select_self" ON profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_select_group" ON profiles FOR SELECT TO authenticated
USING (
  codigo_grupo IS NOT NULL
  AND codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL)
);

CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- grupos
CREATE POLICY "grupos_select_member" ON grupos FOR SELECT TO authenticated
USING (codigo_union IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL));

CREATE POLICY "grupos_update_admin" ON grupos FOR UPDATE TO authenticated
USING (codigo_union IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND role IN ('creator', 'admin_total')));

-- productos
CREATE POLICY "productos_select_member" ON productos FOR SELECT TO authenticated
USING (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL));

CREATE POLICY "productos_insert_member" ON productos FOR INSERT TO authenticated
WITH CHECK (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL));

CREATE POLICY "productos_update_member" ON productos FOR UPDATE TO authenticated
USING (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL))
WITH CHECK (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL));

CREATE POLICY "productos_delete_admin" ON productos FOR DELETE TO authenticated
USING (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND role IN ('creator', 'admin_total')));

-- incidencias
CREATE POLICY "incidencias_select_member" ON incidencias FOR SELECT TO authenticated
USING (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL));

CREATE POLICY "incidencias_insert_member" ON incidencias FOR INSERT TO authenticated
WITH CHECK (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND codigo_grupo IS NOT NULL));

CREATE POLICY "incidencias_update_admin" ON incidencias FOR UPDATE TO authenticated
USING (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND role IN ('creator', 'admin_total', 'admin_menor')));

CREATE POLICY "incidencias_delete_admin" ON incidencias FOR DELETE TO authenticated
USING (codigo_grupo IN (SELECT codigo_grupo FROM profiles WHERE id = auth.uid() AND role IN ('creator', 'admin_total')));

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, picture)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'picture', NEW.raw_user_meta_data->>'avatar_url')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC FUNCTIONS (atomic ops + bypass RLS where needed)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_group(p_nombre_negocio text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_group_id text;
  v_existing text;
  v_attempts int := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT codigo_grupo INTO v_existing FROM profiles WHERE id = v_user_id;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Ya perteneces a un grupo'; END IF;

  LOOP
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM grupos WHERE codigo_union = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN RAISE EXCEPTION 'No se pudo generar código único'; END IF;
  END LOOP;

  v_group_id := 'grp_' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10);

  INSERT INTO grupos (group_id, nombre_negocio, codigo_union, admin_id)
  VALUES (v_group_id, p_nombre_negocio, v_code, v_user_id);

  UPDATE profiles SET codigo_grupo = v_code, role = 'creator' WHERE id = v_user_id;

  RETURN jsonb_build_object('group_id', v_group_id, 'codigo_union', v_code, 'nombre_negocio', p_nombre_negocio);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing text;
  v_group RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT codigo_grupo INTO v_existing FROM profiles WHERE id = v_user_id;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Ya perteneces a un grupo'; END IF;
  SELECT * INTO v_group FROM grupos WHERE codigo_union = upper(trim(p_code));
  IF v_group IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;
  UPDATE profiles SET codigo_grupo = v_group.codigo_union, role = 'member' WHERE id = v_user_id;
  RETURN jsonb_build_object('group_id', v_group.group_id, 'codigo_union', v_group.codigo_union, 'nombre_negocio', v_group.nombre_negocio);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_group()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_group RECORD;
BEGIN
  SELECT g.* INTO v_group FROM grupos g JOIN profiles p ON p.codigo_grupo = g.codigo_union WHERE p.id = v_user_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'No tienes grupo'; END IF;
  IF v_group.admin_id != v_user_id THEN RAISE EXCEPTION 'Solo el creador original puede eliminar el grupo'; END IF;
  UPDATE profiles SET codigo_grupo = NULL, role = 'member' WHERE codigo_grupo = v_group.codigo_union;
  DELETE FROM grupos WHERE group_id = v_group.group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kick_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me RECORD;
  v_target RECORD;
  v_group RECORD;
BEGIN
  SELECT * INTO v_me FROM profiles WHERE id = auth.uid();
  IF v_me.codigo_grupo IS NULL THEN RAISE EXCEPTION 'No tienes grupo'; END IF;
  IF v_me.role NOT IN ('creator', 'admin_total') THEN RAISE EXCEPTION 'No tienes permisos'; END IF;
  SELECT * INTO v_target FROM profiles WHERE id = p_member_id;
  IF v_target.codigo_grupo IS NULL OR v_target.codigo_grupo != v_me.codigo_grupo THEN
    RAISE EXCEPTION 'Miembro no encontrado';
  END IF;
  SELECT * INTO v_group FROM grupos WHERE codigo_union = v_me.codigo_grupo;
  IF p_member_id = v_group.admin_id THEN RAISE EXCEPTION 'No puedes expulsar al propietario'; END IF;
  IF p_member_id = auth.uid() THEN RAISE EXCEPTION 'No puedes expulsarte a ti mismo'; END IF;
  UPDATE profiles SET codigo_grupo = NULL, role = 'member' WHERE id = p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_member_role(p_member_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me RECORD;
  v_target RECORD;
BEGIN
  IF p_role NOT IN ('creator', 'admin_total', 'admin_menor', 'member') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  SELECT * INTO v_me FROM profiles WHERE id = auth.uid();
  IF v_me.codigo_grupo IS NULL THEN RAISE EXCEPTION 'No tienes grupo'; END IF;
  IF v_me.role NOT IN ('creator', 'admin_total') THEN RAISE EXCEPTION 'No tienes permisos'; END IF;
  SELECT * INTO v_target FROM profiles WHERE id = p_member_id;
  IF v_target.codigo_grupo IS NULL OR v_target.codigo_grupo != v_me.codigo_grupo THEN
    RAISE EXCEPTION 'Miembro no encontrado';
  END IF;
  IF p_role = 'creator' AND v_me.role != 'creator' THEN
    RAISE EXCEPTION 'Solo el creator actual puede transferir el rol de creator';
  END IF;
  UPDATE profiles SET role = p_role WHERE id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group(text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_group()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.kick_member(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text)     TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET FOR PRODUCT IMAGES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "product_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "product_images_select_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_own" ON storage.objects;

CREATE POLICY "product_images_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product_images_select_all" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product_images_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- ✅ READY. The app should now work end-to-end.
-- ─────────────────────────────────────────────────────────────────────────────
