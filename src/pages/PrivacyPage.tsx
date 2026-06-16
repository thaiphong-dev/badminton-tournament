import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8">
        <ArrowLeft className="w-4 h-4" /> Về trang chủ
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Chính sách bảo mật</h1>
      <p className="text-sm text-gray-400 mb-8">Cập nhật lần cuối: 14/05/2026</p>

      <div className="prose prose-sm text-gray-700 space-y-6">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. Thông tin chúng tôi thu thập</h2>
          <p>Khi bạn đăng ký tài khoản, chúng tôi thu thập:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Số điện thoại (dùng làm tên đăng nhập)</li>
            <li>Họ tên hiển thị</li>
            <li>Tên câu lạc bộ (tùy chọn, dành cho vận động viên)</li>
          </ul>
          <p className="mt-2">Chúng tôi không thu thập địa chỉ email, địa chỉ thực hay thông tin thanh toán cá nhân.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. Cách chúng tôi sử dụng thông tin</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Xác thực đăng nhập và quản lý phiên làm việc</li>
            <li>Hiển thị thông tin trong các giải đấu bạn tham gia</li>
            <li>Gửi thông báo liên quan đến giải đấu của bạn</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. Lưu trữ dữ liệu</h2>
          <p>Dữ liệu được lưu trữ trên Supabase (PostgreSQL), máy chủ đặt tại Singapore. Chúng tôi áp dụng Row Level Security (RLS) để đảm bảo mỗi người dùng chỉ truy cập được dữ liệu của mình.</p>
          <p className="mt-2">Session đăng nhập hết hạn sau 30 ngày.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Chia sẻ thông tin</h2>
          <p>Chúng tôi không bán, cho thuê hay chia sẻ thông tin cá nhân của bạn cho bên thứ ba, ngoại trừ:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Nhà cung cấp dịch vụ hạ tầng (Supabase, Vercel) để vận hành ứng dụng</li>
            <li>Khi có yêu cầu pháp lý từ cơ quan có thẩm quyền</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">5. Quyền của bạn</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Xem và chỉnh sửa thông tin cá nhân trong trang Hồ sơ</li>
            <li>Yêu cầu xóa tài khoản: liên hệ admin qua email</li>
            <li>Xuất dữ liệu của bạn: liên hệ admin</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">6. Liên hệ</h2>
          <p>Nếu có thắc mắc về chính sách bảo mật, vui lòng liên hệ qua trang hỗ trợ.</p>
        </section>
      </div>
    </div>
  )
}
