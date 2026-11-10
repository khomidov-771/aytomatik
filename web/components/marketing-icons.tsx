"use client";

import { usePreferences } from "./preferences-provider";

export function InstagramOrb() {
  const { tr } = usePreferences();
  return <div className="instagram-scene" aria-label={tr("Instagram automation illustratsiyasi", "Иллюстрация автоматизации Instagram", "Instagram automation illustration")}>
    <div className="orbit one" /><div className="orbit two" />
    <div className="insta-card"><div className="insta-lens"><span /></div></div>
    <div className="float-card comment"><span className="float-dot green" /><div><strong>{tr("Commentga javob", "Ответ на комментарий", "Comment reply")}</strong><small>{tr("“Narxi qancha?” → DM", "«Сколько стоит?» → DM", "“How much?” → DM")}</small></div></div>
    <div className="float-card direct"><span className="float-dot violet" /><div><strong>{tr("Avtomatik DM", "Автоматический DM", "Automatic DM")}</strong><small>{tr("Xabar va kartochka", "Сообщение и карточка", "Message and card")}</small></div></div>
    <div className="float-card growth"><span className="float-dot pink" /><div><strong>{tr("Sotuvni oshiring", "Увеличивайте продажи", "Grow sales")}</strong><small>{tr("24/7 ishlaydi", "Работает 24/7", "Works 24/7")}</small></div></div>
  </div>;
}
