/**
 * Search Module
 *
 * Módulo que agrupa los adaptadores de búsqueda web
 * Sigue arquitectura hexagonal
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExaSearchAdapter } from './exa-search.adapter';

@Module({
  imports: [ConfigModule],
  providers: [ExaSearchAdapter],
  exports: [ExaSearchAdapter],
})
export class SearchModule {}
