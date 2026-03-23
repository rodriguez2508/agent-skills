/**
 * IP Tracker Middleware
 *
 * Captures and logs the client IP address for each request.
 * Adds the IP to the request object for use in controllers.
 */

import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface RequestWithIp extends Request {
  clientIp?: string;
}

@Injectable()
export class IpTrackerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpTrackerMiddleware.name);

  use(req: RequestWithIp, res: Response, next: NextFunction): void {
    const ip = this.getClientIp(req);
    req.clientIp = ip;

    this.logger.debug(`📍 Request from IP: ${ip} - ${req.method} ${req.path}`);

    next();
  }

  /**
   * Get client IP address from request
   * Handles proxied requests (X-Forwarded-For, X-Real-IP)
   */
  private getClientIp(req: Request): string {
    // Check for proxy headers first
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, first one is the client
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = req.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    // Fallback to direct connection IP
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
