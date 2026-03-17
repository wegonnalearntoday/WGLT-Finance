
(async function(){
  const files = {
    bench: './data/bench.json',
    flBuckets: './data/fl-buckets.json',
    weekCalendar: './data/week-calendar.json',
    bankProducts: './data/bank-products.json',
    contracts: './data/contracts.json',
    jobs: './data/jobs.json',
    ledgerCatalog: './data/ledger-catalog.json',
    socialWantsDeck: './data/social-wants-deck.json',
    masterData: './data/master-data.json',
    modes: './data/modes.json'
  };
  const entries = await Promise.all(Object.entries(files).map(async ([key, path]) => {
    const res = await fetch(path, {cache:'no-store'});
    if(!res.ok) throw new Error(`Failed to load ${path}`);
    return [key, await res.json()];
  }));
  window.WGLT_DATA = Object.fromEntries(entries);
  const s = document.createElement('script');
  s.src = './js/app.js';
  document.body.appendChild(s);
})().catch(err => {
  console.error(err);
  document.body.innerHTML = '<div style="padding:24px;font-family:system-ui;color:#fff;background:#111">Could not load JSON banks. Make sure the <code>data</code> and <code>js</code> folders stay beside <code>index.html</code> on GitHub Pages.</div>';
});
