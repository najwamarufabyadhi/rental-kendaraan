'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CustomerBooking {
  id: string
  service_type: 'self_drive' | 'with_driver'
  start_date: string
  end_date: string
  total_days: number
  grand_total: number
  deposit_amount: number
  pickup_location: string
  status: 'pending_payment' | 'confirmed' | 'in_use' | 'completed' | 'cancelled'
  payment_proof_url?: string | null
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

  useEffect(() => {
    const fetchMyBookings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

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

      // Coba simpan payment_proof_url ke tabel bookings
      try {
        await supabase
          .from('bookings')
          .update({ payment_proof_url: url })
          .eq('id', bookingId)
      } catch (err) {
        console.warn('Simpan payment proof ke DB:', err)
      }

      // Update state lokal
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
        return <span className="px-3 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">Sedang Berjalan</span>
      case 'completed':
        return <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">Selesai</span>
      case 'cancelled':
        return <span className="px-3 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full border border-red-200">Dibatalkan</span>
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

                  {/* KOTAK STATUS PEMBAYARAN (PENDING PAYMENT) */}
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

                        {/* Input Upload Bukti Transfer */}
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

                      {/* Preview Bukti Pembayaran yang Terunggah */}
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

                  {/* KOTAK PENGINGAT 2 IDENTITAS FISIK */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                    <span className="text-base shrink-0">⚠️</span>
                    <p leading-relaxed>
                      <strong>Ketentuan Wajib Serah-Terima:</strong> Pastikan Anda membawa dan menyerahkan <strong>2 dokumen identitas fisik asli</strong> (misal: e-KTP fisik + NPWP / SIM / BPJS / Paspor / Kartu Pegawai) sebagai jaminan saat bertemu langsung dengan vendor.
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
