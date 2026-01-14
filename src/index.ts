import * as core from '@actions/core';
import * as log from './utils/log';
import { initializeGitHub } from './github/context';
import { listBicepFiles } from './github/prFiles';

/**
 * Main entry point for the Azure IaC Reviewer GitHub Action
 */
async function run(): Promise<void> {
  try {
    log.info('Azure IaC Reviewer started');

    // Initialize GitHub context and Octokit client
    const [prContext, octokit] = initializeGitHub();

    log.info(
      `Processing PR #${prContext.prNumber} in ${prContext.owner}/${prContext.repo}`
    );

    // List and filter .bicep files
    const bicepFiles = await listBicepFiles(octokit, prContext);

    // Exit successfully if no .bicep files found (no comment spam)
    if (bicepFiles.length === 0) {
      log.info('No .bicep files to analyze. Exiting successfully.');
      return;
    }

    log.info(`Found ${bicepFiles.length} .bicep file(s) to analyze`);

    // TODO: Implement bicep compilation (Task A4)
    // TODO: Implement ARM extraction (Task A5)
    // TODO: Implement sanitization (Task A6)
    // TODO: Implement backend communication (Task A7)
    // TODO: Implement PR comment posting (Task A8)

    log.info('Azure IaC Reviewer completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

void run();
