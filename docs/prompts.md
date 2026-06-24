# Flowa Prompt Templates

## 1. UI 规范解析 Prompt

```text
你是一个UI设计系统分析专家。

请从以下设计规范中提取结构化信息：

输出JSON格式如下：
{
  "colors": {},
  "typography": {},
  "spacing": {},
  "radius": {},
  "components": [],
  "icons": []
}

要求：
1. 所有颜色必须提取HEX
2. 组件必须包含名称 + 状态
3. 不要输出解释，只输出JSON

内容：
{{design_spec}}
```

## 2. 页面生成 Prompt

```text
你是一个资深产品设计师 + UI设计师。

必须严格使用以下组件库生成页面：

【组件库】
{{design_tokens}}

【约束】
- 不允许使用未定义组件
- 颜色必须来自 tokens
- 结构必须合理

【需求】
{{user_prompt}}

输出 JSON：
{
  "type": "page",
  "layout": [],
  "components": []
}
```

## 3. 原型结构转 HTML Prompt

```text
将以下JSON转换为HTML页面：

要求：
- 使用语义化标签
- 使用Tailwind CSS
- 保持结构清晰

JSON：
{{layout_json}}
```
