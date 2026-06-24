import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  async generate(@Body() body: { prompt: string; tokens: Record<string, unknown> }) {
    return this.aiService.generate(body.prompt, body.tokens);
  }
}
