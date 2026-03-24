import { IssueWorkflowAgent } from './issue-workflow.agent';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { IssueRepository } from '@infrastructure/persistence/repositories/issue.repository';
import { Issue, IssueStatus, IssueWorkflowStep } from '@modules/issues/domain/entities/issue.entity';

// Mocks
const mockAgentLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getRecentLogs: jest.fn(),
  getAgentStats: jest.fn(),
};

const mockIssueRepository = {
  getRepository: jest.fn(),
  create: jest.fn(),
  findByIssueId: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findActiveIssues: jest.fn(),
  updateWorkflow: jest.fn(),
  startWorking: jest.fn(),
  complete: jest.fn(),
  addKeyDecision: jest.fn(),
  addFilesModified: jest.fn(),
  getProgress: jest.fn(),
  getStats: jest.fn(),
  findInactiveSince: jest.fn(),
};

describe('IssueWorkflowAgent', () => {
  let agent: IssueWorkflowAgent;
  let logger: AgentLoggerService;
  let issueRepository: IssueRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockAgentLoggerService as any;
    issueRepository = mockIssueRepository as any;
    agent = new IssueWorkflowAgent(logger, issueRepository);
  });

  describe('canHandle', () => {
    it('should return true for issue-related input', () => {
      expect(agent.canHandle('Start working on issue #123')).toBe(true);
      expect(agent.canHandle('Continuar con el ticket #456')).toBe(true);
      expect(agent.canHandle('Crear pull request')).toBe(true);
      expect(agent.canHandle('Hacer commit de los cambios')).toBe(true);
    });

    it('should return false for unrelated input', () => {
      expect(agent.canHandle('What is the weather?')).toBe(false);
      expect(agent.canHandle('Search for rules')).toBe(false);
    });
  });

  describe('detectWorkflowAction', () => {
    it('should detect START action', () => {
      const input = 'Iniciar issue #123 - Add login feature';
      // Access private method via any
      const result = (agent as any).detectWorkflowAction(input);
      expect(result).toBe('START');
    });

    it('should detect RESUME action', () => {
      const input = 'Continuar con el issue anterior';
      const result = (agent as any).detectWorkflowAction(input);
      expect(result).toBe('RESUME');
    });

    it('should detect COMMIT action', () => {
      const input = 'Hacer commit de los cambios';
      const result = (agent as any).detectWorkflowAction(input);
      expect(result).toBe('COMMIT');
    });

    it('should detect CREATE_PR action', () => {
      const input = 'Crear pull request en GitHub';
      const result = (agent as any).detectWorkflowAction(input);
      expect(result).toBe('CREATE_PR');
    });

    it('should detect STATUS action', () => {
      const input = 'Cómo voy con el issue?';
      const result = (agent as any).detectWorkflowAction(input);
      expect(result).toBe('STATUS');
    });
  });

  describe('extractIssueInfo', () => {
    it('should extract issue ID from input', () => {
      const input = 'Issue #123 - Add authentication';
      const result = (agent as any).extractIssueInfo(input);
      expect(result.issueId).toBe('123');
    });

    it('should extract issue ID with prefix', () => {
      const input = 'PROJ-456 - Fix bug';
      const result = (agent as any).extractIssueInfo(input);
      expect(result.issueId).toBe('PROJ-456');
    });

    it('should extract repository URL', () => {
      const input = 'Issue #123 from https://github.com/user/repo';
      const result = (agent as any).extractIssueInfo(input);
      expect(result.repositoryUrl).toBe('https://github.com/user/repo');
    });
  });

  describe('detectCompletedStep', () => {
    it('should detect READ step', () => {
      const input = 'Ya leí el issue y entendí los requerimientos';
      const result = (agent as any).detectCompletedStep(input);
      expect(result).toBe(IssueWorkflowStep.READ);
    });

    it('should detect ANALYZE step', () => {
      const input = 'Analicé el contexto y la arquitectura';
      const result = (agent as any).detectCompletedStep(input);
      expect(result).toBe(IssueWorkflowStep.ANALYZE);
    });

    it('should detect CODE step', () => {
      const input = 'Codifiqué la solución';
      const result = (agent as any).detectCompletedStep(input);
      expect(result).toBe(IssueWorkflowStep.CODE);
    });

    it('should detect COMMIT step', () => {
      const input = 'Hice commit de los cambios';
      const result = (agent as any).detectCompletedStep(input);
      expect(result).toBe(IssueWorkflowStep.COMMIT);
    });

    it('should return null for unrecognized step', () => {
      const input = 'Algo aleatorio';
      const result = (agent as any).detectCompletedStep(input);
      expect(result).toBeNull();
    });
  });

  describe('getWorkflowGuide', () => {
    it('should return workflow with 9 steps', () => {
      const guide = (agent as any).getWorkflowGuide();
      expect(guide.steps).toHaveLength(9);
      expect(guide.steps[0]).toEqual({ step: 1, name: 'Read Issue', icon: '📖' });
      expect(guide.steps[8]).toEqual({ step: 9, name: 'Create Pull Request', icon: '🔀' });
    });
  });

  describe('getNextStepInfo', () => {
    it('should return next step after READ', () => {
      const result = (agent as any).getNextStepInfo(IssueWorkflowStep.READ);
      expect(result.step).toBe(IssueWorkflowStep.ANALYZE);
      expect(result.name).toBe('Analyze Context');
    });

    it('should return completed when at last step', () => {
      const result = (agent as any).getNextStepInfo(IssueWorkflowStep.CREATE_PR);
      expect(result.completed).toBe(true);
    });

    it('should return ANALYZE as first step when no current step (undefined defaults to index 0)', () => {
      // When undefined, currentStepIndex is 0, so next is index 1 (ANALYZE)
      const result = (agent as any).getNextStepInfo(undefined);
      expect(result.step).toBe(IssueWorkflowStep.ANALYZE);
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate feat commit for new functionality', () => {
      const input = 'Implementé nueva funcionalidad de login';
      const result = (agent as any).generateCommitMessage(input);
      expect(result).toContain('feat:');
    });

    it('should generate fix commit for bug fixes', () => {
      const input = 'Arreglé el bug de autenticación';
      const result = (agent as any).generateCommitMessage(input);
      expect(result).toContain('fix:');
    });

    it('should generate refactor commit', () => {
      const input = 'Hice refactor del código';
      const result = (agent as any).generateCommitMessage(input);
      expect(result).toContain('refactor:');
    });
  });

  describe('generatePRMd', () => {
    it('should generate PR.md content', () => {
      const input = 'Add user authentication with JWT';
      const result = (agent as any).generatePRMd(input);
      expect(result).toContain('# Pull Request');
      expect(result).toContain('## Summary');
      expect(result).toContain('## Changes');
      expect(result).toContain('## Architecture Compliance');
    });
  });

  describe('handle - START workflow', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      title: 'Add authentication',
      status: IssueStatus.OPEN,
      currentWorkflowStep: IssueWorkflowStep.READ,
      completedSteps: [],
    };

    beforeEach(() => {
      (mockIssueRepository.create as jest.Mock).mockResolvedValue(mockIssue);
    });

    it('should start workflow for new issue', async () => {
      const request = {
        input: 'Iniciar issue #123 - Add authentication feature',
        options: { userId: 'user-123' },
      };

      // Call protected method via bracket notation
      const result = await (agent as any)['handle'](request);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('Issue #123 registrado');
      expect(mockIssueRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          issueId: '123',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('handle - RESUME workflow', () => {
    const mockActiveIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      title: 'Add authentication',
      status: IssueStatus.IN_PROGRESS,
      currentWorkflowStep: IssueWorkflowStep.CODE,
      completedSteps: [IssueWorkflowStep.READ, IssueWorkflowStep.ANALYZE, IssueWorkflowStep.PLAN],
      nextSteps: ['Complete coding', 'Write tests'],
    };

    beforeEach(() => {
      (mockIssueRepository.findActiveIssues as jest.Mock).mockResolvedValue([mockActiveIssue]);
      (mockIssueRepository.getProgress as jest.Mock).mockResolvedValue(30);
    });

    it('should resume active issue workflow', async () => {
      const request = {
        input: 'Continuar con el issue',
        options: { userId: 'user-123' },
      };

      const result = await (agent as any)['handle'](request);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('Retomando Issue #123');
      expect(mockIssueRepository.findActiveIssues).toHaveBeenCalledWith('user-123');
    });

    it('should return message when no active issues', async () => {
      (mockIssueRepository.findActiveIssues as jest.Mock).mockResolvedValue([]);

      const request = {
        input: 'Continuar con el issue',
        options: { userId: 'user-123' },
      };

      const result = await (agent as any)['handle'](request);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('No tienes issues activos');
    });
  });

  describe('handle - STATUS workflow', () => {
    const mockStats = {
      total: 5,
      open: 2,
      inProgress: 2,
      completed: 1,
      abandoned: 0,
    };

    const mockActiveIssues: Partial<Issue>[] = [
      {
        id: 'uuid-1',
        issueId: '123',
        title: 'Issue 1',
        currentWorkflowStep: IssueWorkflowStep.CODE,
        completedSteps: [IssueWorkflowStep.READ, IssueWorkflowStep.ANALYZE],
      },
    ];

    beforeEach(() => {
      (mockIssueRepository.getStats as jest.Mock).mockResolvedValue(mockStats);
      (mockIssueRepository.findActiveIssues as jest.Mock).mockResolvedValue(mockActiveIssues);
    });

    it('should return workflow status', async () => {
      const request = {
        input: 'Cómo voy con los issues?',
        options: { userId: 'user-123' },
      };

      const result = await (agent as any)['handle'](request);

      expect(result.success).toBe(true);
      expect(result.data.stats).toEqual(mockStats);
      expect(result.data.activeIssues).toHaveLength(1);
    });
  });
});
