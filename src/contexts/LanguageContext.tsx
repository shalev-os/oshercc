import { createContext, useContext, useEffect, type ReactNode } from "react";

export type Lang = "en";

interface LanguageContextType {
  lang: Lang;
  t: (key: string) => string;
  dir: "ltr";
}

const translations: Record<string, string> = {
  "nav.about": "About",
  "nav.skills": "Skills",
  "nav.experience": "Experience",
  "nav.certifications": "Certifications",
  "nav.contact": "Contact",
  "hero.portfolio": "Portfolio",
  "hero.hello": "Hello, I'm",
  "hero.viewExperience": "View Experience",
  "hero.getInTouch": "Get in Touch",
  "hero.downloadCV": "Download CV",
  "hero.viewCV": "View CV",
  "hero.downloadPdf": "Download PDF",
  "hero.cvPreview": "CV Preview",
  "hero.role1": "Technical Support Specialist",
  "hero.role2": "System Administrator",
  "hero.role3": "DevOps Enthusiast",
  "hero.role4": "Full Stack Developer",
  "about.title": "About Me",
  "about.p1":
    "Experienced Technical Support Specialist with a proven track record of ensuring smooth operation of servers and microservices. Skilled in troubleshooting and resolving technical issues promptly, with extensive networking and system administration expertise.",
  "about.p2":
    "Adept at utilizing SQL databases, Kibana, and AWS for log analysis and service recording. Successfully manages a technical department, fostering efficient workflow and effective issue resolution. Demonstrates proficiency in working with internal ticketing systems and adhering to SLA workflows.",
  "about.yearsExp": "Years Experience",
  "about.companies": "Companies",
  "about.certHours": "Cert. Hours",
  "skills.title": "My Skills",
  "skills.subtitle":
    "Technologies and tools I use to solve complex technical challenges",
  "skills.serverMgmt": "Server Management",
  "skills.serverDesc": "Troubleshooting, server monitoring, query execution",
  "skills.networking": "Networking & VoIP",
  "skills.networkDesc": "ASTERISK, VoIP, network security, protocols",
  "skills.databases": "Databases",
  "skills.dbDesc": "SQL, MongoDB, log analysis with Kibana",
  "skills.cloud": "Cloud Services",
  "skills.cloudDesc": "AWS, API Integrations, DevOps",
  "skills.cyber": "Cyber Security",
  "skills.cyberDesc": "MCSA, Linux, Cyber Security Specialist",
  "skills.support": "Technical Support",
  "skills.supportDesc": "Call center management, Jira, SLA, VIP clients",
  "skills.heatmapTitle": "Skills Proficiency Map",
  "skills.beginner": "Beginner",
  "skills.expert": "Expert",
  "github.title": "GitHub Projects",
  "github.subtitle": "Open source projects and repositories from my GitHub",
  "github.noDesc": "No description available",
  "exp.title": "Work Experience",
  "exp.subtitle": "My professional journey in technology and technical support",
  "edu.title": "Education & Certifications",
  "edu.subtitle":
    "Professional training and certifications in cyber security and technology",
  "edu.certifications": "Certifications",
  "edu.languages": "Languages",
  "edu.fluent": "Fluent",
  "edu.native": "Native",
  "edu.viewCert": "View Certificate",
  "contact.title": "Let's Connect",
  "contact.subtitle":
    "Looking for a Technical Support Specialist? I'd love to hear from you",
  "contact.email": "Email",
  "contact.phone": "Phone",
  "contact.location": "Location",
  "contact.locationVal": "Ashkelon, Israel",
  "contact.fullName": "Full Name",
  "contact.emailPlaceholder": "Email",
  "contact.messagePlaceholder": "How can I help you?",
  "contact.errorName": "Enter your name",
  "contact.errorEmail": "Enter your email address",
  "contact.errorEmailFormat": "Enter a valid email address",
  "contact.errorMessage": "Enter your message",
  "contact.openDraft": "Open Email Draft",
  "contact.draftHelp":
    "This form opens your email app. Review the draft and send it there, or email shalev@osher.cc directly.",
  "contact.draftPrepared":
    "Finish sending in your email app. The website has not sent or saved your message.",
  "contact.openTo":
    "I'm open to new opportunities in Technical Support, DevOps, and Cyber Security. If you have a suitable role or project, contact me by email or phone.",
  "footer.rights": "© 2026 Shalev Osher. All rights reserved",
  "notFound.badge": "404 / Route lost",
  "notFound.title": "Page Not Found",
  "notFound.description": "The path {path} does not exist in this system.",
  "notFound.home": "Return Home",
  "notFound.back": "Go Back",
  "a11y.title": "Accessibility",
  "a11y.contentAdj": "Content Adjustments",
  "a11y.visualAdj": "Visual Adjustments",
  "a11y.navigation": "Navigation & Orientation",
  "a11y.reset": "Reset All Settings",
  "a11y.textSize": "Text Size",
  "a11y.lineHeight": "Line Height",
  "a11y.highContrast": "High Contrast",
  "a11y.invertColors": "Invert Colors",
  "a11y.hideImages": "Hide Images",
  "a11y.highlightTitles": "Highlight Titles",
  "a11y.highlightLinks": "Highlight Links",
  "a11y.largeCursor": "Large Cursor",
  "a11y.readingGuide": "Reading Guide",
  "a11y.focusHighlight": "Focus Highlight",
  "a11y.stopAnimations": "Stop Animations",
  "a11y.textSpacing": "Text Spacing",
  "a11y.readableFont": "Readable Font",
  "a11y.dyslexia": "Dyslexia Friendly",
  "a11y.saturation": "Saturation",
  "a11y.normal": "Normal",
  "a11y.large": "Large",
  "a11y.xLarge": "X-Large",
  "a11y.low": "Low",
  "a11y.grayscale": "Grayscale",
  "a11y.extraLarge": "Extra Large",
  "a11y.default": "Default",
  "a11y.left": "Left",
  "a11y.center": "Center",
  "a11y.right": "Right",
  "a11y.align": "Align",
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    try {
      localStorage.removeItem("site-lang");
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
    document.title = "Shalev Osher";
  }, []);

  const t = (key: string): string => translations[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang: "en", t, dir: "ltr" }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
