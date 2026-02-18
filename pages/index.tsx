import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { 
  LogOut, Plus, Printer, Edit3, Boxes, History, 
  Search, Package, TrendingUp, ShoppingCart 
} from 'lucide-react';

/** * KOMPONEN CETAK LABEL THERMAL 
 */
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
  
  // -- STATE MANAGEMENT --
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [soldItems, setSoldItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: '', jenis: 'Handphone', tipe: '', grade: 'A', harga: '', keterangan: '' });

  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef });

  /** * 1. PROTEKSI AUTH & FETCH DATA
   */
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login'); // Tendang ke login jika tidak ada session
      } else {
        setUser(session.user);
        fetchItems();
        fetchSoldItems();
      }
    };
    checkUser();
  }, [router]);

  /** * 2. AUTO-SCAN LOGIC
   */
  useEffect(() => {
    if (scanInput.length >= 7) {
      const found = items.find(i => i.id === scanInput.toUpperCase());
      if (found) handleCheckout(scanInput);
    }
  }, [scanInput]);

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

  /** * 3. LOGIKA STATISTIK
   */
  const totalAssetValue = items.reduce((acc, curr) => acc + Number(curr.harga || 0), 0);
  const countByCategory = (cat: string) => items.filter(item => item.jenis === cat).length;
  const totalSoldValue = soldItems.reduce((acc, curr) => acc + Number(curr.harga || 0), 0);
  const countSoldByCategory = (catPrefix: string) => soldItems.filter(item => item.id.startsWith(catPrefix)).length;

  /** * 4. CRUD & CHECKOUT FUNCTIONS
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await supabase.from('inventory').update({ 
          tipe: form.tipe, grade: form.grade, harga: Number(form.harga), keterangan: form.keterangan 
        }).eq('id', form.id);
      } else {
        const firstChar = form.jenis.charAt(0).toUpperCase();
        const brandChars = form.tipe.substring(0, 2).toUpperCase();
        const prefix = `${firstChar}${brandChars}`;
        const lastItem = [...items].reverse().find(i => i.id.startsWith(prefix));
        const lastNum = lastItem ? parseInt(lastItem.id.replace(prefix, '')) : 0;
        const newID = `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
        
        await supabase.from('inventory').insert([{ 
          id: newID, jenis: form.jenis, tipe: form.tipe, grade: form.grade, harga: Number(form.harga), keterangan: form.keterangan 
        }]);
      }
      setForm({ id: '', jenis: 'Handphone', tipe: '', grade: 'A', harga: '', keterangan: '' });
      setIsEditing(false);
      fetchItems();
    } catch (err: any) { alert(err.message); }
  };

  const handleCheckout = async (targetId: string) => {
    const cleanId = targetId.trim().toUpperCase();
    const itemToOut = items.find(i => i.id === cleanId);
    
    if (itemToOut) {
      if (confirm(`AUTO-SCAN DETECTED: Keluar barang ${itemToOut.tipe}?`)) {
        await supabase.from('inventory_out').insert([{
          id: itemToOut.id, tipe: itemToOut.tipe, harga: itemToOut.harga, out_at: new Date()
        }]);
        await supabase.from('inventory').delete().eq('id', itemToOut.id);
        setScanInput("");
        fetchItems();
        fetchSoldItems();
      } else { setScanInput(""); }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user) return <div className="h-screen bg-[#131921]"></div>;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans pb-20 text-[13px]">
      <Head><title>Dashboard | ITEM OFF INVENTORY</title></Head>

      {/* NAVBAR */}
      <nav className="bg-[#131921] p-4 text-white flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-black flex items-center gap-2 italic uppercase tracking-tighter">
          <Boxes className="text-orange-400" /> ITEM OFF <span className="text-orange-400">Inventory</span>
        </h1>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
            <input 
              className="bg-[#232f3e] border border-gray-600 rounded-full py-2 px-10 text-xs w-64 focus:border-orange-400 outline-none font-mono text-orange-400"
              placeholder="AUTO-SCAN SKU..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>
          <button onClick={handleSignOut} className="bg-red-600/20 text-red-500 p-2 rounded-lg hover:bg-red-600 hover:text-white transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-[1400px] mx-auto grid grid-cols-12 gap-6">
        
        {/* STATS BARIS 1: LIVE STOK */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-8 border-blue-600">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Stock Value</p>
            <p className="text-2xl font-black">Rp {totalAssetValue.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">HP Stok</p>
            <p className="text-xl font-black text-blue-700">{countByCategory('Handphone')} Unit</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">LAP Stok</p>
            <p className="text-xl font-black text-blue-700">{countByCategory('Laptop')} Unit</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">TAB Stok</p>
            <p className="text-xl font-black text-blue-700">{countByCategory('Tablet')} Unit</p>
          </div>
        </div>

        {/* KOLOM KIRI: Tabel Stok & Riwayat */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b font-black text-[10px] text-blue-800 uppercase flex items-center gap-2 italic">
              <Package size={14}/> Live Inventory List
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase border-b">
                <tr><th className="p-4 text-left">SKU ID</th><th className="p-4 text-left">Product Detail</th><th className="p-4">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 uppercase">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/30">
                    <td className="p-4 font-mono font-black text-blue-600 tracking-tighter">{item.id}</td>
                    <td className="p-4">
                      <p className="font-black text-xs text-slate-700">{item.tipe}</p>
                      <p className="text-[9px] text-gray-400 font-bold">RP {Number(item.harga).toLocaleString()} • GR {item.grade}</p>
                      {item.keterangan && <p className="text-[9px] text-orange-600 italic mt-1 font-medium bg-orange-50 px-2 py-0.5 rounded-md w-fit">📌 {item.keterangan}</p>}
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => { setSelectedItem(item); setTimeout(() => handlePrint(), 200); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white"><Printer size={16}/></button>
                      <button onClick={() => { setForm({...item, harga: item.harga.toString()}); setIsEditing(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 bg-slate-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white"><Edit3 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* STATS PENJUALAN & RIWAYAT TERJUAL */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-black">
              <div className="bg-red-600 text-white p-4 rounded-xl shadow-md">
                <p className="text-[9px] uppercase opacity-80 flex items-center gap-1"><TrendingUp size={10}/> Total Out Value</p>
                <p className="text-lg">Rp {totalSoldValue.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-red-100 p-4 rounded-xl text-center shadow-sm">
                <p className="text-[9px] text-gray-400 uppercase tracking-tighter">HP Sold</p>
                <p className="text-lg text-red-600">{countSoldByCategory('H')}</p>
              </div>
              <div className="bg-white border border-red-100 p-4 rounded-xl text-center shadow-sm">
                <p className="text-[9px] text-gray-400 uppercase tracking-tighter">LAP Sold</p>
                <p className="text-lg text-red-600">{countSoldByCategory('L')}</p>
              </div>
              <div className="bg-white border border-red-100 p-4 rounded-xl text-center shadow-sm">
                <p className="text-[9px] text-gray-400 uppercase tracking-tighter">TAB Sold</p>
                <p className="text-lg text-red-600">{countSoldByCategory('T')}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-red-700 text-white font-black text-[10px] uppercase flex items-center gap-2">
                <ShoppingCart size={14}/> Recent Sold History
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs uppercase">
                  <tbody className="divide-y divide-gray-50 italic">
                    {soldItems.map(sold => (
                      <tr key={sold.id} className="bg-red-50/10">
                        <td className="p-4 font-mono font-bold text-gray-400">{sold.id}</td>
                        <td className="p-4 font-black text-slate-600">{sold.tipe}</td>
                        <td className="p-4 text-right text-red-500 font-black">SOLD</td>
                        <td className="p-4 text-right text-[9px] text-gray-400 font-mono italic">
                          {new Date(sold.out_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Inbound Form */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#232f3e] text-white p-8 rounded-3xl shadow-xl sticky top-24 border border-gray-700">
            <h2 className="text-orange-400 font-black mb-6 flex items-center gap-2 uppercase tracking-tighter text-xl border-b border-gray-700 pb-4">
              {isEditing ? <Edit3 size={24}/> : <Plus size={24}/>} 
              {isEditing ? "Modify Unit" : "Add New Item"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Category</label>
                  <select className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-orange-400 transition-all" value={form.jenis} onChange={(e) => setForm({...form, jenis: e.target.value})} disabled={isEditing}>
                    <option>Handphone</option><option>Laptop</option><option>Tablet</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Grade</label>
                  <select className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold outline-none" value={form.grade} onChange={(e) => setForm({...form, grade: e.target.value})}><option>A</option><option>B</option><option>C</option></select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Brand & Model</label>
                <input className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold uppercase outline-none" required value={form.tipe} onChange={(e) => setForm({...form, tipe: e.target.value})} placeholder="SAMSUNG S24 ULTRA" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Buying Price</label>
                <input type="number" className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm font-bold outline-none" required value={form.harga} onChange={(e) => setForm({...form, harga: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Condition Details</label>
                <textarea className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 text-sm h-24 outline-none font-medium text-gray-300" value={form.keterangan} onChange={(e) => setForm({...form, keterangan: e.target.value})} placeholder="Misal: Screen shadow tipis, bazel dent..." />
              </div>
              <button type="submit" className="w-full bg-orange-400 hover:bg-orange-500 text-[#131921] font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs active:scale-95">
                {isEditing ? "Update Database" : "Execute Entry"}
              </button>
              {isEditing && (
                <button type="button" onClick={() => { setIsEditing(false); setForm({id:'', jenis:'Handphone', tipe:'', grade:'A', harga:'', keterangan:''}); }} className="w-full text-[10px] text-gray-500 mt-2 underline italic">Discard Changes</button>
              )}
            </form>
          </div>
        </div>
      </main>

      {/* Hidden Thermal Printer Area */}
      <div className="hidden">
        <ThermalLabel ref={contentRef} item={selectedItem} />
      </div>
    </div>
  );
}