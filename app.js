let cacheBerita = [];
let cacheGuruPublik = [];
let activeKategoriBerita = 'Semua';
let sekolahSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    await loadAllPublicContent();
});

function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('open');
}

function closeMobileNav() {
    document.getElementById('nav-links').classList.remove('open');
}

function showLoader(text = 'Memproses...') {
    const el = document.getElementById('global-loader');
    if (el) {
        document.getElementById('loader-text').textContent = text;
        el.classList.remove('hidden');
    }
}

function hideLoader() {
    const el = document.getElementById('global-loader');
    if (el) el.classList.add('hidden');
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function formatWaNumber(raw) {
    const cleaned = (raw || '6285298875399').replace(/[^0-9]/g, '');
    return cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
}

async function loadAllPublicContent() {
    try {
        const [resPengaturan, resSiswa, resGuru, resMapel, resLibur, resPpdbCount] = await Promise.all([
            db.from('pengaturan').select('*'),
            db.from('siswa').select('ID_SISWA, KELAS, STATUS'),
            db.from('guru').select('nama_guru, jabatan, mapel_diampu, status_kepegawaian, status').order('nama_guru', { ascending: true }),
            db.from('mapel').select('id'),
            db.from('hari_libur').select('*').order('TANGGAL', { ascending: true }),
            db.from('pendaftar_ppdb').select('id', { count: 'exact', head: true })
        ]);

        // 1. Identitas & WhatsApp Sekolah
        sekolahSettings = {};
        (resPengaturan.data || []).forEach(p => { sekolahSettings[p.kunci] = p.nilai; });

        const namaSekolah = sekolahSettings['nama_sekolah'] || sekolahSettings['NAMA_SEKOLAH'] || 'Portal Resmi Sekolah';
        const alamatSekolah = sekolahSettings['alamat_sekolah'] || sekolahSettings['ALAMAT_SEKOLAH'] || 'Indonesia';
        const tahunAjaranPPDB = sekolahSettings['tahun_ajaran_ppdb'] || '2026/2027';
        const waNumber = formatWaNumber(sekolahSettings['wa_sekolah']);
        const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent('Halo Admin ' + namaSekolah + ', saya ingin menanyakan informasi sekolah.')}`;

        document.title = namaSekolah;
        document.getElementById('pub-nav-title').textContent = namaSekolah;
        document.getElementById('pub-hero-title').textContent = `Selamat Datang di ${namaSekolah}`;
        document.getElementById('hero-ppdb-pill').textContent = `PPDB Tahun Ajaran ${tahunAjaranPPDB} Dibuka`;
        document.getElementById('ppdb-ta-badge').textContent = `PPDB Tahun Ajaran ${tahunAjaranPPDB}`;
        document.getElementById('pub-footer-text').textContent = `© ${new Date().getFullYear()} ${namaSekolah}. Seluruh Hak Cipta Dilindungi.`;
        document.getElementById('contact-alamat').textContent = alamatSekolah;
        document.getElementById('contact-wa-text').textContent = `+${waNumber}`;

        if (resPpdbCount && typeof resPpdbCount.count === 'number') {
            document.getElementById('ppdb-total-pendaftar').textContent = resPpdbCount.count;
        }

        ['hero-wa-btn', 'section-wa-btn', 'floating-wa-btn'].forEach(btnId => {
            const el = document.getElementById(btnId);
            if (el) el.href = waLink;
        });

        // Render Identitas Sekolah
        const idList = document.getElementById('pub-identitas-list');
        const publicSettings = (resPengaturan.data || []).filter(p =>
            !p.kunci.toLowerCase().includes('password') &&
            !p.kunci.toLowerCase().includes('token') &&
            !p.kunci.toLowerCase().startsWith('jurusan_')
        );

        idList.innerHTML = publicSettings.length
            ? publicSettings.map(p => `
                <div class="kv-row">
                    <span class="kv-key">${p.kunci.replace(/_/g, ' ')}</span>
                    <span class="kv-val">${p.nilai || '-'}</span>
                </div>
            `).join('')
            : '<p class="text-muted text-sm">Profil sekolah belum diatur.</p>';

        // 2. Statistik
        const siswaAktif = (resSiswa.data || []).filter(s => !s.STATUS || s.STATUS.toUpperCase() === 'AKTIF');
        const guruAktif = (resGuru.data || []).filter(g => !g.status || g.status.toLowerCase() === 'aktif');
        const rombelCount = new Set(siswaAktif.map(s => s.KELAS).filter(Boolean)).size;

        document.getElementById('pub-stat-siswa').textContent = siswaAktif.length;
        document.getElementById('pub-stat-guru').textContent = guruAktif.length;
        document.getElementById('pub-stat-mapel').textContent = (resMapel.data || []).length;
        document.getElementById('pub-stat-kelas').textContent = rombelCount;

        // 3. Kompetensi Keahlian (Jurusan) + Isi Dropdown Pilihan Jurusan di Form PPDB
        renderKompetensiKeahlian(siswaAktif, sekolahSettings);

        // 4. Direktori Pendidik
        cacheGuruPublik = guruAktif;
        renderPublikGuru();

        // 5. Kalender Libur
        const liburList = resLibur.data || [];
        document.getElementById('pub-libur-list').innerHTML = liburList.length
            ? liburList.map(l => `
                <div class="list-item-card">
                    <strong>${l.KETERANGAN_LIBUR}</strong>
                    <span class="badge badge-danger">${l.TANGGAL}</span>
                </div>
            `).join('')
            : '<p class="text-muted text-sm">Belum ada jadwal hari libur tercatat.</p>';

        // 6. Berita & Kegiatan
        await loadBeritaSekolah();

    } catch (err) {
        console.error('Gagal memuat konten publik:', err);
    }
}

// ================= KOMPETENSI KEAHLIAN (JURUSAN) =================
function extractNamaJurusan(kelasStr) {
    if (!kelasStr) return 'Umum';
    let cleaned = kelasStr.trim()
        .replace(/^(XII|XI|X|12|11|10)\s+/i, '')
        .replace(/\s+[0-9A-D]$/i, '')
        .trim();
    return cleaned || kelasStr.trim();
}

function getMetadataJurusan(kodeJurusan, settings) {
    const keyUpper = kodeJurusan.toUpperCase();
    const customDesc = settings[`jurusan_${kodeJurusan}`] || settings[`jurusan_${keyUpper}`];

    const kamusSMK = {
        'TKJ': {
            nama: 'Teknik Komputer dan Jaringan (TKJ)',
            icon: 'ph-fill ph-network',
            warna: 'blue',
            deskripsi: 'Mempelajari instalasi jaringan komputer, administrasi server, routing & switching MikroTik, fiber optik, serta keamanan jaringan.'
        },
        'TJKT': {
            nama: 'Teknik Jaringan Komputer dan Telekomunikasi (TJKT)',
            icon: 'ph-fill ph-network',
            warna: 'blue',
            deskripsi: 'Kompetensi keahlian di bidang infrastruktur jaringan komputer, sistem telekomunikasi modern, cloud computing, dan manajemen perangkat jaringan.'
        },
        'RPL': {
            nama: 'Rekayasa Perangkat Lunak (RPL)',
            icon: 'ph-fill ph-code',
            warna: 'teal',
            deskripsi: 'Fokus pada pemrograman aplikasi web, mobile, perancangan basis data, dan pengembangan sistem perangkat lunak.'
        },
        'PERHOTELAN': {
            nama: 'Perhotelan',
            icon: 'ph-fill ph-buildings',
            warna: 'orange',
            deskripsi: 'Membekali peserta didik dengan keterampilan layanan front office, housekeeping, tata boga dasar, dan manajemen keramahtamahan pariwisata.'
        },
        'APHP': {
            nama: 'Agribisnis Pengolahan Hasil Perikanan (APHP)',
            icon: 'ph-fill ph-fish',
            warna: 'teal',
            deskripsi: 'Mengembangkan kompetensi pengolahan hasil perikanan dan kelautan modern, pengendalian mutu pangan, serta kewirausahaan bahari.'
        },
        'NKPI': {
            nama: 'Nautika Kapal Penangkap Ikan (NKPI)',
            icon: 'ph-fill ph-anchor',
            warna: 'blue',
            deskripsi: 'Pendidikan vokasi kemaritiman di bidang navigasi pelayaran, teknik penangkapan ikan, dan keselamatan operasional kapal.'
        },
        'TKPI': {
            nama: 'Teknika Kapal Penangkap Ikan (TKPI)',
            icon: 'ph-fill ph-gear-six',
            warna: 'orange',
            deskripsi: 'Kompetensi keahlian permesinan kapal, perawatan motor diesel maritim, dan sistem kelistrikan perkapalan.'
        }
    };

    for (const [k, info] of Object.entries(kamusSMK)) {
        if (keyUpper.includes(k)) {
            return {
                nama: info.nama,
                icon: info.icon,
                warna: info.warna,
                deskripsi: customDesc || info.deskripsi
            };
        }
    }

    return {
        nama: kodeJurusan,
        icon: 'ph-fill ph-graduation-cap',
        warna: 'green',
        deskripsi: customDesc || `Program kompetensi keahlian ${kodeJurusan} dengan pembelajaran berbasis praktik industri dan kewirausahaan.`
    };
}

function renderKompetensiKeahlian(siswaAktif, settings) {
    const grid = document.getElementById('jurusan-grid');
    const sel1 = document.getElementById('ppdb-jurusan-1');
    const sel2 = document.getElementById('ppdb-jurusan-2');

    const mapJurusan = {};
    siswaAktif.forEach(s => {
        if (!s.KELAS) return;
        const namaJur = extractNamaJurusan(s.KELAS);
        if (!mapJurusan[namaJur]) {
            mapJurusan[namaJur] = { siswaCount: 0, rombelSet: new Set() };
        }
        mapJurusan[namaJur].siswaCount += 1;
        mapJurusan[namaJur].rombelSet.add(s.KELAS.trim());
    });

    const daftarJurusan = Object.entries(mapJurusan);

    // Isi pilihan dropdown jurusan pada Formulir PPDB
    const opsiJurusan = daftarJurusan.length > 0
        ? daftarJurusan.map(([kode]) => {
            const meta = getMetadataJurusan(kode, settings);
            return `<option value="${meta.nama}">${meta.nama}</option>`;
        }).join('')
        : `
            <option value="Teknik Komputer dan Jaringan (TKJ)">Teknik Komputer dan Jaringan (TKJ)</option>
            <option value="Perhotelan">Perhotelan</option>
            <option value="Nautika Kapal Penangkap Ikan (NKPI)">Nautika Kapal Penangkap Ikan (NKPI)</option>
            <option value="Agribisnis Pengolahan Hasil Perikanan (APHP)">Agribisnis Pengolahan Hasil Perikanan (APHP)</option>
        `;

    if (sel1) sel1.innerHTML = '<option value="">-- Pilih Jurusan Utama --</option>' + opsiJurusan;
    if (sel2) sel2.innerHTML = '<option value="">-- Opsional / Jurusan Cadangan --</option>' + opsiJurusan;

    if (!grid) return;
    if (daftarJurusan.length === 0) {
        grid.innerHTML = '<div class="section-card"><p class="text-muted text-sm">Data kompetensi keahlian akan tampil otomatis setelah data kelas siswa tersedia.</p></div>';
        return;
    }

    grid.innerHTML = daftarJurusan.map(([kode, stats]) => {
        const meta = getMetadataJurusan(kode, settings);
        return `
            <article class="jurusan-card border-${meta.warna}">
                <div class="jurusan-top">
                    <div class="jurusan-icon bg-soft-${meta.warna}">
                        <i class="${meta.icon}"></i>
                    </div>
                    <div class="jurusan-badges">
                        <span class="badge badge-info">${stats.rombelSet.size} Rombel</span>
                        <span class="badge badge-success">${stats.siswaCount} Siswa</span>
                    </div>
                </div>
                <h4 class="jurusan-title">${meta.nama}</h4>
                <p class="jurusan-desc">${meta.deskripsi}</p>
                <div class="jurusan-rombel-list">
                    ${[...stats.rombelSet].sort().map(r => `<span class="rombel-tag">${r}</span>`).join('')}
                </div>
            </article>
        `;
    }).join('');
}

// ================= FORMULIR PPDB ONLINE & KONFIRMASI WA =================
async function submitFormPPDB(event) {
    event.preventDefault();

    const tahun = new Date().getFullYear();
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const noPendaftaran = `PPDB-${tahun}-${random4}`;

    const payload = {
        no_pendaftaran: noPendaftaran,
        nama_lengkap: document.getElementById('ppdb-nama').value.trim(),
        nisn: document.getElementById('ppdb-nisn').value.trim() || null,
        jenis_kelamin: document.getElementById('ppdb-jk').value,
        tempat_lahir: document.getElementById('ppdb-tempat-lahir').value.trim(),
        tanggal_lahir: document.getElementById('ppdb-tanggal-lahir').value,
        asal_sekolah: document.getElementById('ppdb-asal-sekolah').value.trim(),
        pilihan_jurusan_1: document.getElementById('ppdb-jurusan-1').value,
        pilihan_jurusan_2: document.getElementById('ppdb-jurusan-2').value || null,
        no_wa_siswa: document.getElementById('ppdb-wa').value.trim(),
        nama_orang_tua: document.getElementById('ppdb-ortu').value.trim(),
        alamat: document.getElementById('ppdb-alamat').value.trim(),
        status_pendaftaran: 'Menunggu Verifikasi'
    };

    showLoader('Mengirim formulir pendaftaran PPDB...');
    try {
        const { error } = await db.from('pendaftar_ppdb').insert([payload]);
        if (error) throw error;

        // Siapkan pesan konfirmasi otomatis untuk WhatsApp Panitia PPDB
        const namaSekolah = sekolahSettings['nama_sekolah'] || 'Panitia PPDB Sekolah';
        const waPanitia = formatWaNumber(sekolahSettings['wa_ppdb'] || sekolahSettings['wa_sekolah']);

        const pesanWA = [
            `Halo Panitia PPDB *${namaSekolah}*,`,
            `Saya telah melakukan pendaftaran PPDB Online dengan rincian:`,
            ``,
            `• *No. Pendaftaran:* ${payload.no_pendaftaran}`,
            `• *Nama Lengkap:* ${payload.nama_lengkap}`,
            `• *NISN:* ${payload.nisn || '-'}`,
            `• *Asal Sekolah:* ${payload.asal_sekolah}`,
            `• *Pilihan Jurusan 1:* ${payload.pilihan_jurusan_1}`,
            `• *Pilihan Jurusan 2:* ${payload.pilihan_jurusan_2 || '-'}`,
            `• *Nama Orang Tua:* ${payload.nama_orang_tua}`,
            ``,
            `Mohon informasi langkah verifikasi berkas selanjutnya. Terima kasih.`
        ].join('\n');

        const waConfirmUrl = `https://wa.me/${waPanitia}?text=${encodeURIComponent(pesanWA)}`;

        // Tampilkan Modal Bukti Pendaftaran
        document.getElementById('bukti-no-ppdb').textContent = payload.no_pendaftaran;
        document.getElementById('bukti-nama').textContent = payload.nama_lengkap;
        document.getElementById('bukti-asal').textContent = payload.asal_sekolah;
        document.getElementById('bukti-jurusan').textContent = payload.pilihan_jurusan_1;
        document.getElementById('btn-konfirmasi-wa-ppdb').href = waConfirmUrl;

        document.getElementById('modal-sukses-ppdb').classList.remove('hidden');
        event.target.reset();

        // Tambah angka counter pendaftar di layar
        const counterEl = document.getElementById('ppdb-total-pendaftar');
        counterEl.textContent = (parseInt(counterEl.textContent, 10) || 0) + 1;

        showToast('Pendaftaran berhasil! Silakan konfirmasi via WhatsApp.', 'success');
    } catch (err) {
        showToast('Gagal mengirim pendaftaran: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function cekStatusPPDB() {
    const keyword = document.getElementById('cek-ppdb-keyword').value.trim();
    const box = document.getElementById('hasil-cek-ppdb');
    if (!keyword) {
        showToast('Masukkan Nomor Pendaftaran atau NISN terlebih dahulu.', 'error');
        return;
    }

    box.classList.remove('hidden');
    box.innerHTML = '<p class="text-muted text-sm">Mencari data pendaftaran...</p>';

    try {
        const { data, error } = await db
            .from('pendaftar_ppdb')
            .select('no_pendaftaran, nama_lengkap, asal_sekolah, pilihan_jurusan_1, status_pendaftaran')
            .or(`no_pendaftaran.ilike.${keyword},nisn.eq.${keyword}`)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            box.innerHTML = '<p class="text-sm" style="color: var(--danger);">Data tidak ditemukan. Pastikan Nomor Pendaftaran atau NISN sudah benar.</p>';
            return;
        }

        const badgeClass = data.status_pendaftaran.toLowerCase().includes('terima') || data.status_pendaftaran.toLowerCase().includes('verifikasi selesai')
            ? 'badge-success'
            : 'badge-warning';

        box.innerHTML = `
            <div style="margin-bottom: 6px;">
                <strong>${data.nama_lengkap}</strong>
                <div class="text-muted text-sm">${data.no_pendaftaran} • ${data.asal_sekolah}</div>
            </div>
            <div class="text-sm" style="margin-bottom: 6px;">Jurusan: <strong>${data.pilihan_jurusan_1}</strong></div>
            <span class="badge ${badgeClass}">${data.status_pendaftaran}</span>
        `;
    } catch (err) {
        box.innerHTML = `<p class="text-sm" style="color: var(--danger);">Gagal mengecek status: ${err.message}</p>`;
    }
}

// ================= BERITA & KEGIATAN =================
async function loadBeritaSekolah() {
    const grid = document.getElementById('berita-grid');
    try {
        const { data, error } = await db
            .from('berita_sekolah')
            .select('*')
            .order('tanggal_publikasi', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        cacheBerita = data || [];
        renderBeritaGrid();
    } catch (err) {
        grid.innerHTML = `<div class="section-card"><p class="text-muted text-sm">Belum ada berita yang dipublikasikan.</p></div>`;
    }
}

function filterBerita(kategori, btnEl) {
    activeKategoriBerita = kategori;
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderBeritaGrid();
}

function renderBeritaGrid() {
    const grid = document.getElementById('berita-grid');
    const filtered = activeKategoriBerita === 'Semua'
        ? cacheBerita
        : cacheBerita.filter(b => b.kategori === activeKategoriBerita);

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="section-card"><p class="text-muted text-sm">Belum ada berita atau kegiatan pada kategori ini.</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(b => {
        const excerpt = b.isi_berita.length > 130 ? b.isi_berita.slice(0, 130) + '...' : b.isi_berita;
        const thumbHtml = b.gambar_url
            ? `<img src="${b.gambar_url}" alt="${b.judul}" class="news-thumb" onerror="this.outerHTML='<div class=\\'news-thumb\\'><i class=\\'ph-fill ph-newspaper\\'></i></div>'">`
            : `<div class="news-thumb"><i class="ph-fill ph-newspaper"></i></div>`;

        return `
            <article class="news-card">
                ${thumbHtml}
                <div class="news-body">
                    <div class="news-meta">
                        <span class="badge badge-info">${b.kategori}</span>
                        <span>${b.tanggal_publikasi}</span>
                    </div>
                    <h4 class="news-title">${b.judul}</h4>
                    <p class="news-excerpt">${excerpt}</p>
                    <div class="news-footer">
                        <button class="btn-link" onclick="bacaBerita(${b.id})">Baca Selengkapnya &rarr;</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function bacaBerita(id) {
    const item = cacheBerita.find(b => b.id === id);
    if (!item) return;

    document.getElementById('read-berita-kategori').textContent = item.kategori;
    document.getElementById('read-berita-judul').textContent = item.judul;
    document.getElementById('read-berita-meta').textContent = `Dipublikasikan pada ${item.tanggal_publikasi} • Oleh ${item.penulis || 'Admin Sekolah'}`;
    document.getElementById('read-berita-isi').textContent = item.isi_berita;

    const imgEl = document.getElementById('read-berita-img');
    if (item.gambar_url) {
        imgEl.src = item.gambar_url;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    document.getElementById('modal-baca-berita').classList.remove('hidden');
}

function renderPublikGuru() {
    const key = document.getElementById('pub-search-guru').value.toLowerCase();
    const filtered = cacheGuruPublik.filter(g =>
        !key ||
        (g.nama_guru && g.nama_guru.toLowerCase().includes(key)) ||
        (g.mapel_diampu && g.mapel_diampu.toLowerCase().includes(key))
    );

    const tbody = document.getElementById('pub-guru-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Data pendidik tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(g => `
        <tr>
            <td><strong>${g.nama_guru}</strong></td>
            <td>${g.jabatan || 'Guru Mata Pelajaran'}</td>
            <td>${g.mapel_diampu}</td>
            <td><span class="badge badge-success">${g.status_kepegawaian || 'Aktif'}</span></td>
        </tr>
    `).join('');
}
