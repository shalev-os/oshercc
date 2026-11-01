import { useEffect, useState, useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  User,
  Wrench,
  Briefcase,
  GraduationCap,
  Mail,
  Github,
  Linkedin,
  Download,
  Home,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for custom event so other components (e.g. floating button) can open
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener("open-command-palette", open);
    return () => window.removeEventListener("open-command-palette", open);
  }, []);

  const go = useCallback((id: string) => {
    setOpen(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const external = useCallback((url: string) => {
    setOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const navigate = useCallback((url: string) => {
    setOpen(false);
    window.location.href = url;
  }, []);

  const downloadCV = useCallback(() => {
    setOpen(false);
    const a = document.createElement("a");
    a.href = "/cv/shalev-osher-cv.pdf";
    a.download = "shalev-osher-cv.pdf";
    a.click();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search actions or sections..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("hero")}>
            <Home className="me-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => go("about")}>
            <User className="me-2 h-4 w-4" />
            <span>{t("nav.about")}</span>
          </CommandItem>
          <CommandItem onSelect={() => go("skills")}>
            <Wrench className="me-2 h-4 w-4" />
            <span>{t("nav.skills")}</span>
          </CommandItem>
          <CommandItem onSelect={() => go("experience")}>
            <Briefcase className="me-2 h-4 w-4" />
            <span>{t("nav.experience")}</span>
          </CommandItem>
          <CommandItem onSelect={() => go("education")}>
            <GraduationCap className="me-2 h-4 w-4" />
            <span>{t("nav.certifications")}</span>
          </CommandItem>
          <CommandItem onSelect={() => go("contact")}>
            <Mail className="me-2 h-4 w-4" />
            <span>{t("nav.contact")}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={downloadCV}>
            <Download className="me-2 h-4 w-4" />
            <span>{t("hero.downloadCV")}</span>
            <CommandShortcut>PDF</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="External Links">
          <CommandItem onSelect={() => external("https://github.com/shalev-os")}>
            <Github className="me-2 h-4 w-4" />
            <span>GitHub</span>
          </CommandItem>
          <CommandItem onSelect={() => external("https://linkedin.com/in/shalev-osher/")}>
            <Linkedin className="me-2 h-4 w-4" />
            <span>LinkedIn</span>
          </CommandItem>
          <CommandItem onSelect={() => external("mailto:shalev@osher.cc")}>
            <Mail className="me-2 h-4 w-4" />
            <span>shalev@osher.cc</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Easter Eggs 🥚">
          <CommandItem onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("trigger-snake")); }}>
            <Sparkles className="me-2 h-4 w-4" />
            <span>Play Snake 🐍</span>
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("trigger-matrix")); }}>
            <Sparkles className="me-2 h-4 w-4" />
            <span>Golden Matrix Rain</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
