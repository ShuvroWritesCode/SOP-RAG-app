import { ProjectManagementController } from './project-management.controller';

describe('ProjectManagementController', () => {
  let controller: ProjectManagementController;

  beforeEach(() => {
    controller = new ProjectManagementController(
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
