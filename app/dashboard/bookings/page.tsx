'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CustomerBooking {
  id: string
  vehicle_id: string
  service_type: 'self_drive' | 'with_driver'
  start_date: string
  end_date: string
  total_days: number
  grand_total: number
  deposit_amount: number
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
  vendors: {
    business_name: string
    phone: string
  }
}

export default function CustomerBookingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [bookings, setBookings] = useState<CustomerBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')

  // State Modal Pembatalan Pesanan
  const [cancellingBooking, setCancellingBooking] = useState<CustomerBooking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingLoading, setCancellingLoading] = useState(false)

  // State Modal Beri Ulasan & Rating
  const [reviewingBooking, setReviewingBooking] = useState<CustomerBooking | null>(null)
  const [starRating, setStarRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  useEffect(() => {
    const fetchMyBookings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserName(user.user_metadata?.full_name || 'Penyewa')

      // Mengambil data pesanan milik user beserta detail kendaraan & vendornya
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
          vendors (
            business_name,
            phone
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setBookings(data as unknown as CustomerBooking[])
      }
      setLoading(false)
    }

    fetchMyBookings()
  }, [router, supabase])

  // Handler upload bukti transfer pembayaran
  const handleUploadPaymentProof = async (bookingId: string, file: File) => {
    setUploadingId(bookingId)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `payment-proof-${bookingId}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('vehicle-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('vehicle-images')
        .getPublicUrl(fileName)

      const url = publicData.publicUrl

      try {
        await supabase
          .from('bookings')
          .update({ payment_proof_url: url })
          .eq('id', bookingId)
      } catch (err) {
        console.warn('Simpan payment proof ke DB:', err)
      }

      setBookings(
        bookings.map((b) => (b.id === bookingId ? { ...b, payment_proof_url: url } : b))
      )

      alert('Bukti pembayaran berhasil diunggah! Mohon tunggu vendor memverifikasi pembayaran Anda.')
    } catch (err: any) {
      alert('Gagal mengunggah bukti pembayaran: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setUploadingId(null)
    }
  }

  // Handler Pembatalan Pesanan
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancellingBooking) return
    setCancellingLoading(true)

    try {
      const reason = cancelReason.trim() || 'Dibatalkan oleh penyewa'

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

      alert('Pesanan sewa berhasil dibatalkan. Jadwal armada telah dibuka kembali.')
      setCancellingBooking(null)
      setCancelReason('')
    } catch (err: any) {
      alert('Gagal membatalkan pesanan: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setCancellingLoading(false)
    }
  }

  // Handler Submit Ulasan & Rating Bintang
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewingBooking) return
    setReviewLoading(true)

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          rating: starRating,
          review_comment: reviewComment,
        })
        .eq('id', reviewingBooking.id)

      if (error) throw error

      setBookings(
        bookings.map((b) =>
          b.id === reviewingBooking.id
            ? { ...b, rating: starRating, review_comment: reviewComment }
            : b
        )
      )

      alert('Terima kasih atas ulasan dan rating yang Anda berikan!')
      setReviewingBooking(null)
      setReviewComment('')
    } catch (err: any) {
      alert('Gagal mengirimkan ulasan: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setReviewLoading(false)
    }
  }

  // Format tautan chat WhatsApp otomatis ke vendor
  const getWhatsAppVendorLink = (item: CustomerBooking) => {
    const message = `Halo ${item.vendors?.business_name || 'Vendor'}, saya ${userName} ingin konfirmasi pesanan rental #${item.id.slice(0, 8)} untuk unit ${item.vehicles?.brand} ${item.vehicles?.model} (Plat: ${item.vehicles?.plate_number}) periode ${item.start_date} s/d ${item.end_date}. Mohon informasinya, terima kasih!`
    let cleanPhone = (item.vendors?.phone || '').replace(/[^0-9]/g, '')
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1)
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  }

  const getStatusBadge = (status: string, hasProof: boolean) => {
    switch (status) {
      case 'pending_payment':
        return hasProof ? (
          <span className="px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
            ⏳ Verifikasi Pembayaran
          </span>
        ) : (
          <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full border border-red-200 animate-pulse">
            💳 Menunggu Pembayaran
          </span>
        )
      case 'confirmed':
        return <span className="px-3 py-1 text-xs font-bold bg-blue-100 text-[#0F52BA] rounded-full border border-blue-200">Siap Diambil</span>
      case 'in_use':
        return <span className="px-3 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">Sedang Digunakan</span>
      case 'completed':
        return <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">Selesai</span>
      case 'cancelled':
        return <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200">Dibatalkan</span>
      default:
        return <span className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-800 rounded-full">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-slate-800 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F52BA] hover:underline"
              >
                ← Kembali ke Katalog Armada
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                👤 Akun Saya & Dokumen KYC
              </Link>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Riwayat Sewa Saya</h1>
            <p className="text-xs text-slate-500">Kelola dan pantau seluruh status pemesanan kendaraan Anda.</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F52BA] to-[#2563EB] flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
            R
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Memuat riwayat pesanan...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 mx-auto bg-blue-50 text-[#0F52BA] rounded-2xl flex items-center justify-center text-2xl font-bold">
              📑
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Belum Ada Pesanan</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Anda belum pernah memesan kendaraan. Yuk cari unit motor atau mobil idaman Anda di katalog kami!
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-500/20 transition transform active:scale-95"
            >
              Cari Kendaraan Sekarang
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map((item) => {
              const hasProof = Boolean(item.payment_proof_url)
              const canCancel = item.status === 'pending_payment' || item.status === 'confirmed'
              const canReview = item.status === 'completed'

              return (
                <div
                  key={item.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        ID: {item.id.slice(0, 8)}
                      </span>
                      <h2 className="text-lg font-black text-slate-900 mt-1">
                        {item.vehicles?.brand} {item.vehicles?.model}{' '}
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded ml-1">
                          {item.vehicles?.plate_number}
                        </span>
                      </h2>
                    </div>
                    <div>{getStatusBadge(item.status, hasProof)}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-semibold mb-1">Jadwal Sewa ({item.total_days} Hari)</p>
                      <p className="font-bold text-slate-900 text-sm">
                        {item.start_date} <span className="text-slate-400 font-normal">s/d</span> {item.end_date}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-semibold mb-1">Mitra Rental & Tipe Layanan</p>
                      <p className="font-bold text-slate-900 text-sm">
                        {item.vendors?.business_name}{' '}
                        <span className="text-[#0F52BA] font-semibold text-xs">
                          ({item.service_type === 'self_drive' ? 'Lepas Kunci' : 'Dengan Supir'})
                        </span>
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-semibold mb-1">
                        {item.service_type === 'self_drive' ? 'Lokasi Pengambilan Unit' : 'Titik Jemput Supir'}
                      </p>
                      <p className="font-medium text-slate-800">{item.pickup_location}</p>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                      <p className="text-emerald-700 font-semibold mb-1">
                        Total Biaya (Termasuk Deposit Rp {item.deposit_amount.toLocaleString('id-ID')})
                      </p>
                      <p className="text-base font-black text-emerald-600">
                        Rp {item.grand_total.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* KOTAK STATUS PEMBAYARAN */}
                  {item.status === 'pending_payment' && (
                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                            <span>💳</span> Instruksi Pembayaran Sewa
                          </p>
                          <p className="text-[11px] text-blue-800 mt-0.5">
                            Silakan transfer total <strong>Rp {item.grand_total.toLocaleString('id-ID')}</strong> ke rekening bank mitra vendor:
                          </p>
                          <p className="text-xs font-mono font-bold text-slate-800 mt-1 bg-white inline-block px-2.5 py-1 rounded border border-blue-200">
                            BCA: 829-102-9988 a.n. RentalHub Rekening Bersama
                          </p>
                        </div>

                        <div>
                          <label className="inline-block px-4 py-2 bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] hover:from-[#1E3A8A] hover:to-[#172554] text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition">
                            {uploadingId === item.id ? 'Mengunggah...' : hasProof ? '🔄 Ganti Struk Transfer' : '📤 Upload Bukti Transfer'}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingId === item.id}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadPaymentProof(item.id, e.target.files[0])
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {item.payment_proof_url && (
                        <div className="flex items-center gap-3 pt-2 border-t border-blue-200/80">
                          <a
                            href={item.payment_proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-12 h-12 rounded-lg overflow-hidden border border-blue-300 shrink-0 block bg-white"
                          >
                            <img
                              src={item.payment_proof_url}
                              alt="Bukti Bayar"
                              className="w-full h-full object-cover"
                            />
                          </a>
                          <div className="text-[11px] text-blue-900">
                            <p className="font-bold text-emerald-700">✓ Bukti Transfer Telah Terunggah</p>
                            <p className="text-slate-500">
                              Vendor sedang memverifikasi pembayaran Anda sebelum menyiapkan unit.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KOTAK INSPEKSI SERAH-TERIMA DIGITAL */}
                  {(item.handover_fuel_level || item.return_deposit_refunded !== undefined) && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>📋</span> Catatan Inspeksi Serah-Terima Kendaraan
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                        {item.handover_fuel_level && (
                          <div>
                            <span className="text-slate-400 block">Posisi Awal Saat Ambil:</span>
                            <span className="font-semibold text-slate-800">
                              Bensin: {item.handover_fuel_level} • KM: {item.handover_odometer || '-'}
                            </span>
                            {item.handover_notes && (
                              <p className="text-slate-500 italic mt-0.5">"{item.handover_notes}"</p>
                            )}
                          </div>
                        )}
                        {item.return_deposit_refunded !== undefined && item.return_deposit_refunded !== null && (
                          <div>
                            <span className="text-slate-400 block">Pengembalian Uang Jaminan:</span>
                            <span className="font-bold text-emerald-700">
                              Rp {item.return_deposit_refunded.toLocaleString('id-ID')} Dikembalikan
                            </span>
                            {item.return_notes && (
                              <p className="text-slate-500 italic mt-0.5">"{item.return_notes}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* KOTAK ULASAN SAYA JIKA SUDAH MEMBERIKAN REVIEW */}
                  {item.rating && (
                    <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-black text-sm">
                          {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                        </span>
                        <span className="font-bold text-slate-800">Ulasan Anda ({item.rating}/5)</span>
                      </div>
                      {item.review_comment && (
                        <p className="text-slate-600 mt-1 italic text-[11px]">"{item.review_comment}"</p>
                      )}
                    </div>
                  )}

                  {/* KOTAK ALASAN PEMBATALAN */}
                  {item.status === 'cancelled' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                      <strong>Pesanan Dibatalkan:</strong> {item.cancellation_reason || 'Tidak ada keterangan'}
                    </div>
                  )}

                  {/* PENGINGAT 2 IDENTITAS FISIK */}
                  {item.status !== 'cancelled' && item.status !== 'completed' && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                      <span className="text-base shrink-0">⚠️</span>
                      <p>
                        <strong>Ketentuan Wajib Serah-Terima:</strong> Pastikan Anda membawa dan menyerahkan <strong>2 dokumen identitas fisik asli</strong> (misal: e-KTP fisik + NPWP / SIM / BPJS / Paspor / Kartu Pegawai) sebagai jaminan saat bertemu langsung dengan vendor.
                      </p>
                    </div>
                  )}

                  {/* BARIS TOMBOL AKSI: CHAT WA, BATALKAN, BERI ULASAN */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Tombol Chat WhatsApp Otomatis ke Vendor */}
                      <a
                        href={getWhatsAppVendorLink(item)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                      >
                        <span>💬</span> Chat WA Vendor
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Tombol Batalkan Pesanan */}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setCancellingBooking(item)}
                          className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition"
                        >
                          Batalkan Pesanan
                        </button>
                      )}

                      {/* Tombol Beri Rating & Ulasan */}
                      {canReview && !item.rating && (
                        <button
                          type="button"
                          onClick={() => setReviewingBooking(item)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                        >
                          <span>⭐</span> Beri Ulasan & Rating
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

      {/* MODAL 1: BATALKAN PESANAN */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Konfirmasi Pembatalan</span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">Batalkan Pesanan Sewa?</h2>
              <p className="text-xs text-slate-500 mt-1">
                Unit {cancellingBooking.vehicles?.brand} {cancellingBooking.vehicles?.model} (ID: #{cancellingBooking.id.slice(0, 8)}) akan dibatalkan dan tanggal sewa otomatis dibuka kembali.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Alasan Pembatalan
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Perubahan jadwal perjalanan / Urusan mendadak..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={cancellingLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/25 transition disabled:opacity-50"
                >
                  {cancellingLoading ? 'Membatalkan...' : 'Ya, Batalkan Pesanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BERI RATING & ULASAN BINTANG */}
      {reviewingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ulasan Pelanggan</span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">Beri Nilai Pengalaman Sewa</h2>
              <p className="text-xs text-slate-500 mt-1">
                Bagaimana kondisi armada {reviewingBooking.vehicles?.brand} {reviewingBooking.vehicles?.model} dan pelayanan {reviewingBooking.vendors?.business_name}?
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Pilih Rating Bintang:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setStarRating(star)}
                      className={`text-3xl transition transform active:scale-95 ${
                        star <= starRating ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">({starRating} dari 5 Bintang)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Komentar / Pengalaman Anda
                </label>
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Contoh: Mobil sangat bersih, AC dingin, dan vendor ramah saat serah-terima. Sangat puas!"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewingBooking(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reviewLoading}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/25 transition disabled:opacity-50"
                >
                  {reviewLoading ? 'Mengirim...' : 'Kirim Ulasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
