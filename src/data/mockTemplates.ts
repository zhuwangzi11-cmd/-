import { Resume } from "../types";

export const initialTemplates: Resume[] = [
  {
    id: "tpl-frontend",
    title: "高级前端开发工程师简历",
    fullName: "张明",
    email: "zhangming.dev@example.com",
    phone: "138-1234-5678",
    socials: "GitHub: github.com/zhangming-dev | 个人网站: zhangming.io",
    summary: "拥有 5 年前台及全栈系统开发与架构经验，深谙 React 生态及 Web 性能优化。主导过日活跃用户 (DAU) 数十万级的大型跨端项目，擅长配合产品及架构团队攻坚复杂前端交互及自动化工作流搭建，崇尚用代码编写优雅高效的用户体验。",
    skills: ["React", "TypeScript", "Next.js", "Vite", "Tailwind CSS", "Redux Toolkit", "Web Performance Optimization", "Node.js (Express)", "Webpack/Esbuild", "CI/CD & Git"],
    experience: [
      {
        id: "exp-1",
        company: "极客跃动科技有限公司",
        position: "资深前端开发工程师",
        duration: "2023.03 - 至今",
        description: "1. 核心业务线研发负责人：主导公司 B2B 核心 SaaS 仪表盘重构项目，引入 React 18 新架构与 Vite 编译链，使得项目冷启动时间由 18 秒缩短至 1.5 秒，首屏渲染 FCP 提升 42%。\n2. 跨团队技术标准设计：负责搭建内部自研 UI 组件库并实现按需加载，覆盖全公司 4 个产品线，累计减少冗余代码引入约 35%，显著提升全栈工程师的模块复用率与开发效率。\n3. 前端工程化演进：主导落地前端 CI/CD 流程、精细化覆盖 ESLint/Prettier 约束，并在生产构建中集成 Webpack 包体压缩、CSS Sprites、图片自适应压缩等多项技术，降低服务器出站宽带成本达 20%。"
      },
      {
        id: "exp-2",
        company: "星火晨曦网络互娱公司",
        position: "前端开发工程师",
        duration: "2021.05 - 2023.02",
        description: "1. 泛娱乐音视频平台研发：负责直播间礼物特效通道及交互控制逻辑，深度结合 requestAnimationFrame 及 GPU 渲染加速，确保百人同屏下特效流畅度稳定在 60 FPS 且不卡顿。\n2. 轻量级移动端应用开发：基于 React Native 及 Tailwind 架构构建面向海外市场的轻社区应用，兼融移动端复杂长列表性能调优及无限滚动加载机制，App Store 用户评分稳定在 4.7 分。\n3. 推广埋点与 SEO 重写：配合市场与增长组对旧版官网开展 SEO 语义化重写，整车集成 SSR（服务器端渲染）手段，自然流搜索录入提升了 130%。"
      }
    ],
    education: [
      {
        id: "edu-1",
        school: "北京邮电大学",
        major: "软件工程",
        duration: "2017.09 - 2021.06",
        degree: "本科 / 学士学位"
      }
    ],
    updatedAt: "2026-05-22"
  },
  {
    id: "tpl-pm",
    title: "互联网高级产品经理简历",
    fullName: "李倩",
    email: "liqian.pm@example.com",
    phone: "156-8888-9999",
    socials: "LinkedIn: linkedin.com/in/liqian-pm",
    summary: "4 年互联网 C 端/B 端混合产品管理经验，擅长用户洞察、数据漏斗分析、需求优先级管理及多维敏捷研发推进。曾操盘过数十万用户群级的智能物流系统与本地生活工具，擅长将业务战略目标成功具象化为高增长的产品功能路线图，具备优秀的商业思维及跨部门沟通协作能力。",
    skills: ["产品生命周期管理 (PLM)", "PRD & 原型设计 (Axure/Figma)", "数据分析 (SQL/Tableau)", "增长策略 (A/B Test)", "用户体验设计 (UX/UI)", "敏捷管理 (Scrum)", "竞品调研", "项目运营"],
    experience: [
      {
        id: "exp-pm-1",
        company: "云道物流科技集团",
        position: "高级产品经理 (B端Saas与效率工具)",
        duration: "2022.10 - 至今",
        description: "1. 供应链智能调度系统：主导自研车辆运力智能调度系统 2.0 版产品设计，通过核心算法和需求解耦深度缩减空驶率，使首年跨省物流匹配流转效率提升 28%，季度运营成本节省约 300 万人民币。\n2. 推动敏捷研发：协调 25 人跨职能研发团队，担任敏捷教练角色并组织每日立会、回顾会议，实现产品迭代周期由 4 周/次，向双周发版高速推进，需求准时交付率维持在 94% 以上。\n3. 客户痛点调研与闭环：组织超过 30 场对一线卡车司机和仓储站长的下沉现场用户研究，归纳 150 项痛点特征并设计落地“一键结款”与“极速报险”功能，使得系统大户续约率上升了 15%。"
      },
      {
        id: "exp-pm-2",
        company: "斑马生活科技有限公司",
        position: "初级产品经理 (C端产品运营组)",
        duration: "2020.07 - 2022.09",
        description: "1. 核心增长漏洞提效：负责斑马外卖 App 首页“拼团特惠”产品模块，实施基于用户定位和偏好画像的高精准智能推荐规则，带领拼团模块 GMV 实现环比 45% 阶梯式增长。\n2. 裂变拉新活动运营：从 0 到 1 设计“斑马推荐金”双边裂变补贴营销方案，上线首周撬动活跃用户分享近 12 万次，新用户 CAC（获客成本）同比降低 35%。\n3. 数据指标监控：搭建日常核心业务漏斗仪表盘，每日监控注册-曝光-浏览-点击-下单全路径变动，排查出结算页特定操作路径卡顿的严重痛点，配合前端紧急优化后收单完成率即时挽回 4%。"
      }
    ],
    education: [
      {
        id: "edu-pm-1",
        school: "浙江大学",
        major: "信息管理与信息系统",
        duration: "2016.09 - 2020.06",
        degree: "本科 / 学士学位"
      }
    ],
    updatedAt: "2026-05-22"
  }
];
