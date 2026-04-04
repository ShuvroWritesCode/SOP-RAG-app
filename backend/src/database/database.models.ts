import { MessageModel } from 'src/messages/entities/message.model';
import { ConversationModel } from 'src/conversations/entities/conversation.model';
import { UserModel } from 'src/users/entities/user.model';
import { ProjectModel } from 'src/projects/entities/projects.model';
import { ProjectFileModel } from 'src/openai-knowledge/entities/project-file.model';
import { BotModel } from 'src/bots/entities/bot.model';
import { DocumentChunkModel } from 'src/rag/document-chunk.model';
import { AiModelModel } from 'src/ai-models/ai-model.model';

export const DatabaseModels = [
  UserModel,
  MessageModel,
  ConversationModel,
  ProjectModel,
  ProjectFileModel,
  DocumentChunkModel,
  BotModel,
  AiModelModel,
];
