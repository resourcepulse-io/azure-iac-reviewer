import { ResourceMetadata } from './armExtract';
/**
 * Sanitized resource data safe for transmission to backend
 * Only contains non-identifying metadata
 */
export interface SanitizedResource {
    type: string;
    kind: string;
    sku?: string;
    region?: string;
    apiVersion?: string;
    safeProperties?: Record<string, unknown>;
}
/**
 * Result of sanitizing resource metadata
 */
export interface SanitizationResult {
    resources: SanitizedResource[];
    resourceCount: number;
    removedFields: string[];
}
/**
 * Validation result for sensitive data detection
 */
export interface ValidationResult {
    valid: boolean;
    violations: string[];
}
/**
 * Sanitize resource metadata array by removing all identifying information
 * This is the main privacy layer ensuring no PII or resource identifiers reach the backend
 * @param resources - Array of resource metadata to sanitize
 * @returns Sanitization result with safe resources and removed field log
 */
export declare function sanitizeResources(resources: ResourceMetadata[]): SanitizationResult;
/**
 * Validate that sanitized data contains no sensitive information
 * This function is used in tests to ensure the privacy contract is never violated
 * @param data - Data to validate
 * @returns Validation result with violations list
 */
export declare function validateNoSensitiveData(data: unknown): ValidationResult;
//# sourceMappingURL=sanitize.d.ts.map