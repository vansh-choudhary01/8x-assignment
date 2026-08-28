import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "@/lib/api";

export function isIngesting(status?: string) {
  return status === "QUEUED" || status === "RUNNING";
}

export function useIngestPolling(ingesting: boolean, reload: () => Promise<unknown>) {
  useEffect(() => {
    if (!ingesting) return;
    const timer = window.setInterval(() => {
      void reload();
    }, 1600);
    return () => window.clearInterval(timer);
  }, [ingesting]);
}

export function useCompleteOnboarding(
  path: string,
  dest: string,
  setError: (message: string | null) => void,
) {
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);

  function complete() {
    setCompleting(true);
    void api(path, { method: "POST" })
      .then(() => navigate(dest))
      .catch((err: unknown) => setError(errorMessage(err, "Could not complete onboarding")))
      .finally(() => setCompleting(false));
  }

  return { completing, complete };
}
