import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type ProgressState = "idle" | "loading" | "completing";

export function NavigationProgress() {
  const isFetching = useIsFetching();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<ProgressState>("idle");
  const prevPathname = useRef(pathname);
  const isFetchingRef = useRef(isFetching);

  isFetchingRef.current = isFetching;

  // Start loading on route change (debounced to avoid flash on cached navigations)
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      const timer = setTimeout(() => {
        if (isFetchingRef.current > 0) {
          setState("loading");
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Also start if fetching begins while idle (e.g. initial page load)
  useEffect(() => {
    if (isFetching > 0 && state === "idle") {
      const timer = setTimeout(() => {
        if (isFetchingRef.current > 0) {
          setState("loading");
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFetching, state]);

  // Complete when fetching finishes
  useEffect(() => {
    if (isFetching === 0 && state === "loading") {
      setState("completing");
      const timer = setTimeout(() => setState("idle"), 300);
      return () => clearTimeout(timer);
    }
  }, [isFetching, state]);

  if (state === "idle") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-60 h-0.5">
      <div
        className={`h-full bg-sf-green ${
          state === "loading"
            ? "animate-progress-loading"
            : "animate-progress-complete"
        }`}
      />
    </div>
  );
}
