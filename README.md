# AI Emotion Assistant

AI Emotion Assistant 是一个面向日常情绪压力场景的 AI 表达与行动支持产品项目。当前处于用户与产品定义阶段，所有结论均区分“桌面研究得出的假设”和“经真实用户验证的结论”。

## 目录约定

- `AI Emotion Assistant/`：后续应用代码，当前不放研究和产品文档。
- `docs/01-research/`：目标人群、场景、竞品和安全研究。
- `docs/02-product/`：PRD和产品决策。
- `docs/03-flows/`：用户流程和异常分支。
- `docs/04-design/`：Figma 原型说明、链接与验收记录。
- `docs/05-validation/`：用户访谈、原型测试和评测计划。
- `docs/06-architecture/`：模型、API、存储和技术决策。
- `AI Emotion Assistant/evals/`：随代码版本管理的合成测试集与评分规则。

## 当前交付状态

1. 目标人群与核心场景：桌面研究版已定义，待用户访谈验证。
2. 竞品/替代方案与安全风险：桌面研究版已完成。
3. PRD 和用户流程：v0.1 已完成，并完成结构与流程图基础检查。
4. Figma 可交互原型：Version 1 已完成；原型遗留问题已由产品负责人确认修正，关闭记录和仍需补证的可访问性测试见 `docs/04-design/figma-delivery-and-qa-result.md`。
5. MVP 技术决策：已确认模型/API/存储方案；60 条合成评测集、评分标准与内测门槛已建立。
6. MVP 后端 Phase 1—2：TypeScript/Fastify 工程骨架、确定性安全链路、百炼双模型适配、严格 JSON Schema、输出审核和评测 runner 已完成。
7. MVP 后端 Phase 3：固定模型快照已完成三轮 60 条真实调用稳定性验证；自动安全门禁通过，详见 `docs/07-implementation/mvp-phase-3-model-validation-report.md`。
8. MVP 后端 Phase 4：进入两名评审独立人工盲评；评分完成前不宣称达到 MVP 内测发布门槛。
