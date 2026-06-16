import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8">
        <ArrowLeft className="w-4 h-4" /> Về trang chủ
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Điều khoản sử dụng</h1>
      <p className="text-sm text-gray-400 mb-8">Cập nhật lần cuối: 14/05/2026</p>

      <div className="prose prose-sm text-gray-700 space-y-6">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. Chấp nhận điều khoản</h2>
          <p>Bằng cách đăng ký và sử dụng ứng dụng quản lý giải đấu cầu lông này, bạn đồng ý tuân thủ các điều khoản dưới đây. Nếu không đồng ý, vui lòng không sử dụng dịch vụ.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. Tài khoản người dùng</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Bạn phải cung cấp thông tin chính xác khi đăng ký</li>
            <li>Mỗi số điện thoại chỉ được dùng cho một tài khoản</li>
            <li>Bạn chịu trách nhiệm bảo mật mật khẩu của mình</li>
            <li>Không được chia sẻ tài khoản với người khác</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. Quy tắc sử dụng</h2>
          <p>Bạn đồng ý không:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Nhập thông tin sai lệch, giả mạo hoặc nội dung xúc phạm</li>
            <li>Cố tình gây lỗi hệ thống hoặc tấn công bảo mật</li>
            <li>Sử dụng ứng dụng cho mục đích phi pháp</li>
            <li>Can thiệp vào kết quả giải đấu của người khác</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Dịch vụ và thanh toán</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gói dịch vụ trả phí được kích hoạt sau khi admin xác nhận thanh toán (trong vòng 2–4 giờ trong giờ hành chính)</li>
            <li>Phí dịch vụ không hoàn lại sau khi gói đã được kích hoạt</li>
            <li>Chúng tôi có quyền điều chỉnh giá sau khi thông báo trước 30 ngày</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">5. Giới hạn trách nhiệm</h2>
          <p>Dịch vụ được cung cấp "nguyên trạng". Chúng tôi không đảm bảo tính liên tục tuyệt đối của hệ thống và không chịu trách nhiệm về mất mát dữ liệu do sự cố ngoài tầm kiểm soát.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">6. Chấm dứt tài khoản</h2>
          <p>Chúng tôi có quyền tạm ngừng hoặc xóa tài khoản vi phạm điều khoản mà không cần thông báo trước. Bạn có thể yêu cầu xóa tài khoản bất kỳ lúc nào bằng cách liên hệ admin.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">7. Luật áp dụng</h2>
          <p>Các điều khoản này được điều chỉnh bởi pháp luật Việt Nam.</p>
        </section>
      </div>
    </div>
  )
}
