import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { UserModel } from '../users/entities/user.model';
import { ProjectModel } from '../projects/entities/projects.model';
import { ConversationModel } from '../conversations/entities/conversation.model';
import { MessageModel } from '../messages/entities/message.model';
import { ProjectRepository } from './repositories/project.repository';
import { AssistantRepository } from './repositories/assistant.repository';
import { UserRepository } from './repositories/user.repository';
import { CacheService } from './cache/cache.service';

@Injectable()
export class IdentityService {
  private userModel: typeof UserModel;
  private projectModel: typeof ProjectModel;
  private conversationModel: typeof ConversationModel;
  private messageModel: typeof MessageModel;

  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private projectRepository: ProjectRepository,
    private assistantRepository: AssistantRepository,
    private userRepository: UserRepository,
    private cacheService: CacheService,
  ) {
    this.userModel = this.sequelize.models.UserModel as typeof UserModel;
    this.projectModel = this.sequelize.models.ProjectModel as typeof ProjectModel;
    this.conversationModel = this.sequelize.models.ConversationModel as typeof ConversationModel;
    this.messageModel = this.sequelize.models.MessageModel as typeof MessageModel;
  }

  public clearCache(pattern?: string): void {
    this.cacheService.clear(pattern);
  }

  async getUserIdByProjectId(projectId: string): Promise<string> {
    const project = await this.projectModel.findByPk(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return project.user_id;
  }

  async getUserByProjectId(projectId: string): Promise<UserModel> {
    const project = await this.projectModel.findByPk(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return this.userModel.findByPk(project.user_id);
  }

  async getProjectIdByConversationId(conversationId: string): Promise<string> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }
    return conversation.project_id;
  }

  async getAssistantIdByConversationId(conversationId: string): Promise<string> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }
    return conversation.assistant_id;
  }
}
