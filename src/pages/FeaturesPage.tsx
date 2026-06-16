import { Link } from 'react-router-dom'
import {
  Trophy, Users, CalendarCheck, Shuffle, GitBranch, BarChart2,
  MonitorPlay, Bell, FileDown, Layers, UserCheck, Swords,
  Wifi, Star, CheckCircle2, Lock
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Plan badge ────────────────────────────────────────────
const PLAN_STYLE = {
  free:  { label: 'Free',  cls: 'bg-gray-100 text-gray-600' },
  basic: { label: 'Basic', cls: 'bg-blue-100 text-blue-700' },
  pro:   { label: 'Pro',   cls: 'bg-purple-100 text-purple-700' },
}

function PlanBadge({ plan }) {
  const s = PLAN_STYLE[plan]
  return (
    <span className={cn('inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full', s.cls)}>
      {plan === 'pro' && <Star className="w-3 h-3 mr-1" />}
      {s.label}
    </span>
  )
}

// ─── Feature card ───────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, plans, locked }) {
  return (
    <div className={cn(
      'relative bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md',
      locked ? 'border-gray-200 opacity-75' : 'border-gray-200'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          locked ? 'bg-gray-100' : 'bg-green-50'
        )}>
          <Icon className={cn('w-5 h-5', locked ? 'text-gray-400' : 'text-green-600')} />
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {plans.map(p => <PlanBadge key={p} plan={p} />)}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
      {locked && (
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <Lock className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
  )
}

// ─── Section header ──────────────────────────────────────────
function SectionHead({ emoji, title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <span>{emoji}</span> {title}
      </h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────
export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 text-white pt-12 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 text-sm px-4 py-1.5 rounded-full mb-5">
            🏸 BT Manager — Badminton Tournament Management
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4">
            Mọi tính năng bạn cần<br/>để tổ chức giải cầu lông
          </h1>
          <p className="text-green-100 text-base mb-8 max-w-xl mx-auto">
            Từ tạo giải, bốc thăm, ghi điểm trực tiếp đến bảng xếp hạng toàn quốc —
            tất cả trong một nền tảng.
          </p>

          {/* Plan legend */}
          <div className="inline-flex flex-wrap justify-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Free
            </span>
            <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Basic
            </span>
            <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <Star className="w-3 h-3 text-purple-300" /> Pro
            </span>
            <span className="text-green-200 text-xs self-center">= yêu cầu gói tối thiểu</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">

        {/* ══ 1. Tổ chức giải đấu ══ */}
        <section>
          <SectionHead
            emoji="🏆"
            title="Tổ chức giải đấu"
            subtitle="Toàn bộ công cụ để tạo và vận hành giải từ đầu đến cuối"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Trophy}
              title="Tạo giải đấu đa nội dung"
              desc="Tạo giải trong 3 bước. Hỗ trợ 5 nội dung: đơn nam, đơn nữ, đôi nam, đôi nữ, đôi hỗn hợp — mỗi nội dung cấu hình độc lập."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={Layers}
              title="Cấu hình format linh hoạt"
              desc="Chọn Vòng bảng → Knockout hoặc Knockout thẳng. Tuỳ chỉnh số bảng, số người đi tiếp, luật tính điểm (1 hay 3 set, 1–99 điểm/set)."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={Users}
              title="Quản lý vận động viên"
              desc="Import danh sách từ file Excel hoặc nhập tay. Xem và duyệt đơn đăng ký từ VĐV. Lọc theo trạng thái pending / approved / rejected."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={CalendarCheck}
              title="Điểm danh thông minh"
              desc="Check-in VĐV ngày thi đấu. VĐV vắng mặt tự động thua tất cả trận chưa đấu (walkover) — không cần nhập tay từng trận."
              plans={['basic', 'pro']}
            />
            <FeatureCard
              icon={Shuffle}
              title="Bốc thăm vòng bảng"
              desc="Chia bảng ngẫu nhiên hoặc bốc thăm có kiểm soát. Tự động đảm bảo không có 2 VĐV cùng CLB trong một bảng."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={GitBranch}
              title="Nhánh đấu loại trực tiếp"
              desc="Tự động tạo bracket knockout từ VĐV vượt vòng bảng. Người thắng tự tiến vào vòng kế. Hiển thị sơ đồ bracket đẹp cho khán giả."
              plans={['free', 'basic', 'pro']}
            />
          </div>
        </section>

        {/* ══ 2. Điều phối thi đấu ══ */}
        <section>
          <SectionHead
            emoji="🏟️"
            title="Điều phối thi đấu"
            subtitle="Quản lý sân, trọng tài và dòng chảy trận đấu trong ngày thi"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={MonitorPlay}
              title="Bảng điều phối sân"
              desc="Court board tổng hợp tất cả nội dung: xem sân nào đang dùng, trận nào đang chờ. Cảnh báo tự động khi VĐV thi đấu liên tục quá 90 phút."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={UserCheck}
              title="Phân công trọng tài"
              desc="Chỉ định trọng tài vào từng trận đấu cụ thể. Trọng tài nhận thông báo ngay khi được phân công và khi có cập nhật giải."
              plans={['basic', 'pro']}
            />
            <FeatureCard
              icon={Wifi}
              title="Ghi điểm realtime"
              desc="Trọng tài ghi điểm trên giao diện fullscreen tối chuyên dụng. Tỷ số cập nhật tức thì đến toàn bộ màn hình khán giả — không cần refresh."
              plans={['free', 'basic', 'pro']}
            />
          </div>
        </section>

        {/* ══ 3. Theo dõi & Kết quả ══ */}
        <section>
          <SectionHead
            emoji="📊"
            title="Theo dõi & Kết quả"
            subtitle="Công cụ thống kê, báo cáo và trình bày kết quả sau giải"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Swords}
              title="Bảng xếp hạng vòng bảng"
              desc="Hiển thị bảng thi đấu với đầy đủ thống kê: thắng/thua, điểm số, hiệu số — cập nhật tự động sau mỗi trận."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={Star}
              title="Podium & Kết quả chi tiết"
              desc="Trang kết quả đẹp với podium Top 3, lịch sử kết quả từng vòng, thống kê chi tiết từng trận của VĐV."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={BarChart2}
              title="Analytics dashboard"
              desc="Dashboard tổng hợp: số VĐV theo giải, tỷ lệ hoàn thành, biểu đồ giải theo tháng. Xuất dữ liệu ra CSV để phân tích thêm."
              plans={['pro']}
            />
            <FeatureCard
              icon={FileDown}
              title="Xuất báo cáo Excel"
              desc="Tải về báo cáo toàn diện: danh sách VĐV, kết quả từng trận, thống kê tổng kết. Phù hợp gửi lên liên đoàn hoặc nhà tài trợ."
              plans={['pro']}
            />
          </div>
        </section>

        {/* ══ 4. Vận động viên & Khán giả ══ */}
        <section>
          <SectionHead
            emoji="🏸"
            title="Trải nghiệm vận động viên & khán giả"
            subtitle="Tính năng dành cho người tham dự và người theo dõi giải đấu của bạn"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Users}
              title="Đăng ký trực tuyến"
              desc="VĐV tự đăng ký qua app, chọn nội dung phù hợp. Creator duyệt / từ chối — VĐV nhận thông báo ngay lập tức."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={MonitorPlay}
              title="Live score & Bảng điểm TV"
              desc="Trang live score dark-theme cho khán giả theo dõi trên điện thoại. Bảng điểm màn hình lớn chuyên dụng cho TV tại sân."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={GitBranch}
              title="Bracket công khai"
              desc="Sơ đồ bracket đẹp hiển thị công khai — VĐV và khán giả xem được tiến trình giải mà không cần đăng nhập."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={Trophy}
              title="Bảng xếp hạng toàn quốc"
              desc="Xếp hạng VĐV tổng hợp qua tất cả giải đã hoàn thành. Lọc theo giới tính, tìm kiếm theo tên — truy cập tự do không cần đăng nhập."
              plans={['free', 'basic', 'pro']}
            />
          </div>
        </section>

        {/* ══ 5. Thông báo & Kết nối ══ */}
        <section>
          <SectionHead
            emoji="🔔"
            title="Thông báo & Kết nối"
            subtitle="Tự động hoá giao tiếp với VĐV, trọng tài và khán giả"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Bell}
              title="Thông báo realtime"
              desc="Bell + toast tức thì: VĐV nhận khi được duyệt đăng ký, trọng tài nhận khi được phân công, VĐV được gọi vào sân."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={Bell}
              title="Push notification (PWA)"
              desc="Nhận thông báo ngay cả khi không mở app. Cài app lên màn hình chính điện thoại (PWA) để có trải nghiệm như app native."
              plans={['free', 'basic', 'pro']}
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Cảnh báo hạn mức"
              desc="Tự động thông báo khi bạn đã dùng gần hết slot giải đấu hoặc VĐV trong tháng, giúp bạn chuẩn bị nâng gói kịp thời."
              plans={['free', 'basic', 'pro']}
            />
          </div>
        </section>

        {/* ══ Comparison table ══ */}
        <section>
          <SectionHead emoji="📋" title="So sánh giới hạn theo gói" />
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Giới hạn</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500">Free</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-600">Basic</th>
                  <th className="px-4 py-3 text-center font-semibold text-purple-600">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Số giải đấu',              '1',   '5',    '∞'],
                  ['VĐV / nội dung',           '32',  '128',  '∞'],
                  ['Nội dung / giải',          '2',   '5',    '∞'],
                  ['Vòng bảng + Knockout',     '✓',   '✓',    '✓'],
                  ['Bốc thăm thông minh',      '✓',   '✓',    '✓'],
                  ['Ghi điểm realtime',        '✓',   '✓',    '✓'],
                  ['Điểm danh + auto-forfeit', '—',   '✓',    '✓'],
                  ['Phân công trọng tài',      '—',   '✓',    '✓'],
                  ['Analytics dashboard',      '—',   '—',    '✓'],
                  ['Xuất báo cáo Excel',       '—',   '—',    '✓'],
                ].map(([label, free, basic, pro]) => (
                  <tr key={label} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-700">{label}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{free}</td>
                    <td className="px-4 py-3 text-center text-blue-600 font-medium">{basic}</td>
                    <td className="px-4 py-3 text-center text-purple-600 font-medium">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="text-center pb-4">
          <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-3xl px-6 py-12 text-white">
            <h2 className="text-2xl font-extrabold mb-3">Bắt đầu miễn phí ngay hôm nay</h2>
            <p className="text-green-100 mb-8 max-w-md mx-auto text-sm">
              Tạo giải đấu đầu tiên trong vài phút. Nâng cấp khi bạn cần thêm.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="bg-white text-green-700 font-bold px-6 py-3 rounded-full hover:bg-green-50 transition text-sm"
              >
                Tạo tài khoản miễn phí
              </Link>
              <Link
                to="/plans"
                className="bg-white/20 text-white font-semibold px-6 py-3 rounded-full hover:bg-white/30 transition text-sm"
              >
                Xem bảng giá →
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
