import React, { useState } from "react";
import { Resume, MatchResult } from "../types";
import { Sparkles, Send, Copy, AlertTriangle, ArrowRight, RefreshCw, FileText, CheckCircle, ExternalLink, MessageCircle, Mail, Linkedin, ChevronDown, ChevronUp } from "lucide-react";

interface JobMatcherProps {
  currentResume: Resume;
  onApplyTailoring: (tailoredResume: Resume, company: string, position: string, matchResult: MatchResult) => void;
  onRecordUsage?: (actionName: string) => boolean;
}

const mockJDs = [
  {
    company: "字节速动科技",
    position: "高级前端架构、资深研发工程师",
    salary: "25k-40k",
    text: `【岗位要求】
1. 5年以上前端经验。深刻理解Web性能优化（如冷启动提速、FCP首屏、资源包体积压缩、按需加载、自适应CDN等体系建设）。
2. 熟练掌握 React / Next.js 生态。熟悉 Vite 编译配置及 Webpack/Esbuild 自定义插件。
3. 具备 B端 SaaS 系统的交互设计经验，主导过大型多渠道自研组件库建设，实现高度解耦。
4. 有良好的 CI/CD 及流水线规范落地经验。自驱力强。`
  },
  {
    company: "数智云供应链",
    position: "B端 SaaS 高级产品经理 (敏捷团队负责人)",
    salary: "18k-30k",
    text: `【工作职责】
1. 负责供应链与智能车辆调度系统的产品全生命周期管理，发掘行业痛点，输出高保真 PRD 与功能原型。
2. 组织协调多团队敏捷研发（Jira/Scrum 框架参与者），保障迭代周发版，进行全面的产品发布前监控与体验闭环。
3. 深入卡车运作与物流一级干线进行实地用户特征研究，提炼出商业效率增长路径。
【任职要求】
1. 4年以上B端物流或供应链产品经验。
2. 熟练运用 SQL、A/B 实验、Tableau 作漏斗细节转化监控。`
  }
];

export default function JobMatcher({ currentResume, onApplyTailoring, onRecordUsage }: JobMatcherProps) {
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jdText, setJdText] = useState("");
  const [salary, setSalary] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // States for dynamic 80%+ match rate job recommendations
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendSuccessMsg, setRecommendSuccessMsg] = useState<string | null>(null);

  // Copied states
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showTailoringPanel, setShowTailoringPanel] = useState(true);
  const [applied, setApplied] = useState(false);

  const loadPresetJD = (index: number) => {
    const jd = mockJDs[index];
    setCompany(jd.company);
    setPosition(jd.position);
    setJdText(jd.text);
    setSalary(jd.salary);
    setApplied(false);
  };

  const fetchJobRecommendations = async () => {
    if (onRecordUsage) {
      const allowed = onRecordUsage("AI 推荐极速适配岗位");
      if (!allowed) return;
    }
    setIsRecommending(true);
    setRecommendError(null);
    setRecommendSuccessMsg(null);
    try {
      const resp = await fetch("/api/gemini/recommend-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: currentResume })
      });
      if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        throw new Error(errObj.error || `服务端适配失败 (状态码: ${resp.status})`);
      }
      const data = await resp.json();
      if (data.recommendedJobs && data.recommendedJobs.length > 0) {
        setRecommendedJobs(data.recommendedJobs);
      } else {
        throw new Error("AI 未返回合适的推荐岗位列表，请检查简历完整性。");
      }
    } catch (err: any) {
      console.error(err);
      setRecommendError(err.message || "连接服务器AI推荐接口出错了，请稍后重试");
    } finally {
      setIsRecommending(false);
    }
  };

  const addToBotQueue = (job: any) => {
    try {
      const saved = localStorage.getItem("job_companion_bot_queue_v2");
      const currentQueue = saved ? JSON.parse(saved) : [];
      
      const newQueueItem = {
        id: "recommend-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        company: job.company,
        position: job.position,
        channel: "boss" as const, // Default to Boss Zhipin channel
        salary: job.salary,
        jdText: job.jdText
      };
      
      const nextQueue = [newQueueItem, ...currentQueue];
      localStorage.setItem("job_companion_bot_queue_v2", JSON.stringify(nextQueue));
      
      // Notify success
      setRecommendSuccessMsg(`✨ 成功将「${job.company} - ${job.position}」导入自动投递队列看板，您可以随时开启巡航投递！`);
      setTimeout(() => setRecommendSuccessMsg(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const runAiMatching = async (overrideCompany?: string, overridePosition?: string, overrideJdText?: string, overrideSalary?: string) => {
    const activeJd = overrideJdText !== undefined ? overrideJdText : jdText;
    const activeCompany = overrideCompany !== undefined ? overrideCompany : company;
    const activePosition = overridePosition !== undefined ? overridePosition : position;
    const activeSalary = overrideSalary !== undefined ? overrideSalary : salary;

    if (!activeJd.trim()) {
      setError("请先输入或加载岗位职责与要求 (JD)");
      return;
    }

    if (onRecordUsage) {
      const allowed = onRecordUsage("AI 核心诊断匹配度与重写适配话术");
      if (!allowed) return;
    }

    setLoading(true);
    setError(null);
    setMatchResult(null);
    setApplied(false);

    // Sync input fields just in case
    if (overrideCompany !== undefined) setCompany(overrideCompany);
    if (overridePosition !== undefined) setPosition(overridePosition);
    if (overrideJdText !== undefined) setJdText(overrideJdText);
    if (overrideSalary !== undefined) setSalary(overrideSalary);

    try {
      const response = await fetch("/api/gemini/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: currentResume,
          jdText: activeJd,
          company: activeCompany || "未知公司",
          position: activePosition || "未知岗位",
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "匹配失败");
      }

      const data = await response.json();
      setMatchResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "连接服务器AI接口失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleApplyTailoringClick = () => {
    if (!matchResult) return;
    
    // Auto adjust original resume to create tailoredResume
    const tailoredResumeCopy: Resume = {
      ...currentResume,
      id: "tailored-" + Date.now(),
      title: `${company} - ${position} (精润定制版)`,
      summary: matchResult.tailoredResumeChanges?.summary || currentResume.summary,
      // Expand existing skills safely
      skills: Array.from(new Set([...(currentResume.skills || []), ...(matchResult.tailoredResumeChanges?.skillsToAdd || [])])),
      // Adjust experience bullet points matching specific ID
      experience: (currentResume.experience || []).map((exp) => {
        const matchMod = (matchResult.tailoredResumeChanges?.experienceModifications || []).find(
          (m) => m.experienceId === exp.id
        );
        if (matchMod) {
          return {
            ...exp,
            description: matchMod.suggestedPoints,
          };
        }
        return exp;
      }),
      updatedAt: new Date().toISOString().split("T")[0],
    };

    onApplyTailoring(tailoredResumeCopy, company || "求职单位", position || "目标职位", matchResult);
    setApplied(true);
  };

  // Determine color for matched gauge
  const getScoreColor = (score: number) => {
    if (score >= 85) return { border: "border-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", fill: "#10b981" };
    if (score >= 70) return { border: "border-amber-500", text: "text-amber-700", bg: "bg-amber-50", fill: "#f59e0b" };
    return { border: "border-rose-500", text: "text-rose-700", bg: "bg-rose-50", fill: "#f43f5e" };
  };

  const scoreDetails = matchResult ? getScoreColor(matchResult.matchScore) : null;

  return (
    <div className="space-y-6">
      {/* 🔮 简历专属岗位适配推荐 (匹配率已校准：≥80%) */}
      <div id="ai-job-recommend-hub" className="bg-gradient-to-r from-indigo-50/60 to-purple-50/40 p-5 md:p-6 rounded-2xl border border-indigo-100/80 shadow-3xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-md font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="text-indigo-600 animate-pulse" size={18} />
              AI 简历专属岗位智能适配推荐中心
            </h3>
            <p className="text-xs text-zinc-500 max-w-2xl leading-relaxed">
              分析求职简历「<strong className="text-indigo-700">{currentResume.title}</strong>」，深度结合您的核心技能与指标背景，智能为您高精度适配生成匹配率 <span className="bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] scale-95 origin-center inline-block">80% 以上</span> 的标杆好工作，一键激活无限可能！
            </p>
          </div>

          <div className="shrink-0">
            <button
              id="btn-fetch-job-recommendations"
              onClick={fetchJobRecommendations}
              disabled={isRecommending}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs text-xs font-bold transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isRecommending ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> 正在智能测算并生成...
                </>
              ) : (
                <>
                  <Sparkles size={13} /> 开启 AI 全维度岗位适配 (80%+)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading state placeholders with beautiful custom system copy */}
        {isRecommending && (
          <div id="recommending-loader-active" className="bg-white/80 p-8 rounded-xl border border-indigo-100/40 text-center flex flex-col items-center justify-center space-y-3.5 animate-pulse">
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
              <RefreshCw size={28} className="animate-spin" />
            </div>
            <div className="max-w-lg space-y-1">
              <h4 className="text-xs font-bold text-zinc-800">Gemini AI 专属共振协处理器正在对您的履历深度解码中...</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                正在深度解构当前简历。我们将模拟数万名业内资深HR和猎头总监的人岗大盘模型，挖掘您的硬性技能栈亮点，并在互联网巨头、上市科技及精品SaaS企业招聘池中反向重组成熟的岗位JD画像（确保适配度 &ge; 80%），请稍等片刻。
              </p>
            </div>
            <div className="w-48 bg-zinc-100 rounded-full h-1 overflow-hidden mx-auto">
              <div className="bg-indigo-600 h-1 rounded-full animate-[shimmer_1.5s_infinite] w-2/3"></div>
            </div>
          </div>
        )}

        {recommendError && (
          <div id="recommend-error-alert" className="p-3 bg-rose-50 border border-rose-100/70 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 max-w-xl mx-auto">
            <AlertTriangle size={14} />
            <span>{recommendError}</span>
          </div>
        )}

        {recommendSuccessMsg && (
          <div id="recommend-success-banner" className="p-3 bg-emerald-50 border border-emerald-100/80 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 max-w-2xl mx-auto duration-300">
            <CheckCircle size={14} className="text-emerald-600" />
            <span>{recommendSuccessMsg}</span>
          </div>
        )}

        {/* Adaptive list for selected matching jobs (>= 80%) */}
        {recommendedJobs.length > 0 && !isRecommending && (
          <div id="recommended-jobs-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {recommendedJobs.map((job, idx) => (
              <div
                key={idx}
                id={`recommend-job-card-${idx}`}
                className="bg-white p-5 rounded-xl border border-zinc-200/60 hover:border-indigo-200 hover:shadow-sm transition-all duration-300 flex flex-col justify-between space-y-3.5 group relative"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-zinc-400 block tracking-wide">{job.company}</span>
                      <h4 className="text-sm font-extrabold text-zinc-900 group-hover:text-indigo-600 transition-colors leading-tight">
                        {job.position}
                      </h4>
                    </div>
                    <div className="flex flex-col items-end shrink-0 select-none">
                      <span className="text-xs font-black text-rose-600">{job.salary}</span>
                      <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 mt-1">
                        🎯 匹配率 {job.matchScore}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 leading-relaxed italic bg-zinc-50 p-2.5 rounded-lg border border-zinc-100/50">
                    <strong className="text-indigo-600 font-bold not-italic">💡 适配理由：</strong>
                    {job.matchReason}
                  </p>
                </div>

                {/* Micro JD Preview drawer indicator */}
                <div className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2 select-text border-t border-zinc-50 pt-2 font-mono">
                  {job.jdText.slice(0, 100)}...
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-zinc-50">
                  <button
                    onClick={() => runAiMatching(job.company, job.position, job.jdText, job.salary)}
                    className="flex-1 bg-indigo-50 hover:bg-indigo-600 group-hover:bg-indigo-50 hover:text-white text-indigo-700 transition-all font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>⚡ 一键导入测算与微调</span>
                    <ArrowRight size={11} />
                  </button>
                  <button
                    onClick={() => addToBotQueue(job)}
                    className="bg-zinc-100 hover:bg-zinc-800 text-zinc-700 hover:text-white transition-all font-semibold text-xs px-2.5 py-2 rounded-lg cursor-pointer"
                    title="将此岗位导入批量运行 Autopilot 队列"
                  >
                    📥 导入投递
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target JD input card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="text-indigo-600" /> 第一步：导入目标招聘JD信息
            </h2>
            <p className="text-xs text-zinc-500">输入或复制粘贴您想投递的岗位信息，或者一键引入测试包</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">💡 极速测试：</span>
            <button
              onClick={() => loadPresetJD(0)}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-indigo-200 text-zinc-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              💻 高级前端岗
            </button>
            <button
              onClick={() => loadPresetJD(1)}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-indigo-200 text-zinc-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              📋 B端产品经理岗
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-600 mb-1.5 block">公司名称 (Company)</label>
            <input
              type="text"
              placeholder="例如：腾讯科技 / 字节跳动"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50/50 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-zinc-800"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-600 mb-1.5 block">目标岗位 (Position)</label>
            <input
              type="text"
              placeholder="例如：高级开发工程师 / PM"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50/50 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-zinc-800"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-600 mb-1.5 block">薪资福利薪资描述 (可选)</label>
            <input
              type="text"
              placeholder="例如：25k-35k * 15薪"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50/50 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-zinc-800"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-600 mb-1.5 block">核心岗位职责与具体要求 (JD Text)</label>
          <textarea
            placeholder="请在此粘贴目标岗位的 JD 要求（包含任职要求、业务场景、核心产品线说明，越详细 AI 匹配微调效果越精准哦）"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={6}
            className="w-full px-3.5 py-3 border border-zinc-200 bg-zinc-50/50 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-zinc-700 font-mono leading-relaxed"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={runAiMatching}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-xs text-sm font-semibold hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> AI Recruiter 正在闪电匹配中...
              </>
            ) : (
              <>
                <Send size={15} /> 开始 AI 智能匹配与模拟微调
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading state placeholders with beautiful messages */}
      {loading && (
        <div className="bg-white p-12 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-indigo-50/80 rounded-full text-indigo-600 animate-bounce">
            <Sparkles size={36} />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-base font-bold text-zinc-800">正在像资深HR一样模拟人岗匹配……</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              我们正在调用 <strong>gemini-3.5-flash</strong> 强大的多维推理能力，解析您的简历经验，寻找核心优势与硬性缺口，并正在重组经验库来适配 JD 要求。这通常需要 4-8 秒，请主人稍作休息。
            </p>
          </div>
          {/* Mock loader process */}
          <div className="w-56 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full animate-[shimmer_1.5s_infinite] w-2/3"></div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-xs rounded-xl border border-red-100 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* MATCH RESULT PANELS */}
      {matchResult && scoreDetails && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Summary Audit Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Round matching score gauge */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block">智能评定匹配度</span>
              
              {/* Circular SVG Meter */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    strokeWidth="8"
                    stroke="#f4f4f5"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    strokeWidth="10"
                    stroke={scoreDetails.fill}
                    fill="transparent"
                    strokeDasharray={376.8}
                    strokeDashoffset={376.8 - (376.8 * matchResult.matchScore) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold tracking-tighter text-zinc-900">{matchResult.matchScore}%</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${scoreDetails.bg} ${scoreDetails.text}`}>
                    {matchResult.suitabilityLevel}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-800">
                  {currentResume.fullName} 与的适配率
                </h4>
                <p className="text-[11px] text-zinc-500">
                  针对 &ldquo;{company || "未填公司"}&rdquo; 的 {position || "未填岗位"}
                </p>
              </div>
            </div>

            {/* Comprehensive Rationale */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  🔍 猎头顾问评述 (Consultant Audit)
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 whitespace-pre-line bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                  {matchResult.rationale}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-zinc-500">建议简历中突出的高频通过率关键词:</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(matchResult.suggestedKeywords || []).map((kw, i) => (
                    <span key={i} className="px-2 py-1 bg-indigo-50/50 text-indigo-700 font-mono text-[10px] rounded-md font-semibold border border-indigo-100/50">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Strengths and Gaps Detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-3.5">
              <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle size={16} className="text-emerald-600" /> 对口胜任优势 (Match Strengths)
              </h4>
              <ul className="space-y-2.5">
                {(matchResult.strengths || []).map((st, i) => (
                  <li key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                    <span>{st}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-3.5">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-amber-600" /> 阻碍过筛的短板 (Fit Gaps)
              </h4>
              <ul className="space-y-2.5">
                {(matchResult.gaps || []).map((gp, i) => (
                  <li key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                    <span className="text-amber-500 font-bold shrink-0 mt-0.5">⚠</span>
                    <span>{gp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* HR GREETING LAB / COMMUNICATION VECTORS */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm space-y-5">
            <div>
              <h3 className="text-md font-bold text-zinc-900 flex items-center gap-2">
                <MessageCircle size={18} className="text-indigo-600" /> 第二步：智能求职沟通打招呼话术库
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">一键复制最符合该平台场景地道的拟真高转化开场白，直接提升HR回复率</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* WeChat/Boss Direct Call */}
              <div className="border border-zinc-100 bg-zinc-50/50 hover:bg-white rounded-xl p-4 flex flex-col justify-between space-y-4 hover:shadow-xs transition-all relative">
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <MessageCircle size={14} /> Boss直聘 / 微信直达
                  </span>
                  <div className="text-xs text-zinc-600 leading-relaxed font-normal bg-white p-3 rounded-lg border border-zinc-100 min-h-[120px] max-h-[170px] overflow-y-auto">
                    {matchResult.tailoredGreeting.brief}
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(matchResult.tailoredGreeting.brief, "brief")}
                  className="w-full py-2 bg-zinc-100 hover:bg-emerald-600 hover:text-white transition-all text-xs font-semibold rounded-lg text-zinc-700 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedType === "brief" ? "已复制 ✅" : "复制此打招呼语"}
                </button>
              </div>

              {/* LinkedIn Message */}
              <div className="border border-zinc-100 bg-zinc-50/50 hover:bg-white rounded-xl p-4 flex flex-col justify-between space-y-4 hover:shadow-xs transition-all relative font-normal">
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <Linkedin size={14} /> LinkedIn 好友拓展私信
                  </span>
                  <div className="text-xs text-zinc-600 leading-relaxed bg-white p-3 rounded-lg border border-zinc-100 min-h-[120px] max-h-[170px] overflow-y-auto">
                    {matchResult.tailoredGreeting.personalized}
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(matchResult.tailoredGreeting.personalized, "personalized")}
                  className="w-full py-2 bg-zinc-100 hover:bg-blue-600 hover:text-white transition-all text-xs font-semibold rounded-lg text-zinc-700 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedType === "personalized" ? "已复制 ✅" : "复制私信模板"}
                </button>
              </div>

              {/* Cover Letter */}
              <div className="border border-zinc-100 bg-zinc-50/50 hover:bg-white rounded-xl p-4 flex flex-col justify-between space-y-4 hover:shadow-xs transition-all relative font-normal">
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
                    <Mail size={14} /> 正式求职信 (Cover Letter)
                  </span>
                  <div className="text-xs text-zinc-600 leading-relaxed bg-white p-3 rounded-lg border border-zinc-100 min-h-[120px] max-h-[170px] overflow-y-auto">
                    {matchResult.tailoredGreeting.formal}
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(matchResult.tailoredGreeting.formal, "formal")}
                  className="w-full py-2 bg-zinc-100 hover:bg-purple-600 hover:text-white transition-all text-xs font-semibold rounded-lg text-zinc-700 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedType === "formal" ? "已复制 ✅" : "复制求职信正文"}
                </button>
              </div>

            </div>
          </div>

          {/* TAILOR RESUME MODIFICATIONS LAB */}
          <div className="bg-zinc-900 text-zinc-100 p-6 rounded-2xl border border-zinc-800 shadow-lg space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-indigo-400 animate-pulse" /> 第三步：简历自动微调细节调校室 (CV Auto-Tailor Hub)
                </h3>
                <p className="text-xs text-zinc-400">
                  AI 提取了岗位痛点，对原有工作成就细节进行了二次打磨。您可在此预览前后细节。
                </p>
              </div>

              <button
                onClick={() => setShowTailoringPanel(!showTailoringPanel)}
                className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold focus:outline-none cursor-pointer"
              >
                {showTailoringPanel ? (
                  <>折叠对比明细 <ChevronUp size={14} /></>
                ) : (
                  <>展开对比明细 <ChevronDown size={14} /></>
                )}
              </button>
            </div>

            {showTailoringPanel && (
              <div className="space-y-6">
                
                {/* Micro summary adjust */}
                <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700/60 text-xs text-zinc-200">
                  <span className="font-bold text-indigo-400 tracking-wide block mb-1">精微自我定位微调 (Suggested Summary)</span>
                  <p className="leading-relaxed italic text-zinc-300">
                    &ldquo;{matchResult.tailoredResumeChanges.summary}&rdquo;
                  </p>
                </div>

                {/* Micro skills suggestion */}
                {matchResult.tailoredResumeChanges?.skillsToAdd && matchResult.tailoredResumeChanges.skillsToAdd.length > 0 && (
                  <div className="text-xs">
                    <span className="font-bold text-amber-400 block mb-1.5">核心岗位对口技能补齐推荐:</span>
                    <div className="flex flex-wrap gap-2">
                      {(matchResult.tailoredResumeChanges.skillsToAdd || []).map((sk, i) => (
                        <span key={i} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md font-semibold font-mono">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compare experience list */}
                <div className="space-y-4">
                  <span className="text-xs font-bold text-indigo-400 block mb-1">经历细节“降维打击”优化对比:</span>
                  {(matchResult.tailoredResumeChanges?.experienceModifications || []).length > 0 ? (
                    (matchResult.tailoredResumeChanges?.experienceModifications || []).map((mod) => {
                      const originalExp = (currentResume.experience || []).find((e) => e.id === mod.experienceId);
                      return (
                        <div key={mod.experienceId} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-800/40 p-4 rounded-xl border border-zinc-800">
                          
                          {/* Left column: Original */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                              原工作成果 ( {mod.originalCompany} - {mod.originalPosition} )
                            </span>
                            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed">
                              {originalExp?.description || "（未同步到原有条目）"}
                            </div>
                          </div>

                          {/* Right column: Tailored */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1">
                              ✨ AI STAR模型 重塑后 (更契合岗位要求)
                            </span>
                            <div className="bg-zinc-900 p-3 rounded-lg border border-indigo-900 text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
                              {mod.suggestedPoints}
                            </div>
                          </div>

                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-zinc-500">此段简历与该岗位无需要重叠的工作修改推荐</p>
                  )}
                </div>

              </div>
            )}

            {/* Application Merge CTA inside Laboratory Card */}
            <div className="bg-linear-to-r from-indigo-900/40 to-indigo-800/40 p-4 rounded-xl border border-indigo-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-indigo-200">一键完成“简历微调”</span>
                <p className="text-[11px] text-indigo-300/90 leading-relaxed">
                  系统将重新编译上述微调细节为该岗位专属版副本，为您锁定精润状态，并自动注册到投递跟踪记录中，像人一样精准归档！
                </p>
              </div>

              <button
                onClick={handleApplyTailoringClick}
                disabled={applied}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                  applied
                    ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/40"
                }`}
              >
                {applied ? (
                  <>✔ 已成功注册版本并保存至看板</>
                ) : (
                  <>
                    应用微调并保存此岗位定制简历 <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
