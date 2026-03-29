import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para extraer la dirección IP real del cliente
 * 
 * Soporta:
 * - Headers de proxy (X-Forwarded-For, X-Real-IP)
 * - IPv4 e IPv6
 * - Remoción de prefijo IPv6 (::ffff:)
 * 
 * Adjunta la IP al request como:
 * - req.ipAddress - IP limpia
 * - req.userId - Usado como identificador temporal de usuario
 */
@Injectable()
export class ExtractIpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extraer IP real (considerando proxies y load balancers)
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    
    let ipAddress: string;
    
    if (forwardedFor) {
      // x-forwarded-for puede tener múltiples IPs: client, proxy1, proxy2
      // Tomar la primera (cliente original)
      ipAddress = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ipAddress = realIp;
    } else {
      ipAddress = req.socket.remoteAddress || '127.0.0.1';
    }

    // Remover prefijo IPv6 si existe (ej: ::ffff:192.168.1.1 → 192.168.1.1)
    if (ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.substring(7);
    }

    // Adjuntar al request para uso posterior
    (req as any).ipAddress = ipAddress;
    
    // Usar IP como userId temporal para auto-identificación
    (req as any).userId = ipAddress;

    next();
  }
}
