'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Mendefinisikan struktur bentuk data Vendor untuk TypeScript
interface VendorProfile {
  id: string
  business_name: string
  city: string
  address: string
  phone: string
}

export default function VendorDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [stats, setStats] = useState({
    totalArmada: 0,
    totalPendapatan: 0,
    sewaBerjalan: 0,
    selesai: 0,
  })

  // State untuk form profil usaha (jika belum punya)
  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  // 1. Dijalankan otomatis saat halaman pertama kali dibuka
  useEffect(() => {
    const fetchVendorProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Cek apakah user ini sudah terdaftar di tabel 'vendors'
      const { data } = await supabase
        .from('vendors')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (data) {
        setVendor(data)

        // Ambil statistik armada
        const { count: armadaCount } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_id', data.id)

        // Ambil statistik pesanan
        const { data: bookingList } = await supabase
          .from('bookings')
          .select('base_price, status')
          .eq('vendor_id', data.id)

        if (bookingList) {
          const totalIncome = bookingList.reduce((acc, curr) => acc + (curr.base_price || 0), 0)
          const inUseCount = bookingList.filter((b) => b.status === 'in_use' || b.status === 'confirmed').length
          const completedCount = bookingList.filter((b) => b.status === 'completed').length

          setStats({
            totalArmada: armadaCount || 0,
            totalPendapatan: totalIncome,
            sewaBerjalan: inUseCount,
            selesai: completedCount,
          })
        }
      }
      setLoading(false)
    }

    fetchVendorProfile()
  }, [router, supabase])

  // 2. Fungsi untuk menyimpan profil usaha baru ke Supabase
  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        owner_id: user.id,
        business_name: businessName,
        city: city,
        address: address,
        phone: phone,
      })
      .select()
      .single()

    if (error) {
      alert('Gagal menyimpan profil usaha: ' + error.message)
      setSaving(false)
      return
    }

    // Simpan data yang baru dibuat ke state agar tampilan langsung berubah
    setVendor(data)
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Tampilan saat sedang mengambil data dari Supabase
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F9]">
        <p className="text-slate-500 font-medium">Memuat data dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] flex flex-col md:flex-row">

      {/* SIDEBAR NAVIGASI BIRU TUA (Sesuai Desain di Gambar) */}
      <aside className="w-full md:w-64 bg-gradient-to-b from-[#0F52BA] via-[#1E40AF] to-[#1E3A8A] text-white flex flex-col justify-between p-5 md:p-6 shadow-xl shrink-0">
        <div>
          {/* Logo & Judul Brand */}
          <div className="flex items-center gap-3 pb-6 border-b border-white/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-red-500/30">
              R
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-wider leading-none">
                RENTAL<span className="text-sky-300">HUB</span>
              </h2>
              <span className="text-[10px] text-blue-200 uppercase tracking-widest">
                Vendor Console
              </span>
            </div>
          </div>

          {/* Menu Navigasi */}
          <nav className="mt-6 space-y-1.5">
            <Link
              href="/vendor/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/15 text-white font-bold text-sm shadow-sm backdrop-blur-sm border border-white/10"
            >
              <span className="text-lg">📊</span>
              <span>Dashboard</span>
            </Link>

            <Link
              href="/vendor/armada"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white font-medium text-sm transition"
            >
              <span className="text-lg">🚗</span>
              <span>Kelola Armada</span>
              {stats.totalArmada > 0 && (
                <span className="ml-auto text-[11px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {stats.totalArmada}
                </span>
              )}
            </Link>

            <Link
              href="/vendor/bookings"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white font-medium text-sm transition"
            >
              <span className="text-lg">📑</span>
              <span>Pesanan Masuk</span>
              {stats.sewaBerjalan > 0 && (
                <span className="ml-auto text-[11px] bg-sky-400 text-slate-900 px-2 py-0.5 rounded-full font-bold">
                  {stats.sewaBerjalan}
                </span>
              )}
            </Link>

            <Link
              href="/vendor/reports"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white font-medium text-sm transition"
            >
              <span className="text-lg">📈</span>
              <span>Rekap Bulanan</span>
              <span className="ml-auto text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
                Laporan
              </span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white font-medium text-sm transition"
            >
              <span className="text-lg">🏪</span>
              <span>Katalog Marketplace</span>
            </Link>
          </nav>
        </div>

        {/* Tombol Logout di Bawah Sidebar */}
        <div className="pt-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white font-semibold text-xs transition border border-rose-400/20"
          >
            <span>🚪</span> Keluar Sesi
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">

        {/* Top Header Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 bg-blue-50 text-[#0F52BA] rounded-full mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Sistem Operasional Aktif
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {vendor ? vendor.business_name : 'Lengkapi Profil Usaha'}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="px-3 py-1.5 bg-slate-100 rounded-lg font-medium text-slate-700">
              📅 16 Nov 2026
            </span>
            <span className="px-3 py-1.5 bg-blue-100 text-[#0F52BA] font-bold rounded-lg">
              Mitra Rental
            </span>
          </div>
        </div>

        {/* 4 KARTU METRIK WARNA (Analitics Characteristic Sesuai Desain Gambar) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Merah / Rose (Total Pendapatan) */}
          <div className="bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white p-5 rounded-2xl shadow-lg shadow-red-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-rose-100">
                  Total Pendapatan
                </p>
                <h3 className="text-xl md:text-2xl font-black mt-2">
                  Rp {stats.totalPendapatan.toLocaleString('id-ID')}
                </h3>
              </div>
              <span className="p-2.5 rounded-xl bg-white/20 text-lg">💰</span>
            </div>
            <p className="text-[11px] text-rose-100/80 mt-3 font-medium">Akumulasi sewa armada</p>
          </div>

          {/* Card 2: Biru Tua / Royal Blue (Total Armada) */}
          <div className="bg-gradient-to-r from-[#1E40AF] to-[#1D4ED8] text-white p-5 rounded-2xl shadow-lg shadow-blue-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-blue-100">
                  Total Armada
                </p>
                <h3 className="text-xl md:text-2xl font-black mt-2">
                  {stats.totalArmada} Unit
                </h3>
              </div>
              <span className="p-2.5 rounded-xl bg-white/20 text-lg">🚘</span>
            </div>
            <p className="text-[11px] text-blue-100/80 mt-3 font-medium">Mobil & motor terdaftar</p>
          </div>

          {/* Card 3: Cyan / Sky Blue (Sewa Berjalan) */}
          <div className="bg-gradient-to-r from-[#0284C7] to-[#0EA5E9] text-white p-5 rounded-2xl shadow-lg shadow-sky-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-sky-100">
                  Sewa Berjalan
                </p>
                <h3 className="text-xl md:text-2xl font-black mt-2">
                  {stats.sewaBerjalan} Booking
                </h3>
              </div>
              <span className="p-2.5 rounded-xl bg-white/20 text-lg">⏱️</span>
            </div>
            <p className="text-[11px] text-sky-100/80 mt-3 font-medium">Sedang digunakan / dijadwalkan</p>
          </div>

          {/* Card 4: Slate / Steel Grey (Transaksi Selesai) */}
          <div className="bg-gradient-to-r from-[#475569] to-[#64748B] text-white p-5 rounded-2xl shadow-lg shadow-slate-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-200">
                  Sewa Selesai
                </p>
                <h3 className="text-xl md:text-2xl font-black mt-2">
                  {stats.selesai} Trip
                </h3>
              </div>
              <span className="p-2.5 rounded-xl bg-white/20 text-lg">✅</span>
            </div>
            <p className="text-[11px] text-slate-200/80 mt-3 font-medium">Unit telah dikembalikan</p>
          </div>
        </div>

        {/* KONDISI A: Form Isi Profil Usaha Jika Belum Terdaftar */}
        {!vendor ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Lengkapi Informasi Usaha Rental Anda
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Data ini akan menjadi identitas garasi yang dilihat oleh pelanggan di marketplace.
            </p>

            <form onSubmit={handleCreateVendor} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Nama Usaha Rental
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  placeholder="Contoh: Bromo Trans Rental"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Kota Operasional
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  placeholder="Contoh: Malang"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Alamat Lengkap Garasi
                </label>
                <textarea
                  required
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  placeholder="Jl. Soekarno Hatta No. 12..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Nomor WhatsApp Operasional
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  placeholder="081234567890"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white font-bold rounded-xl shadow-lg shadow-red-500/20 text-sm disabled:opacity-50 transition"
              >
                {saving ? 'Menyimpan...' : 'Simpan Profil Usaha'}
              </button>
            </form>
          </div>
        ) : (
          /* KONDISI B: Panel Profil Usaha & Akses Cepat */
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Detail Usaha & Lokasi Garasi
              </h2>
              <p className="text-xs text-slate-500">
                Informasi yang digunakan penyewa untuk titik ambil atau pengantaran armada.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-[#F8FAFC] rounded-2xl border border-slate-100 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Kota Operasional</p>
                <p className="font-bold text-slate-900 mt-1">{vendor.city}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">WhatsApp Garasi</p>
                <p className="font-bold text-slate-900 mt-1">{vendor.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Alamat Garasi</p>
                <p className="font-bold text-slate-900 mt-1">{vendor.address}</p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href="/vendor/armada"
                className="px-6 py-3 bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] hover:from-[#1E3A8A] hover:to-[#172554] text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-2"
              >
                <span>🚘</span> Kelola Armada Motor & Mobil →
              </Link>
              <Link
                href="/vendor/bookings"
                className="px-6 py-3 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white font-bold text-sm rounded-xl shadow-md shadow-red-500/20 transition flex items-center gap-2"
              >
                <span>📑</span> Pesanan & Serah Terima →
              </Link>
              <Link
                href="/vendor/reports"
                className="px-6 py-3 bg-white text-slate-800 hover:text-[#0F52BA] font-bold text-sm rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition flex items-center gap-2"
              >
                <span>📈</span> Rekap Laporan Bulanan →
              </Link>
            </div>
          </div>
        )}

      </main>
    </div>
  )

}