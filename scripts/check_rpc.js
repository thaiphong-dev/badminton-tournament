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
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing credentials')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const athlete_id = '9509eb38-a0c4-4427-8192-82b679735ddf' // Phong VDV's ID from screenshot

async function test() {
  console.log('Querying user_notifications for athlete...')
  const { data, error } = await admin
    .from('user_notifications')
    .select('*')
    .eq('user_id', athlete_id)
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (error) {
    console.error('Query Error:', error)
  } else {
    console.log('Notifications found:', data)
  }
}

test()
