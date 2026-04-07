import { Injectable, Logger } from '@nestjs/common';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { Context7Adapter } from '@infrastructure/adapters/context7/context7.adapter';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { IAgent } from '@core/agents/agent.port';

/**
 * Context7Agent - Specialized agent for fetching library documentation via Context7
 * Handles requests for up-to-date, version-specific documentation
 */
@Injectable()
export class Context7Agent implements IAgent {
  readonly agentId = 'Context7Agent';
  readonly description = 'Agente especializado en documentación de librerías usando Context7';

  private readonly logger = new Logger(Context7Agent.name);

  constructor(
    private readonly context7: Context7Adapter,
    private readonly agentLogger: AgentLoggerService,
  ) {}

  /**
   * Determines if this agent can handle the given input
   * Matches patterns related to library documentation and Context7
   */
  canHandle(input: string): boolean {
    const lower = input.toLowerCase();
    return (
      lower.includes('context7') ||
      lower.includes('use context7') ||
      lower.includes('documentación de') ||
      lower.includes('documentacion de') ||
      lower.includes('docs de') ||
      lower.includes('library docs') ||
      lower.includes('library documentation') ||
      lower.includes('api docs') ||
      lower.includes('api documentation') ||
      lower.includes('cómo usar') ||
      lower.includes('como usar') ||
      lower.includes('how to use') ||
      lower.includes('setup') ||
      lower.includes('configurar') ||
      lower.includes('configure') ||
      (lower.includes('docs') && (lower.includes('librería') || lower.includes('libreria') || lower.includes('library')))
    );
  }

  /**
   * Executes the agent's main logic
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    return this.handleDocumentationRequest(request.input);
  }

  /**
   * Handles documentation requests by parsing the input and fetching relevant docs
   */
  private async handleDocumentationRequest(input: string): Promise<AgentResponse> {
    this.agentLogger.info(
      this.agentId,
      `📚 [Context7] Processing documentation request: ${input.substring(0, 100)}`,
    );

    if (!this.context7.isEnabled()) {
      return {
        success: false,
        data: {
          message: 'Context7 is not enabled. Set CONTEXT7_ENABLED=true and CONTEXT7_API_KEY in your environment variables.',
        },
      };
    }

    try {
      // Parse the input to extract library name and query
      const { libraryName, query } = this.parseInput(input);

      this.agentLogger.info(
        this.agentId,
        `🔍 [Context7] Resolving library: ${libraryName}`,
      );

      // Check if input contains a direct library ID (starts with /)
      const libraryIdMatch = input.match(/\/[\w-]+\/[\w.-]+/);
      
      let result;
      if (libraryIdMatch) {
        // Direct library ID provided
        const libraryId = libraryIdMatch[0];
        this.agentLogger.info(
          this.agentId,
          `📖 [Context7] Using direct library ID: ${libraryId}`,
        );
        result = await this.context7.getDocs(libraryId, query);
      } else {
        // Search by library name
        result = await this.context7.searchDocs(libraryName, query);
      }

      if (!result.success) {
        this.agentLogger.warn(
          this.agentId,
          `⚠️ [Context7] Failed to fetch docs: ${result.documentation.substring(0, 100)}`,
        );

        return {
          success: false,
          data: {
            message: result.documentation,
            libraryName,
            query,
          },
        };
      }

      this.agentLogger.info(
        this.agentId,
        `✅ [Context7] Documentation fetched for ${result.libraryId}`,
      );

      return {
        success: true,
        data: {
          libraryId: result.libraryId,
          libraryName: libraryName,
          query,
          documentation: result.documentation,
          formattedMessage: this.formatDocumentation({
            libraryId: result.libraryId,
            libraryName: libraryName,
            query,
            documentation: result.documentation,
          }),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.agentLogger.error(
        this.agentId,
        `❌ [Context7] Error: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
        data: {
          message: `Error fetching documentation: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Parses user input to extract library name and query
   * Handles various input formats
   */
  private parseInput(input: string): { libraryName: string; query: string } {
    const lower = input.toLowerCase();

    // Pattern: "use context7" or "use library /org/project"
    const context7Pattern = /(?:use\s+)?(?:context7|library\s+)(?:\/[\w-]+\/[\w.-]+)?\s*(.*)/i;
    
    // Pattern: "docs de <library>" or "documentation for <library>"
    const docsPattern = /(?:docs?|documentación?|documentation)\s+(?:de|for|about)\s+([\w.-]+)\s*(.*)/i;
    
    // Pattern: "how to use <library>" or "cómo usar <library>"
    const howToPattern = /(?:how\s+to\s+use|cómo?\s+usar|setup|configure)\s+([\w.-]+)\s*(.*)/i;

    // Check for direct library ID
    const libraryIdMatch = input.match(/(\/[\w-]+\/[\w.-]+)/);
    if (libraryIdMatch) {
      const libraryId = libraryIdMatch[1];
      const query = input.replace(libraryId, '').trim() || input;
      return { libraryName: libraryId, query };
    }

    // Check docs pattern
    const docsMatch = input.match(docsPattern);
    if (docsMatch) {
      return { libraryName: docsMatch[1], query: docsMatch[2] || input };
    }

    // Check how-to pattern
    const howToMatch = input.match(howToPattern);
    if (howToMatch) {
      return { libraryName: howToMatch[1], query: input };
    }

    // Check context7 pattern
    const context7Match = input.match(context7Pattern);
    if (context7Match && context7Match[1]) {
      return { libraryName: context7Match[1].split(' ')[0], query: input };
    }

    // Default: use first word as library, rest as query
    const words = input.split(' ');
    if (words.length > 1) {
      return { libraryName: words[0], query: input };
    }

    return { libraryName: input, query: input };
  }

  /**
   * Formats the documentation result into a readable message
   */
  private formatDocumentation(result: { libraryId: string; query: string; documentation: string; libraryName?: string }): string {
    const name = result.libraryName || result.libraryId;
    let formatted = `📚 **Documentation for** \`${result.libraryId}\` (${name})\n\n`;
    formatted += `**Query**: ${result.query}\n\n`;
    formatted += `---\n\n`;
    formatted += result.documentation;

    return formatted;
  }
}
