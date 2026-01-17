import { analyzeResources } from '../../../src/backend/client';
import { SanitizedResource } from '../../../src/iac/sanitize';
import * as log from '../../../src/utils/log';

// Mock the log module
jest.mock('../../../src/utils/log', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('analyzeResources', () => {
  const mockResources: SanitizedResource[] = [
    {
      type: 'Microsoft.Compute/virtualMachines',
      kind: 'vm',
      sku: 'Standard_D2s_v3',
      region: 'eastus',
      apiVersion: '2023-01-01',
    },
    {
      type: 'Microsoft.Storage/storageAccounts',
      kind: 'storage',
      region: 'westus',
      safeProperties: {
        replication: 'LRS',
      },
    },
    {
      type: 'Microsoft.Web/sites',
      kind: 'app_service',
      region: 'eastus',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Local Fallback Scenarios', () => {
    it('should use local fallback when no API key provided', async () => {
      const result = await analyzeResources(mockResources);

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
      expect(result.markdown).toContain('Azure Resource Analysis');
      expect(result.markdown).toContain('Detected **3** resource(s)');
      expect(result.markdown).toContain('Virtual Machines');
      expect(result.markdown).toContain('Storage Accounts');
      expect(result.markdown).toContain('App Services');
      expect(result.markdown).toContain('Want detailed cost estimates');
      expect(result.markdown).toContain('api_key');

      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled();

      // Should log the fallback
      expect(log.info).toHaveBeenCalledWith(
        'No API key provided - using local fallback analysis'
      );
    });


    it('should format resource counts correctly by kind', async () => {
      const resources: SanitizedResource[] = [
        { type: 'Microsoft.Compute/virtualMachines', kind: 'vm' },
        { type: 'Microsoft.Compute/virtualMachines', kind: 'vm' },
        { type: 'Microsoft.Storage/storageAccounts', kind: 'storage' },
        {
          type: 'Microsoft.Web/serverfarms',
          kind: 'app_service_plan',
        },
        {
          type: 'Microsoft.Web/serverfarms',
          kind: 'app_service_plan',
        },
        {
          type: 'Microsoft.Web/serverfarms',
          kind: 'app_service_plan',
        },
      ];

      const result = await analyzeResources(resources);

      expect(result.markdown).toContain('Detected **6** resource(s)');
      expect(result.markdown).toContain('App Service Plans**: 3');
      expect(result.markdown).toContain('Virtual Machines**: 2');
      expect(result.markdown).toContain('Storage Accounts**: 1');
    });

    it('should handle empty resource array', async () => {
      const result = await analyzeResources([]);

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
      expect(result.markdown).toContain('Detected **0** resource(s)');
    });

    it('should include privacy notice in local fallback', async () => {
      const result = await analyzeResources(mockResources);

      expect(result.markdown).toContain('anonymized resource metadata only');
      expect(result.markdown).toContain(
        'no source code or identifiers are transmitted'
      );
    });
  });

  describe('Backend Success Scenarios', () => {
    it('should successfully call backend with API key and URL', async () => {
      const mockMarkdown = '## Cost Analysis\n\nEstimated cost: $100/month';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('backend');
      expect(result.markdown).toBe(mockMarkdown);

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resourcepulse.io/analyze',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
            'User-Agent': 'azure-iac-reviewer/1.0.0',
          }),
          body: expect.any(String),
        })
      );

      // Verify request payload
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.resources).toEqual(mockResources);
      expect(requestBody.timestamp).toBeDefined();

      // Should log success
      expect(log.info).toHaveBeenCalledWith(
        'Backend analysis completed successfully'
      );
    });

    it('should handle backend response with message field instead of markdown', async () => {
      const mockMessage = 'Analysis complete: 3 resources analyzed';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: mockMessage }),
      });

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('backend');
      expect(result.markdown).toBe(mockMessage);
    });

    it('should include timestamp in backend request', async () => {
      const mockMarkdown = '## Analysis Result';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      await analyzeResources(
        mockResources,
        'test-api-key'
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.timestamp).toBeDefined();
      expect(new Date(requestBody.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include repository information in backend request', async () => {
      const mockMarkdown = '## Analysis Result';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      await analyzeResources(
        mockResources,
        'test-api-key',
        'myorg/myrepo'
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.repo).toBeDefined();
      expect(requestBody.repo.fullName).toBe('myorg/myrepo');

      // Should log the repo info
      expect(log.debug).toHaveBeenCalledWith('Repository: myorg/myrepo');
    });

    it('should not include repo field when repo fullName is not provided', async () => {
      const mockMarkdown = '## Analysis Result';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      await analyzeResources(
        mockResources,
        'test-api-key'
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.repo).toBeUndefined();

      // Should not log repo info
      expect(log.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Repository:')
      );
    });

    it('should handle empty string repo fullName as undefined', async () => {
      const mockMarkdown = '## Analysis Result';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      await analyzeResources(
        mockResources,
        'test-api-key',
        ''
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.repo).toBeUndefined();
    });
  });

  describe('Backend Error Handling', () => {
    it('should fall back to local when backend returns 500 error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Database connection failed' }),
      });

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
      expect(result.markdown).toContain('Azure Resource Analysis');

      // Should log warning
      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Backend returned status 500')
      );
      expect(log.warning).toHaveBeenCalledWith(
        'Backend analysis failed - falling back to local summary'
      );
    });

    it('should fall back to local when backend returns 401 unauthorized', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      });

      const result = await analyzeResources(
        mockResources,
        'invalid-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');

      // Should log warning
      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Backend returned status 401')
      );
    });

    it('should fall back to local when backend returns 404 not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Endpoint not found' }),
      });

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
    });

    it('should fall back to local when backend returns invalid JSON', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
    });

    it('should fall back to local when backend response is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
      expect(result.markdown).toContain('Azure Resource Analysis');
    });
  });

  describe('Network Error Handling', () => {
    it('should fall back to local on network timeout', async () => {
      // Mock a timeout error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted'), {
          name: 'AbortError',
        })
      );

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');

      // Should log timeout warning
      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Backend request timed out after')
      );
      expect(log.warning).toHaveBeenCalledWith(
        'Backend analysis failed - falling back to local summary'
      );
    });

    it('should fall back to local on DNS resolution failure', async () => {
      // Mock a DNS error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('getaddrinfo ENOTFOUND api.example.com')
      );

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');

      // Should log network error
      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Network error calling backend')
      );
    });

    it('should fall back to local on connection refused', async () => {
      // Mock a connection refused error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:443')
      );

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');

      // Should log network error
      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Network error calling backend')
      );
    });

    it('should fall back to local on fetch failed error', async () => {
      // Mock a generic fetch failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('fetch failed')
      );

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
    });

    it('should handle unknown error types gracefully', async () => {
      // Mock an unknown error type
      (global.fetch as jest.Mock).mockRejectedValueOnce('Unknown error');

      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');

      // Should log generic warning
      expect(log.warning).toHaveBeenCalledWith('Unknown error calling backend');
    });
  });

  describe('Privacy Contract Enforcement', () => {
    it('should validate resources before sending to backend', async () => {
      const mockMarkdown = '## Analysis Result';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      // Clean resources should succeed
      const result = await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('backend');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should refuse to send resources with sensitive data', async () => {
      // Create resources with forbidden fields (should fail validation)
      const sensitiveResources: SanitizedResource[] = [
        {
          type: 'Microsoft.Compute/virtualMachines',
          kind: 'vm',
          // @ts-expect-error - Testing privacy violation
          name: 'my-production-vm',
        },
      ];

      await expect(
        analyzeResources(
          sensitiveResources,
          'test-api-key'
        )
      ).rejects.toThrow('Privacy contract violation');

      // Should log error
      expect(log.error).toHaveBeenCalledWith(
        'Privacy contract violation detected - refusing to send data'
      );

      // Should NOT call fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should refuse to send resources with GUID patterns', async () => {
      // Create resources with GUID patterns (should fail validation)
      const sensitiveResources: SanitizedResource[] = [
        {
          type: 'Microsoft.Compute/virtualMachines',
          kind: 'vm',
          safeProperties: {
            // This would be caught by validation
            resourceGuid: '12345678-1234-1234-1234-123456789012',
          },
        },
      ];

      await expect(
        analyzeResources(
          sensitiveResources,
          'test-api-key'
        )
      ).rejects.toThrow('Privacy contract violation');

      // Should NOT call fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should never expose sensitive data in local fallback', async () => {
      // Even if somehow sensitive data got through, local fallback should be safe
      const result = await analyzeResources(mockResources);

      // Local fallback should never contain resource identifiers or PII
      expect(result.markdown).not.toContain('12345678-1234-1234-1234');
      expect(result.markdown).not.toMatch(/\/subscriptions\//i);
      expect(result.markdown).not.toMatch(/\/resourceGroups\//i);
      expect(result.markdown).not.toContain('my-production-');
      expect(result.markdown).not.toContain('adminPassword');
      expect(result.markdown).not.toContain('connectionString');
      // Should not contain actual resource names or IDs
      expect(result.markdown).not.toMatch(/resourceId.*=/);
    });

    it('should allow repository fullName in backend payload (public metadata)', async () => {
      const mockMarkdown = '## Analysis Result';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: mockMarkdown }),
      });

      // Repository fullName is public metadata and should be allowed
      await expect(
        analyzeResources(
          mockResources,
          'test-api-key',
          'myorg/myrepo'
        )
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      // Repository info should be included (it's safe public metadata)
      expect(requestBody.repo).toBeDefined();
      expect(requestBody.repo.fullName).toBe('myorg/myrepo');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single resource', async () => {
      const singleResource: SanitizedResource[] = [
        {
          type: 'Microsoft.Storage/storageAccounts',
          kind: 'storage',
        },
      ];

      const result = await analyzeResources(singleResource);

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('Detected **1** resource(s)');
      expect(result.markdown).toContain('Storage Accounts**: 1');
    });

    it('should handle resources with unknown kinds', async () => {
      const resources: SanitizedResource[] = [
        {
          type: 'Microsoft.CustomProvider/customResources',
          kind: 'other',
        },
        {
          type: 'Microsoft.CustomProvider/anotherResource',
          kind: 'unknown_kind',
        },
      ];

      const result = await analyzeResources(resources);

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('Other Resources');
      expect(result.markdown).toContain('UNKNOWN_KIND');
    });

    it('should handle resources without optional fields', async () => {
      const minimalResources: SanitizedResource[] = [
        {
          type: 'Microsoft.Compute/virtualMachines',
          kind: 'vm',
        },
        {
          type: 'Microsoft.Storage/storageAccounts',
          kind: 'storage',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: '## Analysis' }),
      });

      const result = await analyzeResources(
        minimalResources,
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalled();

      // Verify minimal resources can be serialized
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.resources).toEqual(minimalResources);
    });

    it('should handle empty string API key as no API key', async () => {
      const result = await analyzeResources(mockResources, '');

      expect(result.success).toBe(true);
      expect(result.source).toBe('local');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Logging and Observability', () => {
    it('should log debug messages during backend call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: '## Analysis' }),
      });

      await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(log.debug).toHaveBeenCalledWith('Starting resource analysis');
      expect(log.debug).toHaveBeenCalledWith(
        'Calling backend API: https://api.resourcepulse.io'
      );
      expect(log.debug).toHaveBeenCalledWith(
        'Sending 3 sanitized resource(s)'
      );
      expect(log.debug).toHaveBeenCalledWith(
        'Backend response received successfully'
      );
    });

    it('should log info message when using local fallback by choice', async () => {
      await analyzeResources(mockResources);

      expect(log.info).toHaveBeenCalledWith(
        'No API key provided - using local fallback analysis'
      );
    });

    it('should log warning when backend fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network failure')
      );

      await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Error calling backend')
      );
      expect(log.warning).toHaveBeenCalledWith(
        'Backend analysis failed - falling back to local summary'
      );
    });

    it('should log attempt to call backend', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: '## Analysis' }),
      });

      await analyzeResources(
        mockResources,
        'test-api-key'
      );

      expect(log.info).toHaveBeenCalledWith(
        'Attempting backend analysis at https://api.resourcepulse.io'
      );
    });
  });
});
