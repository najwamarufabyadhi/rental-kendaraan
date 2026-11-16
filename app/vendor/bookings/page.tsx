'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CustomerProfile {
  id?: string
  full_name: string
  phone: string
  address?: string | null
  ktp_url?: string | null
  sim_a_url?: string | null
  sim_c_url?: string | null
  emergency_name?: string | null
  emergency_phone?: string | null
}

interface VendorBooking {
  id: string
  customer_id: string
  service_type: 'self_drive' | 'with_driver'
  start_date: string
  end_date: string
  total_days: number
  base_price: number
  deposit_amount: number
  grand_total: number
  pickup_location: string
  status: 'pending_payment' | 'confirmed' | 'in_use' | 'completed' | 'cancelled'
  payment_proof_url?: string | null
  cancellation_reason?: string | null
  handover_fuel_level?: string | null
  handover_odometer?: string | null
  handover_notes?: string | null
  return_fuel_level?: string | null
  return_deposit_refunded?: number | null
  return_notes?: string | null
  rating?: number | null
  review_comment?: string | null
  vehicles: {
    brand: string
    model: string
    plate_number: string
    category: 'motorcycle' | 'car'
  }
  profiles: CustomerProfile
}

export default function VendorBookingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [bookings, setBookings] = useState<VendorBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string>('')

  // State untuk Modal Cek KYC Dokumen Penyewa
  const [selectedKycBooking, setSelectedKycBooking] = useState<VendorBooking | null>(null)

  // State untuk Modal Preview Bukti Transfer
  const [selectedProofBooking, setSelectedProofBooking] = useState<VendorBooking | null>(null)

  // State untuk Modal Zoom Foto
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

  // State untuk Modal Digital Handover (Serah Kunci Awal)
  const [handoverBooking, setHandoverBooking] = useState<VendorBooking | null>(null)
  const [fuelLevel, setFuelLevel] = useState('Full')
  const [odometer, setOdometer] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [checkedPhysicalIds, setCheckedPhysicalIds] = useState(false)
  const [submittingHandover, setSubmittingHandover] = useState(false)

  // State untuk Modal Return Inspection (Unit Kembali & Pengembalian Deposit)
  const [returnBooking, setReturnBooking] = useState<VendorBooking | null>(null)
  const [returnFuelLevel, setReturnFuelLevel] = useState('Full')
  const [depositRefundAmount, setDepositRefundAmount] = useState('0')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnedPhysicalIds, setReturnedPhysicalIds] = useState(false)
  const [submittingReturn, setSubmittingReturn] = useState(false)

  // State untuk Modal Pembatalan oleh Vendor
  const [cancellingBooking, setCancellingBooking] = useState<VendorBooking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingLoading, setCancellingLoading] = useState(false)

  useEffect(() => {
    const fetchVendorBookings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: vendor } = await supabase
        .from('vendors')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!vendor) {
        router.push('/vendor/dashboard')
        return
      }

      setVendorName(vendor.business_name || 'Mitra RentalHub')

      // Ambil pesanan masuk beserta data armada & data profil lengkap penyewa
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          vehicles (
            brand,
            model,
            plate_number,
            category
          ),
          profiles (*)
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setBookings(data as unknown as VendorBooking[])
      }
      setLoading(false)
    }

    fetchVendorBookings()
  }, [router, supabase])

  // Helper update status sederhana
  const handleUpdateStatus = async (
    bookingId: string,
    nextStatus: 'confirmed' | 'in_use' | 'completed'
  ) => {
    setUpdatingId(bookingId)

    const { error } = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', bookingId)

    if (error) {
      alert('Gagal memperbarui status: ' + error.message)
      setUpdatingId(null)
      return
    }

    setBookings(
      bookings.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b))
    )
    setUpdatingId(null)
  }

  // 1. Membuka Modal Handover Serah Kunci
  const handleOpenHandover = (booking: VendorBooking) => {
    setHandoverBooking(booking)
    setFuelLevel('Full')
    setOdometer('')
    setHandoverNotes('')
    setCheckedPhysicalIds(false)
  }

  // Submit Handover Checklist
  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!handoverBooking) return
    if (!checkedPhysicalIds) {
      alert('Anda wajib mencentang konfirmasi penerimaan 2 dokumen identitas fisik asli sebelum menyerahkan kunci.')
      return
    }

    setSubmittingHandover(true)

    try {
      const payload: Record<string, any> = {
        status: 'in_use',
        handover_fuel_level: fuelLevel,
        handover_odometer: odometer,
        handover_notes: handoverNotes,
      }

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', handoverBooking.id)

      if (error) throw error

      setBookings(
        bookings.map((b) =>
          b.id === handoverBooking.id
            ? { ...b, ...payload }
            : b
        )
      )

      alert('Serah terima kunci berhasil dicatat! Status armada kini sedang digunakan.')
      setHandoverBooking(null)
    } catch (err: any) {
      alert('Gagal menyimpan handover: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setSubmittingHandover(false)
    }
  }

  // 2. Membuka Modal Return & Pengembalian Deposit
  const handleOpenReturn = (booking: VendorBooking) => {
    setReturnBooking(booking)
    setReturnFuelLevel(booking.handover_fuel_level || 'Full')
    // Default kembalikan 100% deposit
    setDepositRefundAmount(String(booking.deposit_amount || 0))
    setReturnNotes('Unit kembali dalam kondisi baik tanpa kerusakan.')
    setReturnedPhysicalIds(false)
  }

  // Submit Return & Selesai
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnBooking) return
    if (!returnedPhysicalIds) {
      alert('Anda wajib mencentang konfirmasi pengembalian 2 dokumen identitas fisik asli kepada penyewa.')
      return
    }

    setSubmittingReturn(true)

    try {
      const payload: Record<string, any> = {
        status: 'completed',
        return_fuel_level: returnFuelLevel,
        return_deposit_refunded: Number(depositRefundAmount),
        return_notes: returnNotes,
      }

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', returnBooking.id)

      if (error) throw error

      setBookings(
        bookings.map((b) =>
          b.id === returnBooking.id
            ? { ...b, ...payload }
            : b
        )
      )

      alert('Transaksi sewa selesai! Unit armada kini telah kembali dan siap disewa kembali.')
      setReturnBooking(null)
    } catch (err: any) {
      alert('Gagal menyelesaikan pesanan: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setSubmittingReturn(false)
    }
  }

  // 3. Pembatalan oleh Vendor
  const handleConfirmCancelVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancellingBooking) return
    setCancellingLoading(true)

    try {
      const reason = cancelReason.trim() || 'Dibatalkan oleh pihak vendor'

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
        })
        .eq('id', cancellingBooking.id)

      if (error) throw error

      setBookings(
        bookings.map((b) =>
          b.id === cancellingBooking.id
            ? { ...b, status: 'cancelled', cancellation_reason: reason }
            : b
        )
      )

      alert('Pesanan berhasil dibatalkan.')
      setCancellingBooking(null)
      setCancelReason('')
    } catch (err: any) {
      alert('Gagal membatalkan pesanan: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setCancellingLoading(false)
    }
  }

  // Format Tautan WhatsApp ke Penyewa
  const getWhatsAppCustomerLink = (item: VendorBooking) => {
    const message = `Halo ${item.profiles?.full_name || 'Pelanggan'}, kami dari ${vendorName} ingin mengonfirmasi pesanan sewa #${item.id.slice(0, 8)} untuk armada ${item.vehicles?.brand} ${item.vehicles?.model} (Plat: ${item.vehicles?.plate_number}) periode ${item.start_date} s/d ${item.end_date}. Mohon konfirmasi jadwal serah-terima unit. Terima kasih!`
    let cleanPhone = (item.profiles?.phone || '').replace(/[^0-9]/g, '')
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1)
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] p-4 md:p-8 text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/vendor/dashboard"
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-[#0F52BA] hover:text-white flex items-center justify-center text-slate-700 transition"
              title="Kembali ke Dashboard"
            >
              ←
            </Link>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#0F52BA] tracking-wider">
                Vendor Console
              </span>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                Pesanan Masuk & Serah Terima Digital
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/vendor/reports"
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
            >
              <span>📈</span> Rekap Bulanan
            </Link>
            <Link
              href="/vendor/armada"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              🚘 Kelola Armada
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-[#0F52BA] hover:bg-[#1E3A8A] text-white font-semibold rounded-xl text-xs transition shadow-sm"
            >
              🏪 Marketplace
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Memuat pesanan masuk...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center text-slate-500 text-sm shadow-sm">
            Belum ada pesanan masuk untuk armada Anda saat ini.
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map((item) => {
              const hasKtp = Boolean(item.profiles?.ktp_url)
              const hasSim = Boolean(item.profiles?.sim_a_url || item.profiles?.sim_c_url)
              const isKycComplete = hasKtp && hasSim

              return (
                <div
                  key={item.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 hover:shadow-md transition"
                >
                  {/* Baris Atas: Unit, Plat, Status, & Pendapatan */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-3 py-0.5 rounded-full ${
                            item.service_type === 'self_drive'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {item.service_type === 'self_drive' ? 'Lepas Kunci' : 'Dengan Supir'}
                        </span>
                        <span className="text-xs font-mono bg-slate-100 px-2.5 py-0.5 rounded text-slate-700 font-bold">
                          {item.vehicles?.plate_number}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          #{item.id.slice(0, 8)}
                        </span>
                      </div>
                      <h2 className="text-lg font-black text-slate-900 mt-2">
                        {item.vehicles?.brand} {item.vehicles?.model}
                      </h2>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between gap-2">
                      <div className="md:text-right">
                        <p className="text-[11px] text-slate-400 font-semibold uppercase">Pendapatan Sewa</p>
                        <p className="text-lg font-black text-emerald-600">
                          Rp {item.base_price.toLocaleString('id-ID')}
                        </p>
                      </div>

                      {/* Status Pesanan */}
                      <div>
                        {item.status === 'pending_payment' && (
                          <span className="px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                            {item.payment_proof_url ? '⏳ Verifikasi Bukti Bayar' : '💳 Menunggu Pembayaran'}
                          </span>
                        )}
                        {item.status === 'confirmed' && (
                          <span className="px-3 py-1 text-xs font-bold bg-blue-100 text-[#0F52BA] rounded-full border border-blue-200">
                            Siap Diambil
                          </span>
                        )}
                        {item.status === 'in_use' && (
                          <span className="px-3 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                            Sedang Digunakan
                          </span>
                        )}
                        {item.status === 'completed' && (
                          <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                            ✓ Selesai
                          </span>
                        )}
                        {item.status === 'cancelled' && (
                          <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200">
                            Dibatalkan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Baris Tengah: Info Penyewa, Jadwal, & Jaminan */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-slate-400 font-semibold uppercase">Penyewa</p>
                      <p className="font-bold text-slate-900 mt-0.5 text-sm">
                        {item.profiles?.full_name || 'Pelanggan'}
                      </p>
                      <p className="text-slate-600 mt-0.5">📞 WA: {item.profiles?.phone || '-'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold uppercase">
                        Periode Sewa ({item.total_days} Hari)
                      </p>
                      <p className="font-bold text-slate-900 mt-0.5 text-sm">
                        {item.start_date} <span className="text-slate-400 font-normal">s/d</span> {item.end_date}
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Titik: {item.service_type === 'with_driver' ? item.pickup_location : 'Garasi Vendor'}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold uppercase">
                        Deposit Jaminan & Dokumen Fisik
                      </p>
                      <p className="font-bold text-slate-900 mt-0.5 text-sm">
                        {item.service_type === 'self_drive'
                          ? `Rp ${item.deposit_amount.toLocaleString('id-ID')} (Jaminan Uang)`
                          : 'Bebas Deposit (Rp 0)'}
                      </p>
                      <p className="text-amber-800 font-bold mt-0.5">
                        ⚠️ Wajib 2 Identitas Fisik Asli
                      </p>
                    </div>
                  </div>

                  {/* Catatan Inspeksi Handover Digital (Jika ada) */}
                  {(item.handover_fuel_level || item.return_deposit_refunded !== undefined) && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <p className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span>📋</span> Data Inspeksi Kendaraan:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {item.handover_fuel_level && (
                          <p>
                            <strong>Awal:</strong> Bensin {item.handover_fuel_level} • KM {item.handover_odometer || '-'} • Catatan: {item.handover_notes || 'Normal'}
                          </p>
                        )}
                        {item.return_deposit_refunded !== undefined && item.return_deposit_refunded !== null && (
                          <p>
                            <strong>Kembali:</strong> Bensin {item.return_fuel_level || '-'} • Deposit Kembali Rp {item.return_deposit_refunded.toLocaleString('id-ID')} • Catatan: {item.return_notes || '-'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tampilan Rating & Ulasan Pelanggan */}
                  {item.rating && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold text-sm">
                          {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                        </span>
                        <span className="font-bold text-slate-800">
                          Ulasan Penyewa ({item.rating}/5)
                        </span>
                      </div>
                      {item.review_comment && (
                        <p className="text-slate-600 italic text-[11px] mt-0.5">"{item.review_comment}"</p>
                      )}
                    </div>
                  )}

                  {/* Keterangan Pembatalan */}
                  {item.status === 'cancelled' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                      <strong>Pesanan Dibatalkan:</strong> {item.cancellation_reason || 'Dibatalkan'}
                    </div>
                  )}

                  {/* Baris Tombol Aksi & Verifikasi */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Tombol Chat WhatsApp Otomatis ke Penyewa */}
                      <a
                        href={getWhatsAppCustomerLink(item)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                      >
                        <span>💬</span> Chat WA Penyewa
                      </a>

                      {/* Tombol Cek Dokumen KYC Penyewa */}
                      <button
                        type="button"
                        onClick={() => setSelectedKycBooking(item)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          isKycComplete
                            ? 'bg-blue-50 text-[#0F52BA] hover:bg-blue-100 border border-blue-200'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        <span>🔍</span> Cek KYC & Identitas
                        {isKycComplete ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        )}
                      </button>

                      {/* Tombol Cek Bukti Pembayaran */}
                      {item.payment_proof_url && (
                        <button
                          type="button"
                          onClick={() => setSelectedProofBooking(item)}
                          className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <span>🧾</span> Cek Bukti Transfer
                        </button>
                      )}
                    </div>

                    {/* Tombol Proses Status & Pembatalan */}
                    <div className="flex items-center gap-2">
                      {item.status === 'pending_payment' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCancellingBooking(item)}
                            className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition"
                          >
                            Batalkan
                          </button>
                          <button
                            disabled={updatingId === item.id}
                            onClick={() => handleUpdateStatus(item.id, 'confirmed')}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                          >
                            ✓ Konfirmasi Pembayaran
                          </button>
                        </>
                      )}

                      {item.status === 'confirmed' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCancellingBooking(item)}
                            className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition"
                          >
                            Batalkan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenHandover(item)}
                            className="px-5 py-2.5 bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] hover:from-[#1E3A8A] hover:to-[#172554] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
                          >
                            <span>🔑</span> Serah Kunci (Inspeksi Fisik)
                          </button>
                        </>
                      )}

                      {item.status === 'in_use' && (
                        <button
                          type="button"
                          onClick={() => handleOpenReturn(item)}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5"
                        >
                          <span>✅</span> Unit Kembali & Cek Deposit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: CEK DOKUMEN KYC & 2 IDENTITAS FISIK PENYEWA */}
      {selectedKycBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 sticky top-0 bg-white z-10">
              <div>
                <span className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-wider">
                  Verifikasi Identitas Penyewa
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Dokumen KYC: {selectedKycBooking.profiles?.full_name || 'Penyewa'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKycBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <p className="text-slate-400 font-semibold uppercase">Nama Lengkap</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedKycBooking.profiles?.full_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase">Nomor WhatsApp / HP</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedKycBooking.profiles?.phone || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-slate-400 font-semibold uppercase">Alamat Domisili</p>
                <p className="font-medium text-slate-800 mt-0.5">{selectedKycBooking.profiles?.address || 'Belum diisi oleh penyewa'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase">Kontak Darurat (Nama)</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedKycBooking.profiles?.emergency_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase">Kontak Darurat (No HP)</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedKycBooking.profiles?.emergency_phone || '-'}</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠️</span> Aturan Wajib Jaminan Fisik:
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Penyewa telah menyetujui untuk menyerahkan <strong>2 identitas fisik asli</strong> (misal: e-KTP fisik + NPWP / SIM / BPJS / Paspor) saat serah-terima unit di lokasi. Harap simpan dokumen tersebut selama masa sewa dan kembalikan saat unit tiba di garasi.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Dokumen Digital yang Diunggah Penyewa:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">1. KTP Asli</span>
                    {selectedKycBooking.profiles?.ktp_url ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Ada</span>
                    ) : (
                      <span className="text-[10px] text-red-500 font-bold">Belum Ada</span>
                    )}
                  </div>
                  {selectedKycBooking.profiles?.ktp_url ? (
                    <div
                      onClick={() => setZoomImageUrl(selectedKycBooking.profiles.ktp_url!)}
                      className="aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer hover:opacity-90 transition group relative"
                    >
                      <img
                        src={selectedKycBooking.profiles.ktp_url}
                        alt="KTP Penyewa"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                        🔍 Perbesar
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[16/10] rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs">
                      Tidak Ada Foto
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">2. SIM A (Mobil)</span>
                    {selectedKycBooking.profiles?.sim_a_url ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Ada</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">Tidak Ada</span>
                    )}
                  </div>
                  {selectedKycBooking.profiles?.sim_a_url ? (
                    <div
                      onClick={() => setZoomImageUrl(selectedKycBooking.profiles.sim_a_url!)}
                      className="aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer hover:opacity-90 transition group relative"
                    >
                      <img
                        src={selectedKycBooking.profiles.sim_a_url}
                        alt="SIM A Penyewa"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                        🔍 Perbesar
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[16/10] rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs">
                      Tidak Ada Foto
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">3. SIM C (Motor)</span>
                    {selectedKycBooking.profiles?.sim_c_url ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Ada</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">Tidak Ada</span>
                    )}
                  </div>
                  {selectedKycBooking.profiles?.sim_c_url ? (
                    <div
                      onClick={() => setZoomImageUrl(selectedKycBooking.profiles.sim_c_url!)}
                      className="aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer hover:opacity-90 transition group relative"
                    >
                      <img
                        src={selectedKycBooking.profiles.sim_c_url}
                        alt="SIM C Penyewa"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                        🔍 Perbesar
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[16/10] rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs">
                      Tidak Ada Foto
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedKycBooking(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
              >
                Tutup Pemeriksaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CEK STRUK BUKTI PEMBAYARAN */}
      {selectedProofBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-wider">
                  Verifikasi Pembayaran
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Struk Transfer Sewa #{selectedProofBooking.id.slice(0, 8)}
                </h2>
                <p className="text-xs text-slate-500">
                  Total Tagihan: <strong>Rp {selectedProofBooking.grand_total.toLocaleString('id-ID')}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            {selectedProofBooking.payment_proof_url ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-96 flex items-center justify-center">
                <img
                  src={selectedProofBooking.payment_proof_url}
                  alt="Bukti Transfer"
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => setZoomImageUrl(selectedProofBooking.payment_proof_url!)}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">
                Penyewa belum mengunggah bukti transfer.
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedProofBooking(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              {selectedProofBooking.status === 'pending_payment' && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(selectedProofBooking.id, 'confirmed')
                    setSelectedProofBooking(null)
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/25 transition"
                >
                  ✓ Verifikasi & Terima Pesanan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DIGITAL HANDOVER CHECKLIST (SERAH KUNCI & INSPEKSI AWAL) */}
      {handoverBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-wider">
                Digital Handover Checklist
              </span>
              <h2 className="text-xl font-black text-slate-900">
                Inspeksi Awal Serah Kunci
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unit {handoverBooking.vehicles?.brand} {handoverBooking.vehicles?.model} ({handoverBooking.vehicles?.plate_number})
              </p>
            </div>

            <form onSubmit={handleSubmitHandover} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Posisi Level Bensin
                  </label>
                  <select
                    value={fuelLevel}
                    onChange={(e) => setFuelLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  >
                    <option value="Full (Penuh)">Full (Penuh)</option>
                    <option value="3/4 Bar">3/4 Bar</option>
                    <option value="1/2 Bar">1/2 Bar</option>
                    <option value="1/4 Bar">1/4 Bar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Angka Odometer (KM)
                  </label>
                  <input
                    type="text"
                    required
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="Contoh: 45210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Kondisi Fisik / Baret Eksisting
                </label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Contoh: Baret halus bumper depan kanan, ban serep lengkap, toolkit ada..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>

              {/* CHECKLIST 2 IDENTITAS FISIK */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={checkedPhysicalIds}
                    onChange={(e) => setCheckedPhysicalIds(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#0F52BA] rounded"
                  />
                  <span className="text-xs font-bold text-amber-950">
                    Konfirmasi: Saya telah memeriksa KTP/SIM asli dan MENERIMA 2 DOKUMEN IDENTITAS FISIK ASLI dari penyewa ({handoverBooking.profiles?.full_name}) sebagai jaminan.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHandoverBooking(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingHandover}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] hover:from-[#1E3A8A] hover:to-[#172554] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-50"
                >
                  {submittingHandover ? 'Menyimpan...' : 'Serahkan Kunci & Mulai Sewa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RETURN INSPECTION & PENGEMBALIAN DEPOSIT */}
      {returnBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Unit Return & Deposit Settlement
              </span>
              <h2 className="text-xl font-black text-slate-900">
                Pemeriksaan Unit Kembali & Deposit
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total Uang Jaminan Awal: <strong>Rp {returnBooking.deposit_amount.toLocaleString('id-ID')}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bensin Saat Kembali
                  </label>
                  <select
                    value={returnFuelLevel}
                    onChange={(e) => setReturnFuelLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  >
                    <option value="Full (Penuh)">Full (Sesuai)</option>
                    <option value="3/4 Bar">3/4 Bar</option>
                    <option value="1/2 Bar">1/2 Bar</option>
                    <option value="1/4 Bar">1/4 Bar (Kurang)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nominal Deposit Dikembalikan (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={returnBooking.deposit_amount}
                    value={depositRefundAmount}
                    onChange={(e) => setDepositRefundAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Pengembalian (Kondisi Unit / Potongan Denda)
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Contoh: Unit bersih, tidak ada baret baru, deposit Rp 500.000 dikembalikan penuh."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>

              {/* CHECKLIST PENGEMBALIAN 2 IDENTITAS FISIK */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={returnedPhysicalIds}
                    onChange={(e) => setReturnedPhysicalIds(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-emerald-950">
                    Konfirmasi: Saya telah MENYERAHKAN KEMBALI 2 dokumen identitas fisik asli kepada penyewa ({returnBooking.profiles?.full_name}).
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnBooking(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/25 transition disabled:opacity-50"
                >
                  {submittingReturn ? 'Menyimpan...' : 'Selesaikan Transaksi & Tutup Sewa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PEMBATALAN OLEH VENDOR */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Pembatalan Pesanan</span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">Batalkan Pesanan Ini?</h2>
              <p className="text-xs text-slate-500 mt-1">
                Pesanan sewa #{cancellingBooking.id.slice(0, 8)} akan dibatalkan.
              </p>
            </div>

            <form onSubmit={handleConfirmCancelVendor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Alasan Pembatalan
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Unit mendadak harus masuk bengkel / Jadwal tidak memungkinkan..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cancellingLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/25 transition disabled:opacity-50"
                >
                  {cancellingLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: ZOOM FOTO FULLSCREEN */}
      {zoomImageUrl && (
        <div
          onClick={() => setZoomImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl">
            <img src={zoomImageUrl} alt="Dokumen Diperbesar" className="w-full h-full object-contain" />
            <span className="absolute top-3 right-3 px-3 py-1 bg-black/60 text-white text-xs font-bold rounded-full">
              ✕ Tutup
            </span>
          </div>
        </div>
      )}

    </div>
  )
}
