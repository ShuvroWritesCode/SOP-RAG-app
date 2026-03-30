import { Module } from '@nestjs/common';
import { OpenaiKnowledgeService } from './openai-knowledge.service';
import { OpenaiKnowledgeController } from './openai-knowledge.controller';
import { DatabaseModule } from '../database/database.module';
import { BotsModule } from '../bots/bots.module';
import { RagModule } from 'src/rag/rag.module';

@Module({
  imports: [DatabaseModule, BotsModule, RagModule],
  providers: [OpenaiKnowledgeService],
  controllers: [OpenaiKnowledgeController],
  exports: [OpenaiKnowledgeService],
})
export class OpenaiKnowledgeModule {}
