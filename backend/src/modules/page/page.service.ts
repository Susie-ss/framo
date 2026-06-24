import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PageService {
  constructor(private readonly aiService: AiService) {}

  async createPage(projectId: string, prompt: string, tokens: Record<string, unknown>) {
    const generation = await this.aiService.generate(prompt, tokens);

    return {
      id: 'mock-page-id',
      projectId,
      prompt,
      layout: generation.result
    };
  }
}
