const SUPABASE_URL = 'https://quuuaekcwblffuessuvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1dXVhZWtjd2JsZmZ1ZXNzdXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MDUwODUsImV4cCI6MjExMDI4MTA4NX0.s4BqDK73cirqO89GvToYMAlhsgUXJjxzYJrUelAiyNs';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
