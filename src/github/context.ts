import * as fs from 'fs';
import { Octokit } from '@octokit/rest';
import * as log from '../utils/log';

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
  fullName: string; // owner/repo format (e.g., "myorg/myrepo")
  prTitle: string;
  prAuthor: string;
  baseBranch: string;
}

/**
 * GitHub event payload structure for pull_request events
 */
interface GitHubEvent {
  pull_request?: {
    number: number;
    title: string;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      ref: string;
    };
    user: {
      login: string;
    };
  };
  repository?: {
    owner: {
      login: string;
    };
    name: string;
  };
}

/**
 * Parse GITHUB_EVENT_PATH and validate it's a pull_request event
 * @returns Parsed PR context
 * @throws Error if not a pull_request event or required data is missing
 */
export function parsePRContext(): PRContext {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH environment variable is not set');
  }

  if (!eventName) {
    throw new Error('GITHUB_EVENT_NAME environment variable is not set');
  }

  // Validate this is a pull_request event
  if (eventName !== 'pull_request') {
    throw new Error(
      `This action only works on pull_request events. Current event: ${eventName}`
    );
  }

  // Read and parse the event payload
  let eventPayload: GitHubEvent;
  try {
    const eventData = fs.readFileSync(eventPath, 'utf8');
    eventPayload = JSON.parse(eventData) as GitHubEvent;
  } catch (error) {
    throw new Error(
      `Failed to read or parse event payload from ${eventPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate required fields are present
  if (!eventPayload.pull_request) {
    throw new Error('Event payload does not contain pull_request data');
  }

  if (!eventPayload.repository) {
    throw new Error('Event payload does not contain repository data');
  }

  const prNumber = eventPayload.pull_request.number;
  const owner = eventPayload.repository.owner.login;
  const repo = eventPayload.repository.name;
  const sha = eventPayload.pull_request.head.sha;
  const ref = eventPayload.pull_request.head.ref;
  const prTitle = eventPayload.pull_request.title || '';
  const prAuthor = eventPayload.pull_request.user?.login || '';
  const baseBranch = eventPayload.pull_request.base?.ref || 'main';

  if (!owner || !repo || !prNumber) {
    throw new Error(
      'Event payload is missing required fields (owner, repo, or PR number)'
    );
  }

  const fullName = `${owner}/${repo}`;

  log.info(`Detected PR #${prNumber} in ${fullName}`);
  log.debug(`PR head SHA: ${sha}`);
  log.debug(`PR head ref: ${ref}`);
  log.debug(`PR title: ${prTitle}`);
  log.debug(`PR author: ${prAuthor}`);

  return {
    owner,
    repo,
    prNumber,
    eventName,
    sha,
    ref,
    fullName,
    prTitle,
    prAuthor,
    baseBranch,
  };
}

/**
 * Create authenticated Octokit client
 * @returns Configured Octokit instance
 * @throws Error if GITHUB_TOKEN is not available
 */
export function createOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      'GITHUB_TOKEN environment variable is not set. Ensure the workflow has appropriate permissions.'
    );
  }

  log.debug('Creating authenticated Octokit client');

  return new Octokit({
    auth: token,
    userAgent: 'azure-iac-reviewer-action',
  });
}

/**
 * Initialize GitHub context and Octokit client
 * @returns Tuple of [PRContext, Octokit]
 * @throws Error if initialization fails
 */
export function initializeGitHub(): [PRContext, Octokit] {
  log.info('Initializing GitHub context');

  const context = parsePRContext();
  const octokit = createOctokit();

  log.info(
    `Successfully initialized GitHub context for ${context.owner}/${context.repo} PR #${context.prNumber}`
  );

  return [context, octokit];
}
