# MVP Phase 2 实施与验收报告

> 日期：2026-09-21  
> 状态：代码完成；真实供应商验证待本机凭据  
> 范围：百炼客户端、双模型适配、结构化输出、输出审核与评测 runner

> 历史说明：本文记录 Phase 2 完成时的状态。真实供应商验证与三轮自动化评测已在后续 Phase 3 完成，当前结论以 `mvp-phase-3-model-validation-report.md` 为准。

## 1. 实施内容

- 根据阿里云当前文档改用北京地域工作区专属 OpenAI 兼容 Base URL。
- 使用 Node.js 原生 `fetch` 实现服务端客户端，不增加供应商 SDK 依赖。
- 统一设置非思考模式、严格 JSON Schema 和 `max_completion_tokens`。
- 实现 12 秒超时、仅对网络/超时/429/5xx 最多一次重试。
- 对认证失败、超时、供应商不可用和无效输出返回稳定错误码，不回显供应商响应正文。
- 风险分类与主生成使用独立模型、Prompt 和 Schema。
- 供应商 JSON Schema 之后再次执行 Zod 运行时校验和确定性输出审核。
- 新增两个合成案例的真实模型冒烟脚本和 60 条评测 runner。

## 2. 配置边界

真实凭据只允许放在本地 `.env` 或部署秘密：

```env
MODEL_PROVIDER=dashscope
DASHSCOPE_API_KEY=本机秘密
DASHSCOPE_BASE_URL=https://工作区ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

`.env` 和 `evals/results/` 已被 Git 忽略。应用日志不记录消息正文、上下文、Authorization 或 Cookie。

## 3. 当前验收

- 模拟供应商单元与端到端 HTTP 测试：已实现。
- 本地自动测试：10 个测试文件、40 个测试全部通过。
- 配置缺失、占位工作区 ID、认证错误和无效 JSON：均有回归测试。
- 本地 L2/L3 固定安全路径：继续在模型调用前短路。
- 完整静态检查、类型检查、测试和构建：见本阶段最终执行记录。

## 4. 待凭据验证

1. 当前账号是否有两个固定模型版本权限；
2. 工作区专属 Base URL 与 Key 是否属于相同北京地域工作区；
3. 严格 JSON Schema 和非思考模式的真实返回；
4. 两个合成冒烟案例的路由、延迟和错误码；
5. 60 条全量评测、三次稳定性复跑和人工评分；
6. 实际 Token 与费用。

在上述结果完成前，项目状态保持“进行中 / 部分成功”，不能写成模型接入已验证。

## 5. 后续顺序

1. 用户在本机 `.env` 填入 Key 和工作区 Base URL；
2. 执行 `npm run test:live-model`；
3. 冒烟通过后执行 `npm run eval:live`；
4. 对自动结果完成双人盲评和分歧复核；
5. 修复失败案例并复跑 3 次；
6. 再进入 SQLite 无正文事件存储与删除链路实现。
