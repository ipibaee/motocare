# MotoCare - Riwayat Servis Motor & Dashboard SaaS

MotoCare adalah aplikasi web responsif (mobile-first dengan gaya iOS native Liquid Glass dan desktop dashboard SaaS) untuk mencatat riwayat servis motor, melacak perjalanan, serta mengelola suku cadang secara interaktif.

## Fitur Utama

- **Odometer & Pelacakan Perjalanan**: Edit kilometer secara langsung atau rekam rute perjalanan untuk memperbarui odometer secara dinamis.
- **Manajemen Komponen**: Indikator status pakai (Merah = Urgent, Biru = Prima, Abu-abu = Normal) dengan saran perawatan berkala.
- **Log Riwayat Servis**: Pencatatan riwayat lengkap disertai biaya, tanggal, dan catatan penggantian suku cadang.
- **Daftar Bengkel Favorit**: Cari bengkel terdekat atau catat bengkel langganan Anda secara lokal/cloud.
- **Supabase Auth & Database fallback**: Login email/password, Google Auth, serta sinkronisasi otomatis ke cloud. Jika belum terkonfigurasi, aplikasi beralih otomatis ke mode offline menggunakan `localStorage`.

---

## Instalasi & Cara Menjalankan

### 1. Kloning & Persiapan
Pastikan Anda memiliki [Node.js](https://nodejs.org/) terinstal di sistem Anda.

### 2. Konfigurasi Lingkungan
Buat salinan berkas `.env.example` menjadi `.env` di direktori utama:
```bash
cp .env.example .env
```
Isi variabel dengan kredensial proyek Supabase Anda:
```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Jalankan Server Lokal
Jalankan perintah berikut untuk memulai server pengembangan:
```bash
npm run dev
```
Buka [http://localhost:3000/](http://localhost:3000/) di browser Anda.

---

## Membangun Proyek (Build)

Untuk menghasilkan salinan produksi siap saji (static bundle) di dalam direktori `dist/`, jalankan:
```bash
npm run build
```

---

## Unggah ke GitHub

Untuk mengunggah proyek ini pertama kali ke repositori GitHub Anda:

```bash
# Inisialisasi Git
git init

# Tambahkan semua file (dikecualikan oleh .gitignore)
git add .

# Buat Commit awal
git commit -m "initial motocare app"

# Hubungkan ke repositori online Anda
git remote add origin URL_REPO_ANDA

# Push ke cabang utama
git push -u origin main
```

---

## Deployment Gratis

### Ke Vercel / Netlify
Aplikasi ini dirancang sebagai SPA (Single Page Application) statis sehingga dapat langsung dideploy secara gratis:
1. Hubungkan akun GitHub Anda ke Vercel atau Netlify.
2. Pilih repositori `motocare`.
3. Setel direktori build/output ke `dist`.
4. Masukkan variabel environment `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada tab konfigurasi proyek Vercel/Netlify jika ingin menghubungkannya ke database Supabase.
5. Klik **Deploy**!
