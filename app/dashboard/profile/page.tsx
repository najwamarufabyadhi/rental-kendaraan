'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CustomerProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [savingBio, setSavingBio] = useState(false)
  const [savingEmergency, setSavingEmergency] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  // Data User
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')

  // Biodata
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Kontak Darurat
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  // Dokumen KYC (KTP, SIM A, SIM C)
  const [ktpUrl, setKtpUrl] = useState<string | null>(null)
  const [simAUrl, setSimAUrl] = useState<string | null>(null)
  const [simCUrl, setSimCUrl] = useState<string | null>(null)

  // Keamanan (Password)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      setUserEmail(user.email || '')

      const meta = user.user_metadata || {}

      // Ambil data dari tabel profiles
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        setFullName(profile?.full_name || meta.full_name || '')
        setPhone(profile?.phone || meta.phone || '')
        setAddress(profile?.address || meta.address || '')
        setEmergencyName(profile?.emergency_name || meta.emergency_name || '')
        setEmergencyPhone(profile?.emergency_phone || meta.emergency_phone || '')
        setKtpUrl(profile?.ktp_url || meta.ktp_url || null)
        setSimAUrl(profile?.sim_a_url || meta.sim_a_url || null)
        setSimCUrl(profile?.sim_c_url || meta.sim_c_url || null)
      } catch (err) {
        // Fallback ke user_metadata
        setFullName(meta.full_name || '')
        setPhone(meta.phone || '')
        setAddress(meta.address || '')
        setEmergencyName(meta.emergency_name || '')
        setEmergencyPhone(meta.emergency_phone || '')
        setKtpUrl(meta.ktp_url || null)
        setSimAUrl(meta.sim_a_url || null)
        setSimCUrl(meta.sim_c_url || null)
      }

      setLoading(false)
    }

    fetchUserProfile()
  }, [router, supabase])

  // Helper untuk menyimpan metadata & database profiles secara aman (Self-Healing)
  const syncProfileData = async (dataToUpdate: Record<string, any>) => {
    if (!userId) return

    // 1. Simpan ke Auth user_metadata (selalu aman dan didukung tanpa batasan kolom tabel)
    await supabase.auth.updateUser({
      data: dataToUpdate,
    })

    // 2. Coba update ke tabel profiles
    try {
      const { error } = await supabase
        .from('profiles')
        .update(dataToUpdate)
        .eq('id', userId)

      // Jika ada error kolom tabel belum dibuat di Postgres, lakukan update field utama saja
      if (error && error.message.includes('does not exist')) {
        const fallbackData: Record<string, any> = {}
        if (dataToUpdate.full_name) fallbackData.full_name = dataToUpdate.full_name
        if (dataToUpdate.phone) fallbackData.phone = dataToUpdate.phone
        if (Object.keys(fallbackData).length > 0) {
          await supabase.from('profiles').update(fallbackData).eq('id', userId)
        }
      }
    } catch (err) {
      console.warn('Sync profile table note:', err)
    }
  }

  // 1. Simpan Biodata Pribadi
  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingBio(true)

    try {
      await syncProfileData({
        full_name: fullName,
        phone: phone,
        address: address,
      })
      alert('Biodata diri berhasil diperbarui!')
    } catch (err: any) {
      alert('Gagal menyimpan biodata: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setSavingBio(false)
    }
  }

  // 2. Simpan Kontak Darurat
  const handleSaveEmergency = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEmergency(true)

    try {
      await syncProfileData({
        emergency_name: emergencyName,
        emergency_phone: emergencyPhone,
      })
      alert('Kontak darurat berhasil disimpan!')
    } catch (err: any) {
      alert('Gagal menyimpan kontak darurat: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setSavingEmergency(false)
    }
  }

  // 3. Upload Dokumen KYC (KTP, SIM A, SIM C)
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'ktp' | 'sim_a' | 'sim_c') => {
    if (!e.target.files || e.target.files.length === 0 || !userId) return

    const file = e.target.files[0]
    setUploadingDoc(docType)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `kyc-${userId}-${docType}-${Date.now()}.${fileExt}`

      // Upload ke bucket storage
      const { error: uploadError } = await supabase.storage
        .from('vehicle-images')
        .upload(fileName, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: publicData } = supabase.storage
        .from('vehicle-images')
        .getPublicUrl(fileName)

      const url = publicData.publicUrl

      const updatePayload: Record<string, string> = {}
      if (docType === 'ktp') {
        setKtpUrl(url)
        updatePayload.ktp_url = url
      } else if (docType === 'sim_a') {
        setSimAUrl(url)
        updatePayload.sim_a_url = url
      } else if (docType === 'sim_c') {
        setSimCUrl(url)
        updatePayload.sim_c_url = url
      }

      await syncProfileData(updatePayload)
      alert(`Foto dokumen ${docType.toUpperCase().replace('_', ' ')} berhasil diunggah!`)
    } catch (err: any) {
      alert('Gagal mengunggah dokumen: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setUploadingDoc(null)
    }
  }

  // 4. Ubah Password Akun
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 6) {
      alert('Password baru minimal 6 karakter.')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('Konfirmasi password tidak cocok!')
      return
    }

    setSavingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      alert('Kata sandi berhasil diperbarui! Silakan gunakan password baru ini saat login berikutnya.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      alert('Gagal memperbarui kata sandi: ' + (err?.message || 'Terjadi kesalahan'))
    } finally {
      setSavingPassword(false)
    }
  }

  // Cek Status KYC: Lengkap jika ada KTP dan minimal 1 SIM (SIM A atau SIM C)
  const isKycComplete = Boolean(ktpUrl && (simAUrl || simCUrl))

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F4F9] text-slate-500">
        <div className="w-8 h-8 border-4 border-[#0F52BA] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Memuat profil akun Anda...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-slate-800 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F52BA] hover:underline"
              >
                ← Kembali ke Katalog
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                📋 Pesanan Saya
              </Link>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Profil & Pengaturan Akun
            </h1>
            <p className="text-xs text-slate-500">
              Kelola data diri, kontak serah-terima, verifikasi dokumen KTP/SIM, dan keamanan akun.
            </p>
          </div>

          {/* Status Badge KYC */}
          <div className="flex sm:flex-col items-center sm:items-end gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Status Identitas Rental
            </span>
            {isKycComplete ? (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <span>🛡️</span> Terverifikasi Lengkap
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <span>⚠️</span> Belum Lengkap (KTP / SIM)
              </span>
            )}
          </div>
        </div>

        {/* Informasi Ringkas Akun */}
        <div className="bg-gradient-to-r from-[#0F52BA] to-[#1E3A8A] text-white p-5 rounded-2xl shadow-md shadow-blue-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-black text-xl">
              👤
            </div>
            <div>
              <p className="text-xs text-blue-200 font-semibold">Akun Pelanggan Terdaftar</p>
              <h2 className="text-lg font-black">{fullName || 'Penyewa RentalHub'}</h2>
              <p className="text-xs text-blue-100 font-mono">{userEmail}</p>
            </div>
          </div>
          <div className="text-xs bg-white/10 backdrop-blur px-3 py-1.5 rounded-xl border border-white/20">
            Peran: <strong className="uppercase">Customer (Penyewa)</strong>
          </div>
        </div>

        {/* BAGIAN 1: BIODATA & KONTAK */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F52BA]"></span>
            <h2 className="text-base font-bold text-slate-900">1. Data Diri & Kontak Utama</h2>
          </div>

          <form onSubmit={handleSaveBio} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Lengkap (Sesuai KTP)
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor WhatsApp / HP Aktif
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Penting: Digunakan mitra vendor untuk konfirmasi penjemputan unit.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Alamat Domisili / Tempat Tinggal
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Danau Ranau No. 45, Sawojajar, Kota Malang"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingBio}
                className="px-6 py-2.5 bg-[#0F52BA] hover:bg-[#1E3A8A] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
              >
                {savingBio ? 'Menyimpan...' : 'Simpan Perubahan Biodata'}
              </button>
            </div>
          </form>
        </div>

        {/* BAGIAN 2: VERIFIKASI DOKUMEN RENTAL (KTP & SIM) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="text-base font-bold text-slate-900">
                2. Dokumen Identitas Rental (KTP & SIM)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">Wajib untuk Lepas Kunci</span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Unggah dokumen asli Anda dengan foto yang jelas dan terbaca. Vendor rental membutuhkan data ini sebagai syarat verifikasi keamanan sebelum serah-terima unit.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Kartu KTP */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs font-bold uppercase text-slate-800">1. KTP Asli</h3>
                  {ktpUrl ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Terunggah
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      Wajib
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Kartu Tanda Penduduk WNI.</p>
              </div>

              {ktpUrl ? (
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <img src={ktpUrl} alt="Foto KTP" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>🪪</span>
                  <span className="text-[11px] mt-1">Belum ada foto KTP</span>
                </div>
              )}

              <div>
                <label className="block w-full text-center py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition shadow-sm">
                  {uploadingDoc === 'ktp' ? 'Mengunggah...' : ktpUrl ? '🔄 Ganti Foto KTP' : '📤 Unggah Foto KTP'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingDoc === 'ktp'}
                    onChange={(e) => handleUploadDocument(e, 'ktp')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Kartu SIM A (Mobil) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs font-bold uppercase text-slate-800">2. SIM A (Mobil)</h3>
                  {simAUrl ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Terunggah
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                      Opsional
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Diperlukan untuk sewa mobil lepas kunci.</p>
              </div>

              {simAUrl ? (
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <img src={simAUrl} alt="Foto SIM A" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>🚗</span>
                  <span className="text-[11px] mt-1">Belum ada foto SIM A</span>
                </div>
              )}

              <div>
                <label className="block w-full text-center py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition shadow-sm">
                  {uploadingDoc === 'sim_a' ? 'Mengunggah...' : simAUrl ? '🔄 Ganti Foto SIM A' : '📤 Unggah Foto SIM A'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingDoc === 'sim_a'}
                    onChange={(e) => handleUploadDocument(e, 'sim_a')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Kartu SIM C (Motor) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs font-bold uppercase text-slate-800">3. SIM C (Motor)</h3>
                  {simCUrl ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Terunggah
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                      Opsional
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Diperlukan untuk sewa motor.</p>
              </div>

              {simCUrl ? (
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <img src={simCUrl} alt="Foto SIM C" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>🏍️</span>
                  <span className="text-[11px] mt-1">Belum ada foto SIM C</span>
                </div>
              )}

              <div>
                <label className="block w-full text-center py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition shadow-sm">
                  {uploadingDoc === 'sim_c' ? 'Mengunggah...' : simCUrl ? '🔄 Ganti Foto SIM C' : '📤 Unggah Foto SIM C'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingDoc === 'sim_c'}
                    onChange={(e) => handleUploadDocument(e, 'sim_c')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* BAGIAN 3: KONTAK DARURAT (EMERGENCY CONTACT) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h2 className="text-base font-bold text-slate-900">
              3. Kontak Darurat (Keluarga / Kerabat)
            </h2>
          </div>

          <p className="text-xs text-slate-500">
            Kontak kerabat yang dapat dihubungi oleh vendor jika terjadi situasi darurat di perjalanan.
          </p>

          <form onSubmit={handleSaveEmergency} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Kontak Darurat
                </label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Contoh: Rina Santoso (Istri / Saudara)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor HP Kontak Darurat
                </label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Contoh: 085678901234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingEmergency}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
              >
                {savingEmergency ? 'Menyimpan...' : 'Simpan Kontak Darurat'}
              </button>
            </div>
          </form>
        </div>

        {/* BAGIAN 4: KEAMANAN & GANTI PASSWORD */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <h2 className="text-base font-bold text-slate-900">
              4. Keamanan Akun (Ganti Password)
            </h2>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Kata Sandi Baru
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F52BA] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-500/20 transition disabled:opacity-50"
              >
                {savingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
