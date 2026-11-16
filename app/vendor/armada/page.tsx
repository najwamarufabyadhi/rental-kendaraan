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

  // State untuk Modal Edit Unit
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [editBrand, setEditBrand] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editYear, setEditYear] = useState(2024)
  const [editTransmission, setEditTransmission] = useState<'automatic' | 'manual'>('automatic')
  const [editPlateNumber, setEditPlateNumber] = useState('')
  const [editDailyRate, setEditDailyRate] = useState('')
  const [editDepositAmount, setEditDepositAmount] = useState('0')
  const [editWithDriver, setEditWithDriver] = useState(false)
  const [editIsActive, setEditIsActive] = useState(true)
  const [editUpdating, setEditUpdating] = useState(false)

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
          is_active: true,
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

  // 3. Membuka Modal Edit Unit & Memuat Data Unit
  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v)
    setEditBrand(v.brand)
    setEditModel(v.model)
    setEditYear(v.year)
    setEditTransmission(v.transmission)
    setEditPlateNumber(v.plate_number)
    setEditDailyRate(String(v.daily_rate))
    setEditDepositAmount(String(v.deposit_amount))
    setEditWithDriver(v.with_driver)
    setEditIsActive(v.is_active)
  }

  // 4. Menyimpan Hasil Perubahan Edit Unit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVehicle) return
    setEditUpdating(true)

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          brand: editBrand,
          model: editModel,
          year: Number(editYear),
          transmission: editTransmission,
          plate_number: editPlateNumber.toUpperCase(),
          daily_rate: Number(editDailyRate),
          deposit_amount: Number(editDepositAmount),
          with_driver: editingVehicle.category === 'car' ? editWithDriver : false,
          is_active: editIsActive,
        })
        .eq('id', editingVehicle.id)

      if (error) {
        throw new Error('Gagal memperbarui data armada: ' + error.message)
      }

      // Update state lokal armada
      setVehicles(
        vehicles.map((v) => {
          if (v.id === editingVehicle.id) {
            return {
              ...v,
              brand: editBrand,
              model: editModel,
              year: Number(editYear),
              transmission: editTransmission,
              plate_number: editPlateNumber.toUpperCase(),
              daily_rate: Number(editDailyRate),
              deposit_amount: Number(editDepositAmount),
              with_driver: editingVehicle.category === 'car' ? editWithDriver : false,
              is_active: editIsActive,
            }
          }
          return v
        })
      )

      alert('Data armada berhasil diperbarui!')
      setEditingVehicle(null)
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat mengupdate kendaraan.')
    } finally {
      setEditUpdating(false)
    }
  }

  // 5. Fungsi Menghapus Unit Kendaraan
  const handleDeleteVehicle = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus unit "${name}" dari armada Anda?`)) return

    try {
      // Hapus data foto di vehicle_images terlebih dahulu
      await supabase.from('vehicle_images').delete().eq('vehicle_id', id)

      const { error } = await supabase.from('vehicles').delete().eq('id', id)
      if (error) {
        throw new Error('Gagal menghapus unit: ' + error.message)
      }

      setVehicles(vehicles.filter((v) => v.id !== id))
      alert(`Unit ${name} berhasil dihapus dari sistem.`)
    } catch (err: any) {
      alert(err?.message || 'Gagal menghapus unit.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F9]">
        <p className="text-slate-500 font-medium">Memuat data armada...</p>
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
                Manajemen Armada Kendaraan
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

        {/* FORM TAMBAH ARMADA BARU */}
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

            {/* Merek & Model */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Merek (Brand)
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Contoh: Honda / Toyota"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tipe / Model
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Contoh: Vario 160 / Avanza Veloz"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              />
            </div>

            {/* Tahun & Transmisi */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tahun Pembuatan
              </label>
              <input
                type="number"
                required
                min={2000}
                max={2030}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Transmisi
              </label>
              <select
                value={transmission}
                onChange={(e) => setTransmission(e.target.value as 'automatic' | 'manual')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              >
                <option value="automatic">Automatic (Matic)</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {/* Plat Nomor */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Nomor Plat Polisi
              </label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="Contoh: N 1234 ABC"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              />
            </div>

            {/* Tarif Harian */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tarif Sewa Harian (Rp/hari)
              </label>
              <input
                type="number"
                required
                min={0}
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="Contoh: 120000"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              />
            </div>

            {/* Uang Jaminan (Deposit) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Uang Jaminan / Deposit (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F52BA]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Uang jaminan dikembalikan ke penyewa saat unit kembali dengan aman.
              </p>
            </div>

            {/* Pilihan Layanan dengan Supir (Khusus Mobil) */}
            {category === 'car' && (
              <div className="flex items-center gap-3 md:col-span-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  id="withDriver"
                  checked={withDriver}
                  onChange={(e) => setWithDriver(e.target.checked)}
                  className="w-4 h-4 text-[#0F52BA] rounded"
                />
                <label htmlFor="withDriver" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Sediakan Opsi "Dengan Supir" untuk unit mobil ini (bebas deposit bagi penyewa)
                </label>
              </div>
            )}

            {/* Upload Banyak Foto Armada */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Foto Armada Kendaraan (Bisa Pilih Banyak Foto Sekaligus)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleSelectFiles}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0F52BA] file:text-white hover:file:bg-[#1E3A8A] cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Format didukung: JPG, PNG, WEBP. Foto urutan pertama akan otomatis dijadikan foto sampul utama.
              </p>

              {/* Preview Foto-foto yang Dipilih */}
              {imagePreviews.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Preview Foto ({imagePreviews.length} Foto Dipilih):
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {imagePreviews.map((url, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                        <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-[#0F52BA] text-white font-bold">
                            Utama
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow"
                          title="Hapus foto ini"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-sm rounded-xl shadow-md shadow-red-500/25 transition transform active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Sedang Mengunggah & Menyimpan...' : '+ Tambahkan ke Katalog Armada'}
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
              Kelola, edit tarif, atau perbarui informasi unit Anda
            </span>
          </div>

          {vehicles.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center text-slate-500 text-sm shadow-sm">
              Belum ada unit kendaraan. Silakan tambahkan motor atau mobil pertama Anda di atas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {vehicles.map((item) => {
                const primaryImg =
                  item.vehicle_images?.find((img) => img.is_primary)?.image_url ||
                  item.vehicle_images?.[0]?.image_url ||
                  item.image_url
                const photoCount = item.vehicle_images?.length || (item.image_url ? 1 : 0)

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition group"
                  >
                    <div>
                      {primaryImg ? (
                        <div className="relative w-full h-44 rounded-xl overflow-hidden mb-3.5 bg-slate-100">
                          <img
                            src={primaryImg}
                            alt={`${item.brand} ${item.model}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {photoCount > 1 && (
                            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[11px] bg-slate-900/80 text-white font-bold backdrop-blur-sm">
                              📷 {photoCount} Foto
                            </span>
                          )}
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.is_active
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {item.is_active ? '● Aktif' : '○ Nonaktif'}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-32 rounded-xl mb-3.5 bg-slate-50 border border-slate-100 flex items-center justify-center text-xs text-slate-400">
                          Belum ada foto
                        </div>
                      )}

                      <div className="flex justify-between items-start">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            item.category === 'motorcycle'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-[#0F52BA]'
                          }`}
                        >
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
                        Tahun {item.year} • {item.transmission}{' '}
                        {item.with_driver ? '• Tersedia Supir' : '• Lepas Kunci'}
                      </p>
                    </div>

                    <div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-semibold">Tarif Sewa</span>
                          <span className="font-black text-slate-900 text-base">
                            Rp {item.daily_rate.toLocaleString('id-ID')}
                            <span className="text-xs font-normal text-slate-500">/hari</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block font-semibold">Uang Jaminan</span>
                          <span className="text-xs font-bold text-slate-700">
                            Rp {item.deposit_amount.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Tombol Aksi: Edit & Hapus */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="flex-1 py-2 px-3 bg-[#0F52BA] hover:bg-[#1E3A8A] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                        >
                          <span>✏️</span> Edit Unit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVehicle(item.id, `${item.brand} ${item.model}`)}
                          className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition"
                          title="Hapus Unit"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* MODAL EDIT UNIT POP-UP */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-[#0F52BA] uppercase tracking-wider">
                  Update Informasi Armada
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Edit Unit {editingVehicle.brand} {editingVehicle.model}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingVehicle(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Merek (Brand)
                  </label>
                  <input
                    type="text"
                    required
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipe / Model
                  </label>
                  <input
                    type="text"
                    required
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tahun Pembuatan
                  </label>
                  <input
                    type="number"
                    required
                    min={2000}
                    max={2030}
                    value={editYear}
                    onChange={(e) => setEditYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Transmisi
                  </label>
                  <select
                    value={editTransmission}
                    onChange={(e) => setEditTransmission(e.target.value as 'automatic' | 'manual')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  >
                    <option value="automatic">Automatic (Matic)</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Plat Nomor Polisi
                  </label>
                  <input
                    type="text"
                    required
                    value={editPlateNumber}
                    onChange={(e) => setEditPlateNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm uppercase focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tarif Harian (Rp/hari)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editDailyRate}
                    onChange={(e) => setEditDailyRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Uang Jaminan / Deposit (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editDepositAmount}
                    onChange={(e) => setEditDepositAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                  />
                </div>
              </div>

              {/* Status Opsi Supir (Mobil Saja) */}
              {editingVehicle.category === 'car' && (
                <div className="flex items-center gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <input
                    type="checkbox"
                    id="editWithDriver"
                    checked={editWithDriver}
                    onChange={(e) => setEditWithDriver(e.target.checked)}
                    className="w-4 h-4 text-[#0F52BA] rounded"
                  />
                  <label htmlFor="editWithDriver" className="text-xs font-semibold text-slate-800 cursor-pointer">
                    Sediakan Opsi "Dengan Supir" untuk unit ini
                  </label>
                </div>
              )}

              {/* Status Ketersediaan Unit (Aktif / Nonaktif) */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Unit Aktif (Tampilkan di marketplace penyewaan). Nonaktifkan bila unit sedang servis/rusak.
                </label>
              </div>

              {/* Tombol Simpan & Batal */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editUpdating}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/25 transition disabled:opacity-50"
                >
                  {editUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
