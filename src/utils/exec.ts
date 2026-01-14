import { exec } from 'child_process';
import { promisify } from 'util';
import * as log from './log';

const execPromise = promisify(exec);

/**
 * Result of a command execution
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Options for command execution
 */
export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
  timeout?: number;
}

/**
 * Execute a shell command and return the result
 * @param command - Command to execute
 * @param args - Command arguments (will be properly escaped)
 * @param options - Execution options
 * @returns Result with stdout, stderr, and exit code
 * @throws Error if command execution fails
 */
export async function executeCommand(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  // Escape arguments for shell
  const escapedArgs = args.map((arg) => {
    // If argument contains spaces or special characters, quote it
    if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
      // Escape double quotes and wrap in double quotes
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });

  const fullCommand = [command, ...escapedArgs].join(' ');

  log.debug(`Executing command: ${fullCommand}`);

  try {
    const { stdout, stderr } = await execPromise(fullCommand, {
      cwd: options.cwd,
      env: options.env || process.env,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB default
      timeout: options.timeout || 60000, // 60 seconds default
    });

    log.debug(`Command completed successfully`);

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error: unknown) {
    // exec throws an error on non-zero exit codes
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'stdout' in error &&
      'stderr' in error
    ) {
      const execError = error as {
        code: number;
        stdout: string;
        stderr: string;
      };

      log.debug(
        `Command failed with exit code ${execError.code}: ${execError.stderr}`
      );

      return {
        stdout: execError.stdout?.trim() || '',
        stderr: execError.stderr?.trim() || '',
        exitCode: execError.code || 1,
      };
    }

    // Unknown error format
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute command: ${errorMessage}`);
  }
}
