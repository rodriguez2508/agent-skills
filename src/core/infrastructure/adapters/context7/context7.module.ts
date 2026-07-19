import { Module } from '@nestjs/common';
import { Context7Adapter } from './context7.adapter';

@Module({
  providers: [Context7Adapter],
  exports: [Context7Adapter],
})
export class Context7Module {}
