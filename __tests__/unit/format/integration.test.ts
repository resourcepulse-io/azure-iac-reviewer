/**
 * Integration test demonstrating how to use markdown formatter with backend client
 * This shows the complete flow from analysis to formatted PR comment
 */

import { analyzeResources } from '../../../src/backend/client';
import { formatPRComment, COMMENT_MARKER } from '../../../src/format/markdown';
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

describe('Integration: Backend Client + Markdown Formatter', () => {
  const mockResources: SanitizedResource[] = [
    {
      type: 'Microsoft.Compute/virtualMachines',
      kind: 'vm',
      sku: 'Standard_D2s_v3',
      region: 'eastus',
    },
    {
      type: 'Microsoft.Storage/storageAccounts',
      kind: 'storage',
      region: 'westus',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Complete Flow: Local Fallback', () => {
    it('should generate complete PR comment from local analysis', async () => {
      // Step 1: Analyze resources (local fallback - no API key)
      const analysisResult = await analyzeResources(mockResources);

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.source).toBe('local');
      expect(analysisResult.markdown).toBeTruthy();

      // Step 2: Format as PR comment
      const prComment = formatPRComment(analysisResult);

      // Step 3: Verify complete comment structure
      expect(prComment).toContain(COMMENT_MARKER);
      expect(prComment).toContain('Azure Resource Analysis');
      expect(prComment).toContain('Detected **2** resource(s)');
      expect(prComment).toContain('Virtual Machines');
      expect(prComment).toContain('Storage Accounts');
      expect(prComment).toContain('ResourcePulse');
      expect(prComment).toContain('v1.0.0');
      expect(prComment).toContain('---');

      // Verify structure order
      const lines = prComment.split('\n');
      expect(lines[0]).toBe(COMMENT_MARKER);
      expect(prComment.endsWith('</sub>')).toBe(true);

      // Verify no fetch was called (local mode)
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include upgrade prompt in local fallback comment', async () => {
      const analysisResult = await analyzeResources(mockResources);
      const prComment = formatPRComment(analysisResult);

      // Local fallback should encourage users to add API key
      expect(prComment).toContain('Want detailed cost estimates');
      expect(prComment).toContain('api_key');
      expect(prComment).toContain('RESOURCEPULSE_API_KEY');
    });
  });

  describe('Complete Flow: Backend Success', () => {
    it('should generate complete PR comment from backend analysis', async () => {
      const backendMarkdown = `## Cost Analysis

### Estimated Monthly Cost: $85

**Resource Breakdown:**
- Virtual Machine (Standard_D2s_v3): $70
- Storage Account (LRS): $15

### Recommendations
- Consider reserved instances for VM to save 40%
- Enable lifecycle management for storage cost optimization`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: backendMarkdown }),
      });

      // Step 1: Analyze resources with backend
      const analysisResult = await analyzeResources(
        mockResources,
        'test-api-key',
        'https://api.example.com'
      );

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.source).toBe('backend');

      // Step 2: Format as PR comment
      const prComment = formatPRComment(analysisResult);

      // Step 3: Verify complete comment structure
      expect(prComment).toContain(COMMENT_MARKER);
      expect(prComment).toContain('Cost Analysis');
      expect(prComment).toContain('Estimated Monthly Cost: $85');
      expect(prComment).toContain('Virtual Machine');
      expect(prComment).toContain('Recommendations');
      expect(prComment).toContain('ResourcePulse');
      expect(prComment).toContain('---');

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should preserve complex markdown from backend', async () => {
      const complexMarkdown = `## Security & Cost Analysis

### 🔒 Security Findings
- **Critical**: Enable encryption at rest for storage
- **Warning**: VM lacks managed identity

### 💰 Cost Optimization
Estimated cost: **$85/month**

Current configuration:
\`\`\`yaml
vm:
  sku: Standard_D2s_v3
  cost: $70/mo
storage:
  type: LRS
  cost: $15/mo
\`\`\`

### Recommendations
1. Add managed identity to VM
2. Enable storage encryption
3. Consider B-series for dev workloads`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ markdown: complexMarkdown }),
      });

      const analysisResult = await analyzeResources(
        mockResources,
        'test-api-key',
        'https://api.example.com'
      );
      const prComment = formatPRComment(analysisResult);

      // Verify all markdown elements are preserved
      expect(prComment).toContain('🔒');
      expect(prComment).toContain('💰');
      expect(prComment).toContain('**Critical**');
      expect(prComment).toContain('```yaml');
      expect(prComment).toContain('### Recommendations');
      expect(prComment).toContain('1. Add managed identity');
    });
  });

  describe('Complete Flow: Backend Failure with Fallback', () => {
    it('should fall back to local and format correctly on backend error', async () => {
      // Mock backend failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network timeout')
      );

      // Step 1: Analyze resources (will fall back to local)
      const analysisResult = await analyzeResources(
        mockResources,
        'test-api-key',
        'https://api.example.com'
      );

      // Should fall back to local
      expect(analysisResult.success).toBe(true);
      expect(analysisResult.source).toBe('local');

      // Step 2: Format as PR comment
      const prComment = formatPRComment(analysisResult);

      // Step 3: Verify fallback comment structure
      expect(prComment).toContain(COMMENT_MARKER);
      expect(prComment).toContain('Azure Resource Analysis');
      expect(prComment).toContain('Want detailed cost estimates');
      expect(prComment).toContain('ResourcePulse');

      // Verify warning was logged
      expect(log.warning).toHaveBeenCalledWith(
        expect.stringContaining('Error calling backend')
      );
      expect(log.warning).toHaveBeenCalledWith(
        'Backend analysis failed - falling back to local summary'
      );
    });
  });

  describe('Usage Examples', () => {
    it('should work with empty resource list', async () => {
      const analysisResult = await analyzeResources([]);
      const prComment = formatPRComment(analysisResult);

      expect(prComment).toContain(COMMENT_MARKER);
      expect(prComment).toContain('Detected **0** resource(s)');
      expect(prComment).toContain('---');
    });

    it('should handle multiple resource kinds', async () => {
      const resources: SanitizedResource[] = [
        { type: 'Microsoft.Compute/virtualMachines', kind: 'vm' },
        { type: 'Microsoft.Compute/virtualMachines', kind: 'vm' },
        { type: 'Microsoft.Compute/virtualMachines', kind: 'vm' },
        { type: 'Microsoft.Storage/storageAccounts', kind: 'storage' },
        { type: 'Microsoft.Storage/storageAccounts', kind: 'storage' },
        { type: 'Microsoft.Web/serverfarms', kind: 'app_service_plan' },
        { type: 'Microsoft.Sql/servers/databases', kind: 'sql_db' },
      ];

      const analysisResult = await analyzeResources(resources);
      const prComment = formatPRComment(analysisResult);

      expect(prComment).toContain('Detected **7** resource(s)');
      expect(prComment).toContain('Virtual Machines**: 3');
      expect(prComment).toContain('Storage Accounts**: 2');
      expect(prComment).toContain('App Service Plans**: 1');
      expect(prComment).toContain('SQL Databases**: 1');
    });

    it('should demonstrate the complete API surface', async () => {
      // This test serves as documentation for how to use the modules together

      // 1. Get sanitized resources (from previous steps in pipeline)
      const resources: SanitizedResource[] = [
        {
          type: 'Microsoft.Compute/virtualMachines',
          kind: 'vm',
          sku: 'Standard_B2s',
          region: 'eastus',
        },
      ];

      // 2. Analyze with backend (or local fallback)
      const apiKey = 'optional-api-key';
      const backendUrl = 'https://api.example.com';
      const analysisResult = await analyzeResources(
        resources,
        apiKey,
        backendUrl
      );

      // 3. Format for PR comment
      const prCommentBody = formatPRComment(analysisResult);

      // 4. Post to PR (would be done via comments.ts in real usage)
      // await createOrUpdateComment(octokit, prContext, prCommentBody, 'update');

      // Verify the result is ready for posting
      expect(prCommentBody).toContain(COMMENT_MARKER);
      expect(typeof prCommentBody).toBe('string');
      expect(prCommentBody.length).toBeGreaterThan(0);

      // The comment body is now ready to be passed to createOrUpdateComment
      // which will post it to the PR
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle large resource list', async () => {
      // Simulate a large infrastructure deployment
      const largeResourceList: SanitizedResource[] = Array.from(
        { length: 50 },
        (_, i) => ({
          type: 'Microsoft.Compute/virtualMachines',
          kind: 'vm',
          sku: `Standard_D${i % 4}s_v3`,
          region: ['eastus', 'westus', 'centralus'][i % 3],
        })
      );

      const analysisResult = await analyzeResources(largeResourceList);
      const prComment = formatPRComment(analysisResult);

      expect(prComment).toContain('Detected **50** resource(s)');
      expect(prComment).toContain('Virtual Machines**: 50');
      expect(prComment.length).toBeGreaterThan(100);
    });

    it('should handle mixed success and backend response formats', async () => {
      // Some backends might use 'message' instead of 'markdown'
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Analysis complete: All resources look good!',
        }),
      });

      const analysisResult = await analyzeResources(
        mockResources,
        'test-api-key',
        'https://api.example.com'
      );
      const prComment = formatPRComment(analysisResult);

      expect(prComment).toContain('Analysis complete');
      expect(prComment).toContain('All resources look good!');
      expect(prComment).toContain(COMMENT_MARKER);
    });
  });
});
