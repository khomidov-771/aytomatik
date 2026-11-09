"use client";

import { FormEvent, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, jsonBody } from "@/lib/api";
import type { InstagramAccount } from "@/lib/types";
import { DemoBadge, ErrorState, LoadingState, PageHeader } from "@/components/ui";

export default function MockLabPage() {
  const accounts = useApi<{items: InstagramAccount[]; demo_mode: boolean}>("/instagram/accounts");
  const [commentID, setCommentID] = useState("demo-comment-001");
  const [participantID, setParticipantID] = useState("demo-user-001");
  const [commentText, setCommentText] = useState("Narxi qancha?");
  const [messageText, setMessageText] = useState("Rahmat, yana savolim bor edi");
  const [notice, setNotice] = useState("");

  const account = accounts.data?.items.find((item) => item.status === "connected");

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    try {
      const result = await api<{status: string}>("/webhooks/instagram/mock-event", { method: "POST", ...jsonBody({ account_id: account.instagram_user_id, comment_id: commentID, media_id: "demo-media-001", text: commentText, username: "aziza", participant_id: participantID, provider_event_id: `mock:${commentID}` }) });
      setNotice(`Comment: ${result.status}. Mos qoida bo‘lsa private reply navbatga qo‘yildi; manual reply oynasi hali yopiq.`);
    } catch (requestError) {
      setNotice(requestError instanceof ApiError ? requestError.message : "Mock comment yuborilmadi");
    }
  }

  async function sendInbound(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    const messageID = `demo-mid-${Date.now()}`;
    try {
      const result = await api<{status: string}>("/webhooks/instagram/mock-message", { method: "POST", ...jsonBody({ account_id: account.instagram_user_id, provider_message_id: messageID, participant_id: participantID, username: "aziza", text: messageText }) });
      setNotice(`Inbound xabar: ${result.status}. Endi Inbox’da 24 soatlik manual reply oynasi ochildi.`);
    } catch (requestError) {
      setNotice(requestError instanceof ApiError ? requestError.message : "Mock inbound xabar yuborilmadi");
    }
  }

  if (accounts.loading) return <LoadingState label="Mock laboratoriya yuklanmoqda..."/>;
  if (accounts.error) return <ErrorState message={accounts.error} retry={accounts.reload}/>;

  return <>
    <PageHeader eyebrow="Faqat development" title="Mock laboratoriya" description="Haqiqiy Instagram API’siz comment → private reply → inbound DM → Inbox oqimini tekshiring." action={<DemoBadge show/>}/>
    {notice && <div className="form-alert success">{notice}</div>}
    {!account ? <div className="notice-banner warning">Sinovdan oldin mock Instagram akkauntini ulang.</div> : <div className="dashboard-lower">
      <form className="panel form-section" onSubmit={sendComment}>
        <div className="form-section-title"><span><MessageCircle/></span><div><h2>1. Mock comment</h2><p>Automation matching va private reply’ni ishga tushiradi.</p></div></div>
        <label><span>Comment ID</span><input value={commentID} onChange={(event) => setCommentID(event.target.value)} required/></label>
        <label><span>Participant ID</span><input value={participantID} onChange={(event) => setParticipantID(event.target.value)} required/></label>
        <label><span>Comment matni</span><input value={commentText} onChange={(event) => setCommentText(event.target.value)} required/></label>
        <button className="btn primary"><Send/>Comment yuborish</button>
      </form>
      <form className="panel form-section" onSubmit={sendInbound}>
        <div className="form-section-title"><span><Send/></span><div><h2>2. Mock inbound DM</h2><p>Foydalanuvchidan kelgan xabar reply oynasini ochadi.</p></div></div>
        <label><span>Participant ID</span><input value={participantID} onChange={(event) => setParticipantID(event.target.value)} required/></label>
        <label><span>Xabar matni</span><input value={messageText} onChange={(event) => setMessageText(event.target.value)} required/></label>
        <button className="btn primary"><Send/>Inbound DM yuborish</button>
      </form>
    </div>}
  </>;
}
