// Konfigurasi Supabase Project
const SUPABASE_URL = 'https://quuuaekcwblffuessuvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1dXVhZWtjd2JsZmZ1ZXNzdXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MDUwODUsImV4cCI6MjExMDI4MTA4NX0.s4BqDK73cirqO89GvToYMAlhsgUXJjxzYJrUelAiyNs';

// URL Aplikasi Terintegrasi (Ekosistem SMK Citra Bahari)
const EXTERNAL_APPS = {
    CBT_URL: 'https://smkcitrabahari.github.io/cbt/',
    ABSENSI_QR_URL: 'https://smkcitrabahari.github.io/absensiqrcode/'
};

// Inisialisasi Client Supabase
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Global Aplikasi
const AppState = {
    user: null,
    role: null, // 'admin' | 'guru' | 'siswa'
    pengaturan: {},
    pengaturanWaktu: {},
    activeTab: 'dashboard'
};
