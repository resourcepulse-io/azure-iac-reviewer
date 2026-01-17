import * as fs from 'fs';
import { parsePRContext, createOctokit, initializeGitHub } from '../../../src/github/context';

// Mock the modules
jest.mock('fs');
jest.mock('@actions/core');
jest.mock('../../../src/utils/log', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  group: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('GitHub Context', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('parsePRContext', () => {
    const mockEventPayload = {
      pull_request: {
        number: 42,
        head: {
          sha: 'abc123',
          ref: 'feature-branch',
        },
      },
      repository: {
        owner: {
          login: 'test-owner',
        },
        name: 'test-repo',
      },
    };

    it('should successfully parse PR context from event payload', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockEventPayload));

      const context = parsePRContext();

      expect(context).toEqual({
        owner: 'test-owner',
        repo: 'test-repo',
        prNumber: 42,
        eventName: 'pull_request',
        sha: 'abc123',
        ref: 'feature-branch',
        fullName: 'test-owner/test-repo',
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/event.json', 'utf8');
    });

    it('should throw error if GITHUB_EVENT_PATH is not set', () => {
      delete process.env.GITHUB_EVENT_PATH;
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      expect(() => parsePRContext()).toThrow(
        'GITHUB_EVENT_PATH environment variable is not set'
      );
    });

    it('should throw error if GITHUB_EVENT_NAME is not set', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      delete process.env.GITHUB_EVENT_NAME;

      expect(() => parsePRContext()).toThrow(
        'GITHUB_EVENT_NAME environment variable is not set'
      );
    });

    it('should throw error if event is not pull_request', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'push';

      expect(() => parsePRContext()).toThrow(
        'This action only works on pull_request events. Current event: push'
      );
    });

    it('should throw error if event payload is invalid JSON', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => parsePRContext()).toThrow('Failed to read or parse event payload');
    });

    it('should throw error if event payload is missing pull_request data', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      mockFs.readFileSync.mockReturnValue(JSON.stringify({ repository: mockEventPayload.repository }));

      expect(() => parsePRContext()).toThrow(
        'Event payload does not contain pull_request data'
      );
    });

    it('should throw error if event payload is missing repository data', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      mockFs.readFileSync.mockReturnValue(JSON.stringify({ pull_request: mockEventPayload.pull_request }));

      expect(() => parsePRContext()).toThrow(
        'Event payload does not contain repository data'
      );
    });

    it('should throw error if required fields are missing', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      const incompletePayload = {
        pull_request: {
          number: 42,
          head: { sha: 'abc123', ref: 'feature-branch' },
        },
        repository: {
          owner: { login: '' }, // Empty owner
          name: 'test-repo',
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(incompletePayload));

      expect(() => parsePRContext()).toThrow(
        'Event payload is missing required fields'
      );
    });
  });

  describe('createOctokit', () => {
    it('should create Octokit instance with token', () => {
      process.env.GITHUB_TOKEN = 'test-token';

      const octokit = createOctokit();

      expect(octokit).toBeDefined();
      expect(octokit.rest).toBeDefined();
    });

    it('should throw error if GITHUB_TOKEN is not set', () => {
      delete process.env.GITHUB_TOKEN;

      expect(() => createOctokit()).toThrow(
        'GITHUB_TOKEN environment variable is not set'
      );
    });
  });

  describe('initializeGitHub', () => {
    const mockEventPayload = {
      pull_request: {
        number: 42,
        head: {
          sha: 'abc123',
          ref: 'feature-branch',
        },
      },
      repository: {
        owner: {
          login: 'test-owner',
        },
        name: 'test-repo',
      },
    };

    it('should initialize GitHub context and Octokit', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_TOKEN = 'test-token';

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockEventPayload));

      const [context, octokit] = initializeGitHub();

      expect(context).toEqual({
        owner: 'test-owner',
        repo: 'test-repo',
        prNumber: 42,
        eventName: 'pull_request',
        sha: 'abc123',
        ref: 'feature-branch',
        fullName: 'test-owner/test-repo',
      });

      expect(octokit).toBeDefined();
    });

    it('should propagate errors from parsePRContext', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'push';

      expect(() => initializeGitHub()).toThrow(
        'This action only works on pull_request events'
      );
    });

    it('should propagate errors from createOctokit', () => {
      process.env.GITHUB_EVENT_PATH = '/path/to/event.json';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      delete process.env.GITHUB_TOKEN;

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockEventPayload));

      expect(() => initializeGitHub()).toThrow(
        'GITHUB_TOKEN environment variable is not set'
      );
    });
  });
});
