'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface VendorBooking {
    id: string
    service_type: 'self_drive' | 'with_driver'
    start_date: string
    end_date: string
    total_days: number
    base_price: number
    deposit_amount: number
    grand_total: number
    pickup_location: string
    status: 'pending_payment' | 'confirmed' | 'in_use' | 'completed' | 'cancelled'
    vehicles: {
        brand: string
        model: string
        plate_number: string
    }
    profiles: {
        full_name: string
        phone: string
    }
}

export default function VendorBookingsPage() {
    const router = useRouter()
    const supabase = createClient()

    const [bookings, setBookings] = useState<VendorBooking[]>([])
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    useEffect(() => {
        const fetchVendorBookings = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data: vendor } = await supabase
                .from('vendors')
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle()

            if (!vendor) {
                router.push('/vendor/dashboard')
                return
            }

            // Ambil pesanan masuk beserta data armada & data penyewa (profiles)
            const { data, error } = await supabase
                .from('bookings')
                .select(`
          *,
          vehicles (
            brand,
            model,
            plate_number
          ),
          profiles (
            full_name,
            phone
          )
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

    // Fungsi untuk memperbarui status serah terima (confirmed -> in_use -> completed)
    const handleUpdateStatus = async (bookingId: string, nextStatus: 'in_use' | 'completed') => {
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

        // Perbarui status di state lokal agar tampilan langsung berubah
        setBookings(
            bookings.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b))
        )
        setUpdatingId(null)
    }

    return (
        <div className="min-h-screen bg-[#F0F4F9] p-4 md:p-8">
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
                                Pesanan Masuk & Serah Terima
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                    <p className="text-center text-slate-500 py-12 font-medium">Memuat pesanan masuk...</p>
                ) : bookings.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center text-slate-500 text-sm shadow-sm">
                        Belum ada pesanan masuk untuk armada Anda saat ini.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((item) => (
                            <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 hover:shadow-md transition">
                                {/* Baris Atas: Unit & Status */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full ${item.service_type === 'self_drive'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-sky-100 text-sky-800'
                                                }`}>
                                                {item.service_type === 'self_drive' ? 'Lepas Kunci' : 'Dengan Supir'}
                                            </span>
                                            <span className="text-xs font-mono bg-slate-100 px-2.5 py-0.5 rounded text-slate-700 font-bold">
                                                {item.vehicles?.plate_number}
                                            </span>
                                        </div>
                                        <h2 className="text-lg font-black text-slate-900 mt-2">
                                            {item.vehicles?.brand} {item.vehicles?.model}
                                        </h2>
                                    </div>

                                    <div className="md:text-right">
                                        <p className="text-xs text-slate-400 font-semibold uppercase">Pendapatan Sewa</p>
                                        <p className="text-lg font-black text-emerald-600">
                                            Rp {item.base_price.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>

                                {/* Baris Tengah: Info Penyewa & Jadwal */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase">Penyewa</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{item.profiles?.full_name}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">WA: {item.profiles?.phone || '-'}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase">Periode ({item.total_days} Hari)</p>
                                        <p className="font-bold text-slate-900 mt-0.5">
                                            {item.start_date} s/d {item.end_date}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase">
                                            {item.service_type === 'self_drive' ? 'Uang Deposit' : 'Titik Jemput'}
                                        </p>
                                        <p className="font-bold text-slate-900 mt-0.5">
                                            {item.service_type === 'self_drive'
                                                ? `Rp ${item.deposit_amount.toLocaleString('id-ID')} (Jaminan)`
                                                : item.pickup_location}
                                        </p>
                                    </div>
                                </div>

                                {/* Baris Bawah: Tombol Aksi */}
                                <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                                    <div className="text-xs text-slate-500 font-medium">
                                        {item.status === 'confirmed' && (
                                            item.service_type === 'self_drive'
                                                ? '⚠️ Instruksi: Periksa KTP & SIM asli penyewa sebelum menyerahkan kunci.'
                                                : '🚗 Instruksi: Tugaskan supir menuju titik penjemputan pelanggan.'
                                        )}
                                        {item.status === 'in_use' && (
                                            item.service_type === 'self_drive'
                                                ? '⏱️ Unit sedang dipakai. Periksa kondisi bodi & bensin saat kembali.'
                                                : '⏱️ Perjalanan dengan supir sedang berlangsung.'
                                        )}
                                        {item.status === 'completed' && '✅ Transaksi selesai dan unit telah kembali ke garasi.'}
                                    </div>

                                    <div>
                                        {item.status === 'confirmed' && (
                                            <button
                                                disabled={updatingId === item.id}
                                                onClick={() => handleUpdateStatus(item.id, 'in_use')}
                                                className="px-5 py-2.5 bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] hover:from-[#1E3A8A] hover:to-[#172554] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
                                            >
                                                {item.service_type === 'self_drive'
                                                    ? 'Serah Kunci (Mulai Sewa)'
                                                    : 'Supir Jemput (Mulai Trip)'}
                                            </button>
                                        )}

                                        {item.status === 'in_use' && (
                                            <button
                                                disabled={updatingId === item.id}
                                                onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                                            >
                                                {item.service_type === 'self_drive'
                                                    ? 'Unit Kembali & Kembalikan Deposit'
                                                    : 'Konfirmasi Trip Selesai'}
                                            </button>
                                        )}

                                        {item.status === 'completed' && (
                                            <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl">
                                                ✓ Selesai
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )

}