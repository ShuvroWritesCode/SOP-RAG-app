/* eslint-disable @typescript-eslint/ban-types */
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { GptapiService } from 'src/gptapi/gptapi.service';
import * as crypto from 'crypto';
import { MessagesService } from 'src/messages/messages.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ProjectsService } from 'src/projects/projects.service';
import { ProjectModel } from 'src/projects/entities/projects.model';
import {
  ICreateConversationDTO,
  IMessage,
  IProjectIdentification,
  IChat,
} from './dto/get-complete.dto';
import { IdentityService } from 'src/identity/identity.service';
import { BotModel } from 'src/bots/entities/bot.model';

export enum MessageTypes {
  SYSTEM_MESSAGE = 'system_message',
  USER_MESSAGE = 'user_message',
  AI_MESSAGE = 'ai_message',
}
export const conversationIdPattern = /[A-Za-z0-9_-]{1,555}/;

const longToByteArray = (long: number) => {
  const byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < byteArray.length; index++) {
    const byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }
  return byteArray;
};

@Injectable()
export class ApiService {
  private _assistantLabel: string;
  private _userLabel: string;
  private _stopString: string;
  private _promptPrefix: string;
  private _conversationsInProcess: { [conversationId: string]: boolean } = {};

  private logger = new Logger(ApiService.name);
  private botModel: typeof BotModel;

  private _conversationsInProcessData: {
    [conversationId: string]: {
      isProcessing: boolean;
      abortController: AbortController;
    };
  } = {};

  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private gptapiService: GptapiService,
    private configService: ConfigService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private projectsService: ProjectsService,
    private identityService: IdentityService,
  ) {
    this.botModel = this.sequelize.models.BotModel as typeof BotModel;
    this._assistantLabel = this.configService.get<string>(
      '_assistantLabel',
      '_assistantLabel',
    );
    this._userLabel = this.configService.get<string>(
      '_userLabel',
      '_userLabel',
    );
    this._stopString = this.configService.get<string>(
      '_stopString',
      '<|im_end|>',
    );
    this._promptPrefix = '';
  }

  private newMessageId() {
    return (
      crypto.randomBytes(5).toString('base64url') +
      '-' +
      Buffer.concat([
        new Uint8Array(Buffer.from(longToByteArray(+new Date()))),
        new Uint8Array(crypto.randomBytes(5)),
      ]).toString('base64url')
    );
  }

  public validateConversationId(conversationId: string) {
    if (!conversationIdPattern.test(conversationId)) {
      throw new Error('Conversation id is not correct');
    }
  }

  public async getProjectById(projectId: string): Promise<ProjectModel | null> {
    return this.projectsService.getProjectById(projectId);
  }

  public async createConversation(
    conversationId: string = null,
    messagesToSave: IMessage[],
    append = false,
    config?: ICreateConversationDTO,
  ) {
    if (!conversationId) {
      conversationId = crypto
        .createHash('md5')
        .update(new Uint8Array(crypto.randomBytes(100)))
        .update(Date.now().toString())
        .digest('base64url');
    }
    this.validateConversationId(conversationId);

    const getMessageList = async () => {
      if (append) {
        const history = (await this.getConversationHistory(conversationId))
          .messages;
        messagesToSave = history.concat(messagesToSave);
      }
      return messagesToSave;
    };

    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      abortController.signal.onabort = reject;
      this._startProcessingConversation(conversationId, abortController);

      resolve(
        getMessageList()
          .then((messages) =>
            this._savePrompt(messages, conversationId, {
              name: config?.name ?? null,
              project_id: config.project_id ?? null,
              bot_id: config.bot_id ?? null,
            }),
          )
          .then(() => {
            this._stopProcessingConversation(conversationId);
            return { conversationId };
          }),
      );
    });
  }

  private _startProcessingConversation(
    conversationId: string,
    abortController: AbortController,
  ) {
    if (
      this._conversationsInProcessData[conversationId]?.isProcessing
    ) {
      this._conversationsInProcessData[conversationId].abortController.abort();
    }
    this._conversationsInProcessData[conversationId] = {
      isProcessing: true,
      abortController,
    };
  }

  private _stopProcessingConversation(conversationId: string) {
    this._conversationsInProcessData[conversationId] = {
      isProcessing: false,
      abortController: null,
    };
  }

  public async defaultProject(params: { bot_id: string; user_id: string }) {
    return this.projectsService.defaultProject(params.bot_id, params.user_id);
  }

  public async clearConversationHistory(conversationId: string) {
    this.validateConversationId(conversationId);
    this._conversationsInProcess[conversationId] = false;
    await this.conversationsService.clearConversation(conversationId);
  }

  private translateToGPT4(prompt: IMessage[]) {
    const types: { [key: string]: 'assistant' | 'user' | 'system' } = {
      [MessageTypes.AI_MESSAGE]: 'assistant',
      [MessageTypes.USER_MESSAGE]: 'user',
      [MessageTypes.SYSTEM_MESSAGE]: 'system',
    };
    return prompt.map((m) => ({ role: types[m.type], content: m.message }));
  }

  public async getConversationsHistory(
    conversationIds: string[],
  ): Promise<IChat[]>;
  public async getConversationsHistory(
    projectIdentification: IProjectIdentification,
  ): Promise<IChat[]>;
  public async getConversationsHistory(
    input: string[] | IProjectIdentification,
  ): Promise<IChat[]> {
    let ids: string[];
    if (Array.isArray(input)) {
      ids = input;
    } else {
      ids = Object.keys(
        await this.conversationsService.getConversationsList(input.project_id),
      );
    }
    return Promise.all(ids.map((c) => this.getConversationHistory(c)));
  }

  public async getConversationHistory(conversationId: string): Promise<IChat> {
    const conversation =
      await this.conversationsService.getConversation(conversationId);
    return {
      project_id: conversation.project_id,
      assistant_id: conversation.assistant_id,
      name: conversation.name,
      id: conversation.id,
      messages: conversation.messages.map((m) => ({
        ...m,
        type: m.type as MessageTypes,
        createdAt: m.createdAt || new Date().toISOString(),
      })),
      messages_slug: conversation.messages_slug,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private async _savePrompt(
    promptBody: IMessage[],
    conversationId: string,
    config: { project_id?: string; bot_id?: string; name?: string },
  ) {
    const messagesList = promptBody.map((m) => ({
      ...m,
      createdAt: m.createdAt || new Date().toISOString(),
    }));
    const messages_slug =
      messagesList.length > 0
        ? new Date(messagesList[0].createdAt).toLocaleString() +
          ' - ' +
          messagesList[0].message.slice(0, 100) +
          '...'
        : '';

    try {
      await this.conversationsService.getConversation(conversationId);
      await this.conversationsService.appendToConversation(
        conversationId,
        messagesList,
        {
          project_id: config.project_id,
          assistant_id: config.bot_id,
          name: config.name,
          messages_slug,
        },
      );
    } catch {
      await this.conversationsService.createConversation(
        conversationId,
        messagesList,
        {
          project_id: config.project_id,
          assistant_id: config.bot_id,
          name: config.name || conversationId,
          messages_slug,
        },
      );
    }
  }

  // Legacy getAnswer — kept for backward compatibility but no longer called by SSE endpoint
  public async getAnswer(
    userPrompt: string,
    conversationId: string = null,
    params?: {
      bot_id: string;
      project_id?: string;
      translate_to_language?: string;
    },
  ) {
    if (conversationId) {
      this.validateConversationId(conversationId);
    }

    const config: any = {
      _userLabel: this._userLabel,
      _assistantLabel: this._assistantLabel,
      _promptPrefix: this._promptPrefix,
      _answerPrePromptPrefix: null,
      _stopString: this._stopString,
      GPT4: true,
      bot_id: params?.bot_id,
      project_id: params?.project_id,
      translate_to_language: null,
    };

    if (params?.bot_id) {
      const bot = await this.botModel.findByPk(params.bot_id);
      if (bot) {
        let project: ProjectModel = null;
        if (params.project_id) {
          project = await this.projectsService.getProjectById(params.project_id);
        }
        config._promptPrefix = project?.prompt_prefix || bot.prompt_prefix || '';
        config._answerPrePromptPrefix = config._promptPrefix;
      }
    }

    if (conversationId && this._conversationsInProcess[conversationId]) {
      throw new HttpException(
        'This conversation is in processing now!',
        HttpStatus.CONFLICT,
      );
    }

    if (conversationId) {
      this._conversationsInProcess[conversationId] = true;
    }

    let textAnswer: string = null;
    let processPromptData: {
      prompt: string;
      conversationId: string;
      promptBody: IMessage[];
    } = null;

    try {
      processPromptData = await this._formatPrompt(
        userPrompt,
        conversationId,
        config,
      );
      const answer = await this.gptapiService.getComplete4(
        this.translateToGPT4(processPromptData.promptBody),
        'openai/gpt-4o',
        'openrouter',
      );
      textAnswer = answer.choices[0]?.message?.content;
    } catch (ex) {
      this.logger.error(ex);
    }

    if (conversationId) {
      this._conversationsInProcess[conversationId] = false;
    }

    if (textAnswer && processPromptData) {
      processPromptData.promptBody.push({
        type: MessageTypes.AI_MESSAGE,
        message: textAnswer,
        previousMessageId:
          processPromptData.promptBody.length > 0
            ? processPromptData.promptBody[
                processPromptData.promptBody.length - 1
              ].messageId
            : null,
        messageId: this.newMessageId(),
      });
      await this._savePrompt(
        processPromptData.promptBody,
        processPromptData.conversationId,
        config,
      );
    }

    return {
      answer: textAnswer,
      conversationId: processPromptData?.conversationId,
    };
  }

  private async _formatPrompt(
    userInput: string,
    conversationId: string = null,
    config: any,
  ) {
    if (!conversationId) {
      conversationId = crypto
        .createHash('md5')
        .update(new Uint8Array(crypto.randomBytes(100)))
        .update(Date.now().toString())
        .digest('base64url');
    }

    const promptPrefix =
      'Your name is ' +
      config._assistantLabel +
      '.\n' +
      (config._promptPrefix || '') +
      '\n';

    let promptBody: IMessage[] = [];
    try {
      const chatData = await this.getConversationHistory(conversationId);
      promptBody = chatData.messages.filter(
        (m) => m.type !== MessageTypes.SYSTEM_MESSAGE,
      );
    } catch {
      // New conversation
    }

    promptBody.push({
      type: MessageTypes.USER_MESSAGE,
      message: userInput,
      messageId: this.newMessageId(),
      previousMessageId:
        promptBody.length > 0
          ? promptBody[promptBody.length - 1].messageId
          : null,
    });

    // Prepend system message
    promptBody.unshift({
      type: MessageTypes.SYSTEM_MESSAGE,
      message: promptPrefix,
      messageId: this.newMessageId(),
      previousMessageId: null,
    });

    return { prompt: '', conversationId, promptBody };
  }
}
