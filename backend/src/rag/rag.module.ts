import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { RagService } from './rag.service';

@Module({
  imports: [DatabaseModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
