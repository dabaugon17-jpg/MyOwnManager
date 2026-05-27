import React, { useEffect, useState } from "react";
import { Plus, Camera, X, Loader2, Package } from "lucide-react";
import api, { buildFileUrl } from "../lib/api";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sellTarget, setSellTarget] = useState(null);
  const [sellPrice, setSellPrice] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products?estado=inventario");
      setProducts(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const confirmSell = async () => {
    if (!sellTarget) return;
    try {
      await api.put(`/products/${sellTarget.product_id}/sell`, { precio_venta: parseFloat(sellPrice) });
      toast.success(`${sellTarget.nombre} vendido`);
      setSellTarget(null); setSellPrice("");
      fetchProducts();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al vender");
    }
  };

  return (
    <div className="px-4 md:px-8 pt-6 pb-32 max-w-5xl mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">Inventario</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-1">Stock</h1>
        </div>
        <span data-testid="product-count" className="text-xs text-white/40">{products.length} producto{products.length !== 1 ? "s" : ""}</span>
      </header>

      {loading ? (
        <div className="text-center py-16 text-white/40"><Loader2 className="animate-spin inline" size={20}/></div>
      ) : products.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div data-testid="product-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <ProductCard key={p.product_id} product={p} onSell={() => { setSellTarget(p); setSellPrice(""); }} />
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

      {sellTarget && (
        <Modal onClose={() => setSellTarget(null)}>
          <h3 className="font-display text-2xl font-semibold mb-1">Vender</h3>
          <p className="text-white/50 text-sm mb-4">{sellTarget.nombre} · Compra: {fmt(sellTarget.precio_compra)}</p>
          <input
            data-testid="input-sell-price"
            type="number" step="0.01" autoFocus
            value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
            placeholder="Precio de venta (€)"
            className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none mb-4"
          />
          <div className="flex gap-2">
            <button data-testid="cancel-sell" onClick={() => setSellTarget(null)} className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5">Cancelar</button>
            <button data-testid="confirm-sell" onClick={confirmSell} disabled={!sellPrice} className="flex-1 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50">Confirmar venta</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProductCard({ product, onSell }) {
  const img = buildFileUrl(product.foto_url);
  return (
    <div data-testid={`product-card-${product.product_id}`} className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden flex flex-col group hover:border-white/20 transition-colors">
      <div className="aspect-square bg-[#0A0A0A] relative overflow-hidden">
        {img ? (
          <img src={img} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20"><Package size={40}/></div>
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
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button data-testid="modal-close" onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5"><X size={16}/></button>
        {children}
      </div>
    </div>
  );
}

function AddProductModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
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
      await api.post("/products", { nombre, precio_compra: parseFloat(precio), file_id });
      toast.success("Producto añadido");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al añadir");
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="font-display text-2xl font-semibold mb-1">Nuevo producto</h3>
      <p className="text-white/50 text-sm mb-5">Añade un artículo a tu inventario</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs text-white/50 mb-1 block">Foto</span>
          <div className="relative aspect-video bg-black/50 border border-dashed border-white/15 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-white/30">
            {preview ? (
              <img src={preview} alt="preview" className="w-full h-full object-cover"/>
            ) : (
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
        <input
          data-testid="input-product-price"
          required type="number" step="0.01" value={precio} onChange={e=>setPrecio(e.target.value)}
          placeholder="Precio de compra (€)"
          className="w-full px-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm"
        />
        <button data-testid="submit-product" disabled={busy} type="submit"
          className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 disabled:opacity-60">
          {busy ? "Subiendo..." : "Añadir al inventario"}
        </button>
      </form>
    </Modal>
  );
}
