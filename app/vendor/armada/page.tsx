'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface VehicleImage {
  id: string
  image_url: string
  is_primary: boolean
  sort_order: number
}

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
  image_url?: string | null
  vehicle_images?: VehicleImage[]
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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

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

      // Ambil semua kendaraan milik vendor ini beserta galeri fotonya
      const { data: vehicleList } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_images (
            id,
            image_url,
            is_primary,
            sort_order
          )
        `)
        .eq('vendor_id', vendorData.id)
        .order('created_at', { ascending: false })

      if (vehicleList) {
        setVehicles(vehicleList as unknown as Vehicle[])
      }
      setLoading(false)
    }

    initData()
  }, [router, supabase])

  // Handler memilih banyak file foto
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
      setImageFiles(selected)
      const previews = selected.map((file) => URL.createObjectURL(file))
      setImagePreviews(previews)
    }
  }

  // Handler menghapus satu foto dari daftar preview sebelum diunggah
  const handleRemoveFile = (index: number) => {
    const updatedFiles = imageFiles.filter((_, i) => i !== index)
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index)
    setImageFiles(updatedFiles)
    setImagePreviews(updatedPreviews)
  }

  // 2. Fungsi menyimpan unit baru ke tabel 'vehicles' dan 'vehicle_images'
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorId) return
    setSaving(true)

    try {
      const uploadedUrls: string[] = []

      // 1. Unggah semua file foto ke Supabase Storage ('vehicle-images')
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${vendorId}-${Date.now()}-${i}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('vehicle-images')
          .upload(fileName, file)

        if (uploadError) {
          throw new Error('Gagal mengunggah foto: ' + uploadError.message)
        }

        const { data: publicUrlData } = supabase.storage
          .from('vehicle-images')
          .getPublicUrl(fileName)

        uploadedUrls.push(publicUrlData.publicUrl)
      }

      // 2. Simpan data kendaraan ke tabel 'vehicles'
      const primaryUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : null

      const { data: newVehicle, error: vehicleError } = await supabase
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
          image_url: primaryUrl,
        })
        .select()
        .single()

      if (vehicleError) {
        throw new Error('Gagal menambah kendaraan: ' + vehicleError.message)
      }

      // 3. Simpan setiap foto ke tabel relasi 'vehicle_images'
      let savedImages: VehicleImage[] = []
      if (uploadedUrls.length > 0) {
        const imageRecords = uploadedUrls.map((url, idx) => ({
          vehicle_id: newVehicle.id,
          image_url: url,
          is_primary: idx === 0, // Foto pertama sebagai foto sampul utama
          sort_order: idx,
        }))

        const { data: insertedImages, error: imgError } = await supabase
          .from('vehicle_images')
          .insert(imageRecords)
          .select()

        if (!imgError && insertedImages) {
          savedImages = insertedImages as VehicleImage[]
        }
      }

      const vehicleWithImages: Vehicle = {
        ...newVehicle,
        vehicle_images: savedImages,
      }

      setVehicles([vehicleWithImages, ...vehicles])

      // Reset form
      setBrand('')
      setModel('')
      setPlateNumber('')
      setDailyRate('')
      setDepositAmount('0')
      setWithDriver(false)
      setImageFiles([])
      setImagePreviews([])
      alert('Kendaraan dan galeri foto berhasil ditambahkan!')
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat menyimpan kendaraan.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memuat data armada...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Bar Sesuai Desain */}
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
                Manajemen Armada
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/vendor/bookings"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              📑 Pesanan Masuk
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-[#0F52BA] hover:bg-[#1E3A8A] text-white font-semibold rounded-xl text-xs transition shadow-sm"
            >
              🏪 Marketplace
            </Link>
          </div>
        </div>

        {/* FORM TAMBAH ARMADA */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <h2 className="text-lg font-bold text-slate-900">Tambah Unit Kendaraan Baru</h2>
          </div>

          <form onSubmit={handleAddVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kategori: Motor vs Mobil */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Jenis Kendaraan
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setCategory('motorcycle')
                    setWithDriver(false)
                  }}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                    category === 'motorcycle'
                      ? 'border-[#0F52BA] bg-[#0F52BA] text-white shadow-md shadow-blue-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🏍️ Sepeda Motor
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('car')}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                    category === 'car'
                      ? 'border-[#0F52BA] bg-[#0F52BA] text-white shadow-md shadow-blue-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🚗 Mobil
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Merek
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                placeholder={category === 'motorcycle' ? 'Honda / Yamaha' : 'Toyota / Daihatsu'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Model / Tipe
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                placeholder={category === 'motorcycle' ? 'Vario 160 / NMAX' : 'Avanza Veloz / Brio'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tahun Pembuatan
              </label>
              <input
                type="number"
                required
                min={2010}
                max={2027}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Transmisi
              </label>
              <select
                value={transmission}
                onChange={(e) => setTransmission(e.target.value as 'automatic' | 'manual')}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 bg-white text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
              >
                <option value="automatic">Automatic (Matic)</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Nomor Polisi (Plat)
              </label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 uppercase text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none font-mono"
                placeholder="N 1234 AB"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tarif Sewa / Hari (Rp)
              </label>
              <input
                type="number"
                required
                min={10000}
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                placeholder="100000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Uang Jaminan / Deposit (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                placeholder="0 jika tanpa deposit"
              />
            </div>

            {/* Opsi Khusus Mobil: Dengan Supir */}
            {category === 'car' && (
              <div className="flex items-center pt-3">
                <input
                  id="withDriver"
                  type="checkbox"
                  checked={withDriver}
                  onChange={(e) => setWithDriver(e.target.checked)}
                  className="w-4 h-4 text-[#0F52BA] border-slate-300 rounded focus:ring-[#0F52BA]"
                />
                <label htmlFor="withDriver" className="ml-2.5 text-xs font-semibold text-slate-700">
                  Tersedia opsi sewa <strong>Dengan Supir</strong>
                </label>
              </div>
            )}

            {/* Input Multi-Foto Armada */}
            <div className="md:col-span-2 pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Galeri Foto Kendaraan (Bisa pilih beberapa foto sekaligus)
              </label>
              <p className="text-xs text-slate-500 mb-2.5">
                Foto urutan pertama otomatis dijadikan foto sampul utama di katalog.
              </p>
              <input
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={handleSelectFiles}
                className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#0F52BA] hover:file:bg-blue-100 cursor-pointer"
              />

              {/* Preview Foto */}
              {imagePreviews.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      {index === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] bg-[#0F52BA] text-white text-center py-0.5 rounded font-bold uppercase">
                          Sampul
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-90 hover:opacity-100 shadow"
                        title="Hapus foto ini"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 disabled:opacity-50 transition transform active:scale-[0.99]"
              >
                {saving ? 'Menyimpan Unit & Mengunggah Foto...' : '+ Tambahkan ke Armada'}
              </button>
            </div>
          </form>
        </div>

        {/* DAFTAR ARMADA TERDAFTAR (Gaya Kartu Modern Sesuai Gambar) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Armada Aktif ({vehicles.length} Unit)
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Tersedia untuk disewa
            </span>
          </div>

          {vehicles.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center text-slate-500 text-sm shadow-sm">
              Belum ada unit kendaraan. Silakan tambahkan motor atau mobil pertama Anda di atas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {vehicles.map((item) => {
                const primaryImg = item.vehicle_images?.find((img) => img.is_primary)?.image_url || item.vehicle_images?.[0]?.image_url || item.image_url
                const photoCount = item.vehicle_images?.length || (item.image_url ? 1 : 0)

                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      {primaryImg ? (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden mb-3.5 bg-slate-100">
                          <img src={primaryImg} alt={`${item.brand} ${item.model}`} className="w-full h-full object-cover" />
                          {photoCount > 1 && (
                            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[11px] bg-slate-900/75 text-white font-medium backdrop-blur-sm">
                              📷 {photoCount} Foto
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-28 rounded-xl mb-3.5 bg-slate-50 border border-slate-100 flex items-center justify-center text-xs text-slate-400">
                          Belum ada foto
                        </div>
                      )}

                      <div className="flex justify-between items-start">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          item.category === 'motorcycle'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-[#0F52BA]'
                        }`}>
                          {item.category === 'motorcycle' ? '🏍️ Motor' : '🚗 Mobil'}
                        </span>
                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                          {item.plate_number}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 mt-2">
                        {item.brand} {item.model}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        Tahun {item.year} • {item.transmission} {item.with_driver ? '• Tersedia Supir' : '• Lepas Kunci'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                      <div>
                        <span className="text-xs text-slate-400 block">Tarif Sewa</span>
                        <span className="font-extrabold text-slate-900">
                          Rp {item.daily_rate.toLocaleString('id-ID')}
                          <span className="text-xs font-normal text-slate-500">/hari</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Jaminan</span>
                        <span className="text-xs font-semibold text-slate-700">
                          Rp {item.deposit_amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
  )
}