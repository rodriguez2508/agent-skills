#!/usr/bin/env node

/**
 * Agency Skills CLI — Autenticación por IP
 *
 * Uso:
 *   node scripts/cli-login.ts [--name <name>] [--email <email>] [--url <api-url>]
 *
 * El backend detecta tu usuario por IP (decorador @Ip() de NestJS).
 * Si ya existes con esa IP, retorna tu sessionId existente.
 * Si no, crea un usuario anónimo y una nueva sesión.
 */

const API_URL = process.env.AGENCY_API_URL || 'http://localhost:8004';

interface SessionLoginResponse {
  sessionId: string;
  userId: string;
  isNewUser: boolean;
}

async function sessionLogin(name?: string, email?: string): Promise<SessionLoginResponse> {
  const body: Record<string, string> = {};
  if (name) body.name = name;
  if (email) body.email = email;

  const res = await fetch(`${API_URL}/auth/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<SessionLoginResponse>;
}

async function main() {
  const args = process.argv.slice(2);
  let name: string | undefined;
  let email: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) name = args[++i];
    if (args[i] === '--email' && args[i + 1]) email = args[++i];
  }

  console.log('🔐 Agency Skills CLI — Session Login');
  console.log(`   API: ${API_URL}`);
  console.log('');

  try {
    const result = await sessionLogin(name, email);

    console.log(`✅ Session ID:  ${result.sessionId}`);
    console.log(`✅ User ID:     ${result.userId}`);
    console.log(`✅ New User:    ${result.isNewUser}`);
    console.log('');
    console.log('💡 Usa este sessionId como header en llamadas API:');
    console.log(`   curl -H "X-Session-Id: ${result.sessionId}" ${API_URL}/...`);
    console.log('');

    // Also output as JSON for piping
    console.log(JSON.stringify(result));
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
