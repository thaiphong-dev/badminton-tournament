/**
 * Pure game logic for badminton umpire mode.
 * No React, no Supabase — just pure functions.
 */

function splitPair(name) {
  if (!name) return [null, null]
  const i = name.indexOf(' / ')
  return i >= 0 ? [name.slice(0, i), name.slice(i + 3)] : [name, null]
}

/**
 * Check if a set has been won.
 * Returns 'p1' | 'p2' | null
 */
export function checkSetWin(scoreP1, scoreP2, pointsPerSet = 21) {
  const target = pointsPerSet
  const max = target === 21 ? 30 : target + 6 

  if (scoreP1 >= target || scoreP2 >= target) {
    if (scoreP1 >= max) return 'p1'
    if (scoreP2 >= max) return 'p2'
    if (scoreP1 >= target && scoreP1 - scoreP2 >= 2) return 'p1'
    if (scoreP2 >= target && scoreP2 - scoreP1 >= 2) return 'p2'
  }
  return null
}

/**
 * Check if the match has been won.
 */
export function checkMatchWin(completedSets, totalSets = 3) {
  const setsToWin = Math.ceil(totalSets / 2)
  const p1Sets    = completedSets.filter(s => s.p1 > s.p2).length
  const p2Sets    = completedSets.filter(s => s.p2 > s.p1).length
  if (p1Sets >= setsToWin) return 'p1'
  if (p2Sets >= setsToWin) return 'p2'
  return null
}

export function buildFinalScores(completedSets) {
  return {
    p1Scores: completedSets.map(s => s.p1),
    p2Scores: completedSets.map(s => s.p2),
  }
}

export function getScoreLabel(scoreP1, scoreP2, pointsPerSet = 21, completedSets = [], totalSets = 3) {
  const max = pointsPerSet === 21 ? 30 : pointsPerSet + 6
  const setsToWin = Math.ceil(totalSets / 2)
  const p1Sets = completedSets.filter(s => s.p1 > s.p2).length
  const p2Sets = completedSets.filter(s => s.p2 > s.p1).length
  
  const isMatchPoint = (p1Sets === setsToWin - 1 && scoreP1 >= pointsPerSet - 1 && scoreP1 > scoreP2) ||
                       (p2Sets === setsToWin - 1 && scoreP2 >= pointsPerSet - 1 && scoreP2 > scoreP1)

  if (scoreP1 >= pointsPerSet - 1 && scoreP2 >= pointsPerSet - 1) {
    if (scoreP1 === max - 1 || scoreP2 === max - 1) return isMatchPoint ? 'MATCH POINT' : 'GAME POINT'
    return 'DEUCE'
  }
  
  if (isMatchPoint) return 'MATCH POINT'
  if (scoreP1 === pointsPerSet - 1 || scoreP2 === pointsPerSet - 1) return 'GAME POINT'
  
  return null
}

export function createInitialState(p1Id, p2Id, totalSets, pointsPerSet, p1Name = 'Player 1', p2Name = 'Player 2') {
  const [p1a, p1b] = splitPair(p1Name)
  const [p2a, p2b] = splitPair(p2Name)
  const isDoubles = !!(p1b || p2b)

  return {
    phase:         'confirm',
    completedSets: [],
    currentSetP1:  0,
    currentSetP2:  0,
    currentSet:    1,
    serverId:      null,
    serverPlayer:  null,
    receiverPlayer:null,
    totalSets,
    pointsPerSet,
    shuttleCount:  0,
    shuttleLogs:   [],
    startedAt:     null,
    history:       [],
    future:        [],
    isDoubles,
    p1PlayerR:     p1a,
    p1PlayerL:     p1b,
    p2PlayerR:     p2a,
    p2PlayerL:     p2b,
  }
}

export function addPoint(state, scorerId) {
  const snapshot = cloneState(state)
  const isP1Scorer = scorerId === 'p1'
  
  const newP1 = isP1Scorer ? state.currentSetP1 + 1 : state.currentSetP1
  const newP2 = isP1Scorer ? state.currentSetP2 : state.currentSetP2 + 1
  
  let newState = {
    ...state,
    currentSetP1: newP1,
    currentSetP2: newP2,
    history:      [...state.history, snapshot],
    future:       [],
  }

  const newScore = isP1Scorer ? newP1 : newP2
  const even = newScore % 2 === 0

  if (state.serverId === scorerId) {
    // Serving side won rally -> position switch
    if (state.isDoubles) {
      if (isP1Scorer) {
        newState.p1PlayerR = state.p1PlayerL
        newState.p1PlayerL = state.p1PlayerR
      } else {
        newState.p2PlayerR = state.p2PlayerL
        newState.p2PlayerL = state.p2PlayerR
      }
    } else {
      // Singles: server moves to correct service court (even → R, odd → L)
      // Receiver mirrors server's side (diagonal = same pos label)
      const p1Name = state.p1PlayerR ?? state.p1PlayerL
      const p2Name = state.p2PlayerR ?? state.p2PlayerL
      if (isP1Scorer) {
        newState.p1PlayerR = even ? p1Name : null
        newState.p1PlayerL = even ? null   : p1Name
        newState.serverPlayer = p1Name
        newState.p2PlayerR   = even ? p2Name : null
        newState.p2PlayerL   = even ? null   : p2Name
      } else {
        newState.p2PlayerR = even ? p2Name : null
        newState.p2PlayerL = even ? null   : p2Name
        newState.serverPlayer = p2Name
        newState.p1PlayerR   = even ? p1Name : null
        newState.p1PlayerL   = even ? null   : p1Name
      }
    }
  } else {
    // Receiving side won rally -> they serve, no position switch
    newState.serverId = scorerId
    if (state.isDoubles) {
      // The player in the box corresponding to their new team score serves.
      newState.serverPlayer = isP1Scorer
        ? (even ? newState.p1PlayerR : newState.p1PlayerL)
        : (even ? newState.p2PlayerR : newState.p2PlayerL)

      const serverBox = even ? 'R' : 'L'
      newState.receiverPlayer = isP1Scorer
        ? (serverBox === 'R' ? newState.p2PlayerR : newState.p2PlayerL)
        : (serverBox === 'R' ? newState.p1PlayerR : newState.p1PlayerL)
    } else {
      // Singles: new server positioned by their new score parity
      // Receiver mirrors server's side (diagonal = same pos label)
      const p1Name = state.p1PlayerR ?? state.p1PlayerL
      const p2Name = state.p2PlayerR ?? state.p2PlayerL
      if (isP1Scorer) {
        newState.p1PlayerR = even ? p1Name : null
        newState.p1PlayerL = even ? null   : p1Name
        newState.serverPlayer = p1Name
        newState.p2PlayerR   = even ? p2Name : null
        newState.p2PlayerL   = even ? null   : p2Name
      } else {
        newState.p2PlayerR = even ? p2Name : null
        newState.p2PlayerL = even ? null   : p2Name
        newState.serverPlayer = p2Name
        newState.p1PlayerR   = even ? p1Name : null
        newState.p1PlayerL   = even ? null   : p1Name
      }
    }
  }

  const setWinner = checkSetWin(newP1, newP2, state.pointsPerSet)
  if (setWinner) {
    const completedSets = [...state.completedSets, { p1: newP1, p2: newP2 }]
    const matchWinner   = checkMatchWin(completedSets, state.totalSets)

    if (matchWinner) {
      return { ...newState, completedSets, phase: 'finished' }
    }
    return {
      ...newState,
      completedSets,
      currentSetP1: 0,
      currentSetP2: 0,
      currentSet:   state.currentSet + 1,
      phase:        'set_break',
      setJustWon:   setWinner,
    }
  }

  return newState
}

export function undoLastPoint(state) {
  if (!state.history.length) return state
  const prev = state.history[state.history.length - 1]
  const history = state.history.slice(0, -1)
  const future  = [cloneState(state), ...state.future]
  return { ...prev, history, future }
}

export function redoLastPoint(state) {
  if (!state.future.length) return state
  const next = state.future[0]
  const future = state.future.slice(1)
  const history = [...state.history, cloneState(state)]
  return { ...next, history, future }
}

export function startNextSet(state, firstServerId, firstServerPlayer = null, firstReceiverPlayer = null) {
  // If firstReceiverPlayer is provided, we need to arrange the receiving team
  // so that firstReceiverPlayer is in the Right box (since score is 0-0).
  let newState = {
    ...state,
    phase:        'scoring',
    serverId:     firstServerId,
    serverPlayer: firstServerPlayer,
    receiverPlayer: firstReceiverPlayer,
    setJustWon:   null,
    history:      [],
    future:       [],
    currentSetP1: 0,
    currentSetP2: 0,
  }

  if (state.isDoubles && firstReceiverPlayer) {
    const receivingTeam = firstServerId === 'p1' ? 'p2' : 'p1'
    if (receivingTeam === 'p1') {
      if (newState.p1PlayerL === firstReceiverPlayer) {
        newState.p1PlayerL = newState.p1PlayerR
        newState.p1PlayerR = firstReceiverPlayer
      }
    } else {
      if (newState.p2PlayerL === firstReceiverPlayer) {
        newState.p2PlayerL = newState.p2PlayerR
        newState.p2PlayerR = firstReceiverPlayer
      }
    }
  }
  
  // Arrange serving team so firstServerPlayer is in Right box
  if (state.isDoubles && firstServerPlayer) {
    if (firstServerId === 'p1') {
      if (newState.p1PlayerL === firstServerPlayer) {
        newState.p1PlayerL = newState.p1PlayerR
        newState.p1PlayerR = firstServerPlayer
      }
    } else {
      if (newState.p2PlayerL === firstServerPlayer) {
        newState.p2PlayerL = newState.p2PlayerR
        newState.p2PlayerR = firstServerPlayer
      }
    }
  }

  // Singles: position first server at R (score 0 = even → right court)
  // Receiver mirrors server's side
  if (!state.isDoubles && firstServerId) {
    const serverName = firstServerPlayer
      ?? (firstServerId === 'p1' ? (newState.p1PlayerR ?? newState.p1PlayerL) : (newState.p2PlayerR ?? newState.p2PlayerL))
    const receiverName = firstServerId === 'p1'
      ? (newState.p2PlayerR ?? newState.p2PlayerL)
      : (newState.p1PlayerR ?? newState.p1PlayerL)
    newState.serverPlayer = serverName
    if (firstServerId === 'p1') {
      newState.p1PlayerR = serverName; newState.p1PlayerL = null
      newState.p2PlayerR = receiverName; newState.p2PlayerL = null
    } else {
      newState.p2PlayerR = serverName; newState.p2PlayerL = null
      newState.p1PlayerR = receiverName; newState.p1PlayerL = null
    }
  }

  return newState
}

export function addShuttle(state, amount = 1) {
  const logEntry = {
    round: (state.shuttleLogs?.length || 0) + 1,
    amount,
    timestamp: new Date().toISOString()
  }
  return { 
    ...state, 
    shuttleCount: (state.shuttleCount || 0) + amount,
    shuttleLogs: [...(state.shuttleLogs || []), logEntry]
  }
}

function cloneState(state) {
  return {
    ...state,
    completedSets: [...state.completedSets],
    history:       [],
    future:        [],
  }
}
