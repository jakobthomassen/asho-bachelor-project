import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthProvider";
import {
  calculateTopicVector,
  createTopic,
  getTopicDashboardStats,
  listTopicDashboardTopics,
  saveTopicVersion,
  type TopicDashboardStats,
  type TopicDashboardTopic,
} from "../../../features/topicDashboard/api";
import SettingsModal from "../../../components/overlays/SettingsModal";
import "./TopicDashboardPage.css";

const LOGO_URL =
  "https://static.wixstatic.com/media/ce15e3_4878766d65e44a919042edd86151d790~mv2.png/v1/fill/w_133,h_64,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/inf.png";

type TabKey = "stats" | "temaer";
type JsonValueType = "string" | "number" | "boolean" | "json";

type KeyValueRow = {
  id: string;
  key: string;
  value: string;
  type: JsonValueType;
};

type TopicForm = {
  title: string;
  classifier_description: string;
  system_prompt: string;
  micro_instruction_items: string[];
  constraints_rows: KeyValueRow[];
  reclassify_rows: KeyValueRow[];
  safety_rows: KeyValueRow[];
  min_confidence: string;
  reclassify_turn_threshold: string;
  max_clarifying_questions: string;
};

let rowIdCounter = 0;
function makeRowId(): string {
  rowIdCounter += 1;
  return `row-${Date.now()}-${rowIdCounter}`;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value || 0);
}

function valueTypeOf(value: unknown): JsonValueType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "json";
}

function rowsFromObject(input: Record<string, unknown>): KeyValueRow[] {
  return Object.entries(input || {}).map(([key, value]) => {
    const type = valueTypeOf(value);
    const normalizedValue =
      type === "json"
        ? JSON.stringify(value ?? null)
        : type === "boolean"
          ? String(Boolean(value))
          : String(value ?? "");

    return {
      id: makeRowId(),
      key,
      value: normalizedValue,
      type,
    };
  });
}

function toInstructionItems(input: Record<string, unknown>): string[] {
  const rawSequence = input?.sequence;
  if (Array.isArray(rawSequence)) {
    return rawSequence.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return Object.values(input || {})
    .filter((value) => typeof value === "string")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function formFromTopic(topic: TopicDashboardTopic): TopicForm {
  return {
    title: topic.title,
    classifier_description: topic.classifier_description,
    system_prompt: topic.system_prompt,
    micro_instruction_items: toInstructionItems(topic.micro_instructions),
    constraints_rows: rowsFromObject(topic.constraints),
    reclassify_rows: rowsFromObject(topic.reclassify_rules),
    safety_rows: rowsFromObject(topic.safety_rules),
    min_confidence: String(topic.min_confidence),
    reclassify_turn_threshold: String(topic.reclassify_turn_threshold),
    max_clarifying_questions: String(topic.max_clarifying_questions),
  };
}

function emptyForm(): TopicForm {
  return {
    title: "",
    classifier_description: "",
    system_prompt: "",
    micro_instruction_items: [],
    constraints_rows: [],
    reclassify_rows: [],
    safety_rows: [],
    min_confidence: "0.7",
    reclassify_turn_threshold: "3",
    max_clarifying_questions: "2",
  };
}

function parseRowValue(fieldLabel: string, row: KeyValueRow): unknown {
  if (row.type === "string") return row.value;

  if (row.type === "number") {
    const numberValue = Number(row.value);
    if (!Number.isFinite(numberValue)) {
      throw new Error(`${fieldLabel}: "${row.key}" ma vaere et gyldig tall.`);
    }
    return numberValue;
  }

  if (row.type === "boolean") {
    return row.value === "true";
  }

  try {
    return JSON.parse(row.value || "null");
  } catch {
    throw new Error(`${fieldLabel}: "${row.key}" inneholder ugyldig JSON.`);
  }
}

function rowsToObject(fieldLabel: string, rows: KeyValueRow[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const row of rows) {
    const cleanKey = row.key.trim();
    if (!cleanKey) continue;
    output[cleanKey] = parseRowValue(fieldLabel, row);
  }

  return output;
}

function toNiceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;

  const exponent = Math.floor(Math.log10(rawMax));
  const base = 10 ** exponent;
  const fraction = rawMax / base;

  let niceFraction = 1;
  if (fraction > 1) niceFraction = 2;
  if (fraction > 2) niceFraction = 5;
  if (fraction > 5) niceFraction = 10;

  return niceFraction * base;
}

function formatTick(value: number): string {
  return value.toLocaleString("nb-NO");
}

function formatDateLabel(day: string): string {
  return day.slice(5);
}

function formatTooltipDate(day: string): string {
  const parts = day.split("-");
  const monthIndex = Number(parts[1] || 1) - 1;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const month = monthNames[Math.max(0, Math.min(11, monthIndex))];
  const dayNumber = String(Number(parts[2] || "1"));
  return `${dayNumber}. ${month}`;
}

function KeyValueEditor({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: KeyValueRow[];
  onChange: (nextRows: KeyValueRow[]) => void;
}) {
  const addRow = () => {
    onChange([
      ...rows,
      {
        id: makeRowId(),
        key: "",
        value: "",
        type: "string",
      },
    ]);
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, patch: Partial<KeyValueRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <section className="topicDashboard__kvSection">
      <div className="topicDashboard__kvHeader">
        <h3>{title}</h3>
        <button type="button" className="topicDashboard__ghostBtn" onClick={addRow}>
          + Legg til rad
        </button>
      </div>

      {rows.length === 0 ? <div className="topicDashboard__hint">Ingen felter enda.</div> : null}

      <div className="topicDashboard__kvRows">
        {rows.map((row) => (
          <div className="topicDashboard__kvRow" key={row.id}>
            <input
              type="text"
              placeholder="Nokkel"
              value={row.key}
              onChange={(e) => updateRow(row.id, { key: e.target.value })}
            />

            {row.type === "boolean" ? (
              <select
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                aria-label="Boolean verdi"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type="text"
                placeholder={row.type === "json" ? '{"example": true}' : "Verdi"}
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
              />
            )}

            <select
              value={row.type}
              onChange={(e) => {
                const nextType = e.target.value as JsonValueType;
                const nextValue =
                  nextType === "boolean"
                    ? row.value === "false"
                      ? "false"
                      : "true"
                    : row.value;
                updateRow(row.id, { type: nextType, value: nextValue });
              }}
              aria-label="Verditype"
            >
              <option value="string">tekst</option>
              <option value="number">tall</option>
              <option value="boolean">bool</option>
              <option value="json">json</option>
            </select>

            <button
              type="button"
              className="topicDashboard__dangerGhostBtn"
              onClick={() => removeRow(row.id)}
              aria-label="Fjern rad"
            >
              Fjern
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TopicDashboardPage() {
  const { sessionToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("stats");
  const [topics, setTopics] = useState<TopicDashboardTopic[]>([]);
  const [stats, setStats] = useState<TopicDashboardStats | null>(null);
  const [statsDays, setStatsDays] = useState<number>(7);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string>("");
  const [form, setForm] = useState<TopicForm | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculatingTopicKey, setIsCalculatingTopicKey] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTopicKey, setNewTopicKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [colorTheme, setColorTheme] = useState<"green" | "purple" | "blue">("green");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [statsError, setStatsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ x: number; y: number; day: string; tokens: number } | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const data = await listTopicDashboardTopics(sessionToken);
        if (cancelled) return;
        setTopics(data);
        const firstKey = data[0]?.topic_key ?? "";
        setSelectedTopicKey((prev) => (prev && data.some((t) => t.topic_key === prev) ? prev : firstKey));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Kunne ikke laste temaer.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    const loadStats = async () => {
      setIsStatsLoading(true);
      setStatsError(null);
      try {
        const data = await getTopicDashboardStats(sessionToken, statsDays);
        if (cancelled) return;
        setStats(data);
      } catch (err) {
        if (cancelled) return;
        setStatsError(err instanceof Error ? err.message : "Kunne ikke laste statistikk.");
      } finally {
        if (!cancelled) setIsStatsLoading(false);
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, statsDays]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("asho_theme");
    const storedMode = localStorage.getItem("asho_mode");
    if (storedTheme === "green" || storedTheme === "purple" || storedTheme === "blue") setColorTheme(storedTheme);
    if (storedMode === "light" || storedMode === "dark") setMode(storedMode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = colorTheme;
    root.dataset.mode = mode;
    localStorage.setItem("asho_theme", colorTheme);
    localStorage.setItem("asho_mode", mode);
  }, [colorTheme, mode]);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.topic_key === selectedTopicKey),
    [topics, selectedTopicKey]
  );

  useEffect(() => {
    if (isCreatingNew) return;
    if (!selectedTopic) {
      setForm(null);
      return;
    }
    setForm(formFromTopic(selectedTopic));
    setShowAdvanced(false);
    setSuccess(null);
    setError(null);
  }, [selectedTopicKey, selectedTopic, isCreatingNew]);

  const updateField = (name: keyof TopicForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const updateInstructionItem = (index: number, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = [...prev.micro_instruction_items];
      next[index] = value;
      return { ...prev, micro_instruction_items: next };
    });
  };

  const addInstructionItem = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            micro_instruction_items: [...prev.micro_instruction_items, ""],
          }
        : prev
    );
  };

  const removeInstructionItem = (index: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        micro_instruction_items: prev.micro_instruction_items.filter((_, i) => i !== index),
      };
    });
  };

  const handleSave = async () => {
    if (!sessionToken || !form) return;

    setError(null);
    setSuccess(null);

    const minConfidence = Number(form.min_confidence);
    const reclassifyTurnThreshold = Number(form.reclassify_turn_threshold);
    const maxClarifyingQuestions = Number(form.max_clarifying_questions);

    if (!form.title.trim() || !form.classifier_description.trim() || !form.system_prompt.trim()) {
      setError("Title, classifier_description og system_prompt er pakrevd.");
      return;
    }

    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      setError("min_confidence ma vaere et tall mellom 0 og 1.");
      return;
    }

    if (!Number.isInteger(reclassifyTurnThreshold) || reclassifyTurnThreshold < 1) {
      setError("reclassify_turn_threshold ma vaere et heltall >= 1.");
      return;
    }

    if (!Number.isInteger(maxClarifyingQuestions) || maxClarifyingQuestions < 0) {
      setError("max_clarifying_questions ma vaere et heltall >= 0.");
      return;
    }

    try {
      const microInstructions = {
        sequence: form.micro_instruction_items.map((item) => item.trim()).filter(Boolean),
      };

      const basePayload = {
        title: form.title.trim(),
        classifier_description: form.classifier_description.trim(),
        system_prompt: form.system_prompt.trim(),
        micro_instructions: microInstructions,
        constraints: rowsToObject("Constraints", form.constraints_rows),
        reclassify_rules: rowsToObject("Reclassify rules", form.reclassify_rows),
        safety_rules: rowsToObject("Safety rules", form.safety_rows),
        min_confidence: minConfidence,
        reclassify_turn_threshold: reclassifyTurnThreshold,
        max_clarifying_questions: maxClarifyingQuestions,
      };

      setIsSaving(true);

      if (isCreatingNew) {
        const cleanKey = newTopicKey.trim();
        if (!cleanKey) {
          setError("Topic key er pakrevd.");
          setIsSaving(false);
          return;
        }
        const saved = await createTopic(sessionToken, { topic_key: cleanKey, ...basePayload });
        setTopics((prev) => [...prev, saved].sort((a, b) => a.title.localeCompare(b.title)));
        setSelectedTopicKey(saved.topic_key);
        setIsCreatingNew(false);
        setNewTopicKey("");
        setForm(formFromTopic(saved));
        setSuccess(`Nytt tema "${saved.title}" opprettet.`);
      } else {
        if (!selectedTopic) return;
        const saved = await saveTopicVersion(sessionToken, selectedTopic.topic_key, basePayload);
        setTopics((prev) => prev.map((topic) => (topic.topic_key === saved.topic_key ? saved : topic)));
        setSelectedTopicKey(saved.topic_key);
        setForm(formFromTopic(saved));
        setSuccess(`Lagret ny versjon v${saved.version_no}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCalculateVector = async (topicKey: string) => {
    if (!sessionToken) return;

    setError(null);
    setSuccess(null);
    setIsCalculatingTopicKey(topicKey);
    try {
      const updated = await calculateTopicVector(sessionToken, topicKey);
      setTopics((prev) => prev.map((topic) => (topic.topic_key === updated.topic_key ? updated : topic)));
      setSuccess(`Vektor kalkulert for ${updated.topic_key}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke kalkulere vektor.");
    } finally {
      setIsCalculatingTopicKey(null);
    }
  };

  if (!sessionToken) {
    return (
      <div className="topicDashboard">
        <div className="topicDashboard__empty">Logg inn for aa bruke dashboard.</div>
      </div>
    );
  }

  const dailyTokens = stats?.daily_tokens ?? [];
  const maxTokens = Math.max(0, ...dailyTokens.map((item) => item.total_tokens));
  const yMax = toNiceMax(maxTokens);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(yMax * ratio));

  return (
    <div className="topicDashboard">
      <header className="topicDashboard__navBar">
        <div className="topicDashboard__brandBlock">
          <img src={LOGO_URL} alt="ASHO logo" className="topicDashboard__logo" />
          <div className="topicDashboard__brandName">ASHO</div>
        </div>
        <div className="topicDashboard__tabs" role="tablist" aria-label="Dashboard tabs">
          <button
            className={`topicDashboard__tab ${activeTab === "stats" ? "is-active" : ""}`}
            onClick={() => setActiveTab("stats")}
            role="tab"
            aria-selected={activeTab === "stats"}
            type="button"
          >
            Statistikk
          </button>
          <button
            className={`topicDashboard__tab ${activeTab === "temaer" ? "is-active" : ""}`}
            onClick={() => setActiveTab("temaer")}
            role="tab"
            aria-selected={activeTab === "temaer"}
            type="button"
          >
            Temaer
          </button>
        </div>
        <button
          className="topicDashboard__settingsBtn"
          type="button"
          onClick={() => setShowSettings(true)}
        >
          ⚙ Innstillinger
        </button>
      </header>

      <main className="topicDashboard__main">
        {activeTab === "stats" ? (
          <section className="topicDashboard__statsPane topicDashboard__statsPane--constrained">
            <div className="topicDashboard__statsHeader">
              <h2>Nokkelstatistikk</h2>
            </div>

            {isStatsLoading ? <div className="topicDashboard__hint">Laster statistikk...</div> : null}
            {statsError ? <div className="topicDashboard__error">{statsError}</div> : null}

            {!isStatsLoading && !statsError && stats ? (
              <>
                <div className="topicDashboard__statCards">
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">Totale unike brukere</div>
                    <div className="topicDashboard__statValue">{stats.total_unique_users.toLocaleString("nb-NO")}</div>
                  </article>
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">Totale samtaler</div>
                    <div className="topicDashboard__statValue">{stats.total_conversations.toLocaleString("nb-NO")}</div>
                  </article>
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">Snitt samtaler per bruker</div>
                    <div className="topicDashboard__statValue">{stats.avg_conversations_per_user.toFixed(2)}</div>
                  </article>
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">Snitt meldinger per samtale</div>
                    <div className="topicDashboard__statValue">{stats.avg_conversation_length_messages.toFixed(2)}</div>
                  </article>
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">Manedlig tokenkostnad (Estimert)</div>
                    <div className="topicDashboard__statValue">{formatUsd(stats.monthly_estimated_token_cost_usd)}</div>
                  </article>
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">Total tokenkostnad (Estimert)</div>
                    <div className="topicDashboard__statValue">{formatUsd(stats.total_estimated_token_cost_usd)}</div>
                  </article>
                </div>

                <div className="topicDashboard__chartCard">
                  <div className="topicDashboard__chartHeader">
                    <div className="topicDashboard__chartTitle">Daglig tokenbruk</div>
                    <div className="topicDashboard__rangeButtons" role="group" aria-label="Valg av tidsperiode">
                      {[7, 14, 30].map((days) => (
                        <button
                          key={days}
                          className={`topicDashboard__rangeBtn ${statsDays === days ? "is-active" : ""}`}
                          onClick={() => setStatsDays(days)}
                          type="button"
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="topicDashboard__chartWrap">
                    <svg className="topicDashboard__chartSvg" viewBox="0 0 1100 300" preserveAspectRatio="none" role="img">
                      <title>Daglig tokenbruk med dynamisk Y-akse</title>

                      {yTicks.map((tick) => {
                        const y = 24 + (1 - tick / yMax) * 220;
                        return (
                          <g key={tick}>
                            <line x1="52" y1={y} x2="1080" y2={y} className="topicDashboard__gridLine" />
                            <text x="46" y={y + 4} className="topicDashboard__tickText" textAnchor="end">
                              {formatTick(tick)}
                            </text>
                          </g>
                        );
                      })}

                      {dailyTokens.map((item, index) => {
                        const count = Math.max(1, dailyTokens.length);
                        const slotWidth = 1028 / count;
                        const barWidth = Math.max(6, Math.min(24, slotWidth * 0.62));
                        const x = 52 + index * slotWidth + (slotWidth - barWidth) / 2;
                        const barHeight = yMax > 0 ? (item.total_tokens / yMax) * 220 : 0;
                        const y = 244 - barHeight;
                        const showLabelEvery = count > 20 ? 3 : count > 12 ? 2 : 1;
                        const showLabel = index % showLabelEvery === 0 || index === count - 1;

                        return (
                          <g key={item.day}>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={Math.max(0, barHeight)}
                              rx="7"
                              className="topicDashboard__barRect"
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                if (!rect) return;
                                setHoveredBar({
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top,
                                  day: item.day,
                                  tokens: item.total_tokens,
                                });
                              }}
                              onMouseLeave={() => setHoveredBar(null)}
                            >
                            </rect>
                            {showLabel ? (
                              <text
                                x={x + barWidth / 2}
                                y="282"
                                textAnchor="middle"
                                className="topicDashboard__dateText"
                              >
                                {formatDateLabel(item.day)}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </svg>
                    {hoveredBar ? (
                      <div
                        className="topicDashboard__chartTooltip"
                        style={{ left: hoveredBar.x, top: hoveredBar.y }}
                        role="status"
                        aria-live="polite"
                      >
                        <div className="topicDashboard__chartTooltipDate">{formatTooltipDate(hoveredBar.day)}</div>
                        <div className="topicDashboard__chartTooltipValue">{`${hoveredBar.tokens} tokens`}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : (
          <div className="topicDashboard__temaLayout">
            <aside className="topicDashboard__leftList topicDashboard__leftList--rail">
              <button
                className="topicDashboard__addNewBtn"
                type="button"
                onClick={() => {
                  setIsCreatingNew(true);
                  setSelectedTopicKey("");
                  setNewTopicKey("");
                  setForm(emptyForm());
                  setShowAdvanced(false);
                  setSuccess(null);
                  setError(null);
                }}
              >
                + Legg til nytt tema
              </button>

              {isLoading ? <div className="topicDashboard__hint">Laster temaer...</div> : null}
              {!isLoading && topics.length === 0 ? <div className="topicDashboard__hint">Ingen temaer funnet.</div> : null}

              {isCreatingNew ? (
                <div className="topicDashboard__topicItem is-active">
                  <button className="topicDashboard__topicSelect" type="button" disabled>
                    <div className="topicDashboard__topicTitle">{newTopicKey.trim() || "Nytt tema"}</div>
                    <div className="topicDashboard__topicStatus is-missing">Ikke lagret</div>
                  </button>
                </div>
              ) : null}

              {topics.map((topic) => {
                const hasVector = Boolean(topic.classifier_embedding?.length);
                return (
                  <div
                    key={topic.topic_key}
                    className={`topicDashboard__topicItem ${!isCreatingNew && selectedTopicKey === topic.topic_key ? "is-active" : ""}`}
                  >
                    <button
                      className="topicDashboard__topicSelect"
                      onClick={() => {
                        setIsCreatingNew(false);
                        setNewTopicKey("");
                        setSelectedTopicKey(topic.topic_key);
                        setActiveTab("temaer");
                      }}
                      type="button"
                    >
                      <div className="topicDashboard__topicTitle">{topic.title}</div>
                      <div className={`topicDashboard__topicStatus ${hasVector ? "is-ok" : "is-missing"}`}>
                        {hasVector ? "Vector OK" : "Vector missing"}
                      </div>
                    </button>

                    <button
                      className="topicDashboard__topicVectorBtn"
                      type="button"
                      disabled={isCalculatingTopicKey === topic.topic_key}
                      onClick={() => handleCalculateVector(topic.topic_key)}
                    >
                      {isCalculatingTopicKey === topic.topic_key ? "Kalkulerer..." : "Calculate"}
                    </button>
                  </div>
                );
              })}
            </aside>

            <section className="topicDashboard__formPane">
              <div className="topicDashboard__formInner">
            {!form ? (
              <div className="topicDashboard__hint">Velg et tema for aa redigere.</div>
            ) : (
              <>
                <div className="topicDashboard__statusRow">
                  <div className="topicDashboard__selectedMeta">
                    {isCreatingNew
                      ? "Nytt tema"
                      : <>Aktivt tema: <b>{selectedTopic!.topic_key}</b> (v{selectedTopic!.version_no})</>
                    }
                  </div>
                  {success ? <div className="topicDashboard__success">{success}</div> : null}
                  {error ? <div className="topicDashboard__error">{error}</div> : null}
                </div>

                <div className="topicDashboard__formGrid">
                  {isCreatingNew ? (
                    <label>
                      Topic key
                      <input
                        value={newTopicKey}
                        onChange={(e) => setNewTopicKey(e.target.value)}
                        placeholder="f.eks. helse, okonomi, teknologi"
                      />
                    </label>
                  ) : null}

                  <label>
                    Tittel
                    <input value={form.title} onChange={(e) => updateField("title", e.target.value)} />
                  </label>

                  <label>
                    Classifier description
                    <textarea
                      rows={3}
                      value={form.classifier_description}
                      onChange={(e) => updateField("classifier_description", e.target.value)}
                    />
                  </label>

                  <label>
                    System prompt
                    <textarea
                      rows={8}
                      value={form.system_prompt}
                      onChange={(e) => updateField("system_prompt", e.target.value)}
                    />
                  </label>

                  <div className="topicDashboard__numberGrid">
                    <label>
                      Min confidence
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step="0.01"
                        value={form.min_confidence}
                        onChange={(e) => updateField("min_confidence", e.target.value)}
                      />
                    </label>

                    <label>
                      Reclassify turn threshold
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={form.reclassify_turn_threshold}
                        onChange={(e) => updateField("reclassify_turn_threshold", e.target.value)}
                      />
                    </label>

                    <label>
                      Max clarifying questions
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.max_clarifying_questions}
                        onChange={(e) => updateField("max_clarifying_questions", e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <details className="topicDashboard__advanced" open={showAdvanced}>
                  <summary onClick={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      className="topicDashboard__advancedToggle"
                      onClick={() => setShowAdvanced((prev) => !prev)}
                    >
                      {showAdvanced ? "Skjul avanserte felt" : "Vis avanserte felt"}
                    </button>
                  </summary>

                  {showAdvanced ? (
                    <div className="topicDashboard__advancedBody">
                      <section className="topicDashboard__kvSection">
                        <div className="topicDashboard__kvHeader">
                          <h3>Micro instructions</h3>
                          <button type="button" className="topicDashboard__ghostBtn" onClick={addInstructionItem}>
                            + Legg til punkt
                          </button>
                        </div>

                        {form.micro_instruction_items.length === 0 ? (
                          <div className="topicDashboard__hint">Ingen punkter enda.</div>
                        ) : null}

                        <div className="topicDashboard__instructionList">
                          {form.micro_instruction_items.map((item, index) => (
                            <div className="topicDashboard__instructionRow" key={`micro-${index}`}>
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => updateInstructionItem(index, e.target.value)}
                                placeholder="Skriv et instruksjonspunkt"
                              />
                              <button
                                type="button"
                                className="topicDashboard__dangerGhostBtn"
                                onClick={() => removeInstructionItem(index)}
                              >
                                Fjern
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>

                      <KeyValueEditor
                        title="Constraints"
                        rows={form.constraints_rows}
                        onChange={(nextRows) => setForm((prev) => (prev ? { ...prev, constraints_rows: nextRows } : prev))}
                      />

                      <KeyValueEditor
                        title="Reclassify rules"
                        rows={form.reclassify_rows}
                        onChange={(nextRows) => setForm((prev) => (prev ? { ...prev, reclassify_rows: nextRows } : prev))}
                      />

                      <KeyValueEditor
                        title="Safety rules"
                        rows={form.safety_rows}
                        onChange={(nextRows) => setForm((prev) => (prev ? { ...prev, safety_rows: nextRows } : prev))}
                      />
                    </div>
                  ) : null}
                </details>

                <div className="topicDashboard__actions">
                  <button disabled={isSaving} onClick={handleSave} type="button">
                    {isSaving ? "Lagrer..." : isCreatingNew ? "Opprett tema" : "Lagre ny versjon"}
                  </button>
                </div>
              </>
            )}
              </div>
          </section>
          </div>
        )}
      </main>
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={colorTheme}
        mode={mode}
        onThemeChange={setColorTheme}
        onModeChange={setMode}
      />
    </div>
  );
}
