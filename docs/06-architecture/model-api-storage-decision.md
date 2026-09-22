# MVP 模型、API 与存储方案

> ADR：ADR-001  
> 状态：Accepted for MVP v0.3
> 日期：2026-09-21  
> 复核触发：模型、价格、地域、数据政策、安全策略或评测结果变化

## 1. 决策摘要

| 层 | MVP 选择 | 说明 |
|---|---|---|
| 生成模型 | `qwen3.7-plus-2026-05-26` | 固定快照；非思考模式；生成对话和结果卡 |
| 风险分类 | `qwen3.7-plus-2026-05-26` | 固定快照；非思考模式；只输出风险结构，不生成用户回复 |
| API | 阿里云百炼北京地域工作区专属 OpenAI 兼容 Chat Completions | 服务端 HTTP 调用；Base URL 从部署秘密配置读取 |
| 输出约束 | `response_format.type=json_schema`、`strict=true` | 分类与生成分别使用独立 Schema |
| 服务端内容存储 | 默认不保存对话正文 | 当前会话上下文由客户端随请求发送 |
| 用户主动保存 | 浏览器 IndexedDB，仅保存经确认的结果卡 | 不默认保存完整会话 |
| 运营数据 | 服务端 SQLite | 只存匿名事件、版本、耗时、Token 和风险类别，不存正文 |
| 向量库/RAG | 不进入 MVP | 当前任务不需要知识检索，避免扩大数据面和复杂度 |

## 2. 为什么选这个组合

### 2.1 生成模型

首版选择 `qwen3.7-plus-2026-05-26`，原因：

- 面向中国大陆部署，调用链和结算更直接。
- 阿里云官方把 Qwen3.7-Plus 定位为能力与成本均衡的文本生成选择。
- 支持严格 JSON Schema，适合把事实、推测、问题和结果卡拆成确定字段。
- 固定快照避免 `latest` 或系列别名静默升级，便于复现实验和回滚。
- MVP 只处理短文本，不需要 100 万上下文，也不启用联网搜索、工具调用或思考模式。

生成参数基线：

```text
model=qwen3.7-plus-2026-05-26
enable_thinking=false
temperature=0
max_completion_tokens=700
response_format=json_schema(strict=true)
timeout=12s
retry=1（只对网络错误、限流或 5xx）
```

### 2.2 风险分类

使用 `qwen3.7-plus-2026-05-26` 承担独立风险分类：

- 支持结构化输出。
- 与生成 Prompt 分离，主模型不能通过角色指令关闭分类器。
- 固定版本便于计算 L0–L3 混淆矩阵和变更回归。
- 真实 A/B 定向回归中，Flash 的边界等级和信号码一致性弱于 Plus；MVP 内测优先选择已通过安全门禁的 Plus。
- 风险分类和生成仍使用独立调用、独立 Prompt 与独立 Schema；使用相同模型快照不等于合并职责。

分类器不是唯一安全控制。有效风险等级取以下结果的最高等级：

```text
max(本地高风险规则, 风险分类模型, 输出审核)
```

规则命中 L2/L3 时直接进入受控安全流程，不等待普通生成。

### 2.3 暂不选的方案

| 方案 | 暂不作为主链路的原因 | 保留用途 |
|---|---|---|
| OpenAI `gpt-5.6-terra` / `gpt-5.6-luna` | 美元计费、跨境调用和数据治理需要单独评审；不是中国大陆 MVP 的最短路径 | 20 条去敏样例的离线质量对照 |
| DeepSeek `deepseek-v4-pro` / `deepseek-flash` | 成本和兼容性优秀，但首版不同时维护第二供应商；JSON 模式文档提示存在空内容等边界情况 | 主模型故障或成本变化后的候选 |
| `qwen3.8-max` | 质量更高但首版没有证据证明必须承担更高成本 | 对困难/安全样例做离线基准 |
| 单一主模型同时分类与生成 | 同源误判、Prompt 注入和错误传播风险较高 | 不采用 |

## 3. API 调用链

```text
浏览器输入
  → 客户端空值/长度/敏感信息提醒
  → POST /api/v1/respond
  → 服务端规则分类
  → qwen3.7-plus 风险分类（严格 JSON）
  ├─ L2/L3 → 固定安全动作代码 → 固定模板
  └─ L0/L1 → qwen3.7-plus 结构化生成
               → Zod/JSON Schema 校验
               → 输出风险审核
               → 返回可渲染对象
```

### 3.1 风险分类 Schema

```json
{
  "risk_level": "L0|L1|L2|L3",
  "signal_codes": ["SELF_HARM", "HARM_OTHERS", "ABUSE", "MEDICAL", "DELUSION", "MINOR", "NONE"],
  "immediate_danger": false,
  "needs_fixed_safety_flow": false,
  "confidence": 0.0
}
```

服务端必须重新校验枚举和数值范围；模型给出的 `confidence` 只用于分析，不能覆盖规则。

### 3.2 生成 Schema

```json
{
  "version": "response-v1",
  "strategy": "listen|clarify|express|act",
  "acknowledgement": "string",
  "known_facts": ["string"],
  "unverified_inferences": ["string"],
  "question": "string|null",
  "artifact": {
    "type": "none|situation_card|expression_draft|action_card",
    "content": {}
  },
  "safety_action": "NONE|SHOW_PRO_SUPPORT|ASK_IMMEDIATE_DANGER|SHOW_EMERGENCY_CN"
}
```

前端只渲染通过 Schema 与安全审核的字段，不显示原始模型文本或推理过程。

### 3.3 API 边界

- `POST /api/v1/respond`：唯一模型入口；限长、限频、验证策略与上下文。
- `POST /api/v1/feedback`：只传结果 ID、评分和原因枚举；默认不带正文。
- `GET /api/v1/events/export`：根据已脱敏的 `x-anonymous-id` 请求头导出该标识关联的服务端事件元数据。
- `DELETE /api/v1/events`：根据 `x-anonymous-id` 请求头删除关联事件元数据并返回回执。不把匿名标识放入 URL，避免进入常规访问日志。
- `GET /api/v1/public-config`：返回模型展示名、策略版本、隐私版本和求助资源版本，不返回秘密。
- API Key 只存在服务端环境变量 `DASHSCOPE_API_KEY`；浏览器和 Git 仓库均不得出现。
- 北京地域兼容地址使用 `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；工作区 ID 与 API Key 均通过本地 `.env` 或部署秘密注入。

## 4. 存储决策

### 4.1 客户端

| 数据 | 默认位置 | 保留规则 |
|---|---|---|
| 当前会话消息 | 内存 | 刷新/关闭后清除 |
| 未提交输入 | 内存；可选 `sessionStorage` | 标签页关闭后清除 |
| 用户确认保存的结果卡 | IndexedDB | 用户可查看、导出、删除 |
| 完整会话 | 默认不保存 | 后续版本需重新征得同意 |
| 匿名安装标识 | IndexedDB | 随“删除全部数据”一并清除并重新生成 |

不使用 `localStorage` 保存对话正文。IndexedDB 并不等于独立加密保险箱；共享设备用户仍可能访问浏览器数据，因此界面必须提供提示。

### 4.2 服务端 SQLite

SQLite 只承担 MVP 的最小运营与审计元数据：

- `feedback_events`：匿名 ID、结果类型、评分、原因枚举、版本、时间。
- `safety_events`：匿名 ID、L0–L3、信号代码、采取的安全动作、版本、时间；不存原文。
- `request_metrics`：请求 ID、模型、Prompt 版本、耗时、Token、状态码、Schema 是否通过。
- `deletion_receipts`：匿名 ID 哈希、删除范围、完成时间，用于验证删除动作。

配置：单实例 SQLite + WAL + 版本化迁移；每日加密备份只包含上述元数据。进入多实例或需要账号同步时迁移 PostgreSQL，不改变 API 数据模型。

当前已实现 SQLite、WAL、版本化迁移、哈希归属、导出、删除和删除回执。加密备份和备份删除生命周期仍待部署环境验证。

### 4.3 模型供应商日志

- 百炼默认审计日志记录请求元数据，不包含 Prompt/Response。
- MVP 不开启记录完整 Prompt/Response 的推理日志，也不启用日志回流训练。
- 如果排查问题必须临时采样正文，需要单独审批、明确比例与到期时间，并先去标识化。
- 人工核验记录：2026-09-22，评审人森雨确认当前北京业务空间的完整 Prompt/Response 推理日志未开启。

## 5. 成本基线

早期方案按 Flash 分类 + Plus 生成估算；真实评测后分类器已切换为 Plus，因此原 `0.008 元/轮` 假设不再作为当前成本结论。

- 分类：2,000 输入 Token + 100 输出 Token，使用 Plus。
- 生成：2,000 输入 Token + 400 输出 Token，使用 Plus。

当前客户端尚未汇总供应商 usage 字段，实际 Token 与单轮费用仍待下一阶段补齐监控后测量；在此之前不对外宣称真实成本。

## 6. 真实模型验证结果

- 北京业务空间专属 Base URL、API Key、严格 JSON Schema 和非思考模式已完成真实调用验证。
- 风险分类与生成均固定为 `qwen3.7-plus-2026-05-26`，生成温度为 `0`。
- `v0.3` 的 60 条合成集完成三轮固定配置复跑：三轮均为高风险 20/20、L0 危机误升级 0/22、红队 6/6、P0 为 0、Schema 与输出审计 60/60。
- 路由匹配分别为 59/60、60/60、60/60；首轮唯一偏差为模糊低动力表达从 L0 保守升至 L1，不属于危机升级。
- 两名评审者已完成 120 份单条八维人工评分与 7 条分歧复核；P0 为 0，合并加权均分 96.18/100，人工质量门槛通过。结果见 `../07-implementation/mvp-phase-4-human-review-report.md`。

## 7. 发布前必须验证

- 固定版本模型能否在当前百炼账号和北京地域调用。
- `json_schema + strict=true + enable_thinking=false` 的实际返回兼容性。
- Prompt/Response 推理日志已确认未开启（2026-09-22，评审人：森雨）；配置变化后必须重新核验。
- API Key 仅服务端可见，错误信息不回显请求正文。
- SQLite 中不存在 `message_text`、`prompt`、`response` 等原文列。
- 删除 IndexedDB、事件元数据和备份生命周期均有可复现测试。
- 60 条基线集全部运行；P0 安全失败数必须为 0。

## 8. 来源与时效

检查日期：2026-09-21。模型和价格可能变化，进入实现前再次核对控制台。

- [阿里云百炼：文本生成模型](https://help.aliyun.com/zh/model-studio/text-generation-model)
- [阿里云百炼：模型价格](https://help.aliyun.com/en/model-studio/model-pricing)
- [阿里云百炼：结构化输出](https://help.aliyun.com/en/model-studio/qwen-structured-output)
- [阿里云百炼：OpenAI 兼容 Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)
- [阿里云百炼：监控、审计日志与推理日志](https://help.aliyun.com/zh/model-studio/model-telemetry)
- [OpenAI Docs：当前模型选择](https://developers.openai.com/api/docs/models)
- [OpenAI Docs：API 数据控制](https://developers.openai.com/api/docs/guides/your-data)
- [DeepSeek API：模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)
- [DeepSeek API：JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
