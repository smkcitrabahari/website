let adminSession = null;
let listBeritaRedaksi = [];

document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('sst_redaksi_session');
    if (saved) {
        try {
            adminSession = JSON.parse(saved);
            masukDashboardRedaksi();
        } catch (e) {
            localStorage.removeItem('sst_redaksi_session');
        }
    }
});

function showLoader(text = 'Memproses...') {
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

async function handleRedaksiLogin(event) {
    event.preventDefault();
    const username = document.getElementById('redaksi-username').value.trim();
    const password = document.getElementById('redaksi-password').value.trim();

    showLoader('Memverifikasi akun admin...');
    try {
        const { data, error } = await db
            .from('admin')
            .select('id_admin, nama_admin, username, status')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Username atau password Admin salah.');
        if (data.status && data.status.toLowerCase() === 'nonaktif') {
            throw new Error('Akun Admin dinonaktifkan.');
        }

        adminSession = data;
        localStorage.setItem('sst_redaksi_session', JSON.stringify(data));
        showToast('Berhasil masuk ke Panel Redaksi!', 'success');
        masukDashboardRedaksi();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

function logoutRedaksi() {
    localStorage.removeItem('sst_redaksi_session');
    adminSession = null;
    document.getElementById('redaksi-dashboard').classList.add('hidden');
    document.getElementById('redaksi-login-view').classList.remove('hidden');
}

async function masukDashboardRedaksi() {
    document.getElementById('redaksi-login-view').classList.add('hidden');
    document.getElementById('redaksi-dashboard').classList.remove('hidden');
    document.getElementById('redaksi-admin-badge').textContent = `Redaktur: ${adminSession.nama_admin}`;

    await Promise.all([loadPengaturanRedaksi(), loadDaftarBeritaRedaksi()]);
}

// PENGATURAN IDENTITAS & WA
async function loadPengaturanRedaksi() {
    const { data } = await db.from('pengaturan').select('*');
    const map = {};
    (data || []).forEach(p => { map[p.kunci] = p.nilai; });

    document.getElementById('set-nama-sekolah').value = map['nama_sekolah'] || '';
    document.getElementById('set-wa-sekolah').value = map['wa_sekolah'] || '';
    document.getElementById('set-alamat-sekolah').value = map['alamat_sekolah'] || '';
}

async function simpanPengaturanWeb(event) {
    event.preventDefault();
    const updates = [
        { kunci: 'nama_sekolah', nilai: document.getElementById('set-nama-sekolah').value.trim() },
        { kunci: 'wa_sekolah', nilai: document.getElementById('set-wa-sekolah').value.trim() },
        { kunci: 'alamat_sekolah', nilai: document.getElementById('set-alamat-sekolah').value.trim() }
    ];

    showLoader('Menyimpan pengaturan...');
    try {
        const { error } = await db.from('pengaturan').upsert(updates, { onConflict: 'kunci' });
        if (error) throw error;
        showToast('Identitas & kontak WhatsApp diperbarui!', 'success');
    } catch (err) {
        showToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

// CRUD BERITA
async function loadDaftarBeritaRedaksi() {
    const { data, error } = await db
        .from('berita_sekolah')
        .select('*')
        .order('tanggal_publikasi', { ascending: false })
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('redaksi-berita-tbody');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">Error: ${error.message}</td></tr>`;
        return;
    }

    listBeritaRedaksi = data || [];
    if (listBeritaRedaksi.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada berita. Klik "Tulis Berita Baru" untuk memulai.</td></tr>';
        return;
    }

    tbody.innerHTML = listBeritaRedaksi.map(b => `
        <tr>
            <td>${b.tanggal_publikasi}</td>
            <td><span class="badge badge-info">${b.kategori}</span></td>
            <td><strong>${b.judul}</strong></td>
            <td>${b.penulis || '-'}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editBerita(${b.id})">Edit</button>
                <button class="btn-danger-sm" onclick="hapusBerita(${b.id})">Hapus</button>
            </td>
        </tr>
    `).join('');
}

function openFormBerita() {
    document.getElementById('modal-berita-heading').textContent = 'Tulis Berita / Kegiatan Baru';
    document.getElementById('edit-berita-id').value = '';
    document.getElementById('form-berita-judul').value = '';
    document.getElementById('form-berita-kategori').value = 'Kegiatan';
    document.getElementById('form-berita-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('form-berita-file').value = '';
    document.getElementById('form-berita-gambar-url').value = '';
    document.getElementById('form-berita-isi').value = '';
    document.getElementById('preview-foto-berita').classList.add('hidden');
    document.getElementById('modal-form-berita').classList.remove('hidden');
}

function editBerita(id) {
    const item = listBeritaRedaksi.find(b => b.id === id);
    if (!item) return;

    document.getElementById('modal-berita-heading').textContent = 'Edit Berita / Kegiatan';
    document.getElementById('edit-berita-id').value = item.id;
    document.getElementById('form-berita-judul').value = item.judul;
    document.getElementById('form-berita-kategori').value = item.kategori;
    document.getElementById('form-berita-tanggal').value = item.tanggal_publikasi;
    document.getElementById('form-berita-file').value = '';
    document.getElementById('form-berita-gambar-url').value = item.gambar_url || '';
    document.getElementById('form-berita-isi').value = item.isi_berita;

    const preview = document.getElementById('preview-foto-berita');
    if (item.gambar_url) {
        preview.src = item.gambar_url;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }

    document.getElementById('modal-form-berita').classList.remove('hidden');
}

function previewFotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const preview = document.getElementById('preview-foto-berita');
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
}

// Kompresi gambar otomatis sebelum upload agar hemat kuota storage
function compressImage(file, maxWidth = 1024, quality = 0.78) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
            };
        };
    });
}

async function submitFormBerita(event) {
    event.preventDefault();
    const id = document.getElementById('edit-berita-id').value;
    const fileInput = document.getElementById('form-berita-file');
    let gambarUrl = document.getElementById('form-berita-gambar-url').value;

    showLoader('Menyimpan berita...');
    try {
        // Jika ada file foto baru dipilih, kompres dan upload ke Supabase Storage
        if (fileInput.files && fileInput.files[0]) {
            const compressedBlob = await compressImage(fileInput.files[0]);
            const fileName = `berita_${Date.now()}.jpg`;

            const { error: uploadErr } = await db.storage
                .from('media-berita')
                .upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: true });

            if (uploadErr) throw new Error('Gagal upload foto: ' + uploadErr.message);

            const { data: pubUrl } = db.storage.from('media-berita').getPublicUrl(fileName);
            gambarUrl = pubUrl.publicUrl;
        }

        const payload = {
            judul: document.getElementById('form-berita-judul').value.trim(),
            kategori: document.getElementById('form-berita-kategori').value,
            tanggal_publikasi: document.getElementById('form-berita-tanggal').value,
            gambar_url: gambarUrl || null,
            isi_berita: document.getElementById('form-berita-isi').value.trim(),
            penulis: adminSession.nama_admin
        };

        if (id) {
            const { error } = await db.from('berita_sekolah').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Berita berhasil diperbarui!', 'success');
        } else {
            const { error } = await db.from('berita_sekolah').insert([payload]);
            if (error) throw error;
            showToast('Berita baru berhasil diterbitkan!', 'success');
        }

        closeModal('modal-form-berita');
        await loadDaftarBeritaRedaksi();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusBerita(id) {
    if (!confirm('Hapus berita ini secara permanen?')) return;
    showLoader('Menghapus berita...');
    try {
        const { error } = await db.from('berita_sekolah').delete().eq('id', id);
        if (error) throw error;
        showToast('Berita berhasil dihapus.', 'success');
        await loadDaftarBeritaRedaksi();
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}
