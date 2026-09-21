import type { RiskAssessment, RiskLevel, SignalCode } from "./risk.js";

interface Rule {
  readonly level: RiskLevel;
  readonly signal: SignalCode;
  readonly immediateDanger: boolean;
  readonly patterns: readonly RegExp[];
}

const RULES: readonly Rule[] = [
  {
    level: "L3",
    signal: "SELF_HARM",
    immediateDanger: true,
    patterns: [
      /(?:已经决定|正在准备|马上|现在就|今晚).{0,16}(?:结束一切|伤害自己|不想活|无法挽回)/u,
      /(?:结束一切|伤害自己).{0,16}(?:马上|现在|今晚)/u,
    ],
  },
  {
    level: "L3",
    signal: "HARM_OTHERS",
    immediateDanger: true,
    patterns: [
      /(?:现在就|马上|已经|正在).{0,18}(?:冲下去动手|去找.{0,8}动手|伤害(?:他|她|别人)|打(?:他|她|人))/u,
      /(?:就在楼下|在去找.{0,8}的路上).{0,20}(?:动手|教训|伤害)/u,
      /已经带着东西.{0,16}(?:去找|在去找)(?:他|她|对方)/u,
    ],
  },
  {
    level: "L3",
    signal: "ABUSE",
    immediateDanger: true,
    patterns: [/(?:堵在门外|正在撞门|现在.{0,8}(?:打我|威胁我)|被困在)/u],
  },
  {
    level: "L3",
    signal: "DISTRESS",
    immediateDanger: true,
    patterns: [/(?:我现在|目前).{0,8}(?:有立即危险|处于立即危险)/u],
  },
  {
    level: "L2",
    signal: "SELF_HARM",
    immediateDanger: true,
    patterns: [/(?:刚刚|刚才).{0,8}伤害了?自己/u],
  },
  {
    level: "L2",
    signal: "SELF_HARM",
    immediateDanger: false,
    patterns: [
      /(?:消失就好了|不想活|伤害了?自己|坚持不到明天|结束一切|无法挽回)/u,
      /(?:用疼痛|让自己疼).{0,12}(?:平静|好受)/u,
    ],
  },
  {
    level: "L2",
    signal: "HARM_OTHERS",
    immediateDanger: false,
    patterns: [
      /(?:想让.{0,12}付出代价|控制不住.{0,12}(?:打|伤害)|想去教训|想动手)/u,
      /(?:假装|角色扮演).{0,16}支持我.{0,8}(?:去)?教训/u,
    ],
  },
  {
    level: "L2",
    signal: "DELUSION",
    immediateDanger: false,
    patterns: [/(?:三天|连续几天).{0,8}没睡.{0,20}(?:全部存款|重大转账|高风险投资)/u],
  },
  {
    level: "L2",
    signal: "ABUSE",
    immediateDanger: false,
    patterns: [
      /(?:推我|打我|摔东西|收走.{0,12}(?:钱|证件)|不让我.{0,10}出门)/u,
      /(?:不接受|拒绝).{0,12}(?:私人要求|私下要求).{0,16}(?:不过|开除|报复)/u,
    ],
  },
  {
    level: "L1",
    signal: "MINOR",
    immediateDanger: false,
    patterns: [
      /(?:我(?:是|今年)?\s*(?:1[0-7]|[6-9])\s*岁|我是未成年人)/u,
      /(?:未成年人|孩子).{0,20}(?:私密照片|保密|没人的地方)/u,
    ],
  },
  {
    level: "L1",
    signal: "DELUSION",
    immediateDanger: false,
    patterns: [
      /(?:能读到我的想法|电视.{0,10}给我.{0,6}指令|摄像头.{0,12}针对我)/u,
      /(?:三天|连续几天).{0,8}没睡.{0,14}(?:不需要睡|伟大计划)/u,
    ],
  },
  {
    level: "L1",
    signal: "MEDICAL",
    immediateDanger: false,
    patterns: [
      /(?:是不是|肯定是|诊断).{0,12}(?:躁郁症|抑郁症|焦虑症|心理问题)/u,
      /(?:停药|改剂量|医生开的药|胸口闷|喘不过气|心跳很快)/u,
    ],
  },
  {
    level: "L1",
    signal: "DISTRESS",
    immediateDanger: false,
    patterns: [
      /(?:持续|已经).{0,8}(?:一个月|几个月|好几个星期).{0,18}(?:受影响|撑不住|不想和任何人说话)/u,
      /(?:每天都在哭|逃了三次课|工作也一直出错|快撑不住)/u,
      /(?:状态很差.{0,20}(?:咨询|专业帮助)|预约心理咨询|筛选咨询师)/u,
    ],
  },
];

function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}

export function assessWithLocalRules(text: string): RiskAssessment {
  const normalized = normalize(text);
  const matches = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(normalized)));

  if (matches.length === 0) {
    return {
      level: "L0",
      signals: ["NONE"],
      immediateDanger: false,
      source: "local_rules",
    };
  }

  const priority: Readonly<Record<RiskLevel, number>> = { L0: 0, L1: 1, L2: 2, L3: 3 };
  const level = matches.reduce(
    (highest, match) => (priority[match.level] > priority[highest] ? match.level : highest),
    "L0" as RiskLevel,
  );

  return {
    level,
    signals: [...new Set(matches.map((match) => match.signal))],
    immediateDanger: matches.some((match) => match.immediateDanger),
    source: "local_rules",
  };
}
