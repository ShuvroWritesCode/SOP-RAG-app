import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { IGptApiConfig } from './gptapiconfig.constants';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class GptapiService {
  private readonly openrouter_url =
    'https://openrouter.ai/api/v1/chat/completions';
  private logger = new Logger(GptapiService.name);

  private _requestsQueue: {
    resolver: (value: unknown) => void;
    rejector: (reason?: any) => void;
    targetFunction: () => Promise<any>;
    lastRun: number;
    deadLine: number;
  }[] = [];
  private schedulerStarted = false;

  constructor(
    private httpService: HttpService,
    @Inject('GPT_API_CONFIG') private gptApiConfig: IGptApiConfig,
  ) {}

  public async startQueued(targetFunction: () => Promise<any>) {
    return new Promise((resolve, reject) => {
      this._requestsQueue.push({
        resolver: resolve,
        rejector: reject,
        targetFunction,
        lastRun: null,
        deadLine: Date.now() + 60 * 1000 * 3,
      });
    });
  }

  @Interval(500)
  private async processScheduler() {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;

    for (const i in this._requestsQueue) {
      const f = this._requestsQueue[i];

      if (f.lastRun !== null && f.lastRun + 60 * 1000 * 0.5 > Date.now()) {
        continue;
      }

      if (f.deadLine <= Date.now()) {
        f.rejector('Timeout');
        delete this._requestsQueue[i];
        continue;
      }

      try {
        const result = await this._requestsQueue[i].targetFunction();
        this._requestsQueue[i].resolver(result);
      } catch (ex) {
        this.logger.error(ex);
        if (ex.message?.includes('Code: 429')) {
          this._requestsQueue[i].lastRun = Date.now();
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        this._requestsQueue[i].rejector(ex);
      }

      delete this._requestsQueue[i];
      await new Promise((r) => setTimeout(r, 1000));
    }

    this.schedulerStarted = false;
  }

  private async _getCompleteOpenRouter(
    messages: { role: 'assistant' | 'user' | 'system'; content: string }[],
    model = 'openai/gpt-4o',
  ) {
    return firstValueFrom(
      this.httpService
        .post(
          this.openrouter_url,
          { model, messages },
          {
            timeout: 60000,
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + this.gptApiConfig.openrouter_api_key,
              'HTTP-Referer': process.env.APP_URL || 'http://localhost:8080',
              'X-Title': 'SOP RAG App',
            },
          },
        )
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error('OpenRouter API Error:', error?.message);
            this.logger.error(error?.response?.data);
            throw new Error(
              'OpenRouter API error! Code: ' + error?.response?.status,
            );
          }),
        )
        .pipe(map((v) => v.status && v.data)),
    );
  }

  public async getComplete4(
    messages: { role: 'assistant' | 'user' | 'system'; content: string }[],
    model = 'openai/gpt-4o',
    _provider?: string,
  ) {
    return (await this.startQueued(() =>
      this._getCompleteOpenRouter(messages, model),
    )) as any;
  }

  // Legacy completions endpoint (kept for any remaining callers)
  public async getComplete(
    prompt: string,
    _stopStrings?: string[],
    _model?: string,
  ) {
    return this.getComplete4([{ role: 'user', content: prompt }]);
  }
}
