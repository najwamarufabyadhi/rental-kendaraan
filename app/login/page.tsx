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
        <div className="min-h-screen bg-[#F0F4F9] flex items-center justify-center p-4 md:p-8">
            {/* Kartu Utama Berbagi Dua Sisi Sesuai Desain */}
            <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-[560px]">
                
                {/* Sisi Kiri: Panel Biru Tua Bergaya Wave dengan Form Login */}
                <div className="bg-gradient-to-b from-[#0F52BA] via-[#1E40AF] to-[#1E3A8A] p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                    {/* Hiasan Pola Wave Halus */}
                    <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-sky-200 mb-6 backdrop-blur-sm">
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                            RentalHub Portal
                        </div>
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            Selamat Datang!
                        </h2>
                        <p className="text-sm text-blue-100/80 mt-1">
                            Masuk untuk mengelola armada atau merental kendaraan impian Anda.
                        </p>

                        {errorMsg && (
                            <div className="mt-4 p-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-100 text-xs flex items-center gap-2">
                                <span className="font-bold">✕</span> {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4 mt-6">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-100 mb-1.5">
                                    Alamat Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-inner"
                                    placeholder="nama@email.com"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-blue-100">
                                        Password
                                    </label>
                                    <span className="text-xs text-blue-200/70 hover:text-white cursor-pointer">
                                        Lupa?
                                    </span>
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-inner"
                                    placeholder="••••••••"
                                />
                            </div>

                            {/* Tombol Merah/Coral Utama Sesuai Referensi */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all transform active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? 'Memeriksa Kredensial...' : 'Masuk Sekarang'}
                            </button>
                        </form>
                    </div>

                    <div className="relative z-10 pt-6 mt-6 border-t border-white/10 text-xs text-blue-200/80 text-center">
                        Belum punya akun?{' '}
                        <Link href="/register" className="text-white font-bold underline hover:text-rose-300">
                            Daftar di sini
                        </Link>
                    </div>
                </div>

                {/* Sisi Kanan: Panel Putih dengan Branding & Ilustrasi */}
                <div className="hidden md:flex flex-col justify-between items-center p-12 bg-white text-center relative">
                    {/* Header Logotype */}
                    <div className="w-full flex justify-end items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            R
                        </div>
                        <span className="font-extrabold text-sm tracking-wider text-slate-800">
                            RENTAL<span className="text-[#0F52BA]">HUB</span>
                        </span>
                    </div>

                    {/* Ilustrasi Vektor Modern */}
                    <div className="my-auto space-y-6">
                        <div className="relative mx-auto w-56 h-48 flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-sky-50 rounded-full blur-xl opacity-70"></div>
                            {/* Ikon Kendaraan & Dasbor Vektor */}
                            <div className="relative bg-gradient-to-br from-[#0F52BA] to-[#1E3A8A] text-white p-7 rounded-3xl shadow-xl shadow-blue-500/20 transform -rotate-3 hover:rotate-0 transition-transform">
                                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                </svg>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-extrabold text-[#0F52BA] tracking-tight">
                                PLATFORM MULTI-VENDOR
                            </h3>
                            <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                                Kelola armada mobil & motor dengan kalender terpadu, anti double-booking, dan serah terima digital.
                            </p>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="text-[11px] text-slate-400">
                        RentalHub Multi-Vendor System • Versi 1.0
                    </div>
                </div>

            </div>
        </div>
    )
}


