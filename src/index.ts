import * as core from '@actions/core';
import * as log from './utils/log';
import { initializeGitHub } from './github/context';
import { listBicepFilesWithStatus, BicepFileWithStatus } from './github/prFiles';
import type { ResourceMetadata } from './iac/armExtract';
import type { BackendCallContext } from './backend/client';
import type { ResourceChangeType } from './iac/sanitize';

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

    // List and filter .bicep files with change status
    const bicepFilesWithStatus = await listBicepFilesWithStatus(octokit, prContext);

    // Exit successfully if no .bicep files found (no comment spam)
    if (bicepFilesWithStatus.length === 0) {
      log.info('No .bicep files to analyze. Exiting successfully.');
      return;
    }

    log.info(`Found ${bicepFilesWithStatus.length} .bicep file(s) to analyze`);

    // Extract just the filenames for compilation
    const bicepFiles = bicepFilesWithStatus.map((f) => f.filename);

    // Create a map of filename to change type for later use
    const fileChangeMap = new Map<string, BicepFileWithStatus['change']>();
    for (const file of bicepFilesWithStatus) {
      fileChangeMap.set(file.filename, file.change);
    }

    // Download and cache Bicep CLI
    const { ensureBicepCli, compileBicepFiles, formatCompilationErrors } =
      await import('./iac/bicep');
    const bicepCliPath = await ensureBicepCli();

    // Compile all .bicep files
    const compilationResults = await compileBicepFiles(bicepCliPath, bicepFiles);

    // Check for compilation errors
    const compilationErrors = formatCompilationErrors(compilationResults);
    if (compilationErrors) {
      // Post compilation errors to PR
      const { createOrUpdateComment } = await import('./github/comments');
      await createOrUpdateComment(octokit, prContext, compilationErrors);

      log.warning('Some Bicep files failed to compile, but continuing analysis');
    }

    // Filter successful compilations for further processing
    const successfulCompilations = compilationResults.filter((r) => r.success);

    if (successfulCompilations.length === 0) {
      log.warning('No Bicep files compiled successfully. Analysis cannot proceed.');
      return;
    }

    log.info(
      `${successfulCompilations.length} file(s) compiled successfully, proceeding with analysis`
    );

    // Extract resource metadata from ARM templates with change tracking
    const { extractResourceMetadata } = await import('./iac/armExtract');
    const resourcesWithChange: Array<{ resource: ResourceMetadata; change: ResourceChangeType }> = [];

    for (const compilation of successfulCompilations) {
      try {
        // Convert ARM template object back to JSON string for extraction
        const armJson = JSON.stringify(compilation.armTemplate);
        const extractionResult = extractResourceMetadata(armJson);

        // Get the change type for this file
        const change = fileChangeMap.get(compilation.filePath) || 'modified';

        // Add resources with their change type
        for (const resource of extractionResult.resources) {
          resourcesWithChange.push({ resource, change });
        }

        log.debug(
          `Extracted ${extractionResult.resourceCount} resource(s) from ${compilation.filePath} (${change})`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.warning(`Failed to extract resources from ${compilation.filePath}: ${errorMessage}`);
        // Continue processing other files
      }
    }

    if (resourcesWithChange.length === 0) {
      log.info('No resources found in compiled templates. Nothing to analyze.');
      return;
    }

    log.info(`Total resources detected: ${resourcesWithChange.length}`);

    // Sanitize resources with change tracking (privacy layer)
    const { sanitizeResourcesWithChanges } = await import('./iac/sanitize');
    const sanitizationResult = sanitizeResourcesWithChanges(resourcesWithChange);
    log.info(
      `Sanitized ${sanitizationResult.resourceCount} resource(s) for analysis`
    );

    // Get action inputs
    const apiKey = core.getInput('api_key') || undefined;
    const serverAddress = core.getInput('server_address') || undefined;
    const commentMode = (core.getInput('comment_mode') || 'update') as 'update' | 'new';

    // Build backend call context
    const { analyzeResources } = await import('./backend/client');

    const callContext: BackendCallContext = {
      repo: {
        owner: prContext.owner,
        name: prContext.repo,
        fullName: prContext.fullName,
      },
      pr: {
        number: prContext.prNumber,
        title: prContext.prTitle,
        author: prContext.prAuthor,
        baseBranch: prContext.baseBranch,
      },
      run: {
        id: process.env.GITHUB_RUN_ID || '',
        url: `https://github.com/${prContext.fullName}/actions/runs/${process.env.GITHUB_RUN_ID || ''}`,
      },
      context: {
        sha: prContext.sha,
        ref: prContext.ref,
      },
    };

    // Analyze resources (backend or local fallback)
    const analysisResult = await analyzeResources(sanitizationResult.resources, {
      apiKey,
      serverAddress,
      callContext,
    });

    log.info(`Analysis completed using ${analysisResult.source} source`);

    // Format as PR comment
    const { formatPRComment } = await import('./format/markdown');
    const commentBody = formatPRComment(analysisResult);

    // Post or update PR comment
    const { createOrUpdateComment } = await import('./github/comments');
    await createOrUpdateComment(octokit, prContext, commentBody, commentMode);

    // Set action outputs
    core.setOutput('resources_detected', resourcesWithChange.length.toString());
    core.setOutput('analysis_status', 'success');

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
