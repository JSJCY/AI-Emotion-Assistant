# AI Emotion Assistant — MVP Backend

安全优先的 TypeScript 后端。目前完成 Phase 5 服务端数据生命周期：固定模型与安全链路、自动与人工评测、SQLite 无正文事件存储、匿名标识哈希、元数据导出、删除回执和日志脱敏。浏览器 IndexedDB 结果卡与备份生命周期验证尚未完成。

## 环境

- Node.js 24+
- npm 11+

## 本地运行

```powershell
Copy-Item .env.example .env
npm install
npm run check
npm run dev
```

在启用百炼前，编辑本机 `.env`：

```env
MODEL_PROVIDER=dashscope
DASHSCOPE_API_KEY=你的百炼APIKey
DASHSCOPE_BASE_URL=https://你的工作区ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
DASHSCOPE_RISK_MODEL=qwen3.7-plus-2026-05-26
DASHSCOPE_GENERATION_MODEL=qwen3.7-plus-2026-05-26
EVENT_STORE=sqlite
EVENT_DB_PATH=./data/ai-emotion-assistant.db
```

北京地域当前使用工作区专属兼容地址。不要把 Key 发到聊天、写入源码或提交到 Git。`EVENT_STORE=sqlite` 用于启用本地 SQLite；数据库目录会自动创建，并已被 Git 忽略。

默认监听 `http://127.0.0.1:3000`。

## 接口

- `GET /health`：进程存活检查。
- `GET /ready`：实时检查模型与 SQLite 事件存储；任一依赖未就绪时返回 503。
- `POST /api/v1/respond`：情绪支持请求入口；可通过 `x-anonymous-id` 传入 UUID，用于匿名元数据归属。
- `GET /api/v1/events/export`：导出该匿名标识的服务端事件元数据，必须提供 `x-anonymous-id`。
- `DELETE /api/v1/events`：删除该匿名标识的事件元数据并返回删除回执，必须提供 `x-anonymous-id`。

请求示例：

```json
{
  "message": "今天开会时我被否定了，很难受。",
  "context": [],
  "preferred_strategy": "listen"
}
```

当前行为：

- 本地规则命中 L2/L3 或未成年人高风险边界时，返回服务端固定安全响应。
- `MODEL_PROVIDER=disabled` 时，其他输入返回 `503 SAFETY_CLASSIFIER_UNAVAILABLE`。
- `MODEL_PROVIDER=dashscope` 时，其他输入依次调用独立风险分类和主生成模型，并经过运行时 Schema 与输出审核。
- 供应商超时、认证失败和无效响应只返回稳定错误码，不回显供应商响应正文。

### 匿名标识与数据操作

客户端使用随机 UUID 作为匿名标识。服务端只保存 SHA-256 哈希，不保存原始 UUID。本地 PowerShell 可用以下方式测试：

```powershell
$anonymousId = [guid]::NewGuid().ToString()
$headers = @{ "x-anonymous-id" = $anonymousId }
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3000/api/v1/events/export" -Headers $headers
Invoke-RestMethod -Method Delete -Uri "http://127.0.0.1:3000/api/v1/events" -Headers $headers
```

知道该 UUID 的调用方可导出或删除关联元数据。这适用于当前无登录、小范围内测，不等于公网身份认证方案。

## 质量命令

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

填好本机 `.env` 后，按顺序运行真实测试：

```powershell
npm run test:live-model
npm run eval:live
```

`test:live-model` 只运行两个合成冒烟案例。确认通过后再运行当前 `v0.3` 的 60 条评测；评测报告写入 `evals/results/`，该目录不会提交到 Git。当前固定配置已完成三轮自动化稳定性验证，并完成两名评审者的 120 份单条人工评分与 7 条分歧复核。人工加权均分为 96.18/100，P0 为 0，8 个维度均分均达标。

## 安全约束

- 不在客户端或 Git 中保存 `DASHSCOPE_API_KEY`。
- 日志不记录消息正文、上下文、Authorization 或 Cookie。
- 日志对 `x-anonymous-id` 执行脱敏；SQLite 不存在消息、Prompt、Response 或上下文列。
- 普通生成必须经过独立风险分类和输出审核。
- L2/L3 安全流程不得依赖主生成模型。
- `.env`、数据库、构建产物和覆盖率文件均被 Git 忽略。
