import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  buildPrompt(userPrompt: string, tokens: Record<string, unknown>) {
    return `
你是企业设计系统生成器。

【设计规范】
${JSON.stringify(tokens, null, 2)}

【规则】
1. 不允许自由发挥 UI
2. 只能使用组件库中的组件
3. 所有组件必须包含 type 字段
4. 必须嵌套在 container 中
5. 输出 JSON，不要解释

【组件白名单】
button, table, form, input, card, modal, stats

【需求】
${userPrompt}
`;
  }

  async generate(prompt: string, tokens: Record<string, unknown>) {
    return {
      prompt: this.buildPrompt(prompt, tokens),
      mock: true,
      result: {
        type: 'page',
        layout: [
          {
            type: 'container',
            props: { title: 'AI Generated Container' },
            children: [
              {
                type: 'stats',
                items: [
                  { label: '待处理', value: '18' },
                  { label: '已完成', value: '42' }
                ]
              }
            ]
          }
        ]
      }
    };
  }
}
