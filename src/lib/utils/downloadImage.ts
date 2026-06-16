import { toPng } from 'html-to-image'

/**
 * Capture a DOM element as a PNG and trigger a browser download.
 * Uses html-to-image (SVG foreignObject approach) which supports
 * modern CSS including Tailwind v4's oklch color functions.
 *
 * @param {HTMLElement} element   – the element to capture
 * @param {string}      filename  – e.g. "bang-dau.png"
 * @param {object}      opts      – optional html-to-image overrides
 */
export async function downloadElementAsImage(element, filename = 'download.png', opts = {}) {
  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,        // 2× for crisp retina-quality output
    cacheBust: true,
    // Capture full content dimensions, not the clipped/scrolled viewport size
    width: element.scrollWidth,
    height: element.scrollHeight,
    ...opts,
  })

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
