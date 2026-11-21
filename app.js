let cacheBerita = [];
let cacheGuruPublik = [];
let activeKategoriBerita = 'Semua';
let redaksiAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    checkRedaksiSession();
    await loadAllPublicContent();
});

function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('open');
}

function showLoader(text = 'Memuat data...') {
    document.getElementById('loader-text').textContent = text;
    document.getElementById('global-loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('global-loader').classList.add('hidden');
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ================= MUAT SELURUH KONTEN PUBLIK =================
async function loadAllPublicContent() {
    try {
        const [resPengaturan, resSiswa, resGuru, resMapel, resLibur] = await Promise.all([
            db.from('pengaturan').select('*'),
            db.from('siswa').select('ID_SISWA, KELAS, STATUS'),
            db.from('guru').select('nama_guru, jabatan, mapel_diampu, status_kepegawaian, status').order('nama_guru', { ascending: true }),
            db.from('mapel').select('id'),
            db.from('hari_libur').select('*').order('TANGGAL', { ascending: true })
        ]);

        // 1. Pengaturan Identitas & WhatsApp
        const settings = {};
        (resPengaturan.data || []).forEach(p => { settings[p.kunci] = p.nilai; });

        const namaSekolah = settings['nama_sekolah'] || settings['NAMA_SEKOLAH'] || 'Portal Resmi Sekolah';
        const alamatSekolah = settings['alamat_sekolah'] || settings['ALAMAT_SEKOLAH'] || 'Indonesia';
        const waRaw = (settings['wa_sekolah'] || '6285298875399').replace(/[^0-9]/g, '');
        const waNumber = waRaw.startsWith('0') ? '62' + waRaw.slice(1) : waRaw;
        const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent('Halo Admin ' + namaSekolah + ', saya ingin menanyakan informasi sekolah.')}`;

        document.title = namaSekolah;
        document.getElementById('pub-nav-title').textContent = namaSekolah;
        document.getElementById('pub-hero-title').textContent = `Selamat Datang di ${namaSekolah}`;
        document.getElementById('pub-footer-text').textContent = `© ${new Date().getFullYear()} ${namaSekolah}. Hak Cipta Dilindungi.`;
        document.getElementById('contact-alamat').textContent = alamatSekolah;
        document.getElementById('contact-wa-text').textContent = `+${waNumber}`;

        // Pasang link WA di Hero, Bagian Kontak, dan Tombol Mengambang
        ['hero-wa-btn', 'section-wa-btn', 'floating-wa-btn'].forEach(btnId => {
            const el = document.getElementById(btnId);
            if (el) el.href = waLink;
        });

        // Render Identitas Sekolah (kecuali kunci teknis)
        const idList = document.getElementById('pub-identitas-list');
        const publicSettings = (resPengaturan.data || []).filter(p => !p.kunci.toLowerCase().includes('password') && !p.kunci.toLowerCase().includes('token'));
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

        // 3. Direktori Pendidik (Aman tanpa No HP / Password)
        cacheGuruPublik = guruAktif;
        renderPublikGuru();

        // 4. Kalender Libur
        const liburList = resLibur.data || [];
        document.getElementById('pub-libur-list').innerHTML = liburList.length
            ? liburList.map(l => `
                <div class="list-item-card">
                    <strong>${l.KETERANGAN_LIBUR}</strong>
                    <span class="badge badge-danger">${l.TANGGAL}</span>
                </div>
            `).join('')
            : '<p class="text-muted text-sm">Belum ada jadwal hari libur tercatat.</p>';

        // 5. Berita & Kegiatan
        await loadBeritaSekolah();

    } catch (err) {
        console.error('Gagal memuat konten publik:', err);
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
        grid.innerHTML = `<div class="section-card"><p class="text-muted text-sm">Tabel <code>berita_sekolah</code> belum siap atau kosong. Jalankan script SQL yang diberikan untuk mengaktifkan fitur berita.</p></div>`;
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
        const excerpt = b.isi_berita.length > 125 ? b.isi_berita.slice(0, 125) + '...' : b.isi_berita;
        const thumbHtml = b.gambar_url
            ? `<img src="${b.gambar_url}" alt="${b.judul}" class="news-thumb" onerror="this.outerHTML='<div class=\\'news-thumb\\'><i class=\\'ph-fill ph-newspaper\\'></i></div>'">`
            : `<div class="news-thumb"><i class="ph-fill ph-newspaper"></i></div>`;

        const deleteBtn = redaksiAdmin
            ? `<button class="btn-danger-sm" onclick="hapusBerita(${b.id})">Hapus</button>`
            : '';

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
                        ${deleteBtn}
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

// ================= DIREKTORI PENDIDIK =================
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

// ================= MODE REDAKSI BERITA (ADMIN) =================
function openAdminLoginModal() {
    document.getElementById('modal-admin-login').classList.remove('hidden');
}

function openModalBerita() {
    document.getElementById('input-berita-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-tulis-berita').classList.remove('hidden');
}

async function handleRedaksiLogin(event) {
    event.preventDefault();
    const username = document.getElementById('redaksi-username').value.trim();
    const password = document.getElementById('redaksi-password').value.trim();

    showLoader('Memverifikasi akun redaksi...');
    try {
        const { data, error } = await db
            .from('admin')
            .select('id_admin, nama_admin, username, status')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Username atau password Admin salah.');

        redaksiAdmin = data;
        localStorage.setItem('sst_redaksi_admin', JSON.stringify(data));
        applyRedaksiUI();
        closeModal('modal-admin-login');
        showToast(`Mode Redaksi aktif (${data.nama_admin})`, 'success');
        renderBeritaGrid();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

function checkRedaksiSession() {
    const raw = localStorage.getItem('sst_redaksi_admin');
    if (raw) {
        try {
            redaksiAdmin = JSON.parse(raw);
            applyRedaksiUI();
        } catch (e) {
            localStorage.removeItem('sst_redaksi_admin');
        }
    }
}

function applyRedaksiUI() {
    const loggedIn = !!redaksiAdmin;
    document.getElementById('btn-tulis-berita').classList.toggle('hidden', !loggedIn);
    document.getElementById('btn-admin-login-trigger').classList.toggle('hidden', loggedIn);
    document.getElementById('btn-admin-logout-trigger').classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
        document.getElementById('redaksi-user-name').textContent = redaksiAdmin.nama_admin;
    }
}

function logoutRedaksi() {
    localStorage.removeItem('sst_redaksi_admin');
    redaksiAdmin = null;
    applyRedaksiUI();
    renderBeritaGrid();
    showToast('Keluar dari Mode Redaksi.', 'info');
}

async function submitBeritaBaru(event) {
    event.preventDefault();
    if (!redaksiAdmin) return;

    const payload = {
        judul: document.getElementById('input-berita-judul').value.trim(),
        kategori: document.getElementById('input-berita-kategori').value,
        tanggal_publikasi: document.getElementById('input-berita-tanggal').value,
        gambar_url: document.getElementById('input-berita-gambar').value.trim() || null,
        isi_berita: document.getElementById('input-berita-isi').value.trim(),
        penulis: redaksiAdmin.nama_admin
    };

    showLoader('Menerbitkan berita...');
    try {
        const { error } = await db.from('berita_sekolah').insert([payload]);
        if (error) throw error;
        showToast('Berita berhasil diterbitkan!', 'success');
        closeModal('modal-tulis-berita');
        event.target.reset();
        await loadBeritaSekolah();
    } catch (err) {
        showToast('Gagal menerbitkan berita: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusBerita(id) {
    if (!redaksiAdmin || !confirm('Hapus berita ini secara permanen?')) return;
    showLoader('Menghapus berita...');
    try {
        const { error } = await db.from('berita_sekolah').delete().eq('id', id);
        if (error) throw error;
        showToast('Berita dihapus.', 'success');
        await loadBeritaSekolah();
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}
