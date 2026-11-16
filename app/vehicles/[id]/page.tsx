'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface VehicleImage {
  id: string
  image_url: string
  is_primary: boolean
  sort_order: number
}

interface VehicleDetail {
  id: string
  vendor_id: string
  category: 'motorcycle' | 'car'
  brand: string
  model: string
  year: number
  transmission: 'automatic' | 'manual'
  plate_number: string
  daily_rate: number
  with_driver: boolean
  deposit_amount: number
  image_url?: string | null
  vehicle_images?: VehicleImage[]
  vendors: {
    business_name: string
    city: string
    address: string
  }
}

function VehicleBookingContent() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const vehicleId = params?.id as string

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  // State Form Pemesanan
  const [serviceType, setServiceType] = useState<'self_drive' | 'with_driver'>('self_drive')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')

  useEffect(() => {
    if (!vehicleId) return

    const fetchDetail = async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_images (
            id,
            image_url,
            is_primary,
            sort_order
          ),
          vendors (
            business_name,
            city,
            address
          )
        `)
        .eq('id', vehicleId)
        .single()

      if (error || !data) {
        alert('Kendaraan tidak ditemukan')
        router.push('/dashboard')
        return
      }

      setVehicle(data as unknown as VehicleDetail)
      setLoading(false)
    }

    fetchDetail()
  }, [vehicleId, router, supabase])

  // Menghitung jumlah hari sewa otomatis
  const calculateDays = () => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays > 0 ? diffDays : 0
  }

  const totalDays = calculateDays()
  const basePrice = vehicle ? totalDays * vehicle.daily_rate : 0
  // Sesuai aturan bisnis: Jika dengan supir, uang deposit Rp 0
  const activeDeposit = vehicle && serviceType === 'self_drive' ? vehicle.deposit_amount : 0
  const grandTotal = basePrice + activeDeposit

  // Kumpulan foto dari tabel vehicle_images, dengan fallback ke vehicle.image_url
  const galleryImages = (vehicle?.vehicle_images && vehicle.vehicle_images.length > 0)
    ? vehicle.vehicle_images.map((img) => img.image_url)
    : (vehicle?.image_url ? [vehicle.image_url] : [])

  const activePhoto = galleryImages[selectedPhotoIndex] || galleryImages[0]

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicle) return

    if (totalDays <= 0) {
      alert('Tanggal selesai harus sama atau setelah tanggal mulai sewa.')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSubmitting(false)
        router.push('/login')
        return
      }

      // 1. Panggil fungsi SQL RPC untuk mengecek apakah tanggal bentrok
      const { data: isAvailable, error: rpcError } = await supabase.rpc('check_vehicle_availability', {
        p_vehicle_id: vehicle.id,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (rpcError) {
        alert('Gagal mengecek ketersediaan: ' + rpcError.message)
        return
      }

      if (!isAvailable) {
        alert('Maaf, unit ini sudah dibooking pada rentang tanggal tersebut. Silakan pilih tanggal lain.')
        return
      }

      // 2. Jika tersedia, simpan data pesanan ke tabel 'bookings'
      const { error: insertError } = await supabase.from('bookings').insert({
        customer_id: user.id,
        vehicle_id: vehicle.id,
        vendor_id: vehicle.vendor_id,
        service_type: serviceType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        base_price: basePrice,
        deposit_amount: activeDeposit,
        grand_total: grandTotal,
        pickup_location: serviceType === 'with_driver' ? pickupLocation : vehicle.vendors.address,
        status: 'confirmed',
      })

      if (insertError) {
        alert('Gagal membuat pesanan: ' + insertError.message)
        return
      }

      alert('Pemesanan berhasil dikonfirmasi!')
      router.push('/dashboard/bookings')
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + (err?.message || 'Gagal memproses pesanan'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !vehicle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F4F9] text-slate-500">
        <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Memuat rincian kendaraan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-slate-800 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F52BA] hover:underline"
          >
            ← Kembali ke Katalog Armada
          </Link>
          <span className="text-xs font-bold text-slate-400">DETAIL UNIT & RESERVASI</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Info Kendaraan & Vendor */}
          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            {/* Galeri Foto Kendaraan */}
            {galleryImages.length > 0 ? (
              <div className="space-y-3">
                <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden bg-slate-100">
                  <img
                    src={activePhoto}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                  {galleryImages.length > 1 && (
                    <span className="absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs bg-slate-900/80 text-white font-bold backdrop-blur-sm">
                      📷 Foto {selectedPhotoIndex + 1} / {galleryImages.length}
                    </span>
                  )}
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm text-[#0F52BA] shadow-sm">
                    {vehicle.category === 'motorcycle' ? 'Motor' : 'Mobil'} • {vehicle.transmission}
                  </span>
                </div>

                {/* Thumbnail Galeri untuk navigasi foto */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1">
                    {galleryImages.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition ${
                          selectedPhotoIndex === idx
                            ? 'border-[#0F52BA] ring-2 ring-blue-200 scale-95'
                            : 'border-slate-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-56 rounded-2xl bg-slate-100 flex items-center justify-center text-sm text-slate-400 font-medium">
                Tidak ada foto tersedia untuk kendaraan ini
              </div>
            )}

            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Nomor Plat: <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{vehicle.plate_number}</span>
              </p>
            </div>

            {/* Profil Vendor Garasi */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🏢</span>
                <span className="font-bold text-slate-900 text-sm">{vehicle.vendors.business_name}</span>
              </div>
              <p className="text-slate-600 pl-6">📍 Wilayah Operasi: <strong className="text-slate-800">{vehicle.vendors.city}</strong></p>
              <p className="text-slate-600 pl-6">🏠 Alamat Garasi: {vehicle.vendors.address}</p>
            </div>

            <form onSubmit={handleBooking} className="space-y-5 pt-2">
              {/* Pilihan Layanan: Lepas Kunci vs Dengan Supir */}
              {vehicle.category === 'car' && vehicle.with_driver && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Pilih Jenis Layanan Sewa
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setServiceType('self_drive')}
                      className={`p-4 rounded-xl border text-left transition ${
                        serviceType === 'self_drive'
                          ? 'border-[#0F52BA] bg-blue-50/50 text-[#0F52BA] ring-2 ring-blue-500/20'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm">🔑 Lepas Kunci</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Wajib SIM A & Deposit</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiceType('with_driver')}
                      className={`p-4 rounded-xl border text-left transition ${
                        serviceType === 'with_driver'
                          ? 'border-[#0F52BA] bg-blue-50/50 text-[#0F52BA] ring-2 ring-blue-500/20'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm">👨‍✈️ Dengan Supir</div>
                      <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Bebas Deposit (Rp 0)</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Tanggal Sewa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai Sewa</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai Sewa</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
                  />
                </div>
              </div>

              {/* Titik Jemput */}
              {serviceType === 'with_driver' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Titik / Alamat Penjemputan Supir
                  </label>
                  <input
                    type="text"
                    required
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Contoh: Stasiun Malang Kota Baru / Lobi Hotel Savana..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || totalDays <= 0}
                className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? 'Memeriksa Jadwal & Memproses...' : 'Konfirmasi & Pesan Unit Sekarang'}
              </button>
            </form>
          </div>

          {/* Kolom Kanan: Ringkasan Biaya */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-4">
            <h2 className="font-black text-slate-900 border-b border-slate-100 pb-3 text-base">
              Rincian Perhitungan Biaya
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Tarif Harian</span>
                <span className="font-semibold text-slate-800">Rp {vehicle.daily_rate.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Durasi Sewa</span>
                <span className="font-bold text-[#0F52BA]">{totalDays} Hari</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Sewa Unit</span>
                <span className="font-semibold text-slate-800">Rp {basePrice.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Deposit Jaminan {serviceType === 'with_driver' ? '(Bebas Deposit)' : ''}</span>
                <span className="font-semibold text-slate-800">Rp {activeDeposit.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pembayaran</p>
                <p className="text-xl font-black text-slate-900">
                  Rp {grandTotal.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed">
              💡 <strong>Catatan Deposit:</strong> Uang jaminan (deposit) akan langsung dikembalikan 100% setelah unit kembali dalam kondisi baik.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VehicleBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F4F9] text-slate-500">
          <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium">Memuat rincian kendaraan...</p>
        </div>
      }
    >
      <VehicleBookingContent />
    </Suspense>
  )
}
