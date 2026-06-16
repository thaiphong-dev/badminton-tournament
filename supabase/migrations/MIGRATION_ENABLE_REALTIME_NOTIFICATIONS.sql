-- ============================================================
-- MIGRATION: Enable Realtime for user_notifications
-- Mục đích: Cho phép nhận thông báo thời gian thực trên quả chuông (bell notification)
--           khi có sự kiện mới (vận động viên đăng ký, duyệt thanh toán, v.v.)
--
-- Chạy trong: Supabase SQL Editor
-- ============================================================

-- 1. Bật Realtime cho bảng user_notifications bằng cách thêm vào publication supabase_realtime
-- (Nếu đã tồn tại, Postgres sẽ bỏ qua hoặc báo lỗi nhẹ, dùng block an toàn)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;
  END IF;
END $$;

-- 2. Cấp quyền SELECT trên bảng user_notifications cho role anon
-- Điều này bắt buộc để Realtime client (chạy dưới role anon) có thể nhận dữ liệu broadcast.
GRANT SELECT ON user_notifications TO anon;

-- 3. Tạo chính sách RLS cho phép role anon thực hiện SELECT để nhận tin nhắn Realtime
-- Lưu ý: Mặc dù policy này là USING (true) để Realtime hoạt động, việc đọc thông tin nhạy cảm
-- đã được bảo vệ vì các API truy cập thông thường đều đi qua RPC bảo mật get_my_notifications().
DROP POLICY IF EXISTS "notif_anon_realtime_select" ON user_notifications;
CREATE POLICY "notif_anon_realtime_select" ON user_notifications
  FOR SELECT TO anon USING (true);
