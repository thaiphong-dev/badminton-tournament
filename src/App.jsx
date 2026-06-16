import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Header from '@/components/layout/Header'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import IncomingCallOverlay from '@/components/umpire/IncomingCallOverlay'
import { useAuth } from '@/lib/hooks/useAuth'
import useCallStore from '@/lib/stores/callStore'
import ErrorBoundary              from '@/components/ErrorBoundary'
import { PlanProvider }           from '@/lib/hooks/usePlan'
import { LangProvider }           from '@/i18n'
import Toaster                    from '@/components/ui/Toaster'
import OfflineBanner              from '@/components/ui/OfflineBanner'
import PwaPromptModal             from '@/components/ui/PwaPromptModal'

// ── Always-on pages (auth flow + core shell) ────────────────────────────────
// Kept eager because they're always reachable from any entry point.
import LoginPage        from '@/pages/LoginPage'
import RegisterPage     from '@/pages/RegisterPage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'
import Home             from '@/pages/Home'
import TournamentOverview from '@/pages/TournamentOverview'

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// Each lazy() call creates a separate async chunk; the browser only downloads
// the chunk when a user actually navigates to that route.

// Umpire (full-screen, separate session context)
const UmpirePage      = lazy(() => import('@/pages/UmpirePage'))
const UmpireMatchPage = lazy(() => import('@/pages/UmpireMatchPage'))

// Athlete portal
const AthleteDashboard = lazy(() => import('@/pages/AthleteDashboard'))

// Admin
const AdminDashboard   = lazy(() => import('@/pages/AdminDashboard'))

// Creator management (heavy — form-heavy pages, chart deps)
const TournamentCreate        = lazy(() => import('@/pages/TournamentCreate'))
const TournamentEdit          = lazy(() => import('@/pages/TournamentEdit'))
const TournamentSetup         = lazy(() => import('@/pages/TournamentSetup'))
const EventSetup              = lazy(() => import('@/pages/EventSetup'))
const EventPlayersPage        = lazy(() => import('@/pages/EventPlayersPage'))
const AttendancePage          = lazy(() => import('@/pages/AttendancePage'))
const GroupStagePage          = lazy(() => import('@/pages/GroupStagePage'))
const KnockoutPage            = lazy(() => import('@/pages/KnockoutPage'))
const TournamentReportPage    = lazy(() => import('@/pages/TournamentReportPage'))
const CreatorAnalyticsPage    = lazy(() => import('@/pages/CreatorAnalyticsPage'))
const CreatorSubscriptionPage = lazy(() => import('@/pages/CreatorSubscriptionPage'))
const AddOnShopPage           = lazy(() => import('@/pages/AddOnShopPage'))
const CheckoutPage            = lazy(() => import('@/pages/CheckoutPage'))
const PlansPage               = lazy(() => import('@/pages/PlansPage'))

// Results + public pages
const ResultsPage          = lazy(() => import('@/pages/ResultsPage'))
const TournamentResultsPage = lazy(() => import('@/pages/TournamentResultsPage'))
const LeaderboardPage      = lazy(() => import('@/pages/LeaderboardPage'))
const ScoreboardDisplay    = lazy(() => import('@/pages/ScoreboardDisplay'))
const TournamentLivePage   = lazy(() => import('@/pages/TournamentLivePage'))
const PlayerStatsPage      = lazy(() => import('@/pages/PlayerStatsPage'))
const TournamentCourtsPage = lazy(() => import('@/pages/TournamentCourtsPage'))
const PlayerProfilePage    = lazy(() => import('@/pages/PlayerProfilePage'))
const PublicBracketPage    = lazy(() => import('@/pages/PublicBracketPage'))

// Misc
const ProfilePage  = lazy(() => import('@/pages/ProfilePage'))
const PrivacyPage  = lazy(() => import('@/pages/PrivacyPage'))
const TermsPage    = lazy(() => import('@/pages/TermsPage'))
const FeaturesPage = lazy(() => import('@/pages/FeaturesPage'))

// ── Page loader fallback ──────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

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
          <Suspense fallback={<PageLoader />}>
            <UmpirePage />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/umpire/match/:matchId" element={
        <ProtectedRoute allowedRoles={['umpire']}>
          <Suspense fallback={<PageLoader />}>
            <UmpireMatchPage />
          </Suspense>
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
            <Suspense fallback={<PageLoader />}>
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
            </Suspense>
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
