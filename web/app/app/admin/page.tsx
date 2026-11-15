"use client";

import { useState } from "react";
import { useSession } from "@/components/session-context";
import { usePreferences } from "@/components/preferences-provider";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/use-api";

type Account = {id:string; workspace:string; username:string; status:string; account_type:string; scopes:string[]; token_configured:boolean; token_expires_at?:string};
type Rule = {id:string; workspace:string; account:string; name:string; active:boolean; keywords:string[]; groups:{name:string; keywords:string[]}[]};
type Conversation = {id:string; workspace:string; account:string; participant:string; last_message_at:string};
type Message = {id:string; direction:string; text:string; created_at:string; status:string};
type KeyStatus = {name:string; configured:boolean};
type Kind = "accounts" | "rules" | "conversations" | "keys";

export default function AdminPage() {
 const session=useSession();
 const {tr}=usePreferences();
 const [kind,setKind]=useState<Kind>("accounts");
 const [offset,setOffset]=useState(0);
 const [selected,setSelected]=useState<Conversation|null>(null);
 const [messageOffset,setMessageOffset]=useState(0);
 const list=useApi<{items:(Account|Rule|Conversation|KeyStatus)[]}>(session.user.is_super_admin ? `/admin/overview?kind=${kind}&offset=${offset}` : null);
 const messages=useApi<{items:Message[]}>(session.user.is_super_admin && selected ? `/admin/conversations/${selected.id}/messages?offset=${messageOffset}` : null);
 if(!session.user.is_super_admin) return <ErrorState message={tr("Bu bo‘limga kirish huquqingiz yo‘q.","У вас нет доступа к этому разделу.","You do not have access to this section.")}/>;
 function choose(next:Kind) {setKind(next);setOffset(0);setSelected(null);}
 return <div className="admin-page">
  <PageHeader title={tr("Platforma boshqaruvi","Управление платформой","Platform administration")}/>
  <div className="admin-tabs">
   {(["accounts","rules","conversations","keys"] as Kind[]).map(key=><button key={key} type="button" aria-pressed={kind===key} onClick={()=>choose(key)}>{key==="accounts"?tr("Akkauntlar","Аккаунты","Accounts"):key==="rules"?tr("Qoidalar va kalit so‘zlar","Правила и ключевые слова","Rules and keywords"):key==="conversations"?tr("Suhbatlar","Диалоги","Conversations"):tr("API kalitlari","Ключи API","API keys")}</button>)}
  </div>
  {list.loading && <LoadingState/>}
  {list.error && <ErrorState message={list.error} retry={list.reload}/>}
  {list.data && <section className="admin-list" aria-live="polite">
   {!list.data.items.length && <p>{tr("Ma’lumot topilmadi.","Данных пока нет.","No data found.")}</p>}
   {kind==="accounts" && (list.data.items as Account[]).map(a=><article key={a.id}><div><strong>@{a.username}</strong><small>{a.workspace} · {a.account_type} · {a.status}</small></div><div><span>{tr("Token","Токен","Token")}: {a.token_configured?tr("Saqlangan","Сохранён","Stored"):tr("Yo‘q","Нет","None")}</span><small>{a.scopes?.join(", ") || "—"}</small>{a.token_expires_at && <small>{tr("Muddati","Истекает","Expires")} {new Date(a.token_expires_at).toLocaleDateString()}</small>}</div></article>)}
   {kind==="rules" && (list.data.items as Rule[]).map(rule=><article key={rule.id}><div><strong>{rule.name}</strong><small>{rule.workspace} · @{rule.account} · {rule.active?tr("Faol","Активно","Active"):tr("O‘chiq","Отключено","Disabled")}</small></div><div><span>{rule.keywords?.join(", ") || "—"}</span>{rule.groups?.map(g=><small key={g.name}>{g.name}: {g.keywords?.join(", ")}</small>)}</div></article>)}
   {kind==="keys" && (list.data.items as KeyStatus[]).map(k=><article key={k.name}><strong>{k.name}</strong><span>{k.configured?tr("Sozlangan","Настроен","Configured"):tr("Sozlanmagan","Не настроен","Not configured")}</span></article>)}
   {kind==="conversations" && (list.data.items as Conversation[]).map(c=><button className="admin-conversation" type="button" key={c.id} onClick={()=>{setSelected(c);setMessageOffset(0)}}><strong>@{c.account} → @{c.participant}</strong><small>{c.workspace} · {new Date(c.last_message_at).toLocaleString()}</small></button>)}
   {kind!=="keys" && <div className="admin-pagination"><button type="button" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-100))}>{tr("Oldingi","Назад","Previous")}</button><span>{offset+1}–{offset+list.data.items.length}</span><button type="button" disabled={list.data.items.length<100} onClick={()=>setOffset(offset+100)}>{tr("Keyingi","Далее","Next")}</button></div>}
  </section>}
  {selected && kind==="conversations" && <section className="admin-messages"><h2>@{selected.account} → @{selected.participant}</h2>
   {messages.loading && <LoadingState/>}{messages.error && <ErrorState message={messages.error} retry={messages.reload}/>}
   {messages.data?.items.map(m=><article key={m.id}><small>{m.direction} · {new Date(m.created_at).toLocaleString()} · {m.status}</small><p>{m.text}</p></article>)}
   {messages.data && <div className="admin-pagination"><button type="button" disabled={messageOffset===0} onClick={()=>setMessageOffset(Math.max(0,messageOffset-100))}>{tr("Oldingi","Назад","Previous")}</button><span>{messageOffset+1}–{messageOffset+messages.data.items.length}</span><button type="button" disabled={messages.data.items.length<100} onClick={()=>setMessageOffset(messageOffset+100)}>{tr("Keyingi","Далее","Next")}</button></div>}
  </section>}
 </div>;
}
