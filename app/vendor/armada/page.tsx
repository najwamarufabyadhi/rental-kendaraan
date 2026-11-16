'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Definisi struktur data Kendaraan untuk TypeScript
interface Vehicle {
  id: string
  category: 'motorcycle' | 'car'
  brand: string
  model: string
  year: number
  transmission: 'automatic' | 'manual'
  plate_number: string
  daily_rate: number
  with_driver: boolean
  deposit_amount: number
  is_active: boolean
}

export default function VendorArmadaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [vendorId, setVendorId] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // State untuk form tambah armada
  const [category, setCategory] = useState<'motorcycle' | 'car'>('motorcycle')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(2024)
  const [transmission, setTransmission] = useState<'automatic' | 'manual'>('automatic')
  const [plateNumber, setPlateNumber] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [depositAmount, setDepositAmount] = useState('0')
  const [withDriver, setWithDriver] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  // 1. Ambil ID Vendor dan daftar kendaraan miliknya saat halaman dibuka
  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Cari profil vendor milik user ini
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!vendorData) {
        router.push('/vendor/dashboard')
        return
      }

      setVendorId(vendorData.id)

      // Ambil semua kendaraan milik vendor ini
      const { data: vehicleList } = await supabase
        .from('vehicles')
        .select('*')
        .eq('vendor_id', vendorData.id)
        .order('created_at', { ascending: false })

      if (vehicleList) {
        setVehicles(vehicleList)
      }
      setLoading(false)
    }

    initData()
  }, [router, supabase])

  // 2. Fungsi menyimpan unit baru ke tabel 'vehicles'
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorId) return
    setSaving(true)

    let uploadedImageUrl: string | null = null

    // 1. Jika vendor memilih file foto, unggah ke Supabase Storage dulu
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${vendorId}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('vehicle-images')
        .upload(fileName, imageFile)

      if (uploadError) {
        alert('Gagal mengunggah foto: ' + uploadError.message)
        setSaving(false)
        return
      }

      // Ambil alamat URL publik dari foto yang baru diunggah
      const { data: publicUrlData } = supabase.storage
        .from('vehicle-images')
        .getPublicUrl(fileName)

      uploadedImageUrl = publicUrlData.publicUrl
    }

    // 2. Simpan data kendaraan beserta URL fotonya ke tabel 'vehicles'
    const { data: newVehicle, error } = await supabase
      .from('vehicles')
      .insert({
        vendor_id: vendorId,
        category: category,
        brand: brand,
        model: model,
        year: Number(year),
        transmission: transmission,
        plate_number: plateNumber.toUpperCase(),
        daily_rate: Number(dailyRate),
        deposit_amount: Number(depositAmount),
        with_driver: category === 'car' ? withDriver : false,
        image_url: uploadedImageUrl,
      })
      .select()
      .single()

    if (error) {
      alert('Gagal menambah kendaraan: ' + error.message)
      setSaving(false)
      return
    }

    setVehicles([newVehicle, ...vehicles])

    // Reset form
    setBrand('')
    setModel('')
    setPlateNumber('')
    setDailyRate('')
    setDepositAmount('0')
    setWithDriver(false)
    setImageFile(null)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat data armada...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Navigasi Atas */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/vendor/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
              ← Kembali ke Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Manajemen Armada</h1>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Foto Kendaraan (JPG / PNG)
          </label>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setImageFile(e.target.files[0])
              }
            }}
            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>

        {/* FORM TAMBAH ARMADA */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Tambah Unit Baru</h2>

          <form onSubmit={handleAddVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kategori: Motor vs Mobil */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Jenis Kendaraan</label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setCategory('motorcycle')
                    setWithDriver(false)
                  }}
                  className={`p-2.5 rounded-lg border text-sm font-medium ${category === 'motorcycle'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600'
                    }`}
                >
                  Sepeda Motor
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('car')}
                  className={`p-2.5 rounded-lg border text-sm font-medium ${category === 'car'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600'
                    }`}
                >
                  Mobil
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Merek</label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder={category === 'motorcycle' ? 'Honda / Yamaha' : 'Toyota / Daihatsu'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model / Tipe</label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder={category === 'motorcycle' ? 'Vario 160 / NMAX' : 'Avanza Veloz / Brio'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tahun Pembuatan</label>
              <input
                type="number"
                required
                min={2010}
                max={2027}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Transmisi</label>
              <select
                value={transmission}
                onChange={(e) => setTransmission(e.target.value as 'automatic' | 'manual')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="automatic">Automatic (Matic)</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Polisi (Plat)</label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 uppercase"
                placeholder="N 1234 AB"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarif Sewa / Hari (Rp)</label>
              <input
                type="number"
                required
                min={10000}
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder="100000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Uang Jaminan / Deposit (Rp)</label>
              <input
                type="number"
                min={0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder="0 jika tanpa deposit"
              />
            </div>

            {/* Opsi Khusus Mobil: Dengan Supir */}
            {category === 'car' && (
              <div className="flex items-center pt-6">
                <input
                  id="withDriver"
                  type="checkbox"
                  checked={withDriver}
                  onChange={(e) => setWithDriver(e.target.checked)}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded"
                />
                <label htmlFor="withDriver" className="ml-2 text-sm text-slate-700">
                  Tersedia opsi sewa <strong>Dengan Supir</strong>
                </label>
              </div>
            )}

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? 'Menyimpan Unit...' : '+ Tambahkan ke Armada'}
              </button>
            </div>
          </form>
        </div>

        {/* DAFTAR ARMADA TERDAFTAR */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Daftar Armada Anda ({vehicles.length} Unit)
          </h2>

          {vehicles.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
              Belum ada unit kendaraan. Silakan tambahkan motor atau mobil pertama Anda di atas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${item.category === 'motorcycle'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                        }`}>
                        {item.category === 'motorcycle' ? 'Motor' : 'Mobil'}
                      </span>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {item.plate_number}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                      {item.brand} {item.model} ({item.year})
                    </h3>
                    <p className="text-sm text-slate-500 capitalize">
                      Transmisi: {item.transmission} {item.with_driver ? '• Tersedia Supir' : '• Lepas Kunci'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                    <div>
                      <span className="text-slate-500">Tarif: </span>
                      <span className="font-bold text-slate-900">
                        Rp {item.daily_rate.toLocaleString('id-ID')}/hari
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Deposit: Rp {item.deposit_amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}