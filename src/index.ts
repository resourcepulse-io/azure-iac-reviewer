import * as core from '@actions/core';
import { context } from '@actions/github';

/**
 * Main entry point for the Azure IaC Reviewer GitHub Action
 */
async function run(): Promise<void> {
  try {
    core.info('Azure IaC Reviewer started');

    // Validate this is a pull request event
    if (context.eventName !== 'pull_request') {
      core.setFailed('This action only works on pull_request events');
      return;
    }

    core.info(`Processing PR #${context.issue.number} in ${context.repo.owner}/${context.repo.repo}`);

    // TODO: Implementation will be added by subsequent agents
    // - Agent 2: GitHub Integration (list changed files, filter .bicep)
    // - Agent 3: Bicep Compilation (compile .bicep to ARM)
    // - Agent 4: ARM Extraction (extract resource metadata)
    // - Agent 5: Privacy Sanitization (remove PII)
    // - Agent 6: Backend Integration (call analysis API)
    // - Agent 7: Output Formatting (generate markdown)
    // - Agent 2: Post PR comment

    // Placeholder for future async operations
    await Promise.resolve();

    core.info('Azure IaC Reviewer completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

void run();
