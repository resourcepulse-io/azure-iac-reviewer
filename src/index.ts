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

    // Extract resource metadata from ARM templates
    const { extractResourceMetadata } = await import('./iac/armExtract');
    const allResources = [];

    for (const compilation of successfulCompilations) {
      try {
        // Convert ARM template object back to JSON string for extraction
        const armJson = JSON.stringify(compilation.armTemplate);
        const extractionResult = extractResourceMetadata(armJson);
        allResources.push(...extractionResult.resources);
        log.debug(
          `Extracted ${extractionResult.resourceCount} resource(s) from ${compilation.filePath}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.warning(`Failed to extract resources from ${compilation.filePath}: ${errorMessage}`);
        // Continue processing other files
      }
    }

    if (allResources.length === 0) {
      log.info('No resources found in compiled templates. Nothing to analyze.');
      return;
    }

    log.info(`Total resources detected: ${allResources.length}`);

    // Sanitize resources (privacy layer)
    const { sanitizeResources } = await import('./iac/sanitize');
    const sanitizationResult = sanitizeResources(allResources);
    log.info(
      `Sanitized ${sanitizationResult.resourceCount} resource(s) for analysis`
    );

    // Get action inputs
    const apiKey = core.getInput('api_key') || undefined;
    const commentMode = (core.getInput('comment_mode') || 'update') as 'update' | 'new';

    // Analyze resources (backend or local fallback)
    const { analyzeResources } = await import('./backend/client');
    const analysisResult = await analyzeResources(
      sanitizationResult.resources,
      apiKey,
      prContext.fullName
    );

    log.info(`Analysis completed using ${analysisResult.source} source`);

    // Format as PR comment
    const { formatPRComment } = await import('./format/markdown');
    const commentBody = formatPRComment(analysisResult);

    // Post or update PR comment
    const { createOrUpdateComment } = await import('./github/comments');
    await createOrUpdateComment(octokit, prContext, commentBody, commentMode);

    // Set action outputs
    core.setOutput('resources_detected', allResources.length.toString());
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
