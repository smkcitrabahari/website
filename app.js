// Penyimpanan cache memori lokal agar filter cepat tanpa query berulang
let cacheSiswa = [];
let cacheGuru = [];
let cacheAbsensi = [];
let cacheTindakLanjut = [];
let cacheJadwalUjian = [];
let cacheHasilUjian = [];
let cacheMapel = [];

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    registerServiceWorker();
    await loadPengaturanUmum();

    if (checkExistingSession()) {
        initMainApplication();
    }
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

// UI Helpers
function showLoader(text = 'Memuat data...') {
    document.getElementById('loader-text').textContent = text;
    document.getElementById('global-loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('global-loader').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Ambil pengaturan nama sekolah sebelum login
async function loadPengaturanUmum() {
    try {
        const { data } = await db.from('pengaturan').select('*');
        if (data && data.length > 0) {
            data.forEach(item => {
                AppState.pengaturan[item.kunci] = item.nilai;
            });

            const namaSekolah = AppState.pengaturan['nama_sekolah'] ||
                                AppState.pengaturan['NAMA_SEKOLAH'] ||
                                'Sistem Sekolah Terpadu';
            document.getElementById('login-school-name').textContent = namaSekolah;
            document.getElementById('header-school-title').textContent = namaSekolah;
            document.title = `SST - ${namaSekolah}`;
        }
    } catch (e) {
        console.warn('Pengaturan sekolah belum dimuat:', e.message);
    }
}

// Masuk ke Dashboard Utama setelah Login
async function initMainApplication() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Set info user di header & banner
    const u = AppState.user;
    document.getElementById('header-user-info').textContent = `${u.nama} (${AppState.role.toUpperCase()})`;
    document.getElementById('welcome-user-name').textContent = `Halo, ${u.nama}`;
    document.getElementById('welcome-role-desc').textContent = u.jabatan || 'Sistem Informasi Sekolah Terpadu';

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('today-date-label').textContent = new Date().toLocaleDateString('id-ID', options);

    // Atur hak akses tampilan tombol berdasarkan role
    applyRolePermissions();

    // Set default tanggal hari ini pada filter absensi
    const todayISO = new Date().toISOString().split('T')[0];
    document.getElementById('filter-absensi-tanggal').value = todayISO;

    await refreshAllData();
}

function applyRolePermissions() {
    const isAdmin = AppState.role === 'admin';
    const isStaff = AppState.role === 'admin' || AppState.role === 'guru';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', !isAdmin);
    });
    document.querySelectorAll('.staff-only').forEach(el => {
        el.classList.toggle('hidden', !isStaff);
    });
}

// Muat seluruh data utama dari Supabase
async function refreshAllData() {
    showLoader('Menyinkronkan database sekolah...');
    try {
        await Promise.all([
            loadSiswa(),
            loadGuru(),
            loadMapel(),
            loadAbsensiHarian(),
            loadTindakLanjut(),
            loadUjianData(),
            loadSistemSettings()
        ]);
        updateDashboardStats();
    } catch (err) {
        showToast('Sebagian data gagal dimuat: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

// 1. DATA SISWA
async function loadSiswa() {
    let query = db.from('siswa').select('*').order('KELAS', { ascending: true }).order('NAMA_SISWA', { ascending: true });
    if (AppState.role === 'siswa') {
        query = query.eq('ID_SISWA', AppState.user.id);
    }
    const { data, error } = await query;
    if (error) throw error;

    cacheSiswa = data || [];
    populateKelasFilter();
    renderSiswaTable();
}

function populateKelasFilter() {
    const kelasSet = [...new Set(cacheSiswa.map(s => s.KELAS).filter(Boolean))].sort();
    const selSiswa = document.getElementById('filter-siswa-kelas');
    const selAbsensi = document.getElementById('filter-absensi-kelas');

    const optionsHtml = '<option value="">Semua Kelas</option>' +
        kelasSet.map(k => `<option value="${k}">${k}</option>`).join('');

    selSiswa.innerHTML = optionsHtml;
    selAbsensi.innerHTML = optionsHtml;
}

function renderSiswaTable() {
    const keyword = document.getElementById('search-siswa').value.toLowerCase();
    const kelas = document.getElementById('filter-siswa-kelas').value;

    const filtered = cacheSiswa.filter(s => {
        const matchKelas = !kelas || s.KELAS === kelas;
        const matchKey = !keyword ||
            (s.NAMA_SISWA && s.NAMA_SISWA.toLowerCase().includes(keyword)) ||
            (s.NISN && s.NISN.toLowerCase().includes(keyword)) ||
            (s.ID_SISWA && s.ID_SISWA.toLowerCase().includes(keyword));
        return matchKelas && matchKey;
    });

    const tbody = document.getElementById('siswa-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Data siswa tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td><strong>${s.ID_SISWA}</strong></td>
            <td>${s.NISN || '-'}</td>
            <td>${s.NAMA_SISWA}</td>
            <td><span class="badge badge-info">${s.KELAS}</span></td>
            <td>${s.TTL || '-'}</td>
            <td><span class="badge ${s.STATUS === 'AKTIF' || !s.STATUS ? 'badge-success' : 'badge-warning'}">${s.STATUS || 'AKTIF'}</span></td>
        </tr>
    `).join('');
}

// 2. DATA GURU & MAPEL
async function loadGuru() {
    const { data, error } = await db.from('guru').select('*').order('nama_guru', { ascending: true });
    if (error) throw error;
    cacheGuru = data || [];
    renderGuruTable();
}

function renderGuruTable() {
    const keyword = document.getElementById('search-guru').value.toLowerCase();
    const filtered = cacheGuru.filter(g =>
        !keyword ||
        (g.nama_guru && g.nama_guru.toLowerCase().includes(keyword)) ||
        (g.mapel_diampu && g.mapel_diampu.toLowerCase().includes(keyword))
    );

    const tbody = document.getElementById('guru-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Data guru kosong.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(g => `
        <tr>
            <td><strong>${g.nama_guru}</strong></td>
            <td>${g.nip || '-'}</td>
            <td>${g.jabatan || 'Guru'}</td>
            <td>${g.mapel_diampu}</td>
            <td>${g.kelas_diampu}</td>
            <td><span class="badge badge-success">${g.status || 'Aktif'}</span></td>
        </tr>
    `).join('');
}

async function loadMapel() {
    const { data } = await db.from('mapel').select('*').order('nama_mapel', { ascending: true });
    cacheMapel = data || [];
    const container = document.getElementById('mapel-grid');
    container.innerHTML = cacheMapel.length
        ? cacheMapel.map(m => `<div class="chip-item">${m.nama_mapel}</div>`).join('')
        : '<p class="text-muted">Belum ada data mata pelajaran.</p>';
}

// 3. ABSENSI HARIAN
async function loadAbsensiHarian() {
    const tanggal = document.getElementById('filter-absensi-tanggal').value;
    let query = db.from('absensi_harian').select('*').order('KELAS', { ascending: true }).order('NAMA_SISWA', { ascending: true });

    if (tanggal) query = query.eq('TANGGAL', tanggal);
    if (AppState.role === 'siswa') query = query.eq('ID_SISWA', AppState.user.id);

    const { data, error } = await query;
    if (error) throw error;

    cacheAbsensi = data || [];
    renderAbsensiTable();
    renderDashboardAbsensi();
}

function renderAbsensiTable() {
    const kelas = document.getElementById('filter-absensi-kelas').value;
    const filtered = cacheAbsensi.filter(a => !kelas || a.KELAS === kelas);

    const tbody = document.getElementById('absensi-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Belum ada catatan absensi pada tanggal ini.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(a => `
        <tr>
            <td>${a.ID_SISWA}</td>
            <td><strong>${a.NAMA_SISWA || '-'}</strong></td>
            <td>${a.KELAS || '-'}</td>
            <td>${a.JAM_PAGI || '-'}</td>
            <td>${a.STATUS_PAGI || '-'}</td>
            <td>${a.JAM_SIANG || '-'}</td>
            <td>${a.STATUS_SIANG || '-'}</td>
            <td><span class="badge ${getStatusBadgeClass(a.STATUS_AKHIR)}">${a.STATUS_AKHIR}</span></td>
        </tr>
    `).join('');
}

function renderDashboardAbsensi() {
    const tbody = document.getElementById('dash-absensi-tbody');
    const slice = cacheAbsensi.slice(0, 6);
    if (slice.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada absensi hari ini.</td></tr>';
        return;
    }

    tbody.innerHTML = slice.map(a => `
        <tr>
            <td><strong>${a.NAMA_SISWA || a.ID_SISWA}</strong></td>
            <td>${a.KELAS || '-'}</td>
            <td>${a.JAM_PAGI || '-'}</td>
            <td><span class="badge ${getStatusBadgeClass(a.STATUS_AKHIR)}">${a.STATUS_AKHIR}</span></td>
        </tr>
    `).join('');
}

function getStatusBadgeClass(status) {
    if (!status) return 'badge-info';
    const s = status.toUpperCase();
    if (s.includes('HADIR')) return 'badge-success';
    if (s.includes('IZIN') || s.includes('SAKIT') || s.includes('TERLAMBAT')) return 'badge-warning';
    return 'badge-danger';
}

// 4. TINDAK LANJUT SISWA
async function loadTindakLanjut() {
    let query = db.from('tindak_lanjut').select('*').order('CREATE_AT', { ascending: false });
    if (AppState.role === 'siswa') query = query.eq('ID_SISWA', AppState.user.id);

    const { data, error } = await query;
    if (error) throw error;
    cacheTindakLanjut = data || [];

    const siswaMap = {};
    cacheSiswa.forEach(s => { siswaMap[s.ID_SISWA] = `${s.NAMA_SISWA} (${s.KELAS})`; });

    const tbody = document.getElementById('tindak-lanjut-tbody');
    if (cacheTindakLanjut.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada catatan tindak lanjut.</td></tr>';
        return;
    }

    tbody.innerHTML = cacheTindakLanjut.map(tl => `
        <tr>
            <td>${tl.TANGGAL}</td>
            <td>${tl.ID_SISWA}</td>
            <td><strong>${siswaMap[tl.ID_SISWA] || tl.ID_SISWA}</strong></td>
            <td><span class="badge badge-warning">${tl.KATEGORI || 'Umum'}</span></td>
            <td>${tl.CATATAN || '-'}</td>
        </tr>
    `).join('');
}

// 5. UJIAN CBT (JADWAL, HASIL & BANK SOAL)
async function loadUjianData() {
    const [resJadwal, resHasil, resBank] = await Promise.all([
        db.from('jadwal_ujian').select('*').order('tanggal', { ascending: true }),
        AppState.role === 'siswa'
            ? db.from('hasil_ujian').select('*').eq('ID_SISWA', AppState.user.id).order('waktu_selesai', { ascending: false })
            : db.from('hasil_ujian').select('*').order('waktu_selesai', { ascending: false }),
        AppState.role !== 'siswa'
            ? db.from('bank_soal').select('id, mapel, kelas')
            : Promise.resolve({ data: [] })
    ]);

    cacheJadwalUjian = resJadwal.data || [];
    cacheHasilUjian = resHasil.data || [];

    renderJadwalUjian();
    populateHasilMapelFilter();
    renderHasilUjianTable();
    renderBankSoalSummary(resBank.data || []);
}

function renderJadwalUjian() {
    const tbody = document.getElementById('jadwal-ujian-tbody');
    const dashList = document.getElementById('dash-jadwal-list');

    if (cacheJadwalUjian.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada jadwal ujian.</td></tr>';
        dashList.innerHTML = '<p class="text-muted text-sm">Tidak ada jadwal ujian aktif.</p>';
        return;
    }

    tbody.innerHTML = cacheJadwalUjian.map(j => `
        <tr>
            <td><strong>${j.mapel}</strong></td>
            <td><span class="badge badge-info">${j.kelas}</span></td>
            <td>${j.tanggal}</td>
            <td>${j.jam_mulai.slice(0,5)} - ${j.jam_selesai.slice(0,5)}</td>
            <td>${j.durasi || 60} Menit</td>
        </tr>
    `).join('');

    dashList.innerHTML = cacheJadwalUjian.slice(0, 4).map(j => `
        <div class="list-item-card">
            <div>
                <strong>${j.mapel}</strong>
                <div class="text-muted text-sm">Kelas ${j.kelas} • ${j.tanggal}</div>
            </div>
            <span class="badge badge-info">${j.jam_mulai.slice(0,5)}</span>
        </div>
    `).join('');
}

function populateHasilMapelFilter() {
    const mapels = [...new Set(cacheHasilUjian.map(h => h.mapel).filter(Boolean))].sort();
    const sel = document.getElementById('filter-hasil-mapel');
    sel.innerHTML = '<option value="">Semua Mapel</option>' +
        mapels.map(m => `<option value="${m}">${m}</option>`).join('');
}

function renderHasilUjianTable() {
    const filterMapel = document.getElementById('filter-hasil-mapel').value;
    const filtered = cacheHasilUjian.filter(h => !filterMapel || h.mapel === filterMapel);

    const tbody = document.getElementById('hasil-ujian-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada hasil ujian tercatat.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(h => `
        <tr>
            <td>${h.ID_SISWA}</td>
            <td><strong>${h.nama_siswa || '-'}</strong></td>
            <td>${h.kelas || '-'}</td>
            <td>${h.mapel}</td>
            <td><strong>${h.nilai !== null ? h.nilai : '-'}</strong></td>
            <td>${h.jumlah_pelanggaran || 0}x</td>
            <td><span class="badge ${h.status_selesai === 'Selesai' ? 'badge-success' : 'badge-warning'}">${h.status_selesai || 'Proses'}</span></td>
        </tr>
    `).join('');
}

function renderBankSoalSummary(soalList) {
    const container = document.getElementById('bank-soal-summary');
    if (!soalList.length) {
        container.innerHTML = '<p class="text-muted">Belum ada soal di bank_soal.</p>';
        return;
    }

    const grouped = {};
    soalList.forEach(s => {
        const key = `${s.mapel} (${s.kelas})`;
        grouped[key] = (grouped[key] || 0) + 1;
    });

    container.innerHTML = Object.entries(grouped).map(([key, count]) => `
        <div class="stat-card">
            <div class="stat-icon"><i class="ph-fill ph-file-text"></i></div>
            <div class="stat-info">
                <span class="stat-label">${key}</span>
                <h4>${count} Soal</h4>
            </div>
        </div>
    `).join('');
}

// 6. PENGATURAN SISTEM & HARI LIBUR
async function loadSistemSettings() {
    const [resPengaturan, resWaktu, resLibur] = await Promise.all([
        db.from('pengaturan').select('*'),
        db.from('pengaturan_waktu').select('*'),
        db.from('hari_libur').select('*').order('TANGGAL', { ascending: true })
    ]);

    const pList = document.getElementById('pengaturan-list');
    pList.innerHTML = (resPengaturan.data || []).map(p => `
        <div class="kv-row">
            <span class="kv-key">${p.kunci}</span>
            <span class="kv-val">${p.nilai || '-'}</span>
        </div>
    `).join('') || '<p class="text-muted">Belum ada data pengaturan.</p>';

    const wList = document.getElementById('pengaturan-waktu-list');
    wList.innerHTML = (resWaktu.data || []).map(w => `
        <div class="kv-row">
            <span class="kv-key">${w.kunci_waktu}</span>
            <span class="kv-val">${w.nilai || '-'}</span>
        </div>
    `).join('') || '<p class="text-muted">Belum ada pengaturan waktu.</p>';

    const lList = document.getElementById('hari-libur-list');
    lList.innerHTML = (resLibur.data || []).map(l => `
        <div class="list-item-card">
            <strong>${l.KETERANGAN_LIBUR}</strong>
            <span class="badge badge-danger">${l.TANGGAL}</span>
        </div>
    `).join('') || '<p class="text-muted text-sm">Tidak ada jadwal hari libur.</p>';
}

// UPDATE ANGKA DASHBOARD
function updateDashboardStats() {
    document.getElementById('stat-total-siswa').textContent = cacheSiswa.length;
    document.getElementById('stat-total-guru').textContent = cacheGuru.length;
    const hadirCount = cacheAbsensi.filter(a => a.STATUS_AKHIR && a.STATUS_AKHIR.toUpperCase().includes('HADIR')).length;
    document.getElementById('stat-hadir-hari-ini').textContent = hadirCount;
    document.getElementById('stat-jadwal-ujian').textContent = cacheJadwalUjian.length;
}

// NAVIGASI TAB & SUB-TAB
function switchTab(tabName) {
    AppState.activeTab = tabName;
    document.querySelectorAll('.tab-view').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

function switchSubTab(subName, btnEl) {
    ['siswa', 'guru', 'mapel'].forEach(name => {
        document.getElementById(`sub-${name}`).classList.toggle('hidden', name !== subName);
    });
    btnEl.parentElement.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
}

function switchUjianSubTab(subName, btnEl) {
    ['jadwal', 'hasil', 'bank'].forEach(name => {
        document.getElementById(`sub-ujian-${name}`).classList.toggle('hidden', name !== subName);
    });
    btnEl.parentElement.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
}

// MODAL HANDLERS (TAMBAH SISWA & TINDAK LANJUT)
function openModalSiswa() {
    document.getElementById('modal-siswa').classList.remove('hidden');
}

function openModalTindakLanjut() {
    const select = document.getElementById('tl-id-siswa');
    select.innerHTML = cacheSiswa.map(s =>
        `<option value="${s.ID_SISWA}">${s.NAMA_SISWA} - ${s.KELAS} (${s.ID_SISWA})</option>`
    ).join('');
    document.getElementById('tl-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-tindak-lanjut').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

async function submitTambahSiswa(event) {
    event.preventDefault();
    const payload = {
        ID_SISWA: document.getElementById('input-id-siswa').value.trim(),
        NISN: document.getElementById('input-nisn').value.trim() || null,
        NAMA_SISWA: document.getElementById('input-nama-siswa').value.trim(),
        KELAS: document.getElementById('input-kelas-siswa').value.trim(),
        TTL: document.getElementById('input-ttl-siswa').value.trim() || null,
        STATUS: 'AKTIF'
    };

    showLoader('Menyimpan data siswa...');
    try {
        const { error } = await db.from('siswa').insert([payload]);
        if (error) throw error;
        showToast('Data siswa berhasil ditambahkan!', 'success');
        closeModal('modal-siswa');
        event.target.reset();
        await loadSiswa();
        updateDashboardStats();
    } catch (err) {
        showToast('Gagal menambah siswa: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function submitTindakLanjut(event) {
    event.preventDefault();
    const payload = {
        ID_SISWA: document.getElementById('tl-id-siswa').value,
        TANGGAL: document.getElementById('tl-tanggal').value,
        KATEGORI: document.getElementById('tl-kategori').value,
        CATATAN: document.getElementById('tl-catatan').value.trim()
    };

    showLoader('Menyimpan catatan pembinaan...');
    try {
        const { error } = await db.from('tindak_lanjut').insert([payload]);
        if (error) throw error;
        showToast('Catatan tindak lanjut berhasil disimpan!', 'success');
        closeModal('modal-tindak-lanjut');
        event.target.reset();
        await loadTindakLanjut();
    } catch (err) {
        showToast('Gagal menyimpan catatan: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}