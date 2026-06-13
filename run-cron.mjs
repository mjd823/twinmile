import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import './scripts/process-outreach-cron.mjs'