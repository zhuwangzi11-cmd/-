import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side JSON parsing limit for long resumes and job descriptions
app.use(express.json({ limit: "15mb" }));

// Initialize GoogleGenAI with safe server-side key check and telemetry User-Agent
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || "MOCK_KEY_FOR_TESTING_COMPILATION",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Match Evaluation Endpoint
app.post("/api/gemini/match", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 环境变量未配置。请在 AI Studio 设置中的 Secrets 选项卡中配置并启动。",
      });
    }

    const { resume, jdText, company, position } = req.body;

    if (!resume || !jdText) {
      return res.status(400).json({ error: "简历和岗位描述 (JD) 均为必填项" });
    }

    const prompt = `
你是一名专业的猎头顾问和招聘总监 (Recruiting Director)。请对求职者的简历和目标岗位描述 (JD) 进行深入、客观、且极其精准的“人岗匹配”分析，并提供针对性的聊天打招呼语、正式求职信，以及具体的简历微调建议。

请根据 JD 要求的语言（如果 JD/公司信息多为中文，请用中文回复；如果偏向英文，则用相应语言），提供润色、回复与简历调整结果。

【岗位信息】
公司名称: ${company || "未提供工作单位"}
目标职位: ${position || "未提供岗位名称"}
工作职责与要求:
${jdText}

【当前求职者简历概要】
姓名: ${resume.fullName}
意向标题: ${resume.title}
专业简述: ${resume.summary}
技能库: ${Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills}

【工作经历工作细节】
${
  resume.experience && resume.experience.length > 0
    ? resume.experience
        .map(
          (exp: any) => `
ID: ${exp.id}
公司: ${exp.company} | 职位: ${exp.position} | 时间: ${exp.duration}
工作内容:
${exp.description}
`
        )
        .join("\n")
    : "暂无工作经历"
}

【教育背景】
${
  resume.education && resume.education.length > 0
    ? resume.education
        .map(
          (edu: any) => `
学校: ${edu.school} | 专业: ${edu.major} | 学位: ${edu.degree} | 时间: ${edu.duration}
`
        )
        .join("\n")
    : "暂无学历背景"
}

请对简历进行评估，输出符合以下 JSON Schema 的结构化结果。在调整简历(experienceModifications)时，针对原有的每一个工作经历(Experience ID)，基于 JD 的核心痛点、技术栈或管理技能需求，重新撰写 3-4 条高度契合、数据量化(STAR法则)、凸显优势的工作成就 bullet points 作为 suggestedPoints，替换现有表述（避免空泛，要紧扣 JD）。
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "你是一个顶尖的顾问，精通中英文求职市场。你善于站在HR或面试官角度分析简历痛点，并善于用最地道、最打动人的语气（既礼貌又自信）生成打招呼话术，并运用STAR法则微调简历。你必须严格按照指定的 JSON 结构返回。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: {
              type: Type.NUMBER,
              description: "人岗匹配度，0到100之间的整数得分",
            },
            suitabilityLevel: {
              type: Type.STRING,
              description: "匹配等级分类。必须是 '🔥 High Match', '✨ Moderate Match', 或 '⚠️ Low Match' 之一",
            },
            rationale: {
              type: Type.STRING,
              description: "用求职规划师/猎头视角对匹配关系的综合分析（分析候选人的胜任度与核心优劣势，150-300字）",
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "候选人非常契合该岗位的核心优势列表（3-5条，高度概括）",
            },
            gaps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "候选人相对于此岗位的硬伤或硬核技能缺失，或在简历中表现不足的地方建议（2-4条）",
            },
            suggestedKeywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "为了提高过筛率，简历中可以显著增加或突出的核心关键词/技术/工具（如 'Redis', '跨团队沟通' 等，5-8个）",
            },
            tailoredGreeting: {
              type: Type.OBJECT,
              properties: {
                brief: {
                  type: Type.STRING,
                  description: "适用于即时通讯软件（如 Boss直聘 / 微信）的一句话打招呼语。亲切、简练（120字以内），直切对方部门可能有的痛点，并突出自己最强的一项对口经验，引导对方交换简历或作进一步沟通。",
                },
                formal: {
                  type: Type.STRING,
                  description: "适用于求职信 (Cover Letter) 或正式投递邮件的第一段落与正文核心（150-350字），商务得体，分点阐明为什么自己非常适合这个岗位。",
                },
                personalized: {
                  type: Type.STRING,
                  description: "适用于 LinkedIn 的好友申请或私信社交邀请语（100字左右），偏向职业社交、表达对对方公司/岗位的兴趣并说明互惠合作价值。",
                },
              },
              required: ["brief", "formal", "personalized"],
            },
            tailoredResumeChanges: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: "针对当前 JD 量身订制微调后的简历‘自我评价 / Professional Summary’。突出与此岗位痛点相配的个人定位。",
                },
                skillsToAdd: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "建议额外补充进简历技能栏的 JD 热门核心技能词（2-4个）",
                },
                experienceModifications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      experienceId: {
                        type: Type.STRING,
                        description: "对应原简历经历中的 ID，必须和原经历 ID 一致",
                      },
                      originalCompany: {
                        type: Type.STRING,
                        description: "原经历的公司名称",
                      },
                      originalPosition: {
                        type: Type.STRING,
                        description: "原经历的职位名称",
                      },
                      suggestedPoints: {
                        type: Type.STRING,
                        description: "全新润色后的工作描述 points (多行文本以换行 \\n 分割)。请深度挖掘本段工作的职责细节，巧妙植入 JD 相应的技术词与指标导向（例如：技术栈对口、带过多少人、产出提升百分之多少等）。务必保留公司和职位的真实性质，只是强化相关性表达。",
                      },
                    },
                    required: ["experienceId", "originalCompany", "originalPosition", "suggestedPoints"],
                  },
                },
              },
              required: ["summary", "skillsToAdd", "experienceModifications"],
            },
          },
          required: [
            "matchScore",
            "suitabilityLevel",
            "rationale",
            "strengths",
            "gaps",
            "suggestedKeywords",
            "tailoredGreeting",
            "tailoredResumeChanges",
          ],
        },
      },
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText.trim());

    res.json(resultJson);
  } catch (error: any) {
    console.error("Gemini matching API failed: ", error);
    res.status(500).json({
      error: error.message || "请求 AI matching 接口时发生未知错误，请检查网络和 API KEY 状态",
    });
  }
});

// AI Intelligent Raw Job Description parsing
app.post("/api/gemini/parse-jd", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 未配置。请在 Secrets 选项卡中进行配置。",
      });
    }

    const { rawText } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "请提供供解析的原始文本" });
    }

    const prompt = `
你是一位极其聪明的数据提取分析官，善于从用户日常复制的乱糟糟、格式杂乱的招聘广告（JD）文本中精准地提取关键核心元数据。
请解析以下招聘原始文本，转换成规范的结构。

如果是联系邮箱、提到发送简历到xx邮箱，或者以邮箱标题，必须将渠道归类为 'email'；
如果是含有官网链接、公司自主系统，必须归类为 'official'；
如果不明确，可以根据常见文字描述（如“BOSS直聘”，“猎头群”，“拉勾”）分类，可选值仅范围为: 'boss', 'liepin', 'lagou', 'official', 'email'。

【原始输入文本】
${rawText}

请仔细提取并输出符合以下 JSON Schema 的规范响应。
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "你专门用于将任意非结构化求职或招聘岗位描述转换成结构化的JSON。不可返回其他冗余说明，必须严格输出有效JSON。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            company: {
              type: Type.STRING,
              description: "提取的雇主/企业/公司名称。如找不到具体公司，设为'某互联网科技公司'或类似推断"
            },
            position: {
              type: Type.STRING,
              description: "提取的核心职位或者岗位名称。例如: '高级前端工程师'"
            },
            salary: {
              type: Type.STRING,
              description: "提取的薪资待遇范围，如果是空或找不到则设为'薪资面议'"
            },
            channel: {
              type: Type.STRING,
              description: "渠道分类。必须是 'boss', 'liepin', 'lagou', 'official', 'email' 之一"
            },
            jdText: {
              type: Type.STRING,
              description: "精简和清洗排版后的技术工作职责或要求条件（Markdown或者分条列举格式，字数不要过多，保留核心即可）"
            }
          },
          required: ["company", "position", "channel", "jdText"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gemini JD parsing API failed: ", error);
    res.status(500).json({
      error: error.message || "由于AI解析遇到异常，您可以尝试手动配置录入！",
    });
  }
});

// AI Intelligent Resume parsing supporting PDF, DOCX, TXT/MD
app.post("/api/gemini/parse-resume", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 未配置。请在 Secrets 选项卡中进行配置并启动。",
      });
    }

    const { base64Data, fileType, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "请提供需解析的简历文件（Base64格式）" });
    }

    let parsedText = "";
    let isPdf = false;

    if (fileType === "application/pdf") {
      isPdf = true;
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName?.endsWith(".docx")
    ) {
      // Decode DOCX files using mammoth
      const buffer = Buffer.from(base64Data, "base64");
      const result = await mammoth.extractRawText({ buffer });
      parsedText = result.value;
    } else {
      // Read text files, markdown, etc.
      const buffer = Buffer.from(base64Data, "base64");
      parsedText = buffer.toString("utf8");
    }

    let contents: any[] = [];

    if (isPdf) {
      contents = [
        {
          inlineData: {
            data: base64Data,
            mimeType: "application/pdf"
          }
        },
        "请帮我解析这个 PDF 简历文档，提取其中包含的所有职业元数据。请将其重组并输出为结构化的 JSON 模型。"
      ];
    } else {
      contents = [
        `请帮我解析以下从简历中提取出的原始文本，过滤乱码并重整提取其中所含的关键职业技能、工作经历、教育背景与个人总结。
        
【简历文本】
${parsedText}

请按照规范的 JSON Schema 输出。`
      ];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "你是一位专业的高级简历解析提取官，专门将任何不规整/乱序或者含有格式乱码的文本/PDF简历高精度解析、抽提并转换成格式严谨无暇的 JSON。千万不要返回除 JSON 之外的任何注释、Markdown 标记、或解释文字。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: {
              type: Type.STRING,
              description: "候选人的真实姓名。若找不到则设为“未命名求职者”"
            },
            title: {
              type: Type.STRING,
              description: "自动生成的简历别名。例：“前端开发工程师 - 5年经验简历”"
            },
            email: {
              type: Type.STRING,
              description: "联系邮箱。例：“example@mail.com”"
            },
            phone: {
              type: Type.STRING,
              description: "提取的手机号/联系电话。例：“13800138000”"
            },
            socials: {
              type: Type.STRING,
              description: "作品集、GitHub链接或个人主页等，可为空"
            },
            summary: {
              type: Type.STRING,
              description: "个人核心竞争力与自评总结（用流畅、严密的第一/第三人称阐述，100-200字）"
            },
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "提取的核心技能栈/工具（如 'React', 'TypeScript', 'Node.js', 'Redis'），提取 5-15 个"
            },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING, description: "任职公司名称" },
                  position: { type: Type.STRING, description: "担任职级/职位" },
                  duration: { type: Type.STRING, description: "起止时间段。例：'2022.03 - 2024.05'" },
                  description: { type: Type.STRING, description: "工作职责与亮点产出，用分点形式，使用换行\\n符号连接" }
                },
                required: ["company", "position", "duration", "description"]
              },
              description: "工作履历段落列表"
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  school: { type: Type.STRING, description: "毕业/在读学校名称" },
                  major: { type: Type.STRING, description: "专业名称" },
                  degree: { type: Type.STRING, description: "学位/学历层次。例：“本科”、“硕士”、“大专”" },
                  duration: { type: Type.STRING, description: "在校起止时间段" }
                },
                required: ["school", "major", "degree", "duration"]
              },
              description: "教育背景经历列表"
            }
          },
          required: ["fullName", "email", "phone", "summary", "skills", "experience", "education"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gemini Resume parsing API failed: ", error);
    res.status(500).json({
      error: error.message || "解析此简历文件发生异常，请尝试更换格式或手动复制填入！",
    });
  }
});

// AI Intelligent job recommendations (adapting suitable roles with 80%+ match rate based on the resume)
app.post("/api/gemini/recommend-jobs", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 未配置。请在 Secrets 选项卡中进行配置并启动。",
      });
    }

    const { resume } = req.body;
    if (!resume) {
      return res.status(400).json({ error: "未检测到有效简历，请先在‘参考简历库’上传或输入您的简历" });
    }

    const prompt = `
你是一位极其专业的明星招聘顾问、职业发展分析师。
请针对当前求职者的核心技能、个人总结和工作经历项目细节，全自动适配并模拟生成 4 个非常真实、对口的高质量招聘职位（Job Descriptions）。
推荐条件极其严格：必须精准适配，使推导出的岗位匹配率全部保持在 80% 至 98% 之间，绝对不能低于 80%！

【求职者简历概要】
候选姓名: ${resume.fullName}
意向定位: ${resume.title}
自我总结: ${resume.summary}
技能清单: ${Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills}
工作与项目经历:
${
  resume.experience && resume.experience.length > 0
    ? resume.experience
        .map(
          (exp: any) => `
- 公司: ${exp.company}
  职位: ${exp.position} (${exp.duration})
  内容: ${exp.description}
`
        )
        .join("\n")
    : "暂无经历"
}

请精准计算、高度微调，务必输出 4 个完美匹配该候选人的目标职位。
【输出要求】
- 必须包含：推荐匹配指数（matchScore 为 80 至 98 的整数）、适配的理由、公司名、具体岗位、预估薪金及详细的岗位职责与要求文本（jdText）。
- 对于 jdText 文本：请写得像标准招聘网站（如 Boss 直聘、大厂官网、拉勾网）上发布的真实、高质量 JD 一样专业，分【工作职责】与【任职资格】描述。
- 必须严格遵守以下 JSON Schema 输出：
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "你是一位高级AI职业评测专家。专为候选人筛选与推荐高对口，匹配度超过 80% 胜任率的高端职位，并提供详细的契合点解析。必须且只能返回规范的纯 JSON 格式。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedJobs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING, description: "推荐企业名称，如 '字节跳动'、'腾讯科技'、'快手科技-SaaS事业部'" },
                  position: { type: Type.STRING, description: "适配推荐的岗位名称，如 '高级前端开发工程师'、'AI产品经理主管'" },
                  salary: { type: Type.STRING, description: "估算对标薪资标准，如 '25k-40k * 15薪'" },
                  matchScore: { type: Type.NUMBER, description: "预先测算的科学匹配百分比（必须是 80 到 98 之间的整数）" },
                  matchReason: { type: Type.STRING, description: "匹配缘由分析，指出其简历内与该JD最对口的1-2项核心突出强项 (100字内)" },
                  jdText: { type: Type.STRING, description: "该岗位真实的专业JD详细要求。必须包含工作职责和任职条件，排版美观，使用\\n换行" }
                },
                required: ["company", "position", "salary", "matchScore", "matchReason", "jdText"]
              }
            }
          },
          required: ["recommendedJobs"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gemini Job Adaptation Engine failed: ", error);
    res.status(500).json({
      error: error.message || "智能岗位推荐适配接口异常，请稍候重试！",
    });
  }
});

// AI custom-tailored interview questions generator
app.post("/api/gemini/interview-questions", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 未配置。请在 Secrets 选项卡中进行配置并启动。",
      });
    }

    const { resume, jdText, company, position } = req.body;
    if (!resume) {
      return res.status(400).json({ error: "未检测到有效简历，请提供参考简历" });
    }

    const prompt = `
你是一位世界500强企业资深技术面试官、产品总监与HR主管。
请根据求职者的职业简历背景和想要去应聘的公司及招聘JD（岗位职责与硬性要求），针对性地预测、量身推导出 3 个非常切中要害、能够穿透候选人背景水分并考查真实战力的面试真题。

【应聘标的】
公司名: ${company || "神秘企业"}
岗位名称: ${position || "高级核心骨干岗"}
招聘职责与要求:
${jdText || "暂未提供JD要求文本"}

【当前求职者简历概要】
候选姓名: ${resume.fullName}
意向标题: ${resume.title}
专业简述: ${resume.summary}
技能库: ${Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills}
核心工作经历项目:
${
  resume.experience && resume.experience.length > 0
    ? resume.experience
        .map(
          (exp: any) => `
- 公司: ${exp.company} | 岗位: ${exp.position}
  职责成果描述: ${exp.description}
`
        )
        .join("\n")
    : "暂无经历"
}

【问题输出要求】
1. 严禁全空泛通用问题（如自我介绍、优缺点之类），必须有 2 道题是结合求职者已有简历项目经历和新岗位业务/技术要求交织而成的“高拟真融合考题”；1 道题是针对 JD 里挑战最高的核心诉求（如高负载性能极限、高难度复杂交付、多方利益斡旋等）的“情景架构型深度大题”。
2. 每一个题目都要提供具体的通关黄金答题思路（answerFramework），作为求职者的思考引路。
3. 必须严格按照以下 JSON Schema 输出：
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "你是一个高级AI面试专家。你需要针对候选人的真实履历与目标JD交叉推演最核心的面试考点，输出真实而尖锐的问题。必须且只能返回规范的纯 JSON 格式。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionText: { type: Type.STRING, description: "高度定制化拟真技术/业务实作面试题目" },
                  questionType: { type: Type.STRING, description: "考点属性，如 '融合背景技术攻坚'、'STAR原则项目深挖'、'情景冲突协调'、'真实架构演进'" },
                  answerFramework: { type: Type.STRING, description: "极富启发性的大厂明星破题通关思路框架（100-200字，指导用户应该挑选简历哪段经历、套用何种话术作答）" }
                },
                required: ["questionText", "questionType", "answerFramework"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gemini Interview questions generation failed: ", error);
    res.status(500).json({
      error: error.message || "智能面试真题预测接口发生异常，请稍候重试！",
    });
  }
});

// AI Interview Candidate Answer Evaluator & Professional Speech Polisher
app.post("/api/gemini/evaluate-answer", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 未配置。请在 Secrets 选项卡中进行配置并启动。",
      });
    }

    const { question, answer, resume, jdText } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "问题内容和您的临时答案均不能为空" });
    }

    const prompt = `
你是一位在心仪大厂拥有10+年高层选拔经验的资深面试考官、也是金牌求职表达辅导专家。
请针对当前面试题目，以及求职者的随手随写草拟回答，结合其自身的简历底牌及 JD 要求，进行全方位的打分、尖锐排雷与“豪华黄金升级词”重塑润色。

【正在面对的技术/业务问题】
"${question}"

【求职者的草拟作答】
"${answer}"

【求职者简历库参考】
姓名: ${resume?.fullName || "候选人"}
技能树: ${resume?.skills ? (Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills) : ""}
自我评价: ${resume?.summary || ""}
${
  resume?.experience && resume.experience.length > 0
    ? `工作详情项目：\n` + resume.experience.map((exp: any) => `公司:${exp.company} | 岗位:${exp.position} | 描述:${exp.description}`).join("\n")
    : ""
}

【系统指令与重塑规范】
1. 分析求职者回答的逻辑缺失、空洞用词、或者不契合 JD 难点、没有亮眼量化数据成果（STAR）的“致命逻辑漏洞”。
2. 基于此分析，重新设计、组织、打磨一版超级让人心动、逻辑顶配、细节丰富的“3.0豪华通关示范拟真话术”（perfectResponse）。
   - 这版高级话术必须以【第一人称（“我”）】视角来写，让求职者在现场可以直接通顺流利背诵、阐述。
   - 必须融会贯通简历里的项目底牌，杜绝假空吹嘘，要把真正的技术原理、痛点分析、以及量化的成就，融入到生动的解答中。
3. 必须严格遵守以下 JSON Schema 输出：
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "你是一位兼具考官的严厉和教练的包容的顶尖求职专家。在 perfectResponse 中给出惊艳夺目的高分示范，展现成熟的技术理解与高情商沟通，并严格遵循纯 JSON 返回。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "综合模拟得分，0到100的精算数字。如果回答太简单或跑题请打低分（如<60），如果诚恳饱满请酌情高分" },
            critique: { type: Type.STRING, description: "专业而直接的考官犀利排雷，指出该回答里逻辑空泛或者未突出简历核心胜任点的地方（限150字）" },
            perfectResponse: { type: Type.STRING, description: "重磅推荐：3.0大厂首选重塑第一人称答题示范。排版漂亮清晰，运用STAR法则把技术细节和指标说透（中文字数200-400，可用\\n换行）" }
          },
          required: ["score", "critique", "perfectResponse"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gemini Interview evaluation failed: ", error);
    res.status(500).json({
      error: error.message || "智能答题点评辅导接口异常，请稍候重试！",
    });
  }
});

// AI Deep Duo Persona Resume Critical Reviewer (Senior HR + 10-Yr Leader)
app.post("/api/gemini/critique-resume", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY 未配置。请在 Secrets 选项卡中进行配置并启动。",
      });
    }

    const { resume, diagnosisExplanation } = req.body;
    if (!resume) {
      return res.status(400).json({ error: "未检测到有效简历，请提供要评估的简历数据" });
    }

    const explanationSection = diagnosisExplanation
      ? `【当前用户的诊断核心诉求/重点关注说明】：\n"${diagnosisExplanation}"\n请倾听用户的定制诉求，重点并在诊断点中对此加以解决解答。\n`
      : "";

    const prompt = `
你现在代表一个顶尖的求职诊断专家团：由一名“多年经验的资深HR招聘总监”以及一位“10年经验的大厂技术/业务团队Leader”组成。
请对求职者的整份简历进行极其严格、尖锐且极富建设性的全方位审视。

${explanationSection}
【当前求职者简历概要】
姓名: ${resume.fullName}
意向标题: ${resume.title}
自我评价: ${resume.summary}
技能库: ${Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills}

【工作经历工作细节】
${
  resume.experience && resume.experience.length > 0
    ? resume.experience
        .map(
          (exp: any) => `
ID: ${exp.id}
公司: ${exp.company} | 职位: ${exp.position} | 时间: ${exp.duration}
工作内容:
${exp.description}
`
        )
        .join("\n")
    : "暂无工作经历"
}

【教育背景】
${
  resume.education && resume.education.length > 0
    ? resume.education
        .map(
          (edu: any) => `
学校: ${edu.school} | 专业: ${edu.major} | 学位: ${edu.degree} | 时间: ${edu.duration}
`
        )
        .join("\n")
    : "暂无“教育背景”"
}

【诊断目标与要求】
请你找出简历中存在的 4-6 个最明显的短板或硬伤点，并提供具体的黄金整改对比：
1. 请站在资深招聘HR的视角：评估是否有错别字，中英文混排、专业名词拼写不规范（如把 react 写成 REACT, sql 写成 Sql，必须正确拼写如 React, SQL），项目经历是否缺失金字塔量化指标、工作职责叙述是否太平淡。
2. 站在10年大厂业务Leader的视角：审查工作职责是不是在“记流水账”，有没有能体现深度架构、高难度业务、技术选型思考、项目攻坚或团队领导力的闪光内容；是否只写“负责了xx”而没交代“通过何种方法在何种复杂背景下取得xx具体有说服力的成效”。
3. 针对每一个找出的痛点问题：
   - 标明 section：'summary' | 'skills'，或者是某个具体工作经历的 exp-XXX（经验ID，务必和原 ID 一致）。
   - 标明 severity：'high'（对应高能致命硬伤点，如核心岗位缺少量化成果或硬核技术名词规范，用红色代表）、'medium'（中度需优化点，如自我评价平淡、技能树缺少场景关联，用黄色代表）、'info'（体验提升建议）。
   - 提供 originalValue：原简历中对应的具体那段不好的描述/文本。
   - 提供 suggestedValue：**由10年Leader或资深HR重新以极度专业、高大上又符合事实的STAR准则撰写的完美替换段落**！这段文本应该保持结构完整，用换行\\n或者Bullet points表现（在Experience中应该为精美的工作描述，重新升华含金量）。

请严格按照以下 JSON Schema 输出：
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "你是由多年资深大厂HR及15年高层研发/业务总监组成的AI简历评审委员会。你辞藻洗练、眼光毒辣、精通各行各业的隐性招聘标准和话术重整。请客观诊断，不要客套，直指简历痛点并给出可一键替换的最佳优化范本。必须且只能返回纯 JSON 格式。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hrScore: { type: Type.NUMBER, description: "HR视角的简历质量指数 (满分100，如存在严重逻辑无量化或错别字拼写则应扣到60-70分)" },
            leaderScore: { type: Type.NUMBER, description: "技术/业务大班长视角的专业含金量实力分数 (满分100，如都在记流水账没写架构/复杂战绩，给50-65分)" },
            executiveSummary: { type: Type.STRING, description: "AI专家联合评审的诊断综合毒舌总评（指出最影响拿Offer的致命硬伤及简历改写后的预期改观，200字内）" },
            critiquePoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING, description: "对应的简历部分，例如 'summary' 或者 'skills' 或者是经历项目 ID (比如 Exp ID如 exp-parsed-0)" },
                  title: { type: Type.STRING, description: "诊断的改进切入点标题，例如 '项目工作流失焦，缺少数据量化'、'专业技能词拼写不符合大厂规范'、'自我定位虚设平淡'" },
                  critique: { type: Type.STRING, description: "大厂评审官的辛辣指出、为什么需要标红/黄修改，如果不改会造成什么后果（100字内）" },
                  severity: { type: Type.STRING, description: "缺陷评级。必须是 'high'（致命硬伤红标）, 'medium'（深度建议黄标）, 或 'info'（小微润色蓝标）之一" },
                  originalValue: { type: Type.STRING, description: "原简历中被挑出来的有缺憾的原始描述段落" },
                  suggestedValue: { type: Type.STRING, description: "大厂HR及Leader重新根据STAR法则润色升华后的完美文字，可以直接拿去替换该部分的描述内容（排版工整，富有商务与专业技术范）" }
                },
                required: ["section", "title", "critique", "severity", "originalValue", "suggestedValue"]
              }
            }
          },
          required: ["hrScore", "leaderScore", "executiveSummary", "critiquePoints"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gemini Resume Audit failed: ", error);
    res.status(500).json({
      error: error.message || "AI 简历专家评审诊断接口异常，请稍候重试！",
    });
  }
});

// Serve health status
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", keyConfigured: !!process.env.GEMINI_API_KEY });
});

// Handle Vite middleware integration based on standard environment templates
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Submission Server is running at http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
