import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { ApiController } from './api.controller';
import { GptapiModule } from 'src/gptapi/gptapi.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesModule } from 'src/messages/messages.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { OpenaiKnowledgeModule } from 'src/openai-knowledge/openai-knowledge.module';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { DatabaseModule } from 'src/database/database.module';
import { IdentityModule } from 'src/identity/identity.module';
import { RagModule } from 'src/rag/rag.module';

@Module({
  providers: [ApiService],
  controllers: [ApiController],
  imports: [
    GptapiModule.config({
      paramsFactory: async (configService: ConfigService) => {
        return {
          openrouter_api_key: configService.get('OPENROUTER_API_KEY'),
        };
      },
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    MessagesModule,
    ProjectsModule,
    OpenaiKnowledgeModule,
    ConversationsModule,
    DatabaseModule,
    IdentityModule,
    RagModule,
  ],
})
export class ApiModule {}
