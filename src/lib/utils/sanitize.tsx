/**
 * Strip XSS-risky characters from free-text input.
 * Áp dụng cho: tên giải, tên VĐV, CLB, ghi chú thanh toán.
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return ''
  return str.trim().replace(/[<>'"`;]/g, '')
}

export function sanitizeAndTrim(str, maxLen = 255) {
  return sanitizeText(str).slice(0, maxLen)
}

export function isValidPhone(phone) {
  return /^(0|\+84)[3-9]\d{8}$/.test((phone ?? '').trim())
}
