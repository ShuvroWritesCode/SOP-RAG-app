import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AiModelsModule } from 'src/ai-models/ai-models.module';
import { RagService } from './rag.service';

@Module({
  imports: [DatabaseModule, AiModelsModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
