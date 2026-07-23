# ⚔️ Pertarungan Empat Kerajaan Hitungan

Game pendidikan matematika berbasis web untuk siswa kelas 7 SMP. Dalam 30 hari,
siswa menghafal dan menguasai fakta hitung dasar 1–9: penjumlahan, pengurangan,
perkalian, dan pembagian.

Game ini bukan kuis biasa. Di dalamnya ada sistem pembelajaran adaptif yang
mendeteksi fakta yang belum dikuasai, menjadwalkan pengulangan berjeda,
mengukur kecepatan dan ketepatan, serta menyimpan perkembangan setiap siswa.

**Target latihan:** 10–15 menit per hari, selama 30 hari.

---

## Pembaruan Keempat (Juli 2026) — Perombakan Tampilan

Akar masalah tampilan "belum jadi" ditemukan: berkas `css/components.css` pada
proyek asli ternyata duplikat `global.css`, sehingga tombol, panel, modal, toast,
input, statistik, dan puluhan komponen lain tampil polos tanpa gaya sama sekali.

Sistem desain baru "RPG pixel modern" (referensi: kotak dialog JRPG klasik dan
panel kayu Stardew Valley, diselaraskan dengan aset pixel milik game ini):

1. `components.css` ditulis ulang penuh — tombol arcade bergradien dengan
   bayangan keras tanpa blur dan efek tekan fisik, panel berpaku emas di sudut,
   modal, toast, bar progres bertakik ala bar HP, tabel, chip, formulir.
2. Plakat soal bergaya perkamen (persis lembar aset "SOAL"), keypad hijau pixel
   sesuai lembar aset, papan nama petarung perkamen mini, bayangan tanah elips
   di bawah sprite agar karakter terasa berpijak.
3. Tipografi game: Pixelify Sans (judul, angka, tombol) + Nunito (teks) —
   **di-host sendiri** di `assets/fonts/` sehingga tetap tampil benar walau
   internet sekolah lambat, tanpa ketergantungan layanan pihak ketiga.
4. Latar langit malam berlapis dengan pola dither pixel halus; judul emas
   berbayangan keras.
5. Diverifikasi otomatis dengan browser headless: semua halaman bebas error
   JavaScript, font termuat, dan warna kunci (perkamen, hijau keypad, emas)
   ter-render sesuai desain. Satu bug runtime lama di `profile-page.js`
   (fungsi `init` kehilangan kata kunci `async`) ikut ditemukan dan diperbaiki
   dalam proses verifikasi ini.

---

## Pembaruan Ketiga (Juli 2026) — Perbaikan Manifest & Audio

1. **Error manifest ikon diperbaiki** — `manifest.webmanifest` sebelumnya menunjuk
   ke `assets/icons/star.png` (96x96 asli) tapi dideklarasikan sebagai 192x192 dan
   512x512, menyebabkan error "Resource size is not correct" di console browser.
   Sekarang memakai `assets/icons/app-icon-192.png` dan `app-icon-512.png`,
   dibuat khusus (karakter Pemimpin di atas latar warna tema) dengan ukuran file
   yang benar-benar cocok dengan deklarasinya. Favicon juga ditambahkan di semua
   halaman (`assets/icons/favicon-32.png`).
2. **404 audio diperbaiki** — 7 file efek suara sebelumnya belum ada sama sekali
   (`assets/audio/*.mp3`), menyebabkan 404 tiap kali pemain berinteraksi (game
   tetap berjalan normal karena `sound-manager.js` menangkap error dengan aman,
   tapi tetap tampil di console). Sekarang sudah ada 7 berkas `.wav` chiptune asli
   (klik, benar, salah, serang, menang, kalah, musik latar) yang disintesis
   langsung — tanpa dependensi eksternal.

Audit otomatis: dari 66 path aset yang dipakai kode, kini hanya 1 yang sengaja
tidak ada (`characters/healer.png` — karakter Tabib belum punya gambar). Ini
aman karena `getAssetPath()` dicek dulu sebelum elemen `<img>` dibuat, sehingga
tidak pernah memicu request jaringan atau 404.

---

## Pembaruan Kedua (Juli 2026)

1. **Ramah mobile** — target sentuh minimal 44px, keypad diperbesar, tanpa zoom
   otomatis saat mengetik di iOS, dukungan safe-area untuk ponsel berponi,
   tab kelas/papan peringkat dapat digulir menyamping, tabel guru dapat digeser,
   dan ukuran sprite menyesuaikan layar sempit maupun mode lanskap.
2. **Perbaikan "tidak bisa menambah kelas"** — query daftar kelas guru tidak lagi
   memerlukan composite index Firestore (penyebab umum kegagalan bila
   `firestore.indexes.json` belum dipasang). Pengurutan kini di sisi klien.
   Pesan error izin/index juga dibuat lebih jelas dan menunjuk ke solusinya.
3. **Tanpa emoji** — seluruh antarmuka kini memakai aset gambar dari folder
   `assets/icons/` dan `assets/effects/` (dipotong dari lembar referensi UI):
   hati, permata, koin, pedang, buku, gir, bintang, api, kilau, dan lainnya.
   Bila sebuah gambar gagal dimuat, penggantinya adalah teks polos — bukan emoji.

---

## Pembaruan Aset (Juli 2026)

Seluruh aset gambar pixel sudah terpasang di folder `assets/` dan langsung dipakai game:

| Lokasi | Isi |
|---|---|
| `assets/ui/main-menu.png` | Halaman depan (`index.html`) — tombol halaman diposisikan tepat di atas tombol yang tergambar |
| `assets/backgrounds/` | Latar arena per kerajaan (battle field) |
| `assets/kingdoms/` | Lambang kerajaan pada kartu peta |
| `assets/characters/`, `assets/enemies/`, `assets/bosses/` | Sprite statis (latar transparan) |
| `assets/idle/` | **Strip animasi idle 4 frame** (1024×256) — dimainkan otomatis di arena lewat CSS `steps(4)`; berhenti di frame 1 bila "kurangi animasi" aktif |
| `assets/ui/ref-*.png` | Lembar referensi UI (HUD, keypad, ikon) untuk pengembangan lanjutan |

Fallback tetap berlaku: jika sebuah gambar gagal dimuat, game otomatis memakai
gambar statis, lalu emoji — tidak pernah error.

Catatan: karakter *Tabib (healer)* belum punya aset gambar, sehingga masih tampil
sebagai emoji 💚. Berkas `js/ui/loading.js` yang sebelumnya hilang sudah dibuat.

---

## Daftar Isi

1. [Fitur Utama](#1-fitur-utama)
2. [Kebutuhan Sistem](#2-kebutuhan-sistem)
3. [Struktur Proyek](#3-struktur-proyek)
4. [Langkah Pemasangan Firebase](#4-langkah-pemasangan-firebase)
5. [Menjalankan Secara Lokal](#5-menjalankan-secara-lokal)
6. [Deploy ke GitHub Pages](#6-deploy-ke-github-pages)
7. [Membuat Akun Guru](#7-membuat-akun-guru)
8. [Cara Menggunakan (Guru)](#8-cara-menggunakan-guru)
9. [Cara Menggunakan (Siswa)](#9-cara-menggunakan-siswa)
10. [Menambahkan Aset Gambar](#10-menambahkan-aset-gambar)
11. [Cara Menguji](#11-cara-menguji)
12. [Keamanan](#12-keamanan)
13. [Batasan yang Diketahui](#13-batasan-yang-diketahui)
14. [Checklist Penyelesaian](#14-checklist-penyelesaian)

---

## 1. Fitur Utama

### Untuk Siswa

| Fitur | Keterangan |
|---|---|
| Tes awal | 40 soal adaptif untuk mengukur kemampuan awal, tanpa hukuman HP |
| Empat kerajaan | Penjumlahan, Pengurangan, Perkalian, Pembagian |
| Menara campuran | Terbuka setelah keempat kerajaan dikuasai |
| Tujuh mode | Latihan, Pertarungan, Kecepatan, Boss, Keluarga Fakta, Perbaiki Jawaban, Campuran |
| Bantuan bertingkat | Empat tingkat: petunjuk → pola → langkah → jawaban |
| Sistem penguasaan | Enam status per fakta, dari `unseen` hingga `automatic` |
| Pengulangan berjeda | Soal salah muncul lagi setelah 3–5 soal; fakta dikuasai diulang 3–7 hari kemudian |
| Papan peringkat | Empat kategori dalam satu kelas; siswa dapat menyembunyikan namanya |
| Profil | Level, XP, streak, lencana, peta fakta 1–9, riwayat 30 hari |
| Luring | Hasil sesi diantre di perangkat bila internet putus, lalu dikirim otomatis |

### Untuk Guru

| Fitur | Keterangan |
|---|---|
| Kelas | Buat, ubah nama, atur, hapus (dengan konfirmasi berlapis) |
| Kode kelas | Kode 6 karakter untuk dibagikan ke siswa |
| Dashboard | Jumlah siswa, aktif hari ini, rata-rata akurasi, rata-rata fakta dikuasai |
| Tabel progres | Filter operasi, pencarian nama, pengurutan |
| Detail siswa | Progres per operasi, fakta paling sering salah, tes awal vs sekarang |
| Pengaturan kelas | Aktifkan/nonaktifkan operasi, durasi mode cepat, target harian, papan peringkat |
| Ekspor | Laporan kelas ke CSV (siap dibuka di Excel) |
| Reset | Reset progres siswa tertentu setelah konfirmasi mengetik |

---

## 2. Kebutuhan Sistem

**Untuk menjalankan:**
- Peramban modern: Chrome, Firefox, Edge, atau Safari (versi 2022 ke atas)
- Koneksi internet (untuk Firebase)

**Untuk mengembangkan:**
- Editor teks (VS Code, Sublime, atau lainnya)
- Node.js 18+ — **hanya** bila ingin memakai Firebase Emulator
- Akun GitHub
- Akun Google (untuk Firebase)

Aplikasi ini **tidak membutuhkan proses build**. Tidak ada webpack, tidak ada
npm install untuk menjalankannya. Cukup file statis.

---

## 3. Struktur Proyek

```text
math-kingdom-game/
├── index.html              Halaman depan
├── student.html            Masuk siswa
├── teacher.html            Masuk guru + dashboard
├── game.html               Peta, arena, hasil, papan peringkat
├── profile.html            Profil siswa
├── manifest.webmanifest
├── firebase.json
├── firestore.rules         Aturan keamanan (WAJIB dipasang)
├── firestore.indexes.json
├── .gitignore
├── .github/workflows/
│   └── deploy-pages.yml    Deployment otomatis
├── css/                    6 file gaya
├── js/
│   ├── asset-manifest.js   Semua path aset di satu tempat
│   ├── config/             Konfigurasi Firebase & game
│   ├── firebase/           Auth, Firestore, kelas, papan peringkat
│   ├── game/               8 mesin permainan
│   ├── pages/              6 pengendali halaman
│   ├── ui/                 Modal, toast, loading, suara, animasi
│   ├── utils/              Validasi, tanggal, CSV, bantuan
│   └── dev/seed-data.js    Data contoh (hanya development)
├── tests/                  Pengujian
└── assets/                 Gambar & audio pixel (opsional)
```

**Prinsip penting:** semua path aset ditulis relatif (`./assets/...`), sehingga
aplikasi bekerja baik di `http://localhost:8000/` maupun di
`https://username.github.io/nama-repo/`.

---

## 4. Langkah Pemasangan Firebase

### Langkah 1 — Membuat Firebase Project

1. Buka https://console.firebase.google.com
2. Klik **Add project** / **Tambah proyek**
3. Beri nama, contoh: `game-kerajaan-matematika`
4. Google Analytics boleh dimatikan (aplikasi ini tidak memakainya)
5. Klik **Create project**

### Langkah 2 — Menambahkan Firebase Web App

1. Di halaman ringkasan proyek, klik ikon **`</>`** (Web)
2. Beri nama aplikasi, contoh: `Kerajaan Matematika Web`
3. **Jangan** centang Firebase Hosting (kita memakai GitHub Pages)
4. Klik **Register app**

### Langkah 3 — Menyalin Konfigurasi Firebase

Firebase akan menampilkan blok seperti ini:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "proyek-anda.firebaseapp.com",
  projectId: "proyek-anda",
  storageBucket: "proyek-anda.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

Salin nilai-nilai tersebut ke `js/config/firebase-config.js`.

> **Catatan keamanan:** nilai-nilai ini **bukan rahasia**. Firebase Web API key
> memang dirancang untuk terlihat publik. Keamanan data ditentukan sepenuhnya
> oleh Authentication + Firestore Security Rules.

Jika file `js/config/firebase-config.js` belum ada, salin dari contohnya:

```bash
cp js/config/firebase-config.example.js js/config/firebase-config.js
```

### Langkah 4 — Mengaktifkan Anonymous Authentication

1. Menu kiri → **Build** → **Authentication**
2. Klik **Get started**
3. Tab **Sign-in method**
4. Pilih **Anonymous** → **Enable** → **Save**

Ini dipakai siswa. Mereka tidak perlu email atau kata sandi.

### Langkah 5 — Mengaktifkan Email/Password Authentication

1. Masih di tab **Sign-in method**
2. Pilih **Email/Password** → **Enable** → **Save**
3. Jangan aktifkan *Email link (passwordless sign-in)*

Ini dipakai guru.

### Langkah 6 — Membuat Cloud Firestore

1. Menu kiri → **Build** → **Firestore Database**
2. Klik **Create database**
3. Pilih **Start in production mode** (jangan test mode)
4. Pilih lokasi terdekat, contoh: `asia-southeast2 (Jakarta)`
5. Klik **Enable**

> Lokasi database **tidak dapat diubah** setelah dibuat. Pilih dengan cermat.

### Langkah 7 — Memasang Firestore Security Rules

**Cara A — lewat Console (paling mudah):**

1. **Firestore Database** → tab **Rules**
2. Hapus seluruh isi yang ada
3. Salin seluruh isi file `firestore.rules` dari repository ini
4. Tempel, lalu klik **Publish**

**Cara B — lewat Firebase CLI:**

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pilih proyek Anda
firebase deploy --only firestore:rules
```

> ⚠️ **Jangan lewati langkah ini.** Tanpa rules yang benar, data siswa terbuka
> untuk siapa saja.

### Langkah 8 — Memasang Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

Atau: biarkan Firebase membuat index otomatis. Bila ada query yang butuh index,
Firebase menampilkan tautan di console peramban — cukup klik tautan itu.

### Langkah 9 — Membuat Akun Guru

1. **Authentication** → tab **Users** → **Add user**
2. Isi email, contoh: `guru@sekolah.sch.id`
3. Isi kata sandi (minimal 6 karakter)
4. Klik **Add user**
5. **Salin UID** yang muncul di daftar (contoh: `k3Jd8fH2...`)

### Langkah 10 — Membuat Dokumen Role Guru Secara Manual

Ini adalah langkah keamanan yang penting: role guru **hanya** bisa dibuat dari
Firebase Console, tidak pernah dari aplikasi.

1. **Firestore Database** → **Start collection**
2. Collection ID: `teachers`
3. Document ID: **tempel UID** dari langkah 9
4. Tambahkan field berikut:

| Field | Tipe | Nilai |
|---|---|---|
| `displayName` | string | `Bu Sari` (nama guru) |
| `email` | string | `guru@sekolah.sch.id` |
| `active` | boolean | `true` |

5. Klik **Save**

Guru sekarang dapat masuk lewat `teacher.html`.

> Jika `active` diisi `false`, guru tersebut tidak dapat masuk. Ini berguna untuk
> menonaktifkan akun tanpa menghapusnya.

### Langkah 11 — Menjalankan Emulator (opsional)

```bash
npm install -g firebase-tools
firebase emulators:start
```

Emulator UI: http://127.0.0.1:4000

Lalu ubah di `js/config/firebase-config.js`:

```javascript
export const USE_EMULATOR = true;
```

**Jangan lupa kembalikan ke `false` sebelum deploy.**

### Langkah 12 — Menguji Aplikasi Lokal

Lihat bagian [Menjalankan Secara Lokal](#5-menjalankan-secara-lokal).

### Langkah 13 — Menghubungkan dengan GitHub Pages

Lihat bagian [Deploy ke GitHub Pages](#6-deploy-ke-github-pages).

### Langkah 14 — Menambahkan Authorized Domain

Setelah situs GitHub Pages aktif:

1. **Authentication** → **Settings** → **Authorized domains**
2. Klik **Add domain**
3. Masukkan: `username.github.io` (ganti dengan username GitHub Anda)
4. Klik **Add**

Tanpa langkah ini, login akan gagal dengan pesan `auth/unauthorized-domain`.

### Langkah 15 — Menguji Login Siswa dan Guru

1. Buka situs GitHub Pages Anda
2. Masuk sebagai guru → buat kelas → salin kode kelas
3. Buka jendela penyamaran (incognito) → masuk sebagai siswa dengan kode itu
4. Kerjakan tes awal
5. Kembali ke dashboard guru → siswa harus muncul di tabel

### Langkah 16 — Menguji Penolakan Akses Ilegal

Buka Console peramban (F12) sebagai **siswa**, lalu jalankan:

```javascript
// Ini HARUS gagal dengan "permission-denied"
const { getFirestore, doc, getDoc } = await import(
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
);
const db = getFirestore();
await getDoc(doc(db, 'students', 'UID_SISWA_LAIN'));
```

Jika perintah ini **berhasil**, berarti rules belum terpasang dengan benar.
Ulangi Langkah 7.

---

## 5. Menjalankan Secara Lokal

ES Modules tidak dapat dimuat lewat protokol `file://`. Anda perlu server lokal.

**Pilihan 1 — Python (biasanya sudah terpasang):**

```bash
cd math-kingdom-game
python3 -m http.server 8000
```

Buka: http://localhost:8000

**Pilihan 2 — Node.js:**

```bash
npx serve -p 8000
```

**Pilihan 3 — VS Code:**

Pasang ekstensi **Live Server**, lalu klik kanan `index.html` → *Open with Live Server*.

---

## 6. Deploy ke GitHub Pages

### Langkah 1 — Membuat Repository

1. Buka https://github.com/new
2. Nama repository, contoh: `math-kingdom-game`
3. Pilih **Public** (GitHub Pages gratis hanya untuk repo publik)
4. **Jangan** centang "Add a README file"
5. Klik **Create repository**

### Langkah 2 — Mengunggah File

**Cara A — lewat antarmuka web (tanpa perintah):**

1. Di halaman repository, klik **uploading an existing file**
2. Seret seluruh isi folder proyek
3. Klik **Commit changes**

**Cara B — lewat Git:**

```bash
cd math-kingdom-game
git init
git add .
git commit -m "Rilis pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/math-kingdom-game.git
git push -u origin main
```

### Langkah 3 — Mengaktifkan GitHub Pages

1. Repository → tab **Settings**
2. Menu kiri → **Pages**
3. Bagian **Source** → pilih **GitHub Actions**

> Penting: pilih **GitHub Actions**, bukan "Deploy from a branch".
> Workflow `deploy-pages.yml` sudah disiapkan di repository ini.

### Langkah 4 — Menunggu Deployment

1. Tab **Actions** → workflow "Deploy ke GitHub Pages" akan berjalan
2. Tunggu hingga muncul tanda centang hijau (sekitar 1 menit)

Jika gagal dengan pesan tentang `firebase-config.js`, artinya file tersebut
belum diunggah atau masih berisi nilai contoh. Perbaiki lalu push ulang.

### Langkah 5 — Melihat Alamat Situs

Alamat situs Anda:

```text
https://USERNAME.github.io/math-kingdom-game/
```

### Langkah 6 — Menambahkan Domain ke Firebase

Kembali ke [Langkah 14](#langkah-14--menambahkan-authorized-domain) di atas.

---

## 7. Membuat Akun Guru

Ringkasnya:

1. **Authentication → Users → Add user** → catat UID
2. **Firestore → collection `teachers` → document dengan ID = UID tersebut**
3. Field: `displayName` (string), `email` (string), `active` (boolean `true`)

Untuk menambah guru lain, ulangi langkah yang sama dengan UID berbeda.

**Mengapa manual?** Karena bila aplikasi bisa membuat role guru, siswa mana pun
bisa mengangkat dirinya sendiri menjadi guru dan membaca data teman-temannya.

---

## 8. Cara Menggunakan (Guru)

1. Buka situs → **Masuk Guru** → isi email & kata sandi
2. Klik **➕ Kelas Baru** → beri nama, contoh `Kelas 7A`
3. Kode kelas 6 karakter muncul → **📋 Salin** → bagikan ke siswa
4. Klik **⚙️ Pengaturan** untuk mengatur:
   - operasi yang diaktifkan (misalnya minggu pertama hanya penjumlahan)
   - durasi mode kecepatan (30/45/60/90 detik)
   - target soal per hari
   - papan peringkat (aktif/nonaktif)
5. Pantau tabel progres siswa; klik **Detail** untuk melihat fakta yang sering salah
6. Klik **⬇️ Ekspor CSV** untuk laporan

---

## 9. Cara Menggunakan (Siswa)

1. Buka situs → **Masuk Siswa**
2. Isi nama panggilan (minimal 2 karakter)
3. Isi kode kelas dari guru
4. Pilih karakter
5. Kerjakan **Tes Awal** (sekitar 40 soal, boleh dilewati bila tidak tahu)
6. Setelah itu, buka **Peta Kerajaan** dan mulai berlatih

**Kontrol saat bertanding:**

| Aksi | Keyboard | Sentuh |
|---|---|---|
| Masukkan angka | Tombol `0`–`9` | Keypad di layar |
| Hapus | `Backspace` | Tombol ⌫ |
| Kirim jawaban | `Enter` | Tombol OK |
| Jeda | `Escape` | Tombol ⏸️ |

Mouse tidak diperlukan.

---

## 10. Menambahkan Aset Gambar

Game **tetap berjalan** tanpa satu pun file gambar — sistem otomatis memakai
emoji sebagai pengganti. Bila ingin memakai aset pixel, letakkan file dengan
nama dan lokasi berikut:

```text
assets/
├── backgrounds/    addition-kingdom.png, subtraction-kingdom.png,
│                   multiplication-kingdom.png, division-kingdom.png,
│                   mixed-tower.png
├── characters/     leader.png, adventurer.png, knight.png,
│                   mage.png, archer.png, healer.png
├── enemies/        slime.png, skeleton.png, goblin.png,
│                   dark-mage.png, orc.png, shadow-ninja.png
├── bosses/         boss-6.png, boss-7.png, boss-8.png,
│                   boss-9.png, mixed-boss.png
├── effects/        correct.png, wrong.png, attack.png, fire.png,
│                   ice.png, heal.png, smoke.png
├── icons/          addition.png, subtraction.png, multiplication.png,
│                   division.png, heart.png, coin.png, star.png,
│                   chest.png, shield.png, sword.png, book.png,
│                   settings.png
└── audio/          correct.mp3, wrong.mp3, attack.mp3, victory.mp3,
                    defeat.mp3, click.mp3, background.mp3
```

**Ukuran yang disarankan:**

| Jenis | Ukuran |
|---|---|
| Karakter & musuh | 64×64 px atau 96×96 px |
| Boss | 128×128 px |
| Latar kerajaan | 512×512 px atau lebih |
| Ikon | 32×32 px atau 64×64 px |

Semua gambar dirender dengan `image-rendering: pixelated`, jadi aset kecil akan
tetap tajam saat diperbesar.

Untuk mengganti nama atau lokasi file, cukup ubah `js/asset-manifest.js`.

---

## 11. Cara Menguji

### Pengujian Logika (di peramban)

Buka:

```text
http://localhost:8000/tests/run-tests.html
```

Halaman ini menjalankan seluruh pengujian generator soal, pemeriksa jawaban,
mesin adaptif, dan mesin penguasaan. Tidak membutuhkan Firebase.

### Pengujian Security Rules (dengan Emulator)

```bash
npm install --save-dev @firebase/rules-unit-testing
firebase emulators:exec --only firestore "node tests/rules.test.js"
```

### Pengujian Manual

Daftar periksa lengkap ada di bagian
[Checklist Penyelesaian](#14-checklist-penyelesaian).

---

## 12. Keamanan

### Yang aman untuk ada di repository

- Firebase Web config (`apiKey`, `projectId`, dan seterusnya) — memang publik
- Seluruh kode frontend

### Yang TIDAK BOLEH ada di repository

- Service account JSON
- Private key
- Admin SDK credential
- Kata sandi guru
- Token rahasia apa pun

Workflow GitHub Actions sudah memeriksa hal ini secara otomatis dan akan
menggagalkan deployment bila menemukan file mencurigakan.

### Model keamanan

| Lapisan | Peran |
|---|---|
| Firebase Authentication | Menentukan *siapa* pengguna |
| Firestore Security Rules | Menentukan *apa* yang boleh diakses — **lapisan utama** |
| Validasi frontend | Kenyamanan pengguna saja, **tidak** bisa dipercaya |

Frontend selalu bisa dimanipulasi oleh pengguna. Karena itu seluruh keputusan
keamanan ada di `firestore.rules`.

### Yang dilindungi

- Siswa tidak dapat membaca progres siswa lain
- Siswa tidak dapat mengubah role menjadi guru
- Guru hanya dapat melihat kelas miliknya sendiri
- Dokumen `teachers/{uid}` tidak dapat ditulis dari aplikasi
- Kode kelas hanya dapat dibaca satu per satu (`get`), tidak bisa dienumerasi (`list`)
- Papan peringkat hanya membaca ringkasan roster, bukan data pribadi

---

## 13. Batasan yang Diketahui

| Batasan | Penjelasan | Rencana |
|---|---|---|
| **Anonymous auth terikat perangkat** | Siswa yang membersihkan data peramban atau ganti perangkat akan kehilangan akses ke progres lamanya (data tetap ada di Firestore, tetapi UID-nya baru) | Fitur "kode pemulihan" atau tautan akun ke email — lihat catatan di bawah |
| **Progres XP client-authoritative** | Siswa yang paham teknis bisa memanipulasi XP lewat console. Rules memvalidasi tipe & rentang, tetapi bukan kebenaran perhitungan | Cloud Functions untuk menghitung XP di server |
| **Papan peringkat memuat seluruh roster** | Untuk kelas > 200 siswa, ini boros bacaan | Simpan agregat papan peringkat di satu dokumen ringkasan |
| **Reset progres siswa lambat** | Menghapus ratusan dokumen fakta dari klien membutuhkan banyak operasi | Cloud Function dengan Admin SDK |
| **Tidak ada mode luring penuh** | Siswa perlu internet untuk memulai sesi; hanya hasil sesi yang bisa diantre | Service Worker + IndexedDB |

### Catatan rencana pemindahan akun

Rancangan untuk versi berikutnya, tidak menghambat MVP:

1. Siswa menerima **kode pemulihan** 8 karakter saat pertama mendaftar
2. Kode disimpan di `students/{uid}.recoveryCodeHash` (hash, bukan teks asli)
3. Di perangkat baru, siswa memasukkan nama + kode kelas + kode pemulihan
4. Cloud Function memverifikasi dan memindahkan seluruh subkoleksi ke UID baru
5. Alternatif yang lebih sederhana: `linkWithCredential` untuk menautkan akun
   anonim ke email, bila siswa punya email

---

## 14. Checklist Penyelesaian

### Pemasangan

- [ ] Firebase project dibuat
- [ ] Web App ditambahkan, konfigurasi disalin ke `js/config/firebase-config.js`
- [ ] Anonymous Authentication diaktifkan
- [ ] Email/Password Authentication diaktifkan
- [ ] Cloud Firestore dibuat dalam **production mode**
- [ ] `firestore.rules` dipasang dan dipublikasikan
- [ ] `firestore.indexes.json` dipasang
- [ ] Akun guru dibuat di Authentication
- [ ] Dokumen `teachers/{uid}` dibuat manual dengan `active: true`
- [ ] Repository GitHub dibuat dan file diunggah
- [ ] GitHub Pages diaktifkan dengan source **GitHub Actions**
- [ ] Workflow berjalan hijau
- [ ] Domain `username.github.io` ditambahkan ke Authorized Domains

### Fungsi Siswa

- [ ] Halaman depan terbuka tanpa error di console
- [ ] Login siswa berhasil dengan nama + kode kelas
- [ ] Kode kelas salah menampilkan pesan bahasa Indonesia yang jelas
- [ ] Nama satu karakter ditolak dengan pesan yang jelas
- [ ] Karakter dapat dipilih
- [ ] Tes awal berjalan dan dapat diselesaikan
- [ ] Tombol Lewati muncul pada tes awal
- [ ] Peta kerajaan menampilkan empat kerajaan
- [ ] Kerajaan kedua terkunci sampai kerajaan pertama mencapai 30%
- [ ] Mode Latihan berjalan
- [ ] Mode Pertarungan menampilkan HP dan animasi serangan
- [ ] Mode Kecepatan menampilkan timer yang berjalan mundur
- [ ] Boss terkunci sampai kerajaan mencapai 50%
- [ ] Jawaban dapat dimasukkan lewat keyboard (`0`–`9`, `Enter`, `Backspace`)
- [ ] Jawaban dapat dimasukkan lewat keypad di layar
- [ ] Jawaban salah menampilkan jawaban benar **dan** strategi
- [ ] Soal yang salah muncul kembali dalam sesi yang sama
- [ ] Tombol Bantuan memberi 4 tingkat petunjuk
- [ ] Halaman hasil menampilkan akurasi, XP, fakta baru, dan pesan motivasi
- [ ] Refresh halaman tidak menghapus progres
- [ ] Papan peringkat menampilkan 4 kategori
- [ ] Tombol sembunyikan nama di papan peringkat bekerja
- [ ] Profil menampilkan peta fakta, lencana, dan riwayat 30 hari

### Fungsi Guru

- [ ] Login guru berhasil
- [ ] Email/kata sandi salah menampilkan pesan yang ramah
- [ ] Akun non-guru ditolak dengan pesan yang jelas
- [ ] Kelas dapat dibuat dan kode kelas muncul
- [ ] Tombol salin kode bekerja
- [ ] Siswa yang bergabung muncul di tabel
- [ ] Pencarian nama bekerja
- [ ] Pengurutan bekerja
- [ ] Detail siswa menampilkan fakta yang sering salah
- [ ] Pengaturan kelas dapat disimpan
- [ ] Papan peringkat dapat dimatikan dari pengaturan
- [ ] Ekspor CSV mengunduh file yang benar
- [ ] Reset progres siswa membutuhkan ketikan `RESET`
- [ ] Hapus kelas membutuhkan ketikan `HAPUS`

### Keamanan

- [ ] Siswa **tidak** dapat membaca `students/{uid_lain}` (uji di console)
- [ ] Siswa **tidak** dapat menulis `teachers/{uid}`
- [ ] Guru **tidak** dapat membaca kelas guru lain
- [ ] Pengguna tanpa login **tidak** dapat membaca apa pun
- [ ] Tidak ada service account di repository
- [ ] `.gitignore` mencakup `serviceAccount*.json`

### Tampilan & Aksesibilitas

- [ ] Berfungsi di layar HP (lebar 360 px)
- [ ] Berfungsi di tablet
- [ ] Berfungsi di laptop
- [ ] Tombol berukuran minimal 48 px
- [ ] Focus state terlihat saat navigasi dengan Tab
- [ ] Feedback jawaban dibacakan pembaca layar (`aria-live`)
- [ ] Opsi kurangi animasi bekerja
- [ ] Game terbuka meski folder `assets/` kosong

---

## Lisensi

Bebas digunakan dan dimodifikasi untuk keperluan pendidikan.

## Dukungan

Bila menemukan masalah, periksa Console peramban (F12) terlebih dahulu.
Sebagian besar masalah berasal dari:

1. Firestore Rules belum dipasang
2. Authorized domain belum ditambahkan
3. Anonymous Authentication belum diaktifkan
4. Dokumen `teachers/{uid}` belum dibuat atau `active` bukan `true`