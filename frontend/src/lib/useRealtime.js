import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Subscribe to Postgres changes for a given table, filtered by codigo_grupo.
 * Calls `onChange()` (debounced) whenever an INSERT/UPDATE/DELETE happens
 * on rows that belong to the current user's group.
 *
 * Requires that the table is added to the `supabase_realtime` publication:
 *   ALTER PUBLICATION supabase_realtime ADD TABLE productos, incidencias;
 */
export function useRealtime(table, codigoGrupo, onChange) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!codigoGrupo) return undefined;
    let pending = null;
    const fire = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        cbRef.current?.();
      }, 250); // debounce burst updates
    };

    const channel = supabase
      .channel(`${table}-${codigoGrupo}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `codigo_grupo=eq.${codigoGrupo}`,
        },
        fire
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [table, codigoGrupo]);
}
