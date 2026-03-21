import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { SearchRulesQuery } from '@application/queries/search-rules/search-rules.query';
import { GetRuleQuery } from '@application/queries/get-rule/get-rule.query';
import { ListRulesQuery } from '@application/queries/list-rules/list-rules.query';

interface GrpcCallback<T> {
  (err: grpc.ServiceError | null, value?: T): void;
}

@Injectable()
export class GrpcServerAdapter implements OnModuleInit, OnModuleDestroy {
  private server: grpc.Server;
  private readonly port: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly queryBus: QueryBus,
  ) {
    this.port = this.configService.get<number>('GRPC_PORT', 50051);
    this.server = new grpc.Server();
  }

  async onModuleInit(): Promise<void> {
    await this.initializeGrpcServer();
    this.server.bindAsync(
      `0.0.0.0:${this.port}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error(`[gRPC] Failed to bind: ${error}`);
          return;
        }
        console.log(`[gRPC] Server listening on port ${port}`);
      },
    );
  }

  onModuleDestroy(): void {
    this.server.forceShutdown();
  }

  private async initializeGrpcServer(): Promise<void> {
    const protoPath = join(process.cwd(), 'src/proto/agent-skill.proto');
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const agentSkillPackage = protoDescriptor.agent_skill as grpc.GrpcObject;

    this.server.addService(
      (agentSkillPackage.AgentSkillService as grpc.ServiceClientConstructor).service,
      {
        searchRules: this.searchRules.bind(this),
        searchRulesStream: this.searchRulesStream.bind(this),
        getRule: this.getRule.bind(this),
        listRules: this.listRules.bind(this),
        listRulesStream: this.listRulesStream.bind(this),
        healthCheck: this.healthCheck.bind(this),
      },
    );
  }

  private async searchRules(
    call: grpc.ServerUnaryCall<any, any>,
    callback: GrpcCallback<any>,
  ): Promise<void> {
    try {
      const { query, category, limit } = call.request;
      const results = await this.queryBus.execute(
        new SearchRulesQuery(query, category, limit),
      );
      callback(null, { results });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  private async searchRulesStream(
    call: grpc.ServerWritableStream<any, any>,
  ): Promise<void> {
    try {
      const { query, category, limit } = call.request;
      const results = await this.queryBus.execute(
        new SearchRulesQuery(query, category, limit),
      );

      for (let i = 0; i < results.length; i++) {
        call.write({
          result: results[i],
          is_last: i === results.length - 1,
        });
      }
      call.end();
    } catch (error) {
      call.emit('error', error);
    }
  }

  private async getRule(
    call: grpc.ServerUnaryCall<any, any>,
    callback: GrpcCallback<any>,
  ): Promise<void> {
    try {
      const { id } = call.request;
      const rule = await this.queryBus.execute(new GetRuleQuery(id));
      callback(null, { rule });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  private async listRules(
    call: grpc.ServerUnaryCall<any, any>,
    callback: GrpcCallback<any>,
  ): Promise<void> {
    try {
      const { category, limit } = call.request;
      const rules = await this.queryBus.execute(
        new ListRulesQuery(category, limit),
      );
      callback(null, { rules });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  private async listRulesStream(
    call: grpc.ServerWritableStream<any, any>,
  ): Promise<void> {
    try {
      const { category, limit } = call.request;
      const rules = await this.queryBus.execute(
        new ListRulesQuery(category, limit),
      );

      const batchSize = 10;
      for (let i = 0; i < rules.length; i += batchSize) {
        const batch = rules.slice(i, i + batchSize);
        call.write({
          rules: batch,
          is_last: i + batchSize >= rules.length,
        });
      }
      call.end();
    } catch (error) {
      call.emit('error', error);
    }
  }

  private healthCheck(
    call: grpc.ServerUnaryCall<any, any>,
    callback: GrpcCallback<any>,
  ): void {
    callback(null, {
      status: 'ok',
      version: '1.0.0',
      timestamp: Date.now(),
    });
  }
}
