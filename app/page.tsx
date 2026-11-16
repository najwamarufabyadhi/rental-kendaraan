import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <span className="px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
          Platform Rental Multi-Vendor
        </span>

        <h1 className="mt-4 text-4xl font-bold text-slate-900">
          SEWA MOTOR dan MOBIL JADI LEBIH MUDAH BERSAMA AWE
        </h1>

        <p className="mt-3 text-slate-900">
          Temukan pilihan motor & mobil terbaik untuk kebutuhan sewa harian atau mingguan di seluruh Indonesia.
        </p>

        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/register"
            className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:g-slate-800">
            Mulai Sekarang (Daftar)
          </Link>
          
          <Link
            href="Login"
          className="px-5 py-2.5 bg-white text-slate-900 font-medium border border-slate-300  rounded-lg hover:g-slate-100">
            Masuk Akun
          </Link>
        </div>
      </div>
    </main>
  )
}