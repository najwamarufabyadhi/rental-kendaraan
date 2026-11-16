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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Daftar Akun</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Pilih jenis akun yang sesuai dengan kebutuhan Anda.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Pemilih Peran */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`p-3 rounded-lg border text-sm font-medium ${
                role === 'customer'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Saya Penyewa
            </button>
            <button
              type="button"
              onClick={() => setRole('vendor')}
              className={`p-3 rounded-lg border text-sm font-medium ${
                role === 'vendor'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Pemilik Rental
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              placeholder="Contoh: Andi Wijaya"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nomor WhatsApp
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              placeholder="08123456789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              placeholder="nama@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-slate-900 font-semibold underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  )
}
