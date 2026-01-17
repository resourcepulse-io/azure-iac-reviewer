import { Octokit } from '@octokit/rest';
import { PRContext } from './context';
/**
 * Create or update a PR comment
 * @param octokit - Authenticated Octokit instance
 * @param context - PR context
 * @param body - Comment body (markdown) - should already include marker via formatPRComment()
 * @param mode - Comment mode: 'update' or 'new'
 */
export declare function createOrUpdateComment(octokit: Octokit, context: PRContext, body: string, mode?: 'update' | 'new'): Promise<void>;
//# sourceMappingURL=comments.d.ts.map