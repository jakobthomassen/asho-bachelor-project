import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthProvider";
import {
  calculateTopicVector,
  getTopicDashboardStats,
  listTopicDashboardTopics,
  saveTopicVersion,
  type TopicDashboardStats,
  type TopicDashboardTopic,
} from "../../../features/topicDashboard/api";
import "./TopicDashboardPage.css";

type TabKey = "stats" | "temaer";

type TopicForm = {
  title: string;
  classifier_description: string;
  system_prompt: string;
  micro_instructions: string;
  constraints: string;
  reclassify_rules: string;
  safety_rules: string;
  min_confidence: string;
  reclassify_turn_threshold: string;
  max_clarifying_questions: string;
};

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function formFromTopic(topic: TopicDashboardTopic): TopicForm {
  return {
    title: topic.title,
    classifier_description: topic.classifier_description,
    system_prompt: topic.system_prompt,
    micro_instructions: toPrettyJson(topic.micro_instructions),
    constraints: toPrettyJson(topic.constraints),
    reclassify_rules: toPrettyJson(topic.reclassify_rules),
    safety_rules: toPrettyJson(topic.safety_rules),
    min_confidence: String(topic.min_confidence),
    reclassify_turn_threshold: String(topic.reclassify_turn_threshold),
    max_clarifying_questions: String(topic.max_clarifying_questions),
  };
}

function parseJsonObject(raw: string, fieldName: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} må være et JSON-objekt.`);
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${fieldName} inneholder ugyldig JSON.`);
  }
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value || 0);
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const selectedTopic = useMemo(
    () => topics.find((t) => t.topic_key === selectedTopicKey),
    [topics, selectedTopicKey]
  );

  useEffect(() => {
    if (!selectedTopic) {
      setForm(null);
      return;
    }
    setForm(formFromTopic(selectedTopic));
    setShowAdvanced(false);
    setSuccess(null);
    setError(null);
  }, [selectedTopicKey, selectedTopic]);

  const updateField = (name: keyof TopicForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleSave = async () => {
    if (!sessionToken || !selectedTopic || !form) return;

    setError(null);
    setSuccess(null);

    const minConfidence = Number(form.min_confidence);
    const reclassifyTurnThreshold = Number(form.reclassify_turn_threshold);
    const maxClarifyingQuestions = Number(form.max_clarifying_questions);

    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      setError("min_confidence må være et tall mellom 0 og 1.");
      return;
    }

    if (!Number.isInteger(reclassifyTurnThreshold) || reclassifyTurnThreshold < 1) {
      setError("reclassify_turn_threshold må være et heltall >= 1.");
      return;
    }

    if (!Number.isInteger(maxClarifyingQuestions) || maxClarifyingQuestions < 0) {
      setError("max_clarifying_questions må være et heltall >= 0.");
      return;
    }

    try {
      const payload = {
        title: form.title.trim(),
        classifier_description: form.classifier_description.trim(),
        system_prompt: form.system_prompt.trim(),
        micro_instructions: parseJsonObject(form.micro_instructions, "micro_instructions"),
        constraints: parseJsonObject(form.constraints, "constraints"),
        reclassify_rules: parseJsonObject(form.reclassify_rules, "reclassify_rules"),
        safety_rules: parseJsonObject(form.safety_rules, "safety_rules"),
        min_confidence: minConfidence,
        reclassify_turn_threshold: reclassifyTurnThreshold,
        max_clarifying_questions: maxClarifyingQuestions,
      };

      if (!payload.title || !payload.classifier_description || !payload.system_prompt) {
        setError("Title, classifier_description og system_prompt er påkrevd.");
        return;
      }

      setIsSaving(true);
      const saved = await saveTopicVersion(sessionToken, selectedTopic.topic_key, payload);

      setTopics((prev) => prev.map((topic) => (topic.topic_key === saved.topic_key ? saved : topic)));
      setSelectedTopicKey(saved.topic_key);
      setForm(formFromTopic(saved));
      setSuccess(`Lagret ny versjon v${saved.version_no}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre ny versjon.");
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

  const objectFieldSummary = (raw: string): string => {
    try {
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "Invalid format";
      const count = Object.keys(parsed).length;
      return `${count} felt`;
    } catch {
      return "Ugyldig JSON";
    }
  };

  if (!sessionToken) {
    return (
      <div className="topicDashboard">
        <div className="topicDashboard__empty">Logg inn for å bruke dashboard.</div>
      </div>
    );
  }

  return (
    <div className="topicDashboard">
      <header className="topicDashboard__header">
        <h1>Dashboard</h1>
      </header>

      <div className="topicDashboard__tabs" role="tablist" aria-label="Dashboard tabs">
        <button
          className={`topicDashboard__tab ${activeTab === "stats" ? "is-active" : ""}`}
          onClick={() => setActiveTab("stats")}
          role="tab"
          aria-selected={activeTab === "stats"}
        >
          Statistikk
        </button>
        <button
          className={`topicDashboard__tab ${activeTab === "temaer" ? "is-active" : ""}`}
          onClick={() => setActiveTab("temaer")}
          role="tab"
          aria-selected={activeTab === "temaer"}
        >
          Temaer
        </button>
      </div>

      <div className={`topicDashboard__panel ${activeTab === "stats" ? "topicDashboard__panel--stats" : ""}`}>
        {activeTab === "stats" ? (
          <section className="topicDashboard__statsPane">
            <div className="topicDashboard__statsHeader">
              <h2>Nokkelstatistikk</h2>
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
                    <div className="topicDashboard__statLabel">
                      Månedlig tokenkostnad (Estimert)
                      <span
                        className="topicDashboard__helpTip"
                        title="Disse tallene kan variere fra faktisk tokenbruk og er ikke helt nøyaktig."
                        aria-label="Disse tallene kan variere fra faktisk tokenbruk og er ikke helt nøyaktig."
                      >
                        ?
                      </span>
                    </div>
                    <div className="topicDashboard__statValue">{formatUsd(stats.monthly_estimated_token_cost_usd)}</div>
                  </article>
                  <article className="topicDashboard__statCard">
                    <div className="topicDashboard__statLabel">
                      Total tokenkostnad (Estimert)
                      <span
                        className="topicDashboard__helpTip"
                        title="Disse tallene kan variere fra faktisk tokenbruk og er ikke helt nøyaktig."
                        aria-label="Disse tallene kan variere fra faktisk tokenbruk og er ikke helt nøyaktig."
                      >
                        ?
                      </span>
                    </div>
                    <div className="topicDashboard__statValue">{formatUsd(stats.total_estimated_token_cost_usd)}</div>
                  </article>
                </div>

                <div className="topicDashboard__chartCard">
                  <div className="topicDashboard__chartTitle">Daglig tokenbruk</div>
                  <div className="topicDashboard__chartViewport">
                    <div className="topicDashboard__chartBars">
                    {(() => {
                      const maxTokens = Math.max(1, ...stats.daily_tokens.map((item) => item.total_tokens));
                      const labelStep = stats.daily_tokens.length > 20 ? 3 : stats.daily_tokens.length > 10 ? 2 : 1;
                      return stats.daily_tokens.map((item, index) => {
                        const hasTokens = item.total_tokens > 0;
                        const pct = hasTokens ? Math.max(0.08, item.total_tokens / maxTokens) : 0;
                        const label = item.day.slice(5);
                        const showLabel = index % labelStep === 0 || index === stats.daily_tokens.length - 1;
                        return (
                          <div className="topicDashboard__barItem" key={item.day}>
                            <div className="topicDashboard__barValue">{item.total_tokens.toLocaleString("nb-NO")}</div>
                            <div className="topicDashboard__barTrack">
                              <div
                                className={`topicDashboard__barFill ${hasTokens ? "" : "is-zero"}`}
                                style={{ height: `${pct * 100}%` }}
                              />
                            </div>
                            <div className={`topicDashboard__barLabel ${showLabel ? "" : "is-hidden"}`}>{label}</div>
                          </div>
                        );
                      });
                    })()}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : (
          <div className="topicDashboard__content">
          <aside className="topicDashboard__sidebar">
            {isLoading ? <div className="topicDashboard__hint">Laster temaer...</div> : null}
            {!isLoading && topics.length === 0 ? <div className="topicDashboard__hint">Ingen temaer funnet.</div> : null}
            {topics.map((topic) => (
              <div
                key={topic.topic_key}
                className={`topicDashboard__topicItem ${selectedTopicKey === topic.topic_key ? "is-active" : ""}`}
              >
                <button
                  className="topicDashboard__topicSelect"
                  onClick={() => setSelectedTopicKey(topic.topic_key)}
                  type="button"
                >
                  <div className="topicDashboard__topicTitle">{topic.title}</div>
                  <div className="topicDashboard__topicMeta">
                    {topic.topic_key} · v{topic.version_no} ·{" "}
                    {topic.classifier_embedding?.length ? "vector OK" : "vector mangler"}
                  </div>
                </button>
                <button
                  className="topicDashboard__topicVectorBtn"
                  type="button"
                  disabled={isCalculatingTopicKey === topic.topic_key}
                  onClick={() => handleCalculateVector(topic.topic_key)}
                >
                  {isCalculatingTopicKey === topic.topic_key ? "Kalkulerer..." : "Calculate vector"}
                </button>
              </div>
            ))}
          </aside>

          <section className="topicDashboard__formPane">
            {!selectedTopic || !form ? (
              <div className="topicDashboard__hint">Velg et tema for å redigere.</div>
            ) : (
              <>
                <div className="topicDashboard__statusRow">
                  <div className="topicDashboard__selectedMeta">
                    Aktivt tema: <b>{selectedTopic.topic_key}</b> (v{selectedTopic.version_no})
                  </div>
                  {success ? <div className="topicDashboard__success">{success}</div> : null}
                  {error ? <div className="topicDashboard__error">{error}</div> : null}
                </div>

                <div className="topicDashboard__formGrid">
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

                <details className="topicDashboard__advanced" open={showAdvanced}>
                  <summary onClick={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      className="topicDashboard__advancedToggle"
                      onClick={() => setShowAdvanced((prev) => !prev)}
                    >
                      {showAdvanced ? "Skjul avanserte JSON-felt" : "Vis avanserte JSON-felt"}
                    </button>
                  </summary>

                  {showAdvanced ? (
                    <div className="topicDashboard__advancedBody">
                      <div className="topicDashboard__jsonSummaryGrid">
                        <div className="topicDashboard__summaryField">
                          Micro instructions: {objectFieldSummary(form.micro_instructions)}
                        </div>
                        <div className="topicDashboard__summaryField">
                          Constraints: {objectFieldSummary(form.constraints)}
                        </div>
                        <div className="topicDashboard__summaryField">
                          Reclassify rules: {objectFieldSummary(form.reclassify_rules)}
                        </div>
                        <div className="topicDashboard__summaryField">
                          Safety rules: {objectFieldSummary(form.safety_rules)}
                        </div>
                      </div>

                      <div className="topicDashboard__formGrid">
                        <label>
                          Micro instructions (JSON object)
                          <textarea
                            rows={6}
                            value={form.micro_instructions}
                            onChange={(e) => updateField("micro_instructions", e.target.value)}
                          />
                        </label>

                        <label>
                          Constraints (JSON object)
                          <textarea
                            rows={6}
                            value={form.constraints}
                            onChange={(e) => updateField("constraints", e.target.value)}
                          />
                        </label>

                        <label>
                          Reclassify rules (JSON object)
                          <textarea
                            rows={6}
                            value={form.reclassify_rules}
                            onChange={(e) => updateField("reclassify_rules", e.target.value)}
                          />
                        </label>

                        <label>
                          Safety rules (JSON object)
                          <textarea
                            rows={6}
                            value={form.safety_rules}
                            onChange={(e) => updateField("safety_rules", e.target.value)}
                          />
                        </label>

                      </div>
                    </div>
                  ) : null}
                </details>

                <div className="topicDashboard__actions">
                  <button disabled={isSaving} onClick={handleSave}>
                    {isSaving ? "Lagrer..." : "Lagre ny versjon"}
                  </button>
                </div>
              </>
            )}
          </section>
          </div>
        )}
      </div>
    </div>
  );
}

