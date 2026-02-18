import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import { Boxes, Lock, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Fungsi untuk menangani proses masuk
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Akses Ditolak: " + error.message);
    } else {
      router.push('/'); // Lempar ke dashboard jika sukses
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#131921] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-[#232f3e] rounded-3xl p-10 shadow-2xl border border-gray-700">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4 text-orange-400">
            <Boxes size={50} />
          </div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tighter italic">
            ITEM OFF <span className="text-orange-400">Inventory</span>
          </h1>
          <p className="text-gray-400 text-[10px] mt-2 uppercase tracking-[0.2em] font-bold">Warehouse Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-600" size={18} />
              <input 
                type="email" 
                className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 pl-10 text-white text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                placeholder="admin@warehouse.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 block mb-1 uppercase tracking-widest">Secret Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-600" size={18} />
              <input 
                type="password" 
                className="w-full bg-[#131921] border border-gray-600 rounded-xl p-3 pl-10 text-white text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit" 
            className="w-full bg-orange-400 hover:bg-orange-500 text-[#131921] font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-widest shadow-lg flex justify-center items-center gap-2 active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Authorize Access"}
          </button>
        </form>
      </div>
    </div>
  );
}