import { create } from 'zustand'

export const useTournamentStore = create((set) => ({
  // Current tournament
  tournament: null,
  players: [],
  groups: [],
  matches: [],

  setTournament: (tournament) => set({ tournament }),
  setPlayers: (players) => set({ players }),
  setGroups: (groups) => set({ groups }),
  setMatches: (matches) => set({ matches }),

  updateMatch: (matchId, updates) => set(state => ({
    matches: state.matches.map(m => m.id === matchId ? { ...m, ...updates } : m),
  })),

  reset: () => set({
    tournament: null,
    players: [],
    groups: [],
    matches: [],
  }),
}))
