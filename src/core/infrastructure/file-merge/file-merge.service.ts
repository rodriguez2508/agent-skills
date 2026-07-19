import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const MARKER_OPEN = '<!-- gentle-ai:';
const MARKER_CLOSE = '-->';

/**
 * Service for injecting content into configuration files using markers.
 *
 * This ensures that managed content can be added/updated without clobbering
 * user-written content in the same file.
 *
 * Format:
 * ```
 * <!-- gentle-ai:section-id -->
 * [managed content]
 * <!-- gentle-ai:section-id:end -->
 * ```
 */
@Injectable()
export class FileMergeService {
  private readonly logger = new Logger(FileMergeService.name);

  /**
   * Writes content into a file using markers.
   * If the section already exists, it replaces it.
   * If not, it appends the section.
   *
   * @param filePath - Absolute path to the target file
   * @param content - Content to inject
   * @param sectionId - Unique section identifier
   */
  async writeWithMarkers(
    filePath: string,
    content: string,
    sectionId: string,
  ): Promise<void> {
    const markerOpen = `${MARKER_OPEN}${sectionId} -->`;
    const markerClose = `${MARKER_OPEN}${sectionId}:end -->`;

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let existing = '';
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      this.logger.debug(`File not found, will create: ${filePath}`);
    }

    const sectionRegex = this.buildSectionRegex(sectionId);
    const newSection = `${markerOpen}\n${content}\n${markerClose}`;

    // Reset lastIndex because global regexes maintain state
    sectionRegex.lastIndex = 0;
    const hasSection = sectionRegex.test(existing);

    if (hasSection) {
      // Replace existing section
      sectionRegex.lastIndex = 0; // Reset again for replace
      const updated = existing.replace(sectionRegex, newSection);
      await fs.writeFile(filePath, updated, 'utf-8');
      this.logger.debug(`Updated section '${sectionId}' in ${filePath}`);
    } else {
      // Append new section
      const separator = existing.trim().length > 0 ? '\n\n' : '';
      const updated = `${existing}${separator}${newSection}`;
      await fs.writeFile(filePath, updated, 'utf-8');
      this.logger.debug(`Appended section '${sectionId}' to ${filePath}`);
    }
  }

  /**
   * Alias for writeWithMarkers for semantic clarity when appending.
   */
  async appendWithMarkers(
    filePath: string,
    content: string,
    sectionId: string,
  ): Promise<void> {
    return this.writeWithMarkers(filePath, content, sectionId);
  }

  /**
   * Prepends content at the beginning of a file using markers.
   * If the section already exists, it replaces it in place.
   * Useful for critical instructions that must be read first.
   */
  async prependWithMarkers(
    filePath: string,
    content: string,
    sectionId: string,
  ): Promise<void> {
    const markerOpen = `${MARKER_OPEN}${sectionId} -->`;
    const markerClose = `${MARKER_OPEN}${sectionId}:end -->`;

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let existing = '';
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      this.logger.debug(`File not found, will create: ${filePath}`);
    }

    const sectionRegex = this.buildSectionRegex(sectionId);
    const newSection = `${markerOpen}\n${content}\n${markerClose}`;

    // Reset lastIndex because global regexes maintain state
    sectionRegex.lastIndex = 0;
    const hasSection = sectionRegex.test(existing);

    if (hasSection) {
      // Replace existing section in place
      sectionRegex.lastIndex = 0;
      const updated = existing.replace(sectionRegex, newSection);
      await fs.writeFile(filePath, updated, 'utf-8');
      this.logger.debug(`Updated section '${sectionId}' in ${filePath}`);
    } else {
      // Prepend at the beginning
      const separator = existing.trim().length > 0 ? '\n\n' : '';
      const updated = `${newSection}${separator}${existing}`;
      await fs.writeFile(filePath, updated, 'utf-8');
      this.logger.debug(`Prepended section '${sectionId}' to ${filePath}`);
    }
  }

  /**
   * Reads a managed section from a file.
   * Returns null if the section doesn't exist.
   */
  async readSection(filePath: string, sectionId: string): Promise<string | null> {
    let existing: string;
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }

    const sectionRegex = this.buildSectionRegex(sectionId);
    const match = existing.match(sectionRegex);

    if (!match) return null;

    // Extract content between markers
    const markerOpen = `${MARKER_OPEN}${sectionId} -->`;
    const markerClose = `${MARKER_OPEN}${sectionId}:end -->`;
    const fullMatch = match[0];
    const content = fullMatch
      .replace(markerOpen, '')
      .replace(markerClose, '')
      .trim();

    return content;
  }

  /**
   * Removes a managed section from a file.
   */
  async removeSection(filePath: string, sectionId: string): Promise<void> {
    let existing: string;
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      return; // File doesn't exist, nothing to remove
    }

    const sectionRegex = this.buildSectionRegex(sectionId);
    const updated = existing.replace(sectionRegex, '').replace(/\n{3,}/g, '\n\n').trim();

    await fs.writeFile(filePath, updated, 'utf-8');
    this.logger.debug(`Removed section '${sectionId}' from ${filePath}`);
  }

  /**
   * Checks if a managed section exists in a file.
   */
  async hasSection(filePath: string, sectionId: string): Promise<boolean> {
    let existing: string;
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      return false;
    }

    const sectionRegex = this.buildSectionRegex(sectionId);
    return sectionRegex.test(existing);
  }

  /**
   * Builds a regex to match a complete managed section.
   */
  private buildSectionRegex(sectionId: string): RegExp {
    const open = this.escapeRegex(`${MARKER_OPEN}${sectionId} -->`);
    const close = this.escapeRegex(`${MARKER_OPEN}${sectionId}:end -->`);
    return new RegExp(`${open}[\\s\\S]*?${close}`, 'g');
  }

  /**
   * Escapes special regex characters in a string.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
