/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Resume, JobApplication, MatchResult } from "./types";
import { initialTemplates } from "./data/mockTemplates";
import ResumeEditor from "./components/ResumeEditor";
import JobMatcher from "./components/JobMatcher";
import ApplicationTracker from "./components/ApplicationTracker";
import AutoApplyBot from "./components/AutoApplyBot";
import { animate, motion, AnimatePresence } from "motion/react";
import { Sparkles, FileText, Compass, ClipboardList, CheckSquare, Award, ArrowRight, Server, AlertCircle, Bot, Crown, Gem, QrCode, Lock, Unlock, Check, RotateCcw, ShieldCheck, Flame } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"resumes" | "match" | "tracker" | "bot">("resumes");

  // Keep handles for backward compatibility with child components
  const handleRecordUsage = (actionName: string): boolean => {
    return true; // Always allowed, no limits, no annoying walls
  };

  // State managers
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [applications, setApplications] = useState<JobApplication[]>([]);
  
  // Health/API config check state
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedResumes = localStorage.getItem("job_companion_resumes");
    const savedApps = localStorage.getItem("job_companion_apps");

    if (savedResumes) {
      try {
        const parsed = JSON.parse(savedResumes);
        setResumes(parsed);
        if (parsed.length > 0) setSelectedResumeId(parsed[0].id);
      } catch (e) {
        setResumes(initialTemplates);
        setSelectedResumeId(initialTemplates[0].id);
      }
    } else {
      setResumes(initialTemplates);
      setSelectedResumeId(initialTemplates[0].id);
      localStorage.setItem("job_companion_resumes", JSON.stringify(initialTemplates));
    }

    if (savedApps) {
      try {
        setApplications(JSON.parse(savedApps));
      } catch (e) {
        setApplications([]);
      }
    }

    // Check system health endpoint
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setKeyConfigured(!!data.keyConfigured);
      })
      .catch(() => {
        setKeyConfigured(false);
      });
  }, []);

  // Save triggers
  const saveResumesToLocal = (newResumes: Resume[]) => {
    setResumes(newResumes);
    localStorage.setItem("job_companion_resumes", JSON.stringify(newResumes));
  };

  const saveAppsToLocal = (newApps: JobApplication[]) => {
    setApplications(newApps);
    localStorage.setItem("job_companion_apps", JSON.stringify(newApps));
  };

  const handleSelectResume = (id: string) => {
    setSelectedResumeId(id);
  };

  const handleSaveResume = (updated: Resume) => {
    const next = resumes.map((r) => (r.id === updated.id ? updated : r));
    saveResumesToLocal(next);
  };

  const handleCreateResume = (fresh: Resume) => {
    const next = [...resumes, fresh];
    saveResumesToLocal(next);
    setSelectedResumeId(fresh.id);
  };

  const handleDeleteResume = (id: string) => {
    const next = resumes.filter((r) => r.id !== id);
    saveResumesToLocal(next);
    if (selectedResumeId === id && next.length > 0) {
      setSelectedResumeId(next[0].id);
    }
  };

  // Callback once user matches a job & clicks "一键应用并定制简历"
  const handleApplyTailoring = (
    tailoredResume: Resume,
    company: string,
    position: string,
    matchResult: MatchResult
  ) => {
    const newApp: JobApplication = {
      id: "app-" + Date.now(),
      company,
      position,
      jdText: "", // Keep client lightweight
      appliedDate: new Date().toISOString().split("T")[0],
      status: "tailored",
      originalResumeId: selectedResumeId,
      tailoredResume,
      matchResult,
      notes: "简历已在 AI 精调匹配室内按岗位JD重写重写，匹配度等级 " + matchResult.suitabilityLevel,
    };

    const nextApps = [newApp, ...applications];
    saveAppsToLocal(nextApps);

    // Switch to tracker tab automatically so they can see it!
    setTimeout(() => {
      setActiveTab("tracker");
    }, 1200);
  };

  // Tracker functions
  const handleUpdateStatus = (id: string, status: JobApplication["status"]) => {
    const next = applications.map((app) => (app.id === id ? { ...app, status } : app));
    saveAppsToLocal(next);
  };

  const handleDeleteApplication = (id: string) => {
    const next = applications.filter((app) => app.id !== id);
    saveAppsToLocal(next);
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    const next = applications.map((app) => (app.id === id ? { ...app, notes } : app));
    saveAppsToLocal(next);
  };

  const currentActiveResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">
      {/* Upper Navigation Rail */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-150">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-md font-bold text-zinc-900 tracking-tight">AI 智能求职投递助手</h1>
              <p className="text-[11px] text-zinc-500 font-normal">基于 Gemini AI 的一站式人岗智能比对、精细化简历包装与求职智能加速器</p>
            </div>
          </div>

          {/* Core Applet Workspace Selector Tabs */}
          <div className="flex bg-zinc-100 p-1 rounded-xl overflow-x-auto scrollbar-none snap-x whitespace-nowrap max-w-full">
            <button
              onClick={() => setActiveTab("resumes")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 snap-start ${
                activeTab === "resumes"
                  ? "bg-white text-indigo-700 shadow-3xs"
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
            >
              <FileText size={14} /> 我的简历库
            </button>
            <button
              onClick={() => setActiveTab("match")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 snap-start ${
                activeTab === "match"
                  ? "bg-white text-indigo-700 shadow-3xs"
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
            >
              <Compass size={14} /> AI 岗位精匹配
            </button>
            <button
              onClick={() => setActiveTab("tracker")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 snap-start ${
                activeTab === "tracker"
                  ? "bg-white text-indigo-700 shadow-3xs"
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
            >
              <ClipboardList size={14} /> 投递跟踪状态版
            </button>
            <button
              onClick={() => setActiveTab("bot")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 snap-start ${
                activeTab === "bot"
                  ? "bg-white text-indigo-700 shadow-3xs"
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
            >
              <Bot size={14} /> AI 批量模拟投递
            </button>
          </div>
        </div>
      </header>

      {/* Secret config checklist notice */}
      {keyConfigured === false && (
        <div className="bg-amber-50 border-b border-amber-100 py-3 px-4 text-amber-900 text-center text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <span>
              <strong>提示：</strong>系统未探测到 <code>GEMINI_API_KEY</code> 密钥安全注入。为实现精确的人岗匹配和智能打招呼话术，请在 <strong>Settings &gt; Secrets</strong> 面板添加 <code>GEMINI_API_KEY</code> 变量。
            </span>
          </div>
        </div>
      )}

      {/* Primary Container Viewport Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "resumes" && resumes.length > 0 && (
              <ResumeEditor
                key={selectedResumeId || (resumes[0] && resumes[0].id) || "empty"}
                resumes={resumes}
                selectedResumeId={selectedResumeId}
                onSelectResume={handleSelectResume}
                onSaveResume={handleSaveResume}
                onCreateResume={handleCreateResume}
                onDeleteResume={handleDeleteResume}
                onRecordUsage={handleRecordUsage}
              />
            )}

            {activeTab === "match" && (
              <div className="space-y-6">
                {/* Active resume banner confirmation */}
                <div className="bg-white p-4 rounded-xl border border-zinc-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-zinc-700 text-xs">
                    <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                    <span>
                      当前比对参考对象：<strong>{currentActiveResume?.title}</strong> ({currentActiveResume?.fullName})。需要更换可在上方标签切换至 “我的简历库”。
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("resumes")}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold text-xs tracking-wider cursor-pointer"
                  >
                    去更换
                  </button>
                </div>

                {currentActiveResume ? (
                  <JobMatcher
                    currentResume={currentActiveResume}
                    onApplyTailoring={handleApplyTailoring}
                    onRecordUsage={handleRecordUsage}
                  />
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 text-zinc-400 text-xs">
                    请在“我的简历库”中先指定或录入一份基础主简历。
                  </div>
                )}
              </div>
            )}

            {activeTab === "tracker" && (
              <ApplicationTracker
                applications={applications}
                onUpdateStatus={handleUpdateStatus}
                onDeleteApplication={handleDeleteApplication}
                onUpdateNotes={handleUpdateNotes}
                onAddResume={handleCreateResume}
              />
            )}

            {activeTab === "bot" && (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border border-zinc-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-zinc-700 text-xs">
                    <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                    <span>
                      批量模块绑定投递的简历对象：<strong>{currentActiveResume?.title}</strong> ({currentActiveResume?.fullName})。可以在上方 “我的简历库” 切换。
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("resumes")}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold text-xs tracking-wider cursor-pointer shrink-0"
                  >
                    去更换
                  </button>
                </div>

                {currentActiveResume ? (
                  <AutoApplyBot
                    currentResume={currentActiveResume}
                    applications={applications}
                    onAddApplication={(newApp) => {
                      const next = [newApp, ...applications];
                      saveAppsToLocal(next);
                    }}
                    onRecordUsage={handleRecordUsage}
                  />
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 text-zinc-400 text-xs">
                    请先切换至“我的简历库”指定一份基础主简历。
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Subtle Footer */}
      <footer className="bg-white border-t border-zinc-100 py-6 text-center text-zinc-400 text-xs font-normal">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            AI 智能求职投递助手 &mdash; 精准匹配、定制自打招呼、求职记录多端管理
          </p>
          <div className="flex items-center gap-1.5 font-mono text-zinc-300">
            <span>Powered by Gemini 3.5</span>
            <span>&middot;</span>
            <span>UTC 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
