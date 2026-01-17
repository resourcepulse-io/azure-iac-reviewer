import * as log from '../utils/log';
import { SanitizedResource, validateNoSensitiveData } from '../iac/sanitize';

/**
 * Backend API URL - hardcoded and non-configurable by users
 */
const BACKEND_URL = 'https://api.resourcepulse.io';

/**
 * Result of the analysis operation
 */
export interface AnalysisResult {
  success: boolean;
  source: 'backend' | 'local';
  markdown: string; // Pre-formatted message ready for PR comment
}

/**
 * Repository metadata included in backend request
 */
interface RepositoryInfo {
  fullName: string; // owner/repo format (e.g., "myorg/myrepo")
}

/**
 * Request payload sent to backend
 */
interface AnalysisRequest {
  resources: SanitizedResource[];
  repo?: RepositoryInfo;
  timestamp?: string;
}

/**
 * Backend response format
 */
interface BackendResponse {
  markdown?: string;
  message?: string;
  error?: string;
}

/**
 * Default timeout for backend requests (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Generate local fallback markdown when backend is unavailable or no API key provided
 * @param resources - Sanitized resources to summarize
 * @returns Markdown formatted summary
 */
function generateLocalFallback(resources: SanitizedResource[]): string {
  // Count resources by kind
  const kindCounts = new Map<string, number>();
  for (const resource of resources) {
    const count = kindCounts.get(resource.kind) || 0;
    kindCounts.set(resource.kind, count + 1);
  }

  // Sort by count (descending) for better display
  const sortedKinds = Array.from(kindCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  // Build markdown summary
  const lines: string[] = [];
  lines.push('## Azure Resource Analysis');
  lines.push('');
  lines.push(
    `Detected **${resources.length}** resource(s) in your Bicep files:`
  );
  lines.push('');

  // If more than 5 resources, make it collapsible
  if (resources.length > 5) {
    lines.push('<details>');
    lines.push(`<summary>📋 Resource Details (${resources.length} resources)</summary>`);
    lines.push('');
  }

  // Resource breakdown by kind
  for (const [kind, count] of sortedKinds) {
    const kindLabel = formatKindLabel(kind);
    lines.push(`- **${kindLabel}**: ${count}`);
  }

  // Close details if we opened it
  if (resources.length > 5) {
    lines.push('');
    lines.push('</details>');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    '💡 **Want detailed cost estimates and security recommendations?**'
  );
  lines.push('');
  lines.push(
    'Add an API key to enable full analysis powered by ResourcePulse:'
  );
  lines.push('');
  lines.push('```yaml');
  lines.push('- uses: resourcepulse-io/azure-iac-reviewer@v1');
  lines.push('  with:');
  lines.push('    api_key: ${{ secrets.RESOURCEPULSE_API_KEY }}');
  lines.push('```');
  lines.push('');

  // Add collapsible privacy information
  lines.push('<details>');
  lines.push('<summary>🔒 Privacy Information</summary>');
  lines.push('');
  lines.push(
    'This action analyzes anonymized resource metadata only - no source code or identifiers are transmitted. All sensitive information (names, IDs, secrets) is stripped before analysis.'
  );
  lines.push('');
  lines.push('</details>');

  return lines.join('\n');
}

/**
 * Format resource kind into human-readable label
 * @param kind - Resource kind identifier
 * @returns Formatted label
 */
function formatKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    vm: 'Virtual Machines',
    app_service: 'App Services',
    app_service_plan: 'App Service Plans',
    sql_db: 'SQL Databases',
    storage: 'Storage Accounts',
    vnet: 'Virtual Networks',
    nsg: 'Network Security Groups',
    other: 'Other Resources',
  };

  return labels[kind] || kind.toUpperCase();
}

/**
 * Call backend API with timeout and error handling
 * @param resources - Sanitized resources to analyze
 * @param apiKey - Backend authentication token
 * @param backendUrl - Backend API endpoint
 * @param repoInfo - Optional repository metadata
 * @returns Backend response or null if failed
 */
async function callBackend(
  resources: SanitizedResource[],
  apiKey: string,
  backendUrl: string,
  repoInfo?: RepositoryInfo
): Promise<BackendResponse | null> {
  // Validate no sensitive data before sending
  const validation = validateNoSensitiveData(resources);
  if (!validation.valid) {
    log.error('Privacy contract violation detected - refusing to send data');
    log.error(`Violations: ${validation.violations.join(', ')}`);
    throw new Error(
      'Privacy contract violation: Sanitized data contains sensitive information'
    );
  }

  const requestPayload: AnalysisRequest = {
    resources,
    timestamp: new Date().toISOString(),
  };

  // Include repository info if provided
  if (repoInfo) {
    requestPayload.repo = repoInfo;
  }

  log.debug(`Calling backend API: ${backendUrl}`);
  log.debug(`Sending ${resources.length} sanitized resource(s)`);
  if (repoInfo) {
    log.debug(`Repository: ${repoInfo.fullName}`);
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(`${backendUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'azure-iac-reviewer/1.0.0',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      log.warning(
        `Backend returned status ${response.status}: ${response.statusText}`
      );

      // Try to parse error message
      try {
        const errorData = (await response.json()) as BackendResponse;
        log.warning(`Backend error: ${errorData.error || errorData.message}`);
      } catch {
        // Ignore JSON parse errors
      }

      return null;
    }

    // Parse successful response
    const data = (await response.json()) as BackendResponse;
    log.debug('Backend response received successfully');

    return data;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        log.warning(
          `Backend request timed out after ${DEFAULT_TIMEOUT_MS}ms`
        );
      } else if (
        error.message.includes('fetch failed') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED')
      ) {
        log.warning(`Network error calling backend: ${error.message}`);
      } else {
        log.warning(`Error calling backend: ${error.message}`);
      }
    } else {
      log.warning('Unknown error calling backend');
    }

    return null;
  }
}

/**
 * Analyze resources using backend service or local fallback
 * This is the main entry point for backend integration
 * @param resources - Sanitized resources to analyze
 * @param apiKey - Optional backend authentication token
 * @param repoFullName - Optional repository full name (owner/repo format)
 * @returns Analysis result with markdown message
 */
export async function analyzeResources(
  resources: SanitizedResource[],
  apiKey?: string,
  repoFullName?: string
): Promise<AnalysisResult> {
  log.debug('Starting resource analysis');

  // If no API key provided, use local fallback immediately
  if (!apiKey) {
    log.info('No API key provided - using local fallback analysis');
    const markdown = generateLocalFallback(resources);
    return {
      success: true,
      source: 'local',
      markdown,
    };
  }

  // Try to call backend using the hardcoded BACKEND_URL
  log.info(`Attempting backend analysis at ${BACKEND_URL}`);

  // Prepare repository info if provided
  const repoInfo: RepositoryInfo | undefined = repoFullName
    ? { fullName: repoFullName }
    : undefined;

  const backendResponse = await callBackend(
    resources,
    apiKey,
    BACKEND_URL,
    repoInfo
  );

  // If backend succeeded, return its response
  if (backendResponse && (backendResponse.markdown || backendResponse.message)) {
    log.info('Backend analysis completed successfully');
    const markdown = backendResponse.markdown || backendResponse.message || '';
    return {
      success: true,
      source: 'backend',
      markdown,
    };
  }

  // Backend failed - use local fallback
  log.warning('Backend analysis failed - falling back to local summary');
  const markdown = generateLocalFallback(resources);
  return {
    success: true,
    source: 'local',
    markdown,
  };
}
