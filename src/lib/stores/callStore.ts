import { create } from 'zustand'

const useCallStore = create((set) => ({
  // Trạng thái cuộc gọi đến (dành cho umpire)
  incomingCall: null,
  // Shape của incomingCall:
  // {
  //   matchId:     string,   -- UUID của match
  //   matchLabel:  string,   -- ví dụ "Tứ kết — Trận 5"
  //   player1Name: string,
  //   player2Name: string,
  //   calledAt:    string,   -- ISO timestamp (call_started_at từ DB)
  // }

  setIncomingCall:   (call) => set({ incomingCall: call }),
  clearIncomingCall: ()     => set({ incomingCall: null }),
}))

export default useCallStore
