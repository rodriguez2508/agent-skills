import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface GraphifyBuildOptions {
  path: string;
  mode?: 'deep' | 'standard';
  update?: boolean;
  obsidian?: boolean;
  wiki?: boolean;
}

export interface GraphifyQueryResult {
  answer: string;
}

export interface GraphifyPathResult {
  path: string[];
}

export interface GraphifyExplainResult {
  explanation: string;
}

@Injectable()
export class GraphifyExecutorService {
  private readonly logger = new Logger(GraphifyExecutorService.name);

  async buildGraph(opts: GraphifyBuildOptions): Promise<string> {
    let cmd = `graphify ${opts.path}`;
    if (opts.mode === 'deep') cmd += ' --mode deep';
    if (opts.update) cmd += ' --update';
    if (opts.obsidian) cmd += ' --obsidian';
    if (opts.wiki) cmd += ' --wiki';

    this.logger.log(`🔨 Running: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });
    if (stderr) this.logger.warn(`stderr: ${stderr.substring(0, 500)}`);
    return stdout || 'Graph built successfully.';
  }

  async query(question: string): Promise<GraphifyQueryResult> {
    const cmd = `graphify query "${question.replace(/"/g, '\\"')}"`;
    this.logger.log(`🔍 Running: graphify query ...`);
    const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
    if (stderr) this.logger.warn(`stderr: ${stderr.substring(0, 500)}`);
    return { answer: stdout || 'No answer returned from graph.' };
  }

  async path(nodeA: string, nodeB: string): Promise<GraphifyPathResult> {
    const cmd = `graphify path "${nodeA.replace(/"/g, '\\"')}" "${nodeB.replace(/"/g, '\\"')}"`;
    this.logger.log(`🛤️ Running: graphify path ...`);
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    if (stderr) this.logger.warn(`stderr: ${stderr.substring(0, 500)}`);
    const lines = stdout.split('\n').filter((l) => l.trim());
    return { path: lines };
  }

  async explain(node: string): Promise<GraphifyExplainResult> {
    const cmd = `graphify explain "${node.replace(/"/g, '\\"')}"`;
    this.logger.log(`💡 Running: graphify explain ...`);
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    if (stderr) this.logger.warn(`stderr: ${stderr.substring(0, 500)}`);
    return { explanation: stdout || 'No explanation returned.' };
  }
}
