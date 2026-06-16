-- Migration: Add PWA Push to notify_registration_status RPC
-- Cho phép gửi đồng thời cả chuông thông báo và thông báo PWA Push khi duyệt/từ chối đăng ký.

CREATE OR REPLACE FUNCTION notify_registration_status(
  p_athlete_id      UUID,
  p_status          TEXT,           -- 'approved' | 'rejected'
  p_tournament_name TEXT,
  p_reject_reason   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger_secret text;
  v_title          text;
  v_body           text;
  v_cta_url        text := '/athlete';
BEGIN
  -- 1. Kiểm tra trạng thái hợp lệ
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- 2. Kiểm tra vận động viên tồn tại
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_athlete_id) THEN
    RETURN;
  END IF;

  -- 3. Tạo tiêu đề và nội dung thông báo dựa trên trạng thái
  IF p_status = 'approved' THEN
    v_title := 'Đăng ký được chấp thuận';
    v_body  := COALESCE(p_tournament_name, 'Giải đấu') || ' đã xác nhận đăng ký của bạn. Chúc bạn thi đấu tốt!';
  ELSE
    v_title := 'Đăng ký không được chấp thuận';
    v_body  := COALESCE(p_tournament_name, 'Giải đấu') || ' đã không xác nhận đăng ký của bạn.'
        || CASE WHEN p_reject_reason IS NOT NULL AND p_reject_reason <> ''
             THEN ' Lý do: ' || p_reject_reason
             ELSE ' Vui lòng liên hệ BTC để biết thêm.'
           END;
  END IF;

  -- 4. Chèn thông báo chuông (In-app Bell Notification)
  INSERT INTO user_notifications(user_id, type, title, body, cta_url)
  VALUES (
    p_athlete_id,
    CASE WHEN p_status = 'approved' THEN 'registration_approved' ELSE 'registration_rejected' END,
    v_title,
    v_body,
    v_cta_url
  );

  -- 5. Lấy trigger_secret để gọi Edge Function gửi PWA Push
  SELECT value #>> '{}' INTO v_trigger_secret FROM app_config WHERE key = 'trigger_secret';

  -- 6. Gửi PWA Push thông qua Edge Function send-push (sử dụng pg_net)
  IF v_trigger_secret IS NOT NULL AND v_trigger_secret <> '' THEN
    BEGIN
      PERFORM net.http_post(
        url     := 'https://fmmxyccddyewxytsaiau.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',     'application/json',
          'x-trigger-secret', v_trigger_secret
        ),
        body    := jsonb_build_object(
          'target_user_ids', jsonb_build_array(p_athlete_id::text),
          'title',           v_title,
          'body',            v_body,
          'url',             v_cta_url
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Không chặn giao dịch chính nếu lỗi gửi push
    END;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_registration_status TO anon;
