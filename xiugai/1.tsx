import { useState, useRef, useEffect } from "react"

type Screen = "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07" | "P08" | "P09" | "S01" | "S02" | "S03"

interface ChatMsg {
  role: "user" | "ai"
  text: string
}

// ─── Design tokens ─────────────────────────────────────────────
const C = {
  bg: "#F7F6F1",
  card: "#FFFFFF",
  text: "#24322D",
  sec: "#65736D",
  primary: "#397866",
  primaryLight: "#E3EFEA",
  accent: "#F0B96B",
  danger: "#B33A3A",
  dangerBg: "#FBEAEA",
  border: "#DCE3DF",
} as const

// ─── Static data ────────────────────────────────────────────────
const SCENARIOS = [
  { id: "stuck", label: "重要事情压得我动不了" },
  { id: "conflict", label: "和别人有冲突，不知道怎么说" },
  { id: "ruminate", label: "一个人反复想，停不下来" },
  { id: "other", label: "其他情况" },
]

const STRATEGIES = [
  { id: "listen", label: "先听我说", desc: "先说出来，不急着找方案" },
  { id: "clarify", label: "帮我理清", desc: "把处境说清楚，看见全貌" },
  { id: "express", label: "帮我表达", desc: "整理想法，找到表达的方式" },
  { id: "act", label: "帮我行动", desc: "拆解一个能做的小步骤" },
]

const EXPR_TEMPLATES = {
  温和: "当那件事发生时，我感到有些难受，因为我需要感受到被理解和重视。我希望我们可以找个时间，好好聊一聊这件事。",
  直接: "那件事发生后，我感到很受伤，因为我需要清晰的边界被尊重。我希望我们可以直接谈谈，把问题说清楚。",
  简短: "那件事让我很不舒服，我需要被尊重。我们能认真谈谈吗？",
} as const

type ExprStyle = keyof typeof EXPR_TEMPLATES

const INIT_MSGS: ChatMsg[] = [
  { role: "ai", text: "我先不急着给建议。刚才发生了什么？哪一刻让你最难受？" },
  {
    role: "user",
    text: "就是朋友在群里说了一句话，感觉被忽视了，但我不确定是不是自己太敏感。",
  },
  {
    role: "ai",
    text: '听起来这句话让你一下子很在意。你说"不确定是不是太敏感"——能说说，那句话具体让你感觉到什么？',
  },
]

const INIT_SITUATION = {
  facts: "朋友在群里说了一句话，当时没有回应我，之后一直在想这件事。",
  feelings: "感到委屈、有点愤怒，同时也在自我怀疑，不确定是否太敏感。",
  worries: "担心如果说出来会破坏关系，不说又会一直憋着。",
  needs: "需要感受到被重视，也需要知道这段关系是否还能真诚沟通。",
}

// ─── Main flow steps (for progress bar) ─────────────────────────
const MAIN_FLOW: Screen[] = [
  "P01",
  "P02",
  "P03",
  "P04",
  "P05",
  "P06",
  "P07",
  "P08",
]

// ─── Shared UI atoms ────────────────────────────────────────────
function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? C.border : C.primary,
        color: disabled ? C.sec : "#fff",
        borderRadius: 12,
        border: "none",
        fontSize: 16,
        fontWeight: 600,
        padding: "14px 24px",
        cursor: disabled ? "default" : "pointer",
        minHeight: 52,
        width: "100%",
        transition: "background 0.2s",
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  )
}

function SecBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.card,
        color: C.primary,
        border: `1.5px solid ${C.primary}`,
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 500,
        padding: "13px 24px",
        cursor: "pointer",
        minHeight: 52,
        width: "100%",
      }}
    >
      {children}
    </button>
  )
}

function GhostBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        color: C.sec,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        fontSize: 13,
        padding: "8px 14px",
        cursor: "pointer",
        minHeight: 36,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: C.sec,
        fontSize: 15,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        minHeight: 44,
        padding: "0 4px",
      }}
    >
      ‹ 返回
    </button>
  )
}

function UrgentBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: C.danger,
        fontSize: 13,
        textDecoration: "underline",
        cursor: "pointer",
        minHeight: 44,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      我现在不安全，需要帮助 →
    </button>
  )
}

function SectionNote({
  children,
  color = C.primary,
  bg = C.primaryLight,
}: {
  children: React.ReactNode
  color?: string
  bg?: string
}) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "10px 14px" }}>
      <p style={{ fontSize: 13, color, margin: 0, lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  )
}

// ─── App ────────────────────────────────────────────────────────
export default function App() {
  // Navigation
  const [screen, setScreen] = useState<Screen>("P01")
  const [safetyFrom, setSafetyFrom] = useState<Screen>("P01")

  // Flow state
  const [scenario, setScenario] = useState<string | null>(null)
  const [customText, setCustomText] = useState("")
  const [strategy, setStrategy] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([...INIT_MSGS])
  const [composer, setComposer] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [situation, setSituation] = useState({ ...INIT_SITUATION })
  const [exprStyle, setExprStyle] = useState<ExprStyle>("温和")
  const [exprDraft, setExprDraft] = useState<string>(EXPR_TEMPLATES["温和"])
  const [copyDone, setCopyDone] = useState(false)
  const [actionStarted, setActionStarted] = useState(false)
  const [actionDone, setActionDone] = useState(false)
  const [actionSmaller, setActionSmaller] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (screen === "P04") {
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    }
  }, [messages, screen])

  const go = (s: Screen) => setScreen(s)

  const goSafety = (from: Screen) => {
    setSafetyFrom(from)
    go("S01")
  }

  const sendMsg = () => {
    if (!composer.trim()) return
    const text = composer.trim()
    setComposer("")
    setMessages((prev) => [...prev, { role: "user", text }])
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "你说的这些我都在听。你现在最想先理清的是哪一部分？",
        },
      ])
    }, 1200)
  }

  const changeStyle = (style: ExprStyle) => {
    setExprStyle(style)
    setExprDraft(EXPR_TEMPLATES[style])
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(exprDraft).catch(() => {})
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2500)
  }

  const resetAll = () => {
    setScreen("P01")
    setSafetyFrom("P01")
    setScenario(null)
    setCustomText("")
    setStrategy(null)
    setMessages([...INIT_MSGS])
    setComposer("")
    setIsTyping(false)
    setSituation({ ...INIT_SITUATION })
    setExprStyle("温和")
    setExprDraft(EXPR_TEMPLATES["温和"])
    setCopyDone(false)
    setActionStarted(false)
    setActionDone(false)
    setActionSmaller(false)
    setFeedback(null)
    setFeedbackText("")
    setShowDeleteModal(false)
  }

  // ── Progress bar ───────────────────────────────────────────────
  const progressIdx = MAIN_FLOW.indexOf(screen)
  const showProgress = progressIdx >= 0

  function ProgressBar() {
    if (!showProgress) return null
    const total = MAIN_FLOW.length - 1
    return (
      <div style={{ display: "flex", gap: 3, padding: "14px 20px 0" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background:
                i < progressIdx
                  ? C.primary
                  : i === progressIdx
                    ? C.primary
                    : C.border,
              opacity: i > progressIdx ? 0.35 : 1,
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>
    )
  }

  // ── Screens ────────────────────────────────────────────────────

  function renderP01() {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div
          style={{
            flex: 1,
            padding: "32px 24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Brand mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: C.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "#fff", fontSize: 16, lineHeight: 1 }}>
                ✦
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.sec,
                letterSpacing: "0.06em",
              }}
            >
              情绪行动助手
            </span>
          </div>

          {/* Headline */}
          <div style={{ paddingTop: 8 }}>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: C.text,
                lineHeight: 1.25,
                margin: "0 0 16px",
              }}
            >
              把情绪理清，
              <br />
              变成下一小步
            </h1>
            <div
              style={{
                background: C.card,
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: C.sec,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                我可以陪你梳理处境、组织表达或拆解行动。这里不提供医疗诊断，也不能替代专业帮助。
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: "auto",
            }}
          >
            <PrimaryBtn onClick={() => go("P02")}>开始梳理</PrimaryBtn>
            <SecBtn onClick={() => go("P09")}>先看隐私与数据</SecBtn>
          </div>
        </div>

        {/* Urgent */}
        <div style={{ padding: "0 24px 32px" }}>
          <UrgentBtn onClick={() => goSafety("P01")} />
        </div>
      </div>
    )
  }

  function renderP02() {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div style={{ padding: "12px 24px 0" }}>
          <BackBtn onClick={() => go("P01")} />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              现在是哪种状况？
            </h2>
            <p style={{ fontSize: 14, color: C.sec, margin: 0 }}>
              选一个最接近你感受的描述
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setScenario(sc.id)}
                style={{
                  background: scenario === sc.id ? C.primaryLight : C.card,
                  border: `1.5px solid ${
                    scenario === sc.id ? C.primary : C.border
                  }`,
                  borderRadius: 16,
                  padding: "15px 16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  minHeight: 56,
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    color: C.text,
                    fontWeight: scenario === sc.id ? 600 : 400,
                    lineHeight: 1.4,
                    display: "block",
                  }}
                >
                  {sc.label}
                </span>
              </button>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 13, color: C.sec, margin: "0 0 6px" }}>
              也可以用自己的话说（选填）
            </p>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="在这里补充..."
              rows={3}
              style={{
                width: "100%",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: C.text,
                background: C.card,
                resize: "none",
                boxSizing: "border-box",
                outline: "none",
                lineHeight: 1.6,
              }}
            />
          </div>

          <PrimaryBtn onClick={() => go("P03")} disabled={!scenario}>
            继续
          </PrimaryBtn>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <UrgentBtn onClick={() => goSafety("P02")} />
        </div>
      </div>
    )
  }

  function renderP03() {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div style={{ padding: "12px 24px 0" }}>
          <BackBtn onClick={() => go("P02")} />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              你希望我怎么帮你？
            </h2>
            <p style={{ fontSize: 14, color: C.sec, margin: 0 }}>
              可以先选一个，之后也可以换
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STRATEGIES.map((st) => (
              <button
                key={st.id}
                onClick={() => setStrategy(st.id)}
                style={{
                  background: strategy === st.id ? C.primaryLight : C.card,
                  border: `1.5px solid ${
                    strategy === st.id ? C.primary : C.border
                  }`,
                  borderRadius: 16,
                  padding: "15px 16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 2,
                  }}
                >
                  {st.label}
                </div>
                <div style={{ fontSize: 13, color: C.sec }}>{st.desc}</div>
              </button>
            ))}
          </div>

          <PrimaryBtn onClick={() => go("P04")} disabled={!strategy}>
            开始对话
          </PrimaryBtn>
        </div>
      </div>
    )
  }

  function renderP04() {
    const stratLabel =
      STRATEGIES.find((s) => s.id === strategy)?.label ?? "先听我说"
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Chat header */}
        <div
          style={{
            background: C.card,
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <ProgressBar />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 16px 12px",
            }}
          >
            <BackBtn onClick={() => go("P03")} />
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  background: C.primaryLight,
                  color: C.primary,
                  borderRadius: 20,
                  padding: "5px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {stratLabel}
              </span>
            </div>
            <div style={{ width: 56 }} />
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 4,
              }}
            >
              {msg.role === "ai" && (
                <span
                  style={{
                    fontSize: 11,
                    color: C.sec,
                    paddingLeft: 2,
                    fontWeight: 500,
                  }}
                >
                  AI 生成
                </span>
              )}
              <div
                style={{
                  background: msg.role === "user" ? C.primary : C.card,
                  color: msg.role === "user" ? "#fff" : C.text,
                  borderRadius:
                    msg.role === "user"
                      ? "16px 4px 16px 16px"
                      : "4px 16px 16px 16px",
                  border: msg.role === "ai" ? `1px solid ${C.border}` : "none",
                  padding: "10px 14px",
                  fontSize: 14,
                  lineHeight: 1.65,
                  maxWidth: "84%",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: C.sec,
                  paddingLeft: 2,
                  fontWeight: 500,
                }}
              >
                AI 生成
              </span>
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: "4px 16px 16px 16px",
                  padding: "12px 16px",
                }}
              >
                <span style={{ color: C.sec, fontSize: 18, letterSpacing: 4 }}>
                  ···
                </span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Action chips + urgent */}
        <div style={{ padding: "4px 16px 0", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <GhostBtn onClick={() => go("P05")}>生成处境卡</GhostBtn>
            <GhostBtn onClick={() => go("P03")}>换一种帮助方式</GhostBtn>
          </div>
          <UrgentBtn onClick={() => goSafety("P04")} />
        </div>

        {/* Composer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${C.border}`,
            background: C.card,
            padding: "10px 14px 16px",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMsg()
                }
              }}
              placeholder="说说你的感受..."
              rows={1}
              style={{
                flex: 1,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 14,
                resize: "none",
                outline: "none",
                color: C.text,
                background: C.bg,
                minHeight: 44,
                maxHeight: 120,
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={sendMsg}
              style={{
                background: composer.trim() ? C.primary : C.border,
                border: "none",
                borderRadius: 12,
                width: 44,
                height: 44,
                cursor: composer.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#fff",
                fontSize: 18,
                transition: "background 0.2s",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderP05() {
    const fields = [
      {
        key: "facts" as const,
        label: "发生了什么（事实）",
        ph: "尽量描述可观察到的事实...",
      },
      {
        key: "feelings" as const,
        label: "我感受到什么",
        ph: "你有哪些情绪或身体感觉...",
      },
      {
        key: "worries" as const,
        label: "我在担心什么",
        ph: "你最担心的事是...",
      },
      {
        key: "needs" as const,
        label: "我真正需要什么",
        ph: "在这件事里，你真正需要的是...",
      },
    ]
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div style={{ padding: "12px 24px 0" }}>
          <BackBtn onClick={() => go("P04")} />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              处境卡
            </h2>
            <p style={{ fontSize: 13, color: C.sec, margin: 0 }}>
              根据对话整理，可以直接编辑修改
            </p>
          </div>

          {fields.map((f) => (
            <div
              key={f.key}
              style={{
                background: C.card,
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: 16,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.sec,
                  letterSpacing: "0.04em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {f.label}
              </label>
              <textarea
                value={situation[f.key]}
                onChange={(e) =>
                  setSituation((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                placeholder={f.ph}
                rows={3}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  fontSize: 14,
                  color: C.text,
                  lineHeight: 1.65,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          <SectionNote>
            ℹ️ AI 整理的内容可能有误或不完整，以你自己的感受为准。
          </SectionNote>

          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                margin: "0 0 10px",
              }}
            >
              接下来想做什么？
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <PrimaryBtn onClick={() => go("P06")}>整理一段表达</PrimaryBtn>
              <SecBtn onClick={() => go("P07")}>拆解一个行动步骤</SecBtn>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderP06() {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div style={{ padding: "12px 24px 0" }}>
          <BackBtn onClick={() => go("P05")} />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              表达草稿
            </h2>
            <p style={{ fontSize: 13, color: C.sec, margin: 0 }}>
              可以直接修改文字，找到最适合你的方式
            </p>
          </div>

          {/* Style chips */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["温和", "直接", "简短"] as ExprStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => changeStyle(s)}
                style={{
                  background: exprStyle === s ? C.primary : C.card,
                  color: exprStyle === s ? "#fff" : C.sec,
                  border: `1px solid ${exprStyle === s ? C.primary : C.border}`,
                  borderRadius: 20,
                  padding: "7px 18px",
                  fontSize: 14,
                  cursor: "pointer",
                  minHeight: 38,
                  transition: "all 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Draft card */}
          <div
            style={{
              background: C.card,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 16,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: C.sec,
                margin: "0 0 8px",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              AI 生成
            </p>
            <textarea
              value={exprDraft}
              onChange={(e) => setExprDraft(e.target.value)}
              rows={6}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                fontSize: 14,
                color: C.text,
                lineHeight: 1.75,
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                borderTop: `1px solid ${C.border}`,
                paddingTop: 10,
                marginTop: 6,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: C.sec,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                <strong>结构：</strong>
                当……发生时，我感到……，因为我需要……。我希望我们可以……。
              </p>
            </div>
          </div>

          {/* Safety note */}
          <SectionNote color={C.danger} bg={C.dangerBg}>
            ⚠️ 发送前，请先判断当前情境是否安全，表达不一定能立即解决冲突。
          </SectionNote>

          {/* Copy + Regenerate */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                background: copyDone ? C.primaryLight : C.card,
                color: copyDone ? C.primary : C.text,
                border: `1px solid ${copyDone ? C.primary : C.border}`,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                padding: "12px",
                cursor: "pointer",
                minHeight: 48,
                transition: "all 0.2s",
              }}
            >
              {copyDone ? "✓ 已复制" : "复制草稿"}
            </button>
            <button
              onClick={() => changeStyle(exprStyle)}
              style={{
                flex: 1,
                background: C.card,
                color: C.sec,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                fontSize: 14,
                padding: "12px",
                cursor: "pointer",
                minHeight: 48,
              }}
            >
              重新生成
            </button>
          </div>

          <PrimaryBtn onClick={() => go("P08")}>完成，进入总结</PrimaryBtn>
        </div>
      </div>
    )
  }

  function renderP07() {
    const task = actionSmaller ? "只写下第一个标题" : "打开文档，写下三个要点"
    const time = actionSmaller ? "5 分钟" : "10 分钟"
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div style={{ padding: "12px 24px 0" }}>
          <BackBtn onClick={() => go("P05")} />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              行动卡
            </h2>
            <p style={{ fontSize: 13, color: C.sec, margin: 0 }}>
              一个可以马上开始的小动作
            </p>
          </div>

          {/* Action card */}
          <div
            style={{
              background: C.card,
              borderRadius: 20,
              border: `1px solid ${C.border}`,
              padding: 20,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.sec,
                margin: "0 0 6px",
                letterSpacing: "0.04em",
              }}
            >
              下一步
            </p>
            <p
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 16px",
                lineHeight: 1.35,
              }}
            >
              {task}
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: C.primaryLight,
                  borderRadius: 8,
                  padding: "6px 12px",
                }}
              >
                <span
                  style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}
                >
                  ⏱ {time}
                </span>
              </div>
              {actionDone && (
                <div
                  style={{
                    background: "#E6F4EA",
                    borderRadius: 8,
                    padding: "6px 12px",
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: "#1E6A35", fontWeight: 600 }}
                  >
                    ✓ 已完成
                  </span>
                </div>
              )}
            </div>
          </div>

          {actionSmaller && (
            <SectionNote>
              已简化为最小一步。做完之后，再决定要不要继续。
            </SectionNote>
          )}

          {/* Fallback hint */}
          {!actionSmaller && !actionDone && (
            <div
              style={{
                background: C.card,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: 14,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: C.sec,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: C.text }}>如果很难开始：</strong>
                先只写第一个标题就行。
              </p>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!actionDone ? (
              <>
                <PrimaryBtn
                  onClick={() => {
                    setActionStarted(true)
                    setActionDone(true)
                  }}
                >
                  {actionStarted ? "标记为完成" : "我准备好了，开始"}
                </PrimaryBtn>
                {!actionSmaller && (
                  <SecBtn onClick={() => setActionSmaller(true)}>
                    这个太难了，再小一点
                  </SecBtn>
                )}
              </>
            ) : (
              <PrimaryBtn onClick={() => go("P08")}>
                完成了，进入总结
              </PrimaryBtn>
            )}
          </div>

          {!actionDone && (
            <div style={{ textAlign: "center" }}>
              <button
                onClick={() => go("P08")}
                style={{
                  background: "none",
                  border: "none",
                  color: C.sec,
                  fontSize: 14,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                先跳过，结束这一轮
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderP08() {
    const opts = [
      { id: "clear", label: "更清楚了", mark: "✦" },
      { id: "ok", label: "差不多", mark: "◦" },
      { id: "unclear", label: "还是没有头绪", mark: "○" },
    ]
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <ProgressBar />
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 6px",
              }}
            >
              这一轮先到这里
            </h2>
            <p
              style={{ fontSize: 14, color: C.sec, margin: 0, lineHeight: 1.6 }}
            >
              理清头绪只是开始，合上这个页面去做那件事，才是真正的一步。
            </p>
          </div>

          <div
            style={{
              background: C.primaryLight,
              borderRadius: 16,
              padding: "14px 16px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: C.primary,
                margin: 0,
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              💚 离开这里，去做你刚才想到的事吧。
            </p>
          </div>

          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: C.text,
                margin: "0 0 10px",
              }}
            >
              这次对你有帮助吗？
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {opts.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFeedback(o.id)}
                  style={{
                    background: feedback === o.id ? C.primaryLight : C.card,
                    border: `1.5px solid ${
                      feedback === o.id ? C.primary : C.border
                    }`,
                    borderRadius: 12,
                    padding: "13px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "all 0.15s",
                    minHeight: 52,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      color: C.sec,
                      width: 18,
                      textAlign: "center",
                    }}
                  >
                    {o.mark}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: C.text,
                      fontWeight: feedback === o.id ? 600 : 400,
                    }}
                  >
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 13, color: C.sec, margin: "0 0 6px" }}>
              有什么想说的？（选填）
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="想法、建议，或者只是说说..."
              rows={3}
              style={{
                width: "100%",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: C.text,
                background: C.card,
                resize: "none",
                boxSizing: "border-box",
                outline: "none",
                lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PrimaryBtn onClick={() => go("P01")}>完成，回到首页</PrimaryBtn>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: C.dangerBg,
                color: C.danger,
                border: `1px solid rgba(179,58,58,0.2)`,
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 500,
                padding: "13px 24px",
                cursor: "pointer",
                minHeight: 52,
                width: "100%",
              }}
            >
              删除本次记录并退出
            </button>
          </div>
        </div>

        {/* Delete confirm modal */}
        {showDeleteModal && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "flex-end",
              zIndex: 200,
            }}
          >
            <div
              style={{
                background: C.card,
                borderRadius: "20px 20px 0 0",
                padding: "24px 24px 40px",
                width: "100%",
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.text,
                  margin: "0 0 8px",
                }}
              >
                确认删除
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: C.sec,
                  margin: "0 0 24px",
                  lineHeight: 1.65,
                }}
              >
                本次对话内容将被清除。本原型演示本来就不会存储任何个人数据——删除只是重置界面状态。
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    flex: 1,
                    background: C.card,
                    color: C.sec,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    fontSize: 15,
                    padding: "13px",
                    cursor: "pointer",
                    minHeight: 52,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    resetAll()
                  }}
                  style={{
                    flex: 1,
                    background: C.danger,
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "13px",
                    cursor: "pointer",
                    minHeight: 52,
                  }}
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderP09() {
    const privacySections = [
      {
        title: "会处理什么",
        text: "你在对话中输入的文字，以及你选择的情景、策略。这些信息仅用于在当前会话中生成回应，不做任何其他用途。",
      },
      {
        title: "为什么处理",
        text: "为了理解你的处境，提供有针对性的梳理和表达帮助。我们不会用这些数据训练模型或做任何其他用途。",
      },
      {
        title: "保存多久",
        text: "本原型演示不在服务器或本地存储任何数据。关闭页面后，所有内容消失。",
      },
      {
        title: "如何删除",
        text: '在每次对话结束时可点击"删除本次记录"，或直接关闭浏览器。不需要真实姓名，也没有账号。',
      },
    ]
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            borderBottom: `1px solid ${C.border}`,
            padding: "16px 24px 14px",
          }}
        >
          <BackBtn onClick={() => go("P01")} />
          <h2
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: C.text,
              margin: "6px 0 0",
            }}
          >
            隐私与数据说明
          </h2>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {privacySections.map((s, i) => (
            <div
              key={i}
              style={{
                background: C.card,
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.text,
                  margin: "0 0 6px",
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: C.sec,
                  margin: 0,
                  lineHeight: 1.65,
                }}
              >
                {s.text}
              </p>
            </div>
          ))}

          <SectionNote>
            这是一个原型演示。不收集真实姓名，不要求注册账号，不存储任何个人信息。
          </SectionNote>

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn onClick={() => go("P01")}>返回首页</PrimaryBtn>
          </div>
        </div>
      </div>
    )
  }

  function renderS01() {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "40px 24px 48px",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div style={{ background: C.dangerBg, borderRadius: 20, padding: 20 }}>
          <h2
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: C.danger,
              margin: "0 0 8px",
            }}
          >
            先确认一下
          </h2>
          <p
            style={{
              fontSize: 14,
              color: C.danger,
              margin: 0,
              lineHeight: 1.7,
            }}
          >
            你现在是否有伤害自己或他人的想法，或者正处于紧急危险中？
          </p>
        </div>

        <p
          style={{
            fontSize: 13,
            color: C.sec,
            margin: 0,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          这不是诊断，我只是想知道你现在是否安全。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => go("S02")}
            style={{
              background: C.dangerBg,
              color: C.danger,
              border: `1.5px solid rgba(179,58,58,0.35)`,
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 600,
              padding: "16px",
              cursor: "pointer",
              minHeight: 58,
            }}
          >
            是，或者我不确定
          </button>
          <button
            onClick={() => go("S03")}
            style={{
              background: C.card,
              color: C.text,
              border: `1.5px solid ${C.border}`,
              borderRadius: 14,
              fontSize: 15,
              padding: "15px",
              cursor: "pointer",
              minHeight: 56,
            }}
          >
            没有，但我现在很难受
          </button>
          <button
            onClick={() => go(safetyFrom)}
            style={{
              background: "none",
              color: C.sec,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              fontSize: 14,
              padding: "13px",
              cursor: "pointer",
              minHeight: 52,
            }}
          >
            我点错了，返回
          </button>
        </div>
      </div>
    )
  }

  function renderS02() {
    const steps = [
      {
        icon: "🚪",
        title: "离开危险物品或地方",
        desc: "如果身边有危险物品，先离开那个地方，去一个更安全的空间。",
      },
      {
        icon: "📞",
        title: "联系一个现在能来陪你的人",
        desc: "给你信任的、能立刻过来的人打电话，告诉他们你需要有人陪。",
      },
      {
        icon: "🆘",
        title: "如果危险迫近",
        desc: "在中国大陆，拨打 110（报警）或 120（急救）。也可以拨打全国心理援助热线 12356。",
      },
    ]
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "32px 24px 40px",
        }}
      >
        <div
          style={{
            background: C.dangerBg,
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.danger,
              margin: "0 0 6px",
            }}
          >
            AI 不能处理紧急情况
          </h2>
          <p
            style={{
              fontSize: 14,
              color: C.danger,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            现在需要真实的人来帮助你。请做下面这些事。
          </p>
        </div>

        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}
        >
          {steps.map((item, i) => (
            <div
              key={i}
              style={{
                background: C.card,
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: 16,
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>
                {item.icon}
              </span>
              <div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.text,
                    margin: "0 0 4px",
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: C.sec,
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}

          <div
            style={{
              background: "#FFF3E0",
              borderRadius: 12,
              padding: "12px 14px",
              marginTop: 4,
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: "#BF5000",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              💙 12356 是全国心理援助热线，不是 24
              小时服务。如果无法接通，请优先联系可以来陪你的人，或拨打 110 /
              120。
            </p>
          </div>
        </div>
      </div>
    )
  }

  function renderS03() {
    const items = [
      {
        icon: "💬",
        title: "联系一个信任的人",
        desc: "给信任的朋友或家人发消息，告诉他们你现在很难受，希望有人陪你说说话。",
        btn: "给朋友发消息",
      },
      {
        icon: "☎️",
        title: "拨打 12356",
        desc: "全国心理援助热线，可以和专业的人说说你的感受。注意：非 24 小时服务。",
        btn: "拨打 12356",
      },
      {
        icon: "🌬️",
        title: "做一分钟稳定练习",
        desc: "慢慢吸气 4 秒，屏住 4 秒，呼气 6 秒。重复三次，让身体先平静下来。",
        btn: "开始练习",
      },
    ]
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px 0" }}>
          <BackBtn onClick={() => go("S01")} />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              你不需要独自扛着
            </h2>
            <p
              style={{ fontSize: 14, color: C.sec, margin: 0, lineHeight: 1.5 }}
            >
              很难受的时候，可以先做下面这些。
            </p>
          </div>

          {items.map((item, i) => (
            <div
              key={i}
              style={{
                background: C.card,
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 24,
                    flexShrink: 0,
                    lineHeight: 1,
                    paddingTop: 2,
                  }}
                >
                  {item.icon}
                </span>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.text,
                      margin: "0 0 3px",
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: C.sec,
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
              <button
                style={{
                  background: C.primaryLight,
                  color: C.primary,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 14px",
                  cursor: "pointer",
                  minHeight: 36,
                  width: "100%",
                }}
              >
                {item.btn}
              </button>
            </div>
          ))}

          <button
            onClick={() => go(safetyFrom)}
            style={{
              background: "none",
              color: C.sec,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 14,
              padding: "13px",
              cursor: "pointer",
              minHeight: 52,
              width: "100%",
              marginTop: 4,
            }}
          >
            我已经稳定了一些，回到之前的内容
          </button>
        </div>
      </div>
    )
  }

  // ── Render switch ───────────────────────────────────────────────
  function renderScreen() {
    switch (screen) {
      case "P01":
        return renderP01()
      case "P02":
        return renderP02()
      case "P03":
        return renderP03()
      case "P04":
        return renderP04()
      case "P05":
        return renderP05()
      case "P06":
        return renderP06()
      case "P07":
        return renderP07()
      case "P08":
        return renderP08()
      case "P09":
        return renderP09()
      case "S01":
        return renderS01()
      case "S02":
        return renderS02()
      case "S03":
        return renderS03()
    }
  }

  return (
    <div
      style={{
        background: "#DDDCD7",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "32px 0 48px",
      }}
    >
      {/* Phone frame */}
      <div
        style={{
          width: 390,
          minHeight: 844,
          background: C.bg,
          borderRadius: 48,
          overflow: "hidden",
          boxShadow: "0 32px 96px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Status bar simulation */}
        <div
          style={{
            height: 44,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            background: C.bg,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
            9:41
          </span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.text }}>●●●</span>
            <span style={{ fontSize: 11, color: C.text }}>WiFi</span>
            <span style={{ fontSize: 11, color: C.text }}>🔋</span>
          </div>
        </div>

        {/* Screen content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {renderScreen()}
        </div>
      </div>
    </div>
  )
}
