// ============================================
// SHARENOTE - Kết nối Supabase
// ============================================
// Cách gán: Dùng chuỗi string thuần túy, KHÔNG bọc trong dấu ngoặc vuông [].
// Lấy URL và Key tại: Supabase Dashboard > Settings > API
// ============================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://azabxhrymjnlcogszcdi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6YWJ4aHJ5bWpubGNvZ3N6Y2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjMwNjAsImV4cCI6MjA5MTgzOTA2MH0.-xFMRqxIOCLDh80lvWndmyCMTB9zcQRCG3WzLzLyNYw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)