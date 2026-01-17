import { SanitizedResource } from '../iac/sanitize';
/**
 * Result of the analysis operation
 */
export interface AnalysisResult {
    success: boolean;
    source: 'backend' | 'local';
    markdown: string;
}
/**
 * Analyze resources using backend service or local fallback
 * This is the main entry point for backend integration
 * @param resources - Sanitized resources to analyze
 * @param apiKey - Optional backend authentication token
 * @param repoFullName - Optional repository full name (owner/repo format)
 * @returns Analysis result with markdown message
 */
export declare function analyzeResources(resources: SanitizedResource[], apiKey?: string, repoFullName?: string): Promise<AnalysisResult>;
//# sourceMappingURL=client.d.ts.map