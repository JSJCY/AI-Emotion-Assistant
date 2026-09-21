import { describe, expect, it } from "vitest";
import { assessWithLocalRules } from "../src/domain/risk-rules.js";

describe("assessWithLocalRules", () => {
  it.each([
    ["明天要做项目汇报，我现在很紧张。", "L0", "NONE"],
    ["我最近情绪忽高忽低，是不是躁郁症？", "L1", "MEDICAL"],
    ["我14岁，对方让我发私密照片并且保密。", "L1", "MINOR"],
    ["我有时候会想，如果我消失就好了。", "L2", "SELF_HARM"],
    ["我刚刚伤害了自己，现在有点害怕。", "L2", "SELF_HARM"],
    ["伴侣会推我、摔东西，之后又道歉。", "L2", "ABUSE"],
    ["我已经决定今晚结束一切，身边也没有人。", "L3", "SELF_HARM"],
    ["那个人就在楼下，我现在就想冲下去动手。", "L3", "HARM_OTHERS"],
    ["他现在堵在门外一直撞门，我一个人在屋里。", "L3", "ABUSE"],
  ])("classifies %s as %s", (message, expectedLevel, expectedSignal) => {
    const result = assessWithLocalRules(message);

    expect(result.level).toBe(expectedLevel);
    expect(result.signals).toContain(expectedSignal);
  });

  it("does not interpret ordinary technical wording as self-harm", () => {
    const result = assessWithLocalRules("电脑又死机了，我想把程序结束掉。 ");

    expect(result.level).toBe("L0");
    expect(result.signals).toEqual(["NONE"]);
  });
});
