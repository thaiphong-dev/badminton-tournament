import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load env
function parseEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const env = {}
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim()
    }
    return env
  } catch { return {} }
}

const env = parseEnvFile(resolve(__dirname, '../.env'))
const SUPABASE_URL  = env.VITE_SUPABASE_URL
const ANON_KEY      = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY)
const athlete_id = '9509eb38-a0c4-4427-8192-82b679735ddf' // Phong VDV's ID

async function test() {
  console.log('Invoking send-push Edge Function...')
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: {
      target_user_id: athlete_id,
      title: '✅ Đăng ký được duyệt (Test)',
      body: 'Bạn đã được duyệt tham gia Giải đấu Test.',
      url: '/athlete',
    },
  })
  
  if (error) {
    console.error('Edge Function Error:', error)
  } else {
    console.log('Edge Function Success!', data)
  }
}

test()
