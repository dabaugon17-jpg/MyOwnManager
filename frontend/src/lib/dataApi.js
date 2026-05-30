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
    // Fallback: in case the trigger didn't run (shouldn't happen, but safe)
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
      // 23505 = unique violation (already exists); ignore
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

export const updateGroup = async ({ objetivo_
