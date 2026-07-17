import { Request } from 'express';

/**
 * Returns cookie options based on the request and environment variables.
 */
export function getCookieOptions(request: Request) {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedDomains =
    process.env.ALLOWED_COOKIE_DOMAINS?.split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0) || [];

  const matchingDomain = allowedDomains.find((domain) =>
    request.hostname.endsWith(domain.replace(/^\\./, '')),
  );

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    domain: matchingDomain || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

/**
 * Returns cookie options for clearing a cookie.
 */
export function getClearCookieOptions(request: Request) {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedDomains =
    process.env.ALLOWED_COOKIE_DOMAINS?.split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0) || [];

  const matchingDomain = allowedDomains.find((domain) =>
    request.hostname.endsWith(domain.replace(/^\\./, '')),
  );

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    domain: matchingDomain || undefined,
  };
}
