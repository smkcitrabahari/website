let selectedRole = 'admin';

function selectLoginRole(role) {
    selectedRole = role;
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    const label = document.getElementById('login-user-label');
    const input = document.getElementById('login-username');

    if (role === 'admin') {
        label.textContent = 'Username Admin';
        input.placeholder = 'Masukkan username admin';
    } else if (role === 'guru') {
        label.textContent = 'No. HP / NIP Guru';
        input.placeholder = 'Masukkan No. HP atau NIP';
    } else {
        label.textContent = 'Username Siswa';
        input.placeholder = 'Masukkan username akun siswa';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) return;

    showLoader('Memverifikasi akun...');

    try {
        if (selectedRole === 'admin') {
            const { data, error } = await db
                .from('admin')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('Username atau password Admin salah.');
            if (data.status && data.status.toLowerCase() === 'nonaktif') {
                throw new Error('Akun Admin sedang dinonaktifkan.');
            }

            saveSession({
                id: data.id_admin,
                nama: data.nama_admin,
                username: data.username,
                jabatan: 'Administrator Sistem'
            }, 'admin');

        } else if (selectedRole === 'guru') {
            // Cek kecocokan lewat no_hp atau nip di tabel guru
            const { data, error } = await db
                .from('guru')
                .select('*')
                .or(`no_hp.eq.${username},nip.eq.${username}`)
                .eq('password', password)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('No. HP/NIP atau password Guru tidak sesuai.');

            saveSession({
                id: data.id_guru,
                nama: data.nama_guru,
                nip: data.nip || '-',
                jabatan: data.jabatan || 'Guru Mata Pelajaran',
                mapel: data.mapel_diampu,
                kelas: data.kelas_diampu
            }, 'guru');

        } else if (selectedRole === 'siswa') {
            const { data: akun, error } = await db
                .from('akun_siswa')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .maybeSingle();

            if (error) throw error;
            if (!akun) throw new Error('Username atau password Siswa tidak ditemukan.');

            // Ambil detail profil siswa dari tabel siswa
            const { data: profil } = await db
                .from('siswa')
                .select('*')
                .eq('ID_SISWA', akun.ID_SISWA)
                .maybeSingle();

            saveSession({
                id: akun.ID_SISWA,
                nama: profil ? profil.NAMA_SISWA : akun.username,
                kelas: profil ? profil.KELAS : '-',
                nisn: profil ? profil.NISN : '-',
                jabatan: `Siswa Kelas ${profil ? profil.KELAS : ''}`
            }, 'siswa');
        }

        showToast('Login berhasil! Selamat datang.', 'success');
        initMainApplication();

    } catch (err) {
        showToast(err.message || 'Gagal melakukan login.', 'error');
    } finally {
        hideLoader();
    }
}

function saveSession(userObj, role) {
    AppState.user = userObj;
    AppState.role = role;
    localStorage.setItem('sst_session', JSON.stringify({ user: userObj, role }));
}

function checkExistingSession() {
    const raw = localStorage.getItem('sst_session');
    if (!raw) return false;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && parsed.role) {
            AppState.user = parsed.user;
            AppState.role = parsed.role;
            return true;
        }
    } catch (e) {
        localStorage.removeItem('sst_session');
    }
    return false;
}

function handleLogout() {
    if (!confirm('Keluar dari Sistem Sekolah Terpadu?')) return;
    localStorage.removeItem('sst_session');
    AppState.user = null;
    AppState.role = null;
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-password').value = '';
}