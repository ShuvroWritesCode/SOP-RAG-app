import { Injectable, Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { ProjectModel } from 'src/projects/entities/projects.model';

@Injectable()
export class ProjectRepository {
  private projectModel: typeof ProjectModel;

  constructor(@Inject('SEQUELIZE') private sequelize: Sequelize) {
    this.projectModel = this.sequelize.models.ProjectModel as typeof ProjectModel;
  }

  async findById(projectId: string): Promise<ProjectModel> {
    return this.projectModel.findOne({ where: { id: projectId } });
  }

  async findByUserId(userId: string): Promise<ProjectModel[]> {
    return this.projectModel.findAll({
      where: { user_id: userId },
      order: [['updatedAt', 'DESC']],
    });
  }

  async create(projectData: {
    name: string;
    user_id: string;
    assistant_id?: string;
    prompt_prefix?: string;
    use_deep_faq?: boolean;
  }): Promise<ProjectModel> {
    return this.projectModel.create(projectData);
  }

  async update(
    projectId: string,
    updateData: Partial<ProjectModel>,
  ): Promise<ProjectModel> {
    const project = await this.projectModel.findByPk(projectId);
    if (!project) return null;
    return project.update(updateData);
  }

  async delete(projectId: string): Promise<boolean> {
    const result = await this.projectModel.destroy({ where: { id: projectId } });
    return result > 0;
  }

  async findWithPagination(
    userId?: string,
    limit = 10,
    offset = 0,
  ): Promise<{ projects: ProjectModel[]; total: number }> {
    const whereClause: any = {};
    if (userId) whereClause.user_id = userId;

    const { rows: projects, count: total } =
      await this.projectModel.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['updatedAt', 'DESC']],
      });

    return { projects, total };
  }
}
