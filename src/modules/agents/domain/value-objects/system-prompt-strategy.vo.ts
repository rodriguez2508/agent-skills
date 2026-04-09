/**
 * Strategy for injecting system prompts into agent config files.
 *
 * Different agents use different approaches for their system prompt:
 * - Claude Code: CLAUDE.md (markdown sections)
 * - OpenCode: AGENTS.md (file replace)
 * - Qwen CLI: INSTRUCTIONS.md (append to file)
 */
export enum SystemPromptStrategy {
  /**
   * Write markdown sections into a CLAUDE.md-style file.
   * Used by: Claude Code
   */
  MarkdownSections = 0,

  /**
   * Replace the entire AGENTS.md file content.
   * Used by: OpenCode
   */
  FileReplace = 1,

  /**
   * Append content to existing INSTRUCTIONS.md without clobbering.
   * Used by: Qwen CLI
   */
  AppendToFile = 2,
}
