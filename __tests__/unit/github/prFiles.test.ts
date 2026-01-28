import { Octokit } from '@octokit/rest';
import {
  listChangedFiles,
  filterFilesByExtension,
  listBicepFiles,
  ChangedFile,
} from '../../../src/github/prFiles';
import { PRContext } from '../../../src/github/context';

// Mock the log module
jest.mock('../../../src/utils/log', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  group: jest.fn(),
}));

describe('PR Files', () => {
  const mockContext: PRContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    prNumber: 42,
    eventName: 'pull_request',
    sha: 'abc123',
    ref: 'feature-branch',
    fullName: 'test-owner/test-repo',
    prTitle: 'Test PR',
    prAuthor: 'test-user',
    baseBranch: 'main',
  };

  const mockChangedFiles = [
    {
      filename: 'infrastructure/main.bicep',
      status: 'modified',
      additions: 10,
      deletions: 5,
      changes: 15,
      sha: 'file1sha',
      blob_url: 'https://github.com/test/blob/file1',
      raw_url: 'https://github.com/test/raw/file1',
      contents_url: 'https://api.github.com/repos/test/contents/file1',
      patch: 'diff patch',
    },
    {
      filename: 'infrastructure/storage.bicep',
      status: 'added',
      additions: 20,
      deletions: 0,
      changes: 20,
      sha: 'file2sha',
      blob_url: 'https://github.com/test/blob/file2',
      raw_url: 'https://github.com/test/raw/file2',
      contents_url: 'https://api.github.com/repos/test/contents/file2',
      patch: 'diff patch',
    },
    {
      filename: 'README.md',
      status: 'modified',
      additions: 3,
      deletions: 1,
      changes: 4,
      sha: 'file3sha',
      blob_url: 'https://github.com/test/blob/file3',
      raw_url: 'https://github.com/test/raw/file3',
      contents_url: 'https://api.github.com/repos/test/contents/file3',
      patch: 'diff patch',
    },
    {
      filename: 'src/app.ts',
      status: 'modified',
      additions: 15,
      deletions: 8,
      changes: 23,
      sha: 'file4sha',
      blob_url: 'https://github.com/test/blob/file4',
      raw_url: 'https://github.com/test/raw/file4',
      contents_url: 'https://api.github.com/repos/test/contents/file4',
      patch: 'diff patch',
    },
  ];

  describe('listChangedFiles', () => {
    it('should successfully list all changed files in a PR', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: mockChangedFiles,
            }),
          },
        },
      } as unknown as Octokit;

      const files = await listChangedFiles(mockOctokit, mockContext);

      expect(files).toHaveLength(4);
      expect(files[0]).toEqual({
        filename: 'infrastructure/main.bicep',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15,
      });
      expect(files[1]).toEqual({
        filename: 'infrastructure/storage.bicep',
        status: 'added',
        additions: 20,
        deletions: 0,
        changes: 20,
      });

      expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 42,
        per_page: 100,
      });
    });

    it('should return empty array when no files changed', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: [],
            }),
          },
        },
      } as unknown as Octokit;

      const files = await listChangedFiles(mockOctokit, mockContext);

      expect(files).toHaveLength(0);
    });

    it('should throw error when API call fails', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      } as unknown as Octokit;

      await expect(listChangedFiles(mockOctokit, mockContext)).rejects.toThrow(
        'Failed to list changed files for PR #42: API Error'
      );
    });

    it('should handle non-Error thrown values', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockRejectedValue('String error'),
          },
        },
      } as unknown as Octokit;

      await expect(listChangedFiles(mockOctokit, mockContext)).rejects.toThrow(
        'Failed to list changed files for PR #42: String error'
      );
    });
  });

  describe('filterFilesByExtension', () => {
    const testFiles: ChangedFile[] = [
      {
        filename: 'infrastructure/main.bicep',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15,
      },
      {
        filename: 'infrastructure/storage.BICEP',
        status: 'added',
        additions: 20,
        deletions: 0,
        changes: 20,
      },
      {
        filename: 'README.md',
        status: 'modified',
        additions: 3,
        deletions: 1,
        changes: 4,
      },
      {
        filename: 'src/app.ts',
        status: 'modified',
        additions: 15,
        deletions: 8,
        changes: 23,
      },
      {
        filename: 'config.json',
        status: 'added',
        additions: 50,
        deletions: 0,
        changes: 50,
      },
    ];

    it('should filter .bicep files with leading dot', () => {
      const filtered = filterFilesByExtension(testFiles, '.bicep');

      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('infrastructure/main.bicep');
      expect(filtered).toContain('infrastructure/storage.BICEP');
    });

    it('should filter .bicep files without leading dot', () => {
      const filtered = filterFilesByExtension(testFiles, 'bicep');

      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('infrastructure/main.bicep');
      expect(filtered).toContain('infrastructure/storage.BICEP');
    });

    it('should filter .md files', () => {
      const filtered = filterFilesByExtension(testFiles, '.md');

      expect(filtered).toHaveLength(1);
      expect(filtered).toContain('README.md');
    });

    it('should filter .ts files', () => {
      const filtered = filterFilesByExtension(testFiles, '.ts');

      expect(filtered).toHaveLength(1);
      expect(filtered).toContain('src/app.ts');
    });

    it('should filter .json files', () => {
      const filtered = filterFilesByExtension(testFiles, '.json');

      expect(filtered).toHaveLength(1);
      expect(filtered).toContain('config.json');
    });

    it('should return empty array when no files match extension', () => {
      const filtered = filterFilesByExtension(testFiles, '.py');

      expect(filtered).toHaveLength(0);
    });

    it('should return empty array when input is empty', () => {
      const filtered = filterFilesByExtension([], '.bicep');

      expect(filtered).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const filtered = filterFilesByExtension(testFiles, '.BICEP');

      expect(filtered).toHaveLength(2);
    });
  });

  describe('listBicepFiles', () => {
    it('should return list of .bicep files when present', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: mockChangedFiles,
            }),
          },
        },
      } as unknown as Octokit;

      const bicepFiles = await listBicepFiles(mockOctokit, mockContext);

      expect(bicepFiles).toHaveLength(2);
      expect(bicepFiles).toContain('infrastructure/main.bicep');
      expect(bicepFiles).toContain('infrastructure/storage.bicep');
    });

    it('should return empty array when no .bicep files are present', async () => {
      const nonBicepFiles = [
        {
          filename: 'README.md',
          status: 'modified',
          additions: 3,
          deletions: 1,
          changes: 4,
          sha: 'file1sha',
          blob_url: 'https://github.com/test/blob/file1',
          raw_url: 'https://github.com/test/raw/file1',
          contents_url: 'https://api.github.com/repos/test/contents/file1',
          patch: 'diff patch',
        },
      ];

      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: nonBicepFiles,
            }),
          },
        },
      } as unknown as Octokit;

      const bicepFiles = await listBicepFiles(mockOctokit, mockContext);

      expect(bicepFiles).toHaveLength(0);
    });

    it('should return empty array when no files changed in PR', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: [],
            }),
          },
        },
      } as unknown as Octokit;

      const bicepFiles = await listBicepFiles(mockOctokit, mockContext);

      expect(bicepFiles).toHaveLength(0);
    });

    it('should propagate errors from listChangedFiles', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockRejectedValue(new Error('Network error')),
          },
        },
      } as unknown as Octokit;

      await expect(listBicepFiles(mockOctokit, mockContext)).rejects.toThrow(
        'Failed to list changed files for PR #42: Network error'
      );
    });

    it('should handle .bicep files in nested directories', async () => {
      const nestedBicepFiles = [
        {
          filename: 'infra/azure/networking/vnet.bicep',
          status: 'added',
          additions: 50,
          deletions: 0,
          changes: 50,
          sha: 'file1sha',
          blob_url: 'https://github.com/test/blob/file1',
          raw_url: 'https://github.com/test/raw/file1',
          contents_url: 'https://api.github.com/repos/test/contents/file1',
          patch: 'diff patch',
        },
        {
          filename: 'infra/azure/compute/vm.bicep',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          sha: 'file2sha',
          blob_url: 'https://github.com/test/blob/file2',
          raw_url: 'https://github.com/test/raw/file2',
          contents_url: 'https://api.github.com/repos/test/contents/file2',
          patch: 'diff patch',
        },
      ];

      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: nestedBicepFiles,
            }),
          },
        },
      } as unknown as Octokit;

      const bicepFiles = await listBicepFiles(mockOctokit, mockContext);

      expect(bicepFiles).toHaveLength(2);
      expect(bicepFiles).toContain('infra/azure/networking/vnet.bicep');
      expect(bicepFiles).toContain('infra/azure/compute/vm.bicep');
    });

    it('should handle mixed case .BICEP extensions', async () => {
      const mixedCaseFiles = [
        {
          filename: 'main.BICEP',
          status: 'added',
          additions: 30,
          deletions: 0,
          changes: 30,
          sha: 'file1sha',
          blob_url: 'https://github.com/test/blob/file1',
          raw_url: 'https://github.com/test/raw/file1',
          contents_url: 'https://api.github.com/repos/test/contents/file1',
          patch: 'diff patch',
        },
        {
          filename: 'storage.Bicep',
          status: 'modified',
          additions: 5,
          deletions: 2,
          changes: 7,
          sha: 'file2sha',
          blob_url: 'https://github.com/test/blob/file2',
          raw_url: 'https://github.com/test/raw/file2',
          contents_url: 'https://api.github.com/repos/test/contents/file2',
          patch: 'diff patch',
        },
      ];

      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: jest.fn().mockResolvedValue({
              data: mixedCaseFiles,
            }),
          },
        },
      } as unknown as Octokit;

      const bicepFiles = await listBicepFiles(mockOctokit, mockContext);

      expect(bicepFiles).toHaveLength(2);
      expect(bicepFiles).toContain('main.BICEP');
      expect(bicepFiles).toContain('storage.Bicep');
    });
  });
});
