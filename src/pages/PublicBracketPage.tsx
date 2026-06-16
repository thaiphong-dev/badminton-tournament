import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'

const STAGE_ORDER = ['round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final', 'third_place']

export default function PublicBracketPage() {
  const { id: tournamentId, eventId } = useParams()
  const { t } = useI18n()

  const [tournament, setTournament] = useState(null)
  const [event,      setEvent]      = useState(null)
  const [matches,    setMatches]    = useState([])
  const [playerMap,  setPlayerMap]  = useState({})
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const [tRes, eRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('id, name').eq('id', tournamentId).single(),
        supabase.from('events').select('id, event_type, name').eq('id', eventId).single(),
        supabase.from('matches')
          .select('id, stage, match_number, status, player1_id, player2_id, winner_id, player1_scores, player2_scores, is_forfeit')
          .eq('event_id', eventId)
          .not('stage', 'eq', 'group')
          .order('match_number'),
      ])
      setTournament(tRes.data)
      setEvent(eRes.data)
      const mList = mRes.data ?? []
      setMatches(mList)

      const pIds = [...new Set(mList.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean))]
      if (pIds.length > 0) {
        const { data: pList } = await supabase.from('players').select('id, name, club').in('id', pIds)
        setPlayerMap(Object.fromEntries((pList ?? []).map(p => [p.id, p])))
      }
      setLoading(false)
    }
    load()
  }, [tournamentId, eventId])

  const byStage = useMemo(() => {
    const map = {}
    for (const m of matches) {
      if (!map[m.stage]) map[m.stage] = []
      map[m.stage].push(m)
    }
    return map
  }, [matches])

  const stages = STAGE_ORDER.filter(s => byStage[s]?.length > 0)

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-surface text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">{t('bracket.publicTitle')}</p>
          <h1 className="text-sm font-bold text-gray-900 truncate">
            {tournament?.name}
            {event && (
              <span className="text-gray-500 font-normal ml-2">
                · {t(`discipline.${event.event_type}`) || event.event_type}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Bracket — horizontal scroll per stage */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {stages.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            {t('bracket.notCreated')}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => (
              <div key={stage} className="shrink-0 w-56">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">
                  {t(`stage.${stage}`) || stage}
                </p>
                <div className="space-y-3">
                  {(byStage[stage] ?? [])
                    .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
                    .map(m => (
                      <BracketCard key={m.id} match={m} playerMap={playerMap} t={t} />
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Champion */}
      {byStage.final?.[0]?.winner_id && (
        <div className="text-center pb-8">
          <p className="text-xs text-amber-600 uppercase tracking-widest mb-1">🏆 {t('bracket.champion')}</p>
          <p className="text-2xl font-black text-amber-500">
            {playerMap[byStage.final[0].winner_id]?.name ?? '—'}
          </p>
          {playerMap[byStage.final[0].winner_id]?.club && (
            <p className="text-sm text-gray-400 mt-0.5">
              {playerMap[byStage.final[0].winner_id].club}
            </p>
          )}
        </div>
      )}

      <div className="text-center pb-6 text-xs text-gray-400">
        Xem trực tiếp · <Link to={`/tournament/${tournamentId}/live`} className="underline text-blue-600">{t('bracket.liveScoreboard')}</Link>
      </div>
    </div>
  )
}

function BracketCard({ match, playerMap, t }) {
  const p1   = playerMap[match.player1_id]
  const p2   = playerMap[match.player2_id]
  const done = match.status === 'completed'
  const live = match.status === 'active'

  const score = done
    ? (match.player1_scores ?? []).map((s, i) => `${s}–${(match.player2_scores ?? [])[i] ?? 0}`).join(' ')
    : null

  return (
    <div className={cn(
      'rounded-xl border p-3 text-sm bg-white',
      live ? 'border-green-400 shadow-sm' : done ? 'border-gray-200' : 'border-gray-200',
    )}>
      {live && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-green-600">{t('common.live')}</span>
        </div>
      )}
      <BracketPlayer player={p1} isWinner={done && match.winner_id === match.player1_id} isForfeit={match.is_forfeit} tbd={t('bracket.tbd')} />
      <div className="border-t border-gray-100 my-1.5" />
      <BracketPlayer player={p2} isWinner={done && match.winner_id === match.player2_id} tbd={t('bracket.tbd')} />
      {score && (
        <p className="text-[10px] text-gray-400 mt-1.5 font-mono text-center">{score}</p>
      )}
      {!p1 && !p2 && (
        <p className="text-xs text-gray-400 text-center py-1">{t('bracket.waitingResult')}</p>
      )}
    </div>
  )
}

function BracketPlayer({ player, isWinner, isForfeit, tbd }) {
  return (
    <div className={cn('flex items-center justify-between gap-1', isWinner && 'font-bold')}>
      <span className={cn('text-xs truncate', isWinner ? 'text-gray-900' : 'text-gray-500', isForfeit && 'line-through text-gray-300')}>
        {player?.name ?? tbd}
      </span>
      {isWinner && <span className="text-amber-500 text-xs shrink-0">🏆</span>}
    </div>
  )
}
