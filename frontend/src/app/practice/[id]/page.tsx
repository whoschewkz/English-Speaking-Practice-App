"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioProcessor, requestMicrophone, DEFAULT_AUDIO_CONFIG } from "@/utils/audioProcessor";
import { authFetch, authFetchForm, TokenStore } from "@/utils/auth";
import { useTheme, Icon } from "@/components/shared";

type Role = "system"|"user"|"assistant";
type Msg  = { role:Role; content:string };
type ScoreBlock = { range:number; accuracy:number; fluency:number; coherence:number; phonology:number; overall:number };
type Scores = ScoreBlock & { comment:string };
type Descriptors = Partial<{ range:string; accuracy:string; fluency:string; coherence:string; phonology:string }>;
type ObjMetrics  = Partial<{ total_words:number; unique_words:number; type_token_ratio:number; filler_per_100w:number; speech_rate_wpm:number|null; avg_sentence_len:number }>;
type ReflectOut  = { summary:string; error_patterns:{tag:string;description:string}[]; vocab_targets:{topic:string;items:string[]}[]; objectives_next:string[] };
type PlanOut     = { scenario:string; level:number; objectives:string[]; rubric:string[]; starter_turns:string[]; target_time_min:number };

function cefrKey(s:number){ if(s>=4.5)return"C1+"; if(s>=3.5)return"B2"; if(s>=2.5)return"B1"; if(s>=1.5)return"A2"; return"A1"; }
function clip(n:any):number{ const v=Number(n); return !Number.isFinite(v)?3:Math.max(1,Math.min(5,v)); }
function toP(s:number){ return Math.max(0,Math.min(100,((s-1)/4)*100)); }
function scoreCol(s:number){ return s>=3.5?"var(--accent)":s>=2.5?"var(--warn)":"var(--danger)"; }
function tipMsg(text:string){
  const t=text.toLowerCase();
  if(/\b(uh|um|like|you know)\b/.test(t)) return"Kurangi filler words — berhenti sejenak lebih alami.";
  if(t.split(/\s+/).length>30) return"Kalimat panjang — coba pisah menjadi kalimat lebih pendek.";
  if(/\bvery\b/.test(t)) return"Ganti 'very' dengan kata sifat yang lebih kuat.";
  return"Bagus! Terus pertahankan ritme berbicara.";
}

const mapTitle = (id:string) =>
  id==="1"?"Job Interview":id==="2"?"Daily Conversation":id==="3"?"Business Meeting":
  id==="4"?"Travel Situations":id==="agent"?"Rencana Latihan AI":"Skenario Khusus";
const mapOpen  = (id:string) =>
  id==="1"?"Hello! What position are you interviewing for today?":
  id==="2"?"Hi! Let's practice daily conversation. How's your day?":
  id==="3"?"Welcome to the meeting. Could you share your project update?":
  id==="4"?"You're at the airport check-in. May I see your passport, please?":
  "Hi! Let's begin. What would you like to practice today?";

const DIM:Record<string,string> = { range:"Kosakata", accuracy:"Tata Bahasa", fluency:"Kelancaran", coherence:"Koherensi", phonology:"Pelafalan" };

const DIM_TOOLTIP:Record<string,string> = {
  range:     "Keragaman & ketepatan kosakata yang digunakan",
  accuracy:  "Ketepatan struktur dan tata bahasa",
  fluency:   "Kelancaran bicara tanpa jeda atau filler berlebihan",
  coherence: "Kemampuan menyusun dan menghubungkan ide secara logis",
  phonology: "Kejelasan pengucapan, tekanan kata, dan intonasi",
  overall:   "Rata-rata dari kelima dimensi di atas",
};

const CEFR_DESC:Record<string,string> = {
  "A1":  "Pemula mutlak",
  "A2":  "Pemula — bisa komunikasi dasar",
  "B1":  "Menengah — bisa ungkapkan hal umum",
  "B2":  "Menengah atas — bisa diskusi kompleks",
  "C1+": "Mahir — hampir setara penutur asli",
};

function Tooltip({ text, children }:{ text:string; children:React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" style={{ cursor:"default" }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs pointer-events-none z-50 text-center leading-snug"
          style={{ background:"var(--text)", color:"var(--bg)", boxShadow:"0 4px 12px rgba(0,0,0,0.25)",
            whiteSpace:"normal", maxWidth:"200px" }}>
          {text}
        </span>
      )}
    </span>
  );
}

function ScoreBar({ label, value, highlight=false, dimKey="" }:{ label:string; value:number; highlight?:boolean; dimKey?:string }) {
  const col      = highlight ? "var(--accent)" : scoreCol(value);
  const cefr     = cefrKey(value);
  const dimTip   = dimKey ? DIM_TOOLTIP[dimKey] : "";
  const cefrTip  = CEFR_DESC[cefr] ?? "";
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <Tooltip text={dimTip}>
          <span className="text-sm" style={{ color:"var(--text2)", fontWeight: highlight ? 600 : 400,
            borderBottom: dimTip ? "1px dashed var(--border2)" : "none" }}>
            {label}
          </span>
        </Tooltip>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color:col }}>{value.toFixed(1)}/5</span>
          <Tooltip text={cefrTip}>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border"
              style={{ color:col, background:`${col}10`, borderColor:`${col}25` }}>
              {cefr}
            </span>
          </Tooltip>
        </div>
      </div>
      <div className="h-1.5 rounded-full" style={{ background:"var(--border2)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width:`${toP(value)}%`, background:col }} />
      </div>
    </div>
  );
}

export default function PracticeSessionPage({ params }:{ params:{ id:string } }) {
  const { id }   = params;
  const API      = (process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:8000").replace(/\/+$/,"");
  const isAgent  = id==="agent";
  const { dark } = useTheme();

  const [msgs,         setMsgs]         = useState<Msg[]>([]);
  const [isRec,        setIsRec]        = useState(false);
  const [transcript,   setTranscript]   = useState("");
  const [recError,     setRecError]     = useState<string|null>(null);
  const [audioPaths,   setAudioPaths]   = useState<string[]>([]);   // semua turn terekam
  const [thinking,     setThinking]     = useState(false);
  const [agentTitle,     setAgentTitle]     = useState("");
  const [agentLevel,     setAgentLevel]     = useState<number|null>(null);
  const [agentSystemCtx, setAgentSystemCtx] = useState<string>("");
  const [itemId,       setItemId]       = useState<number|null>(null);
  const [fbLoading,    setFbLoading]    = useState(false);
  const [feedback,     setFeedback]     = useState<Scores|null>(null);
  const [fbRaw,        setFbRaw]        = useState("");
  const [descriptors,  setDescriptors]  = useState<Descriptors|null>(null);
  const [objective,    setObjective]    = useState<ObjMetrics|null>(null);
  const [reflectLoad,  setReflectLoad]  = useState(false);
  const [reflectData,  setReflectData]  = useState<ReflectOut|null>(null);
  const [planLoad,     setPlanLoad]     = useState(false);
  const [planData,     setPlanData]     = useState<PlanOut|null>(null);
  const [ended,        setEnded]        = useState(false);
  const [mounted,      setMounted]      = useState(false);
  const [startAt,      setStartAt]      = useState<number|null>(null);
  const [elapsedTime,  setElapsedTime]  = useState("0:00");
  // Context skenario — dipakai di system prompt agar AI tetap on-topic
  const [scenarioCtx,  setScenarioCtx]  = useState<{ title:string; description:string }>({ title:"", description:"" });
  const [isSpeaking,     setIsSpeaking]     = useState(false);  // TTS sedang loading/playing
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [confirmEnd,     setConfirmEnd]     = useState(false);
  const [pendingBlob,    setPendingBlob]    = useState<Blob|null>(null);

  const audioRef    = useRef<AudioProcessor|null>(null);
  const streamRef   = useRef<MediaStream|null>(null);
  const chatRef     = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController|null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement|null>(null);  // referensi audio TTS aktif

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) { window.location.href="/auth"; return; }
  }, []);

  useEffect(() => { return () => { stopTTS(); }; }, []);

  const stopTTS = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = "";
      ttsAudioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speakTTS = async (text: string) => {
    stopTTS();
    setIsSpeaking(true);   // tampilkan indikator
    try {
      const r = await authFetch(`${API}/api/tts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, scenarioId: isAgent ? "agent" : id }),
      });
      if (!r.ok) { setIsSpeaking(false); return; }
      const blob  = await r.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); ttsAudioRef.current = null; setIsSpeaking(false); };
      audio.onerror = () => { setIsSpeaking(false); };
      audio.play().catch(() => setIsSpeaking(false));
    } catch { setIsSpeaking(false); }
  };

  useEffect(() => {
    if (!chatRef.current) return;
    requestAnimationFrame(() => chatRef.current?.scrollTo({ top:chatRef.current.scrollHeight, behavior:"smooth" }));
  }, [msgs.length]);

  useEffect(() => {
    if (!feedbackRef.current || !feedback) return;
    requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }, [feedback]);

  useEffect(() => {
    if (!startAt || ended) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startAt) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setElapsedTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startAt, ended]);

  useEffect(() => {
    if (!mounted) return;
    let alive=true;
    const ctrl=new AbortController();
    abortRef.current=ctrl;
    setStartAt(Date.now());
    (async () => {
      if (isAgent) {
        try {
          const r=await authFetch(`${API}/api/agent/next`);
          if (!r.ok) throw new Error();
          const d=await r.json();
          if (!alive) return;
          setAgentTitle(d.scenario||"Latihan Personal");
          setAgentLevel(Number.isFinite(d.level)?d.level:null);
          setItemId(d.item_id??null);
          setAgentSystemCtx(d.system_ctx||"");   // simpan context level/focus untuk chat
          setMsgs([{role:"assistant",content:d.prompt||"Let's begin!"}]); // pesan natural
        } catch {
          if (!alive) return;
          setAgentTitle("Latihan Personal"); setAgentLevel(2);
          setMsgs([{role:"assistant",content:"Hi! Let's practice speaking English. Tell me about yourself."}]);
        }
      } else {
        // Skenario bawaan (ID 1-4): pakai opener hardcoded supaya langsung tanpa delay
        const builtIn = ["1","2","3","4"];
        if (builtIn.includes(id)) {
          const title = mapTitle(id);
          setScenarioCtx({ title, description:"" });
          setMsgs([{role:"assistant",content:mapOpen(id)}]);
        } else {
          // Skenario custom dari admin: fetch judul+deskripsi, minta LLM buat opening yang relevan
          try {
            const listR = await authFetch(`${API}/api/scenarios`);
            const list  = listR.ok ? await listR.json() : [];
            const sc    = list.find((s:any) => String(s.id)===id);
            const title = sc?.title || "English Practice";
            const desc  = sc?.description || "";
            if (!alive) return;
            setScenarioCtx({ title, description: desc });

            const openR = await authFetch(`${API}/api/chat/open`, {
              method:"POST", headers:{"Content-Type":"application/json"},
              body: JSON.stringify({ scenarioTitle:title, scenarioDescription:desc }),
            });
            if (!alive) return;
            const openData = openR.ok ? await openR.json() : null;
            setMsgs([{role:"assistant",content:openData?.content||`Welcome to ${title}! Let's get started. Are you ready?`}]);
          } catch {
            if (!alive) return;
            setMsgs([{role:"assistant",content:"Welcome! Let's start practicing English. Are you ready?"}]);
          }
        }
      }
    })();
    return () => { alive=false; ctrl.abort(); };
  }, [mounted, API, id, isAgent]);

  useEffect(() => {
    const onKey=(e:KeyboardEvent)=>{
      if (e.code!=="Space"||ended) return;
      const tag=(document.activeElement?.tagName||"").toLowerCase();
      if (["input","textarea","button"].includes(tag)) return;
      e.preventDefault();
      if (thinking||fbLoading||isTranscribing) return;
      isRec ? stopRec() : startRec();
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  }, [isRec,thinking,fbLoading,ended]);

  const startRec=async()=>{
    if (ended||isRec||thinking||fbLoading) return;
    setRecError(null);
    setPendingBlob(null);
    try {
      const stream=await requestMicrophone(DEFAULT_AUDIO_CONFIG);
      streamRef.current=stream;
      audioRef.current=new AudioProcessor(DEFAULT_AUDIO_CONFIG);
      await audioRef.current.startRecording(stream);
      setIsRec(true);
    } catch(e){ setRecError(`Mikrofon error: ${(e as Error).message}`); }
  };

  const stopRec=async()=>{
    if (!audioRef.current) return;
    setIsRec(false);
    try {
      const blob=await audioRef.current.stopRecording();
      audioRef.current.cleanup(); audioRef.current=null; streamRef.current=null;
      await doTranscribe(blob);
    } catch { setMsgs(p=>[...p,{role:"assistant",content:"Audio error. Coba lagi."}]); }
  };

  const hardStop=()=>{
    try { audioRef.current?.cleanup(); audioRef.current=null; } catch {}
    try { streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; } catch {}
    setIsRec(false);
    setRecError(null);
  };

  const doTranscribe=async(blob:Blob)=>{
    if (ended) return;
    setIsTranscribing(true);
    setPendingBlob(null);
    const fd=new FormData();
    fd.append("audio",blob,"speech.wav");
    try {
      const r=await authFetchForm(`${API}/api/transcribe`,fd);
      if (!r.ok) throw new Error(await r.text());
      const d=await r.json();
      const t=d?.text||"";
      setTranscript(t);
      if (d?.audio_path) setAudioPaths(p => [...p, d.audio_path]);
      if (t) await sendToAI(t);
      else setMsgs(p=>[...p,{role:"assistant",content:"Suara tidak terdengar jelas. Coba lagi."}]);
    } catch { setPendingBlob(blob); }
    finally { setIsTranscribing(false); }
  };

  const retryTranscribe=()=>{
    if (!pendingBlob) return;
    const blob=pendingBlob;
    setPendingBlob(null);
    doTranscribe(blob);
  };

  const sendToAI=async(userText:string)=>{
    if (ended) return;
    const newMsgs:Msg[]=[...msgs,{role:"user",content:userText}];
    setMsgs(newMsgs); setThinking(true);
    try {
      const r=await authFetch(`${API}/api/chat`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          scenarioId:          isAgent?"agent":id,
          scenarioTitle:       isAgent ? (agentTitle||"AI Plan") : scenarioCtx.title,
          scenarioDescription: isAgent ? "" : scenarioCtx.description,
          agentSystemCtx:      isAgent ? agentSystemCtx : undefined,
          messages:            newMsgs,
        }),
      });
      if (!r.ok) throw new Error();
      const d=await r.json();
      const content=d?.content||"Could not generate a reply.";
      setMsgs(p=>[...p,{role:"assistant",content:content}]);
      speakTTS(content);
    } catch { setMsgs(p=>[...p,{role:"assistant",content:"Server error. Coba lagi."}]); }
    finally { setThinking(false); setTranscript(""); }
  };

  const endSession=async()=>{
    if (ended||thinking||isRec||fbLoading) return;
    setConfirmEnd(false);
    setPendingBlob(null);
    stopTTS(); hardStop();
    setFbLoading(true); setFeedback(null); setFbRaw(""); setDescriptors(null); setObjective(null); setRecError(null);
    const dur=startAt?Math.max(0,Math.round(((Date.now()-startAt)/60000)*100)/100):0;
    try {
      const fb=await authFetch(`${API}/api/feedback`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:msgs,duration_min:dur}),
      });
      const fbJson=await fb.json();
      if (fbJson?.scores) {
        const s=fbJson.scores as ScoreBlock;
        const scored:Scores={
          range:clip(s.range), accuracy:clip(s.accuracy), fluency:clip(s.fluency),
          coherence:clip(s.coherence), phonology:clip(s.phonology),
          overall:s.overall!==undefined?clip(s.overall):clip((clip(s.range)+clip(s.accuracy)+clip(s.fluency)+clip(s.coherence)+clip(s.phonology))/5),
          comment:fbJson.comment||"",
        };
        setFeedback(scored);
        if (fbJson.descriptors)       setDescriptors(fbJson.descriptors);
        if (fbJson.objective_metrics) setObjective(fbJson.objective_metrics);
        await authFetch(`${API}/api/sessions`,{
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            scenario:isAgent?agentTitle||"AI Plan":mapTitle(id),
            score_range:clip(s.range), score_accuracy:clip(s.accuracy),
            score_fluency:clip(s.fluency), score_coherence:clip(s.coherence),
            score_phonology:clip(s.phonology), comment:fbJson.comment||"", duration_min:dur,
            audio_paths:audioPaths,   // kirim semua turn — backend concatenate jadi satu file
          }),
        });
      } else { setFbRaw(fbJson?.content||"Tidak ada feedback yang dihasilkan."); }
      if (isAgent&&itemId) await authFetch(`${API}/api/agent/complete`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({item_id:itemId,done:true}),
      });
      setEnded(true);
    } catch { setFbRaw("Terjadi kesalahan saat memuat feedback."); }
    finally { setFbLoading(false); }
  };

  const doReflect=async()=>{
    if (!ended||reflectLoad||planLoad) return;
    setReflectData(null); setPlanData(null);
    let rj:ReflectOut|null=null;
    try {
      setReflectLoad(true);
      const r=await authFetch(`${API}/api/agent/reflect`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:msgs, feedback:feedback||{}, user_id:1}),
      });
      rj=await r.json(); setReflectData(rj);
    } catch { rj={summary:"Reflection gagal.",error_patterns:[],vocab_targets:[],objectives_next:[]}; setReflectData(rj); }
    finally { setReflectLoad(false); }
    try {
      setPlanLoad(true);
      const p=await authFetch(`${API}/api/agent/plan`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:1, error_patterns:rj?.error_patterns||[], objectives_next:rj?.objectives_next||[], vocab_targets:rj?.vocab_targets||[]}),
      });
      setPlanData(await p.json());
    } catch { setPlanData(null); }
    finally { setPlanLoad(false); }
  };

  const nextSession=(starter?:string)=>{
    stopTTS();
    if (isAgent&&planData?.scenario) setAgentTitle(planData.scenario);
    setEnded(false); setFeedback(null); setFbRaw(""); setDescriptors(null); setObjective(null);
    setReflectData(null); setPlanData(null); setTranscript(""); setAudioPaths([]); setStartAt(Date.now());
    setMsgs([{role:"assistant",content:starter||(isAgent?"Let's continue!":mapOpen(id))}]);
  };

  useEffect(()=>()=>{
    try { streamRef.current?.getTracks().forEach(t=>t.stop()); } catch {}
    try { audioRef.current?.cleanup(); } catch {}
  },[]);

  if (!mounted) return <div style={{ minHeight:"100vh", background:"var(--bg)" }} />;

  const sessionTitle = isAgent
    ? agentTitle||"Rencana Latihan AI"
    : scenarioCtx.title || mapTitle(id);
  const card = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"20px" };

  const statusLabel = thinking?"AI menjawab…":isTranscribing?"Memproses audio…":isRec?"Mendengarkan…":isSpeaking?"AI berbicara…":ended?"Selesai":"Berlangsung";
  const statusColor = thinking?"var(--warn)":isTranscribing?"var(--warn)":isRec?"var(--danger)":isSpeaking?"var(--accent)":ended?"var(--accent)":"var(--text3)";

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column" }}>
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b flex-shrink-0"
        style={{ background: dark?"rgba(12,12,16,0.92)":"rgba(246,246,248,0.92)", borderColor:"var(--border)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center gap-4">
          {/* Back */}
          <Link href="/practice" className="flex items-center gap-1.5 text-sm transition-colors flex-shrink-0"
            style={{ color:"var(--text3)" }}
            onMouseEnter={e=>(e.currentTarget.style.color="var(--text)")}
            onMouseLeave={e=>(e.currentTarget.style.color="var(--text3)")}>
            <Icon.Back width={14} height={14} />
            <span className="hidden sm:inline">Skenario</span>
          </Link>
          <div className="w-px h-4" style={{ background:"var(--border2)" }} />
          {/* Logo */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background:"var(--accent)" }}>
            <Icon.Mic width={13} height={13} style={{ stroke:"#0c0c10" }} />
          </div>
          {/* Title */}
          <span className="text-sm font-semibold truncate max-w-48 sm:max-w-72" style={{ color:"var(--text)" }}>
            {sessionTitle}
          </span>
          {isAgent&&agentLevel!==null&&(
            <span className="text-xs px-2.5 py-1 rounded-full border hidden sm:inline"
              style={{ color:"var(--text3)", borderColor:"var(--border2)", background:"var(--surface2)" }}>
              Level {agentLevel}
            </span>
          )}
          <div className="flex-1"/>
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold" style={{ color:"var(--text2)" }}>{elapsedTime}</span>
            <div className="w-px h-4" style={{ background:"var(--border2)" }} />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background:statusColor, boxShadow:isRec?`0 0 5px var(--danger)`:undefined }} />
              <span className="text-xs font-medium hidden sm:inline" style={{ color:statusColor }}>{statusLabel}</span>
            </div>
          </div>
          {/* Theme */}
          <button onClick={()=>{
            const next=!dark;
            document.documentElement.classList.toggle("dark",next);
            localStorage.setItem("theme",next?"dark":"light");
          }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color:"var(--text3)" }}>
            {dark?<Icon.Sun width={15} height={15}/>:<Icon.Moon width={15} height={15}/>}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-6 flex flex-col gap-5">

        {/* ── Feedback ── */}
        {(feedback||fbRaw) && (
          <div ref={feedbackRef} className="rounded-[20px] overflow-hidden" style={card}>
            <div className="px-7 py-5 border-b" style={{ borderColor:"var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                Hasil penilaian sesi
              </p>
            </div>
            {feedback ? (
              <div className="p-7">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    {(["range","accuracy","fluency","coherence","phonology"] as const).map(d=>(
                      <ScoreBar key={d} label={DIM[d]} value={feedback[d]} dimKey={d} />
                    ))}
                    <div className="pt-4 border-t" style={{ borderColor:"var(--border)" }}>
                      <ScoreBar label="Overall" value={feedback.overall} highlight dimKey="overall" />
                    </div>
                  </div>
                  <div className="space-y-5">
                    {feedback.comment&&(
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
                          Komentar
                        </p>
                        {/* Lead paragraph — border kiri accent, terasa seperti laporan yang ditulis, bukan ditempel */}
                        <div className="pl-4 border-l-2" style={{ borderColor:"var(--accent)" }}>
                          <p style={{ fontSize:15, lineHeight:1.75, color:"var(--text2)" }}>
                            {feedback.comment}
                          </p>
                        </div>
                      </div>
                    )}
                    {descriptors&&(
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
                          Deskriptor CEFR
                        </p>
                        {/* Structured entries — label dimensi sebagai eyebrow, divider antar item */}
                        <div>
                          {(Object.entries(descriptors) as [string,string][]).map(([k,v],idx)=>v&&(
                            <div key={k} className={idx>0 ? "mt-3 pt-3 border-t" : ""}
                              style={idx>0 ? { borderColor:"var(--border)" } : {}}>
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color:"var(--accent)" }}>
                                {DIM[k]||k}
                              </p>
                              <p className="text-sm leading-relaxed" style={{ color:"var(--text2)" }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {objective&&(
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:"var(--text3)" }}>Metrik objektif</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            {k:"total_words",     l:"Total kata"},
                            {k:"type_token_ratio",l:"Keragaman kata (%)"},
                            {k:"filler_per_100w", l:"Filler/100 kata"},
                            {k:"speech_rate_wpm", l:"Kecepatan (WPM)"},
                          ].map(({k,l})=>{
                            const v=objective[k as keyof ObjMetrics];
                            if (v===undefined||v===null) return null;
                            return (
                              <div key={k} className="rounded-xl p-3" style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
                                <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>{l}</p>
                                <p className="font-bold" style={{ color:"var(--text)" }}>{typeof v==="number"?v.toFixed(1):"—"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-7">
                <p className="text-sm" style={{ color:"var(--text2)" }}>{fbRaw}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Reflection ── */}
        {reflectData && (
          <div className="rounded-[20px] p-7" style={card}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>Refleksi sesi</p>
            {reflectData.summary&&<p className="text-sm leading-relaxed mb-4" style={{ color:"var(--text2)" }}>{reflectData.summary}</p>}
            {reflectData.error_patterns.length>0&&(
              <div className="flex flex-wrap gap-2 mb-4">
                {reflectData.error_patterns.map((e,i)=>(
                  <span key={i} className="text-xs px-3 py-1.5 rounded-xl border"
                    style={{ color:"var(--danger)", background:"rgba(239,68,68,0.08)", borderColor:"rgba(239,68,68,0.2)" }}>
                    #{e.tag} — {e.description}
                  </span>
                ))}
              </div>
            )}
            {reflectData.vocab_targets.length>0&&(
              <div>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color:"var(--text3)" }}>Vocab targets</p>
                <div className="flex flex-wrap gap-2">
                  {reflectData.vocab_targets.flatMap(v=>v.items.slice(0,5).map((w,i)=>(
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg border"
                      style={{ color:"var(--accent)", background:"var(--accent-dim)", borderColor:"var(--accent-border)" }}>
                      {w}
                    </span>
                  )))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Next Plan ── */}
        {planData && (
          <div className="rounded-[20px] p-7" style={card}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>Rencana sesi berikutnya</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {[planData.scenario, `Level ${planData.level}`, `${planData.target_time_min} menit`].map(t=>(
                <span key={t} className="text-xs px-3 py-1.5 rounded-xl border"
                  style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}>
                  {t}
                </span>
              ))}
            </div>
            {planData.starter_turns.length>0&&(
              <div className="space-y-2 mb-5">
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color:"var(--text3)" }}>Mulai dengan</p>
                {planData.starter_turns.map((s,i)=>(
                  <button key={i} onClick={()=>nextSession(s)}
                    className="w-full text-left text-sm px-4 py-3 rounded-xl border transition-all"
                    style={{ color:"var(--text2)", borderColor:"var(--border)", background:"var(--surface2)" }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent-border)")}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <button onClick={()=>nextSession(planData.starter_turns[0])}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background:"var(--accent)", color:"#0c0c10" }}>
              Mulai sesi berikutnya
            </button>
          </div>
        )}

        {/* ── Chat ── */}
        <div className="flex-1 rounded-[20px] overflow-hidden flex flex-col" style={{ ...card, minHeight:"360px" }}>
          <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor:"var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>Percakapan</p>
          </div>
          <div ref={chatRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
            style={{ maxHeight:"420px", opacity:ended?0.7:1 }}>
            {msgs.map((m,i)=>(
              <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
                {m.role==="assistant" && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5"
                    style={{ background:"var(--accent)" }}>
                    <Icon.Mic width={12} height={12} style={{ stroke:"#0c0c10" }} />
                  </div>
                )}
                <div className={[
                  "max-w-[78%] text-sm leading-relaxed px-4 py-3 whitespace-pre-wrap",
                  m.role==="user"
                    ? "rounded-2xl rounded-tr-sm border"
                    : "rounded-2xl rounded-tl-sm border",
                ].join(" ")}
                  style={m.role==="user"
                    ? { color:"var(--text)", background:"var(--surface2)", borderColor:"var(--border2)" }
                    : { color:"var(--text)", background:"var(--accent-dim)", borderColor:"var(--accent-border)" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center mr-2.5" style={{ background:"var(--accent)" }}>
                  <Icon.Mic width={12} height={12} style={{ stroke:"#0c0c10" }} />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-1.5"
                  style={{ background:"var(--accent-dim)", borderColor:"var(--accent-border)" }}>
                  {[0,1,2].map(i=>(
                    <div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background:"var(--accent)", animation:`bounce 1.2s ${i*0.2}s ease-in-out infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex-shrink-0 space-y-3 pb-6">
          {recError && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border"
              style={{ background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.2)" }}>
              <p className="text-sm" style={{ color:"var(--danger)" }}>{recError}</p>
              <button onClick={()=>setRecError(null)}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{ color:"var(--danger)", background:"rgba(239,68,68,0.1)" }}
                onMouseEnter={e=>(e.currentTarget.style.background="rgba(239,68,68,0.15)")}
                onMouseLeave={e=>(e.currentTarget.style.background="rgba(239,68,68,0.1)")}>
                Tutup
              </button>
            </div>
          )}
          {!ended ? (
            <>
              {pendingBlob && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border"
                  style={{ background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.2)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color:"var(--danger)" }}>Transkripsi gagal</p>
                    <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>Audio tersimpan — kamu bisa kirim ulang atau buang</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={()=>setPendingBlob(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface)" }}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--border)")}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border2)")}>
                      Buang
                    </button>
                    <button onClick={retryTranscribe}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                      style={{ background:"var(--accent)", color:"#0c0c10" }}
                      onMouseEnter={e=>(e.currentTarget.style.opacity="0.85")}
                      onMouseLeave={e=>(e.currentTarget.style.opacity="1")}>
                      Kirim ulang
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                {!isRec ? (
                  <button onClick={startRec} disabled={thinking||fbLoading||isTranscribing}
                    className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98] disabled:opacity-40"
                    style={{ color:"var(--text2)", background:"var(--surface)", borderColor:"var(--border2)" }}
                    onMouseEnter={e=>{if(!thinking&&!fbLoading){
                      e.currentTarget.style.borderColor="var(--accent)";
                      e.currentTarget.style.color="var(--accent)";
                      /* Glow halus saat hover — memberitahu user tombol ini interaktif */
                      e.currentTarget.style.boxShadow="0 0 0 3px rgba(0,200,150,0.10),0 4px 20px rgba(0,200,150,0.08)";
                    }}}
                    onMouseLeave={e=>{
                      e.currentTarget.style.borderColor="var(--border2)";
                      e.currentTarget.style.color="var(--text2)";
                      e.currentTarget.style.boxShadow="none";
                    }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:"var(--accent)" }}>
                      <Icon.Mic width={14} height={14} style={{ stroke:"#0c0c10" }} />
                    </div>
                    <span>Mulai berbicara</span>
                    <span className="hidden sm:inline ml-auto text-xs" style={{ color:"var(--text3)" }}>Tekan Spasi</span>
                  </button>
                ) : (
                  <>
                    <button onClick={stopRec}
                      className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98]"
                      style={{ color:"var(--danger)", background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.3)" }}>
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div className="absolute inset-0 rounded-xl" style={{ background:"rgba(239,68,68,0.2)", animation:"ripple 1.8s ease-out infinite" }} />
                        <div className="relative w-8 h-8 rounded-xl flex items-center justify-center border"
                          style={{ background:"rgba(239,68,68,0.12)", borderColor:"rgba(239,68,68,0.3)" }}>
                          <div className="w-3 h-3 rounded-sm" style={{ background:"var(--danger)" }} />
                        </div>
                      </div>
                      <span>Kirim jawaban</span>
                    </button>
                    <button onClick={hardStop}
                      className="px-5 py-4 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98]"
                      style={{ color:"var(--text2)", background:"var(--surface)", borderColor:"var(--border2)" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.color="var(--text2)";}}>
                      Batalkan
                    </button>
                  </>
                )}
                {!isRec && (
                  <button onClick={()=>stopTTS()}
                    className="px-4 py-4 rounded-2xl text-xs border transition-all"
                    style={{ color:"var(--text3)", background:"var(--surface)", borderColor:"var(--border)" }}
                    title="Hentikan suara AI yang sedang berbicara"
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.color="var(--text)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text3)";}}>
                    Stop Suara
                  </button>
                )}
              </div>

              {transcript && (
                <div className="px-5 py-3 rounded-2xl border" style={{ background:"var(--accent-dim)", borderColor:"var(--accent-border)" }}>
                  <p className="text-xs mb-1 font-medium" style={{ color:"var(--accent)" }}>Transkrip:</p>
                  <p className="text-sm" style={{ color:"var(--text2)" }}>{transcript}</p>
                </div>
              )}

              {confirmEnd ? (
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border"
                  style={{ background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.2)" }}>
                  <p className="text-sm" style={{ color:"var(--danger)" }}>Yakin akhiri sesi sekarang?</p>
                  <div className="flex gap-2">
                    <button onClick={()=>setConfirmEnd(false)}
                      className="text-xs px-4 py-1.5 rounded-lg border transition-colors"
                      style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface)" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)";}}>
                      Batal
                    </button>
                    <button onClick={endSession}
                      className="text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors"
                      style={{ background:"var(--danger)", color:"#fff" }}
                      onMouseEnter={e=>{e.currentTarget.style.opacity="0.85";}}
                      onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
                      Ya, akhiri
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>{ msgs.length > 1 ? setConfirmEnd(true) : endSession(); }}
                  disabled={thinking||isRec||fbLoading||isTranscribing}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98] disabled:opacity-30"
                  style={{ color:"var(--text2)", background:"var(--surface)", borderColor:"var(--border)" }}
                  onMouseEnter={e=>{if(!thinking&&!isRec&&!fbLoading&&!isTranscribing){e.currentTarget.style.color="var(--text)"; e.currentTarget.style.borderColor="var(--border2)";} }}
                  onMouseLeave={e=>{e.currentTarget.style.color="var(--text2)"; e.currentTarget.style.borderColor="var(--border)";}}>
                  {fbLoading ? (
                    <><Icon.Spinner width={16} height={16} style={{ stroke:"var(--text3)" }} /> Menganalisis…</>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z"/>
                        <path d="M19 15l.8 1.8L22 17l-1.8.8L19 20l-.8-1.2L16 17l2.2-.2L19 15z"/>
                      </svg>
                      Akhiri sesi &amp; dapatkan feedback
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-5 py-4 rounded-2xl border"
                style={{ background:"var(--accent-dim)", borderColor:"var(--accent-border)" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background:"var(--accent)" }} />
                <p className="text-sm" style={{ color:"var(--text2)" }}>Sesi selesai. Lihat feedback di atas atau mulai sesi baru.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>{ window.location.href="/practice"; }}
                  className="py-3.5 rounded-2xl text-sm font-medium border transition-all"
                  style={{ color:"var(--text2)", background:"var(--surface)", borderColor:"var(--border)" }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--border2)")}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
                  Pilih skenario lain
                </button>
                <div className="flex flex-col gap-1">
                  <button onClick={doReflect} disabled={reflectLoad||planLoad}
                    className="py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background:"var(--accent)", color:"#0c0c10" }}>
                    {reflectLoad||planLoad
                      ? <><Icon.Spinner width={14} height={14} style={{ stroke:"#0c0c10" }} /> Memproses…</>
                      : "Refleksi & rencana lanjut"}
                  </button>
                  <p className="text-xs text-center" style={{ color:"var(--text3)" }}>
                    Analisis kesalahan, target vocab & rekomendasi sesi berikutnya
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes ripple  { 0%{transform:scale(1);opacity:.55} 100%{transform:scale(1.75);opacity:0} }
      `}</style>
    </div>
  );
}