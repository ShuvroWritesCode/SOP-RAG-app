import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

@Injectable()
export class AuthedWithBot implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler<any>) {
    // In RAG mode there are no bot/assistant IDs — pass through
    return next.handle();
  }
}
