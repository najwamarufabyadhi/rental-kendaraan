import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F0F4F9] text-slate-800 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F52BA] to-[#2563EB] flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
              R
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-[#0F52BA] uppercase">RENTALKU</span>
              <span className="text-[10px] block font-semibold text-slate-400 uppercase tracking-widest -mt-1">Multi-Vendor Fleet</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-semibold text-slate-700 hover:text-[#0F52BA] transition"
            >
              Masuk Akun
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-xl shadow-md shadow-red-500/20 transition transform active:scale-95"
            >
              Daftar Gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-16 flex flex-col lg:flex-row items-center gap-12">
        {/* Left text hero */}
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-[#0F52BA] text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Platform Sewa Kendaraan Modern
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            Sewa Motor & Mobil <br className="hidden sm:block" />
            Jadi Lebih Mudah Bersama <span className="text-[#0F52BA]">RentalHub</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Temukan pilihan armada motor & mobil terbaik dari ratusan vendor terpercaya di seluruh Indonesia. Transaksi cepat, transparan, dan jaminan unit terawat.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition transform active:scale-95 text-center"
            >
              Mulai Sewa Sekarang
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-800 font-bold border border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow transition text-center"
            >
              Masuk Vendor / Pelanggan
            </Link>
          </div>

          {/* Quick stats banner */}
          <div className="pt-8 grid grid-cols-3 gap-4 border-t border-slate-200 max-w-md mx-auto lg:mx-0">
            <div>
              <p className="text-2xl font-black text-slate-900">500+</p>
              <p className="text-xs text-slate-500 font-medium">Unit Armada</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#0F52BA]">100%</p>
              <p className="text-xs text-slate-500 font-medium">Vendor Terverifikasi</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600">24/7</p>
              <p className="text-xs text-slate-500 font-medium">Dukungan Layanan</p>
            </div>
          </div>
        </div>

        {/* Right Preview Card / Visual Panel */}
        <div className="flex-1 w-full max-w-lg lg:max-w-none">
          <div className="relative bg-gradient-to-br from-[#0F52BA] to-[#1E3A8A] p-8 sm:p-10 rounded-3xl shadow-2xl text-white overflow-hidden">
            {/* Background circular decorations */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-red-500/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-semibold">
                  Preview Sistem
                </span>
                <span className="text-xs text-blue-200">Katalog & Manajemen Fleet</span>
              </div>

              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center font-bold text-lg">
                    🚗
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Innova Zenix Hybrid 2023</h3>
                    <p className="text-xs text-blue-100">Transmisi Automatic • Lepas Kunci</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs pt-3 border-t border-white/15">
                  <span className="text-blue-200">Tarif Sewa Harian</span>
                  <span className="text-base font-bold text-white">Rp 750.000 <span className="text-xs font-normal text-blue-200">/hari</span></span>
                </div>
              </div>

              {/* 3 mini feature badges */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/15">
                  <p className="font-bold text-white mb-1">⚡ Instant Booking</p>
                  <p className="text-blue-200 text-[11px]">Pesan unit favorit Anda tanpa antre lama.</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/15">
                  <p className="font-bold text-white mb-1">🛡️ Aman & Transparan</p>
                  <p className="text-blue-200 text-[11px]">Data deposit & unit tercatat rapi secara real-time.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 RentalHub. Hak Cipta Dilindungi.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-[#0F52BA]">Login</Link>
            <Link href="/register" className="hover:text-[#0F52BA]">Daftar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
