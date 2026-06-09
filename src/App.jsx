import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import IncomingCallOverlay from '@/components/umpire/IncomingCallOverlay'
import { useAuth } from '@/lib/hooks/useAuth'
import useCallStore from '@/lib/stores/callStore'

// Auth pages (standalone, no header)
import LoginPage       from '@/pages/LoginPage'
import RegisterPage    from '@/pages/RegisterPage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'

// Umpire pages (full-screen dark, no header)
import UmpirePage      from '@/pages/UmpirePage'
import UmpireMatchPage from '@/pages/UmpireMatchPage'

// Athlete portal
import AthleteDashboard     from '@/pages/AthleteDashboard'
import AdminDashboard       from '@/pages/AdminDashboard'

// Main app pages
import Home                 from '@/pages/Home'
import TournamentCreate     from '@/pages/TournamentCreate'
import TournamentEdit       from '@/pages/TournamentEdit'
import TournamentOverview   from '@/pages/TournamentOverview'
import TournamentSetup      from '@/pages/TournamentSetup'
import EventSetup           from '@/pages/EventSetup'
import EventPlayersPage     from '@/pages/EventPlayersPage'
import GroupStagePage       from '@/pages/GroupStagePage'
import KnockoutPage         from '@/pages/KnockoutPage'
import ResultsPage          from '@/pages/ResultsPage'
import TournamentResultsPage from '@/pages/TournamentResultsPage'
import TournamentReportPage  from '@/pages/TournamentReportPage'
import AttendancePage        from '@/pages/AttendancePage'
import PlansPage                  from '@/pages/PlansPage'
import CheckoutPage               from '@/pages/CheckoutPage'
import CreatorSubscriptionPage    from '@/pages/CreatorSubscriptionPage'
import CreatorAnalyticsPage       from '@/pages/CreatorAnalyticsPage'
import LeaderboardPage            from '@/pages/LeaderboardPage'
import AddOnShopPage              from '@/pages/AddOnShopPage'
import ProfilePage                from '@/pages/ProfilePage'
import ScoreboardDisplay          from '@/pages/ScoreboardDisplay'
import TournamentLivePage         from '@/pages/TournamentLivePage'
import PlayerStatsPage            from '@/pages/PlayerStatsPage'
import TournamentCourtsPage       from '@/pages/TournamentCourtsPage'
import PlayerProfilePage          from '@/pages/PlayerProfilePage'
import PublicBracketPage          from '@/pages/PublicBracketPage'
import PrivacyPage                from '@/pages/PrivacyPage'
import TermsPage                  from '@/pages/TermsPage'
import FeaturesPage               from '@/pages/FeaturesPage'
import ErrorBoundary              from '@/components/ErrorBoundary'
import { PlanProvider }           from '@/lib/hooks/usePlan'
import { LangProvider }           from '@/i18n'
import Toaster                    from '@/components/ui/Toaster'
import OfflineBanner              from '@/components/ui/OfflineBanner'
import PwaPromptModal             from '@/components/ui/PwaPromptModal'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, refetchOnWindowFocus: true } },
})

function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-500">Trang không tìm thấy</p>
    </div>
  )
}

// Các pathname không hiện Header
const HEADERLESS = ['/login', '/register', '/unauthorized']

function AppShell() {
  const { pathname } = useLocation()
  const { profile, role } = useAuth()
  const { incomingCall } = useCallStore()

  const isUmpire     = pathname.startsWith('/umpire')
  const isHeaderless = HEADERLESS.includes(pathname) || isUmpire

  const umpireRoutes = (
    <>
      <Route path="/umpire" element={
        <ProtectedRoute allowedRoles={['umpire']}>
          <UmpirePage />
        </ProtectedRoute>
      } />
      <Route path="/umpire/match/:matchId" element={
        <ProtectedRoute allowedRoles={['umpire']}>
          <UmpireMatchPage />
        </ProtectedRoute>
      } />
    </>
  )

  return (
    <>
      {/* Global incoming-call overlay — renders on any page for umpires */}
      {role === 'umpire' && incomingCall && !pathname.startsWith('/umpire/match/') && <IncomingCallOverlay />}

      {isHeaderless ? (
        <Routes>
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/register"     element={<RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          {umpireRoutes}
        </Routes>
      ) : (
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main>
            <Routes>
              {/* ── Home ── */}
              <Route path="/" element={<Home />} />

              {/* ── Athlete portal ── */}
              <Route path="/athlete" element={
                <ProtectedRoute allowedRoles={['athlete']}>
                  <AthleteDashboard />
                </ProtectedRoute>
              } />

              {/* ── Admin panel ── */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']} strictVerify>
                  <AdminDashboard />
                </ProtectedRoute>
              } />

              {/* ── Plans & Checkout & Subscription ── */}
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/creator/subscription" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <CreatorSubscriptionPage />
                </ProtectedRoute>
              } />
              <Route path="/creator/analytics" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <CreatorAnalyticsPage />
                </ProtectedRoute>
              } />
              <Route path="/checkout/:planId" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <CheckoutPage />
                </ProtectedRoute>
              } />
              <Route path="/checkout" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <CheckoutPage />
                </ProtectedRoute>
              } />
              <Route path="/addon-shop" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <AddOnShopPage />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={<ProfilePage />} />

              {/* ── Tournament CRUD ── */}
              <Route path="/tournament/create" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <TournamentCreate />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/edit" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <TournamentEdit />
                </ProtectedRoute>
              } />

              {/* ── Tournament Overview ── */}
              <Route path="/tournament/:id" element={<TournamentOverview />} />

              {/* ── Per-event routes (management = guarded, view = public) ── */}
              <Route path="/tournament/:id/event/:eventId/setup" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <EventSetup />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/event/:eventId/players" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <EventPlayersPage />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/event/:eventId/attendance" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <AttendancePage />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/event/:eventId/groups" element={
                <ProtectedRoute allowedRoles={['creator', 'admin', 'umpire']}>
                  <GroupStagePage />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/event/:eventId/knockout" element={
                <ProtectedRoute allowedRoles={['creator', 'admin', 'umpire']}>
                  <KnockoutPage />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/event/:eventId/results"  element={<ResultsPage />} />

              {/* ── Report ── */}
              <Route path="/tournament/:id/report" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <TournamentReportPage />
                </ProtectedRoute>
              } />

              {/* ── Legacy routes (tournaments without per-event structure) ── */}
              {/* ResultsPage = chi tiết 1 event (stage-by-stage), dùng ở /event/:eventId/results */}
              {/* TournamentResultsPage = tổng quan toàn giải (tất cả events), dùng ở /results */}
              <Route path="/tournament/:id/setup" element={
                <ProtectedRoute allowedRoles={['creator', 'admin']}>
                  <TournamentSetup />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/groups" element={
                <ProtectedRoute allowedRoles={['creator', 'admin', 'umpire']}>
                  <GroupStagePage />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/knockout" element={
                <ProtectedRoute allowedRoles={['creator', 'admin', 'umpire']}>
                  <KnockoutPage />
                </ProtectedRoute>
              } />
              <Route path="/tournament/:id/results"        element={<TournamentResultsPage />} />
              <Route path="/tournament/:id/results/legacy" element={<ResultsPage />} />

              {/* ── Public pages (no auth) ── */}
              <Route path="/leaderboard"          element={<LeaderboardPage />} />
              <Route path="/scoreboard/:matchId"  element={<ScoreboardDisplay />} />
              <Route path="/tournament/:id/live"   element={<TournamentLivePage />} />
              <Route path="/tournament/:id/stats"  element={<PlayerStatsPage />} />
              <Route path="/tournament/:id/courts" element={<TournamentCourtsPage />} />
              <Route path="/player/:playerId"     element={<PlayerProfilePage />} />
              <Route path="/tournament/:id/event/:eventId/bracket" element={<PublicBracketPage />} />

              {/* ── Legal ── */}
              <Route path="/privacy"  element={<PrivacyPage />} />
              <Route path="/terms"    element={<TermsPage />} />
              <Route path="/features" element={<FeaturesPage />} />

              {/* ── Umpire (fallback if umpire navigates via URL) ── */}
              {umpireRoutes}

              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          {/* Daily PWA prompt — shown once per day for non-admin logged-in users */}
          <PwaPromptModal userId={profile?.id} role={profile?.role} />
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LangProvider>
            <PlanProvider>
              <OfflineBanner />
              <AppShell />
              <Toaster />
            </PlanProvider>
          </LangProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
