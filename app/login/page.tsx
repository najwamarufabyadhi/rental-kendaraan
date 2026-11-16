'use client'

import { useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage(){
    const router = useRouter()
    const supabase = createClient()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg(null)

        try {
            //1. verifikasi email & password ke supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) {
                setErrorMsg(authError.message)
                return
            }

            // 2. Ambil data 'Role' user
            const metadataRole = authData.user?.user_metadata?.role as 'customer' | 'vendor' | undefined
            let userRole = metadataRole || 'customer'

            try {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', authData.user.id)
                    .maybeSingle()

                if (profile?.role) {
                    userRole = profile.role
                }

                // Self-Healing: Jika saat daftar memilih 'vendor' tetapi di tabel database profiles
                // tertulis 'customer' (karena default/trigger lama), otomatis perbaiki datanya di database
                if (metadataRole && profile?.role !== metadataRole) {
                    userRole = metadataRole
                    await supabase.from('profiles').upsert({
                        id: authData.user.id,
                        role: metadataRole,
                        full_name: authData.user.user_metadata?.full_name,
                        phone: authData.user.user_metadata?.phone,
                    })
                }
            } catch (err) {
                console.warn('Error sinkronisasi profile:', err)
            }

            // 3. Arahkan ke halaman sesuai role
            if (userRole === 'vendor') {
                router.push('/vendor/dashboard')
            } else {
                router.push('/dashboard')
            }
            router.refresh()
        } catch (err: any) {
            setErrorMsg(err?.message || 'Terjadi kesalahan saat masuk.')
        } finally {
            // Pastikan loading selalu direset ke false agar tombol bisa ditekan kembali
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Masuk ke Akun</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Masukkan email dan password Anda untuk melanjutkan.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Belum punya akun?{' '}
          <Link href="/register" className="text-slate-900 font-semibold underline">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
    )
}


