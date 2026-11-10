"use client";

import { useEffect } from "react";

export function MotionReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];

    function reveal(target: HTMLElement) {
      target.classList.add("is-visible");
      const delay = Number.parseFloat(window.getComputedStyle(target).transitionDelay) * 1000 || 0;
      timers.push(window.setTimeout(() => { target.style.transitionDelay = "0ms"; }, delay + 760));
    }

    root.classList.add("motion-ready");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(reveal);
      return () => {
        timers.forEach(window.clearTimeout);
        root.classList.remove("motion-ready");
      };
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.12 });

    targets.forEach((target) => observer.observe(target));
    return () => {
      timers.forEach(window.clearTimeout);
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);

  return null;
}
