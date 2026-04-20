import { Link, useLocation } from 'react-router-dom'
import { Trophy } from 'lucide-react'

export default function Header() {
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Trang chủ' },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-blue-600 font-bold text-lg hover:text-blue-700 transition-colors">
            <Trophy className="w-6 h-6" />
            <span>Badminton Tournament</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/tournament/create"
              className="ml-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Tạo giải đấu
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
