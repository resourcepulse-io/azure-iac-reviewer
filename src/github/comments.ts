import { Octokit } from '@octokit/rest';
import * as log from '../utils/log';
import { PRContext } from './context';

/**
 * Marker comment to identify comments created by this action
 */
const COMMENT_MARKER = '<!-- azure-iac-reviewer -->';

/**
 * Find existing comment created by this action
 * @param octokit - Authenticated Octokit instance
 * @param context - PR context
 * @returns Comment ID if found, null otherwise
 */
async function findExistingComment(
  octokit: Octokit,
  context: PRContext
): Promise<number | null> {
  try {
    const comments = await octokit.rest.issues.listComments({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.prNumber,
    });

    const existingComment = comments.data.find((comment) =>
      comment.body?.includes(COMMENT_MARKER)
    );

    return existingComment?.id || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.warning(`Failed to list existing comments: ${errorMessage}`);
    return null;
  }
}

/**
 * Create or update a PR comment
 * @param octokit - Authenticated Octokit instance
 * @param context - PR context
 * @param body - Comment body (markdown)
 * @param mode - Comment mode: 'update' or 'new'
 */
export async function createOrUpdateComment(
  octokit: Octokit,
  context: PRContext,
  body: string,
  mode: 'update' | 'new' = 'update'
): Promise<void> {
  // Add marker to comment body
  const markedBody = `${COMMENT_MARKER}\n${body}`;

  try {
    if (mode === 'update') {
      // Try to find and update existing comment
      const existingCommentId = await findExistingComment(octokit, context);

      if (existingCommentId) {
        log.info(`Updating existing PR comment (ID: ${existingCommentId})`);

        await octokit.rest.issues.updateComment({
          owner: context.owner,
          repo: context.repo,
          comment_id: existingCommentId,
          body: markedBody,
        });

        log.info('PR comment updated successfully');
        return;
      }

      // Fall through to create new comment if none exists
      log.info('No existing comment found, creating new comment');
    }

    // Create new comment
    log.info('Creating new PR comment');

    await octokit.rest.issues.createComment({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.prNumber,
      body: markedBody,
    });

    log.info('PR comment created successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create/update PR comment: ${errorMessage}`);
  }
}
