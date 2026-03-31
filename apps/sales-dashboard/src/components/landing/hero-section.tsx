"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AnimatedSphere } from "./animated-sphere";

const words = ["earn", "sell", "pitch", "grow", "close"];

export function HeroSection() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Subtle grid lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-foreground/10"
            style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-foreground/10"
            style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
          />
        ))}
      </div>

      {/* Two-column hero layout */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 pt-32 lg:pt-40 pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-0">

          {/* Left: text content */}
          <div className="flex-1 lg:pr-8">
            {/* Eyebrow */}
            <div className="mb-8">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
                <span className="w-8 h-px bg-foreground/30" />
                The platform for salespeople
              </span>
            </div>

            {/* Main headline */}
            <div className="mb-10">
              <h1 className="text-[clamp(3rem,8vw,7rem)] font-display leading-[0.9] tracking-tight">
                <span className="block">The platform</span>
                <span className="block">
                  to{" "}
                  <span className="relative inline-block">
                    <span key={wordIndex} className="inline-flex">
                      {words[wordIndex].split("").map((char, i) => (
                        <span
                          key={`${wordIndex}-${i}`}
                          className="inline-block animate-char-in"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                    <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
                  </span>
                </span>
              </h1>
            </div>

            {/* Description */}
            <p className="text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-lg mb-10">
              Your toolkit to walk into any local business, show them their
              new AI-generated website, and close the deal. No experience needed, no targets, no shifts.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <a href="/signup">
                <Button
                  size="lg"
                  className="bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full group"
                >
                  Start earning today
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5"
                >
                  Sign in to dashboard
                </Button>
              </a>
            </div>
          </div>

          {/* Right: globe */}
          <div className="flex-shrink-0 hidden lg:block">
            <AnimatedSphere />
          </div>
        </div>
      </div>

      {/* Stats marquee */}
      <div className="absolute bottom-0 left-0 right-0 py-8 border-t border-foreground/5 z-20 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                { value: "£50", label: "per confirmed sale", company: "SALESFLOW" },
                { value: "7 days", label: "average payout", company: "WEEKLY" },
                { value: "2 min", label: "signup time", company: "FAST" },
                { value: "£800", label: "top earner last month", company: "RESULTS" },
              ].map((stat) => (
                <div key={`${stat.company}-${i}`} className="flex items-baseline gap-4">
                  <span className="text-4xl lg:text-5xl font-display">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                    <span className="block font-mono text-xs mt-1">{stat.company}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
