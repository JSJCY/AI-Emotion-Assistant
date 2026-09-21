# 后端代码架构 v0.1

> 状态：Accepted  
> 日期：2026-09-21  
> 首个实现增量：工程骨架、确定性风险规则、固定安全响应与自动测试

## 1. 架构选择

MVP 使用 TypeScript 模块化单体，并采用六边形架构约束依赖方向：

```text
interfaces/http
    ↓
application/use-cases
    ↓
domain
    ↑
ports ← infrastructure/adapters
```

核心原则：

1. `domain` 只包含业务类型、风险规则和安全策略，不依赖 Fastify、模型 SDK 或数据库。
2. `application` 负责流程编排，通过 Port 使用外部能力。
3. `infrastructure` 实现百炼、SQLite 等适配器；更换供应商不修改领域规则。
4. `interfaces/http` 只做输入校验、状态码映射和响应序列化。
5. 安全规则和固定响应优先于生成模型；外部风险分类不可用时，普通生成采用 fail-closed。

## 2. 请求链路

```text
POST /api/v1/respond
  → Zod 输入校验与长度限制
  → 本地确定性风险规则
  ├─ L2/L3：固定安全响应，不调用主生成模型
  └─ L0/L1：独立风险分类器
       ├─ L2/L3：固定安全响应
       └─ L0/L1：主生成模型 → Schema 校验 → 输出审计
  → 仅记录无正文事件元数据
```

本增量只实现实线可验证的本地安全链路和接口边界。百炼适配器与 SQLite 在下一增量实现；在此之前，普通生成明确返回依赖未配置错误，不用占位文本伪装模型能力。

## 3. 目录职责

```text
src/
  domain/           风险等级、信号、纯规则、安全策略
  application/      用例、Port、应用错误
  infrastructure/   外部系统适配器与配置
  interfaces/http/  Fastify 应用、路由、Schema、错误映射
  server.ts         进程入口
test/               单元、用例和 HTTP 契约测试
evals/              版本化离线评测集
```

禁止反向依赖：领域层不能导入 `fastify`、`zod`、数据库或厂商 SDK。

## 4. 运行与质量门禁

- Node.js 24 LTS 兼容运行时。
- TypeScript 严格模式，不允许隐式 `any`。
- Fastify 提供 HTTP 生命周期和注入测试。
- Zod 负责运行时输入与配置校验。
- Vitest 负责单元及 HTTP 契约测试。
- Biome 负责格式和静态检查。
- `npm run check` 必须依次通过格式/静态检查、类型检查、测试和构建。

## 5. 错误和日志契约

- 所有可预期错误使用稳定 `code`，不把堆栈或供应商原文返回给客户端。
- 日志不得记录请求正文、上下文、Authorization 或 API Key。
- 每次响应包含请求 ID；事件只保存请求 ID、风险级别、动作码、版本和耗时。
- 风险分类器不可用时，L0/L1 返回 `503 SAFETY_CLASSIFIER_UNAVAILABLE`；本地命中的 L2/L3 仍可返回固定安全响应。

## 6. 当前非目标

- 账号、登录、跨设备同步和完整对话历史。
- RAG、向量数据库、Agent 工具调用和联网搜索。
- 医疗诊断、治疗建议或自动联系第三方。
- 在没有评测结果前开放公众访问。

