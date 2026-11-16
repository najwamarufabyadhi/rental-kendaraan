'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface VehicleImage {
  image_url: string
  is_primary: boolean
  sort_order: number
}

// Definisi struktur data gabungan antara tabel vehicles dan vendors
interface MarketplaceVehicle {
  id: string
  category: 'motorcycle' | 'car'
  brand: string
  model: string
  year: number
  transmission: 'automatic' | 'manual'
  daily_rate: number
  with_driver: boolean
  deposit_amount: number
  image_url: string | null
  vehicle_images?: VehicleImage[]
  vendors: {
    business_name: string
    city: string
  }
}

export default function CustomerDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [vehicles, setVehicles] = useState<MarketplaceVehicle[]>([])
  const [loading, setLoading] = useState(true)

  // State untuk filter pencarian
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'motorcycle' | 'car'>('all')
  const [cityQuery, setCityQuery] = useState('')

  // 1. Ambil seluruh armada aktif beserta profil vendornya
  useEffect(() => {
    const fetchMarketplace = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Query dengan relasi ke tabel 'vendors' dan 'vehicle_images'
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          category,
          brand,
          model,
          year,
          transmission,
          daily_rate,
          with_driver,
          deposit_amount,
          image_url,
          vehicle_images (
            image_url,
            is_primary,
            sort_order
          ),
          vendors (
            business_name,
            city
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error memuat katalog:', error.message)
      } else if (data) {
        setVehicles(data as unknown as MarketplaceVehicle[])
      }
      setLoading(false)
    }

    fetchMarketplace()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 2. Logika penyaringan (Filter) di sisi frontend
  const filteredVehicles = vehicles.filter((item) => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchCity = item.vendors?.city.toLowerCase().includes(cityQuery.toLowerCase())
    return matchCategory && matchCity
  })

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-slate-800">
      {/* Top Bar Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F52BA] to-[#2563EB] flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
              R
            </div>
            <div>
              <h1 className="text-lg font-black text-[#0F52BA] tracking-wider uppercase">RENTALHUB</h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest -mt-1">Katalog Rental Multi-Vendor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/bookings"
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-[#0F52BA] bg-slate-50 hover:bg-blue-50 rounded-xl transition border border-slate-200"
            >
              📋 Pesanan Saya
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        {/* Search & Filter Header Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Category Filter Pills */}
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Armada
            </button>
            <button
              onClick={() => setSelectedCategory('motorcycle')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                selectedCategory === 'motorcycle'
                  ? 'bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏍️ Motor
            </button>
            <button
              onClick={() => setSelectedCategory('car')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                selectedCategory === 'car'
                  ? 'bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚗 Mobil
            </button>
          </div>

          {/* City Search Bar */}
          <div className="w-full md:w-80 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Cari berdasarkan kota (misal: Malang)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F52BA] focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Fleet Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Memuat katalog kendaraan...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm">
            <p className="text-3xl">🔍</p>
            <h3 className="text-base font-bold text-slate-800">Tidak ada unit ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada kendaraan yang sesuai dengan filter atau kota pencarian Anda saat ini. Coba pilih kategori lain atau reset kata kunci.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((item) => {
              const primaryImg = item.vehicle_images?.find((img) => img.is_primary)?.image_url
                || item.vehicle_images?.[0]?.image_url
                || item.image_url
              const photoCount = item.vehicle_images?.length || (item.image_url ? 1 : 0)

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between hover:shadow-lg transition-all transform hover:-translate-y-0.5 group"
                >
                  <div>
                    {primaryImg ? (
                      <div className="relative w-full h-48 rounded-xl mb-4 overflow-hidden bg-slate-100">
                        <img
                          src={primaryImg}
                          alt={`${item.brand} ${item.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {photoCount > 1 && (
                          <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[11px] bg-slate-900/80 backdrop-blur-sm text-white font-bold">
                            📷 {photoCount} Foto
                          </span>
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm text-slate-800 shadow-sm">
                          {item.category === 'motorcycle' ? 'Motor' : 'Mobil'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-48 rounded-xl mb-4 bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-medium">
                        Foto tidak tersedia
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">
                        Tahun {item.year} • <span className="capitalize">{item.transmission}</span>
                      </span>
                      <span className="font-bold text-[#0F52BA] bg-blue-50 px-2 py-0.5 rounded-md">
                        📍 {item.vendors?.city}
                      </span>
                    </div>

                    <h2 className="text-lg font-black text-slate-900 mt-2 line-clamp-1">
                      {item.brand} {item.model}
                    </h2>

                    {/* Info Layanan & Vendor */}
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                      <p className="flex justify-between">
                        <span className="text-slate-400">Pilihan Layanan:</span>
                        <strong className="text-slate-800">
                          {item.with_driver ? 'Lepas Kunci / Supir' : 'Lepas Kunci'}
                        </strong>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-400">Mitra Rental:</span>
                        <span className="font-bold text-slate-700">{item.vendors?.business_name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Tarif & CTA Button */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tarif Sewa</p>
                      <p className="text-lg font-black text-slate-900">
                        Rp {item.daily_rate.toLocaleString('id-ID')}
                        <span className="text-xs font-normal text-slate-500">/hari</span>
                      </p>
                    </div>

                    <Link
                      href={`/vehicles/${item.id}`}
                      className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-500/20 transition transform active:scale-95"
                    >
                      Pilih Unit
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
