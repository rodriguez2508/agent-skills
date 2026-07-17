export type CatalogFilter = 'all' | 'summary' | { category: string } | { agentId: string };

export class GetAgentCatalogQuery {
  constructor(
    public readonly filter: CatalogFilter = 'all',
  ) {}
}
