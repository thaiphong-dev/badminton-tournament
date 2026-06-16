import { forwardRef } from 'react'

/**
 * Certificate template rendered off-screen, then captured with html-to-image.
 * Fixed at 1122×794px (A4 landscape at 96 dpi / 2× for retina → 297×210mm).
 *
 * Props:
 *   playerName     – e.g. "Nguyễn Văn A"
 *   club           – e.g. "CLB Cầu Lông Sài Gòn" (optional)
 *   position       – 1 | 2 | 3
 *   eventName      – e.g. "Đơn Nam"
 *   tournamentName – e.g. "Giải Cầu Lông Mở Rộng Q1 2026"
 *   date           – formatted date string, e.g. "09/06/2026" (optional)
 *   location       – e.g. "Nhà thi đấu Phú Thọ" (optional)
 */
const CertificateTemplate = forwardRef(function CertificateTemplate(
  { playerName, club, position, eventName, tournamentName, date, location },
  ref,
) {
  const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[position] ?? '🏆'
  const posLabel = { 1: 'NHẤT', 2: 'NHÌ', 3: 'BA' }[position] ?? `HẠNG ${position}`

  return (
    <div
      ref={ref}
      style={{
        width: 1122,
        height: 794,
        background: '#fffef7',
        fontFamily: '"Georgia", "Times New Roman", serif',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Outer decorative border */}
      <div style={{
        position: 'absolute', inset: 16,
        border: '3px double #c9973a',
        borderRadius: 4,
        pointerEvents: 'none',
      }} />

      {/* Inner thin border */}
      <div style={{
        position: 'absolute', inset: 26,
        border: '1px solid #e8d498',
        borderRadius: 2,
        pointerEvents: 'none',
      }} />

      {/* Corner ornaments */}
      {['top-5 left-5', 'top-5 right-5', 'bottom-5 left-5', 'bottom-5 right-5'].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top:    pos.includes('top')    ? 20 : undefined,
            bottom: pos.includes('bottom') ? 20 : undefined,
            left:   pos.includes('left')   ? 20 : undefined,
            right:  pos.includes('right')  ? 20 : undefined,
            width: 28,
            height: 28,
            border: '2px solid #c9973a',
            borderRadius: '50%',
            background: '#fffef7',
          }}
        />
      ))}

      {/* Shuttle icon (top decoration) */}
      <div style={{ fontSize: 36, marginBottom: 8, letterSpacing: 12 }}>🏸 🏆 🏸</div>

      {/* Title */}
      <h1 style={{
        fontSize: 28,
        fontWeight: 'bold',
        letterSpacing: '0.2em',
        color: '#3d2c00',
        textTransform: 'uppercase',
        textAlign: 'center',
        margin: '0 0 6px 0',
      }}>
        Chứng Nhận Thành Tích
      </h1>

      {/* Divider */}
      <div style={{ width: 120, height: 2, background: '#c9973a', margin: '6px 0 16px 0' }} />

      {/* Tournament name */}
      <p style={{
        fontSize: 13,
        letterSpacing: '0.15em',
        color: '#7a6020',
        textTransform: 'uppercase',
        textAlign: 'center',
        margin: '0 0 20px 0',
      }}>
        {tournamentName}
      </p>

      {/* "Chứng nhận:" label */}
      <p style={{ fontSize: 14, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
        Chứng nhận
      </p>

      {/* Player name */}
      <h2 style={{
        fontSize: 38,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        margin: '0 0 4px 0',
        letterSpacing: '0.04em',
      }}>
        {playerName}
      </h2>

      {/* Club */}
      {club && (
        <p style={{ fontSize: 15, color: '#666', margin: '0 0 18px 0', fontStyle: 'italic' }}>
          {club}
        </p>
      )}

      {/* Achievement box */}
      <div style={{
        margin: '16px 0',
        padding: '14px 40px',
        background: '#fef9e7',
        border: '1px solid #e8d498',
        borderRadius: 8,
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 13, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Đạt</p>
        <p style={{ fontSize: 24, fontWeight: 'bold', color: '#7a4f00', margin: 0 }}>
          {medal} {posLabel} — {eventName}
        </p>
      </div>

      {/* Date + location */}
      {(date || location) && (
        <div style={{ display: 'flex', gap: 32, marginTop: 16, fontSize: 13, color: '#666' }}>
          {date     && <span>📅 {date}</span>}
          {location && <span>📍 {location}</span>}
        </div>
      )}

      {/* Signature area */}
      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <div style={{ width: 160, height: 1, background: '#bbb', margin: '0 auto 6px auto' }} />
        <p style={{ fontSize: 12, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          Ban tổ chức
        </p>
      </div>
    </div>
  )
})

export default CertificateTemplate
