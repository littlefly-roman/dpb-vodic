/* =============================================================
   core/cas.js — pomocné funkcie pre dátum a čas (čistá logika, bez DOM)
   Načítava sa pred app/hlavna.js, ktorá si ich preberá z window.DpbCas.
============================================================= */
window.DpbCas = (() => {
function formatDateKey(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function formatDisplayDate(date) {
  const den = date.toLocaleDateString("sk-SK", { weekday: "long" });
  const datum = date.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    `<span class="date-day">${den.charAt(0).toUpperCase() + den.slice(1)}</span>` +
    `<span class="date-date">${datum}</span>`
  );
}

function formatMonthTitle(date) {
  const s = date.toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isToday(date) {
  return formatDateKey(date) === formatDateKey(new Date());
}
function isSameDay(a, b) {
  return formatDateKey(a) === formatDateKey(b);
}

function timeToSeconds(t) {
  if (!t) return 0;
  const p = t.split(":");
  return (
    parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2] || 0)
  );
}

  return {
    formatDateKey,
    formatDisplayDate,
    formatMonthTitle,
    isToday,
    isSameDay,
    timeToSeconds,
  };
})();
