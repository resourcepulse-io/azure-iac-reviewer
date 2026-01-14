// Mock log module
jest.mock('../../../src/utils/log', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

// Mock child_process exec at module level
const mockExecPromise = jest.fn();
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecPromise),
}));

import { executeCommand } from '../../../src/utils/exec';

describe('executeCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully execute a command with no arguments', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'test output\n',
      stderr: '',
    });

    const result = await executeCommand('echo', []);

    expect(result).toEqual({
      stdout: 'test output',
      stderr: '',
      exitCode: 0,
    });
  });

  it('should successfully execute a command with arguments', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'hello world\n',
      stderr: '',
    });

    const result = await executeCommand('echo', ['hello', 'world']);

    expect(result).toEqual({
      stdout: 'hello world',
      stderr: '',
      exitCode: 0,
    });
  });

  it('should escape arguments with spaces', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('echo', ['hello world']);

    // Verify that the command includes properly quoted arguments
    expect(mockExecPromise).toHaveBeenCalledWith(
      'echo "hello world"',
      expect.any(Object)
    );
  });

  it('should escape arguments with quotes', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('echo', ['say "hello"']);

    // Verify that quotes are escaped
    expect(mockExecPromise).toHaveBeenCalledWith(
      'echo "say \\"hello\\""',
      expect.any(Object)
    );
  });

  it('should handle command execution failures', async () => {
    mockExecPromise.mockRejectedValue({
      code: 1,
      stdout: '',
      stderr: 'command not found\n',
    });

    const result = await executeCommand('invalid-command', []);

    expect(result).toEqual({
      stdout: '',
      stderr: 'command not found',
      exitCode: 1,
    });
  });

  it('should handle stderr output on success', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'output\n',
      stderr: 'warning message\n',
    });

    const result = await executeCommand('command', []);

    expect(result).toEqual({
      stdout: 'output',
      stderr: 'warning message',
      exitCode: 0,
    });
  });

  it('should respect custom working directory', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('ls', [], { cwd: '/custom/path' });

    expect(mockExecPromise).toHaveBeenCalledWith('ls', {
      cwd: '/custom/path',
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
  });

  it('should respect custom environment variables', async () => {
    const customEnv = { ...process.env, CUSTOM_VAR: 'custom-value' };

    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('command', [], { env: customEnv });

    expect(mockExecPromise).toHaveBeenCalledWith('command', {
      cwd: undefined,
      env: customEnv,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
  });

  it('should respect custom maxBuffer', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('command', [], { maxBuffer: 5 * 1024 * 1024 });

    expect(mockExecPromise).toHaveBeenCalledWith('command', {
      cwd: undefined,
      env: process.env,
      maxBuffer: 5 * 1024 * 1024,
      timeout: 60000,
    });
  });

  it('should use default maxBuffer if not specified', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('command', []);

    expect(mockExecPromise).toHaveBeenCalledWith('command', {
      cwd: undefined,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
  });

  it('should respect custom timeout', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('command', [], { timeout: 30000 });

    expect(mockExecPromise).toHaveBeenCalledWith('command', {
      cwd: undefined,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
  });

  it('should use default timeout if not specified', async () => {
    mockExecPromise.mockResolvedValue({
      stdout: 'success\n',
      stderr: '',
    });

    await executeCommand('command', []);

    expect(mockExecPromise).toHaveBeenCalledWith('command', {
      cwd: undefined,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
  });

  it('should throw error for unknown error types', async () => {
    mockExecPromise.mockRejectedValue('unknown error type');

    await expect(executeCommand('command', [])).rejects.toThrow(
      'Failed to execute command: unknown error type'
    );
  });
});
