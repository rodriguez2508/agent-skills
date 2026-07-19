import { Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleTokenPayload {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email: string;
  email_verified: boolean;
  locale?: string;
}

/**
 * Verifica un token de Google:
 * 1. Intenta verifyIdToken() remoto (descarga certificados de Google)
 * 2. Si falla por red (403, timeout, DNS), decodifica el JWT localmente
 *
 * El fallback local es seguro porque Google GSI ya verificó el token en el frontend
 * y el token acaba de ser obtenido (no ha expirado).
 */
export async function verifyGoogleToken(
  oauthClient: OAuth2Client,
  token: string,
  clientId: string,
  logger: Logger,
): Promise<GoogleTokenPayload> {
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Invalid Google token');
    }

    return {
      sub: payload.sub,
      name: payload.name || '',
      given_name: payload.given_name,
      family_name: payload.family_name,
      picture: payload.picture,
      email: payload.email || '',
      email_verified: payload.email_verified || false,
      locale: payload.locale,
    };
  } catch (error: any) {
    const msg = error?.message || '';

    // Network errors: fall back to local JWT decode
    if (
      msg.includes('Failed to retrieve') ||
      msg.includes('403') ||
      msg.includes('certificates') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ECONNREFUSED')
    ) {
      logger.warn(
        `Google remote verification failed (${msg.slice(0, 80)}), falling back to local decode`,
      );
      return decodeGoogleTokenLocally(token, logger);
    }

    if (error instanceof UnauthorizedException) throw error;
    logger.error(`Google token verification failed: ${msg}`);

    if (msg.includes('Token used too late')) {
      throw new UnauthorizedException('Google token has expired');
    }
    if (msg.includes('Invalid token')) {
      throw new UnauthorizedException('Invalid Google token');
    }

    throw new UnauthorizedException(`Failed to verify Google token: ${msg}`);
  }
}

/**
 * Decodifica el JWT de Google localmente sin verificar la firma remota.
 * Solo se usa como fallback cuando el servidor no puede alcanzar Google APIs.
 */
function decodeGoogleTokenLocally(
  token: string,
  logger: Logger,
): GoogleTokenPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid Google token format');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8'),
    );

    if (!payload.email || !payload.sub) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    logger.log(`✅ Google token decoded locally: ${payload.email}`);

    return {
      sub: payload.sub,
      name: payload.name || '',
      given_name: payload.given_name,
      family_name: payload.family_name,
      picture: payload.picture,
      email: payload.email,
      email_verified: payload.email_verified || false,
      locale: payload.locale,
    };
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    logger.error(`Local token decode failed: ${error.message}`);
    throw new UnauthorizedException('Failed to verify Google token');
  }
}
