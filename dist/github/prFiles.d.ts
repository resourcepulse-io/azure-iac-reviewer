import { Octokit } from '@octokit/rest';
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
export declare function listChangedFiles(octokit: Octokit, context: PRContext): Promise<ChangedFile[]>;
/**
 * Filter files by extension
 * @param files - Array of changed files
 * @param extension - File extension to filter by (with or without leading dot)
 * @returns Filtered array of filenames
 */
export declare function filterFilesByExtension(files: ChangedFile[], extension: string): string[];
/**
 * List changed .bicep files in a pull request
 * @param octokit - Authenticated Octokit instance
 * @param context - PR context with owner, repo, and PR number
 * @returns Array of .bicep file paths
 * @throws Error if API call fails
 */
export declare function listBicepFiles(octokit: Octokit, context: PRContext): Promise<string[]>;
//# sourceMappingURL=prFiles.d.ts.map