import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fmmxyccddyewxytsaiau.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtbXh5Y2NkZHlld3h5dHNhaWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjcyMzIsImV4cCI6MjA5MjIwMzIzMn0.-CQfG4yEznUaJXp1bM8SIRkgVXYtB0q0Tzvxpxok-CM'
)

async function run() {
  // Try to register
  const { data, error } = await supabase.rpc('register_user', {
    phone_input: '0901000099',
    password_input: 'Test1234!',
    role_input: 'athlete',
    name_input: 'Athlete Test 99'
  })
  console.log('Register Result:', data, error)

  // Try to login
  const { data: authData, error: authError } = await supabase.rpc('authenticate', {
    phone_input: '0901000099',
    password_input: 'Test1234!'
  })
  console.log('Auth  Result:', authData, authError)
}

run()
