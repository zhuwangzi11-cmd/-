import React, { useState } from "react";
import { Resume, WorkExperience, Education } from "../types";
import { initialTemplates } from "../data/mockTemplates";
import { Plus, Trash2, Save, FileText, User, Mail, Phone, Globe, Award, Sparkles, Check, Bookmark, UploadCloud, AlertCircle, Loader2, HelpCircle, CheckSquare, Shield, BookOpen, Brain, Terminal, ChevronDown, ChevronUp, Star, TrendingUp, RefreshCw, Printer, Eye, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ResumeEditorProps {
  key?: string;
  resumes: Resume[];
  selectedResumeId: string;
  onSelectResume: (id: string) => void;
  onSaveResume: (resume: Resume) => void;
  onCreateResume: (resume: Resume) => void;
  onDeleteResume: (id: string) => void;
  onRecordUsage?: (actionName: string) => boolean;
}

export default function ResumeEditor({
  resumes,
  selectedResumeId,
  onSelectResume,
  onSaveResume,
  onCreateResume,
  onDeleteResume,
  onRecordUsage,
}: ResumeEditorProps) {
  const currentResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError("");
    setUploadSuccess(false);

    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    const isDocx = file.name.endsWith(".docx");
    const isMd = file.name.endsWith(".md");

    if (!allowedTypes.includes(file.type) && !isDocx && !isMd) {
      setUploadError("暂不支持该格式。请上传 PDF, DOCX, TXT 或 MD 格式的简历。");
      setIsUploading(false);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("文件体积超过 10MB 限制。");
      setIsUploading(false);
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          if (!result) {
            throw new Error("无法读取文件数据");
          }

          const base64Data = result.split(",")[1];

          const response = await fetch("/api/gemini/parse-resume", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              base64Data,
              fileType: file.type,
              fileName: file.name
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `AI解析失败 (状态码: ${response.status})`);
          }

          const parsedData = await response.json();

          const nextResume: Resume = {
            id: "resume-upload-" + Date.now(),
            title: parsedData.title || `${file.name.split(".")[0]} (AI解析)`,
            fullName: parsedData.fullName || "未命名求职者",
            email: parsedData.email || "candidate@example.com",
            phone: parsedData.phone || "139-0000-0000",
            socials: parsedData.socials || "",
            summary: parsedData.summary || "",
            skills: parsedData.skills || [],
            experience: (parsedData.experience || []).map((exp: any, idx: number) => ({
              id: `exp-parsed-${idx}-${Date.now()}`,
              company: exp.company || "公司名称",
              position: exp.position || "任职职位",
              duration: exp.duration || "时间不详",
              description: exp.description || ""
            })),
            education: (parsedData.education || []).map((edu: any, idx: number) => ({
              id: `edu-parsed-${idx}-${Date.now()}`,
              school: edu.school || "毕业学校",
              major: edu.major || "专业",
              degree: edu.degree || "学历",
              duration: edu.duration || "求学时间"
            })),
            updatedAt: new Date().toISOString().split("T")[0]
          };

          onCreateResume(nextResume);
          onSelectResume(nextResume.id);
          setUploadSuccess(true);
        } catch (innerErr: any) {
          console.error("Internal processing resume upload error:", innerErr);
          setUploadError(innerErr.message || "AI分析提取出错了，请稍候重试");
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadError("本地读取文件失败，请更换浏览器重试");
        setIsUploading(false);
      };

      reader.readAsDataURL(file);

    } catch (err: any) {
      console.error("Resume file selection error:", err);
      setUploadError(err.message || "文件加载失败，请重新选择");
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editedResume, setEditedResume] = useState<Resume>(() => ({
    id: "",
    title: "",
    fullName: "",
    email: "",
    phone: "",
    summary: "",
    skills: [],
    experience: [],
    education: [],
    updatedAt: "",
    ...currentResume,
  }));
  const [newSkill, setNewSkill] = useState("");

  // Sync state if selected resume changes externally
  React.useEffect(() => {
    if (currentResume) {
      setEditedResume({
        id: "",
        title: "",
        fullName: "",
        email: "",
        phone: "",
        summary: "",
        skills: [],
        experience: [],
        education: [],
        updatedAt: "",
        ...currentResume,
      });
    }
  }, [selectedResumeId, resumes]);

  if (!currentResume) return null;

  // AI Resume Critique and Community Sourced High-frequency Questions States
  const [isAnalyzingCritique, setIsAnalyzingCritique] = useState(false);
  const [critiqueData, setCritiqueData] = useState<any | null>(null);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);
  const [appliedCritiques, setAppliedCritiques] = useState<Record<string, boolean>>({});
  const [showCritiquePanel, setShowCritiquePanel] = useState(false);
  
  // Custom states for user-edited suggestion text and optional audit specifications
  const [diagnosisExplanation, setDiagnosisExplanation] = useState("");
  const [editedSuggestions, setEditedSuggestions] = useState<Record<number, string>>({});

  const handleRunCritique = async () => {
    if (onRecordUsage) {
      const allowed = onRecordUsage("简历 AI 专家深度会诊评价");
      if (!allowed) return;
    }
    setIsAnalyzingCritique(true);
    setCritiqueError(null);
    setEditedSuggestions({}); // Clear prior state edits
    try {
      const response = await fetch("/api/gemini/critique-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resume: currentResume,
          diagnosisExplanation: diagnosisExplanation.trim() 
        })
      });

      if (!response.ok) {
        const errVal = await response.json().catch(() => ({}));
        throw new Error(errVal.error || `会诊请求出错 (状态码: ${response.status})`);
      }

      const data = await response.json();
      setCritiqueData(data);
      
      // Initialize editable suggestion box values
      if (data && data.critiquePoints) {
        const initialEdits: Record<number, string> = {};
        data.critiquePoints.forEach((pt: any, idx: number) => {
          initialEdits[idx] = pt.suggestedValue;
        });
        setEditedSuggestions(initialEdits);
      }
      
      setAppliedCritiques({});
      setShowCritiquePanel(true);
    } catch (err: any) {
      console.error(err);
      setCritiqueError(err.message || "未能连接到 Resume AI 专家会诊诊断模块，请稍后再试");
    } finally {
      setIsAnalyzingCritique(false);
    }
  };

  const handleApplyCritique = (pointIdx: number) => {
    if (!critiqueData) return;
    const point = critiqueData.critiquePoints[pointIdx];
    if (!point) return;

    let updatedObj = { ...editedResume };

    // Adopt the customized suggestion text from live user input if changed, otherwise fallback
    const valueToAdopt = editedSuggestions[pointIdx] !== undefined ? editedSuggestions[pointIdx] : point.suggestedValue;

    if (point.section === "summary") {
      updatedObj.summary = valueToAdopt;
    } else if (point.section === "skills") {
      const newSkills = valueToAdopt
        .split(/[,，\n]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      updatedObj.skills = Array.from(new Set([...(updatedObj.skills || []), ...newSkills]));
    } else {
      updatedObj.experience = (updatedObj.experience || []).map((exp) => {
        if (exp.id === point.section) {
          return {
            ...exp,
            description: valueToAdopt
          };
        }
        return exp;
      });
    }

    updatedObj.updatedAt = new Date().toISOString().split("T")[0];
    setEditedResume(updatedObj);
    onSaveResume(updatedObj);

    // Track as applied
    setAppliedCritiques((prev) => ({ ...prev, [pointIdx]: true }));
  };

  const inlineCritiquesForSection = (sectionId: string) => {
    if (!critiqueData) return [];
    return critiqueData.critiquePoints.filter(
      (cp: any, idx: number) => cp.section === sectionId && !appliedCritiques[idx]
    );
  };

  const handleFieldChange = (field: keyof Resume, value: any) => {
    setEditedResume((prev) => ({ ...prev, [field]: value }));
  };

  const handleWorkExperienceChange = (expId: string, field: keyof WorkExperience, value: string) => {
    setEditedResume((prev) => ({
      ...prev,
      experience: (prev.experience || []).map((exp) => (exp.id === expId ? { ...exp, [field]: value } : exp)),
    }));
  };

  const handleEducationChange = (eduId: string, field: keyof Education, value: string) => {
    setEditedResume((prev) => ({
      ...prev,
      education: (prev.education || []).map((edu) => (edu.id === eduId ? { ...edu, [field]: value } : edu)),
    }));
  };

  const addWorkExperience = () => {
    const newExp: WorkExperience = {
      id: "exp-" + Date.now(),
      company: "示例企业",
      position: "岗位名称",
      duration: "2024.01 - 至今",
      description: "• 请填写具体职责与量化工作输出\n• 采用 STAR 原则描述达成效果",
    };
    setEditedResume((prev) => ({
      ...prev,
      experience: [...(prev.experience || []), newExp],
    }));
  };

  const deleteWorkExperience = (id: string) => {
    setEditedResume((prev) => ({
      ...prev,
      experience: (prev.experience || []).filter((exp) => exp.id !== id),
    }));
  };

  const addEducation = () => {
    const newEdu: Education = {
      id: "edu-" + Date.now(),
      school: "目标高校",
      major: "所学专业",
      duration: "2020.09 - 2024.06",
      degree: "本科 / 学士学位",
    };
    setEditedResume((prev) => ({
      ...prev,
      education: [...(prev.education || []), newEdu],
    }));
  };

  const deleteEducation = (id: string) => {
    setEditedResume((prev) => ({
      ...prev,
      education: (prev.education || []).filter((edu) => edu.id !== id),
    }));
  };

  const addSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    const currentSkills = editedResume.skills || [];
    if (!currentSkills.includes(newSkill.trim())) {
      setEditedResume((prev) => ({
        ...prev,
        skills: [...(prev.skills || []), newSkill.trim()],
      }));
    }
    setNewSkill("");
  };

  const removeSkill = (skillToRemove: string) => {
    setEditedResume((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((s) => s !== skillToRemove),
    }));
  };

  const saveChanges = () => {
    const updated = {
      ...editedResume,
      updatedAt: new Date().toISOString().split("T")[0],
    };
    onSaveResume(updated);
    setIsEditing(false);
  };

  const createBlankResume = () => {
    const fresh: Resume = {
      id: "resume-" + Date.now(),
      title: "全新个人简历 " + (resumes.length + 1),
      fullName: "求职者姓名",
      email: "your-email@example.com",
      phone: "13X-XXXX-XXXX",
      socials: "LinkedIn / GitHub",
      summary: "请简短描述您的职业特点、工作年限与核心竞争优势优势。",
      skills: ["前端开发", "项目协作", "TypeScript"],
      experience: [
        {
          id: "exp-fresh-1",
          company: "某某互联网科技有限公司",
          position: "软件工程师",
          duration: "2023.07 - 2024.06",
          description: "• 主导完成了 XX 系统的核心模块开发。\n• 采用 STAR 法则，通过 XX 技术提升了产品 XX 性能指标。"
        }
      ],
      education: [
        {
          id: "edu-fresh-1",
          school: "某某大学",
          major: "计算机科学与技术",
          duration: "2019.09 - 2023.06",
          degree: "本科 / 工程师"
        }
      ],
      updatedAt: new Date().toISOString().split("T")[0],
    };
    onCreateResume(fresh);
    setEditedResume({ ...fresh });
    setIsEditing(true);
  };

  const loadPresetTemplate = (tplId: string) => {
    const preset = initialTemplates.find((t) => t.id === tplId);
    if (preset) {
      const copy = {
        ...preset,
        id: "resume-tpl-" + Date.now() + "-" + tplId,
        title: preset.title + " (副本)",
      };
      onCreateResume(copy);
      setEditedResume({ ...copy });
      setIsEditing(false); // Enable immediate visual inspection of loaded card
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in font-sans">
        {/* Left Column: CV Canvas Area (8 out of 12 cols) */}
        <div className="lg:col-span-8 space-y-6 flex flex-col">
          {/* Resume Templates & My Resumes Workspace */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={18} />
                  简历模板与自建简历工作台
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">这里不是最终稿，您可以随意选用模板、高阶修改，并开启多版本多端快速自动投递。</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl shadow-xs text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
                    >
                      <Sparkles size={14} /> 编辑/修改当前简历
                    </button>
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all cursor-pointer shadow-3xs"
                    >
                      <Eye size={14} /> 🖨️ A4 预览与排版导出
                    </button>
                    <button
                      onClick={createBlankResume}
                      className="flex items-center gap-1.5 px-3.5 py-2 border border-zinc-200 text-zinc-650 rounded-xl text-xs font-medium hover:bg-zinc-50 transition-all cursor-pointer bg-white"
                    >
                      <Plus size={14} /> 创建空白简历
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveChanges}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-xs text-xs font-semibold hover:bg-emerald-700 transition-all cursor-pointer"
                    >
                      <Save size={14} /> 保存我的修改
                    </button>
                    <button
                      onClick={() => {
                        setEditedResume({ ...currentResume });
                        setIsEditing(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 text-zinc-500 rounded-xl text-xs font-medium hover:bg-zinc-55 transition-all cursor-pointer bg-white"
                    >
                      取消并恢复
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Selection of Classic Templates */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">📑 1. 经典简历精品模板（直接选用或在此基础上修改）:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => !isEditing && loadPresetTemplate("tpl-frontend")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                    isEditing 
                      ? "opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-200" 
                      : "bg-white hover:bg-indigo-50/20 border-zinc-200 hover:border-indigo-400 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">💻 高级前端开发模板</span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded">5年经验</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">内建 SaaS 主导、工程化 CI/CD、Vite 性能调优等大厂核心亮点经历。</p>
                </div>

                <div
                  onClick={() => !isEditing && loadPresetTemplate("tpl-pm")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                    isEditing 
                      ? "opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-200" 
                      : "bg-white hover:bg-indigo-50/20 border-zinc-200 hover:border-indigo-400 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">📋 互联网高级产品经理</span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded">4年经验</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">内建 2.0 运力系统、数据漏斗闭环、敏捷迭代主导等高含金量描述。</p>
                </div>

                <div
                  onClick={() => {
                    if (isEditing) return;
                    createBlankResume();
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                    isEditing 
                      ? "opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-200" 
                      : "bg-white hover:bg-indigo-50/20 border-zinc-200 hover:border-indigo-400 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">📄 简历全新空白创建</span>
                    <span className="text-[9px] bg-zinc-50 text-zinc-500 font-bold px-1.5 py-0.2 rounded">自由客群</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">从零创建，手动录入基本履历信息。让您无拘束书写专属于您的成果。</p>
                </div>
              </div>
            </div>

            {/* Selection of Self-built/In-edit versions */}
            <div className="space-y-2.5 pt-2 border-t border-zinc-50">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">✍️ 2. 我的简历库与我的多版本（点击可在画布直接切换）：</span>
              <div className="flex flex-wrap gap-2">
                {resumes.map((r) => {
                  const isActive = r.id === selectedResumeId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        if (isEditing) return;
                        onSelectResume(r.id);
                      }}
                      className={`inline-flex items-center transition-all px-3 py-1.5 gap-2 rounded-xl border cursor-pointer select-none ${
                        isActive
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold"
                          : isEditing
                          ? "opacity-50 cursor-not-allowed bg-zinc-50 border-zinc-200 text-zinc-400"
                          : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-950"
                      }`}
                    >
                      {isActive && <Check size={11} className="stroke-[3]" />}
                      <span className="text-[11px] tracking-wide">{r.title} ({r.fullName})</span>
                      
                      {!isActive && !isEditing && resumes.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteResume(r.id);
                          }}
                          className="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded-md transition-colors"
                          title="删除此简历"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

      {/* Dynamic AI Resume File Drop Zone */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-all duration-300 overflow-hidden ${
          dragActive 
            ? "border-indigo-500 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/10" 
            : "border-zinc-200 hover:border-indigo-400 bg-white hover:bg-zinc-50/50 shadow-xs"
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
          className="hidden" 
          accept=".pdf,.docx,.txt,.md"
        />

        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-4 animate-pulse">
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 animate-spin">
              <Loader2 size={32} />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-sm font-semibold text-zinc-900">🚀 Gemini 正在从源文件深度提取履历...</h3>
              <p className="text-xs text-zinc-500">我们将多模态融合分析、结构化纠偏并清洗简历。预计需要 4-8 秒，请勿离开。</p>
            </div>
            <div className="w-full max-w-xs bg-zinc-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-600 h-1.5 rounded-full animate-[shimmer_1.5s_infinite] w-2/3"></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className={`p-4 rounded-2xl transition-all duration-300 ${
              dragActive 
                ? "bg-indigo-600 text-white scale-110" 
                : "bg-zinc-50 group-hover:bg-indigo-50 text-zinc-400 group-hover:text-indigo-600"
            }`}>
              <UploadCloud size={28} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-800">
                拖拽 或 <span className="text-indigo-600 group-hover:underline">点击上传</span> 本地简历文件
              </p>
              <p className="text-xs text-zinc-400 font-medium">
                支持主流格式：<strong className="text-zinc-500">PDF (.pdf)</strong>、<strong className="text-zinc-500">Word (.docx)</strong>、<strong className="text-zinc-500">记事本/Markdown (.txt, .md)</strong>
              </p>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-center gap-2 text-red-700 text-xs font-semibold mx-auto max-w-md animate-bounce">
            <AlertCircle size={15} />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center gap-2 text-emerald-700 text-xs font-semibold mx-auto max-w-md duration-300">
            <Check size={15} className="bg-emerald-600 text-white rounded-full p-0.5" />
            <span>✨ 简历内容提取就绪！已为您新建并导入至编辑器。</span>
          </div>
        )}
      </div>

      {/* Preset Loader suggestions when empty/starting */}
      <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-800">
          <Award size={18} className="shrink-0 text-amber-600" />
          <p className="text-sm font-medium">
            想快速测试匹配功能？点击可以一键引入系统预设的简历模板副本：
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => loadPresetTemplate("tpl-frontend")}
            disabled={isEditing}
            className="px-3.5 py-1.5 bg-white border border-amber-200 hover:border-amber-400 text-amber-800 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            💻 高级前端模板
          </button>
          <button
            onClick={() => loadPresetTemplate("tpl-pm")}
            disabled={isEditing}
            className="px-3.5 py-1.5 bg-white border border-amber-200 hover:border-amber-400 text-amber-800 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            📋 互联网产品模板
          </button>
        </div>
      </div>

      {/* Main Resume Canvas Card */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden text-zinc-800">
        {/* CV Top Header Decoration / Banner */}
        <div className="bg-linear-to-r from-zinc-800 to-zinc-900 px-8 py-8 md:py-10 text-white relative">
          <div className="absolute top-4 right-4 text-zinc-500 font-mono text-xs tracking-wider">
            最后更新: {editedResume.updatedAt}
          </div>

          <div className="space-y-4 max-w-3xl">
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">简历别名 (仅用于内部管理)</label>
                  <input
                    type="text"
                    value={editedResume.title}
                    onChange={(e) => handleFieldChange("title", e.target.value)}
                    className="w-full bg-zinc-800 text-white rounded-lg border border-zinc-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">真实姓名</label>
                  <input
                    type="text"
                    value={editedResume.fullName}
                    onChange={(e) => handleFieldChange("fullName", e.target.value)}
                    className="w-full bg-zinc-800 text-white rounded-lg border border-zinc-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 font-semibold"
                  />
                </div>
              </div>
            ) : (
              <div>
                <span className="font-mono text-xs text-indigo-400 font-medium px-2 py-0.5 bg-indigo-500/10 rounded-sm inline-block mb-1.5">
                  {editedResume.title}
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
                  {editedResume.fullName}
                </h1>
              </div>
            )}

            {/* Demographics */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-zinc-300 text-sm">
              {isEditing ? (
                <>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-zinc-400 text-xs block">电子邮箱</label>
                    <input
                      type="email"
                      value={editedResume.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg border border-zinc-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-zinc-400 text-xs block">手机号码</label>
                    <input
                      type="text"
                      value={editedResume.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg border border-zinc-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="w-full">
                    <label className="text-zinc-400 text-xs block">社交及作品集链接</label>
                    <input
                      type="text"
                      value={editedResume.socials || ""}
                      onChange={(e) => handleFieldChange("socials", e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg border border-zinc-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <Mail size={14} className="text-zinc-400" />
                    <span>{editedResume.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone size={14} className="text-zinc-400" />
                    <span>{editedResume.phone}</span>
                  </div>
                  {editedResume.socials && (
                    <div className="flex items-center gap-1.5">
                      <Globe size={14} className="text-zinc-400" />
                      <span className="truncate max-w-[280px]">{editedResume.socials}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* CV Body Container */}
        <div className="p-8 space-y-8">
          {/* Summary Section */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
              <User size={18} className="text-indigo-600" /> 个人简介 / 职业评价
            </h2>
            {isEditing ? (
              <textarea
                value={editedResume.summary}
                onChange={(e) => handleFieldChange("summary", e.target.value)}
                rows={4}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
              />
            ) : (
              <p className="text-sm leading-relaxed text-zinc-600 font-normal">
                {editedResume.summary}
              </p>
            )}
          </section>

          {/* Experience Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" /> 工作经历
              </h2>
              {isEditing && (
                <button
                  onClick={addWorkExperience}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                >
                  <Plus size={14} /> 添加经历
                </button>
              )}
            </div>

            <div className="space-y-6">
              {(editedResume.experience || []).map((exp, index) => (
                <div key={exp.id} className="relative group/exp">
                  {isEditing && (
                    <button
                      onClick={() => deleteWorkExperience(exp.id)}
                      className="absolute top-1 -right-2 p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/exp:opacity-100 cursor-pointer"
                      title="删除本条职位"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-1 mb-2">
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full pr-6">
                        <input
                          type="text"
                          placeholder="公司名称"
                          value={exp.company}
                          onChange={(e) => handleWorkExperienceChange(exp.id, "company", e.target.value)}
                          className="px-2.5 py-1.5 text-sm font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="任职岗位"
                          value={exp.position}
                          onChange={(e) => handleWorkExperienceChange(exp.id, "position", e.target.value)}
                          className="px-2.5 py-1.5 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="任职时间"
                          value={exp.duration}
                          onChange={(e) => handleWorkExperienceChange(exp.id, "duration", e.target.value)}
                          className="px-2.5 py-1.5 text-sm text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900 block inline-block md:mr-3">
                            {exp.company}
                          </h3>
                          <span className="text-sm text-zinc-500">{exp.position}</span>
                        </div>
                        <span className="text-xs font-mono text-zinc-400 shrink-0 md:mt-0.5">
                          {exp.duration}
                        </span>
                      </>
                    )}
                  </div>

                  {isEditing ? (
                    <textarea
                      placeholder="工作内容、产出与核心攻坚（STAR原则分点写）"
                      value={exp.description}
                      onChange={(e) => handleWorkExperienceChange(exp.id, "description", e.target.value)}
                      rows={5}
                      className="w-full bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                    />
                  ) : (
                    <p className="text-xs leading-relaxed text-zinc-600 whitespace-pre-wrap pl-1">
                      {exp.description}
                    </p>
                  )}
                  {index < editedResume.experience.length - 1 && (
                    <div className="border-b border-dashed border-zinc-100 mt-6" />
                  )}
                </div>
              ))}
              {editedResume.experience.length === 0 && (
                <div className="text-center py-6 border border-dashed border-zinc-200 bg-zinc-50 rounded-xl text-zinc-400 text-xs">
                  暂无工作经历，请点击“添加经历”添加。
                </div>
              )}
            </div>
          </section>

          {/* Education Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <Bookmark size={18} className="text-indigo-600" /> 教育背景
              </h2>
              {isEditing && (
                <button
                  onClick={addEducation}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                >
                  <Plus size={14} /> 添加学历
                </button>
              )}
            </div>

            <div className="space-y-4">
              {(editedResume.education || []).map((edu) => (
                <div key={edu.id} className="relative group/edu">
                  {isEditing && (
                    <button
                      onClick={() => deleteEducation(edu.id)}
                      className="absolute top-1 -right-2 p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/edu:opacity-100 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full pr-6">
                        <input
                          type="text"
                          placeholder="学校"
                          value={edu.school}
                          onChange={(e) => handleEducationChange(edu.id, "school", e.target.value)}
                          className="px-2.5 py-1.5 text-xs text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="专业"
                          value={edu.major}
                          onChange={(e) => handleEducationChange(edu.id, "major", e.target.value)}
                          className="px-2.5 py-1.5 text-xs text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="学位学历"
                          value={edu.degree}
                          onChange={(e) => handleEducationChange(edu.id, "degree", e.target.value)}
                          className="px-2.5 py-1.5 text-xs text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="时间"
                          value={edu.duration}
                          onChange={(e) => handleEducationChange(edu.id, "duration", e.target.value)}
                          className="px-2.5 py-1.5 text-xs text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="text-sm font-bold text-zinc-900 mr-2">{edu.school}</span>
                          <span className="text-sm text-zinc-500 mr-2">{edu.major}</span>
                          <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-sm inline-block">
                            {edu.degree}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-zinc-400">{edu.duration}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {editedResume.education.length === 0 && (
                <div className="text-center py-4 border border-dashed border-zinc-200 bg-zinc-50 rounded-xl text-zinc-400 text-xs">
                  暂无学历记录
                </div>
              )}
            </div>
          </section>

          {/* Skills Section */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
              <Award size={18} className="text-indigo-600" /> 专业技能
            </h2>

            {isEditing ? (
              <div className="space-y-3">
                <form onSubmit={addSkill} className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="例如: Vue.js, CI/CD, TypeScript..."
                    className="flex-1 px-3 py-1.5 text-xs text-zinc-805 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    添加
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5">
                  {(editedResume.skills || []).map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 text-zinc-800 text-xs font-semibold rounded-lg border border-zinc-200"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="text-zinc-400 hover:text-red-650 font-bold transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {(editedResume.skills || []).length === 0 && (
                    <span className="text-xs text-zinc-400 italic font-medium">暂无专业技能，请在上方添加</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(editedResume.skills || []).map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-zinc-50 border border-zinc-150 text-zinc-800 text-xs font-bold rounded-lg shadow-3xs"
                  >
                    {skill}
                  </span>
                ))}
                {(editedResume.skills || []).length === 0 && (
                  <span className="text-xs text-zinc-400 italic">暂无技能，请开启编辑状态进行添加</span>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>

    {/* Right Column: AI Premium Diagnostics Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Brain size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 font-sans">AI 简历健康诊断舱</h3>
                  <p className="text-[10px] text-zinc-500 font-medium">对齐大厂招聘规范与专业技能筛选</p>
                </div>
              </div>

              {critiqueError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs flex gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{critiqueError}</span>
                </div>
              )}

              {isAnalyzingCritique ? (
                <div className="space-y-4 py-4">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 size={32} className="text-indigo-600 animate-spin" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-zinc-800">正在发起大厂专家联合会诊...</h4>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        大模型正在结合您的「诊断说明」以及当前的建立文本进行多维度纠偏。
                      </p>
                    </div>
                  </div>
                  {/* Fake skeleton lines */}
                  <div className="space-y-2 animate-pulse pt-2">
                    <div className="h-2.5 bg-zinc-100 rounded-full w-full"></div>
                    <div className="h-2 bg-zinc-100 rounded-full w-5/6"></div>
                    <div className="h-2 bg-zinc-100 rounded-full w-4/5"></div>
                  </div>
                </div>
              ) : critiqueData ? (
                <div className="space-y-5">
                  
                  {/* Simplified Clean Healthy Score */}
                  {(() => {
                    const averageScore = Math.round(((critiqueData.hrScore || 80) + (critiqueData.leaderScore || 85)) / 2);
                    return (
                      <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150/50 text-center space-y-1">
                        <span className="text-[10px] font-bold text-zinc-500 block">📊 简历综合健康诊断指数</span>
                        <div className="flex items-baseline justify-center gap-0.5">
                          <span className={`text-3xl font-black ${averageScore >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {averageScore} 分
                          </span>
                          <span className="text-[11px] text-zinc-400 font-bold">/ 100</span>
                        </div>
                        <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${averageScore >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: `${averageScore}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">匹配目标：{diagnosisExplanation || "核心素质评估和错漏纠偏"}</p>
                      </div>
                    );
                  })()}

                  {/* Executive Summary */}
                  <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50 space-y-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700">
                      <Sparkles size={11} /> 联合会诊总评
                    </span>
                    <p className="text-[11px] text-zinc-600 leading-relaxed font-semibold">
                      {critiqueData.executiveSummary}
                    </p>
                  </div>

                  {/* Checklist items with TEXTAREA editable options */}
                  <div className="space-y-3.5 border-t border-zinc-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-zinc-700 uppercase tracking-widest">诊断报告详情 ({critiqueData.critiquePoints?.length})</span>
                      <button 
                        onClick={handleRunCritique}
                        className="text-[10px] text-indigo-600 hover:underline font-bold flex items-center gap-0.5"
                      >
                        <RefreshCw size={10} className="animate-spin-slow" /> 重新诊断
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {critiqueData.critiquePoints?.map((pt: any, idx: number) => {
                        const isApplied = appliedCritiques[idx];
                        const severityColors = 
                          pt.severity === "high" 
                            ? "bg-red-50 border-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded-full border font-bold" 
                            : pt.severity === "medium"
                            ? "bg-amber-50 border-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full border font-bold"
                            : "bg-blue-50 border-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full border font-bold";

                        const severityLabel = 
                          pt.severity === "high" ? "致命缺陷修补" : pt.severity === "medium" ? "重塑亮点" : "微调优化";

                        return (
                          <div key={idx} className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs hover:shadow-xs transition-all">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className={severityColors}>{severityLabel}</span>
                              <span className="text-[9px] font-bold text-zinc-400">板块: {pt.section === "summary" ? "自我评价" : pt.section === "skills" ? "专业技能" : "工作履历"}</span>
                            </div>
                            
                            <div className="space-y-1">
                              <h4 className="text-xs font-extrabold text-zinc-800">{pt.title}</h4>
                              <p className="text-[10px] text-zinc-500 leading-normal font-medium">{pt.critique}</p>
                            </div>

                            <div className="bg-zinc-50 rounded-xl p-3 text-[10px] space-y-2.5 border border-zinc-200">
                              <div>
                                <span className="text-zinc-400 block font-bold">❌ 原始描述:</span>
                                <p className="text-zinc-500 italic line-through font-medium truncate">{pt.originalValue || "段落无具体原文"}</p>
                              </div>
                              <div className="border-t border-zinc-200 pt-2 space-y-1">
                                <span className="text-indigo-600 block font-extrabold flex items-center justify-between">
                                  <span>✍️ AI 高阶精修（可在此修改编辑后再采纳）:</span>
                                  <span className="text-[8px] text-zinc-400 font-normal">支持直接打字修改</span>
                                </span>
                                
                                <textarea
                                  rows={4}
                                  value={editedSuggestions[idx] !== undefined ? editedSuggestions[idx] : pt.suggestedValue}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditedSuggestions(prev => ({ ...prev, [idx]: val }));
                                  }}
                                  className="w-full bg-white text-[11px] border border-zinc-205 rounded-lg p-2 font-mono text-zinc-805 leading-normal focus:border-indigo-400 outline-none"
                                />
                              </div>
                            </div>

                            <div className="pt-1">
                              {isApplied ? (
                                <div className="text-center">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg w-full justify-center border border-emerald-100">
                                    <Check size={11} className="bg-emerald-500 text-white rounded-full p-0.5" />
                                    已成功导入至当前简历
                                  </span>
                                  <span className="text-[8px] text-zinc-400 mt-1 block">此非最终稿，后续在左侧画布仍能自由编辑和保存。</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleApplyCritique(idx)}
                                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-650 text-white hover:bg-indigo-700 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-3xs"
                                >
                                  <Sparkles size={11} className="text-indigo-200" /> 修改后一键采纳（融入简历）
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="max-w-[70px] mx-auto p-4 bg-indigo-50 rounded-2xl text-indigo-500">
                    <Brain size={28} className="mx-auto" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-zinc-850">专家定制诊断说明</h4>
                    <p className="text-[10px] text-zinc-400 font-medium leading-relaxed font-sans">
                      基于您的诉求与大厂筛选逻辑定位问题，输出可修改、一键采纳的诊断成果。
                    </p>
                  </div>

                  {/* Diagnosis explanation input box */}
                  <div className="space-y-1.5 text-left bg-zinc-50 p-3.5 rounded-xl border border-zinc-150">
                    <label className="text-[10px] font-extrabold text-zinc-700 flex items-center gap-1">
                      <span>✏️ 诊断说明/关注方向诉求（必填）：</span>
                    </label>
                    <textarea
                      rows={4}
                      value={diagnosisExplanation}
                      onChange={(e) => setDiagnosisExplanation(e.target.value)}
                      placeholder="例如：我想要转到B端低代码平台，请重点指出我当前前端履历里的颗粒度问题；或者优化我所有的流水账式描述为高含金量量化产出语句。"
                      className="w-full bg-white text-xs border border-zinc-200 rounded-lg p-2 text-zinc-750 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="text-[9px] text-zinc-400 leading-relaxed font-medium">
                      💡 提示：输入明确方向可以让会诊模型准确聚焦，避免空泛说辞。
                    </div>
                  </div>

                  <button
                    onClick={handleRunCritique}
                    disabled={!diagnosisExplanation.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 border border-transparent text-white rounded-xl text-xs font-bold shadow-sm hover:bg-zinc-800 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles size={13} className="text-indigo-400" />
                    ⚡ 发起 Gemini AI 全盘定制会诊
                  </button>
                  <p className="text-[9px] text-zinc-455 font-mono text-zinc-400">*注：会诊需要填写上方诊断说明</p>
                </div>
              )}
            </div>

            {/* Diagnostic specifications */}
            <div className="bg-zinc-900 text-zinc-300 rounded-2xl p-5 border border-zinc-950 shadow-sm space-y-2.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Shield size={13} className="text-indigo-400 shrink-0" />
                简历诊断三大硬核核心标准
              </h4>
              <ul className="space-y-2 text-[10px] text-zinc-400 leading-relaxed font-medium">
                <li>• <strong className="text-zinc-250 text-zinc-100 font-bold">去流水账句式</strong>：自动重组低深度动词，升华为主动性深刻话术。</li>
                <li>• <strong className="text-zinc-250 text-zinc-100">工程拼写规范核查</strong>：对专业关键词（如 React, Vue）语法形态 of 语法形态的精准更正。</li>
              </ul>
            </div>
          </div>
        </div>

      {/* 👁️ Elegant A4 Printable Canvas Preview and System Print/Export Bridge */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 bg-zinc-950/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-100 rounded-3xl border border-zinc-200 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans"
            >
              {/* Modal Control Header */}
              <div className="bg-white px-6 py-4 border-b border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                      PREVIEW MODE
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900">
                      A4 打印 & 外发导出控制中心
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    采用标准 210mm × 297mm A4 纸张排版，自动过滤多余UI背景，完美配合系统 PDF 保存与打印
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <Printer size={13} /> 调用系统打印 (另存为 PDF)
                  </button>

                  <button
                    onClick={() => {
                      const text = JSON.stringify(editedResume, null, 2);
                      navigator.clipboard.writeText(text);
                      setExportCopied(true);
                      setTimeout(() => setExportCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <Copy size={13} /> {exportCopied ? "已存到剪切板! 🎉" : "备份源 JSON 数据"}
                  </button>

                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg cursor-pointer transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>

              {/* Sub-notice explain browser printing settings */}
              <div className="bg-amber-50 border-b border-amber-100 py-2.5 px-6 text-[10px] text-zinc-700 leading-normal flex items-start gap-1.5">
                <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>📄 保存为PDF提示：</strong> 点击 “调用系统打印” 后，在弹出的打印面板「目标打印机」中选择 <strong>「另存为 PDF」</strong> 或 <strong>「Save as PDF」</strong>，「布局」选择<strong>「纵向」</strong>，并建议在「更多设置」里勾选<strong>「背景图形」</strong>，即可无瑕获取物理级高清求职简历！
                </span>
              </div>

              {/* A4 Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 flex items-center justify-center bg-zinc-700">
                {/* Isolated media print layout CSS rule */}
                <style>{`
                  @media print {
                    body {
                      background: #white !important;
                      color: #000 !important;
                    }
                    header, footer, nav, button, .no-print, .fixed, .bg-zinc-950, .backdrop-blur-xs, .bg-zinc-100 {
                      display: none !important;
                    }
                    #print-resume-target {
                      border: none !important;
                      box-shadow: none !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      width: 100% !important;
                      max-w-none !important;
                      position: absolute;
                      top: 0;
                      left: 0;
                      z-index: 99999;
                      display: block !important;
                    }
                  }
                `}</style>

                {/* Simulated A4 Sheet */}
                <div 
                  id="print-resume-target"
                  className="bg-white text-zinc-900 border border-zinc-300 w-full max-w-[210mm] min-h-[297mm] p-[20mm] md:p-[24mm] shadow-lg select-text font-serif relative"
                  style={{
                    letterSpacing: "0.015em",
                    lineHeight: "1.6"
                  }}
                >
                  {/* Title & Name */}
                  <div className="border-b border-zinc-800 pb-4 text-center space-y-2">
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 font-sans">
                      {editedResume.fullName}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zinc-650 font-mono">
                      <span>✉️ {editedResume.email}</span>
                      <span>📞 {editedResume.phone}</span>
                      {editedResume.socials && <span className="truncate max-w-[250px]">🌐 {editedResume.socials}</span>}
                    </div>
                  </div>

                  {/* Body grid */}
                  <div className="py-6 space-y-6 text-xs text-zinc-800">
                    {/* Summary */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-zinc-950 border-b border-zinc-300 pb-1.5 font-sans">
                        个人简介 / 职业评价
                      </h3>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {editedResume.summary}
                      </p>
                    </div>

                    {/* Skills */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-zinc-950 border-b border-zinc-300 pb-1.5 font-sans">
                        专业技能 Stack
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-xs">
                        {editedResume.skills.map((s, idx) => (
                          <span key={idx} className="bg-zinc-100 text-zinc-900 px-2 py-0.5 rounded border border-zinc-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Experiences */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-zinc-950 border-b border-zinc-300 pb-1.5 font-sans">
                        联合会诊工作履历
                      </h3>
                      <div className="space-y-4">
                        {editedResume.experience.map((exp, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold font-sans text-zinc-900">
                              <span>🏢 {exp.company} （{exp.position}）</span>
                              <span className="font-mono text-zinc-500 font-medium">{exp.duration}</span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-zinc-705 italic pl-1 text-zinc-700">
                              {exp.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Education */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-zinc-950 border-b border-zinc-300 pb-1.5 font-sans">
                        教育学术背景
                      </h3>
                      <div className="space-y-2">
                        {editedResume.education.map((edu, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs text-zinc-805">
                            <div className="font-sans font-bold">
                              🎓 {edu.school} — {edu.major} ({edu.degree})
                            </div>
                            <div className="font-mono text-zinc-500 font-medium">{edu.duration}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
