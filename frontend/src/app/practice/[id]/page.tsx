"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

// Types
type Role = "system" | "user" | "assistant";
type Msg = { role: Role; content: string };

type ScoreBlock = {
  pronunciation: number;
  grammar: number;
  fluency: number;
  vocabulary: number;
  overall: number;
  coherence?: number; // optional dari backend
};

type Scores = ScoreBlock & { comment: string };

type Descriptors = Partial<{
  pronunciation: string;
  grammar: string;
  fluency: string;
  vocabulary: string;
  coherence: string;
}>;

type ObjectiveMetrics = Partial<{
  total_words: number;
  unique_words: number;
  type_token_ratio: number; // %
  avg_sentence_len: number;
  filler_per_100w: number;
  mean_utterance_len: number;
  speech_rate_wpm: number | null;
}>;

type ReflectOut = {
  summary: string;
  error_patterns: { tag: string; description: string; examples?: string[]; weight?: number }[];
  vocab_targets: { topic: string; items: string[] }[];
  objectives_next: string[];
};

type PlanGenOut = {
  scenario: string;
  level: number;
  objectives: string[];
  rubric: string[];
  starter_turns: string[];
  target_time_min: number;
};

// Helpers
const mapScenarioTitle = (id: string) =>
  id === "1" ? "Job Interview"
    : id === "2" ? "Daily Conversation"
    : id === "3" ? "Business Meeting"
    : id === "4" ? "Travel Situations"
    : id === "agent" ? "My Plan (Agent)"
    : "Custom Scenario";

const mapOpeningPrompt = (id: string) =>
  id === "1" ? "Hello! I'm your AI speaking partner. What position are you interviewing for today?"
    : id === "2" ? "Hi! Let's practice daily conversation. How's your day so far?"
    : id === "3" ? "Welcome to the meeting. Could you share your project update?"
    : id === "4" ? "You're at the airport check-in. May I see your passport, please?"
    : "Hi! Describe the custom scenario you'd like to practice.";

const Icon = {
  Mic: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M12 14v6" /><path d="M8 10v2a4 4 0 0 0 8 0v-2" /><path d="M5 20h14" />
    </svg>
  ),
  Stop: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
  ),
  Sparkle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
      <path d="M19 15l.8 1.8L22 17l-1.8.8L19 20l-.8-1.2L16 17l2.2-.2L19 15z" />
      <path d="M4 14l.7 1.6L6 16l-1.3.4L4 18l-.7-1.1L2 16l1.3-.1L4 14z" />
    </svg>
  ),
  Robot: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <rect x="4" y="7" width="16" height="12" rx="2" /><path d="M12 3v4" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
    </svg>
  ),
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
    </svg>
  ),
};

// Heuristic tip
function tipFromUserInput(text: string): string {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return "Keep answers concise and clear.";
  if (/\b(uh|um|like|you know)\b/.test(t)) return "Reduce filler words (um, uh, like). Pause briefly instead.";
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 30) return "Use shorter sentences to improve clarity.";
  if (/\b(i\s*am\s*not|don't|doesn't|didn't)\b/.test(t) && !/[.?!)]$/.test(t)) return "Finish sentences with clear punctuation when writing.";
  if (/\bvery\b/.test(t)) return "Try stronger adjectives instead of 'very' (e.g., 'excellent' instead of 'very good').";
  return "Aim for natural rhythm—speak in thought groups.";
}

export default function PracticeSessionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

  // conversation
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [aiThinking, setAiThinking] = useState(false);

  // agent
  const isAgentMode = id === "agent";
  const [agentScenario, setAgentScenario] = useState<string>("");
  const [agentLevel, setAgentLevel] = useState<number | null>(null);
  const [currentItemId, setCurrentItemId] = useState<number | null>(null);

  // feedback
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState<Scores | null>(null);
  const [finalFeedbackRaw, setFinalFeedbackRaw] = useState<string>("");

  // NEW: show descriptors & objective metrics
  const [descriptors, setDescriptors] = useState<Descriptors | null>(null);
  const [objective, setObjective] = useState<ObjectiveMetrics | null>(null);
  const [standards, setStandards] = useState<{ rubric?: string; notes?: string } | null>(null);

  // reflection & plan (optional, AFTER end)
  const [reflectLoading, setReflectLoading] = useState(false);
  const [reflectData, setReflectData] = useState<ReflectOut | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planData, setPlanData] = useState<PlanGenOut | null>(null);

  // session truly ended flag
  const [sessionEnded, setSessionEnded] = useState(false);

  // recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // session timing
  const [sessionStartAt, setSessionStartAt] = useState<number | null>(null);

  // refs
  const chatRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // formatter
  const fmt = useMemo(
    () => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }),
    []
  );

  const speak = (text: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 1;
      synth.cancel(); synth.speak(u);
    } catch {}
  };

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  // Auto-scroll
  useEffect(() => {
    if (!chatRef.current) return;
    requestAnimationFrame(() => chatRef.current!.scrollTo({ top: chatRef.current!.scrollHeight, behavior: "smooth" }));
  }, [messages.length]);

  // Space toggles recording (disabled after end)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || sessionEnded) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (["input", "textarea", "button"].includes(tag)) return;
      e.preventDefault();
      if (aiThinking || feedbackLoading) return;
      if (!isRecording) startRecording(); else stopRecording();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRecording, aiThinking, feedbackLoading, sessionEnded]);

  // INIT
  useEffect(() => {
    let alive = true;
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    (async () => {
      setSessionStartAt(Date.now());
      if (isAgentMode) {
        try {
          const r = await fetch(`${API_BASE}/api/agent/next`, { signal: ctrl.signal });
          if (!r.ok) throw new Error(await r.text());
          const data = await r.json();
          if (!alive) return;
          setAgentScenario(data.scenario || "Personalized Task");
          setAgentLevel(Number.isFinite(data.level) ? data.level : null);
          setCurrentItemId(data.item_id ?? null);
          setMessages([{ role: "assistant", content: data.prompt || "Let's begin. Tell me about your day." }]);
        } catch {
          if (!alive) return;
          setAgentScenario("Personalized Practice");
          setAgentLevel(2);
          setMessages([{ role: "assistant", content: "Hi! Let's practice daily conversation. How's your day so far?" }]);
        }
      } else {
        setAgentScenario("");
        setAgentLevel(null);
        setMessages([{ role: "assistant", content: mapOpeningPrompt(id) }]);
      }
    })();
    return () => { alive = false; ctrl.abort(); };
  }, [API_BASE, id, isAgentMode]);

  // Recording
  const startRecording = async () => {
    if (sessionEnded || isRecording || aiThinking || feedbackLoading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      currentStreamRef.current = stream;
      const supportWebm = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm");
      const options: MediaRecorderOptions = supportWebm ? { mimeType: "audio/webm" } : { mimeType: "audio/mp4" };
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        chunksRef.current = [];
        stream.getTracks().forEach((t) => t.stop()); currentStreamRef.current = null;
        await handleTranscribe(blob);
      };
      mediaRecorderRef.current = mr; mr.start(); setIsRecording(true);
    } catch {
      alert("Microphone permission denied or unsupported browser.");
    }
  };
  const stopRecording = () => {
    const mr = mediaRecorderRef.current; if (!mr) return;
    if (mr.state !== "inactive") mr.stop(); setIsRecording(false);
  };
  const hardStopRecording = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
    } catch {}
    try { currentStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    setIsRecording(false);
  };

  // Transcription
  const handleTranscribe = async (audioBlob: Blob) => {
    if (sessionEnded) return;
    const fd = new FormData();
    fd.append("audio", audioBlob, `speech.${audioBlob.type.includes("webm") ? "webm" : "mp4"}`);
    fd.append("language", "en");
    try {
      const resp = await fetch(`${API_BASE}/api/transcribe`, { method: "POST", body: fd, signal: abortRef.current?.signal });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const text = data?.text || "";
      setTranscript(text);
      if (text) await sendToAI(text);
    } catch {
      setTranscript("");
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, transcription failed. Please try again." }]);
    }
  };

  // Chat
  const sendToAI = async (userText: string) => {
    if (sessionEnded) return;
    const newMessages: Msg[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setAiThinking(true);
    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: isAgentMode ? "agent" : id, messages: newMessages }),
        signal: abortRef.current?.signal,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const content = data?.content || "I could not generate a reply.";
      const tip = tipFromUserInput(userText);
      const contentWithTip = `${content}\n\nTip: ${tip}`;
      setMessages((prev) => [...prev, { role: "assistant", content: contentWithTip }]);
      speak(content);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "There was an error contacting the server." }]);
    } finally {
      setAiThinking(false);
      setTranscript("");
    }
  };

  // End Session (ONLY feedback + save + mark complete)
  const handleEndSession = async () => {
    if (sessionEnded || aiThinking || isRecording || feedbackLoading) return;

    // stop everything
    window.speechSynthesis?.cancel();
    hardStopRecording();

    setFeedbackLoading(true);
    setFinalFeedback(null); setFinalFeedbackRaw("");
    setDescriptors(null); setObjective(null); setStandards(null);
    // reset optional sections
    setReflectData(null); setPlanData(null);
    setReflectLoading(false); setPlanLoading(false);

    const duration_min = (() => {
      if (!sessionStartAt) return 0;
      const ms = Date.now() - sessionStartAt;
      return Math.max(0, Math.round((ms / 1000 / 60) * 100) / 100);
    })();

    try {
      // 1) feedback (now sends duration_min)
      const fb = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, duration_min }),
        signal: abortRef.current?.signal,
      });
      const fbJson = await fb.json();

      // Parse structured feedback
      if (fbJson?.scores) {
        const s = fbJson.scores as ScoreBlock;
        const safe = (n: any) => Math.max(0, Math.min(10, Number(n) || 0));
        const scored: Scores = {
          pronunciation: safe(s.pronunciation),
          grammar: safe(s.grammar),
          fluency: safe(s.fluency),
          vocabulary: safe(s.vocabulary),
          overall: s.overall !== undefined
            ? safe(s.overall)
            : (safe(s.pronunciation) + safe(s.grammar) + safe(s.fluency) + safe(s.vocabulary)) / 4,
          coherence: s.coherence !== undefined ? safe(s.coherence) : undefined,
          comment: (fbJson.comment || "").toString(),
        };
        setFinalFeedback(scored);

        if (fbJson.descriptors) setDescriptors(fbJson.descriptors as Descriptors);
        if (fbJson.objective_metrics) setObjective(fbJson.objective_metrics as ObjectiveMetrics);
        if (fbJson.standards) setStandards(fbJson.standards as { rubric?: string; notes?: string });
      } else {
        setFinalFeedbackRaw(fbJson?.assessment || fbJson?.content || "No feedback generated.");
      }

      // 2) save session
      const scenarioName = isAgentMode ? agentScenario || "My Plan (Agent)" : mapScenarioTitle(id);
      if (finalFeedback || fbJson?.scores) {
        const s = (fbJson?.scores as ScoreBlock) || (finalFeedback as ScoreBlock);
        await fetch(`${API_BASE}/api/sessions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: scenarioName,
            score_overall: s.overall,
            score_pronunciation: s.pronunciation,
            score_grammar: s.grammar,
            score_fluency: s.fluency,
            score_vocabulary: s.vocabulary,
            comment: (fbJson?.comment || finalFeedback?.comment || ""),
            duration_min,
          }), signal: abortRef.current?.signal,
        });
      }

      // 3) mark agent item complete
      if (isAgentMode && currentItemId) {
        await fetch(`${API_BASE}/api/agent/complete`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: currentItemId, done: true }),
          signal: abortRef.current?.signal,
        });
      }

      // 4) mark UI ended — recording/chat disabled, next step optional
      setSessionEnded(true);
    } catch {
      setFinalFeedbackRaw("Error generating or saving feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Optional: Reflection & Next Plan (triggered AFTER end session)
  const handleReflectAndPlan = async () => {
    if (!sessionEnded || reflectLoading || planLoading) return;
    setReflectData(null); setPlanData(null);

    let rj: ReflectOut | null = null;

    try {
      setReflectLoading(true);
      const r = await fetch(`${API_BASE}/api/agent/reflect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          feedback: finalFeedback ? { scores: finalFeedback, comment: finalFeedback.comment } : null,
          user_id: 1, // single-user
        }),
        signal: abortRef.current?.signal,
      });
      if (!r.ok) throw new Error(await r.text());
      rj = await r.json();
      setReflectData(rj);
    } catch (e) {
      rj = {
        summary: "Reflection failed to generate.",
        error_patterns: [],
        vocab_targets: [],
        objectives_next: [],
      };
      setReflectData(rj);
    } finally {
      setReflectLoading(false);
    }

    try {
      setPlanLoading(true);
      const p = await fetch(`${API_BASE}/api/agent/plan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: 1,
          error_patterns: rj?.error_patterns || [],
          objectives_next: rj?.objectives_next || [],
          vocab_targets: rj?.vocab_targets || [],
        }),
        signal: abortRef.current?.signal,
      });
      if (!p.ok) throw new Error(await p.text());
      const pj: PlanGenOut = await p.json();
      setPlanData(pj);
    } catch {
      setPlanData(null);
    } finally {
      setPlanLoading(false);
    }
  };

  // helper to start the next session in-place
  const startNextSession = (starter?: string) => {
    try { window.speechSynthesis?.cancel(); } catch {}
    try { currentStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    setIsRecording(false);

    if (isAgentMode && planData?.scenario) {
      setAgentScenario(planData.scenario);
    }

    setSessionEnded(false);
    setFinalFeedback(null);
    setFinalFeedbackRaw("");
    setDescriptors(null);
    setObjective(null);
    setStandards(null);
    setReflectData(null);
    setPlanData(null);
    setReflectLoading(false);
    setPlanLoading(false);
    setTranscript("");
    setSessionStartAt(Date.now());

    const opening =
      starter ||
      (isAgentMode
        ? "Let's continue with your personalized practice. Ready?"
        : mapOpeningPrompt(id));

    setMessages([{ role: "assistant", content: opening }]);
  };

  // cleanup mic stream
  useEffect(() => () => { try { currentStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {} }, []);

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-blue-600 font-semibold">{Number.isFinite(value) ? value.toFixed(1) : "0.0"}/10</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.max(0, Math.min(10, value))}>
        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (Number.isFinite(value) ? value : 0) * 10))}%` }} />
      </div>
    </div>
  );

  const headingTitle = isAgentMode ? agentScenario || "My Plan (Agent)" : mapScenarioTitle(id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon.Robot className="h-5 w-5 text-violet-600" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Practice Session</h1>
          </div>
          <Link href="/practice" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => window.speechSynthesis?.cancel()}>
            Back to Scenarios
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Head */}
        <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{headingTitle}</h2>
              <p className="text-sm text-gray-500">{isAgentMode ? "Scenario from your learning plan" : "Selected scenario"}</p>
            </div>
            <div className="flex items-center gap-2">
              {isAgentMode && agentLevel !== null && (<span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">Level {agentLevel}</span>)}
              <span className={`px-3 py-1 rounded-full text-sm ${
                aiThinking ? "bg-blue-100 text-blue-800" : isRecording ? "bg-amber-100 text-amber-800" : sessionEnded ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
              }`}>
                {aiThinking ? "AI Thinking…" : isRecording ? "Listening…" : sessionEnded ? "Ended" : "In Progress"}
              </span>
            </div>
          </div>
        </section>

        {/* Final assessment */}
        {(finalFeedback || finalFeedbackRaw) && (
          <section className="mb-6 rounded-2xl border bg-gradient-to-b from-gray-50 to-white p-6 shadow-sm">
            <h3 className="font-semibold mb-3">Final Assessment</h3>
            {finalFeedback ? (
              <>
                {"coherence" in finalFeedback && finalFeedback.coherence !== undefined && (
                  <ScoreBar label="Coherence" value={finalFeedback.coherence!} />
                )}
                <ScoreBar label="Pronunciation" value={finalFeedback.pronunciation} />
                <ScoreBar label="Grammar" value={finalFeedback.grammar} />
                <ScoreBar label="Fluency" value={finalFeedback.fluency} />
                <ScoreBar label="Vocabulary" value={finalFeedback.vocabulary} />
                <div className="mt-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold">Overall</span>
                    <span className="text-green-600 font-bold">{Number.isFinite(finalFeedback.overall) ? finalFeedback.overall.toFixed(1) : "0.0"}/10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.max(0, Math.min(10, finalFeedback.overall))}>
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (Number.isFinite(finalFeedback.overall) ? finalFeedback.overall : 0) * 10))}%` }} />
                  </div>
                </div>
                {finalFeedback.comment && <p className="text-gray-700 mt-4 whitespace-pre-line">{finalFeedback.comment}</p>}
              </>
            ) : (
              <p className="text-gray-700 whitespace-pre-line">{finalFeedbackRaw}</p>
            )}
          </section>
        )}

        {/* NEW: Analytic Descriptors */}
        {descriptors && (
          <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Analytic Descriptors (CEFR-aligned)</h3>
              {standards?.rubric && <span className="text-xs text-gray-500">{standards.rubric}</span>}
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              {descriptors.coherence && <li><span className="font-semibold">Coherence:</span> {descriptors.coherence}</li>}
              {descriptors.pronunciation && <li><span className="font-semibold">Pronunciation:</span> {descriptors.pronunciation}</li>}
              {descriptors.grammar && <li><span className="font-semibold">Grammar:</span> {descriptors.grammar}</li>}
              {descriptors.fluency && <li><span className="font-semibold">Fluency:</span> {descriptors.fluency}</li>}
              {descriptors.vocabulary && <li><span className="font-semibold">Vocabulary:</span> {descriptors.vocabulary}</li>}
            </ul>
            {standards?.notes && <p className="mt-3 text-xs text-gray-500">{standards.notes}</p>}
          </section>
        )}

        {/* NEW: Objective Metrics */}
        {objective && (
          <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold mb-2">Objective Metrics</h3>
            <div className="grid gap-2 sm:grid-cols-2 text-sm text-gray-700">
              {"speech_rate_wpm" in objective && objective.speech_rate_wpm !== undefined && (
                <div><span className="font-medium">Speech rate (WPM):</span> {objective.speech_rate_wpm ?? "—"}</div>
              )}
              {"type_token_ratio" in objective && (
                <div><span className="font-medium">Type-Token Ratio:</span> {objective.type_token_ratio}%</div>
              )}
              {"filler_per_100w" in objective && (
                <div><span className="font-medium">Filler / 100 words:</span> {objective.filler_per_100w}</div>
              )}
              {"avg_sentence_len" in objective && (
                <div><span className="font-medium">Avg sentence length:</span> {objective.avg_sentence_len}</div>
              )}
              {"mean_utterance_len" in objective && (
                <div><span className="font-medium">Mean utterance length:</span> {objective.mean_utterance_len}</div>
              )}
              {"total_words" in objective && (
                <div><span className="font-medium">Total words:</span> {objective.total_words}</div>
              )}
              {"unique_words" in objective && (
                <div><span className="font-medium">Unique words:</span> {objective.unique_words}</div>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-500">Note: Metrics dihitung dari transkrip ujaran pengguna dan durasi sesi.</p>
          </section>
        )}

        {/* Session Reflection (optional, after end) */}
        {reflectData && (
          <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Session Reflection</h3>
              {reflectLoading && <span className="text-xs text-blue-600">Updating…</span>}
            </div>
            {reflectData.summary && <p className="text-gray-700 mb-4">{reflectData.summary}</p>}
            {reflectData.error_patterns?.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Key Error Patterns</div>
                <div className="flex flex-wrap gap-2">
                  {reflectData.error_patterns.map((e, i) => (
                    <span key={i} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                      <span className="font-semibold">#{e.tag}</span>
                      <span className="text-gray-600">{e.description}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {reflectData.vocab_targets?.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Vocab Targets</div>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {reflectData.vocab_targets.flatMap((v, i) =>
                    v.items.slice(0, 6).map((w, j) => <li key={`${i}-${j}`}>{w}</li>)
                  )}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Next Session Plan (optional, after end) */}
        {planData && (
          <section className="mb-10 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Next Session Plan</h3>
              {planLoading && <span className="text-xs text-blue-600">Generating…</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">{planData.scenario}</span>
              <span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">Level {planData.level}</span>
              <span className="px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800">{planData.target_time_min} min</span>
            </div>
            {planData.objectives?.length > 0 && (
              <>
                <div className="text-sm font-medium mb-1">Objectives</div>
                <ul className="list-disc list-inside text-sm text-gray-700 mb-4">
                  {planData.objectives.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </>
            )}
            {planData.rubric?.length > 0 && (
              <>
                <div className="text-sm font-medium mb-1">Rubric (self-check)</div>
                <ul className="space-y-1 text-sm text-gray-700 mb-4">
                  {planData.rubric.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {planData.starter_turns?.length > 0 && (
              <>
                <div className="text-sm font-medium mb-1">Starter Turns</div>
                <div className="flex flex-col gap-2">
                  {planData.starter_turns.map((s, i) => (
                    <button
                      key={i}
                      className="text-left rounded-xl border px-3 py-2 hover:bg-gray-50"
                      onClick={() => startNextSession(s)}
                      title="Use this to start next session"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <button
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4"
                    onClick={() => startNextSession(planData.starter_turns[0])}
                    title="Start a new session right away"
                  >
                    Start Next Session Now
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Conversation */}
        <section className="mb-6 rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="bg-gray-50 p-4 border-b"><h3 className="font-medium">Conversation</h3></div>
          <div ref={chatRef} className={`p-6 max-h-96 overflow-y-auto space-y-4 ${sessionEnded ? "opacity-90" : ""}`}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed shadow-sm ${
                  m.role === "user" ? "bg-gray-900 text-white rounded-br-sm" : "bg-blue-50 text-blue-900 rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Controls */}
        <section className="mb-6">
          {!sessionEnded ? (
            <>
              <div className="flex gap-3">
                {!isRecording ? (
                  <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 shadow disabled:opacity-60"
                    onClick={startRecording} disabled={aiThinking || feedbackLoading}>
                    <Icon.Mic className="h-5 w-5" /> Start Speaking
                  </button>
                ) : (
                  <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white py-3 px-4 shadow"
                    onClick={stopRecording}>
                    <Icon.Stop className="h-5 w-5" /> Stop
                  </button>
                )}
                <button className="flex-1 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 py-3 px-4" onClick={() => window.speechSynthesis?.cancel()}>
                  Stop TTS
                </button>
              </div>

              <button className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white py-3 px-4 disabled:opacity-60 shadow"
                onClick={handleEndSession} disabled={aiThinking || isRecording || feedbackLoading}>
                <Icon.Sparkle className={`h-5 w-5 ${feedbackLoading ? "animate-pulse" : ""}`} />
                {feedbackLoading ? "Generating Final Assessment…" : "End Session & Get Feedback"}
              </button>

              {transcript && (
                <div className="text-center mt-4 bg-gray-50 p-3 rounded-xl border">
                  <span className="font-semibold">Your Speech (transcribed):</span>
                  <p className="mt-1 text-gray-700">{transcript}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4 mb-3">
                <p className="text-sm text-gray-700">
                  ✅ Session ended. You can start a new session or continue to Reflection & Next Plan.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  className="rounded-xl border bg-white hover:bg-gray-50 py-3 px-4"
                  onClick={() => { window.location.href = "/practice"; }}
                >
                  Start New Session
                </button>
                <button
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-3 px-4 disabled:opacity-60"
                  onClick={handleReflectAndPlan}
                  disabled={reflectLoading || planLoading}
                  title="Generate Reflection & Next Plan"
                >
                  {reflectLoading || planLoading ? "Preparing Reflection & Plan…" : "Reflection & Next Plan"}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Note */}
        <section className="mb-10 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Real-time Feedback</h2>
          <p className="text-gray-600 text-sm">A concise tip is appended to each assistant reply to guide your improvement.</p>
          <div className="mt-3 text-xs text-gray-500">Local time: {fmt.format(new Date())}</div>
        </section>
      </div>
    </main>
  );
}
