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
const SUPABASE_URL  = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing credentials')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const athlete_id = '9509eb38-a0c4-4427-8192-82b679735ddf' // Phong VDV's ID

async function test() {
  console.log('1. Calling RPC notify_registration_status...')
  const { data, error: rpcError } = await admin.rpc('notify_registration_status', {
    p_athlete_id:      athlete_id,
    p_status:          'approved',
    p_tournament_name: 'Giải Đấu Thử Nghiệm Realtime',
  })

  if (rpcError) {
    console.error('RPC Error:', rpcError)
    return
  }
  console.log('RPC called successfully.')

  console.log('2. Querying user_notifications for athlete to verify insert...')
  const { data: notifications, error: queryError } = await admin
    .from('user_notifications')
    .select('*')
    .eq('user_id', athlete_id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (queryError) {
    console.error('Query Error:', queryError)
    return
  }

  if (notifications && notifications.length > 0) {
    const notif = notifications[0]
    console.log('Verification Success! Latest notification:')
    console.log(`- ID: ${notif.id}`)
    console.log(`- Type: ${notif.type}`)
    console.log(`- Title: ${notif.title}`)
    console.log(`- Body: ${notif.body}`)
    console.log(`- CTA URL: ${notif.cta_url}`)
    console.log(`- Created At: ${notif.created_at}`)
  } else {
    console.error('No notification found for this athlete!')
  }
}

test()
