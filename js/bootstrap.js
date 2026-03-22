
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
    modes: './data/modes.json',
    experienceModes: './data/experience-modes.json',
    presentationRoles: './data/presentation-roles.json',
    teacherTools: './data/teacher-tools.json',
    eliteContracts: './data/elite-contracts.json',
    eliteScenarios: './data/elite-scenarios.json',
    delayedConsequences: './data/delayed-consequences.json',
    realLifeEvents: './data/real-life-events.json',
    financialEvents: './data/financial-events.json',
    opportunityEvents: './data/opportunity-events.json',
    advancedDelayedConsequences: './data/advanced-delayed-consequences.json',
    scenarioIndex: './data/scenario-index.json',
    scenarioSchema: './data/scenarios/scenario.schema.json',
    consequenceSchema: './data/consequences/consequence.schema.json',
    scenarioRealLifeFoundation: './data/scenarios/real-life-foundation.json',
    scenarioFinancialFoundation: './data/scenarios/financial-foundation.json',
    scenarioOpportunityFoundation: './data/scenarios/opportunity-foundation.json',
    scenarioEliteCreditFoundation: './data/scenarios/elite-credit-foundation.json',
    scenarioOpportunityJobExpansionV1: './data/scenarios/opportunity-job-expansion-v1.json',
    scenarioRealLifeExpansionV1: './data/scenarios/real-life-expansion-v1.json',
    scenarioFinancialExpansionV1: './data/scenarios/financial-expansion-v1.json',
    consequenceMapFoundation: './data/consequences/consequence-map-foundation.json'
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
