// Supabase has been removed in favor of the backend MongoDB auth.
// This file is kept as a stub so any stale imports don't crash the bundle.

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    signUp: async () => { throw new Error("Supabase deshabilitado"); },
    signInWithPassword: async () => { throw new Error("Supabase deshabilitado"); },
    signInWithOAuth: async () => { throw new Error("Supabase deshabilitado"); },
    getUser: async () => ({ data: { user: null } }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: new Error("Supabase deshabilitado") }),
      }),
    }),
  }),
};

export const getCurrentUser = async () => null;
export const getUserProfile = async () => { throw new Error("Supabase deshabilitado"); };
export const signUp = async () => { throw new Error("Supabase deshabilitado"); };
export const signIn = async () => { throw new Error("Supabase deshabilitado"); };
export const signOut = async () => {};
export const signInWithGoogle = async () => { throw new Error("Supabase deshabilitado"); };
