import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AiModelsService } from './ai-models.service';
import { AiModelsController } from './ai-models.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [AiModelsController],
  providers: [AiModelsService],
  exports: [AiModelsService],
})
export class AiModelsModule {}
