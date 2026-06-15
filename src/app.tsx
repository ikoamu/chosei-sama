import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ChatAgent } from "./server";
import {
  Badge,
  Button,
  Empty,
  InputArea,
  Surface,
  Switch,
  Text
} from "@cloudflare/kumo";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  GearIcon,
  ChatCircleDotsIcon,
  CircleIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  BrainIcon,
  CaretDownIcon,
  BugIcon,
  SignInIcon,
  SignOutIcon,
  XIcon,
  UsersIcon,
  MagnifyingGlassIcon
} from "@phosphor-icons/react";
import {
  getGoogleToken,
  searchDirectory,
  type DirectoryPerson
} from "./google-client";
import { useChatSubmit } from "use-chat-submit";

// ── Auth ─────────────────────────────────────────────────────────────

interface AuthUser {
  email: string;
  name: string;
  picture: string;
  clientId: string;
}

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/oauth/me")
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{
              authenticated: boolean;
              email: string;
              name: string;
              picture: string;
              clientId: string;
            }>)
          : null
      )
      .then((data) => {
        if (data?.authenticated) {
          setUser({
            email: data.email,
            name: data.name,
            picture: data.picture,
            clientId: data.clientId
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

function LoginScreen() {
  const error = new URLSearchParams(window.location.search).get("error");

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-kumo-elevated">
      <Surface className="p-8 rounded-2xl ring ring-kumo-line max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-kumo-default">調整さま</h1>
        <Text variant="secondary">
          Google Workspace アカウントでログインしてください
        </Text>
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-xs text-red-500">
              {decodeURIComponent(error)}
            </span>
          </div>
        )}
        <Button
          variant="primary"
          onClick={() => {
            window.location.href = "/oauth/login";
          }}
        >
          <SignInIcon size={16} className="mr-1" />
          Google でログイン
        </Button>
      </Surface>
    </div>
  );
}

// ── Theme ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-mode") === "dark"
  );

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  }, [dark]);

  return (
    <Button
      variant="secondary"
      shape="square"
      icon={dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      onClick={toggle}
      aria-label="Toggle theme"
    />
  );
}

// ── Participant picker (directory autocomplete) ───────────────────────

function ParticipantPicker({
  clientId,
  selfEmail,
  disabled,
  onStart
}: {
  clientId: string;
  selfEmail: string;
  disabled: boolean;
  onStart: (people: DirectoryPerson[]) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [selected, setSelected] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // ログイン時に directory スコープへ同意済みなら、ポップアップ無しでトークンを引き当てる。
  useEffect(() => {
    getGoogleToken(clientId, { silent: true })
      .then(setToken)
      .catch(() => setNeedsConsent(true));
  }, [clientId]);

  // サイレント取得に失敗した場合のみ、操作起点で明示的に取得する。
  const connect = async () => {
    setConnecting(true);
    try {
      setToken(await getGoogleToken(clientId));
      setNeedsConsent(false);
    } catch (e) {
      console.error("Google 接続に失敗:", e);
    } finally {
      setConnecting(false);
    }
  };

  // Debounced directory search (uses the user's own token, direct to Google)
  useEffect(() => {
    const q = query.trim();
    if (!q || !token) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchDirectory(token, q));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) {
      return;
    }
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const addPerson = (p: DirectoryPerson) => {
    if (!selected.some((s) => s.email === p.email)) {
      setSelected((prev) => [...prev, p]);
    }
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const removePerson = (email: string) => {
    setSelected((prev) => prev.filter((s) => s.email !== email));
  };

  const visibleResults = results.filter(
    (p) => p.email !== selfEmail && !selected.some((s) => s.email === p.email)
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-3 text-left">
      <div className="flex items-center gap-2 justify-center">
        <UsersIcon size={16} className="text-kumo-subtle" />
        <Text size="sm" variant="secondary">
          参加者を選んでください
        </Text>
      </div>

      {!token && needsConsent && (
        <div className="flex flex-col items-center gap-2">
          <Text size="xs" variant="secondary">
            同僚検索の利用には Google の追加許可が必要です
          </Text>
          <Button variant="secondary" disabled={connecting} onClick={connect}>
            {connecting ? "許可を確認中…" : "Google で許可する"}
          </Button>
        </div>
      )}

      {!token && !needsConsent && (
        <p className="text-xs text-center text-kumo-subtle">準備中…</p>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {selected.map((p) => (
            <span
              key={p.email}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-kumo-control border border-kumo-line"
            >
              {p.photo ? (
                <img
                  src={p.photo}
                  alt={p.name}
                  className="w-5 h-5 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-kumo-accent/20 flex items-center justify-center text-[10px] text-kumo-accent">
                  {p.name.charAt(0)}
                </span>
              )}
              <span className="text-xs text-kumo-default">{p.name}</span>
              <button
                type="button"
                onClick={() => removePerson(p.email)}
                aria-label={`${p.name} を削除`}
                className="text-kumo-inactive hover:text-kumo-danger"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      {token && (
        <div className="relative" ref={boxRef}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-kumo-line bg-kumo-base focus-within:ring-1 focus-within:ring-kumo-accent">
            <MagnifyingGlassIcon size={16} className="text-kumo-inactive" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              aria-label="同僚を検索"
              placeholder="名前・メールで検索…"
              disabled={disabled}
              className="flex-1 text-sm bg-transparent text-kumo-default placeholder:text-kumo-inactive focus:outline-none"
            />
            {loading && (
              <GearIcon size={14} className="text-kumo-inactive animate-spin" />
            )}
          </div>

          {open && visibleResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50">
              <Surface className="rounded-lg ring ring-kumo-line shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {visibleResults.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => addPerson(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-kumo-control transition-colors"
                  >
                    {p.photo ? (
                      <img
                        src={p.photo}
                        alt={p.name}
                        className="w-7 h-7 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-kumo-accent/20 flex items-center justify-center text-xs text-kumo-accent">
                        {p.name.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm text-kumo-default truncate">
                        {p.name}
                      </span>
                      <span className="block text-xs text-kumo-subtle truncate">
                        {p.email}
                      </span>
                    </span>
                  </button>
                ))}
              </Surface>
            </div>
          )}
        </div>
      )}

      <Button
        variant="primary"
        className="w-full"
        disabled={disabled || selected.length === 0}
        onClick={() => onStart(selected)}
      >
        この参加者で空き時間を探す
      </Button>
    </div>
  );
}

// ── Tool rendering ────────────────────────────────────────────────────

function ToolPartView({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (!isToolUIPart(part)) {
    return null;
  }
  const toolName = getToolName(part);

  // Completed
  if (part.state === "output-available") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2 mb-1">
            <GearIcon size={14} className="text-kumo-inactive" />
            <Text size="xs" variant="secondary" bold>
              {toolName}
            </Text>
            <Badge variant="secondary">Done</Badge>
          </div>
          <div className="font-mono">
            <Text size="xs" variant="secondary">
              {JSON.stringify(part.output, null, 2)}
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    const approvalId = (part.approval as { id?: string })?.id;
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-3 rounded-xl ring-2 ring-kumo-warning">
          <div className="flex items-center gap-2 mb-2">
            <GearIcon size={14} className="text-kumo-warning" />
            <Text size="sm" bold>
              Approval needed: {toolName}
            </Text>
          </div>
          <div className="font-mono mb-3">
            <Text size="xs" variant="secondary">
              {JSON.stringify(part.input, null, 2)}
            </Text>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }
              }}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: false });
                }
              }}
            >
              Reject
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  // Rejected / denied
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2">
            <XCircleIcon size={14} className="text-kumo-danger" />
            <Text size="xs" variant="secondary" bold>
              {toolName}
            </Text>
            <Badge variant="secondary">Rejected</Badge>
          </div>
        </Surface>
      </div>
    );
  }

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-kumo-inactive animate-spin" />
            <Text size="xs" variant="secondary">
              Running {toolName}...
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  return null;
}

// ── Main chat ─────────────────────────────────────────────────────────

function Chat({ user }: { user: AuthUser }) {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toasts = useKumoToastManager();

  const agent = useAgent<ChatAgent>({
    agent: "ChatAgent",
    name: user.email,
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback(
      (error: Event) => console.error("WebSocket error:", error),
      []
    ),
    onMessage: useCallback(
      (message: MessageEvent) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data.type === "scheduled-task") {
            toasts.add({
              title: "Scheduled task completed",
              description: data.description,
              timeout: 0
            });
          }
        } catch {
          // Not JSON or not our event
        }
      },
      [toasts]
    )
  });

  useEffect(() => {
    if (connected) {
      agent.stub.setUserEmail(user.email);
    }
  }, [connected, agent.stub, user.email]);

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    stop,
    status
  } = useAgentChat({
    agent,
    onToolCall: async (event) => {
      if (
        "addToolOutput" in event &&
        event.toolCall.toolName === "getUserTimezone"
      ) {
        event.addToolOutput({
          toolCallId: event.toolCall.toolCallId,
          output: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString()
          }
        });
      }
    }
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Enter=改行 / Cmd・Ctrl+Enter=送信。IME変換中の誤送信も内部で抑止される。
  const { getTextareaProps, triggerSubmit, textareaRef } = useChatSubmit({
    mode: "mod-enter",
    onSubmit: (value) => {
      const text = value.trim();
      if (!text || isStreaming) {
        return;
      }
      setInput("");
      sendMessage({ role: "user", parts: [{ type: "text", text }] });
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming, textareaRef]);

  const startWithParticipants = useCallback(
    (people: DirectoryPerson[]) => {
      const list = people.map((p) => `${p.name} <${p.email}>`).join("、");
      sendMessage({
        role: "user",
        parts: [
          {
            type: "text",
            text: `参加者は ${list} です。全員の空き時間を調整したいので、空いている時間を提案してください。`
          }
        ]
      });
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col h-screen bg-kumo-elevated relative">
      {/* Header */}
      <header className="px-5 py-4 bg-kumo-base border-b border-kumo-line">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-kumo-default">
              調整さま
            </h1>
            <Badge variant="secondary">
              <ChatCircleDotsIcon size={12} weight="bold" className="mr-1" />
              AI Chat
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CircleIcon
                size={8}
                weight="fill"
                className={connected ? "text-kumo-success" : "text-kumo-danger"}
              />
              <Text size="xs" variant="secondary">
                {connected ? "Connected" : "Disconnected"}
              </Text>
            </div>
            <div className="flex items-center gap-1.5">
              <BugIcon size={14} className="text-kumo-inactive" />
              <Switch
                checked={showDebug}
                onCheckedChange={setShowDebug}
                size="sm"
                aria-label="Toggle debug mode"
              />
            </div>
            <ThemeToggle />
            <Button
              variant="secondary"
              icon={<TrashIcon size={16} />}
              onClick={clearHistory}
            >
              Clear
            </Button>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-kumo-line">
              <img
                src={user.picture}
                alt={user.name}
                className="w-6 h-6 rounded-full"
                referrerPolicy="no-referrer"
              />
              <span className="text-xs text-kumo-subtle hidden sm:block">
                {user.name}
              </span>
              <Button
                variant="ghost"
                shape="square"
                icon={<SignOutIcon size={16} />}
                onClick={() => {
                  window.location.href = "/oauth/logout";
                }}
                aria-label="Logout"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
          {messages.length === 0 && (
            <Empty
              icon={<ChatCircleDotsIcon size={32} />}
              title="調整を始める"
              contents={
                <ParticipantPicker
                  clientId={user.clientId}
                  selfEmail={user.email}
                  disabled={!connected || isStreaming}
                  onStart={startWithParticipants}
                />
              }
            />
          )}

          {messages.map((message: UIMessage, index: number) => {
            const isUser = message.role === "user";
            const isLastAssistant =
              message.role === "assistant" && index === messages.length - 1;

            return (
              <div key={message.id} className="space-y-2">
                {showDebug && (
                  <pre className="text-[11px] text-kumo-subtle bg-kumo-control rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(message, null, 2)}
                  </pre>
                )}

                {/* Tool parts */}
                {message.parts.filter(isToolUIPart).map((part) => (
                  <ToolPartView
                    key={part.toolCallId}
                    part={part}
                    addToolApprovalResponse={addToolApprovalResponse}
                  />
                ))}

                {/* Reasoning parts */}
                {message.parts
                  .filter(
                    (part) =>
                      part.type === "reasoning" &&
                      (part as { text?: string }).text?.trim()
                  )
                  .map((part, i) => {
                    const reasoning = part as {
                      type: "reasoning";
                      text: string;
                      state?: "streaming" | "done";
                    };
                    const isDone = reasoning.state === "done" || !isStreaming;
                    return (
                      <div key={i} className="flex justify-start">
                        <details className="max-w-[85%] w-full" open={!isDone}>
                          <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm select-none">
                            <BrainIcon size={14} className="text-purple-400" />
                            <span className="font-medium text-kumo-default">
                              Reasoning
                            </span>
                            {isDone ? (
                              <span className="text-xs text-kumo-success">
                                Complete
                              </span>
                            ) : (
                              <span className="text-xs text-kumo-brand">
                                Thinking...
                              </span>
                            )}
                            <CaretDownIcon
                              size={14}
                              className="ml-auto text-kumo-inactive"
                            />
                          </summary>
                          <pre className="mt-2 px-3 py-2 rounded-lg bg-kumo-control text-xs text-kumo-default whitespace-pre-wrap overflow-auto max-h-64">
                            {reasoning.text}
                          </pre>
                        </details>
                      </div>
                    );
                  })}

                {/* Text parts */}
                {message.parts
                  .filter((part) => part.type === "text")
                  .map((part, i) => {
                    const text = (part as { type: "text"; text: string }).text;
                    if (!text) {
                      return null;
                    }

                    if (isUser) {
                      return (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-kumo-contrast text-kumo-inverse leading-relaxed">
                            {text}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={i} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-kumo-base text-kumo-default leading-relaxed">
                          <Streamdown
                            className="sd-theme rounded-2xl rounded-bl-md p-3"
                            plugins={{ code }}
                            controls={false}
                            isAnimating={isLastAssistant && isStreaming}
                          >
                            {text}
                          </Streamdown>
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-kumo-line bg-kumo-base">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            triggerSubmit();
          }}
          className="max-w-3xl mx-auto px-5 py-4"
        >
          <div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm focus-within:ring-2 focus-within:ring-kumo-ring focus-within:border-transparent transition-shadow">
            <InputArea
              {...getTextareaProps({
                value: input,
                onChange: (e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              })}
              placeholder="メッセージを入力…（Enterで改行／⌘・Ctrl+Enterで送信）"
              disabled={!connected || isStreaming}
              rows={1}
              className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40"
            />
            {isStreaming ? (
              <Button
                type="button"
                variant="secondary"
                shape="square"
                aria-label="Stop generation"
                icon={<StopIcon size={18} />}
                onClick={stop}
                className="mb-0.5"
              />
            ) : (
              <Button
                type="submit"
                variant="primary"
                shape="square"
                aria-label="Send message"
                disabled={!input.trim() || !connected}
                icon={<PaperPlaneRightIcon size={18} />}
                className="mb-0.5"
              />
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-kumo-inactive">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <Toasty>
        <LoginScreen />
      </Toasty>
    );
  }

  return (
    <Toasty>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen text-kumo-inactive">
            Loading...
          </div>
        }
      >
        <Chat user={user} />
      </Suspense>
    </Toasty>
  );
}
