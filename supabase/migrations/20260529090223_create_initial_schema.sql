/*
  # Create users table

  1. New Tables
    - `profiles` (extends Supabase auth.users)
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `name` (text)
      - `picture` (text, URL to profile picture)
      - `codigo_grupo` (text, references grupos.codigo_union)
      - `role` (text: creator | admin_total | admin_menor | member)
      - `created_at` (timestamp)
    
    - `grupos` (business groups)
      - `group_id` (text, primary key)
      - `nombre_negocio` (text, name of the business)
      - `codigo_union` (text, unique, 6-char invite code)
      - `admin_id` (uuid, references profiles.id, original creator)
      - `objetivo_mensual` (numeric, monthly target)
      - `created_at` (timestamp)
    
    - `productos` (inventory items)
      - `product_id` (text, primary key)
      - `nombre` (text, product name)
      - `precio_compra` (numeric, purchase price)
      - `precio_venta` (numeric, sale price, nullable)
      - `estado` (text: inventario | vendido | incidencia)
      - `foto_url` (text, image URL)
      - `file_id` (text, reference to storage)
      - `categoria` (text, default 'Otros')
      - `codigo_grupo` (text, references grupos.codigo_union)
      - `created_by` (uuid, references profiles.id)
      - `sold_by` (uuid, references profiles.id)
      - `sold_by_name` (text)
      - `sold_at` (timestamp)
      - `batch_index` (integer)
      - `batch_total` (integer)
      - `created_at` (timestamp)
    
    - `incidencias` (issues/returns)
      - `incidencia_id` (text, primary key)
      - `product_id` (text, references productos.product_id)
      - `codigo_grupo` (text, references grupos.codigo_union)
      - `motivo` (text, reason for incident)
      - `producto_nombre` (text)
      - `precio_venta` (numeric)
      - `created_by` (uuid, references profiles.id)
      - `created_at` (timestamp)
    
    - `files` (uploaded images)
      - `file_id` (text, primary key)
      - `storage_path` (text)
      - `original_filename` (text)
      - `content_type` (text)
      - `size` (integer)
      - `owner_id` (uuid, references profiles.id)
      - `is_deleted` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users to access their own data and group data
*/

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  picture text,
  codigo_grupo text,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

-- Create grupos table
CREATE TABLE IF NOT EXISTS grupos (
  group_id text PRIMARY KEY,
  nombre_negocio text NOT NULL,
  codigo_union text UNIQUE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  objetivo_mensual numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create productos table
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

-- Create incidencias table
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

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  file_id text PRIMARY KEY,
  storage_path text NOT NULL,
  original_filename text,
  content_type text,
  size integer,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Grupos policies (members can view/edit their group)
CREATE POLICY "Group members can view their group"
  ON grupos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = grupos.codigo_union
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Group creators can insert groups"
  ON grupos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Group admins can update groups"
  ON grupos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = grupos.codigo_union
      AND profiles.id = auth.uid()
      AND profiles.role IN ('creator', 'admin_total')
    )
  );

CREATE POLICY "Group creators can delete groups"
  ON grupos FOR DELETE
  TO authenticated
  USING (auth.uid() = admin_id);

-- Productos policies (group members can access their products)
CREATE POLICY "Group members can view products"
  ON productos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = productos.codigo_grupo
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Group members can insert products"
  ON productos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = productos.codigo_grupo
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Group admins can update products"
  ON productos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = productos.codigo_grupo
      AND profiles.id = auth.uid()
      AND profiles.role IN ('creator', 'admin_total')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = productos.codigo_grupo
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Group admins can delete products"
  ON productos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = productos.codigo_grupo
      AND profiles.id = auth.uid()
      AND profiles.role IN ('creator', 'admin_total')
    )
  );

CREATE POLICY "Group members can update product status"
  ON productos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = productos.codigo_grupo
      AND profiles.id = auth.uid()
    )
  );

-- Incidencias policies
CREATE POLICY "Group members can view incidents"
  ON incidencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = incidencias.codigo_grupo
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Group members can create incidents"
  ON incidencias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = incidencias.codigo_grupo
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Group admins can update incidents"
  ON incidencias FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = incidencias.codigo_grupo
      AND profiles.id = auth.uid()
      AND profiles.role IN ('creator', 'admin_total', 'admin_menor')
    )
  );

CREATE POLICY "Group admins can delete incidents"
  ON incidencias FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.codigo_grupo = incidencias.codigo_grupo
      AND profiles.id = auth.uid()
      AND profiles.role IN ('creator', 'admin_total')
    )
  );

-- Files policies
CREATE POLICY "Users can view own files"
  ON files FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can upload files"
  ON files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own files"
  ON files FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_codigo_grupo ON profiles(codigo_grupo);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_grupo ON productos(codigo_grupo);
CREATE INDEX IF NOT EXISTS idx_productos_estado ON productos(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_codigo_grupo ON incidencias(codigo_grupo);
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, picture)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'picture'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
