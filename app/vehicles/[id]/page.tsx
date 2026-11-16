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
      // Pastikan status tombol loading dinonaktifkan kembali
      setSubmitting(false)
    }
  }

  if (loading || !vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat rincian kendaraan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
          ← Kembali ke Katalog
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kolom Kiri: Info Kendaraan & Vendor */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            
            {/* Galeri Foto Kendaraan */}
            {galleryImages.length > 0 ? (
              <div className="space-y-2">
                <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={activePhoto}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                  {galleryImages.length > 1 && (
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md text-xs bg-slate-900/80 text-white font-medium backdrop-blur-sm">
                      Foto {selectedPhotoIndex + 1} dari {galleryImages.length}
                    </span>
                  )}
                </div>

                {/* Thumbnail Galeri untuk navigasi foto */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                    {galleryImages.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                          selectedPhotoIndex === idx
                            ? 'border-emerald-600 ring-2 ring-emerald-200'
                            : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-400">
                Tidak ada foto tersedia untuk kendaraan ini
              </div>
            )}

            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full uppercase inline-block">
              {vehicle.category === 'motorcycle' ? 'Sepeda Motor' : 'Mobil'} • {vehicle.transmission}
            </span>

            <h1 className="text-2xl font-bold text-slate-900">
              {vehicle.brand} {vehicle.model} ({vehicle.year})
            </h1>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-sm space-y-1">
              <p className="font-semibold text-slate-900">{vehicle.vendors.business_name}</p>
              <p className="text-slate-600">Kota: {vehicle.vendors.city}</p>
              <p className="text-slate-600">Alamat Garasi: {vehicle.vendors.address}</p>
            </div>

            <form onSubmit={handleBooking} className="space-y-4 pt-2">
              {/* Pilihan Layanan: Lepas Kunci vs Dengan Supir (Khusus Mobil yang mendukung supir) */}
              {vehicle.category === 'car' && vehicle.with_driver && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pilih Jenis Layanan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setServiceType('self_drive')}
                      className={`p-3 rounded-lg border text-sm font-medium text-left ${
                        serviceType === 'self_drive'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <div>Lepas Kunci</div>
                      <div className="text-xs opacity-75 font-normal">Wajib SIM A & Deposit</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiceType('with_driver')}
                      className={`p-3 rounded-lg border text-sm font-medium text-left ${
                        serviceType === 'with_driver'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <div>Dengan Supir</div>
                      <div className="text-xs opacity-75 font-normal">Bebas Deposit (Rp 0)</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Input Tanggal Mulai & Selesai */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Lokasi Penjemputan (Jika memilih Dengan Supir) */}
              {serviceType === 'with_driver' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Alamat Penjemputan
                  </label>
                  <input
                    type="text"
                    required
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Contoh: Stasiun Malang Kota Baru / Hotel..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || totalDays <= 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Memeriksa Jadwal...' : 'Konfirmasi Sewa Sekarang'}
              </button>
            </form>
          </div>

          {/* Kolom Kanan: Ringkasan Biaya Otomatis */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 h-fit space-y-4">
            <h2 className="font-bold text-slate-900 border-b border-slate-100 pb-3">
              Rincian Biaya
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Tarif Harian</span>
                <span>Rp {vehicle.daily_rate.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Durasi Sewa</span>
                <span>{totalDays} Hari</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Sewa</span>
                <span>Rp {basePrice.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Uang Jaminan (Deposit)</span>
                <span>Rp {activeDeposit.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="font-bold text-slate-900">Total Bayar</span>
              <span className="text-lg font-bold text-emerald-600">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              *Deposit dikembalikan 100% saat pengembalian unit dalam kondisi baik.
            </p>
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
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-slate-500">Memuat rincian kendaraan...</p>
        </div>
      }
    >
      <VehicleBookingContent />
    </Suspense>
  )
}