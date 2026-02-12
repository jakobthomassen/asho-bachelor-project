import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthProvider";
import {
  listTopicDashboardTopics,
  saveTopicVersion,
  type TopicDashboardTopic,
} from "../../../features/topicDashboard/api";
import "./TopicDashboardPage.css";

type TabKey = "temaer" | "later";

type TopicForm = {
  title: string;
  classifier_description: string;
  classifier_keywords: string;
  classifier_exclude_keywords: string;
  system_prompt: string;
  micro_instructions: string;
  constraints: string;
  pacing_rules: string;
  reclassify_rules: string;
  safety_rules: string;
  min_confidence: string;
  reclassify_turn_threshold: string;
  max_clarifying_questions: string;
  examples: string;
};

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function toKeywordText(values: string[]): string {
  return (values ?? []).join(", ");
}

function formFromTopic(topic: TopicDashboardTopic): TopicForm {
  return {
    title: topic.title,
    classifier_description: topic.classifier_description,
    classifier_keywords: toKeywordText(topic.classifier_keywords),
    classifier_exclude_keywords: toKeywordText(topic.classifier_exclude_keywords),
    system_prompt: topic.system_prompt,
    micro_instructions: toPrettyJson(topic.micro_instructions),
    constraints: toPrettyJson(topic.constraints),
    pacing_rules: toPrettyJson(topic.pacing_rules),
    reclassify_rules: toPrettyJson(topic.reclassify_rules),
    safety_rules: toPrettyJson(topic.safety_rules),
    min_confidence: String(topic.min_confidence),
    reclassify_turn_threshold: String(topic.reclassify_turn_threshold),
    max_clarifying_questions: String(topic.max_clarifying_questions),
    examples: toPrettyJson(topic.examples ?? []),
  };
}

function splitKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
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

function parseJsonArray(raw: string, fieldName: string): unknown[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} må være en JSON-liste.`);
    }
    return parsed;
  } catch {
    throw new Error(`${fieldName} inneholder ugyldig JSON.`);
  }
}

export default function TopicDashboardPage() {
  const { sessionToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("temaer");
  const [topics, setTopics] = useState<TopicDashboardTopic[]>([]);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string>("");
  const [form, setForm] = useState<TopicForm | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
        classifier_keywords: splitKeywords(form.classifier_keywords),
        classifier_exclude_keywords: splitKeywords(form.classifier_exclude_keywords),
        system_prompt: form.system_prompt.trim(),
        micro_instructions: parseJsonObject(form.micro_instructions, "micro_instructions"),
        constraints: parseJsonObject(form.constraints, "constraints"),
        pacing_rules: parseJsonObject(form.pacing_rules, "pacing_rules"),
        reclassify_rules: parseJsonObject(form.reclassify_rules, "reclassify_rules"),
        safety_rules: parseJsonObject(form.safety_rules, "safety_rules"),
        min_confidence: minConfidence,
        reclassify_turn_threshold: reclassifyTurnThreshold,
        max_clarifying_questions: maxClarifyingQuestions,
        examples: parseJsonArray(form.examples, "examples"),
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
          className={`topicDashboard__tab ${activeTab === "temaer" ? "is-active" : ""}`}
          onClick={() => setActiveTab("temaer")}
          role="tab"
          aria-selected={activeTab === "temaer"}
        >
          Temaer
        </button>
        <button
          className={`topicDashboard__tab ${activeTab === "later" ? "is-active" : ""}`}
          onClick={() => setActiveTab("later")}
          role="tab"
          aria-selected={activeTab === "later"}
        >
          Kommer senere
        </button>
      </div>

      {activeTab === "later" ? (
        <div className="topicDashboard__placeholder">Innhold kommer senere.</div>
      ) : (
        <div className="topicDashboard__content">
          <aside className="topicDashboard__sidebar">
            {isLoading ? <div className="topicDashboard__hint">Laster temaer...</div> : null}
            {!isLoading && topics.length === 0 ? <div className="topicDashboard__hint">Ingen temaer funnet.</div> : null}
            {topics.map((topic) => (
              <button
                key={topic.topic_key}
                className={`topicDashboard__topicItem ${selectedTopicKey === topic.topic_key ? "is-active" : ""}`}
                onClick={() => setSelectedTopicKey(topic.topic_key)}
              >
                <div className="topicDashboard__topicTitle">{topic.title}</div>
                <div className="topicDashboard__topicMeta">{topic.topic_key} · v{topic.version_no}</div>
              </button>
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
                    Classifier keywords (kommaseparert)
                    <input
                      value={form.classifier_keywords}
                      onChange={(e) => updateField("classifier_keywords", e.target.value)}
                    />
                  </label>

                  <label>
                    Exclude keywords (kommaseparert)
                    <input
                      value={form.classifier_exclude_keywords}
                      onChange={(e) => updateField("classifier_exclude_keywords", e.target.value)}
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
                    Micro instructions (JSON-objekt)
                    <textarea
                      rows={6}
                      value={form.micro_instructions}
                      onChange={(e) => updateField("micro_instructions", e.target.value)}
                    />
                  </label>

                  <label>
                    Constraints (JSON-objekt)
                    <textarea
                      rows={6}
                      value={form.constraints}
                      onChange={(e) => updateField("constraints", e.target.value)}
                    />
                  </label>

                  <label>
                    Pacing rules (JSON-objekt)
                    <textarea
                      rows={6}
                      value={form.pacing_rules}
                      onChange={(e) => updateField("pacing_rules", e.target.value)}
                    />
                  </label>

                  <label>
                    Reclassify rules (JSON-objekt)
                    <textarea
                      rows={6}
                      value={form.reclassify_rules}
                      onChange={(e) => updateField("reclassify_rules", e.target.value)}
                    />
                  </label>

                  <label>
                    Safety rules (JSON-objekt)
                    <textarea
                      rows={6}
                      value={form.safety_rules}
                      onChange={(e) => updateField("safety_rules", e.target.value)}
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

                  <label>
                    Examples (JSON-liste)
                    <textarea
                      rows={6}
                      value={form.examples}
                      onChange={(e) => updateField("examples", e.target.value)}
                    />
                  </label>
                </div>

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
  );
}
