# Checking if Git is installed
Write-Host "Memeriksa instalasi Git..." -ForegroundColor Cyan
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git belum terinstall. Menginstall Git via Windows Package Manager (winget)..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget
    Write-Host "Instalasi selesai! Harap tutup terminal ini dan buka kembali IDE/terminal Anda, lalu jalankan kembali script ini." -ForegroundColor Green
    Exit
}

# Initialize Git
Write-Host "Menginisialisasi repositori Git lokal..." -ForegroundColor Cyan
git init

# Configure default branch name to main
git config --global init.defaultBranch main

# Stage all files
Write-Host "Menambahkan semua berkas proyek ke Git..." -ForegroundColor Cyan
git add .

# Create initial commit
Write-Host "Membuat commit pertama..." -ForegroundColor Cyan
git commit -m "Initial commit: MotoCare iOS Liquid Glass App"

# Ensure branch is main
git branch -M main

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Repositori Git Lokal Berhasil Diinisialisasi & Di-commit!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Langkah selanjutnya untuk menghubungkan ke GitHub & Vercel:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Buka https://github.com/new dan buat repositori kosong bernama 'MotoCare'."
Write-Host "   (PENTING: Jangan centang pilihan 'Add a README file', 'Add .gitignore', atau 'Choose a license')."
Write-Host ""
Write-Host "2. Salin dan jalankan perintah berikut di terminal Anda untuk menghubungkannya:" -ForegroundColor Yellow
Write-Host "   git remote add origin https://github.com/<USERNAME_GITHUB_ANDA>/MotoCare.git" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Hubungkan ke Vercel untuk Deploy Otomatis (CI/CD):" -ForegroundColor Cyan
Write-Host "   - Buka https://vercel.com/ dan login menggunakan akun GitHub Anda."
Write-Host "   - Klik tombol 'Add New' -> 'Project'."
Write-Host "   - Impor repositori 'MotoCare' yang baru saja Anda buat."
Write-Host "   - Pada bagian 'Build & Development Settings', klik tombol override/sesuaikan:"
Write-Host "     * Build Command: npm run build (atau: node build.js)"
Write-Host "     * Output Directory: dist"
Write-Host "   - Klik tombol 'Deploy'!"
Write-Host ""
Write-Host "Selesai! Sekarang, setiap kali Anda mengedit kode di IDE dan melakukan push ke GitHub,"
Write-Host "Vercel akan secara otomatis membangun (build) dan memperbarui situs online Anda dalam hitungan detik!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
