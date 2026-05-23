import React, { useState } from "react";
import { JobApplication, Resume } from "../types";
import { 
  Briefcase, Calendar, MapPin, Coins, Trash2, Edit3, MessageCircle, 
  FileText, CheckCircle2, Award, Clock, ArrowRight, CornerDownRight, 
  Sparkles, Brain, BookOpen, Terminal, Check, Loader2, ChevronDown, ChevronUp,
  TrendingUp, BarChart4, Lightbulb, UserCheck, ShieldCheck
} from "lucide-react";

interface ApplicationTrackerProps {
  applications: JobApplication[];
  onUpdateStatus: (id: string, status: JobApplication["status"]) => void;
  onDeleteApplication: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onAddResume?: (fresh: Resume) => void;
}

interface InterviewQuestion {
  questionText: string;
  questionType: string;
  answerFramework: string;
  userAnswer?: string;
  evaluation?: {
    score: number;
    critique: string;
    perfectResponse: string;
  };
}

export default function ApplicationTracker({
  applications,
  onUpdateStatus,
  onDeleteApplication,
  onUpdateNotes,
  onAddResume,
}: ApplicationTrackerProps) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");

  const selectedApp = applications.find((app) => app.id === selectedAppId);

  // Detail Drawer Tab Switcher
  const [detailTab, setDetailTab] = useState<"profile" | "interview">("profile");

  // Persistent interview questions cache Map
  const [interactionMap, setInteractionMap] = useState<Record<string, InterviewQuestion[]>>(() => {
    try {
      const saved = localStorage.getItem("job_companion_interviews_v2");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [evaluatingIdx, setEvaluatingIdx] = useState<number | null>(null);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [frameworkToggles, setFrameworkToggles] = useState<Record<number, boolean>>({});
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);

  const getStatusBadge = (status: JobApplication["status"]) => {
    switch (status) {
      case "interested":
        return { text: "有意向", bg: "bg-zinc-100 text-zinc-700 border-zinc-200" };
      case "matched":
        return { text: "AI已分析", bg: "bg-indigo-50 text-indigo-700 border-indigo-100" };
      case "tailored":
        return { text: "已微调简历", bg: "bg-violet-50 text-violet-700 border-violet-100" };
      case "applied":
        return { text: "已投递", bg: "bg-blue-50 text-blue-700 border-blue-100" };
      case "interviewing":
        return { text: "面试中 💬", bg: "bg-amber-50 text-amber-700 border-amber-100" };
      case "offer":
        return { text: "录用 Offer 🎉", bg: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      case "rejected":
        return { text: "不合适", bg: "bg-rose-50 text-rose-700 border-rose-100" };
    }
  };

  const startEditingNotes = (app: JobApplication) => {
    setEditingNotesId(app.id);
    setTempNotes(app.notes || "");
  };

  const saveNotes = (id: string) => {
    onUpdateNotes(id, tempNotes);
    setEditingNotesId(null);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Generate customized 1v1 technical/situational questions
  const handleGenerateQuestions = async (app: JobApplication) => {
    setIsGenerating(true);
    setInterviewError(null);
    try {
      const resumeToSend = app.tailoredResume || {
        fullName: "求职者本人",
        title: app.position,
        summary: "具备成熟精深开发底盘，精于业务架构交付与细节性能优化。",
        skills: ["React", "TypeScript", "Node.js", "系统重构"],
        experience: [],
        education: []
      };

      const response = await fetch("/api/gemini/interview-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: resumeToSend,
          jdText: app.jdText || "岗位名称为：" + app.position + "，所属企业为：" + app.company,
          company: app.company,
          position: app.position,
        }),
      });

      if (!response.ok) {
        throw new Error("生成失败，请检查安全配置中的 GEMINI_API_KEY。");
      }

      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        const nextMap = {
          ...interactionMap,
          [app.id]: data.questions
        };
        setInteractionMap(nextMap);
        localStorage.setItem("job_companion_interviews_v2", JSON.stringify(nextMap));
      } else {
        throw new Error("AI 预测服务未返回有效问题元组。");
      }
    } catch (err: any) {
      console.error(err);
      setInterviewError(err.message || "连接仿真真题预测服务器失败，请重试！");
    } finally {
      setIsGenerating(false);
    }
  };

  // Evaluate candidate draft answer
  const handleEvaluateAnswer = async (appId: string, qIdx: number, questionText: string, userAnswer: string) => {
    if (!userAnswer.trim()) {
      alert("请输入您的核心思路、技术点或口作答案草稿，再叫 AI 考官帮您评判。");
      return;
    }

    setEvaluatingIdx(qIdx);
    setInterviewError(null);
    try {
      const app = applications.find(a => a.id === appId);
      const resumeToSend = app?.tailoredResume || {
        fullName: "求职者本人",
        title: app?.position || "核心骨干",
        skills: ["React", "TypeScript", "量化提效"],
        summary: ""
      };

      const response = await fetch("/api/gemini/evaluate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionText,
          answer: userAnswer,
          resume: resumeToSend,
          jdText: app?.jdText || ""
        }),
      });

      if (!response.ok) {
        throw new Error("评定失败，请稍候重试。");
      }

      const result = await response.json();
      const currentQuestions = [...(interactionMap[appId] || [])];
      if (currentQuestions[qIdx]) {
        currentQuestions[qIdx] = {
          ...currentQuestions[qIdx],
          userAnswer,
          evaluation: {
            score: result.score,
            critique: result.critique,
            perfectResponse: result.perfectResponse
          }
        };

        const nextMap = {
          ...interactionMap,
          [appId]: currentQuestions
        };
        setInteractionMap(nextMap);
        localStorage.setItem("job_companion_interviews_v2", JSON.stringify(nextMap));
      }
    } catch (err: any) {
      console.error(err);
      setInterviewError(err.message || "仿真面试评审教练接口发生网络阻塞。");
    } finally {
      setEvaluatingIdx(null);
    }
  };

  // Sync userAnswer textarea in place so state is kept
  const handleUpdateDraft = (appId: string, qIdx: number, val: string) => {
    const currentQuestions = [...(interactionMap[appId] || [])];
    if (currentQuestions[qIdx]) {
      currentQuestions[qIdx] = {
        ...currentQuestions[qIdx],
        userAnswer: val
      };
      const nextMap = {
        ...interactionMap,
        [appId]: currentQuestions
      };
      setInteractionMap(nextMap);
      localStorage.setItem("job_companion_interviews_v2", JSON.stringify(nextMap));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-zinc-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Briefcase className="text-indigo-600" /> 投递管家与智能跟踪看板 (Submissions Tracker)
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">记录每一次岗位在匹配微调室微调后的记录，追踪内推或BOSS沟通节点</p>
        </div>
        <div className="text-xs text-zinc-400 font-mono">
          共注册 {applications.length} 个投递阶段
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-zinc-100 shadow-xs space-y-3">
          <div className="p-4 bg-zinc-50 rounded-full w-fit mx-auto text-zinc-400">
            <Briefcase size={28} />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <p className="text-sm font-bold text-zinc-800">暂无岗位投递记录</p>
            <p className="text-xs text-zinc-400">
              您可以前往“AI 岗位精匹配”房间，粘贴心仪岗位的 JD 评定完成后点击“应用并保存”，即可立即在此登记追踪。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Conversion Funnel Dashboard */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-5 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                    <BarChart4 size={12} className="text-indigo-600" /> LIVE STATS FUNNEL
                  </span>
                  <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
                    求职效能引擎
                  </span>
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mt-1">
                  多端求职投递转化漏斗与统计数据面板
                </h3>
                <p className="text-xs text-zinc-500">
                  基于您当前登记的 {applications.length} 桩求职流程，实时监控人岗过筛率、简历微调分布，指引高效收获 Offer！
                </p>
              </div>

              {/* Calculated dynamic statistics KPIs */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl px-3 py-2 text-center shrink-0 min-w-[90px]">
                  <span className="text-[9px] text-zinc-400 font-bold block uppercase mb-0.5">简历精调率</span>
                  <span className="text-xs font-black text-indigo-700 font-mono">
                    {applications.length > 0 ? Math.round((applications.filter(a => a.tailoredResume).length / applications.length) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl px-3 py-2 text-center shrink-0 min-w-[90px]">
                  <span className="text-[9px] text-zinc-400 font-bold block uppercase mb-0.5">意向约面率</span>
                  <span className="text-xs font-black text-amber-700 font-mono">
                    {applications.length > 0 ? Math.round((applications.filter(a => a.status === "interviewing" || a.status === "offer").length / applications.length) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl px-3 py-2 text-center shrink-0 min-w-[90px]">
                  <span className="text-[9px] text-zinc-400 font-bold block uppercase mb-0.5">Offer 捷报</span>
                  <span className="text-xs font-black text-emerald-600 font-mono flex items-center gap-0.5 justify-center">
                    🏆 {applications.filter(a => a.status === "offer").length} 个
                  </span>
                </div>
              </div>
            </div>

            {/* Conversion Stages Layout */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-155 select-none text-zinc-700">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center relative">
                
                {/* stage 1 */}
                <div className="bg-white p-3 rounded-xl border border-zinc-150 text-center flex flex-col justify-between h-20 shadow-3xs transition-all hover:shadow-2xs">
                  <span className="text-[9px] font-bold text-zinc-400 block tracking-wider uppercase">阶段一: 评估筛选</span>
                  <h4 className="text-[11px] font-bold text-zinc-700 leading-none">有意向 / AI 匹配中</h4>
                  <span className="text-base font-black text-zinc-900 font-mono mt-1">
                    {applications.filter(a => a.status === "interested" || a.status === "matched").length} <span className="text-[9px] text-zinc-400 font-normal">个</span>
                  </span>
                </div>

                {/* transition 1 */}
                <div className="flex md:flex-col items-center justify-center text-zinc-300 text-xs py-0.5">
                  <span className="font-bold hidden md:inline text-zinc-300">➔</span>
                  <span className="font-bold md:hidden text-zinc-300">↓</span>
                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[8.5px] px-1.5 py-0.2 mt-0.5 rounded-full font-mono scale-90">
                    精调变位率: {
                      (applications.filter(a => a.status === "interested" || a.status === "matched").length + applications.filter(a => a.status === "tailored").length) > 0
                        ? Math.round((applications.filter(a => a.status === "tailored").length / (applications.filter(a => a.status === "interested" || a.status === "matched").length + applications.filter(a => a.status === "tailored").length)) * 100)
                        : 0
                    }%
                  </span>
                </div>

                {/* stage 2 */}
                <div className="bg-white p-3 rounded-xl border border-zinc-150 text-center flex flex-col justify-between h-20 shadow-3xs transition-all hover:shadow-2xs">
                  <span className="text-[9px] font-bold text-zinc-400 block tracking-wider uppercase">阶段二: 定制细节</span>
                  <h4 className="text-[11px] font-bold text-indigo-700 leading-none">已完成简历精微调校</h4>
                  <span className="text-base font-black text-zinc-900 font-mono mt-1">
                    {applications.filter(a => a.status === "tailored").length} <span className="text-[9px] text-zinc-400 font-normal">个</span>
                  </span>
                </div>

                {/* transition 2 */}
                <div className="flex md:flex-col items-center justify-center text-zinc-300 text-xs py-0.5">
                  <span className="font-bold hidden md:inline text-zinc-300">➔</span>
                  <span className="font-bold md:hidden text-zinc-300">↓</span>
                  <span className="bg-blue-50 border border-blue-100 text-blue-700 font-extrabold text-[8.5px] px-1.5 py-0.2 mt-0.5 rounded-full font-mono scale-90">
                    跑批投出率: {
                      (applications.filter(a => a.status === "tailored").length + applications.filter(a => a.status === "applied").length) > 0
                        ? Math.round((applications.filter(a => a.status === "applied").length / (applications.filter(a => a.status === "tailored").length + applications.filter(a => a.status === "applied").length)) * 100)
                        : 0
                    }%
                  </span>
                </div>

                {/* stage 3 */}
                <div className="bg-white p-3 rounded-xl border border-zinc-150 text-center flex flex-col justify-between h-20 shadow-3xs transition-all hover:shadow-2xs">
                  <span className="text-[9px] font-bold text-zinc-400 block tracking-wider uppercase font-semibold">阶段三: 巡航分发</span>
                  <h4 className="text-[11px] font-bold text-emerald-700 leading-none">已正式提交 / 面试中</h4>
                  <span className="text-base font-black text-zinc-900 font-mono mt-1">
                    {applications.filter(a => a.status === "applied" || a.status === "interviewing" || a.status === "offer").length} <span className="text-[9px] text-zinc-400 font-normal">个</span>
                  </span>
                </div>

              </div>

              {/* Conversion bar statistics metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-zinc-200/50 text-[11px] text-zinc-500 font-normal">
                <div className="bg-white p-3 rounded-xl border border-zinc-150 flex items-center gap-2.5">
                  <div className="bg-amber-50 text-amber-600 p-2 rounded-lg border border-amber-100 shrink-0">
                    <TrendingUp size={14} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-400 font-bold block uppercase tracking-wide">沟通反馈与转面率潜力值:</span>
                    <p className="font-bold text-zinc-800 leading-snug">
                      投递中，有 <span className="text-amber-600 font-extrabold">{
                        applications.filter(a => a.status === "applied" || a.status === "interviewing" || a.status === "offer").length > 0
                          ? Math.round((applications.filter(a => a.status === "interviewing" || a.status === "offer").length / (applications.filter(a => a.status === "applied" || a.status === "interviewing" || a.status === "offer").length)) * 100)
                          : 0
                      }%</span> 的代递项目成功得到HR回复沟通，并获得排队约面反馈。
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-150 flex items-center gap-2.5">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg border border-emerald-100 shrink-0">
                    <Award size={14} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-400 font-bold block uppercase tracking-wide">终审成星捷报率 (Interview-to-Offer):</span>
                    <p className="font-bold text-zinc-800 leading-snug">
                      通过面试考训，有 <span className="text-emerald-600 font-extrabold">{
                        (applications.filter(a => a.status === "interviewing").length + applications.filter(a => a.status === "offer").length) > 0
                          ? Math.round((applications.filter(a => a.status === "offer").length / (applications.filter(a => a.status === "interviewing").length + applications.filter(a => a.status === "offer").length)) * 100)
                          : 0
                      }%</span> 的面试经历拿到了沉甸甸的 Offer 正式通知纸！
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main List Column */}
          <div className="lg:col-span-7 space-y-3">
            {applications.map((app) => {
              const badge = getStatusBadge(app.status);
              const isSelected = app.id === selectedAppId;
              return (
                <div
                  key={app.id}
                  onClick={() => {
                    setSelectedAppId(app.id);
                    // Open to basic profile on click
                    setDetailTab("profile");
                  }}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start gap-4 ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-50/50 shadow-sm"
                      : "border-zinc-100 hover:border-zinc-300 shadow-2xs"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-extrabold text-zinc-900">{app.company}</h3>
                        <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-md ${badge.bg}`}>
                          {badge.text}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 font-medium">{app.position}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                      {app.salary && (
                        <span className="flex items-center gap-1">
                          <Coins size={12} className="text-zinc-400" /> {app.salary}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-zinc-400" /> 触发于 {app.appliedDate}
                      </span>
                    </div>

                    {app.notes && (
                      <div className="text-[11px] bg-zinc-50 py-1.5 px-3 rounded-lg border border-zinc-100 text-zinc-500 font-normal">
                        <strong>日程更新:</strong> {app.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <select
                      value={app.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateStatus(app.id, e.target.value as any)}
                      className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 text-[11px] font-bold text-zinc-700 rounded-lg focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="interested">有意向</option>
                      <option value="matched">AI分析过</option>
                      <option value="tailored">已微调</option>
                      <option value="applied">已投递</option>
                      <option value="interviewing">面试中</option>
                      <option value="offer">拿到Offer</option>
                      <option value="rejected">不合适</option>
                    </select>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteApplication(app.id);
                        if (selectedAppId === app.id) setSelectedAppId(null);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                      title="删除记录"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details Drawer / Card Column */}
          <div className="lg:col-span-5">
            {selectedApp ? (
              <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm space-y-5 sticky top-4">
                <div className="border-b border-zinc-100 pb-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block">投递档案详情</span>
                      <h3 className="text-base font-extrabold text-zinc-900 leading-tight">{selectedApp.company}</h3>
                      <p className="text-xs text-zinc-500">{selectedApp.position}</p>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadge(selectedApp.status).bg} shrink-0`}>
                      {getStatusBadge(selectedApp.status).text}
                    </span>
                  </div>
                </div>

                {/* Tab Switcher for Details Frame */}
                <div className="flex bg-zinc-100 p-1 rounded-xl text-xs font-semibold select-none gap-1 shrink-0">
                  <button
                    onClick={() => setDetailTab("profile")}
                    className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                      detailTab === "profile" 
                        ? "bg-white text-indigo-700 shadow-3xs font-bold" 
                        : "text-zinc-500 hover:text-zinc-850"
                    }`}
                  >
                    📁 投递核心档案
                  </button>
                  <button
                    onClick={() => setDetailTab("interview")}
                    className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      detailTab === "interview" 
                        ? "bg-white text-indigo-700 shadow-3xs font-bold" 
                        : "text-zinc-500 hover:text-zinc-850"
                    }`}
                  >
                    💬 1v1 AI 仿真面试舱
                    <span className="bg-red-500 text-white font-black px-1.5 py-0.2 text-[8px] rounded-full scale-90 animate-pulse">热</span>
                  </button>
                </div>

                {/* CASE 1: PROFILE TAB */}
                {detailTab === "profile" && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Micro Memo Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-700">📌 应聘追踪备忘 (Tracker Notes)</span>
                        {editingNotesId !== selectedApp.id ? (
                          <button
                            onClick={() => startEditingNotes(selectedApp)}
                            className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={10} /> 编辑
                          </button>
                        ) : (
                          <button
                            onClick={() => saveNotes(selectedApp.id)}
                            className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                          >
                            保存
                          </button>
                        )}
                      </div>

                      {editingNotesId === selectedApp.id ? (
                        <textarea
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="例如：第一轮HR沟通顺利，约下周二下午2点技术面"
                          className="w-full p-2.5 bg-zinc-50 border border-zinc-200 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-800 font-normal"
                          rows={3}
                        />
                      ) : (
                        <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50/80 p-3 rounded-xl border border-zinc-100 min-h-[50px] italic font-normal">
                          {selectedApp.notes || "暂无备忘纪要。可点击编辑记录当前的面试进展、Offer条件或沟通回馈。"}
                        </p>
                      )}
                    </div>

                    {/* AI Outputs Quick Copy section */}
                    {selectedApp.matchResult && (
                      <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                            <MessageCircle size={13} className="text-emerald-500" /> 对口打招呼语
                          </span>
                          <div className="p-3 bg-zinc-50 rounded-xl text-[11px] text-zinc-600 leading-relaxed relative border border-zinc-100 max-h-[140px] overflow-y-auto font-normal">
                            <p>{selectedApp.matchResult.tailoredGreeting.brief}</p>
                            <button
                              onClick={() => copyText(selectedApp.matchResult!.tailoredGreeting.brief)}
                              className="absolute bottom-1.5 right-1.5 bg-white border border-zinc-200 text-zinc-500 hover:text-indigo-600 text-[9px] px-1.5 py-0.5 rounded shadow-2xs hover:shadow-xs transition-all cursor-pointer select-none"
                              title="点击快速复制"
                            >
                              复制
                            </button>
                          </div>
                        </div>

                        {/* Tailored CV Details */}
                        {selectedApp.tailoredResume && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                                <FileText size={13} className="text-indigo-500" /> 已微调专版简历 (Summary Preview)
                              </span>
                              {onAddResume && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedApp.tailoredResume) {
                                      onAddResume(selectedApp.tailoredResume);
                                      alert(`🎉 已成功将针对「${selectedApp.company} - ${selectedApp.position}」定制微调的专属简历副本推送到您的“参考简历库”！您可以前往“参考简历库”进行查看和维护。`);
                                    }
                                  }}
                                  className="text-[10px] text-indigo-700 hover:text-indigo-800 font-bold bg-indigo-50 border border-indigo-100/85 px-2 py-0.5 rounded-md flex items-center gap-0.5 cursor-pointer transition-colors"
                                >
                                  📥 备份到简历库
                                </button>
                              )}
                            </div>
                            <div className="p-3 bg-zinc-50 rounded-xl text-[11px] text-zinc-500 whitespace-pre-line relative border border-zinc-100 max-h-[180px] overflow-y-auto font-normal leading-relaxed">
                              <p className="font-bold text-zinc-700 mb-1">【润色后职业评价】</p>
                              <p className="mb-2 italic text-zinc-650">{selectedApp.tailoredResume.summary}</p>
                              <p className="font-bold text-zinc-700 mb-1">【针对微调工作成果】</p>
                              {(selectedApp.tailoredResume.experience || []).map((exp) => (
                                <div key={exp.id} className="border-t border-zinc-200/60 pt-1.5 mt-1.5 font-normal">
                                  <p className="font-extrabold text-zinc-700 text-[10px]">{exp.company} | {exp.position}</p>
                                  <p className="text-zinc-500 text-[10px] leading-relaxed whitespace-pre-wrap mt-0.5">{exp.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* CASE 2: MOCK INTERVIEW CHOP */}
                {detailTab === "interview" && (
                  <div className="space-y-4 pt-1 animate-fade-in">
                    {interviewError && (
                      <div className="p-3 bg-rose-50 border border-rose-100/70 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2">
                        <span>⚠ {interviewError}</span>
                      </div>
                    )}

                    {(!interactionMap[selectedApp.id] || interactionMap[selectedApp.id].length === 0) ? (
                      /* Generation Empty State */
                      <div className="bg-zinc-50 border border-zinc-200/50 p-5 text-center rounded-2xl space-y-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full w-fit mx-auto animate-bounce">
                          <Brain size={24} />
                        </div>
                        <div className="max-w-xs mx-auto space-y-1.5">
                          <h4 className="text-xs font-bold text-zinc-800">1v1 AI 仿真技术面试真题未解锁</h4>
                          <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                            本岗位匹配率在 <strong>80%以上</strong> 表现优异。建议立刻启用 AI 考官，深度结合您的简历要点与企业JD反向测算，预测出 3 道最可能问到的高频难关真题。
                          </p>
                        </div>
                        <button
                          onClick={() => handleGenerateQuestions(selectedApp)}
                          disabled={isGenerating}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> 正在研读项目和JD组卷中...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} /> 预测本岗位仿真面试真题 (3道)
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Render Questions list */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 select-none pb-1 border-b border-zinc-100 font-semibold">
                          <span>🎯 定制预测的 3 道仿真高频考题</span>
                          <button
                            onClick={() => handleGenerateQuestions(selectedApp)}
                            disabled={isGenerating}
                            className="text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          >
                            重新预测
                          </button>
                        </div>

                        {interactionMap[selectedApp.id].map((quest, qIdx) => {
                          const isFrameworkOpen = !!frameworkToggles[qIdx];
                          const hasEval = !!quest.evaluation;
                          const isEvalLoading = evaluatingIdx === qIdx;

                          return (
                            <div key={qIdx} className="border border-zinc-200/70 p-4 rounded-xl space-y-3.5 bg-zinc-50/10 shadow-3xs transition-all hover:border-zinc-350">
                              <div className="space-y-1">
                                <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 select-none">
                                  {quest.questionType}
                                </span>
                                <h4 className="text-xs font-bold text-zinc-800 leading-relaxed">
                                  Q{qIdx + 1}: {quest.questionText}
                                </h4>
                              </div>

                              {/* Accordion trigger: Answer Framework */}
                              <div className="rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setFrameworkToggles(prev => ({ ...prev, [qIdx]: !prev[qIdx] }))}
                                  className="w-full flex justify-between items-center text-[10px] text-zinc-500 font-bold bg-zinc-50 hover:bg-zinc-100 px-2.5 py-1.5 transition-all text-left cursor-pointer select-none border border-zinc-150"
                                >
                                  <span className="flex items-center gap-1">
                                    <BookOpen size={11} className="text-indigo-500" />
                                    💡 展开通关答题思路与破题点
                                  </span>
                                  <span>{isFrameworkOpen ? "收起 ▲" : "展开 ▼"}</span>
                                </button>
                                {isFrameworkOpen && (
                                  <div className="bg-amber-50/40 border-x border-b border-amber-100/40 p-2.5 text-[10px] text-zinc-600 leading-relaxed italic font-normal">
                                    {quest.answerFramework}
                                  </div>
                                )}
                              </div>

                              {/* User drafted answer box */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 mb-0.5 block select-none">我的技术思路 / 口作回答草拟：</label>
                                <textarea
                                  value={quest.userAnswer || ""}
                                  onChange={(e) => handleUpdateDraft(selectedApp.id, qIdx, e.target.value)}
                                  placeholder="在此输入或粘贴您的拟答大纲。例如：在我的中软项目中，遇到了由于瞬时连接数过大导致的池溢出，我通过加入队列优雅熔断和本地缓存解决了问题..."
                                  className="w-full p-2 border border-zinc-200 text-[11px] rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-normal min-h-[55px] bg-white text-zinc-805"
                                  rows={2}
                                />
                              </div>

                              {/* Evaluation Action */}
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleEvaluateAnswer(selectedApp.id, qIdx, quest.questionText, quest.userAnswer || "")}
                                  disabled={isEvalLoading || isGenerating}
                                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-3xs transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {isEvalLoading ? (
                                    <>
                                      <Loader2 size={11} className="animate-spin text-white" /> 考官正认真评审测算中...
                                    </>
                                  ) : (
                                    <>
                                      <Terminal size={11} /> 🧠 AI 面试官现场评分纠偏
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Evaluation Result Panel */}
                              {hasEval && quest.evaluation && (
                                <div className="space-y-2.5 pt-2.5 border-t border-zinc-200 text-[11px] leading-relaxed font-normal">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-zinc-800 flex items-center gap-1 select-none">
                                      <Award size={13} className={quest.evaluation.score >= 85 ? "text-emerald-500" : "text-amber-500"} />
                                      模拟考评得分：
                                      <strong className={`font-black uppercase tracking-tight text-xs ${
                                        quest.evaluation.score >= 85 ? "text-emerald-600" : quest.evaluation.score >= 70 ? "text-amber-600" : "text-rose-600"
                                      }`}>
                                        {quest.evaluation.score}分 / {quest.evaluation.score >= 88 ? "极佳 🏆" : quest.evaluation.score >= 75 ? "良好 ✨" : "及格/需优化 ⚠️"}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="bg-rose-50/45 p-2.5 rounded-xl border border-rose-100/50 text-rose-800 text-[10px] font-normal leading-relaxed italic">
                                    <strong>🔍 面试官点评：</strong>
                                    {quest.evaluation.critique}
                                  </div>

                                  {/* Heavy terminal perfect response */}
                                  <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-3.5 rounded-xl text-zinc-200 border border-indigo-900/60 shadow-inner relative select-text">
                                    <span className="text-[9px] font-extrabold text-indigo-300 tracking-wider block uppercase mb-1 flex items-center gap-1 select-none">
                                      <Sparkles size={10} className="text-indigo-400" />
                                      AI 3.0 通关黄金示范升级话术 (STAR模型)
                                    </span>
                                    <p className="whitespace-pre-line text-[10.5px] text-zinc-100/90 leading-relaxed font-normal">
                                      {quest.evaluation.perfectResponse}
                                    </p>
                                    <button
                                      onClick={() => {
                                        copyText(quest.evaluation!.perfectResponse);
                                        setCopiedQuestionIdx(qIdx);
                                        setTimeout(() => setCopiedQuestionIdx(null), 3500);
                                      }}
                                      className="absolute top-2.5 right-2.5 bg-white/10 hover:bg-white/20 transition-all font-bold text-[9px] px-2 py-0.5 rounded text-white cursor-pointer select-none"
                                    >
                                      {copiedQuestionIdx === qIdx ? "已复制 ✅" : "复制此回答"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-50/50 p-8 text-center rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-xs hidden lg:block sticky top-4 font-normal">
                点击左侧任何一个申请项目，可在此查看专属打招呼话术备份、简历差异化润色点，以及进行 1v1 AI 仿真面试真题模拟考训。
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
