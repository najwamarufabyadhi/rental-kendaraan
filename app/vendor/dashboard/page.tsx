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

  // State untuk form profil usaha (jika belum punya)
  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  // 1. Dijalankan otomatis saat halaman pertama kali dibuka
  useEffect(() => {
    const fetchVendorProfile = async () => {
      // Ambil data user yang sedang login
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat data dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header Dashboard */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
              Portal Mitra Rental
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-2">
              {vendor ? vendor.business_name : 'Lengkapi Profil Usaha Rental'}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100"
          >
            Keluar
          </button>
        </div>

        {/* KONDISI A: Jika belum punya profil usaha -> Tampilkan Form */}
        {!vendor ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Informasi Usaha Anda
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Data ini akan ditampilkan kepada calon penyewa saat melihat kendaraan Anda.
            </p>

            <form onSubmit={handleCreateVendor} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nama Usaha Rental
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="Contoh: Bromo Trans Rental"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kota Operasional
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="Contoh: Malang"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Alamat Lengkap Garasi / Kantor
                </label>
                <textarea
                  required
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="Jl. Soekarno Hatta No. 12..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nomor WhatsApp Admin Rental
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="081234567890"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Profil Usaha'}
              </button>
            </form>
          </div>
        ) : (
          /* KONDISI B: Jika sudah punya profil usaha -> Tampilkan Ringkasan & Menu Armada */
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Kota Operasional</p>
                <p className="font-medium text-slate-900">{vendor.city}</p>
              </div>
              <div>
                <p className="text-slate-500">WhatsApp Operasional</p>
                <p className="font-medium text-slate-900">{vendor.phone}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-slate-500">Alamat Garasi</p>
                <p className="font-medium text-slate-900">{vendor.address}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
              <Link
                href="/vendor/armada"
                className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
              >
                Kelola Armada Motor & Mobil →
              </Link>
              <Link
                href="/vendor/bookings"
                className="inline-block px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg"
              >
                Lihat Pesanan Masuk & Serah Terima →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}