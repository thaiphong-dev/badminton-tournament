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

async function check() {
  console.log('Querying app_config table...')
  const { data, error } = await admin
    .from('app_config')
    .select('*')
  
  if (error) {
    console.error('Query Error:', error)
  } else {
    console.log('app_config rows:')
    data.forEach(row => {
      console.log(`- ${row.key}: ${row.value ? JSON.stringify(row.value).substring(0, 30) : null}`)
    })
  }
}

check()
