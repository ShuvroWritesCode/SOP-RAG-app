import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { AiModelModel } from './ai-model.model';

@Injectable()
export class AiModelsService {
  constructor(@Inject('SEQUELIZE') private readonly sequelize: Sequelize) {}

  async getAll(): Promise<AiModelModel[]> {
    return AiModelModel.findAll({ order: [['display_name', 'ASC']] });
  }

  async getActiveModel(): Promise<string> {
    const active = await AiModelModel.findOne({ where: { is_active: true } });
    return active?.model_id || 'openai/gpt-4.1';
  }

  async setActive(id: string): Promise<void> {
    const transaction = await this.sequelize.transaction();
    try {
      await AiModelModel.update(
        { is_active: false },
        { where: { is_active: true }, transaction },
      );
      const [affectedCount] = await AiModelModel.update(
        { is_active: true },
        { where: { id }, transaction },
      );
      if (affectedCount === 0) {
        throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
