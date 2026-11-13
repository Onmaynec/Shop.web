export default function Loading() {
  return <main className="content page-loading" aria-busy="true" aria-label="Загрузка страницы">
    <div className="loading-line loading-short"/>
    <div className="loading-line loading-title"/>
    <div className="loading-line loading-text"/>
    <div className="loading-grid">{[0,1,2].map(n=><div key={n} className="loading-card"><div className="loading-line loading-card-image"/><div className="loading-line loading-text"/><div className="loading-line loading-short"/></div>)}</div>
    <span className="loading-caption">Загружаем данные…</span>
  </main>;
}
