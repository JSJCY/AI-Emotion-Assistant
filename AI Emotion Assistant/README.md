# AI Emotion Assistant — MVP Backend

安全优先的 TypeScript 后端。目前完成 Phase 1：工程骨架、确定性风险规则、固定安全响应和自动测试。真实百炼模型与 SQLite 将在下一增量接入。

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

默认监听 `http://127.0.0.1:3000`。

## 接口

- `GET /health`：进程存活检查。
- `GET /ready`：模型与事件存储依赖检查；Phase 1 预期返回 503。
- `POST /api/v1/respond`：情绪支持请求入口。

请求示例：

```json
{
  "message": "今天开会时我被否定了，很难受。",
  "context": [],
  "preferred_strategy": "listen"
}
```

Phase 1 行为：

- 本地规则命中 L2/L3 或未成年人高风险边界时，返回服务端固定安全响应。
- 其他输入因为独立风险分类器尚未接入，返回 `503 SAFETY_CLASSIFIER_UNAVAILABLE`。
- 这是 fail-closed 行为，不是故障降级文案。

## 质量命令

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

## 安全约束

- 不在客户端或 Git 中保存 `DASHSCOPE_API_KEY`。
- 日志不记录消息正文、上下文、Authorization 或 Cookie。
- 普通生成必须经过独立风险分类和输出审核。
- L2/L3 安全流程不得依赖主生成模型。
- `.env`、数据库、构建产物和覆盖率文件均被 Git 忽略。

