"use client";

import { useState } from "react";
import { ChevronDown, Layers3, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { newGroup, splitVariants, type Translate } from "@/lib/keyword-groups";
import type { KeywordGroup, KeywordVariant, ReplyTemplate } from "@/lib/types";
import { usePreferences } from "./preferences-provider";

type EditorProps = {
  groups: KeywordGroup[];
  onChange: (groups: KeywordGroup[]) => void;
  combine: boolean;
  onCombine: (value: boolean) => void;
  section: "keywords" | "replies" | "all";
  initial: { keywords: string[]; dm: string; publicReply: string };
};

function VariantField({ group, kind, label, onChange }: {
  group: KeywordGroup; kind: KeywordVariant["kind"]; label: string; onChange: (variants: KeywordVariant[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = group.variants.filter(v => v.kind === kind).map(v => v.text).join(", ");
  return <label className="kg-field"><span>{label}</span>
    <input value={draft ?? value} onChange={event => {
      setDraft(event.target.value);
      onChange(splitVariants(event.target.value, kind, group));
    }} onBlur={() => setDraft(null)} placeholder={kind === "primary" ? "narx, katalog" : kind === "synonym" ? "qancha, цена" : "nrax"}/>
  </label>;
}

function TemplateList({ list, setList, direct, variables, tr }: {
  list: ReplyTemplate[]; setList: (list: ReplyTemplate[]) => void; direct: boolean; variables: Record<string,string>; tr: Translate;
}) {
  const title = direct ? tr("Direct xabarlari", "Сообщения Direct", "Direct replies") : tr("Izohga javoblar", "Ответы под комментарием", "Public replies");
  return <section className="kg-templates"><h4>{direct ? <Send/> : <MessageSquare/>}{title}</h4>
    {list.map((t, i) => <div className="kg-template" key={t.id}>
      <textarea rows={2} maxLength={1000} value={t.text} aria-label={title + " " + (i + 1)} onChange={e => setList(list.map(v => v.id === t.id ? {...v,text:e.target.value} : v))}/>
      <div className="kg-template-tools"><label className="kg-check"><input type="checkbox" checked={t.enabled} onChange={e => setList(list.map(v => v.id === t.id ? {...v,enabled:e.target.checked} : v))}/>{tr("Faol", "Включён", "Enabled")}</label>
        <button type="button" className="kg-icon" aria-label={tr("Javobni olib tashlash", "Удалить ответ", "Remove reply") + " " + (i + 1)} onClick={() => setList(list.filter(v => v.id !== t.id))}><Trash2/></button></div>
      {t.text.trim() && <details className="kg-preview"><summary>{tr("Xabarni ko‘rish", "Предпросмотр", "Preview message")}</summary><p>{t.text.replace(/\{\{\s*([A-Za-z][\w]*)\s*\}\}/g, (token, k: string) => variables[k] ?? token)}</p></details>}
    </div>)}
    <button type="button" className="kg-add" onClick={() => setList([...list, {id:crypto.randomUUID(), text:"", enabled:true}])}><Plus/>{tr("Javob qo‘shish", "Добавить ответ", "Add reply")}</button>
  </section>;
}

function GroupFields({ group, section, update, remove, tr }: {group: KeywordGroup;section: EditorProps["section"];update:(g:KeywordGroup)=>void;remove:()=>void;tr:Translate}) {
  const g=group;
  const [variableDraft, setVariableDraft] = useState<string | null>(null);
  return <details className="kg-group" open>
    <summary><Layers3/><strong>{g.name || tr("Yangi guruh","Новая группа","New group")}</strong><ChevronDown/></summary>
    <div className="kg-content">
      {section !== "replies" && <>
        <div className="kg-pair"><label className="kg-field"><span>{tr("Guruh nomi","Название группы","Group name")}</span><input value={g.name} maxLength={80} onChange={e=>update({...g,name:e.target.value})}/></label>
          <label className="kg-field"><span>{tr("Ustuvorlik · 1 eng yuqori","Приоритет · 1 наивысший","Priority · 1 is highest")}</span><input type="number" min={1} max={1000} value={g.priority} onChange={e=>update({...g,priority:Number(e.target.value)})}/></label></div>
        <VariantField group={g} kind="primary" label={tr("Asosiy so‘zlar","Основные слова","Primary keywords")} onChange={variants=>update({...g,variants})}/>
        <div className="kg-pair"><VariantField group={g} kind="synonym" label={tr("Sinonimlar","Синонимы","Synonyms")} onChange={variants=>update({...g,variants})}/>
          <VariantField group={g} kind="typo" label={tr("Imlo variantlari","Варианты написания","Spelling variants")} onChange={variants=>update({...g,variants})}/></div>
        <div className="kg-options"><label className="kg-check"><input type="checkbox" checked={g.enabled} onChange={e=>update({...g,enabled:e.target.checked})}/>{tr("Guruh faol","Группа включена","Group enabled")}</label>
          <label className="kg-check"><input type="checkbox" checked={g.fuzzy_enabled} onChange={e=>update({...g,fuzzy_enabled:e.target.checked})}/>{tr("Imlo xatolarini aniqlash","Учитывать опечатки","Allow typos")}</label>
          {g.fuzzy_enabled && <label className="kg-field kg-distance"><span>{tr("Maksimal xato", "Макс. ошибок", "Max edits")}</span><input type="number" min={1} max={2} value={g.fuzzy_max_distance} onChange={e=>update({...g,fuzzy_max_distance:Number(e.target.value)})}/></label>}
          <button className="kg-icon" type="button" aria-label={tr("Guruhni olib tashlash","Удалить группу","Remove group")} onClick={remove}><Trash2/></button></div>
      </>}
      {section !== "keywords" && <>
        <div className="kg-pair"><TemplateList list={g.dm_templates} setList={dm_templates=>update({...g,dm_templates})} direct variables={g.variables} tr={tr}/>
          <TemplateList list={g.public_templates} setList={public_templates=>update({...g,public_templates})} direct={false} variables={g.variables} tr={tr}/></div>
        {[...g.dm_templates,...g.public_templates].some(t=>t.text.includes("{{")) && <label className="kg-field"><span>{tr("Shablondagi qiymatlar · har qatorga nom=qiymat","Переменные · имя=значение на каждой строке","Template values · one name=value per line")}</span>
          <textarea rows={2} placeholder="price=120 000" value={variableDraft ?? Object.entries(g.variables).map(([k,v])=>k+"="+v).join("\n")} onChange={e=>{
            setVariableDraft(e.target.value);
            const entries=e.target.value.split("\n").filter(l=>l.indexOf("=")>0).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim()]);
            update({...g,variables:Object.fromEntries(entries)});
          }} onBlur={()=>setVariableDraft(null)}/></label>}
      </>}
    </div>
  </details>;
}

export function KeywordGroupsEditor({ groups, onChange, combine, onCombine, section, initial }: EditorProps) {
  const { tr } = usePreferences();
  if (!groups.length && section === "replies") return null;
  return <div className="kg-editor">
    {groups.map(g => <GroupFields key={g.id} group={g} section={section} update={next=>onChange(groups.map(x=>x.id===g.id ? next : x))}
      remove={()=>onChange(groups.filter(x=>x.id!==g.id))} tr={tr}/>)}
    {section !== "replies" && <button type="button" className="kg-add" onClick={() => {
      const name = tr("Guruh","Группа","Group")+" "+(groups.length+1);
      onChange([...groups, newGroup(name, Math.min(1000,(groups.length+1)*10),groups.length?[]:initial.keywords,groups.length?"":initial.dm,groups.length?"":initial.publicReply)]);
    }}><Plus/>{groups.length ? tr("Guruh qo‘shish","Добавить группу","Add group") : tr("So‘zlarni guruhlarga ajratish","Сгруппировать ключевые слова","Use keyword groups")}</button>}
    {groups.length>1 && section !== "replies" && <label className="kg-check"><input type="checkbox" checked={combine} onChange={e=>onCombine(e.target.checked)}/>{tr("Mos guruhlar javobini bitta Direct’da birlashtirish","Объединять ответы совпавших групп в одном Direct","Combine matching group replies in one DM")}</label>}
  </div>;
}
