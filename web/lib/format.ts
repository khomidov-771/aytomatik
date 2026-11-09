export function formatNumber(value = 0) { return new Intl.NumberFormat("uz-UZ").format(value); }
export function formatMoney(value = 0) { return `${new Intl.NumberFormat("uz-UZ").format(value)} so‘m`; }
export function formatDate(value?: string) { if (!value) return "—"; return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
export function timeAgo(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return "hozir"; if (seconds < 3600) return `${Math.floor(seconds / 60)} daqiqa oldin`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`; return `${Math.floor(seconds / 86400)} kun oldin`; }

