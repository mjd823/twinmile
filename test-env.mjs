import dotenv from 'dotenv'
const result = dotenv.config({ path: '.env.local' })
console.log('Result:', result)
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET')
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'NOT SET')