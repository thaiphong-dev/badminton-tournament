import { Component } from 'react'
import { AlertCircle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Đã có lỗi xảy ra</h2>
            <p className="text-gray-500 text-sm mb-6">
              Vui lòng tải lại trang. Nếu lỗi tiếp diễn, liên hệ admin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
