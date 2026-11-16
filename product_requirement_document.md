# Product Requirement Document (PRD)
## Platform Multi-Vendor Rental Kendaraan Bermotor (Mobil & Motor)

---

## 1. Ringkasan Eksekutif & Visi Produk
Platform ini adalah **marketplace rental kendaraan bermotor (mobil dan motor)** berbasis multi-vendor yang menghubungkan penyewa (*customer*) dengan penyedia rental lokal (*vendor*). Platform ini dirancang untuk memecahkan kendala double-booking, fragmentasi harga sewa, minimnya standardisasi serah-terima unit, serta proses verifikasi identitas (KYC) manual yang rentan penipuan.

### Tujuan Utama:
1. Memberikan transparansi ketersediaan unit mobil dan motor secara *real-time*.
2. Memfasilitasi vendor rental dalam mengelola inventaris, reservasi, dan pencairan dana dalam satu dasbor.
3. Menjamin keamanan transaksi kedua belah pihak melalui rekening bersama (*escrow/payout*) dan pencatatan kondisi fisik unit secara digital.

---

## 2. Target Pengguna (User Personas)

| Role | Deskripsi & Kebutuhan Utama |
| :--- | :--- |
| **Customer (Penyewa)** | Wisatawan, komuter, atau pebisnis yang membutuhkan kendaraan fleksibel. Membutuhkan pencarian cepat berdasarkan kota, filter transmisi, opsi lepas kunci/dengan supir, dan kemudahan pembayaran lokal. |
| **Vendor (Mitra Rental)** | Pemilik usaha rental mobil/motor. Membutuhkan alat untuk memantau armada aktif, mencegah unit disewa ganda, mengelola tarif musiman, dan memproses klaim/deposit. |
| **Super Admin (Platform Operator)** | Pengelola platform. Bertanggung jawab atas verifikasi legalitas mitra vendor, mediasi sengketa, penentuan tarif komisi, dan pemantauan arus kas sistem. |

---

## 3. Fitur Utama & Kebutuhan Fungsional

### A. Modul Customer (Marketplace)
1. **Pencarian Cerdas (Discovery Engine):**
   * Filter: Kota/Lokasi, Rentang Tanggal & Jam Sewa, Jenis Kendaraan (`Mobil` / `Motor`), Transmisi (`Matic` / `Manual`).
   * Filter Khusus Mobil: Opsi *Lepas Kunci* atau *Dengan Supir*.
   * Filter Khusus Motor: Opsi *Include Helm x2*, *Jas Hujan*, *Phone Holder*.
2. **Kalkulasi Biaya Dinamis:**
   * Hitungan sewa harian (24 jam) + overtime proporsional jika melebihi batas jam pengembalian.
   * Rincian biaya transparan: Biaya Sewa Pokok + Deposit Jaminan (jika diaktifkan vendor) + Platform Fee.
3. **Verifikasi Identitas (KYC):**
   * Pengunggahan KTP, SIM (SIM A untuk mobil, SIM C untuk motor), dan selfie penjamin/tiket perjalanan.
4. **Alur Checkout & Notifikasi:**
   * Sistem *temporary inventory lock* (15 menit) saat menunggu pembayaran.
   * Integrasi payment gateway (QRIS, Virtual Account, E-Wallet).
   * Notifikasi status reservasi instan via web/email/WhatsApp.

### B. Modul Vendor (Mitra)
1. **Onboarding & Profil Usaha:**
   * Pengisian data bisnis, alamat fisik penjemputan armada, jam operasional, dan rekening pencairan.
2. **Manajemen Armada (Fleet Management):**
   * Tambah/Ubah/Arsipkan kendaraan: Foto unit, pelat nomor, kapasitas mesin/kursi, tahun pembuatan, tarif harian.
   * Status ketersediaan: *Tersedia*, *Disewa*, *Maintenance*, *Non-aktif*.
3. **Kalender Reservasi & Anti Double-Booking:**
   * Tampilan visual status armada per tanggal/jam.
   * Blokir tanggal mandiri untuk jadwal servis berkala armada.
4. **Digital Handover Checklist (Serah Terima):**
   * Pencatatan kondisi fisik saat serah terima: Level bahan bakar (odometer/fuel bar), checklist baret/lecet, dan upload foto 4 sisi kendaraan.
5. **Manajemen Keuangan:**
   * Rekap pendapatan bersih setelah dipotong komisi platform.
   * Fitur permohonan penarikan dana (*Payout Request*).

### C. Modul Super Admin
1. **Verifikasi Vendor:** Menyetujui atau menolak pendaftaran vendor baru berdasarkan kelayakan dokumen.
2. **Konfigurasi Komisi:** Pengaturan persentase bagi hasil platform (default atau per vendor).
3. **Pusat Resolusi Sengketa:** Penanganan masalah pembatalan sepihak, kerusakan unit, atau sengketa klaim deposit.

---

## 4. Perbedaan Logika Bisnis: Mobil vs Motor

| Parameter | Kategori Motor | Kategori Mobil |
| :--- | :--- | :--- |
| **Persyaratan SIM** | SIM C aktif | SIM A aktif |
| **Opsi Layanan** | Lepas kunci | Lepas kunci atau Dengan Supir |
| **Fasilitas Bawaan** | 1-2 Helm SNI, Jas Hujan, Phone Holder | Ban serep, dongkrak, kartu tol (opsional) |
| **Area Operasi** | Dibatasi radius kota / pulau lokal | Dibatasi provinsi / pulau tertentu |
| **Deposit Keamanan** | Nominal lebih terjangkau / opsional | Nominal lebih tinggi (umumnya wajib lepas kunci) |

---

## 5. Arsitektur Data Inti

```
+--------------------+       +--------------------+
|      profiles      |<------|      vendors       |
| (Auth users data)  |  1:1  | (Vendor profile)   |
+--------------------+       +--------------------+
          |                            |
          | 1:N                        | 1:N
          v                            v
+--------------------+       +--------------------+
|      bookings      |------>|      vehicles      |
| (Order & Payment)  |  N:1  | (Fleet inventory)  |
+--------------------+       +--------------------+
          |
          | 1:1
          v
+--------------------+
|  rental_handovers  |
| (Checkin/Checkout) |
+--------------------+
```

### Definisi Tabel Kunci:
1. **`profiles`**: Menyimpan peran akun (`customer`, `vendor`, `admin`) dan status verifikasi KYC.
2. **`vendors`**: Relasi identitas bisnis mitra yang terhubung ke satu akun profil pengelola.
3. **`vehicles`**: Master data kendaraan yang terikat pada `vendor_id`.
4. **`bookings`**: Entitas transaksi sewa, rentang waktu, detail harga, komisi platform, dan status pembayaran.
5. **`rental_handovers`**: Dokumentasi foto dan checklist inspeksi fisik saat unit diambil dan dikembalikan.

---

## 6. Kebutuhan Non-Fungsional (NFR)

* **Performa & SEO:** Skor Google Lighthouse > 85 untuk performa mobile dan aksesibilitas halaman pencarian.
* **Keamanan Data:** Implementasi *Row Level Security (RLS)* di database untuk memastikan isolasi data antar-vendor dan perlindungan dokumen KTP/SIM.
* **Integritas Waktu:** Seluruh data waktu wajib disimpan dalam format ISO-8601 dengan timezone UTC (`timestamptz`) untuk menghindari kesalahan hitung antar-wilayah (WIB/WITA/WIT).

---

## 7. Rencana Rilis Bertahap (Phased Milestones)

* **Milestone 1 (MVP - Minggu 1-2):**
  * Skema DB & Auth RLS selesai.
  * Dasbor vendor untuk registrasi dan input armada mobil & motor.
* **Milestone 2 (Marketplace Core - Minggu 3):**
  * Halaman katalog dengan pencarian tanggal dan validasi ketersediaan unit.
  * Alur checkout dengan hold booking 15 menit.
* **Milestone 3 (Pembayaran & KYC - Minggu 4):**
  * Integrasi Payment Gateway (Midtrans/Xendit).
  * Fitur upload dokumen identitas dan dasbor admin verifikasi.
* **Milestone 4 (Operasional Serah Terima - Minggu 5):**
  * Form serah terima digital (foto unit & odometer).
  * Sistem penarikan saldo (payout) vendor.