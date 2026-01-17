import { AnalysisResult } from '../backend/client';
/**
 * Comment marker for identifying comments created by this action
 */
export declare const COMMENT_MARKER = "<!-- azure-iac-reviewer -->";
/**
 * Format analysis result as PR comment markdown
 * Adds comment marker and footer to the analysis markdown
 * @param result - Analysis result from backend or local fallback
 * @returns Complete PR comment body with marker and footer
 */
export declare function formatPRComment(result: AnalysisResult): string;
/**
 * Check if a comment body was created by this action
 * @param commentBody - Comment body to check
 * @returns True if the comment contains the marker
 */
export declare function hasMarker(commentBody: string): boolean;
/**
 * Extract the content from a marked comment (removes marker and footer)
 * Useful for testing or comment analysis
 * @param markedComment - Comment with marker and footer
 * @returns Just the analysis content
 */
export declare function extractContent(markedComment: string): string;
//# sourceMappingURL=markdown.d.ts.map