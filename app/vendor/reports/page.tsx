'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface VendorProfile {
  id: string
  business_name: string
  city: string
  address: string
  phone: string
}

interface CompletedBooking {
  id: string
  service_type: 'self_drive' | 'with_driver'
  start_date: string
  end_date: string
  total_days: number
  base_price: number
  deposit_amount: number
  grand_total: number
  pickup_location: string
  status: 'completed'
  created_at: string
  vehicles: {
    brand: string
    model: string
    plate_number: string
    category: 'motorcycle' | 'car'
  }
  profiles: {
    full_name: string
    phone: string
  }
}

const MONTHS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
]

export default function VendorReportsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [bookings, setBookings] = useState<CompletedBooking[]>([])

  // Filter Bulan & Tahun (Default: November 2026 atau bulan saat ini)
  const [selectedMonth, setSelectedMonth] = useState('11')
  const [selectedYear, setSelectedYear] = useState('2026')
  const [searchQuery, setSearchQuery] = useState('')
  const [printDate, setPrintDate] = useState('')

  useEffect(() => {
    // Set default ke bulan & tahun perangkat pengguna di runtime
    const now = new Date()
    const currentM = String(now.getMonth() + 1).padStart(2, '0')
    const currentY = String(now.getFullYear())
    setSelectedMonth(currentM)
    setSelectedYear(currentY)
    setPrintDate(now.toLocaleDateString('id-ID'))

    const fetchReportData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!vendorData) {
        router.push('/vendor/dashboard')
        return
      }

      setVendor(vendorData)

      // Ambil seluruh data pesanan yang SUDAH SELESAI ('completed') untuk vendor ini
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          service_type,
          start_date,
          end_date,
          total_days,
          base_price,
          deposit_amount,
          grand_total,
          pickup_location,
          status,
          created_at,
          vehicles (
            brand,
            model,
            plate_number,
            category
          ),
          profiles (
            full_name,
            phone
          )
        `)
        .eq('vendor_id', vendorData.id)
        .eq('status', 'completed')
        .order('start_date', { ascending: false })

      if (!error && data) {
        setBookings(data as unknown as CompletedBooking[])
      }
      setLoading(false)
    }

    fetchReportData()
  }, [router, supabase])

  // Filter pesanan berdasarkan bulan & tahun yang dipilih
  const monthlyBookings = bookings.filter((item) => {
    // Mencocokkan berdasarkan tanggal mulai sewa (start_date YYYY-MM-DD)
    const matchPeriod = item.start_date.startsWith(`${selectedYear}-${selectedMonth}`)
    
    // Pencarian instan berdasarkan nama penyewa atau unit armada
    const matchSearch =
      (item.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vehicles?.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vehicles?.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vehicles?.plate_number || '').toLowerCase().includes(searchQuery.toLowerCase())

    return matchPeriod && matchSearch
  })

  // Perhitungan statistik finansial bulanan
  const totalOmzet = monthlyBookings.reduce((sum, item) => sum + (item.base_price || 0), 0)
  const totalCompleted = monthlyBookings.length
  const totalDaysRented = monthlyBookings.reduce((sum, item) => sum + (item.total_days || 0), 0)
  const averageIncomePerBooking = totalCompleted > 0 ? Math.round(totalOmzet / totalCompleted) : 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const selectedMonthName = MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth

  return (
    <div className="min-h-screen bg-[#F0F4F9] flex flex-col md:flex-row text-slate-800">
      {/* SIDEBAR NAVIGASI BIRU TUA (Sesuai Referensi Desain) - Sembunyikan saat cetak */}
      <aside className="print:hidden w-full md:w-64 bg-gradient-to-b from-[#0F52BA] via-[#1E40AF] to-[#1E3A8A] text-white flex flex-col justify-between p-5 md:p-6 shadow-xl shrink-0">
        <div>
          {/* Logo Brand RENTALHUB */}
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white font-medium text-sm transition"
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
            </Link>

            <Link
              href="/vendor/bookings"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white font-medium text-sm transition"
            >
              <span className="text-lg">📑</span>
              <span>Pesanan Masuk</span>
            </Link>

            <Link
              href="/vendor/reports"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/15 text-white font-bold text-sm shadow-sm backdrop-blur-sm border border-white/10"
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

        {/* Tombol Logout */}
        <div className="pt-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-200 hover:bg-red-500/20 hover:text-white font-medium text-sm transition"
          >
            <span>🚪</span>
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto print:p-0 print:space-y-4">
        {/* Top Header Bar - Sembunyikan saat cetak */}
        <div className="print:hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0F52BA] uppercase tracking-wider bg-blue-50 px-2.5 py-0.5 rounded-md">
                Keuangan & Pembukuan
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
              Rekap Laporan Pendapatan Bulanan
            </h1>
            <p className="text-xs text-slate-500">
              Analisis pendapatan dari seluruh transaksi sewa yang telah selesai diselesaikan.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/20 transition flex items-center justify-center gap-2"
            >
              <span>🖨️</span> Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* Header Khusus Print View (Hanya muncul saat dicetak ke PDF/Kertas) */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {vendor?.business_name || 'RENTALHUB PARTNER'}
              </h1>
              <p className="text-xs text-slate-600">{vendor?.address} • Kota {vendor?.city}</p>
              <p className="text-xs text-slate-600">No. WhatsApp: {vendor?.phone}</p>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold text-slate-900">LAPORAN REKAP BULANAN</h2>
              <p className="text-sm font-black text-[#0F52BA]">{selectedMonthName} {selectedYear}</p>
              <p className="text-[10px] text-slate-400">Dicetak pada: {printDate || '-'}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar: Pilihan Bulan, Tahun, dan Pencarian */}
        <div className="print:hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Periode Bulan:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Tahun:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama penyewa / plat nomor..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
            />
          </div>
        </div>

        {/* 4 KPI CARDS: Rangkuman Statistik Bulan Terpilih */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Omzet / Pendapatan Bersih (Merah Sesuai Desain) */}
          <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] text-white p-5 rounded-2xl shadow-lg shadow-red-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-100">
                Omzet Bersih ({selectedMonthName})
              </span>
              <span className="text-lg">💰</span>
            </div>
            <h3 className="text-2xl font-black mt-2 tracking-tight">
              Rp {totalOmzet.toLocaleString('id-ID')}
            </h3>
            <p className="text-[11px] text-red-100 mt-1">Uang sewa dari pesanan selesai</p>
          </div>

          {/* Card 2: Total Pesanan Selesai (Biru Tua Sesuai Desain) */}
          <div className="bg-gradient-to-br from-[#1E40AF] to-[#1D4ED8] text-white p-5 rounded-2xl shadow-lg shadow-blue-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                Pesanan Selesai
              </span>
              <span className="text-lg">✅</span>
            </div>
            <h3 className="text-2xl font-black mt-2 tracking-tight">
              {totalCompleted} <span className="text-sm font-normal text-blue-200">Transaksi</span>
            </h3>
            <p className="text-[11px] text-blue-100 mt-1">Status sukses & serah terima tuntas</p>
          </div>

          {/* Card 3: Total Hari Unit Disewa (Biru Cerah / Cyan Sesuai Desain) */}
          <div className="bg-gradient-to-br from-[#0284C7] to-[#0EA5E9] text-white p-5 rounded-2xl shadow-lg shadow-sky-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-100">
                Total Hari Armada
              </span>
              <span className="text-lg">📅</span>
            </div>
            <h3 className="text-2xl font-black mt-2 tracking-tight">
              {totalDaysRented} <span className="text-sm font-normal text-sky-200">Hari Disewa</span>
            </h3>
            <p className="text-[11px] text-sky-100 mt-1">Akumulasi hari sewa aktif</p>
          </div>

          {/* Card 4: Rata-rata per Transaksi (Slate Sesuai Desain) */}
          <div className="bg-gradient-to-br from-[#475569] to-[#64748B] text-white p-5 rounded-2xl shadow-lg shadow-slate-500/20 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Rata-Rata per Sewa
              </span>
              <span className="text-lg">📊</span>
            </div>
            <h3 className="text-2xl font-black mt-2 tracking-tight">
              Rp {averageIncomePerBooking.toLocaleString('id-ID')}
            </h3>
            <p className="text-[11px] text-slate-200 mt-1">Nilai rata-rata per transaksi</p>
          </div>
        </div>

        {/* TABEL RINCIAN TRANSAKSI SELESAI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Rincian Pesanan Selesai — Periode {selectedMonthName} {selectedYear}
              </h2>
              <p className="text-xs text-slate-500">
                Daftar transaksi yang menghasilkan pendapatan pada bulan terpilih.
              </p>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
              {monthlyBookings.length} Pesanan
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs font-medium">Memuat rekap data keuangan...</p>
            </div>
          ) : monthlyBookings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-3xl">📑</p>
              <h3 className="text-base font-bold text-slate-800">
                Tidak Ada Pesanan Selesai Pada Periode Ini
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Belum ada transaksi dengan status <strong>Selesai (Completed)</strong> di bulan {selectedMonthName} {selectedYear}.
                Pesanan yang selesai akan otomatis tercatat dan masuk ke pembukuan ini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">ID / Tanggal Sewa</th>
                    <th className="px-5 py-3.5">Nama Penyewa & Kontak</th>
                    <th className="px-5 py-3.5">Armada Kendaraan</th>
                    <th className="px-5 py-3.5">Layanan</th>
                    <th className="px-5 py-3.5 text-center">Durasi</th>
                    <th className="px-5 py-3.5 text-right">Pendapatan Sewa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {monthlyBookings.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      {/* ID & Tanggal */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{item.id.slice(0, 8)}
                        </span>
                        <p className="font-bold text-slate-900 mt-1">
                          {item.start_date} <span className="text-slate-400 font-normal">s/d</span> {item.end_date}
                        </p>
                      </td>

                      {/* Penyewa & Telepon */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">
                          {item.profiles?.full_name || 'Pelanggan'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          📞 {item.profiles?.phone || '-'}
                        </p>
                      </td>

                      {/* Kendaraan */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            item.vehicles?.category === 'motorcycle'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.vehicles?.category === 'motorcycle' ? 'Motor' : 'Mobil'}
                          </span>
                          <span className="font-bold text-slate-900">
                            {item.vehicles?.brand} {item.vehicles?.model}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 mt-1">
                          Plat: {item.vehicles?.plate_number}
                        </p>
                      </td>

                      {/* Tipe Layanan */}
                      <td className="px-5 py-4">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          item.service_type === 'self_drive'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}>
                          {item.service_type === 'self_drive' ? 'Lepas Kunci' : 'Dengan Supir'}
                        </span>
                      </td>

                      {/* Durasi */}
                      <td className="px-5 py-4 text-center">
                        <span className="font-bold text-slate-900">{item.total_days}</span> Hari
                      </td>

                      {/* Pendapatan Bersih */}
                      <td className="px-5 py-4 text-right">
                        <p className="font-black text-slate-900 text-sm">
                          Rp {item.base_price.toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-semibold">Telah Diterima</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Total Bar Bawah */}
                <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-bold text-slate-900">
                  <tr>
                    <td colSpan={4} className="px-5 py-3.5 text-right uppercase text-[11px] tracking-wider text-slate-500">
                      Total Pendapatan Bulan {selectedMonthName} {selectedYear}:
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs">
                      {totalDaysRented} Hari
                    </td>
                    <td className="px-5 py-3.5 text-right text-base font-black text-[#0F52BA]">
                      Rp {totalOmzet.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Tanda Tangan Cetak (Hanya tampil saat print) */}
        <div className="hidden print:flex justify-between pt-10 text-xs">
          <div>
            <p className="text-slate-400">Catatan:</p>
            <p className="text-slate-600">Laporan ini dibuat otomatis oleh sistem RentalHub.</p>
          </div>
          <div className="text-center w-48">
            <p className="text-slate-600 mb-16">Pengelola Rental / Vendor,</p>
            <p className="font-bold text-slate-900 underline">{vendor?.business_name}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
