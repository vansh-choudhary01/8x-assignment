import type { AiPageContext } from "@naano/shared";

export function askNaano(prompt: string, autoSend = true) {
  window.dispatchEvent(new CustomEvent("naano:ask", { detail: { prompt, autoSend } }));
}

export function openNaano() {
  window.dispatchEvent(new Event("naano:open"));
}

export function pageContextFromPath(pathname: string): AiPageContext {
  const campaign =
    pathname.match(/\/campaigns\/(?!new(?:\/|$))([^/]+)/)?.[1] ||
    pathname.match(/\/opportunities\/([^/]+)/)?.[1];
  const collaboration = pathname.match(/\/collaborations\/([^/]+)/)?.[1];
  const creator = pathname.match(/\/creators\/([^/]+)/)?.[1];
  return {
    path: pathname,
    campaignId: campaign,
    collaborationId: collaboration,
    creatorId: creator,
  };
}
