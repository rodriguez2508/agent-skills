import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/domain/entities/user.entity';
import * as crypto from 'crypto';

/**
 * Servicio de usuarios para gestión de identidad
 * 
 * Características:
 * - Identificación automática por IP para desarrollo local
 * - Hash de IP para privacidad en producción
 * - Historial de IPs por usuario
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Encuentra usuario por IP o crea uno nuevo
   * 
   * Para desarrollo: usa IP directa como identificador
   * Para producción: usa hash de IP con salt para privacidad
   * 
   * @param ipAddress - Dirección IP del cliente
   * @returns Usuario encontrado o creado
   */
  async findByIpOrCreate(ipAddress: string): Promise<User> {
    // Hash de IP para privacidad (producción)
    const hashedIp = this.hashIpAddress(ipAddress);
    
    // Intentar buscar por IP directa (desarrollo) o hash (producción)
    let user = await this.userRepository.findOne({
      where: [{ lastIpAddress: ipAddress }],
    });

    if (!user) {
      user = this.userRepository.create({
        email: `user-${ipAddress.replace(/\./g, '-')}-@local.dev`,
        name: `Developer from ${ipAddress}`,
        lastIpAddress: ipAddress,
        ipAddressHistory: [ipAddress],
        active: true,
        emailVerified: false,
      });

      await this.userRepository.save(user);
    }

    // Actualizar historial de IPs si es nueva
    if (!user.ipAddressHistory?.includes(ipAddress)) {
      user.ipAddressHistory = [...(user.ipAddressHistory || []), ipAddress];
      user.lastIpAddress = ipAddress;
      await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Hash de IP para privacidad en producción
   * 
   * Usa HMAC-SHA256 con salt configurable
   * 
   * @param ipAddress - IP a hashear
   * @returns Hash hex string
   */
  private hashIpAddress(ipAddress: string): string {
    const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-prod';
    return crypto
      .createHmac('sha256', salt)
      .update(ipAddress)
      .digest('hex');
  }

  /**
   * Encuentra usuario por ID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Actualiza preferencias del usuario
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<User['preferences']>,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    user.preferences = { ...user.preferences, ...preferences };
    return await this.userRepository.save(user);
  }

  /**
   * Incrementa contador de sesiones
   */
  async incrementTotalSessions(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'totalSessions', 1);
  }

  /**
   * Incrementa contador de búsquedas
   */
  async incrementTotalSearches(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'totalSearches', 1);
  }
}
