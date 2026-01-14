import { Octokit } from '@octokit/rest';
/**
 * GitHub PR context extracted from event payload
 */
export interface PRContext {
    owner: string;
    repo: string;
    prNumber: number;
    eventName: string;
    sha: string;
    ref: string;
}
/**
 * Parse GITHUB_EVENT_PATH and validate it's a pull_request event
 * @returns Parsed PR context
 * @throws Error if not a pull_request event or required data is missing
 */
export declare function parsePRContext(): PRContext;
/**
 * Create authenticated Octokit client
 * @returns Configured Octokit instance
 * @throws Error if GITHUB_TOKEN is not available
 */
export declare function createOctokit(): Octokit;
/**
 * Initialize GitHub context and Octokit client
 * @returns Tuple of [PRContext, Octokit]
 * @throws Error if initialization fails
 */
export declare function initializeGitHub(): [PRContext, Octokit];
//# sourceMappingURL=context.d.ts.map