import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Context7LibraryResult {
  libraryId: string;
  libraryName: string;
  description?: string;
  codeSnippets?: number;
  trustScore?: number;
  benchmarkScore?: number;
}

export interface Context7DocsResult {
  libraryId: string;
  query: string;
  documentation: string;
  success: boolean;
}

interface Context7SearchResponse {
  results?: Array<{
    id: string;
    title: string;
    description?: string;
    totalSnippets?: number;
    trustScore?: number;
    benchmarkScore?: number;
  }>;
}

/**
 * Context7Adapter - Wrapper for Context7 REST API
 * Provides up-to-date, version-specific documentation for libraries
 */
@Injectable()
export class Context7Adapter {
  private readonly logger = new Logger(Context7Adapter.name);
  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly apiBaseUrl = 'https://context7.com/api/v2';

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('CONTEXT7_ENABLED', 'false') === 'true';
    this.apiKey = this.configService.get<string>('CONTEXT7_API_KEY', '');
  }

  /**
   * Checks if Context7 is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Builds authorization headers for Context7 API
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Resolves a library name to a Context7-compatible library ID
   * Example: "Next.js" -> "/vercel/next.js"
   *
   * @param libraryName - The library name to search for
   * @returns The best matching library result or null if not found
   */
  async resolveLibrary(libraryName: string): Promise<Context7LibraryResult | null> {
    if (!this.isEnabled()) {
      this.logger.warn('Context7 is not enabled. Set CONTEXT7_ENABLED=true and CONTEXT7_API_KEY');
      return null;
    }

    try {
      const url = `${this.apiBaseUrl}/libs/search?query=${encodeURIComponent(libraryName)}&libraryName=${encodeURIComponent(libraryName)}`;
      const response = await fetch(url, { headers: this.getHeaders() });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        this.logger.error(`Context7 search error: ${error}`);
        return null;
      }

      const data: Context7SearchResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        this.logger.debug(`No library found for: ${libraryName}`);
        return null;
      }

      // Return the first (most relevant) match
      const library = data.results[0];
      return {
        libraryId: library.id,
        libraryName: library.title,
        description: library.description,
        codeSnippets: library.totalSnippets,
        trustScore: library.trustScore,
        benchmarkScore: library.benchmarkScore,
      };
    } catch (error) {
      this.logger.error(`Error resolving library: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetches documentation for a specific library using its Context7 ID
   *
   * @param libraryId - Context7 library ID (e.g., "/angular/angular")
   * @param query - What the user needs help with
   * @returns Documentation result
   */
  async getDocs(libraryId: string, query: string): Promise<Context7DocsResult> {
    if (!this.isEnabled()) {
      return {
        libraryId,
        query,
        documentation: 'Context7 is not enabled. Set CONTEXT7_ENABLED=true and CONTEXT7_API_KEY in your environment.',
        success: false,
      };
    }

    if (!libraryId || !libraryId.startsWith('/')) {
      return {
        libraryId,
        query,
        documentation: `Invalid library ID: "${libraryId}". Expected format: /owner/repo`,
        success: false,
      };
    }

    try {
      const url = `${this.apiBaseUrl}/context?libraryId=${encodeURIComponent(libraryId)}&query=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: this.getHeaders() });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        this.logger.error(`Context7 fetch error: ${error}`);
        return {
          libraryId,
          query,
          documentation: `Error fetching documentation: ${error}`,
          success: false,
        };
      }

      // Try to parse as JSON first
      const contentType = response.headers.get('content-type') || '';
      let documentation: string;

      if (contentType.includes('application/json')) {
        const data = await response.json();
        documentation = data.context || data.documentation || 'No documentation found.';
      } else {
        // Response is plain text/markdown
        documentation = await response.text();
      }

      return {
        libraryId,
        query,
        documentation,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error fetching docs: ${error.message}`);
      return {
        libraryId,
        query,
        documentation: `Error fetching documentation: ${error.message}`,
        success: false,
      };
    }
  }

  /**
   * Smart search: resolves library and fetches docs in one step
   *
   * @param libraryName - Library name to search for
   * @param query - What the user needs help with
   * @returns Documentation result
   */
  async searchDocs(libraryName: string, query: string): Promise<Context7DocsResult> {
    const library = await this.resolveLibrary(libraryName);

    if (!library) {
      return {
        libraryId: libraryName,
        query,
        documentation: `Library "${libraryName}" not found in Context7 index. Try using the exact library name or check https://context7.com for available libraries.`,
        success: false,
      };
    }

    return this.getDocs(library.libraryId, query);
  }

  /**
   * Fetches documentation using a direct library ID
   * Useful when the user already knows the ID (e.g., "/angular/angular")
   *
   * @param libraryId - Direct library ID or library name
   * @param query - What the user needs help with
   * @returns Documentation result
   */
  async getDocsByLibraryId(libraryId: string, query: string): Promise<Context7DocsResult> {
    // If libraryId starts with /, it's a direct ID
    if (libraryId.startsWith('/')) {
      return this.getDocs(libraryId, query);
    }

    // Otherwise, try to resolve it as a library name
    return this.searchDocs(libraryId, query);
  }

  /**
   * Parses error response from Context7 API
   */
  private async parseErrorResponse(response: Response): Promise<string> {
    try {
      const json = await response.json();
      if (json.message) {
        return json.message;
      }
    } catch {
      // JSON parsing failed
    }

    const status = response.status;
    if (status === 429) {
      return this.apiKey
        ? 'Rate limited or quota exceeded. Upgrade your plan at https://context7.com/plans'
        : 'Rate limited. Create a free API key at https://context7.com/dashboard';
    }
    if (status === 404) {
      return 'Library not found. Check the library ID and try again.';
    }
    if (status === 401) {
      return 'Invalid API key. API keys should start with "ctx7sk" prefix.';
    }
    return `Request failed with status ${status}.`;
  }
}
