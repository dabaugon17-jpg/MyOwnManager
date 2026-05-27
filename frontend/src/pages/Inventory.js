import React, { useEffect, useMemo, useState } from "react";
import { Plus, Camera, X, Loader2, Package, ChevronDown, Search, MoreVertical, Pencil, Trash2 } from "lucide-react";
import api, { buildFileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

const CATEGORIES = ["Electrónica", "Moda", "Bolsos", "Joyería", "Hogar", "Otros"];
const ADMIN_ROLES = ["creator", "admin_total"];

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sellTarget, setSellTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("");

  const canManage = ADMIN_ROLES.includes(user?.role);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products?estado=inventario");
      setProducts(data);
    } finally { setLoading(false); }
  };
  const fetchMembers = async () => {
    try { const { data } = await api.get("/groups/members"); setMembers(data); } catch {}
  };

  useEffect(() => { fetchProducts(); fetchMembers(); }, []);

  const categoriesPresent = useMemo(() => {
    const set = new Set();
    products.forEach(p => set.add(p.categoria || "Otros"));
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = !activeCat || (p.categoria || "Otros") === activeCat;
      const matchSearch = !q || p.nombre.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, search, activeCat]);

  const deleteProduct = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/products/${p.product_id}`);
      toast.success("Producto eliminado");
      fetchProducts();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-5xl mx-auto">
      <header className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Inventario</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Stock</h1>
        </div>
        <span data-testid="product-count" className="text-xs text-white/40">{filtered.length} / {products.length}</span>
      </header>

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/>
        <input
          data-testid="input-search"
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
        />
      </div>

      {categoriesPresent.length > 1 && (
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            data-testid="cat-all"
            onClick={() => setActiveCat("")}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${!activeCat ? "bg-white text-black border-white" : "border-white/10 text-white/70 hover:bg-white/5"}`}
          >Todas</button>
          {categoriesPresent.map(c => (
            <button
              key={c}
              data-testid={`cat-${c}`}
              onClick={() => setActiveCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${activeCat === c ? "bg-white text-black border-white" : "border-white/10 text-white/70 hover:bg-white/5"}`}
            >{c}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-white/40"><Loader2 className="animate-spin inline" size={20}/></div>
      ) : filtered.length === 0 ? (
        products.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="text-center py-16 text-white/40 text-sm">No hay productos que coincidan.</div>
        )
      ) : (
        <div data-testid="product-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard
              key={p.product_id}
              product={p}
              canManage={canManage}
              onSell={() => setSellTarget(p)}
              onEdit={() => setEditTarget(p)}
              onDelete={() => deleteProduct(p)}
            />
          ))}
        </div>
      )}

      <button
        data-testid="fab-add"
        onClick={() => setShowAdd(true)}
        aria-label="Añadir producto"
        className="fixed bottom-24 right-4 md:right-8 z-40 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.18)] hover:scale-105 transition-transform"
      >
        <Plus size={24} strokeWidth={2.5}/>
      </button>

      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchProducts(); }} />}
      {editTarget && <EditProductModal product={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchProducts(); }} />}
      {sellTarget && (
        <SellModal product={sellTarget} members={members} onClose={() => setSellTarget(null)} onSold={() => { setSellTarget(null); fetchProducts(); }} />
      )}
    </div>
  );
}

function ProductCard({ product, canManage, onSell, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const img = buildFileUrl(product.foto_url);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <div data-testid={`product-card-${product.product_id}`} className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden flex flex-col group hover:border-white/20 transition-colors">
      <div className="aspect-square bg-[#0A0A0A] relative overflow-hidden">
        {img ? (
          <img src={img} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20"><Package size={40}/></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.batch_total > 1 && (
            <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] tracking-wider">
              {product.batch_index}/{product.batch_total}
            </span>
          )}
          {product.categoria && (
            <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] tracking-wider text-white/80">
              {product.categoria}
            </span>
          )}
        </div>
        {canManage && (
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              data-testid={`menu-${product.product_id}`}
              onClick={() => setMenuOpen(v => !v)}
              className="p-1.5 rounded bg-black/70 backdrop-blur hover:bg-black/90 transition-colors"
              aria-label="Opciones"
            >
              <MoreVertical size={14} className="text-white"/>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 w-32 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
                <button data-testid={`edit-${product.product_id}`} onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2">
                  <Pencil size={12}/> Editar
                </button>
                <button data-testid={`delete-${product.product_id}`} onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                  <Trash2 size={12}/> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h4 className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">{product.nombre}</h4>
        <p className="text-xs text-white/40">Compra: <span className="text-white/80">{fmt(product.precio_compra)}</span></p>
        <button
          data-testid={`sell-btn-${product.product_id}`}
          onClick={onSell}
          className="mt-1 w-full bg-white text-black py-2.5 rounded-lg font-semibold text-xs tracking-[0.2em] hover:bg-white/90 transition-colors"
        >VENDIDO</button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center"><Package className="text-white/40" size={24}/></div>
      <h3 className="font-display text-xl font-medium mb-2">Tu stock está vacío</h3>
      <p className="text-sm text-white/50 mb-5">Añade tu primer producto para empezar a vender</p>
      <button data-testid="empty-add-btn" onClick={onAdd} className="px-5 py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90">+ Añadir producto</button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button data-testid="modal-close" onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5"><X size={16}/></button>
        {children}
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        data-testid="select-categoria"
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-3 pr-9 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
      >
        {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#141414]">{c}</option>)}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40"/>
    </div>
  );
}

function AddProductModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [categoria, setCategoria] = useState("Otros");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      let file_id = null;
      if (file) {
        const fd = new FormData(); fd.append("file", file);
        const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        file_id = data.file_id;
      }
      const cant = Math.max(1, Math.min(parseInt(cantidad || 1, 10), 500));
      const { data } = await api.post("/products", { nombre, precio_compra: parseFloat(precio), file_id, cantidad: cant, categoria });
      toast.success(cant > 1 ? `${data.created} unidades añadidas` : "Producto añadido");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al añadir");
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="font-display text-2xl font-semibold mb-1">Nuevo producto</h3>
      <p className="text-white/50 text-sm mb-5">Si añades varias unidades, se numerarán automáticamente</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs text-white/50 mb-1 block">Foto</span>
          <div className="relative aspect-video bg-black/50 border border-dashed border-white/15 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-white/30">
            {preview ? <img src={preview} alt="preview" className="w-full h-full object-cover"/> : (
              <div className="flex flex-col items-center text-white/40 text-xs"><Camera size={20} className="mb-1"/>Subir imagen</div>
            )}
            <input data-testid="input-file" type="file" accept="image/*" onChange={onPickFile} className="absolute inset-0 opacity-0 cursor-pointer"/>
          </div>
        </label>
        <input
          data-testid="input-product-name"
          required value={nombre} onChange={e=>setNombre(e.target.value)}
          placeholder="Nombre del producto (ej. MacBook Pro 14)"
          className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
        />
        <CategorySelect value={categoria} onChange={setCategoria} />
        <div className="grid grid-cols-2 gap-3">
          <input
            data-testid="input-product-price"
            required type="number" step="0.01" value={precio} onChange={e=>setPrecio(e.target.value)}
            placeholder="Precio compra (€)"
            className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
          />
          <input
            data-testid="input-product-cantidad"
            required type="number" min="1" max="500" value={cantidad} onChange={e=>setCantidad(e.target.value)}
            placeholder="Cantidad"
            className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
          />
        </div>
        {cantidad > 1 && (
          <p className="text-[11px] text-white/40 -mt-1">Se crearán {cantidad} unidades: {nombre || "Producto"} #1, #2, … #{cantidad}</p>
        )}
        <button data-testid="submit-product" disabled={busy} type="submit"
          className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 disabled:opacity-60">
          {busy ? "Subiendo..." : "Añadir al inventario"}
        </button>
      </form>
    </Modal>
  );
}

function EditProductModal({ product, onClose, onSaved }) {
  const [nombre, setNombre] = useState(product.nombre);
  const [precio, setPrecio] = useState(product.precio_compra);
  const [categoria, setCategoria] = useState(product.categoria || "Otros");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/products/${product.product_id}`, {
        nombre, precio_compra: parseFloat(precio), categoria,
      });
      toast.success("Producto actualizado");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="font-display text-2xl font-semibold mb-4">Editar producto</h3>
      <form onSubmit={save} className="space-y-3">
        <input
          data-testid="input-edit-name"
          required value={nombre} onChange={e=>setNombre(e.target.value)}
          className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
        />
        <CategorySelect value={categoria} onChange={setCategoria} />
        <input
          data-testid="input-edit-price"
          required type="number" step="0.01" value={precio} onChange={e=>setPrecio(e.target.value)}
          className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
        />
        <button data-testid="save-product-edit" disabled={busy} type="submit"
          className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 disabled:opacity-60">
          {busy ? "..." : "Guardar cambios"}
        </button>
      </form>
    </Modal>
  );
}

function SellModal({ product, members, onClose, onSold }) {
  const { user } = useAuth();
  const [precio, setPrecio] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (vendedor) return;
    const def = members.find(m => m.user_id === user?.user_id)?.user_id || members[0]?.user_id;
    if (def) setVendedor(def);
  }, [members, user, vendedor]);

  const confirm = async () => {
    setBusy(true);
    try {
      await api.put(`/products/${product.product_id}/sell`, {
        precio_venta: parseFloat(precio),
        vendedor_id: vendedor || undefined,
      });
      toast.success(`${product.nombre} vendido`);
      onSold();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error al vender"); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="font-display text-2xl font-semibold mb-1">Registrar venta</h3>
      <p className="text-white/50 text-sm mb-4">{product.nombre} · Compra: {fmt(product.precio_compra)}</p>

      <label className="block mb-3">
        <span className="text-[11px] tracking-[0.2em] uppercase text-white/50 mb-1.5 block">Precio de venta</span>
        <input
          data-testid="input-sell-price"
          type="number" step="0.01" autoFocus
          value={precio} onChange={(e) => setPrecio(e.target.value)}
          placeholder="0,00 €"
          className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none"
        />
      </label>

      <label className="block mb-5">
        <span className="text-[11px] tracking-[0.2em] uppercase text-white/50 mb-1.5 block">Vendido por</span>
        <div className="relative">
          <select
            data-testid="select-vendedor"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            className="w-full appearance-none px-3 py-3 pr-9 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
          >
            {members.length === 0 && <option value="">Cargando…</option>}
            {members.map(m => (
              <option key={m.user_id} value={m.user_id} className="bg-[#141414]">
                {m.name || m.email}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40"/>
        </div>
      </label>

      <div className="flex gap-2">
        <button data-testid="cancel-sell" onClick={onClose} className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5">Cancelar</button>
        <button data-testid="confirm-sell" onClick={confirm} disabled={!precio || busy}
          className="flex-1 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50">
          {busy ? "..." : "Confirmar venta"}
        </button>
      </div>
    </Modal>
  );
}
