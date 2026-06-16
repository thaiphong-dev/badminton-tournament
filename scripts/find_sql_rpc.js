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

async function run() {
  console.log('Searching for custom RPCs in public schema...')
  const { data, error } = await admin
    .rpc('get_my_notifications') // just a test to verify connectivity
    .limit(1)

  // Let's query pg_catalog using standard PostgREST?
  // Wait, does PostgREST expose pg_proc or pg_catalog tables? By default, Supabase REST API does not expose pg_catalog.
  // But let's check if we can query it or if there is any table/view exposing schemas.
  console.log('Connectivity test result:', { data, error })
}

run()
