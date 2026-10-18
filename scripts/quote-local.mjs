// Local checks must not inherit usable email, AI, billing, or integration keys.
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const env = { ...process.env };
let fixtureUri = process.env.MONGODB_URI;
for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|MONGODB|DATABASE|SMTP|RESEND|TWILIO/i.test(key)) env[key] = '';
for (const file of ['.env', '.env.local', ...['development', 'test', 'production'].flatMap(mode => [`.env.${mode}`, `.env.${mode}.local`])]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, 'utf8'));
  if (file === '.env.local') fixtureUri = values.MONGODB_URI || fixtureUri;
  for (const key of Object.keys(values)) env[key] = '';
}
const mode = process.argv[2] || 'test';
if (!['test', 'build', 'verify', 'dev'].includes(mode)) throw new Error('Expected test, build, verify, or dev');
Object.assign(env, { NODE_ENV: mode === 'build' ? 'production' : 'test', NEXT_TELEMETRY_DISABLED: '1', OUTREACH_AUTOMATION: 'false', MONGODB_URI: '', CRON_SECRET: 'local-quote-fixture-only' });
if (mode === 'verify') {
  if (!fixtureUri) throw new Error('A database connection is required for the isolated fixture database');
  env.QUOTE_VERIFY_URI = fixtureUri;
}
const args = mode === 'test' ? ['--test', 'scripts/*.test.mjs']
  : mode === 'verify' ? ['--import', 'tsx', 'scripts/verify-quote-intake.ts', ...process.argv.slice(3)]
    : ['node_modules/next/dist/bin/next', mode, ...(mode === 'dev' ? ['-p', '3462', '--hostname', '127.0.0.1'] : [])];
const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
