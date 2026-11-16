'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

      // Query dengan relasi ke tabel 'vendors'
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
    <div className="min-h-screen bg-slate-50">
      {/* Navbar Atas */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">RentalHub Marketplace</h1>
            <p className="text-xs text-slate-500">Temukan motor & mobil dari mitra terpercaya</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/bookings"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Pesanan Saya
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Bar Pencarian & Filter */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Tombol Filter Kategori */}
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Semua Unit
            </button>
            <button
              onClick={() => setSelectedCategory('motorcycle')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === 'motorcycle'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Motor
            </button>
            <button
              onClick={() => setSelectedCategory('car')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === 'car'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Mobil
            </button>
          </div>

          {/* Input Pencarian Kota */}
          <div className="w-full md:w-72">
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Cari berdasarkan kota (misal: Malang)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
          </div>
        </div>

        {/* Grid Katalog Kendaraan */}
        {loading ? (
          <p className="text-center text-slate-500 py-12">Memuat daftar kendaraan...</p>
        ) : filteredVehicles.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
            Tidak ada kendaraan yang sesuai dengan filter pencarian Anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={`${item.brand} ${item.model}`}
                      className="w-full h-44 object-cover rounded-lg mb-3 bg-slate-100"
                    />
                  ) : (
                    <div className="w-full h-44 rounded-lg mb-3 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                      Tidak ada foto
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${item.category === 'motorcycle'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                        }`}
                    >
                      {item.category === 'motorcycle' ? 'Motor' : 'Mobil'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      📍 {item.vendors?.city}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 mt-3">
                    {item.brand} {item.model}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tahun {item.year} • <span className="capitalize">{item.transmission}</span>
                  </p>

                  {/* Info Layanan & Vendor */}
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <p>
                      Layanan:{' '}
                      <strong className="text-slate-800">
                        {item.with_driver ? 'Lepas Kunci / Dengan Supir' : 'Lepas Kunci'}
                      </strong>
                    </p>
                    <p>
                      Mitra: <span className="font-medium text-slate-800">{item.vendors?.business_name}</span>
                    </p>
                  </div>
                </div>

                {/* Harga & Tombol Sewa */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Mulai dari</p>
                    <p className="text-base font-bold text-emerald-600">
                      Rp {item.daily_rate.toLocaleString('id-ID')}
                      <span className="text-xs font-normal text-slate-500">/hari</span>
                    </p>
                  </div>

                  <Link
                    href={`/vehicles/${item.id}`}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
                  >
                    Pilih Unit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}