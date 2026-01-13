import * as core from '@actions/core';

/**
 * Structured logging utilities for GitHub Actions
 */

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
  core.debug(message);
}

export function group<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return core.group(name, fn);
}
