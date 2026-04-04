import { Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AiModelsService } from './ai-models.service';

@Controller('ai-models')
@UseGuards(JwtAuthGuard)
export class AiModelsController {
  constructor(private readonly aiModelsService: AiModelsService) {}

  @Get()
  async getAll() {
    const models = await this.aiModelsService.getAll();
    return { status: true, data: models };
  }

  @Put(':id/activate')
  async activate(@Param('id') id: string) {
    await this.aiModelsService.setActive(id);
    return { status: true };
  }
}
