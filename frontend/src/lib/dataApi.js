// ============================================================================
//  dataApi.js — Toda la lógica de negocio del frontend contra Supabase.
//  Reemplaza al antiguo backend FastAPI.
// ============================================================================
import { supabase } from "./supabase";

// ─── Helpers ────────────────────────────────────────────────────────────────

const genProductId = () =>
  `prd_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
const genIncId = () => `inc_${Math.random().toString(36).slice(2, 12)}`;

const PRODUCT_FIELDS =
  "product_id, nombre, precio_compra, precio_venta, estado, foto_url, file_id, categoria, codigo_grupo, created_by, sold_by, sold_by_name, sold_at, batch_index, batch_total, created_at";

const startOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setHours(0, 0, 0, 0);
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  return date;
};

const toUser = (profile) =>
  profile
    ? {
        user_id: profile.id,
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        codigo_grupo: profile.codigo_grupo,
        role: profile.role,
        created_at: profile.created_at,
      }
    : null;

export const buildFileUrl = (url) => url || null;

// ─── Auth / profile ─────────────────────────────────────────────────────────

export const getMyProfile = async () => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile) {
    const payload = {
      id: authUser.id,
      email: authUser.email,
      name:
        authUser.user_metadata?.name ||
        authUser.user_metadata?.full_name ||
        authUser.email,
      picture:
        authUser.user_metadata?.picture || authUser.user_metadata?.avatar_url || null,
    };
    const { data: inserted, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select()
      .single();
    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
    if (inserted) profile = inserted;
    else {
      const { data: again } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      profile = again;
    }
  }

  return toUser(profile);
};

// ─── Groups ─────────────────────────────────────────────────────────────────

export const createGroup = async (nombre_negocio) => {
  const { data, error } = await supabase.rpc("create_group", {
    p_nombre_negocio: nombre_negocio,
  });
  if (error) throw new Error(error.message);
  return data; // { group_id, codigo_union, nombre_negocio }
};

export const joinGroupByCode = async (code) => {
  const { data, error } = await supabase.rpc("join_group_by_code", { p_code: code });
  if (error) throw new Error(error.message);
  return data;
};

export const deleteMyGroup = async () => {
  const { error } = await supabase.rpc("delete_my_group");
  if (error) throw new Error(error.message);
};

export const kickMember = async (memberId) => {
  const { error } = await supabase.rpc("kick_member", { p_member_id: memberId });
  if (error) throw new Error(error.message);
};

export const setMemberRole = async (memberId, role) => {
  const { error } = await supabase.rpc("set_member_role", {
    p_member_id: memberId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
};

export const getMyGroup = async () => {
  const me = await getMyProfile();
  if (!me?.codigo_grupo) return null;
  const { data, error } = await supabase
    .from("grupos")
    .select("*")
    .eq("codigo_union", me.codigo_grupo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

export const updateGroup = async ({ objetivo_mensual }) => {
  const group = await getMyGroup();
  if (!group) throw new Error("Sin grupo");
  const { error } = await supabase
    .from("grupos")
    .update({ objetivo_mensual })
    .eq("group_id", group.group_id);
  if (error) throw new Error(error.message);
};

export const getGroupMembers = async () => {
  const me = await getMyProfile();
  if (!me?.codigo_grupo) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, picture, role, codigo_grupo, created_at")
    .eq("codigo_grupo", me.codigo_grupo)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const group = await getMyGroup();
  return (data || []).map((m) => ({
    user_id: m.id,
    id: m.id,
    email: m.email,
    name: m.name,
    picture: m.picture,
    role: m.role,
    is_owner: group?.admin_id === m.id,
  }));
};

// ─── Products ───────────────────────────────────────────────────────────────

export const listProducts = async (estado = "inventario") => {
  const me = await getMyProfile();
  if (!me?.codigo_grupo) return [];
  let q = supabase
    .from("productos")
    .select(PRODUCT_FIELDS)
    .eq("codigo_grupo", me.codigo_grupo);
  if (estado) q = q.eq("estado", estado);
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
};

export const createProduct = async ({
  nombre,
  precio_compra,
  file_id,
  foto_url,
  cantidad = 1,
  categoria = "Otros",
}) => {
  const me = await getMyProfile();
  if (!me?.codigo_grupo) throw new Error("Sin grupo");
  const cant = Math.max(1, Math.min(parseInt(cantidad || 1, 10), 500));
  const rows = [];
  for (let i = 1; i <= cant; i++) {
    rows.push({
      product_id: genProductId(),
      nombre: cant > 1 ? `${nombre} #${i}` : nombre,
      precio_compra,
      estado: "inventario",
      categoria,
      file_id: file_id || null,
      foto_url: foto_url || null,
      codigo_grupo: me.codigo_grupo,
      created_by: me.user_id,
      batch_index: i,
      batch_total: cant,
    });
  }
  const { error } = await supabase.from("productos").insert(rows);
  if (error) throw new Error(error.message);
  return { created: cant };
};

export const updateProduct = async (productId, payload) => {
  const allowed = ["nombre", "precio_compra", "categoria"];
  const update = {};
  for (const k of allowed) if (k in payload) update[k] = payload[k];
  const { error } = await supabase
    .from("productos")
    .update(update)
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
};

export const deleteProduct = async (productId) => {
  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
};

export const sellProduct = async (productId, { precio_venta, vendedor_id }) => {
  const me = await getMyProfile();
  if (!me) throw new Error("Sin sesión");
  let sold_by_id = me.user_id;
  let sold_by_name = me.name || me.email;
  if (vendedor_id && vendedor_id !== me.user_id) {
    const { data: v } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", vendedor_id)
      .maybeSingle();
    if (v) {
      sold_by_id = v.id;
      sold_by_name = v.name || v.email;
    }
  }
  const { error } = await supabase
    .from("productos")
    .update({
      estado: "vendido",
      precio_venta,
      sold_by: sold_by_id,
      sold_by_name,
      sold_at: new Date().toISOString(),
    })
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
};

// ─── Incidencias ────────────────────────────────────────────────────────────

export const createIncidencia = async (productId, motivo) => {
  const { data: prod, error: e1 } = await supabase
    .from("productos")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!prod) throw new Error("Producto no encontrado");
  const me = await getMyProfile();
  const { error: e2 } = await supabase.from("incidencias").insert({
    incidencia_id: genIncId(),
    product_id: productId,
    codigo_grupo: prod.codigo_grupo,
    motivo: motivo || "Sin especificar",
    producto_nombre: prod.nombre,
    precio_venta: prod.precio_venta,
    created_by: me?.user_id || null,
  });
  if (e2) throw new Error(e2.message);
  const { error: e3 } = await supabase
    .from("productos")
    .update({ estado: "incidencia" })
    .eq("product_id", productId);
  if (e3) throw new Error(e3.message);
};

export const listIncidents = async () => {
  const me = await getMyProfile();
  if (!me?.codigo_grupo) return [];
  const { data, error } = await supabase
    .from("incidencias")
    .select("*")
    .eq("codigo_grupo", me.codigo_grupo)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

export const updateIncident = async (id, { motivo }) => {
  const { error } = await supabase
    .from("incidencias")
    .update({ motivo })
    .eq("incidencia_id", id);
  if (error) throw new Error(error.message);
};

export const deleteIncident = async (id) => {
  const { data: inc } = await supabase
    .from("incidencias")
    .select("product_id")
    .eq("incidencia_id", id)
    .maybeSingle();
    
  if (inc?.product_id) {
    // Al borrar el producto, la regla "ON DELETE CASCADE" de Supabase
    // borrará automáticamente la incidencia. Desaparece de raíz.
    const { error: prodError } = await supabase
      .from("productos")
      .delete()
      .eq("product_id", inc.product_id);
    if (prodError) throw new Error(prodError.message);
  } else {
    // Por si la incidencia fuera "huérfana"
    const { error } = await supabase
      .from("incidencias")
      .delete()
      .eq("incidencia_id", id);
    if (error) throw new Error(error.message);
  }
};

// ─── Sales ──────────────────────────────────────────────────────────────────

export const listSales = async () => {
  const me = await getMyProfile();
  if (!me?.codigo_grupo) return [];
  const { data, error } = await supabase
    .from("productos")
    .select(PRODUCT_FIELDS)
    .eq("codigo_grupo", me.codigo_grupo)
    .eq("estado", "vendido")
    .order("sold_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

export const getSalesStats = async () => {
  const [members, sales] = await Promise.all([getGroupMembers(), listSales()]);
  const byUser = new Map();
  for (const m of members) {
    byUser.set(m.user_id, {
      user_id: m.user_id,
      name: m.name || m.email,
      ventas: 0,
      facturacion: 0,
      beneficio: 0,
    });
  }
  for (const s of sales) {
    const id = s.sold_by;
    if (!id) continue;
    if (!byUser.has(id)) {
      byUser.set(id, {
        user_id: id,
        name: s.sold_by_name || "—",
        ventas: 0,
        facturacion: 0,
        beneficio: 0,
      });
    }
    const r = byUser.get(id);
    r.ventas += 1;
    r.facturacion += s.precio_venta || 0;
    r.beneficio += (s.precio_venta || 0) - (s.precio_compra || 0);
  }
  return {
    members: Array.from(byUser.values()).sort((a, b) => b.facturacion - a.facturacion),
  };
};

// ─── Dashboard ──────────────────────────────────────────────────────────────

export const getDashboard = async ({ filter = "month", vendedor_id = null } = {}) => {
  const empty = {
    facturacion_total: 0,
    beneficio_neto: 0,
    inversion: 0,
    stock_count: 0,
    stock_value: 0,
    facturacion_mes: 0,
    ventas_mes: 0,
    objetivo_mensual: 0,
    progreso_pct: 0,
    chart: [],
  };
  const me = await getMyProfile();
  if (!me?.codigo_grupo) return empty;

  const [{ data: rawProducts, error }, group] = await Promise.all([
    supabase.from("productos").select(PRODUCT_FIELDS).eq("codigo_grupo", me.codigo_grupo),
    getMyGroup(),
  ]);
  if (error) throw new Error(error.message);

  const activeProducts = (rawProducts || []).filter((p) => p.estado !== "incidencia");

  let filtered = activeProducts;
  if (vendedor_id) filtered = filtered.filter((p) => p.sold_by === vendedor_id);

  const sold = filtered.filter((p) => p.estado === "vendido" && p.sold_at);
  const inventory = activeProducts.filter((p) => p.estado === "inventario");

  const facturacion_total = sold.reduce((s, p) => s + (p.precio_venta || 0), 0);
  const inversion = activeProducts.reduce((s, p) => s + (p.precio_compra || 0), 0);
  const beneficio_neto = sold.reduce(
    (s, p) => s + ((p.precio_venta || 0) - (p.precio_compra || 0)),
    0
  );
  const stock_count = inventory.length;
  const stock_value = inventory.reduce((s, p) => s + (p.precio_compra || 0), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSales = sold.filter((p) => new Date(p.sold_at) >= monthStart);
  const facturacion_mes = monthSales.reduce((s, p) => s + (p.precio_venta || 0), 0);
  const ventas_mes = monthSales.length;
  const objetivo_mensual = group?.objetivo_mensual || 0;
  const progreso_pct =
    objetivo_mensual > 0 ? (facturacion_mes / objetivo_mensual) * 100 : 0;

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const chart = [];
  const sumRange = (from, to) =>
    sold
      .filter((p) => {
        const sd = new Date(p.sold_at);
        return sd >= from && sd < to;
      })
      .reduce((s, p) => s + (p.precio_venta || 0), 0);

  if (filter === "day") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      chart.push({ label: dayNames[d.getDay()], value: sumRange(d, next) });
    }
  } else if (filter === "week") {
    const ref = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(ref);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      chart.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, value: sumRange(start, end) });
    }
  } else if (filter === "year") {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      chart.push({ label: String(y), value: sumRange(start, end) });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      chart.push({ label: monthNames[start.getMonth()], value: sumRange(start, end) });
    }
  }

  return {
    facturacion_total,
    beneficio_neto,
    inversion,
    stock_count,
    stock_value,
    facturacion_mes,
    ventas_mes,
    objetivo_mensual,
    progreso_pct,
    chart,
  };
};

// ─── File upload (Supabase Storage) ────────────────────────────────────────

export const uploadProductImage = async (file) => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("Sin sesión");
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${authUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });
  if (error) throw new Error(error.message);
  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);
  return { file_id: path, foto_url: publicUrl };
};

// ─── CSV export ────────────────────────────────────────────────────────────

export const exportSalesCSV = async () => {
  const sales = await listSales();
  const rows = [
    [
      "Producto",
      "Categoria",
      "Fecha venta",
      "Vendedor",
      "Precio compra",
      "Precio venta",
      "Beneficio",
    ],
  ];
  for (const s of sales) {
    rows.push([
      s.nombre,
      s.categoria || "",
      s.sold_at ? new Date(s.sold_at).toLocaleString("es-ES") : "",
      s.sold_by_name || "",
      (s.precio_compra || 0).toFixed(2).replace(".", ","),
      (s.precio_venta || 0).toFixed(2).replace(".", ","),
      ((s.precio_venta || 0) - (s.precio_compra || 0)).toFixed(2).replace(".", ","),
    ]);
  }
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const v = String(c ?? "");
          return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(";")
    )
    .join("\n");
  return new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
};
