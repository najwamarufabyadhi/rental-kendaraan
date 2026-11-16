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
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <Link href="/vendor/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
                        ← Kembali ke Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">Pesanan Masuk & Serah Terima</h1>
                </div>

                {loading ? (
                    <p className="text-center text-slate-500 py-10">Memuat pesanan masuk...</p>
                ) : bookings.length === 0 ? (
                    <div className="bg-white p-10 rounded-xl border border-slate-200 text-center text-slate-500">
                        Belum ada pesanan masuk untuk armada Anda.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((item) => (
                            <div key={item.id} className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                                {/* Baris Atas: Unit & Status */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${item.service_type === 'self_drive'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-sky-100 text-sky-800'
                                                }`}>
                                                {item.service_type === 'self_drive' ? 'Lepas Kunci' : 'Dengan Supir'}
                                            </span>
                                            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                                {item.vehicles?.plate_number}
                                            </span>
                                        </div>
                                        <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                                            {item.vehicles?.brand} {item.vehicles?.model}
                                        </h2>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">Pendapatan Sewa</p>
                                        <p className="text-base font-bold text-emerald-600">
                                            Rp {item.base_price.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>

                                {/* Baris Tengah: Info Penyewa & Jadwal */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-500">Penyewa</p>
                                        <p className="font-semibold text-slate-900">{item.profiles?.full_name}</p>
                                        <p className="text-xs text-slate-600">WA: {item.profiles?.phone || '-'}</p>
                                    </div>

                                    <div>
                                        <p className="text-slate-500">Periode Sewa ({item.total_days} Hari)</p>
                                        <p className="font-medium text-slate-900">
                                            {item.start_date} s/d {item.end_date}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-slate-500">
                                            {item.service_type === 'self_drive' ? 'Jaminan Deposit' : 'Titik Penjemputan'}
                                        </p>
                                        <p className="font-medium text-slate-900">
                                            {item.service_type === 'self_drive'
                                                ? `Rp ${item.deposit_amount.toLocaleString('id-ID')} (Tahan s/d Kembali)`
                                                : item.pickup_location}
                                        </p>
                                    </div>
                                </div>

                                {/* Baris Bawah: Tombol Aksi Serah Terima Sesuai Jenis Layanan */}
                                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                                    <div className="text-xs text-slate-500">
                                        {item.status === 'confirmed' && (
                                            item.service_type === 'self_drive'
                                                ? 'Instruksi: Periksa KTP & SIM asli penyewa sebelum menyerahkan kunci.'
                                                : 'Instruksi: Tugaskan supir menuju titik penjemputan pelanggan.'
                                        )}
                                        {item.status === 'in_use' && (
                                            item.service_type === 'self_drive'
                                                ? 'Unit sedang dipakai. Periksa kondisi bodi & bensin saat pengembalian.'
                                                : 'Perjalanan dengan supir sedang berlangsung.'
                                        )}
                                        {item.status === 'completed' && 'Transaksi selesai dan unit telah kembali.'}
                                    </div>

                                    <div>
                                        {item.status === 'confirmed' && (
                                            <button
                                                disabled={updatingId === item.id}
                                                onClick={() => handleUpdateStatus(item.id, 'in_use')}
                                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                                            >
                                                {item.service_type === 'self_drive'
                                                    ? 'Konfirmasi Serah Kunci (Mulai Sewa)'
                                                    : 'Konfirmasi Supir Jemput (Mulai Trip)'}
                                            </button>
                                        )}

                                        {item.status === 'in_use' && (
                                            <button
                                                disabled={updatingId === item.id}
                                                onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                                            >
                                                {item.service_type === 'self_drive'
                                                    ? 'Unit Kembali & Kembalikan Deposit (Selesai)'
                                                    : 'Konfirmasi Trip Selesai'}
                                            </button>
                                        )}

                                        {item.status === 'completed' && (
                                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
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