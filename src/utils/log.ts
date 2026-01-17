import * as core from '@actions/core';

/**
 * Structured logging utilities for GitHub Actions
 */

/**
 * Check if debug mode is enabled via ACTIONS_STEP_DEBUG environment variable
 * @returns True if debug mode is enabled
 */
function isDebugEnabled(): boolean {
  return process.env.ACTIONS_STEP_DEBUG === 'true';
}

export function info(message: string): void {
  core.info(message);
}

export function warning(message: string): void {
  core.warning(message);
}

export function error(message: string): void {
  core.error(message);
}

export function debug(message: string): void {
  // Only log debug messages if debug mode is enabled
  // core.debug already respects this internally, but we can add additional checks if needed
  if (isDebugEnabled()) {
    core.debug(message);
  }
}

export function group<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return core.group(name, fn);
}
