'use client'

import { useState} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  // Menyimpan data user
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'customer' | 'vendor'>('customer')// default role

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
              data: {
                  full_name: fullName,
                  phone: phone,
                  role: role,
              },
          },
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      // Jika user langsung aktif (email confirmation disabled), simpan ke tabel profiles
      if (authData?.user) {
        try {
          await supabase.from('profiles').upsert({
            id: authData.user.id,
            full_name: fullName,
            phone: phone,
            role: role,
          })
        } catch (err) {
          console.warn('Gagal menyimpan ke tabel profiles:', err)
        }
      }

      alert('Pendaftaran berhasil! Silakan masuk.')
      router.push('/login')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat pendaftaran.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] flex items-center justify-center p-4 md:p-8">
      {/* Kartu Utama Split-Screen Sesuai Desain */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-[640px]">
        
        {/* Sisi Kiri: Form Registrasi dengan Nuansa Biru Tua & Tombol Merah */}
        <div className="bg-gradient-to-b from-[#0F52BA] via-[#1E40AF] to-[#1E3A8A] p-8 md:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-sky-200 mb-4 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
              Pendaftaran Akun
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Bergabung Sekarang
            </h2>
            <p className="text-xs text-blue-100/80 mt-1 mb-5">
              Tentukan jenis akun sesuai kebutuhan Anda.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-100 text-xs flex items-center gap-2">
                <span className="font-bold">✕</span> {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Pemilih Peran / Role */}
              <div className="grid grid-cols-2 gap-2.5 p-1 bg-black/20 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    role === 'customer'
                      ? 'bg-white text-[#0F52BA] shadow-sm'
                      : 'text-blue-100/80 hover:text-white'
                  }`}
                >
                  Saya Penyewa
                </button>
                <button
                  type="button"
                  onClick={() => setRole('vendor')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    role === 'vendor'
                      ? 'bg-white text-[#0F52BA] shadow-sm'
                      : 'text-blue-100/80 hover:text-white'
                  }`}
                >
                  Pemilik Rental
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-blue-100 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/95 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-inner"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-blue-100 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/95 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-inner"
                  placeholder="081234567890"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-blue-100 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/95 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-inner"
                  placeholder="nama@email.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-blue-100 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/95 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-inner"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all transform active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Mendaftarkan Akun...' : 'Daftar Sekarang'}
              </button>
            </form>
          </div>

          <div className="relative z-10 pt-4 mt-4 border-t border-white/10 text-xs text-blue-200/80 text-center">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-white font-bold underline hover:text-rose-300">
              Masuk di sini
            </Link>
          </div>
        </div>

        {/* Sisi Kanan: Panel Putih dengan Branding & Informasi */}
        <div className="hidden md:flex flex-col justify-between items-center p-10 bg-white text-center relative">
          <div className="w-full flex justify-end items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              R
            </div>
            <span className="font-extrabold text-sm tracking-wider text-slate-800">
              RENTAL<span className="text-[#0F52BA]">HUB</span>
            </span>
          </div>

          <div className="my-auto space-y-6 max-w-sm">
            <div className="relative mx-auto w-48 h-40 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-100/60 rounded-full blur-xl"></div>
              <div className="relative bg-gradient-to-br from-[#0F52BA] to-[#1E3A8A] text-white p-6 rounded-3xl shadow-xl shadow-blue-500/20">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-[#0F52BA] tracking-tight">
                SATU SISTEM, SEMUA SOLUSI
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Untuk penyewa: ribuan motor & mobil siap sewa lepas kunci / dengan supir.
                <br />
                Untuk mitra vendor: dasbor manajemen armada & pesanan serah terima digital lengkap.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Aman • Terverifikasi • Transparan
          </div>
        </div>

      </div>
    </div>
  )
}
