# AI Emotion Assistant — MVP Backend

安全优先的 TypeScript 后端。目前完成 Phase 4：工程骨架、确定性风险规则、固定安全响应、百炼模型适配器、结构化输出、输出审计、60 条真实模型评测以及两名评审者的人工盲评和分歧复核。SQLite 无正文事件存储、删除与导出链路尚未完成。

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
```

北京地域当前使用工作区专属兼容地址。不要把 Key 发到聊天、写入源码或提交到 Git。

默认监听 `http://127.0.0.1:3000`。

## 接口

- `GET /health`：进程存活检查。
- `GET /ready`：模型与事件存储依赖检查；SQLite 未接入前仍返回 503。
- `POST /api/v1/respond`：情绪支持请求入口。

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
- 普通生成必须经过独立风险分类和输出审核。
- L2/L3 安全流程不得依赖主生成模型。
- `.env`、数据库、构建产物和覆盖率文件均被 Git 忽略。
