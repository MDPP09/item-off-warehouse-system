import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { 
  LogOut, Plus, Printer, Edit3, Boxes, 
  Search, Package, ShoppingCart, Loader2, Trash2, Trash, Settings, XCircle
} from 'lucide-react';

/** * KOMPONEN CETAK LABEL THERMAL */
const ThermalLabel = React.forwardRef<HTMLDivElement, { item: any }>(({ item }, ref) => (
  <div ref={ref} className="print-area p-4 bg-white text-black border border-black font-sans w-[50mm] h-[35mm]">
    <div className="flex justify-between items-start border-b border-black pb-1">
      <span className="font-bold text-[11px]">{item?.id}</span>
      <span className="text-[9px] font-black border border-black px-1 uppercase font-mono tracking-tighter">GR {item?.grade}</span>
    </div>
    <div className="flex py-1.5 gap-2">
      <div className="flex-1 overflow-hidden text-left">
        <div className="text-[12px] font-black uppercase truncate">{item?.tipe}</div>
        <div className="text-[10px] font-bold mt-0.5 text-blue-800">RP {Number(item?.harga || 0).toLocaleString()}</div>
        <div className="text-[7px] leading-tight text-gray-700 mt-1 italic line-clamp-2 border-t pt-1">
          Kondisi: {item?.keterangan || '-'}
        </div>
      </div>
      <div className="border border-black p-0.5 self-center">
        {item?.id && <QRCodeSVG value={item.id} size={40} />}
      </div>
    </div>
    <div className="text-center border-t border-black pt-0.5 text-[7px] font-mono tracking-widest uppercase italic">Warehouse System v5</div>
  </div>
));
ThermalLabel.displayName = "ThermalLabel";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [soldItems, setSoldItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: '', jenis: '', tipe: '', grade: 'A', harga: '', keterangan: '' });

  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        fetchCategories();
        fetchItems();
        fetchSoldItems();
      }
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    if (scanInput.length >= 7) {
      const found = items.find(i => i.id === scanInput.toUpperCase());
      if (found) handleCheckout(scanInput);
    }
  }, [scanInput, items]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (data) {
      setCategories(data);
      if (data.length > 0 && !form.jenis) setForm(prev => ({ ...prev, jenis: data[0].name }));
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const fetchSoldItems = async () => {
    const { data } = await supabase.from('inventory_out').select('*').order('out_at', { ascending: false });
    if (data) setSoldItems(data);
  };

  const handleAddCategory = async () => {
    const name = window.prompt("Nama Kategori Baru:");
    if (!name) return;
    const prefix = window.prompt("Prefix SKU (1-2 Huruf):")?.toUpperCase();
    if (!prefix) return;
    const { error } = await supabase.from('categories').insert([{ name, prefix }]);
    if (error) alert("Gagal: " + error.message);
    else { alert("Kategori ditambahkan!"); fetchCategories(); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await supabase.from('inventory').update({ 
          tipe: form.tipe, grade: form.grade, harga: Number(form.harga), keterangan: form.keterangan 
        }).eq('id', form.id);
      } else {
        const selectedCat = categories.find(c => c.name === form.jenis);
        const prefixCode = selectedCat?.prefix || 'X';
        const brandPart = form.tipe.substring(0, 2).toUpperCase();
        const fullPrefix = `${prefixCode}${brandPart}`;
        const lastItem = [...items].reverse().find(i => i.id.startsWith(fullPrefix));
        const lastNum = lastItem ? parseInt(lastItem.id.replace(fullPrefix, '')) : 0;
        const newID = `${fullPrefix}${String(lastNum + 1).padStart(4, '0')}`;
        await supabase.from('inventory').insert([{ 
          id: newID, jenis: form.jenis, tipe: form.tipe, grade: form.grade, harga: Number(form.harga), keterangan: form.keterangan 
        }]);
      }
      setForm({ id: '', jenis: categories[0]?.name || '', tipe: '', grade: 'A', harga: '', keterangan: '' });
      setIsEditing(false);
      fetchItems();
    } catch (err: any) { alert(err.message); }
  };

  const handleCheckout = async (targetId: string) => {
    const cleanId = targetId.trim().toUpperCase();
    const itemToOut = items.find(i => i.id === cleanId);
    if (itemToOut && confirm(`Checkout unit ${itemToOut.tipe}?`)) {
      await supabase.from('inventory_out').insert([{
        id: itemToOut.id, tipe: itemToOut.tipe, harga: itemToOut.harga, out_at: new Date()
      }]);
      await supabase.from('inventory').delete().eq('id', itemToOut.id);
      setScanInput(""); fetchItems(); fetchSoldItems();
    } else { setScanInput(""); }
  };

  /** * FITUR HAPUS PER ITEM SOLD */
  const handleDeleteSoldItem = async (id: string, tipe: string) => {
    if (window.confirm(`Hapus riwayat penjualan ${tipe} (${id})?`)) {
      const { error } = await supabase.from('inventory_out').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchSoldItems();
    }
  };

  const handleResetDatabase = async () => {
    const passwordConfirm = window.prompt("⚠️ HAPUS SEMUA DATA? Masukkan password login:");
    if (passwordConfirm) {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: passwordConfirm });
      if (error) { alert("Password Salah!"); return; }
      if (window.confirm("Konfirmasi terakhir: Kosongkan database?")) {
        await supabase.from('inventory').delete().neq('id', 'EMPTY');
        await supabase.from('inventory_out').delete().neq('id', 'EMPTY');
        fetchItems(); fetchSoldItems();
      }
    }
  };

  const totalAssetValue = items.reduce((acc, curr) => acc + Number(curr.harga || 0), 0);
  const totalSoldValue = soldItems.reduce((acc, curr) => acc + Number(curr.harga || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 pb-20 text-[13px]">
      <Head><title>Inventory Dashboard</title></Head>

      <nav className="bg-[#131921] p-4 text-white flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-2">
          <Boxes className="text-orange-400" /> ITEM OFF <span className="text-orange-400">Inventory</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={handleResetDatabase} className="p-2 bg-red-600/20 text-red-500 rounded-lg font-bold text-[10px] hover:bg-red-600 hover:text-white transition-all">
            <Trash2 size={16} /> RESET
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="p-2 bg-white/10 rounded-lg hover:bg-red-600 transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-[1400px] mx-auto grid grid-cols-12 gap-6">
        {/* STATS: LIVE CATEGORY SUMMARY */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-8 border-blue-600">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Stock Value</p>
            <p className="text-2xl font-black">Rp {totalAssetValue.toLocaleString()}</p>
          </div>
          {categories.map(cat => (
            <div key={cat.id} className="bg-white p-5 rounded-2xl shadow-sm text-center border-b-4 border-blue-200">
              <p className="text-[10px] font-black text-gray-400 uppercase">{cat.name} Stok</p>
              <p className="text-xl font-black text-blue-700">{items.filter(i => i.jenis === cat.name).length} Unit</p>
            </div>
          ))}
        </div>

        {/* LEFT COLUMN */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* TABLE INVENTORY */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center italic">
              <span className="font-black text-[10px] text-blue-800 uppercase flex items-center gap-2"><Package size={14}/> Stock List</span>
              <input className="bg-white border rounded-full py-1.5 px-4 text-xs w-48 font-mono outline-none focus:border-orange-400" placeholder="AUTO-SCAN..." value={scanInput} onChange={(e) => setScanInput(e.target.value.toUpperCase())} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100 uppercase">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 font-mono font-black text-blue-600 tracking-tighter">{item.id}</td>
                      <td className="p-4">
                        <p className="font-black text-xs text-slate-700">{item.tipe}</p>
                        <p className="text-[9px] text-gray-400 font-bold">RP {Number(item.harga).toLocaleString()} • GR {item.grade}</p>
                        {item.keterangan && <p className="text-[9px] text-orange-600 italic mt-1 bg-orange-50 px-2 py-0.5 rounded-md w-fit">📌 {item.keterangan}</p>}
                      </td>
                      <td className="p-4 flex justify-end gap-2">
                        <button onClick={() => { setSelectedItem(item); setTimeout(() => handlePrint(), 200); }} className="p-2 text-slate-400 hover:text-blue-600"><Printer size={16}/></button>
                        <button onClick={() => { setForm({...item, harga: item.harga.toString()}); setIsEditing(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 text-slate-400 hover:text-green-600"><Edit3 size={16}/></button>
                        <button onClick={() => { if(confirm('Hapus Stok?')) supabase.from('inventory').delete().eq('id', item.id).then(() => fetchItems()) }} className="p-2 text-slate-400 hover:text-red-600"><Trash size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* STATS: SOLD CATEGORY SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-red-600 p-5 rounded-2xl shadow-lg text-white">
              <p className="text-[10px] font-black uppercase opacity-80">Total Sold Revenue</p>
              <p className="text-xl font-black">Rp {totalSoldValue.toLocaleString()}</p>
            </div>
            {categories.map(cat => (
              <div key={cat.id} className="bg-white p-5 rounded-2xl shadow-sm text-center border-b-4 border-red-500">
                <p className="text-[10px] font-black text-gray-400 uppercase">{cat.name} Sold</p>
                <p className="text-lg font-black text-slate-800">{soldItems.filter(s => s.id.startsWith(cat.prefix)).length} Unit</p>
              </div>
            ))}
          </div>

          {/* HISTORY SOLD WITH PER-ITEM DELETE */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden italic">
            <div className="p-4 bg-red-700 text-white font-black text-[10px] uppercase flex items-center gap-2"><ShoppingCart size={14}/> Recent Sold History</div>
            <table className="w-full text-xs uppercase font-mono">
              <tbody className="divide-y divide-gray-50">
                {soldItems.map(sold => (
                  <tr key={sold.id} className="bg-red-50/20 hover:bg-red-50/40 transition-colors">
                    <td className="p-4 font-bold text-gray-400">{sold.id}</td>
                    <td className="p-4 font-black text-slate-600">{sold.tipe}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-red-500 font-black text-[10px]">OUT</span>
                        <button 
                          onClick={() => handleDeleteSoldItem(sold.id, sold.tipe)} 
                          className="p-1 text-gray-300 hover:text-red-600 transition-colors"
                          title="Hapus riwayat ini"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {soldItems.length === 0 && (
                  <tr><td colSpan={3} className="p-10 text-center text-gray-400">Belum ada riwayat penjualan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: FORM */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#232f3e] text-white p-8 rounded-3xl shadow-xl sticky top-24 border border-gray-700">
            <h2 className="text-orange-400 font-black mb-6 flex items-center gap-2 uppercase text-xl border-b border-gray-700 pb-4">
              {isEditing ? <Edit3 size={24}/> : <Plus size={24}/>} {isEditing ? "Modify" : "Add New"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Category</label>
                  <button type="button" onClick={handleAddCategory} className="text-orange-400 text-[10px] font-bold hover:underline flex items-center gap-1"><Settings size={12}/> NEW CATEGORY</button>
                </div>
                <select className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-orange-400" value={form.jenis} onChange={(e) => setForm({...form, jenis: e.target.value})} disabled={isEditing}>
                  {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Brand & Model</label>
                <input className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold uppercase outline-none focus:border-orange-400" required value={form.tipe} onChange={(e) => setForm({...form, tipe: e.target.value})} placeholder="SAMSUNG S24 ULTRA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase">Grade</label>
                  <select className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold outline-none" value={form.grade} onChange={(e) => setForm({...form, grade: e.target.value})}><option>A</option><option>B</option><option>C</option></select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase">Buying Price</label>
                  <input type="number" className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold outline-none" required value={form.harga} onChange={(e) => setForm({...form, harga: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Condition Details</label>
                <textarea className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm h-24 outline-none font-medium text-gray-300" value={form.keterangan} onChange={(e) => setForm({...form, keterangan: e.target.value})} placeholder="KETERANGAN KONDISI..." />
              </div>
              <button type="submit" className="w-full bg-orange-400 hover:bg-orange-50 text-[#131921] font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs active:scale-95">
                {isEditing ? "Update Database" : "Execute Entry"}
              </button>
            </form>
          </div>
        </div>
      </main>

      <div className="hidden"><ThermalLabel ref={contentRef} item={selectedItem} /></div>
    </div>
  );
}