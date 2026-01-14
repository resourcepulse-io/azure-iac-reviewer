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
export declare function executeCommand(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>;
//# sourceMappingURL=exec.d.ts.map