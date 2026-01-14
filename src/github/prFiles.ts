import { Octokit } from '@octokit/rest';
import * as log from '../utils/log';
import { PRContext } from './context';

/**
 * Represents a changed file in a pull request
 */
export interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

/**
 * List all files changed in a pull request
 * @param octokit - Authenticated Octokit instance
 * @param context - PR context with owner, repo, and PR number
 * @returns Array of changed files
 * @throws Error if API call fails
 */
export async function listChangedFiles(
  octokit: Octokit,
  context: PRContext
): Promise<ChangedFile[]> {
  log.debug(
    `Fetching changed files for PR #${context.prNumber} in ${context.owner}/${context.repo}`
  );

  try {
    const response = await octokit.rest.pulls.listFiles({
      owner: context.owner,
      repo: context.repo,
      pull_number: context.prNumber,
      per_page: 100, // GitHub API default
    });

    const files: ChangedFile[] = response.data.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
    }));

    log.debug(`Found ${files.length} changed file(s) in PR`);

    return files;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to list changed files for PR #${context.prNumber}: ${errorMessage}`
    );
  }
}

/**
 * Filter files by extension
 * @param files - Array of changed files
 * @param extension - File extension to filter by (with or without leading dot)
 * @returns Filtered array of filenames
 */
export function filterFilesByExtension(
  files: ChangedFile[],
  extension: string
): string[] {
  // Normalize extension to always have leading dot and lowercase
  const normalizedExt = (
    extension.startsWith('.') ? extension : `.${extension}`
  ).toLowerCase();

  const filtered = files
    .filter((file) => file.filename.toLowerCase().endsWith(normalizedExt))
    .map((file) => file.filename);

  return filtered;
}

/**
 * List changed .bicep files in a pull request
 * @param octokit - Authenticated Octokit instance
 * @param context - PR context with owner, repo, and PR number
 * @returns Array of .bicep file paths
 * @throws Error if API call fails
 */
export async function listBicepFiles(
  octokit: Octokit,
  context: PRContext
): Promise<string[]> {
  log.info('Detecting changed .bicep files in PR');

  const allFiles = await listChangedFiles(octokit, context);
  const bicepFiles = filterFilesByExtension(allFiles, '.bicep');

  if (bicepFiles.length === 0) {
    log.info('No .bicep files detected in PR changes');
  } else {
    log.info(`Detected ${bicepFiles.length} .bicep file(s):`);
    bicepFiles.forEach((file) => {
      log.info(`  - ${file}`);
    });
  }

  return bicepFiles;
}
