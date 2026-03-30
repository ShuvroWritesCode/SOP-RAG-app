import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ApiService, MessageTypes } from './api.service';
import { IClearMemoryDTO } from './dto/clear-memory.dto';
import {
  IConversationId,
  IConversationIds,
  ICreateConversationDTO,
  IGetCompleteDTO,
  IProjectIdentification,
} from './dto/get-complete.dto';
import { AuthedWithBot } from 'src/authed-with-bot.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ProjecLink } from 'src/project-link.decorator';
import { OpenaiKnowledgeService } from 'src/openai-knowledge/openai-knowledge.service';
import { BotsService } from 'src/bots/bots.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { RagService } from 'src/rag/rag.service';
import * as crypto from 'crypto';

@Controller('api')
@UseInterceptors(AuthedWithBot)
export class ApiController {
  constructor(
    private apiService: ApiService,
    private openaiKnowledgeService: OpenaiKnowledgeService,
    private botsService: BotsService,
    private conversationsService: ConversationsService,
    private ragService: RagService,
  ) {}

  @UseInterceptors(ProjecLink)
  @Get('complete')
  public async getComplete(
    @Query() query: IGetCompleteDTO,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const conversationId = query.conversationId || crypto.randomUUID();
      const projectId = query.project_id || null;
      const userId = query.userId;

      // Build history from existing conversation
      let history: { role: 'user' | 'assistant'; content: string }[] = [];
      if (query.conversationId) {
        try {
          const chatData = await this.apiService.getConversationHistory(
            query.conversationId,
          );
          history = chatData.messages
            .filter(
              (m) =>
                m.type === MessageTypes.USER_MESSAGE ||
                m.type === MessageTypes.AI_MESSAGE,
            )
            .map((m) => ({
              role:
                m.type === MessageTypes.USER_MESSAGE ? 'user' : 'assistant',
              content: m.message,
            }));
        } catch {
          // New conversation — no history
        }
      }

      // Get prompt prefix from project/bot
      let promptPrefix = '';
      if (projectId) {
        try {
          const project = await this.apiService.getProjectById(projectId);
          promptPrefix = project?.prompt_prefix || '';
        } catch {
          // ignore
        }
      }

      const fullAnswer = await this.ragService.streamTokens(
        query.prompt,
        history,
        projectId,
        userId,
        promptPrefix,
        res,
      );

      res.write(
        `data: ${JSON.stringify({ done: true, conversationId })}\n\n`,
      );
      res.end();

      // Fire-and-forget: persist conversation
      setImmediate(async () => {
        try {
          const messages = [
            {
              type: MessageTypes.USER_MESSAGE,
              message: query.prompt,
              messageId: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
            {
              type: MessageTypes.AI_MESSAGE,
              message: fullAnswer,
              messageId: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ];

          try {
            await this.conversationsService.getConversation(conversationId);
            await this.conversationsService.appendToConversation(
              conversationId,
              messages,
              { project_id: projectId, assistant_id: null },
            );
          } catch {
            await this.conversationsService.createConversation(
              conversationId,
              messages,
              {
                project_id: projectId,
                user_id: userId,
                assistant_id: null,
                name:
                  query.prompt.slice(0, 60) ||
                  `Chat ${new Date().toLocaleDateString()}`,
                messages_slug: '',
              },
            );
          }
        } catch {
          // non-critical
        }
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  @Get('list-of-conversations')
  @UseGuards(JwtAuthGuard)
  public async listConversations(@Query() query: { project_id?: string }) {
    return {
      data: await this.conversationsService.getConversationsList(
        query.project_id,
      ),
    };
  }

  @Get('conversation-history')
  public async conversationHistory(@Query() query: IConversationId) {
    return {
      data: await this.apiService.getConversationHistory(query.conversationId),
    };
  }

  @Get('conversations-history')
  public async conversationsHistory(@Query() query: IConversationIds) {
    return {
      data: await this.apiService.getConversationsHistory(
        query.conversationIds,
      ),
    };
  }

  @Get('project-history-compiled')
  @UseGuards(JwtAuthGuard)
  public async projectHistoryCompiled(
    @Query() query: IProjectIdentification,
    @Res() res: Response,
  ) {
    if (!query.bot_id || !query.project_id) {
      res
        .setHeader('Content-Type', 'text/plain')
        .send('Please, set project_id and bot_id get parameters')
        .status(400);
      return;
    }

    const conversationsList = Object.values(
      await this.apiService.getConversationsHistory(query),
    ).sort((a, b) => {
      if (!a.messages.length) return 1;
      if (!b.messages.length) return -1;
      return (
        Number(new Date(b.messages[b.messages.length - 1].createdAt)) -
        Number(new Date(a.messages[a.messages.length - 1].createdAt))
      );
    });

    let text = '';
    for (const chat of conversationsList) {
      text += '\n\n\n-----------------------------------\n';
      text += chat.name + '\n\n';
      for (const message of chat.messages) {
        let dateStr = '';
        if (message.createdAt) {
          const date = new Date(message.createdAt);
          const year = date.getUTCFullYear();
          const month = date.getUTCMonth() + 1;
          const day = date.getUTCDate();
          const hours = date.getUTCHours();
          const minutes = date.getUTCMinutes();
          dateStr = `${year}-${month.toString().padStart(2, '0')}-${day
            .toString()
            .padStart(2, '0')} ${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}`;
        }
        text += `[${
          message.type === MessageTypes.AI_MESSAGE ? 'ROBOT' : 'CLIENT'
        } | ${dateStr}]\n${message.message}\n\n`;
      }
      text += '-----------------------------------';
    }

    res.setHeader('Content-Type', 'text/plain').send(text.trim()).status(200);
  }

  @Post('create-conversation')
  public async createConversation(@Body() body: ICreateConversationDTO) {
    return {
      data: await this.apiService.createConversation(
        body.conversationId,
        body.messages,
        false,
        body,
      ),
    };
  }

  @Post('append-conversation')
  public async appendConversation(@Body() body: ICreateConversationDTO) {
    return {
      data: await this.apiService.createConversation(
        body.conversationId,
        body.messages,
        true,
        body,
      ),
    };
  }

  @Post('clear-memory')
  public async clearMemory(@Body() body: IClearMemoryDTO) {
    await this.apiService.clearConversationHistory(body.conversationId);
    return { status: true };
  }

  @Post('default-project')
  @UseGuards(JwtAuthGuard)
  public async getDefaultProject(@Req() req: Request) {
    const user = req.user as any;
    if (!user || !user.id) {
      throw new HttpException(
        'User not authenticated or missing ID',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const defaultBot = await this.botsService.getDefaultBotForUser({
      user_id: user.id,
    });
    return await this.apiService.defaultProject({
      bot_id: defaultBot.id,
      user_id: user.id,
    });
  }

  @Post('upload-file')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  public async uploadFile(
    @UploadedFiles() files,
    @Req() req: Request,
    @Query('project_id') project_id: string = null,
  ) {
    const file = files?.file?.[0];
    if (!file || !file.buffer) {
      throw new HttpException('Input file is required', HttpStatus.BAD_REQUEST);
    }

    const user = req.user as any;

    const result = await this.openaiKnowledgeService.uploadFileForRetrieval(
      project_id,
      file.buffer,
      file.originalname,
      user.id,
    );

    return {
      status: true,
      data: {
        id: result.dbFileId,
        file_name: file.originalname,
        createdAt: new Date().toISOString(),
      },
      message: 'File uploaded and ingested successfully.',
    };
  }

  @Post('train-files')
  @UseGuards(JwtAuthGuard)
  public async trainFiles(
    @Req() req: Request,
    @Query('project_id') project_id?: string,
  ) {
    const user = req.user as any;
    const result = await this.openaiKnowledgeService.trainUploadedFiles(
      project_id || null,
      user.id,
    );
    return { status: true, data: result };
  }

  @Get('bot-prompt')
  @UseGuards(JwtAuthGuard)
  async getBotPrompt(@Req() req: Request, @Query('bot_id') bot_id?: string) {
    const user = req.user as any;
    let bot;
    if (bot_id) {
      bot = await this.botsService.getBot(+bot_id);
    } else {
      bot = await this.botsService.getDefaultBotForUser({ user_id: user.id });
    }
    return {
      status: true,
      data: bot ? bot.dataValues : null,
    };
  }
}
