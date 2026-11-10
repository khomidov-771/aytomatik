"use client";

import { Clock3, Lock, MessageSquareText, Search, Send, UserRound } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";
import { usePreferences } from "@/components/preferences-provider";

type InboxFilter = "all" | "unread";

export default function InboxPage() {
  const { tr } = usePreferences();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [listPath, setListPath] = useState("/inbox/conversations");
  const conversations = useApi<{items: Conversation[]}>(listPath);
  const allItems = conversations.data?.items ?? [];
  const items = filter === "unread" ? allItems.filter((item) => item.unread_count > 0) : allItems;
  const selectedID = items.some((item) => item.id === selected) ? selected : (items[0]?.id ?? "");
  const messages = useApi<{items: Message[]}>(selectedID ? `/inbox/conversations/${selectedID}/messages` : null);
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
      setNotice(error instanceof ApiError ? error.message : tr("Aloqa uzildi. Qayta urinish ayni xabarni takror yubormaydi.", "Соединение прервано. Повторная попытка не продублирует сообщение.", "Connection lost. Retrying will not duplicate the message."));
    } finally {
      setSending(false);
    }
  }

  if (conversations.loading) return <LoadingState label={tr("Inbox yuklanmoqda...", "Inbox загружается...", "Loading inbox...")}/>;
  if (conversations.error) return <ErrorState message={conversations.error} retry={conversations.reload}/>;
  const current = items.find((item) => item.id === selectedID);
  const canReply = current?.can_reply_until && new Date(current.can_reply_until) > new Date();

  return <>
    <PageHeader eyebrow="Direct" title="Inbox" description={tr("Meta API orqali mavjud bo‘lgan suhbatlar va comment konteksti.", "Диалоги и контекст комментариев, доступные через Meta API.", "Conversations and comment context available through the Meta API.")}/>
    <div className="inbox-layout">
      <aside className="conversation-panel">
        <form className="search-box" onSubmit={search}><Search/><input maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Suhbat qidirish...", "Поиск диалога...", "Search conversations...")}/><button className="sr-only">{tr("Qidirish", "Поиск", "Search")}</button></form>
        <div className="inbox-tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{tr("Barchasi", "Все", "All")}</button>
          <button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>{tr("Yangi", "Новые", "Unread")}</button>
          <button disabled title={tr("Segmentlash keyingi relizda", "Сегментация появится в следующем релизе", "Segmentation is planned for a later release")}>{tr("Mijozlar", "Клиенты", "Customers")}</button>
        </div>
        {items.length === 0 ? <EmptyState title={tr("Suhbatlar yo‘q", "Диалогов нет", "No conversations")} text={filter === "unread" ? tr("O‘qilmagan suhbat mavjud emas.", "Нет непрочитанных диалогов.", "There are no unread conversations.") : tr("Meta webhook orqali kelgan suhbatlar shu yerda paydo bo‘ladi.", "Диалоги из Meta webhook появятся здесь.", "Conversations received through Meta webhooks will appear here.")}/> : <div className="conversation-list">{items.map((item) => <button key={item.id} className={selectedID === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span className="contact-avatar">{item.participant_username.slice(0, 2).toUpperCase()}</span><span><strong>@{item.participant_username}</strong><small>{item.last_message}</small></span><span className="conversation-meta"><time>{timeAgo(item.last_message_at)}</time>{item.unread_count > 0 && <b>{item.unread_count}</b>}</span></button>)}</div>}
      </aside>
      <section className="thread-panel">
        {!current ? <EmptyState title={tr("Suhbatni tanlang", "Выберите диалог", "Select a conversation")} text={tr("Xabarlarni ko‘rish uchun chap tomondan suhbatni tanlang.", "Выберите диалог слева, чтобы увидеть сообщения.", "Choose a conversation on the left to view messages.")}/> : <>
          <header className="thread-header"><span className="contact-avatar large"><UserRound/></span><div><strong>@{current.participant_username}</strong><small>{tr("orqali", "через", "via")} @{current.account_username} · {current.status}</small></div><span className={`reply-window ${canReply ? "open" : "closed"}`}>{canReply ? <><Clock3/> {tr("Javob berish mumkin", "Можно ответить", "Reply available")}</> : <><Lock/> {tr("Oyna yopiq", "Окно закрыто", "Window closed")}</>}</span></header>
          <div className="comment-context"><MessageSquareText/><div><small>{tr("Commentdan boshlangan suhbat", "Диалог начат из комментария", "Conversation started from a comment")}</small><p>{tr("Private reply Meta siyosati bo‘yicha bir marta yuboriladi.", "Private reply отправляется один раз согласно политике Meta.", "A private reply is sent once under Meta policy.")}</p></div></div>
          <div className="message-thread">{messages.loading ? <LoadingState/> : messages.error ? <ErrorState message={messages.error} retry={messages.reload}/> : messages.data?.items.length ? messages.data.items.map((message) => <div className={`message ${message.direction}`} key={message.id}><div>{message.text}</div><time>{timeAgo(message.created_at)} · {message.status}</time></div>) : <EmptyState title={tr("Xabarlar yo‘q", "Сообщений нет", "No messages")} text={tr("Bu suhbatda saqlangan xabar mavjud emas.", "В этом диалоге нет сохранённых сообщений.", "There are no stored messages in this conversation.")}/>}</div>
          {notice && <div className="composer-notice">{notice}</div>}
          <form className="message-composer" onSubmit={send}><input maxLength={1000} value={text} onChange={(event) => updateText(event.target.value)} disabled={!canReply || sending} placeholder={canReply ? tr("Xabar yozing...", "Напишите сообщение...", "Write a message...") : tr("Messaging oynasi yopilgan", "Окно сообщений закрыто", "Messaging window is closed")}/><button className="btn primary icon-only" disabled={!canReply || sending || !text.trim()} aria-label={tr("Yuborish", "Отправить", "Send")}><Send/></button></form>
        </>}
      </section>
    </div>
  </>;
}
