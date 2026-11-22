let cacheBerita = [];
let cacheGuruPublik = [];
let activeKategoriBerita = 'Semua';
let sekolahSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    await loadAllPublicContent();
});

function closeMobileNav() {
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
}

function showLoader(text = 'Memproses...') {
    const el = document.getElementById('global-loader');
    if (el) {
        document.getElementById('loader-text').textContent = text;
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

function hideLoader() {
    const el = document.getElementById('global-loader');
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-navy-900';
    const t = document.createElement('div');
    t.className = `${bgClass} text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function formatWaNumber(raw) {
    const cleaned = (raw || '6285298875399').replace(/[^0-9]/g, '');
    return cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
}

// ================= KONTROL MODAL =================
function openPpdbModal() {
    closeMobileNav();
    const m = document.getElementById('ppdb-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closePpdbModal() {
    const m = document.getElementById('ppdb-modal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

function goToFullPpdbForm() {
    closePpdbModal();
    document.getElementById('ppdb').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('ppdb-nama').focus(), 500);
}

function closeNewsModal() {
    const m = document.getElementById('news-modal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

function closeSuksesPpdbModal() {
    const m = document.getElementById('modal-sukses-ppdb');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('ppdb-modal')) closePpdbModal();
    if (e.target === document.getElementById('news-modal')) closeNewsModal();
    if (e.target === document.getElementById('modal-sukses-ppdb')) closeSuksesPpdbModal();
});

// ================= LOAD DATA UTAMA DARI SUPABASE =================
async function loadAllPublicContent() {
    try {
        const [resPengaturan, resSiswa, resGuru, resLibur, resPpdbCount] = await Promise.all([
            db.from('pengaturan').select('*'),
            db.from('siswa').select('ID_SISWA, KELAS, STATUS'),
            db.from('guru').select('nama_guru, jabatan, mapel_diampu, status_kepegawaian, status').order('nama_guru', { ascending: true }),
            db.from('hari_libur').select('*').order('TANGGAL', { ascending: true }),
            db.from('pendaftar_ppdb').select('id', { count: 'exact', head: true })
        ]);

        // 1. Pengaturan Identitas & WhatsApp
        sekolahSettings = {};
        (resPengaturan.data || []).forEach(p => { sekolahSettings[p.kunci] = p.nilai; });

        const namaSekolah = sekolahSettings['nama_sekolah'] || sekolahSettings['NAMA_SEKOLAH'] || 'SMK Citra Bahari Wakatobi';
        const alamatSekolah = sekolahSettings['alamat_sekolah'] || sekolahSettings['ALAMAT_SEKOLAH'] || 'Kabupaten Wakatobi, Sulawesi Tenggara';
        const visiSekolah = sekolahSettings['visi_sekolah'];
        const tahunAjaranPPDB = sekolahSettings['tahun_ajaran_ppdb'] || '2026/2027';

        const waSekolah = formatWaNumber(sekolahSettings['wa_sekolah']);
        const waPanitiaPpdb = formatWaNumber(sekolahSettings['wa_ppdb'] || sekolahSettings['wa_sekolah']);

        const waLinkUmum = `https://wa.me/${waSekolah}?text=${encodeURIComponent('Halo Admin ' + namaSekolah + ', saya ingin menanyakan informasi sekolah.')}`;
        const waLinkPpdb = `https://wa.me/${waPanitiaPpdb}?text=${encodeURIComponent('Halo Panitia PPDB ' + namaSekolah + ', saya ingin berkonsultasi mengenai pendaftaran peserta didik baru.')}`;

        document.title = `${namaSekolah} | Portal Resmi Sekolah`;
        document.getElementById('profil-nama-sekolah').textContent = namaSekolah;
        document.getElementById('hero-ppdb-pill').textContent = `Penerimaan Peserta Didik Baru (PPDB) TA ${tahunAjaranPPDB} Dibuka`;
        document.getElementById('ppdb-ta-badge').textContent = `Tahun Ajaran ${tahunAjaranPPDB}`;
        document.getElementById('pub-footer-text').textContent = `© ${new Date().getFullYear()} ${namaSekolah}. Hak Cipta Dilindungi Undang-Undang.`;
        document.getElementById('contact-alamat').textContent = alamatSekolah;
        document.getElementById('contact-wa-text').textContent = `+${waSekolah}`;
        document.getElementById('ppdb-hotline-text').textContent = `+${waPanitiaPpdb}`;

        if (visiSekolah) {
            document.getElementById('profil-visi-text').textContent = visiSekolah;
        }

        if (resPpdbCount && typeof resPpdbCount.count === 'number') {
            document.getElementById('ppdb-total-pendaftar').textContent = resPpdbCount.count;
        }

        ['hero-wa-btn', 'footer-wa-btn', 'floating-wa-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.href = waLinkUmum;
        });
        const modalWaBtn = document.getElementById('modal-wa-ppdb-btn');
        if (modalWaBtn) modalWaBtn.href = waLinkPpdb;

        // Render Identitas Sekolah di Profil
        const idList = document.getElementById('pub-identitas-list');
        const publicSettings = (resPengaturan.data || []).filter(p =>
            !p.kunci.toLowerCase().includes('password') &&
            !p.kunci.toLowerCase().includes('token') &&
            !p.kunci.toLowerCase().startsWith('jurusan_')
        );

        idList.innerHTML = publicSettings.length
            ? publicSettings.map(p => `
                <div class="flex justify-between items-center gap-3 py-2 border-b border-slate-200/70 last:border-none">
                    <span class="text-slate-500 capitalize">${p.kunci.replace(/_/g, ' ')}</span>
                    <span class="font-semibold text-navy-900 text-right">${p.nilai || '-'}</span>
                </div>
            `).join('')
            : '<p class="text-slate-500 text-sm">Data identitas sekolah belum diatur.</p>';

        // 2. Statistik Hero
        const siswaAktif = (resSiswa.data || []).filter(s => !s.STATUS || s.STATUS.toUpperCase() === 'AKTIF');
        const guruAktif = (resGuru.data || []).filter(g => !g.status || g.status.toLowerCase() === 'aktif');
        const rombelCount = new Set(siswaAktif.map(s => s.KELAS).filter(Boolean)).size;

        document.getElementById('stat-siswa-aktif').textContent = siswaAktif.length;
        document.getElementById('stat-guru-aktif').textContent = guruAktif.length;
        document.getElementById('stat-rombel-aktif').textContent = rombelCount;

        // 3. Kompetensi Keahlian (Jurusan) & Dropdown PPDB
        renderKompetensiKeahlian(siswaAktif, sekolahSettings);

        // 4. Direktori Pendidik
        cacheGuruPublik = guruAktif;
        renderPublikGuru();

        // 5. Kalender Libur
        const liburList = resLibur.data || [];
        document.getElementById('pub-libur-list').innerHTML = liburList.length
            ? liburList.map(l => `
                <div class="flex items-center justify-between gap-2 bg-white/10 border border-white/10 px-3.5 py-2.5 rounded-xl text-xs">
                    <span class="font-medium text-white">${l.KETERANGAN_LIBUR}</span>
                    <span class="bg-amber-500 text-navy-950 font-bold px-2.5 py-0.5 rounded-md shrink-0">${l.TANGGAL}</span>
                </div>
            `).join('')
            : '<p class="text-xs text-slate-300">Belum ada jadwal hari libur tercatat.</p>';

        // 6. Berita & Kegiatan
        await loadBeritaSekolah();
        lucide.createIcons();

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
            icon: 'network',
            badgeBg: 'bg-blue-50 text-navy-800',
            deskripsi: 'Mempelajari instalasi jaringan komputer, administrasi server, routing & switching MikroTik, fiber optik, serta keamanan jaringan.'
        },
        'TJKT': {
            nama: 'Teknik Jaringan Komputer dan Telekomunikasi (TJKT)',
            icon: 'network',
            badgeBg: 'bg-blue-50 text-navy-800',
            deskripsi: 'Kompetensi keahlian di bidang infrastruktur jaringan komputer, sistem telekomunikasi modern, cloud computing, dan manajemen perangkat.'
        },
        'PERHOTELAN': {
            nama: 'Perhotelan',
            icon: 'building',
            badgeBg: 'bg-amber-50 text-amber-700',
            deskripsi: 'Membekali peserta didik dengan keterampilan layanan front office, housekeeping, tata boga dasar, dan manajemen pariwisata.'
        },
        'APHP': {
            nama: 'Agribisnis Pengolahan Hasil Perikanan (APHP)',
            icon: 'fish',
            badgeBg: 'bg-emerald-50 text-emerald-700',
            deskripsi: 'Mengembangkan kompetensi pengolahan hasil perikanan dan kelautan modern, pengendalian mutu pangan, serta kewirausahaan bahari.'
        },
        'NKPI': {
            nama: 'Nautika Kapal Penangkap Ikan (NKPI)',
            icon: 'anchor',
            badgeBg: 'bg-blue-50 text-navy-800',
            deskripsi: 'Pendidikan vokasi kemaritiman di bidang navigasi pelayaran, teknik penangkapan ikan, dan keselamatan operasional kapal.'
        },
        'TKPI': {
            nama: 'Teknika Kapal Penangkap Ikan (TKPI)',
            icon: 'settings',
            badgeBg: 'bg-amber-50 text-amber-700',
            deskripsi: 'Kompetensi keahlian permesinan kapal, perawatan motor diesel maritim, dan sistem kelistrikan perkapalan.'
        }
    };

    for (const [k, info] of Object.entries(kamusSMK)) {
        if (keyUpper.includes(k)) {
            return {
                nama: info.nama,
                icon: info.icon,
                badgeBg: info.badgeBg,
                deskripsi: customDesc || info.deskripsi
            };
        }
    }

    return {
        nama: kodeJurusan,
        icon: 'graduation-cap',
        badgeBg: 'bg-emerald-50 text-emerald-700',
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

    const opsiJurusan = daftarJurusan.length > 0
        ? daftarJurusan.map(([kode]) => {
            const meta = getMetadataJurusan(kode, settings);
            return `<option value="${meta.nama}">${meta.nama}</option>`;
        }).join('')
        : `
            <option value="Nautika Kapal Penangkap Ikan (NKPI)">Nautika Kapal Penangkap Ikan (NKPI)</option>
            <option value="Teknika Kapal Penangkap Ikan (TKPI)">Teknika Kapal Penangkap Ikan (TKPI)</option>
            <option value="Agribisnis Pengolahan Hasil Perikanan (APHP)">Agribisnis Pengolahan Hasil Perikanan (APHP)</option>
            <option value="Teknik Komputer dan Jaringan (TKJ)">Teknik Komputer dan Jaringan (TKJ)</option>
            <option value="Perhotelan">Perhotelan</option>
        `;

    if (sel1) sel1.innerHTML = '<option value="">-- Pilih Jurusan Utama --</option>' + opsiJurusan;
    if (sel2) sel2.innerHTML = '<option value="">-- Opsional / Jurusan Cadangan --</option>' + opsiJurusan;

    if (!grid) return;
    if (daftarJurusan.length === 0) {
        grid.innerHTML = '<div class="col-span-full bg-white rounded-2xl p-6 text-center text-sm text-slate-500 border border-slate-200">Data kompetensi keahlian akan tampil otomatis setelah data kelas siswa tersedia.</div>';
        return;
    }

    grid.innerHTML = daftarJurusan.map(([kode, stats]) => {
        const meta = getMetadataJurusan(kode, settings);
        return `
            <div class="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-5">
                        <div class="w-12 h-12 rounded-xl ${meta.badgeBg} flex items-center justify-center">
                            <i data-lucide="${meta.icon}" class="w-6 h-6"></i>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            <span class="text-xs font-semibold bg-slate-100 text-navy-900 px-2.5 py-1 rounded-lg">${stats.rombelSet.size} Rombel</span>
                            <span class="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg">${stats.siswaCount} Siswa</span>
                        </div>
                    </div>
                    <h3 class="font-heading font-bold text-lg text-navy-900 mb-2">${meta.nama}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-5">${meta.deskripsi}</p>
                </div>
                <div class="pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    ${[...stats.rombelSet].sort().map(r => `<span class="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-md">${r}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ================= DIREKTORI PENDIDIK =================
function renderPublikGuru() {
    const key = (document.getElementById('pub-search-guru')?.value || '').toLowerCase();
    const filtered = cacheGuruPublik.filter(g =>
        !key ||
        (g.nama_guru && g.nama_guru.toLowerCase().includes(key)) ||
        (g.mapel_diampu && g.mapel_diampu.toLowerCase().includes(key))
    );

    const tbody = document.getElementById('pub-guru-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">Data pendidik tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(g => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="py-3.5 px-5 font-bold text-navy-900">${g.nama_guru}</td>
            <td class="py-3.5 px-5 text-slate-600">${g.jabatan || 'Guru Mata Pelajaran'}</td>
            <td class="py-3.5 px-5 text-slate-700">${g.mapel_diampu || '-'}</td>
            <td class="py-3.5 px-5">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    ${g.status_kepegawaian || 'Aktif'}
                </span>
            </td>
        </tr>
    `).join('');
}

// ================= BERITA & PENGUMUMAN (DARI TABEL berita_sekolah) =================
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
        grid.innerHTML = '<div class="col-span-full bg-white rounded-2xl p-6 text-center text-sm text-slate-500 border border-slate-200">Belum ada berita atau kegiatan yang dipublikasikan.</div>';
    }
}

function filterBerita(kategori, btnEl) {
    activeKategoriBerita = kategori;
    document.querySelectorAll('.news-filter-btn').forEach(b => {
        b.classList.remove('bg-navy-900', 'text-white', 'shadow-sm');
        b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-200');
    });
    btnEl.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-200');
    btnEl.classList.add('bg-navy-900', 'text-white', 'shadow-sm');
    renderBeritaGrid();
}

function renderBeritaGrid() {
    const grid = document.getElementById('berita-grid');
    const filtered = activeKategoriBerita === 'Semua'
        ? cacheBerita
        : cacheBerita.filter(b => b.kategori === activeKategoriBerita);

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full bg-white rounded-2xl p-6 text-center text-sm text-slate-500 border border-slate-200">Belum ada berita atau kegiatan pada kategori ini.</div>';
        return;
    }

    grid.innerHTML = filtered.map(item => {
        const excerpt = item.isi_berita.length > 130 ? item.isi_berita.slice(0, 130) + '...' : item.isi_berita;
        const imgSrc = item.gambar_url || 'https://placehold.co/600x400/0F2942/F59E0B?text=SMK+Citra+Bahari';

        return `
            <article onclick="openNewsModal(${item.id})" class="cursor-pointer group bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <div class="relative h-52 overflow-hidden bg-navy-900">
                    <img 
                        src="${imgSrc}" 
                        alt="${item.judul}" 
                        onerror="this.src='https://placehold.co/600x400/0F2942/F59E0B?text=SMK+Citra+Bahari'"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    >
                    <span class="absolute top-3 left-3 bg-navy-900/90 backdrop-blur-sm text-amber-400 text-xs font-semibold px-3 py-1 rounded-lg">
                        ${item.kategori}
                    </span>
                </div>
                <div class="p-6 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                            <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                            <span>${item.tanggal_publikasi}</span>
                        </div>
                        <h3 class="font-heading font-bold text-lg text-navy-900 group-hover:text-amber-600 transition-colors mb-2.5 line-clamp-2">
                            ${item.judul}
                        </h3>
                        <p class="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                            ${excerpt}
                        </p>
                    </div>
                    <div class="pt-4 mt-4 border-t border-slate-100 flex items-center text-sm font-semibold text-navy-800 group-hover:text-amber-600">
                        <span>Baca Selengkapnya</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform"></i>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    lucide.createIcons();
}

function openNewsModal(id) {
    const article = cacheBerita.find(n => n.id === id);
    if (!article) return;

    document.getElementById('news-modal-img').src = article.gambar_url || 'https://placehold.co/800x400/0F2942/F59E0B?text=SMK+Citra+Bahari';
    document.getElementById('news-modal-category').textContent = article.kategori;
    document.getElementById('news-modal-date').textContent = article.tanggal_publikasi;
    document.getElementById('news-modal-author').textContent = article.penulis || 'Admin Sekolah';
    document.getElementById('news-modal-title').textContent = article.judul;
    document.getElementById('news-modal-content').textContent = article.isi_berita;

    const m = document.getElementById('news-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

// ================= FORMULIR PPDB ONLINE & CEK STATUS =================
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

        const namaSekolah = sekolahSettings['nama_sekolah'] || 'SMK Citra Bahari Wakatobi';
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

        document.getElementById('bukti-no-ppdb').textContent = payload.no_pendaftaran;
        document.getElementById('bukti-nama').textContent = payload.nama_lengkap;
        document.getElementById('bukti-asal').textContent = payload.asal_sekolah;
        document.getElementById('bukti-jurusan').textContent = payload.pilihan_jurusan_1;
        document.getElementById('btn-konfirmasi-wa-ppdb').href = `https://wa.me/${waPanitia}?text=${encodeURIComponent(pesanWA)}`;

        const m = document.getElementById('modal-sukses-ppdb');
        m.classList.remove('hidden');
        m.classList.add('flex');

        event.target.reset();
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
    box.innerHTML = '<p class="text-slate-500 text-xs">Mencari data pendaftaran...</p>';

    try {
        const { data, error } = await db
            .from('pendaftar_ppdb')
            .select('no_pendaftaran, nama_lengkap, asal_sekolah, pilihan_jurusan_1, status_pendaftaran')
            .or(`no_pendaftaran.ilike.${keyword},nisn.eq.${keyword}`)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            box.innerHTML = '<p class="text-xs font-medium text-red-600">Data tidak ditemukan. Pastikan Nomor Pendaftaran atau NISN sudah benar.</p>';
            return;
        }

        const isAccepted = data.status_pendaftaran.toLowerCase().includes('terima') || data.status_pendaftaran.toLowerCase().includes('selesai');
        const badgeStyle = isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';

        box.innerHTML = `
            <div class="mb-2">
                <strong class="text-navy-900 block">${data.nama_lengkap}</strong>
                <span class="text-xs text-slate-500">${data.no_pendaftaran} • ${data.asal_sekolah}</span>
            </div>
            <p class="text-xs text-slate-700 mb-2">Jurusan: <strong>${data.pilihan_jurusan_1}</strong></p>
            <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold ${badgeStyle}">${data.status_pendaftaran}</span>
        `;
    } catch (err) {
        box.innerHTML = `<p class="text-xs text-red-600">Gagal mengecek status: ${err.message}</p>`;
    }
}
