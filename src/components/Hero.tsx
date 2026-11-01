import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTypewriter } from "@/hooks/useTypewriter";
import MagneticButton from "./MagneticButton";
import Particles from "./Particles";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t } = useLanguage();
  const [cvOpen, setCvOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/cv/shalev-osher-cv.pdf";
    a.download = "shalev-osher-cv.pdf";
    a.click();
  };

  const roles = [t("hero.role1"), t("hero.role2"), t("hero.role3"), t("hero.role4")];

  const nameText = "Shalev Osher";
  const helloText = "Hello, I'm";

  const helloTypewriter = useTypewriter({
    text: helloText,
    speed: 80,
    delay: 300,
    loop: true,
    pauseDuration: 3000,
  });

  const nameTypewriter = useTypewriter({
    text: nameText,
    speed: 100,
    delay: 800 + helloText.length * 80 + 200,
    loop: true,
    pauseDuration: 3000,
  });

  const roleTypewriter = useTypewriter({
    texts: roles,
    speed: 80,
    delay: 1200,
    pauseDuration: 2500,
  });

  return (
    <section className="min-h-screen pb-40 md:pb-32 flex items-center justify-center relative overflow-hidden noise-texture" aria-label="Hero section">
      <div className="absolute inset-0" style={{ background: 'var(--gradient-radial)' }} />
      <Particles count={28} />

      <div className="container mx-auto px-6 text-center relative z-10">
        <div>
          
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight" id="hero-title">
            <span className="block text-foreground/80 text-3xl md:text-4xl lg:text-5xl font-light mb-2">
              {helloText}
              <span className={`inline-block w-[2px] h-[0.8em] bg-foreground/60 ms-1 align-middle transition-opacity duration-100 ${helloTypewriter.showCursor && !nameTypewriter.displayedText ? 'opacity-100' : 'opacity-0'}`} />
            </span>
            <span className="block text-gradient">
              {nameText}
              <span className={`inline-block w-[3px] h-[0.8em] bg-primary ms-1 align-middle transition-opacity duration-100 ${nameTypewriter.showCursor ? 'opacity-100' : 'opacity-0'}`} />
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10">Technical Support Specialist · Systems &amp; Cloud</p>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <a href="#contact" className="rounded-lg bg-primary text-primary-foreground px-8 py-4 font-semibold hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Get in touch</a>
            <MagneticButton>
              <Button
                variant="heroOutline"
                size="xl"
                onClick={() => setCvOpen(true)}
                className="min-w-[18rem] sm:min-w-[24rem] text-lg"
              >
                {t("hero.viewCV")}
              </Button>
            </MagneticButton>
          </div>
        </div>
      </div>

      <Dialog open={cvOpen} onOpenChange={setCvOpen}>
        <DialogContent className="max-w-sm sm:max-w-2xl w-[88vw] sm:w-[92vw] h-auto sm:h-[75vh] max-h-[78svh] sm:max-h-none p-0 overflow-hidden flex flex-col bg-card border-border/50 [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>{t("hero.cvPreview")}</DialogTitle>
          </VisuallyHidden>
          <div className="flex-1 bg-muted/20 overflow-auto min-h-0">
            {isMobile ? (
              <img
                src="/cv/shalev-osher-cv-preview.webp"
                alt={t("hero.cvPreview")}
                className="w-full max-h-[62svh] object-contain"
                decoding="async"
              />
            ) : (
              <iframe
                src="/cv/shalev-osher-cv.pdf#toolbar=0&navpanes=0&scrollbar=0&view=Fit"
                title="CV Preview"
                className="w-full h-full"
              />
            )}
          </div>
          <div className="px-6 py-3 border-t border-border/50 flex justify-center">
            <Button variant="heroOutline" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="w-4 h-4" />
              {t("hero.downloadPdf")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </section>
  );
};

export default Hero;
