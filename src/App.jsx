import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Home from '@/pages/Home'
import TournamentCreate from '@/pages/TournamentCreate'
import TournamentOverview from '@/pages/TournamentOverview'
import TournamentSetup from '@/pages/TournamentSetup'
import EventSetup from '@/pages/EventSetup'
import EventPlayersPage from '@/pages/EventPlayersPage'
import GroupStagePage from '@/pages/GroupStagePage'
import KnockoutPage from '@/pages/KnockoutPage'
import ResultsPage from '@/pages/ResultsPage'
import TournamentResultsPage from '@/pages/TournamentResultsPage'

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
            {/* ── Home ── */}
            <Route path="/" element={<Home />} />

            {/* ── Tournament CRUD ── */}
            <Route path="/tournament/create" element={<TournamentCreate />} />

            {/* ── NEW: Tournament Overview (multi-event dashboard) ── */}
            <Route path="/tournament/:id" element={<TournamentOverview />} />

            {/* ── NEW: Per-event routes ── */}
            {/* These pages are implemented in upcoming features (I4–I7).
                They reuse (or wrap) the existing single-event pages,
                just scoped by eventId instead of the tournament-level status. */}
            <Route path="/tournament/:id/event/:eventId/setup"    element={<EventSetup />} />
            <Route path="/tournament/:id/event/:eventId/players"  element={<EventPlayersPage />} />
            <Route path="/tournament/:id/event/:eventId/groups"   element={<GroupStagePage />} />
            <Route path="/tournament/:id/event/:eventId/knockout" element={<KnockoutPage />} />
            <Route path="/tournament/:id/event/:eventId/results"  element={<ResultsPage />} />

            {/* ── Legacy routes (backwards-compat, kept for existing data) ── */}
            <Route path="/tournament/:id/setup"    element={<TournamentSetup />} />
            <Route path="/tournament/:id/groups"   element={<GroupStagePage />} />
            <Route path="/tournament/:id/knockout" element={<KnockoutPage />} />
            {/* Tournament-level results: multi-event summary page */}
            <Route path="/tournament/:id/results"  element={<TournamentResultsPage />} />
            {/* Legacy single-event results (kept for backwards compat) */}
            <Route path="/tournament/:id/results/legacy" element={<ResultsPage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
