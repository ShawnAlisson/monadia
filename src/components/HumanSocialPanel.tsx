"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { Citizen, MoneyRequest, SocialMessage } from "@/lib/types";

type Tab = "talk" | "send" | "request";

export function HumanSocialPanel({
  peer,
  meId,
  onDone,
}: {
  peer: Citizen;
  meId: string;
  onDone?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("talk");
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    const [msgRes, reqRes] = await Promise.all([
      fetch(`/api/social/messages?wallet=${address}&with=${peer.id}`, { cache: "no-store" }),
      fetch(`/api/social/requests?wallet=${address}`, { cache: "no-store" }),
    ]);
    if (msgRes.ok) {
      const body = (await msgRes.json()) as { messages: SocialMessage[] };
      setMessages(body.messages || []);
    }
    if (reqRes.ok) {
      const body = (await reqRes.json()) as { requests: MoneyRequest[] };
      setRequests(
        (body.requests || []).filter(
          (r) => r.fromId === peer.id || r.toId === peer.id,
        ),
      );
    }
  }, [address, peer.id]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function sendMessage() {
    if (!address || !text.trim()) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/social/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          toCitizenId: peer.id,
          body: text.trim(),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not send");
      setText("");
      setStatus("Message sent");
      await refresh();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMoney() {
    if (!address) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/social/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          toCitizenId: peer.id,
          amount: value,
          note: note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Transfer failed");
      setStatus(`Sent ${value} MON to ${peer.name}`);
      setNote("");
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestMoney() {
    if (!address) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/social/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          toCitizenId: peer.id,
          amount: value,
          note: note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Request failed");
      setStatus(`Requested ${value} MON from ${peer.name}`);
      setNote("");
      await refresh();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveRequest(requestId: string, action: "pay" | "decline" | "cancel") {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/social/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, requestId, action }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not update request");
      setStatus(action === "pay" ? "Paid" : action === "decline" ? "Declined" : "Cancelled");
      await refresh();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected || !address) {
    return <p className="mt-3 text-xs text-slate-500">Connect your wallet to talk or send MON.</p>;
  }

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="mt-3 space-y-2 border-t border-cyan-300/10 pt-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
        Citizen link · {peer.online ? "online now" : "offline · last place"}
      </p>
      <div className="flex gap-1">
        {(["talk", "send", "request"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-lg px-2 py-1 text-[11px] capitalize ${
              tab === t
                ? "bg-cyan-400/15 text-cyan-100"
                : "bg-white/[0.03] text-slate-400 hover:text-cyan-100"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "talk" ? "Talk" : t === "send" ? "Send MON" : "Request"}
          </button>
        ))}
      </div>

      {tab === "talk" && (
        <>
          <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg bg-black/20 p-2">
            {messages.length === 0 && (
              <p className="text-[11px] text-slate-500">No messages yet. Say hello.</p>
            )}
            {messages.map((m) => {
              const mine = m.fromId === meId;
              return (
                <div
                  key={m.id}
                  className={`rounded-md px-2 py-1 text-xs ${
                    mine ? "bg-cyan-400/10 text-cyan-50" : "bg-white/[0.05] text-slate-200"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {mine ? "You" : m.fromName}
                  </span>
                  <p className="mt-0.5 leading-4">{m.body}</p>
                </div>
              );
            })}
          </div>
          <textarea
            className="min-h-[56px] w-full resize-none rounded-lg border border-cyan-400/15 bg-black/20 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/40"
            placeholder={`Message ${peer.name}…`}
            value={text}
            maxLength={400}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="btn-primary w-full !py-2 text-sm"
            disabled={busy || !text.trim()}
            onClick={() => void sendMessage()}
          >
            {busy ? "Sending…" : "Send message"}
          </button>
        </>
      )}

      {tab === "send" && (
        <>
          <p className="text-[11px] text-slate-500">
            Sends world MON from your civilization balance (not a chain tx).
          </p>
          <input
            className="w-full"
            type="number"
            min="0.001"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
          />
          <input
            className="w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            maxLength={120}
          />
          <button
            className="btn-primary w-full !py-2 text-sm"
            disabled={busy}
            onClick={() => void sendMoney()}
          >
            {busy ? "Sending…" : `Send MON to ${peer.name}`}
          </button>
        </>
      )}

      {tab === "request" && (
        <>
          <p className="text-[11px] text-slate-500">
            Ask {peer.name} for world MON. They can pay or decline.
          </p>
          <input
            className="w-full"
            type="number"
            min="0.001"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
          />
          <input
            className="w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What for?"
            maxLength={120}
          />
          <button
            className="btn-primary w-full !py-2 text-sm"
            disabled={busy}
            onClick={() => void requestMoney()}
          >
            {busy ? "Requesting…" : `Request from ${peer.name}`}
          </button>
        </>
      )}

      {pending.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-300/15 bg-amber-400/5 p-2">
          <p className="text-[10px] uppercase tracking-wider text-amber-200/80">Open requests</p>
          {pending.map((r) => {
            const iAmPayer = r.toId === meId;
            const iRequested = r.fromId === meId;
            return (
              <div key={r.id} className="text-xs text-slate-200">
                <p>
                  {r.fromName} → {r.toName}:{" "}
                  <span className="text-amber-100">{r.amount} MON</span>
                  {r.note ? ` · ${r.note}` : ""}
                </p>
                <div className="mt-1 flex gap-1">
                  {iAmPayer && (
                    <>
                      <button
                        className="btn-primary !px-2 !py-1 text-[11px]"
                        disabled={busy}
                        onClick={() => void resolveRequest(r.id, "pay")}
                      >
                        Pay
                      </button>
                      <button
                        className="btn-ghost !px-2 !py-1 text-[11px]"
                        disabled={busy}
                        onClick={() => void resolveRequest(r.id, "decline")}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {iRequested && (
                    <button
                      className="btn-ghost !px-2 !py-1 text-[11px]"
                      disabled={busy}
                      onClick={() => void resolveRequest(r.id, "cancel")}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {status && <p className="text-xs text-emerald-300">{status}</p>}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
