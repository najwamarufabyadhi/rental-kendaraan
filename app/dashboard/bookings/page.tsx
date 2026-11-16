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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">Siap Diambil / Dijemput</span>
            case 'in_use':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">Sedang Digunakan</span>
            case 'completed':
                return <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">Selesai</span>
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-800 rounded-full">{status}</span>
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
                            ← Kembali ke Katalog
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 mt-1">Pesanan Sewa Saya</h1>
                    </div>
                </div>

                {loading ? (
                    <p className="text-center text-slate-500 py-10">Memuat riwayat pesanan...</p>
                ) : bookings.length === 0 ? (
                    <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-3">
                        <p className="text-slate-500">Anda belum memiliki riwayat penyewaan kendaraan.</p>
                        <Link
                            href="/dashboard"
                            className="inline-block px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
                        >
                            Cari Kendaraan Sekarang
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((item) => (
                            <div key={item.id} className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                                    <div>
                                        <span className="text-xs font-mono text-slate-400">ID: {item.id.slice(0, 8)}</span>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            {item.vehicles.brand} {item.vehicles.model}{' '}
                                            <span className="text-sm font-normal text-slate-500">
                                                ({item.vehicles.plate_number})
                                            </span>
                                        </h2>
                                    </div>
                                    <div>{getStatusBadge(item.status)}</div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-500">Jadwal Sewa ({item.total_days} Hari)</p>
                                        <p className="font-medium text-slate-900">
                                            {item.start_date} s/d {item.end_date}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-slate-500">Layanan & Mitra</p>
                                        <p className="font-medium text-slate-900">
                                            {item.service_type === 'self_drive' ? 'Lepas Kunci' : 'Dengan Supir'} • {item.vendors.business_name}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-slate-500">
                                            {item.service_type === 'self_drive' ? 'Lokasi Pengambilan Unit' : 'Titik Penjemputan Supir'}
                                        </p>
                                        <p className="font-medium text-slate-900">{item.pickup_location}</p>
                                    </div>

                                    <div>
                                        <p className="text-slate-500">Total Pembayaran (Termasuk Deposit Rp {item.deposit_amount.toLocaleString('id-ID')})</p>
                                        <p className="font-bold text-emerald-600">
                                            Rp {item.grand_total.toLocaleString('id-ID')}
                                        </p>
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