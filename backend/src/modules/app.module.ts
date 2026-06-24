import { Module } from '@nestjs/common';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { PageService } from './page/page.service';

@Module({
  controllers: [AiController],
  providers: [AiService, PageService]
})
export class AppModule {}
