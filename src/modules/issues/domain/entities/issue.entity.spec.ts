import { Issue, IssueStatus, IssueWorkflowStep } from '@modules/issues/domain/entities/issue.entity';

describe('Issue Entity', () => {
  describe('IssueStatus enum', () => {
    it('should have correct status values', () => {
      expect(IssueStatus.OPEN).toBe('open');
      expect(IssueStatus.IN_PROGRESS).toBe('in_progress');
      expect(IssueStatus.COMPLETED).toBe('completed');
      expect(IssueStatus.ABANDONED).toBe('abandoned');
    });
  });

  describe('IssueWorkflowStep enum', () => {
    it('should have all 9 workflow steps', () => {
      // String enum only has string keys (no numeric reverse mapping)
      expect(Object.keys(IssueWorkflowStep)).toHaveLength(9);
      
      expect(IssueWorkflowStep.READ).toBe('1_READ');
      expect(IssueWorkflowStep.ANALYZE).toBe('2_ANALYZE');
      expect(IssueWorkflowStep.PLAN).toBe('3_PLAN');
      expect(IssueWorkflowStep.CODE).toBe('4_CODE_SOLUTION');
      expect(IssueWorkflowStep.TEST).toBe('5_TEST_VERIFY');
      expect(IssueWorkflowStep.COMMIT).toBe('6_COMMIT_CHANGES');
      expect(IssueWorkflowStep.PUSH).toBe('7_PUSH_TO_BRANCH');
      expect(IssueWorkflowStep.CREATE_PR_MD).toBe('8_CREATE_PR_MD');
      expect(IssueWorkflowStep.CREATE_PR).toBe('9_CREATE_PR');
    });

    it('should have steps in correct order', () => {
      const steps = [
        IssueWorkflowStep.READ,
        IssueWorkflowStep.ANALYZE,
        IssueWorkflowStep.PLAN,
        IssueWorkflowStep.CODE,
        IssueWorkflowStep.TEST,
        IssueWorkflowStep.COMMIT,
        IssueWorkflowStep.PUSH,
        IssueWorkflowStep.CREATE_PR_MD,
        IssueWorkflowStep.CREATE_PR,
      ];

      // Verify each step contains its position number
      steps.forEach((step, index) => {
        expect(step).toContain(`${index + 1}_`);
      });
    });
  });

  describe('Issue entity structure', () => {
    it('should have all required properties', () => {
      const issue = new Issue();
      
      // Check that entity can be instantiated
      expect(issue).toBeDefined();
      
      // Check property types (will be undefined until set)
      expect(issue.id).toBeUndefined();
      expect(issue.issueId).toBeUndefined();
      expect(issue.title).toBeUndefined();
      expect(issue.status).toBeUndefined();
      expect(issue.currentWorkflowStep).toBeUndefined();
      expect(issue.createdAt).toBeUndefined();
      expect(issue.updatedAt).toBeUndefined();
    });

    it('should have optional properties', () => {
      const issue = new Issue();
      
      // Optional properties
      expect(issue.description).toBeUndefined();
      expect(issue.requirements).toBeUndefined();
      expect(issue.userId).toBeUndefined();
      expect(issue.repositoryUrl).toBeUndefined();
      expect(issue.branchName).toBeUndefined();
      expect(issue.prUrl).toBeUndefined();
      expect(issue.prMdPath).toBeUndefined();
      expect(issue.completedSteps).toBeUndefined();
      expect(issue.nextSteps).toBeUndefined();
      expect(issue.keyDecisions).toBeUndefined();
      expect(issue.filesModified).toBeUndefined();
      expect(issue.metadata).toBeUndefined();
      expect(issue.lastSessionId).toBeUndefined();
      expect(issue.lastActivityAt).toBeUndefined();
      expect(issue.completedAt).toBeUndefined();
    });
  });

  describe('Issue entity workflow tracking', () => {
    it('should track completed steps', () => {
      const issue = new Issue();
      issue.completedSteps = [
        IssueWorkflowStep.READ,
        IssueWorkflowStep.ANALYZE,
      ];

      expect(issue.completedSteps).toHaveLength(2);
      expect(issue.completedSteps).toContain(IssueWorkflowStep.READ);
      expect(issue.completedSteps).toContain(IssueWorkflowStep.ANALYZE);
    });

    it('should track next steps', () => {
      const issue = new Issue();
      issue.nextSteps = ['Complete coding', 'Write tests'];

      expect(issue.nextSteps).toHaveLength(2);
      expect(issue.nextSteps).toContain('Complete coding');
      expect(issue.nextSteps).toContain('Write tests');
    });

    it('should track key decisions', () => {
      const issue = new Issue();
      issue.keyDecisions = [
        {
          decision: 'Use JWT for authentication',
          rationale: 'Industry standard, secure',
          timestamp: new Date().toISOString(),
        },
      ];

      expect(issue.keyDecisions).toHaveLength(1);
      expect(issue.keyDecisions?.[0].decision).toBe('Use JWT for authentication');
    });

    it('should track modified files', () => {
      const issue = new Issue();
      issue.filesModified = [
        'src/modules/auth/auth.controller.ts',
        'src/modules/auth/auth.service.ts',
      ];

      expect(issue.filesModified).toHaveLength(2);
      expect(issue.filesModified?.[0]).toContain('auth.controller');
    });

    it('should track metadata', () => {
      const issue = new Issue();
      issue.metadata = {
        labels: ['feature', 'priority'],
        assignees: ['user-123'],
        estimatedHours: 8,
      };

      expect(issue.metadata?.labels).toHaveLength(2);
      expect(issue.metadata?.estimatedHours).toBe(8);
    });
  });

  describe('Issue entity workflow progression', () => {
    it('should progress through all workflow steps', () => {
      const issue = new Issue();
      issue.completedSteps = [];

      // Simulate completing each step
      const allSteps = [
        IssueWorkflowStep.READ,
        IssueWorkflowStep.ANALYZE,
        IssueWorkflowStep.PLAN,
        IssueWorkflowStep.CODE,
        IssueWorkflowStep.TEST,
        IssueWorkflowStep.COMMIT,
        IssueWorkflowStep.PUSH,
        IssueWorkflowStep.CREATE_PR_MD,
        IssueWorkflowStep.CREATE_PR,
      ];

      allSteps.forEach((step) => {
        issue.completedSteps?.push(step);
        issue.currentWorkflowStep = step;
      });

      expect(issue.completedSteps).toHaveLength(9);
      expect(issue.currentWorkflowStep).toBe(IssueWorkflowStep.CREATE_PR);
    });

    it('should calculate progress percentage', () => {
      const issue = new Issue();
      issue.completedSteps = [
        IssueWorkflowStep.READ,
        IssueWorkflowStep.ANALYZE,
        IssueWorkflowStep.PLAN,
      ];

      const totalSteps = 9;
      const completedSteps = issue.completedSteps.length;
      const progress = (completedSteps / totalSteps) * 100;

      expect(progress).toBeCloseTo(33.33, 1);
    });
  });

  describe('Issue entity status transitions', () => {
    it('should start as OPEN', () => {
      const issue = new Issue();
      issue.status = IssueStatus.OPEN;

      expect(issue.status).toBe(IssueStatus.OPEN);
    });

    it('should transition to IN_PROGRESS', () => {
      const issue = new Issue();
      issue.status = IssueStatus.IN_PROGRESS;

      expect(issue.status).toBe(IssueStatus.IN_PROGRESS);
    });

    it('should transition to COMPLETED', () => {
      const issue = new Issue();
      issue.status = IssueStatus.COMPLETED;
      issue.completedAt = new Date();

      expect(issue.status).toBe(IssueStatus.COMPLETED);
      expect(issue.completedAt).toBeDefined();
    });

    it('should transition to ABANDONED', () => {
      const issue = new Issue();
      issue.status = IssueStatus.ABANDONED;

      expect(issue.status).toBe(IssueStatus.ABANDONED);
    });
  });

  describe('Issue entity PR tracking', () => {
    it('should track branch name', () => {
      const issue = new Issue();
      issue.branchName = 'feature/issue-123-authentication';

      expect(issue.branchName).toBe('feature/issue-123-authentication');
      expect(issue.branchName).toContain('feature/');
    });

    it('should track PR URL', () => {
      const issue = new Issue();
      issue.prUrl = 'https://github.com/repo/pull/123';

      expect(issue.prUrl).toBe('https://github.com/repo/pull/123');
      expect(issue.prUrl).toContain('/pull/');
    });

    it('should track PR.md path', () => {
      const issue = new Issue();
      issue.prMdPath = './PR.md';

      expect(issue.prMdPath).toBe('./PR.md');
    });
  });

  describe('Issue entity timestamps', () => {
    it('should have createdAt timestamp', () => {
      const now = new Date();
      const issue = new Issue();
      issue.createdAt = now;

      expect(issue.createdAt).toBe(now);
    });

    it('should have updatedAt timestamp', () => {
      const now = new Date();
      const issue = new Issue();
      issue.updatedAt = now;

      expect(issue.updatedAt).toBe(now);
    });

    it('should have lastActivityAt timestamp', () => {
      const now = new Date();
      const issue = new Issue();
      issue.lastActivityAt = now;

      expect(issue.lastActivityAt).toBe(now);
    });

    it('should have completedAt timestamp when completed', () => {
      const now = new Date();
      const issue = new Issue();
      issue.status = IssueStatus.COMPLETED;
      issue.completedAt = now;

      expect(issue.completedAt).toBe(now);
    });
  });
});
