import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Home from '@/pages/Home'
import TournamentCreate from '@/pages/TournamentCreate'
import TournamentSetup from '@/pages/TournamentSetup'
import GroupStagePage from '@/pages/GroupStagePage'
import KnockoutPage from '@/pages/KnockoutPage'
import ResultsPage from '@/pages/ResultsPage'

function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-500">Trang không tìm thấy</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tournament/create" element={<TournamentCreate />} />
            <Route path="/tournament/:id/setup" element={<TournamentSetup />} />
            <Route path="/tournament/:id/groups" element={<GroupStagePage />} />
            <Route path="/tournament/:id/knockout" element={<KnockoutPage />} />
            <Route path="/tournament/:id/results" element={<ResultsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
