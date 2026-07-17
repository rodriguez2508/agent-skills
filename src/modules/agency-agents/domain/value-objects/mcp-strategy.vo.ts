/**
 * Strategy for configuring MCP servers in agent config files.
 *
 * Different agents store MCP configuration in different formats and locations.
 */
export enum MCPStrategy {
  /**
   * Separate JSON files per MCP server.
   * Example: ~/.claude/mcp/{server}.json
   * Used by: Claude Code
   */
  SeparateFiles = 0,

  /**
   * Merge MCP config into the main settings.json file.
   * Used by: OpenCode, Gemini CLI
   */
  MergeIntoSettings = 1,

  /**
   * Dedicated mcp.json config file.
   * Used by: Cursor, Qwen CLI
   */
  MCPConfigFile = 2,

  /**
   * TOML-based config file.
   * Used by: Codex
   */
  TOMLFile = 3,
}
