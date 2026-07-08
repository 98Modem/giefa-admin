"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  MinusIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type AssistantDestination = {
  title: string;
  group: string;
  href: string;
  keywords: string;
};

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  links?: Array<{
    title: string;
    href: string;
    reason: string;
  }>;
};

type GiefaAssistantProps = {
  destinations: AssistantDestination[];
};

const starterPrompts = [
  "What is my current role?",
  "Explain my contribution status",
  "Where do I change roles?",
  "Summarize the latest report",
];

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function GiefaAssistant({ destinations }: GiefaAssistantProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Hi, I am Ask GIEFA. Tell me what you are trying to do in normal words, even as a long paragraph. I can explain your status, find the right page, summarize finance work, or help draft report wording.",
    },
  ]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const quickLinks = useMemo(() => destinations.slice(0, 4), [destinations]);
  const hasConversationStarted = messages.some((message) => message.role === "user");

  async function askAssistant(nextQuestion?: string) {
    const prompt = (nextQuestion ?? question).trim();
    if (!prompt || loading) return;

    setQuestion("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: uniqueId(), role: "user", text: prompt },
    ]);

    try {
      const response = await fetch("/api/giefa-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          currentPath: window.location.pathname,
          history: messages
            .filter((message) => message.id !== "welcome")
            .slice(-8)
            .map((message) => ({
              role: message.role,
              text: message.text,
            })),
        }),
      });
      const result = await response.json();

      setMessages((current) => [
        ...current,
        {
          id: uniqueId(),
          role: "assistant",
          text:
            result?.answer ||
            "I could not prepare a full answer, but I can still help you find the right page.",
          links: Array.isArray(result?.links) ? result.links : [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: uniqueId(),
          role: "assistant",
          text:
            "I could not reach the assistant service. Try again, or use the search bar to go directly to a page.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAssistant();
  }

  function openLink(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70]" ref={panelRef}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex h-16 items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-4 text-left shadow-2xl ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-brand-500/20 dark:ring-white/10"
          aria-expanded={open}
          aria-label="Open Ask GIEFA"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition group-hover:scale-105">
            <ChatBubbleLeftRightIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-bold text-gray-900 dark:text-white">
              Ask GIEFA
            </span>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-300">
              Chat with the dashboard
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="flex h-[min(680px,calc(100vh-2rem))] w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
                <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  GIEFA Assistant
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-300">
                  Navigation, live finance summaries, report wording, and member support.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Minimize GIEFA Assistant"
              >
                <MinusIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close GIEFA Assistant"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-8 bg-brand-500 text-white"
                    : "mr-8 border border-[var(--app-border)] bg-[var(--app-surface)] text-gray-800 dark:text-gray-100"
                }`}
              >
                <p className="whitespace-pre-line">{message.text}</p>
                {message.links && message.links.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.links.map((link) => (
                      <button
                        key={`${message.id}-${link.href}`}
                        type="button"
                        onClick={() => openLink(link.href)}
                        className="block w-full rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-left text-xs text-brand-900 transition hover:bg-brand-100 dark:border-brand-300/20 dark:bg-brand-500/10 dark:text-brand-100 dark:hover:bg-brand-500/20"
                      >
                        <span className="block font-semibold">{link.title}</span>
                        <span className="mt-0.5 block text-brand-700 dark:text-brand-200">
                          {link.reason}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="mr-8 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
                Checking your GIEFA context...
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-gray-800 dark:bg-white/5">
            {!hasConversationStarted && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void askAssistant(prompt)}
                    className="shrink-0 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-brand-50 hover:text-brand-700 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {!hasConversationStarted && quickLinks.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {quickLinks.map((link) => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => openLink(link.href)}
                    className="truncate rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-gray-600 shadow-sm transition hover:text-brand-700 dark:bg-white/10 dark:text-gray-200 dark:hover:text-white"
                  >
                    {link.title}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={submitQuestion} className="flex gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Paste a paragraph or ask anything about GIEFA..."
                className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Ask assistant"
              >
                <PaperAirplaneIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

