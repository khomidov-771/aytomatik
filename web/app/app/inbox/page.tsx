"use client";

import { Clock3, Lock, MessageSquareText, Search, Send, UserRound } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { DemoBadge, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";

type InboxFilter = "all" | "unread";

export default function InboxPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [listPath, setListPath] = useState("/inbox/conversations");
  const conversations = useApi<{items: Conversation[]; demo_mode: boolean}>(listPath);
  const allItems = conversations.data?.items ?? [];
  const items = filter === "unread" ? allItems.filter((item) => item.unread_count > 0) : allItems;
  const selectedID = items.some((item) => item.id === selected) ? selected : (items[0]?.id ?? "");
  const messages = useApi<{items: Message[]; demo_mode: boolean}>(selectedID ? `/inbox/conversations/${selectedID}/messages` : null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const pendingRequestID = useRef("");

  function search(event: FormEvent) {
    event.preventDefault();
    setListPath(`/inbox/conversations?q=${encodeURIComponent(query)}`);
  }

  function updateText(value: string) {
    setText(value);
    pendingRequestID.current = "";
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedID || !text.trim()) return;
    setSending(true);
    setNotice("");
    pendingRequestID.current ||= crypto.randomUUID();
    try {
      await api(`/inbox/conversations/${selectedID}/messages`, {
        method: "POST",
        ...jsonBody({ text, client_request_id: pendingRequestID.current }),
      });
      pendingRequestID.current = "";
      setText("");
      await messages.reload();
      await conversations.reload();
    } catch (error) {
      // A structured HTTP response is definitive. A network error is
      // ambiguous, so retain the request id for a safe retry.
      if (error instanceof ApiError) pendingRequestID.current = "";
      setNotice(error instanceof ApiError ? error.message : "Aloqa uzildi. Qayta urinish ayni xabarni takror yubormaydi.");
    } finally {
      setSending(false);
    }
  }

  if (conversations.loading) return <LoadingState label="Inbox yuklanmoqda..."/>;
  if (conversations.error) return <ErrorState message={conversations.error} retry={conversations.reload}/>;
  const current = items.find((item) => item.id === selectedID);
  const canReply = current?.can_reply_until && new Date(current.can_reply_until) > new Date();

  return <>
    <PageHeader eyebrow="Direct" title="Inbox" description="API orqali mavjud bo‘lgan suhbatlar va comment konteksti." action={<DemoBadge show={conversations.data?.demo_mode}/>}/>
    <div className="inbox-layout">
      <aside className="conversation-panel">
        <form className="search-box" onSubmit={search}><Search/><input maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suhbat qidirish..."/><button className="sr-only">Qidirish</button></form>
        <div className="inbox-tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Barchasi</button>
          <button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Yangi</button>
          <button disabled title="Segmentlash keyingi relizda">Mijozlar</button>
        </div>
        {items.length === 0 ? <EmptyState title="Suhbatlar yo‘q" text={filter === "unread" ? "O‘qilmagan suhbat mavjud emas." : "Mos kelgan mock webhook eventidan keyin suhbat shu yerda paydo bo‘ladi."}/> : <div className="conversation-list">{items.map((item) => <button key={item.id} className={selectedID === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span className="contact-avatar">{item.participant_username.slice(0, 2).toUpperCase()}</span><span><strong>@{item.participant_username}</strong><small>{item.last_message}</small></span><span className="conversation-meta"><time>{timeAgo(item.last_message_at)}</time>{item.unread_count > 0 && <b>{item.unread_count}</b>}</span></button>)}</div>}
      </aside>
      <section className="thread-panel">
        {!current ? <EmptyState title="Suhbatni tanlang" text="Xabarlarni ko‘rish uchun chap tomondan suhbatni tanlang."/> : <>
          <header className="thread-header"><span className="contact-avatar large"><UserRound/></span><div><strong>@{current.participant_username}</strong><small>@{current.account_username} orqali · {current.status}</small></div><span className={`reply-window ${canReply ? "open" : "closed"}`}>{canReply ? <><Clock3/> Reply mumkin</> : <><Lock/> Oyna yopiq</>}</span></header>
          <div className="comment-context"><MessageSquareText/><div><small>Commentdan boshlangan suhbat</small><p>Private reply Meta policy bo‘yicha bir marta yuborilgan.</p></div></div>
          <div className="message-thread">{messages.loading ? <LoadingState/> : messages.error ? <ErrorState message={messages.error} retry={messages.reload}/> : messages.data?.items.length ? messages.data.items.map((message) => <div className={`message ${message.direction}`} key={message.id}><div>{message.text}{message.is_demo && <small>Demo</small>}</div><time>{timeAgo(message.created_at)} · {message.status}</time></div>) : <EmptyState title="Xabarlar yo‘q" text="Bu suhbatda saqlangan xabar mavjud emas."/>}</div>
          {notice && <div className="composer-notice">{notice}</div>}
          <form className="message-composer" onSubmit={send}><input maxLength={1000} value={text} onChange={(event) => updateText(event.target.value)} disabled={!canReply || sending} placeholder={canReply ? "Xabar yozing..." : "Messaging oynasi yopilgan"}/><button className="btn primary icon-only" disabled={!canReply || sending || !text.trim()} aria-label="Yuborish"><Send/></button></form>
        </>}
      </section>
    </div>
  </>;
}
