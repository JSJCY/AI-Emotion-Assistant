import { describe, expect, it } from "vitest";
import type { GeneratedContent } from "../src/domain/response.js";
import { DeterministicOutputAuditor } from "../src/infrastructure/deterministic-output-auditor.js";

function content(overrides: Partial<GeneratedContent> = {}): GeneratedContent {
  return {
    strategy: "listen",
    acknowledgement: "被当众否定让你很难受。",
    known_facts: ["你说今天开会时被否定。"],
    unverified_inferences: [],
    question: "你想先继续说说，还是一起想下一步？",
    artifact: {
      type: "none",
      content: { title: null, body: null, steps: [] },
    },
    safety_action: "NONE",
    ...overrides,
  };
}

describe("DeterministicOutputAuditor", () => {
  const auditor = new DeterministicOutputAuditor();

  it("allows a bounded empathetic response", async () => {
    await expect(auditor.audit(content())).resolves.toEqual({ safe: true, signals: [] });
  });

  it("blocks definitive diagnosis", async () => {
    const result = await auditor.audit(content({ acknowledgement: "你患有抑郁症。" }));

    expect(result.safe).toBe(false);
    expect(result.signals).toContain("MEDICAL");
  });

  it("blocks exclusive dependency language", async () => {
    const result = await auditor.audit(content({ acknowledgement: "只有我懂你，不要再找别人。" }));

    expect(result.safe).toBe(false);
    expect(result.signals).toContain("DISTRESS");
  });

  it("blocks phone numbers from generated content", async () => {
    const result = await auditor.audit(content({ question: "请联系 13800000000。" }));

    expect(result.safe).toBe(false);
  });

  it("allows a direct refusal that names the prohibited act", async () => {
    const result = await auditor.audit(
      content({ acknowledgement: "我不能帮你写公开羞辱对方的内容。" }),
    );

    expect(result.safe).toBe(true);
  });

  it("allows a question that explicitly redirects away from manipulation", async () => {
    const result = await auditor.audit(
      content({ question: "除了让对方因为内疚而答应，你真正希望对方理解什么？" }),
    );

    expect(result.safe).toBe(true);
  });

  it("still blocks unsafe advice after a refusal clause", async () => {
    const result = await auditor.audit(
      content({ acknowledgement: "我不能替你决定，但你可以让对方因为内疚而答应。" }),
    );

    expect(result.safe).toBe(false);
    expect(result.signals).toContain("HARM_OTHERS");
  });

  it("allows a prohibited request to be recorded only as a user-provided fact", async () => {
    const result = await auditor.audit(
      content({ known_facts: ["用户希望发布一条公开羞辱前任的朋友圈。"] }),
    );

    expect(result.safe).toBe(true);
  });

  it("blocks the same prohibited language when it appears in an actionable artifact", async () => {
    const result = await auditor.audit(
      content({
        artifact: {
          type: "expression_draft",
          content: { title: "草稿", body: "发这段话公开羞辱对方。", steps: [] },
        },
      }),
    );

    expect(result.safe).toBe(false);
    expect(result.signals).toContain("HARM_OTHERS");
  });
});
