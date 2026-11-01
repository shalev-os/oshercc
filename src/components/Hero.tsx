import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Particles from "./Particles";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t } = useLanguage();
  const [cvOpen, setCvOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const cvButtonRef = useRef<HTMLButtonElement>(null);

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

  const nameText = "Shalev Osher";
  const helloText = "Hello, I'm";

  return (
    <section className="min-h-svh py-28 flex items-center justify-center relative overflow-hidden noise-texture" aria-label="Hero section">
      <div className="absolute inset-0" style={{ background: 'var(--gradient-radial)' }} />
      <Particles count={28} />

      <div className="container mx-auto px-6 text-center relative z-10">
        <div>
          
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight" id="hero-title">
            <span className="block text-foreground/80 text-3xl md:text-4xl lg:text-5xl font-light mb-2">
              {helloText}
            </span>
            <span className="block text-gradient">
              {nameText}
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10">Technical Support Specialist · Systems &amp; Cloud</p>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-center max-w-sm sm:max-w-none mx-auto">
            <a href="#contact" className="inline-flex h-14 items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 font-semibold hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Get in touch</a>
              <Button
                ref={cvButtonRef}
                variant="heroOutline"
                size="xl"
                onClick={() => setCvOpen(true)}
                className="w-full sm:w-auto text-lg"
              >
                {t("hero.viewCV")}
              </Button>
          </div>
        </div>
      </div>

      <Dialog open={cvOpen} onOpenChange={setCvOpen}>
        <DialogContent
          className="max-w-sm sm:max-w-2xl w-[92vw] h-auto sm:h-[80svh] max-h-[90svh] p-0 gap-0 overflow-hidden flex flex-col bg-card border-border/50 [&>button]:w-10 [&>button]:h-10 [&>button]:top-2 [&>button]:right-2 [&>button]:inline-flex [&>button]:items-center [&>button]:justify-center"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            cvButtonRef.current?.focus();
          }}
        >
          <div className="px-5 py-4 pe-16 border-b border-border/50 shrink-0">
            <DialogTitle>{t("hero.cvPreview")}</DialogTitle>
          </div>
          <VisuallyHidden>
            <DialogDescription>Preview the CV or download a PDF copy.</DialogDescription>
          </VisuallyHidden>
          <div className="flex-1 bg-muted/20 overflow-auto min-h-0">
            {isMobile ? (
              <img
                src="/cv/shalev-osher-cv-preview.webp"
                alt={t("hero.cvPreview")}
                className="w-full max-h-[58svh] object-contain"
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
          <div className="px-4 py-3 border-t border-border/50 flex flex-wrap justify-center gap-3 shrink-0">
            <Button variant="heroOutline" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="w-4 h-4" />
              {t("hero.downloadPdf")}
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

    </section>
  );
};

export default Hero;
