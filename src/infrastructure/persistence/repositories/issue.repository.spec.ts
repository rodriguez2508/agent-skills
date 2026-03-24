import { IssueRepository, CreateIssueDto } from './issue.repository';
import { Issue, IssueStatus, IssueWorkflowStep } from '@modules/issues/domain/entities/issue.entity';
import { Repository } from 'typeorm';

// Mock TypeORM Repository
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
};

describe('IssueRepository', () => {
  let repository: IssueRepository;
  let typeOrmRepository: Repository<Issue>;

  beforeEach(() => {
    jest.clearAllMocks();
    typeOrmRepository = mockRepository as any;
    repository = new IssueRepository(typeOrmRepository);
  });

  describe('create', () => {
    const createIssueDto: CreateIssueDto = {
      issueId: '123',
      title: 'Add authentication',
      description: 'Implement JWT authentication',
      userId: 'user-123',
    };

    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      title: 'Add authentication',
      status: IssueStatus.OPEN,
      currentWorkflowStep: IssueWorkflowStep.READ,
      completedSteps: [],
      nextSteps: ['Analyze issue requirements'],
      lastActivityAt: expect.any(Date),
    };

    beforeEach(() => {
      (mockRepository.create as jest.Mock).mockReturnValue(mockIssue);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockIssue);
    });

    it('should create a new issue with default values', async () => {
      const result = await repository.create(createIssueDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createIssueDto,
        status: IssueStatus.OPEN,
        currentWorkflowStep: IssueWorkflowStep.READ,
        completedSteps: [],
        nextSteps: ['Analyze issue requirements'],
        lastActivityAt: expect.any(Date),
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockIssue);
      expect(result).toEqual(mockIssue);
    });

    it('should create issue with metadata', async () => {
      const dtoWithMetadata: CreateIssueDto = {
        ...createIssueDto,
        metadata: {
          labels: ['feature', 'priority'],
          estimatedHours: 8,
        },
      };

      await repository.create(dtoWithMetadata);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            labels: ['feature', 'priority'],
            estimatedHours: 8,
          }),
        }),
      );
    });
  });

  describe('findByIssueId', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      title: 'Add authentication',
    };

    it('should find issue by external ID', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);

      const result = await repository.findByIssueId('123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { issueId: '123' },
        relations: ['user'],
      });
      expect(result).toEqual(mockIssue);
    });

    it('should return null when issue not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByIssueId('999');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      title: 'Add authentication',
    };

    it('should find issue by internal ID', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);

      const result = await repository.findById('uuid-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        relations: ['user'],
      });
      expect(result).toEqual(mockIssue);
    });
  });

  describe('findByUserId', () => {
    const mockIssues: Partial<Issue>[] = [
      { id: 'uuid-1', issueId: '123', title: 'Issue 1', status: IssueStatus.OPEN },
      { id: 'uuid-2', issueId: '456', title: 'Issue 2', status: IssueStatus.IN_PROGRESS },
    ];

    it('should find all issues for a user', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue(mockIssues);

      const result = await repository.findByUserId('user-123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: { lastActivityAt: 'DESC' },
      });
      expect(result).toEqual(mockIssues);
    });

    it('should filter by status', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue([mockIssues[1]]);

      const result = await repository.findByUserId('user-123', IssueStatus.IN_PROGRESS);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: IssueStatus.IN_PROGRESS },
        order: { lastActivityAt: 'DESC' },
      });
    });
  });

  describe('findActiveIssues', () => {
    const mockActiveIssues: Partial<Issue>[] = [
      { id: 'uuid-1', issueId: '123', title: 'Active Issue 1', status: IssueStatus.IN_PROGRESS },
    ];

    it('should find all active issues', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue(mockActiveIssues);

      const result = await repository.findActiveIssues();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status: IssueStatus.IN_PROGRESS },
        order: { lastActivityAt: 'DESC' },
      });
      expect(result).toEqual(mockActiveIssues);
    });

    it('should find active issues for specific user', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue(mockActiveIssues);

      const result = await repository.findActiveIssues('user-123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: IssueStatus.IN_PROGRESS },
        order: { lastActivityAt: 'DESC' },
      });
    });
  });

  describe('updateWorkflow', () => {
    const mockExistingIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      completedSteps: [IssueWorkflowStep.READ],
    };

    it('should update workflow progress', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockExistingIssue);
      (mockRepository.update as jest.Mock).mockResolvedValue({});

      await repository.updateWorkflow('123', {
        currentStep: IssueWorkflowStep.ANALYZE,
        nextSteps: ['Plan implementation'],
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        { issueId: '123' },
        expect.objectContaining({
          currentStep: IssueWorkflowStep.ANALYZE,
          nextSteps: ['Plan implementation'],
          lastActivityAt: expect.any(Date),
        }),
      );
    });

    it('should add completed step to completedSteps array', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockExistingIssue);
      (mockRepository.update as jest.Mock).mockResolvedValue({});

      await repository.updateWorkflow('123', {
        currentStep: IssueWorkflowStep.ANALYZE,
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        { issueId: '123' },
        expect.objectContaining({
          completedSteps: [IssueWorkflowStep.READ, IssueWorkflowStep.ANALYZE],
        }),
      );
    });

    it('should update lastSessionId when provided', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockExistingIssue);
      (mockRepository.update as jest.Mock).mockResolvedValue({});

      await repository.updateWorkflow('123', {}, 'session-uuid');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { issueId: '123' },
        expect.objectContaining({
          lastSessionId: 'session-uuid',
        }),
      );
    });
  });

  describe('startWorking', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      status: IssueStatus.IN_PROGRESS,
    };

    it('should mark issue as in progress', async () => {
      (mockRepository.update as jest.Mock).mockResolvedValue({});
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);

      const result = await repository.startWorking('123');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { issueId: '123' },
        {
          status: IssueStatus.IN_PROGRESS,
          currentWorkflowStep: IssueWorkflowStep.READ,
          lastActivityAt: expect.any(Date),
        },
      );
      expect(result).toEqual(mockIssue);
    });
  });

  describe('complete', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      status: IssueStatus.COMPLETED,
    };

    it('should mark issue as completed', async () => {
      (mockRepository.update as jest.Mock).mockResolvedValue({});
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);

      const result = await repository.complete('123');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { issueId: '123' },
        expect.objectContaining({
          status: IssueStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should update PR URL when provided', async () => {
      (mockRepository.update as jest.Mock).mockResolvedValue({});
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);

      await repository.complete('123', 'https://github.com/repo/pull/123');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { issueId: '123' },
        expect.objectContaining({
          prUrl: 'https://github.com/repo/pull/123',
        }),
      );
    });
  });

  describe('addKeyDecision', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      keyDecisions: [],
    };

    it('should add a key decision to issue', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);
      (mockRepository.update as jest.Mock).mockResolvedValue({});

      await repository.addKeyDecision('123', 'Use JWT for tokens', 'Better security');

      expect(mockRepository.update).toHaveBeenCalledWith(
        '123', // Uses issueId, not internal id
        expect.objectContaining({
          keyDecisions: expect.arrayContaining([
            expect.objectContaining({
              decision: 'Use JWT for tokens',
              rationale: 'Better security',
            }),
          ]),
        }),
      );
    });

    it('should do nothing when issue not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await repository.addKeyDecision('999', 'Decision', 'Rationale');

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('addFilesModified', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      filesModified: ['src/file1.ts'],
    };

    it('should add files to modified files list', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);
      (mockRepository.update as jest.Mock).mockResolvedValue({});

      await repository.addFilesModified('123', ['src/file2.ts', 'src/file3.ts']);

      expect(mockRepository.update).toHaveBeenCalledWith(
        '123', // Uses issueId, not internal id
        expect.objectContaining({
          filesModified: expect.arrayContaining([
            'src/file1.ts',
            'src/file2.ts',
            'src/file3.ts',
          ]),
        }),
      );
    });

    it('should deduplicate files', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);
      (mockRepository.update as jest.Mock).mockResolvedValue({});

      await repository.addFilesModified('123', ['src/file1.ts', 'src/file4.ts']);

      expect(mockRepository.update).toHaveBeenCalledWith(
        '123', // Uses issueId, not internal id
        expect.objectContaining({
          filesModified: expect.arrayContaining([
            'src/file1.ts',
            'src/file4.ts',
          ]),
        }),
      );
    });
  });

  describe('getProgress', () => {
    const mockIssue: Partial<Issue> = {
      id: 'uuid-123',
      issueId: '123',
      completedSteps: [IssueWorkflowStep.READ, IssueWorkflowStep.ANALYZE],
    };

    it('should calculate progress percentage', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockIssue);

      const result = await repository.getProgress('123');

      // 2 completed out of 9 steps = ~22%
      expect(result).toBeLessThanOrEqual(100);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when issue not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await repository.getProgress('999');

      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    const mockCounts = {
      total: 10,
      open: 3,
      inProgress: 4,
      completed: 2,
      abandoned: 1,
    };

    beforeEach(() => {
      (mockRepository.count as jest.Mock).mockImplementation(({ where }) => {
        if (!where?.status) return mockCounts.total;
        if (where.status === IssueStatus.OPEN) return mockCounts.open;
        if (where.status === IssueStatus.IN_PROGRESS) return mockCounts.inProgress;
        if (where.status === IssueStatus.COMPLETED) return mockCounts.completed;
        if (where.status === IssueStatus.ABANDONED) return mockCounts.abandoned;
        return 0;
      });
    });

    it('should return stats for all issues', async () => {
      const result = await repository.getStats();

      expect(result).toEqual(mockCounts);
      expect(mockRepository.count).toHaveBeenCalledTimes(5);
    });

    it('should return stats filtered by user', async () => {
      const result = await repository.getStats('user-123');

      expect(mockRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        }),
      );
    });
  });

  describe('findInactiveSince', () => {
    const mockInactiveIssues: Partial<Issue>[] = [
      {
        id: 'uuid-1',
        issueId: '123',
        status: IssueStatus.IN_PROGRESS,
        lastActivityAt: new Date('2024-01-01'),
      },
    ];

    it('should find issues inactive since threshold date', async () => {
      const thresholdDate = new Date('2024-01-15');
      (mockRepository.find as jest.Mock).mockResolvedValue(mockInactiveIssues);

      const result = await repository.findInactiveSince(thresholdDate);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          status: IssueStatus.IN_PROGRESS,
          lastActivityAt: thresholdDate,
        },
      });
      expect(result).toEqual(mockInactiveIssues);
    });
  });

  describe('getRepository', () => {
    it('should return the underlying TypeORM repository', () => {
      const result = repository.getRepository();

      expect(result).toBe(typeOrmRepository);
    });
  });
});
