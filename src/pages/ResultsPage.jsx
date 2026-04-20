import { useParams } from 'react-router-dom'
import { Construction } from 'lucide-react'

export default function ResultsPage() {
  const { id } = useParams()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center py-24">
        <Construction className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Kết quả</h2>
        <p className="text-gray-500 text-sm">Tính năng đang được xây dựng (Tournament: {id})</p>
      </div>
    </div>
  )
}
