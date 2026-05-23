export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  duration: string;
  description: string; // Bullet points or text
}

export interface Education {
  id: string;
  school: string;
  major: string;
  duration: string;
  degree: string;
}

export interface Resume {
  id: string;
  title: string;       // e.g. "Full Stack Developer Resume", "Product Manager Resume"
  fullName: string;
  email: string;
  phone: string;
  socials?: string;    // GitHub, LinkedIn etc
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  updatedAt: string;
}

export interface MatchResult {
  matchScore: number; // 0 to 100
  suitabilityLevel: '🔥 High Match' | '✨ Moderate Match' | '⚠️ Low Match';
  rationale: string;
  strengths: string[];
  gaps: string[];
  suggestedKeywords: string[];
  tailoredGreeting: {
    brief: string;      // Simple greeting (e.g. for Boss Zhipin)
    formal: string;     // Cover letter intro (e.g. for Email)
    personalized: string; // Friendly / Direct intro (e.g. for LinkedIn)
  };
  tailoredResumeChanges: {
    summary: string;
    skillsToAdd: string[];
    experienceModifications: {
      experienceId: string;
      originalCompany: string;
      originalPosition: string;
      suggestedPoints: string; // Edited bullet points to better match the JD
    }[];
  };
}

export interface JobJobProfile {
  company: string;
  position: string;
  description: string;
  salaryRange?: string;
  location?: string;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  salary?: string;
  location?: string;
  jdText: string;
  appliedDate: string;
  status: 'interested' | 'matched' | 'tailored' | 'applied' | 'interviewing' | 'offer' | 'rejected';
  originalResumeId: string;
  tailoredResume?: Resume; // If tailored
  matchResult?: MatchResult;
  notes?: string;
  // Automated delivery meta
  channel?: 'boss' | 'liepin' | 'lagou' | 'official' | 'email';
  autoApplied?: boolean;
  greetingText?: string;
}

export interface AutoApplyConfig {
  autoGreeting: boolean;
  greetingTone: 'professional' | 'energetic' | 'humble' | 'direct';
  autoTailor: boolean;
  minMatchScore: number;
  blacklistKeywords: string[];
  channelPreference: ('boss' | 'liepin' | 'lagou' | 'official' | 'email')[];
}

