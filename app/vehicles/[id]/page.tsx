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

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function VehicleBookingContent() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const vehicleId = params?.id as string

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  // State Jadwal yang Sudah Dibooking (dari tabel bookings)
  const [bookedDates, setBookedDates] = useState<string[]>([])

  // State Kalender Visual (Bulan & Tahun saat ini)
  const [calendarYear, setCalendarYear] = useState(2026)
  const [calendarMonth, setCalendarMonth] = useState(10) // 10 = November

  // State Form Pemesanan
  const [serviceType, setServiceType] = useState<'self_drive' | 'with_driver'>('self_drive')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [agreePhysicalIds, setAgreePhysicalIds] = useState(false)

  useEffect(() => {
    // Sinkronkan bulan kalender ke waktu perangkat saat runtime
    const now = new Date()
    setCalendarYear(now.getFullYear())
    setCalendarMonth(now.getMonth())

    if (!vehicleId) return

    const fetchDetail = async () => {
      // 1. Ambil detail kendaraan
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

      // 2. Ambil seluruh tanggal sewa yang aktif untuk kendaraan ini
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('start_date, end_date, status')
        .eq('vehicle_id', vehicleId)
        .neq('status', 'cancelled')

      if (bookingsData) {
        const datesSet = new Set<string>()
        bookingsData.forEach((b) => {
          if (b.start_date && b.end_date) {
            let cur = new Date(b.start_date)
            const stop = new Date(b.end_date)
            while (cur <= stop) {
              datesSet.add(cur.toISOString().split('T')[0])
              cur.setDate(cur.getDate() + 1)
            }
          }
        })
        setBookedDates(Array.from(datesSet))
      }

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
  const activeDeposit = vehicle && serviceType === 'self_drive' ? vehicle.deposit_amount : 0
  const grandTotal = basePrice + activeDeposit

  const galleryImages = (vehicle?.vehicle_images && vehicle.vehicle_images.length > 0)
    ? vehicle.vehicle_images.map((img) => img.image_url)
    : (vehicle?.image_url ? [vehicle.image_url] : [])

  const activePhoto = galleryImages[selectedPhotoIndex] || galleryImages[0]

  // Navigasi Bulan Kalender
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear(calendarYear - 1)
    } else {
      setCalendarMonth(calendarMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear(calendarYear + 1)
    } else {
      setCalendarMonth(calendarMonth + 1)
    }
  }

  // Interaksi Klik Tanggal pada Kalender Visual
  const handleCalendarDateClick = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (dateStr < todayStr) {
      alert('Tanggal tersebut sudah lewat.')
      return
    }
    if (bookedDates.includes(dateStr)) {
      alert('Maaf, unit ini sudah dibooking pada tanggal tersebut. Silakan pilih tanggal lain yang berwarna hijau.')
      return
    }

    // Jika belum ada startDate, atau sudah terisi startDate & endDate, mulai pilihan baru
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr)
      setEndDate('')
    } else if (startDate && !endDate) {
      if (dateStr < startDate) {
        setStartDate(dateStr)
      } else {
        // Validasi apakah ada tanggal terisi di antara startDate dan dateStr
        const hasConflict = bookedDates.some((bDate) => bDate >= startDate && bDate <= dateStr)
        if (hasConflict) {
          alert('Terdapat tanggal yang sudah terisi di dalam rentang yang Anda pilih. Silakan pilih rentang lain.')
          return
        }
        setEndDate(dateStr)
      }
    }
  }

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicle) return

    if (totalDays <= 0) {
      alert('Tanggal selesai harus sama atau setelah tanggal mulai sewa.')
      return
    }

    if (!agreePhysicalIds) {
      alert('Anda wajib menyetujui persyaratan penyerahan 2 identitas fisik asli sebelum memesan unit.')
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

      // 2. Simpan data pesanan ke tabel 'bookings' dengan status 'pending_payment'
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
        status: 'pending_payment',
      })

      if (insertError) {
        alert('Gagal membuat pesanan: ' + insertError.message)
        return
      }

      alert('Pesanan berhasil dibuat! Silakan lakukan transfer dan unggah bukti pembayaran di menu Pesanan Saya.')
      router.push('/dashboard/bookings')
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + (err?.message || 'Gagal memproses pesanan'))
    } finally {
      setSubmitting(false)
    }
  }

  // Perhitungan Struktur Hari dalam Bulan Kalender
  const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay()
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]

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
          {/* Kolom Kiri: Info Kendaraan, Galeri, Kalender Ketersediaan, & Form */}
          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
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

                {/* Thumbnail Galeri */}
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

            {/* 📅 KALENDER KETERSEDIAAN VISUAL (FITUR UTAMA BARU) */}
            <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-blue-100 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>📅</span> Kalender Ketersediaan Armada
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Klik tanggal pada kalender untuk memilih jadwal sewa Anda secara langsung.
                  </p>
                </div>

                {/* Navigasi Bulan */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-700 font-bold transition shadow-sm"
                    title="Bulan Sebelumnya"
                  >
                    ‹
                  </button>
                  <span className="text-xs font-black text-[#0F52BA] px-2 min-w-28 text-center bg-white py-1 rounded-lg border border-slate-200 shadow-sm">
                    {MONTH_NAMES[calendarMonth]} {calendarYear}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-700 font-bold transition shadow-sm"
                    title="Bulan Berikutnya"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Indikator Warna (Legend) */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                  <span className="text-slate-600 font-medium">Tersedia (Bebas)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300"></span>
                  <span className="text-slate-600 font-medium">Sudah Dibooking</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#0F52BA]"></span>
                  <span className="text-slate-600 font-medium">Pilihan Jadwal Anda</span>
                </div>
              </div>

              {/* Grid Kalender 7 Hari */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 mb-2 border-b border-slate-100 pb-2">
                  {DAY_NAMES.map((d, i) => (
                    <div key={i} className={i === 0 ? 'text-rose-500' : ''}>
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {/* Kotak kosong sebelum hari pertama */}
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-11 rounded-lg"></div>
                  ))}

                  {/* Hari-hari dalam bulan */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

                    const isPast = dateStr < todayStr
                    const isBooked = bookedDates.includes(dateStr)
                    const isSelectedStart = startDate === dateStr
                    const isSelectedEnd = endDate === dateStr
                    const isInSelectedRange = startDate && endDate && dateStr >= startDate && dateStr <= endDate

                    // Logika Styling Box Tanggal
                    let bgClasses = 'bg-emerald-50/70 border-emerald-200 text-slate-800 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer'
                    let label = 'Tersedia'

                    if (isPast) {
                      bgClasses = 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                      label = 'Lewat'
                    } else if (isBooked) {
                      bgClasses = 'bg-rose-50 border-rose-200 text-rose-800 cursor-not-allowed font-medium line-through'
                      label = 'Disewa'
                    } else if (isSelectedStart || isSelectedEnd) {
                      bgClasses = 'bg-[#0F52BA] border-[#0F52BA] text-white shadow-md font-black scale-95'
                      label = isSelectedStart ? 'Mulai' : 'Selesai'
                    } else if (isInSelectedRange) {
                      bgClasses = 'bg-blue-100 border-blue-300 text-[#0F52BA] font-bold'
                      label = 'Dipilih'
                    }

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => !isPast && !isBooked && handleCalendarDateClick(dateStr)}
                        disabled={isPast || isBooked}
                        title={`${dateStr}: ${label}`}
                        className={`h-11 rounded-lg border flex flex-col items-center justify-center transition p-0.5 text-xs relative ${bgClasses}`}
                      >
                        <span className="text-[12px] leading-none">{dayNum}</span>
                        <span className="text-[8px] leading-tight scale-90 uppercase mt-0.5">
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
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

              {/* Tanggal Sewa (Bisa Diisi Manual atau Otomatis dari Kalender di Atas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Mulai Sewa
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Selesai Sewa
                  </label>
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

              {/* Syarat Wajib Jaminan 2 Identitas Fisik */}
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <span className="text-base">⚠️</span>
                  <span>Syarat Wajib: Jaminan 2 Identitas Fisik Asli</span>
                </div>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Penyewa <strong>wajib menitipkan/menyerahkan 2 dokumen identitas fisik asli</strong> kepada vendor saat serah-terima unit di lokasi (contoh: e-KTP fisik asli + NPWP / SIM / BPJS / Paspor / Kartu Mahasiswa / Kartu Karyawan). Dokumen akan disimpan aman oleh pihak vendor dan dikembalikan 100% utuh saat unit sewa dikembalikan.
                </p>
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={agreePhysicalIds}
                    onChange={(e) => setAgreePhysicalIds(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#0F52BA] rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Saya menyetujui & bersedia menyerahkan 2 identitas fisik asli saat serah-terima kendaraan
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || totalDays <= 0 || !agreePhysicalIds}
                className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? 'Memeriksa Jadwal & Memproses...' : 'Lanjut ke Pembayaran Sewa →'}
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
