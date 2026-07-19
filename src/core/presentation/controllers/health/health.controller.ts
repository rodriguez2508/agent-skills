import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

interface HealthResponse {
  status: string;
  version: string;
  timestamp: number;
  service: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check service health' })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'number' },
        service: { type: 'string', example: 'agent-skill-nestjs' },
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: Date.now(),
      service: 'agent-skill-nestjs',
    };
  }
}
