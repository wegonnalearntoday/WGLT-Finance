
const APP_DATA = window.WGLT_DATA || {};
const BENCH = APP_DATA.bench || {};
const FL_BUCKETS = APP_DATA.flBuckets || {};
const WEEK_CALENDAR = APP_DATA.weekCalendar || {};
const BANK_PRODUCTS = APP_DATA.bankProducts || {};
const CONTRACTS = APP_DATA.contracts || [];
const ELITE_CONTRACTS = APP_DATA.eliteContracts || [];
const JOBS = APP_DATA.jobs || [];
const LEDGER_CATALOG = APP_DATA.ledgerCatalog || {};
const SOCIAL_WANTS_DECK = APP_DATA.socialWantsDeck || [];
const WGLT_MASTER_DATA = APP_DATA.masterData || {weeks:[]};
const EXPERIENCE_MODES = (APP_DATA.experienceModes && APP_DATA.experienceModes.experienceModes) || [];
const PRESENTATION_ROLES = (APP_DATA.presentationRoles && APP_DATA.presentationRoles.presentationRoles) || [];
const TEACHER_TOOLS = APP_DATA.teacherTools || {defaults:{},themes:[]};
const ELITE_SCENARIOS = (APP_DATA.eliteScenarios && APP_DATA.eliteScenarios.events) || [];
const ADVANCED_DELAYED = (APP_DATA.advancedDelayedConsequences && APP_DATA.advancedDelayedConsequences.chains) || [];
const LEGACY_MODES = APP_DATA.modes || [];

function isTeacherRole(){
  return (state.presentationRole || 'teacher') === 'teacher';
}
function isEliteExperience(){
  return (state.experienceLevel || 'standard') === 'elite';
}
function getExperienceConfig(){
  return EXPERIENCE_MODES.find(m => m.id === (state.experienceLevel || 'standard')) || EXPERIENCE_MODES[1] || EXPERIENCE_MODES[0] || {id:'standard',name:'Standard',description:'Balanced 48-week flow',eventWeights:{life:40,job:30,financial:30},requireMonthlyReflection:false,eliteFeatures:false};
}
function getPresentationRoleConfig(){
  return PRESENTATION_ROLES.find(r => r.id === (state.presentationRole || 'teacher')) || PRESENTATION_ROLES[0] || {id:'teacher',name:'Teacher',description:'Facilitator view',showTeacherTools:true,showBenchmarksInMeta:true};
}
function getModeConfig(){
  const role = getPresentationRoleConfig();
  const exp = getExperienceConfig();
  return {
    id: `${role.id}_${exp.id}`,
    roleId: role.id,
    experienceId: exp.id,
    name: `${role.name} + ${exp.name}`,
    shortName: `${role.name}/${exp.name}`,
    description: `${role.description} ${exp.description}`.trim(),
    eventWeights: exp.eventWeights || {life:40,job:30,financial:30},
    requireMonthlyReflection: !!exp.requireMonthlyReflection,
    showTeacherTools: !!role.showTeacherTools,
    showBenchmarksInMeta: !!role.showBenchmarksInMeta,
    showScenarioReason: !!role.showScenarioReason,
    showDelayedTracker: !!role.showDelayedTracker,
    showRubric: !!role.showRubric,
    showHiddenNotes: !!role.showHiddenNotes,
    eliteFeatures: !!exp.eliteFeatures,
    difficultyBadge: exp.difficultyBadge || exp.name
  };
}
function getModeStorageKey(){
  const cfg = getModeConfig();
  return `wgltSave_${cfg.roleId || 'teacher'}_${cfg.experienceId || 'standard'}`;
}

function getStorageKeyForMode(role='teacher', experience='standard'){
  return `wgltSave_${role || 'teacher'}_${experience || 'standard'}`;
}
function getLocalSaveForMode(role='teacher', experience='standard'){
  try{
    const raw = localStorage.getItem(getStorageKeyForMode(role, experience));
    return raw ? JSON.parse(raw) : null;
  }catch(err){
    return null;
  }
}
function hasMeaningfulProgress(payload){
  if(!payload || !payload.state) return false;
  const snap = payload.state || {};
  const ledgerCount = Array.isArray(snap?.ledger?.history) ? snap.ledger.history.length : 0;
  const teacherCount = Array.isArray(payload.teacherReflections) ? payload.teacherReflections.length : 0;
  const week = Number(snap?.weekEngine?.week || snap?.week || snap?.day || 1);
  return !!(snap?.mission?.active || ledgerCount > 0 || teacherCount > 0 || week > 1 || snap?.jobLocked || snap?.plan?.lockedForYear);
}
let autoSaveTimer = null;
function scheduleAutoSave(delay=500){
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(()=>saveTeacherLocal(true), delay);
}
function getRandomEventWeights(){
  return getModeConfig().eventWeights || {life:40,job:30,financial:30};
}
function getTeacherToolConfig(themeKey=''){
  const themes = TEACHER_TOOLS.themes || [];
  const defaults = TEACHER_TOOLS.defaults || {};
  const match = themes.find(t => t.themeKey === themeKey) || {};
  return {
    discussionPrompt: match.discussionPrompt || defaults.discussionPrompt || '',
    hiddenTeachingNote: match.hiddenTeachingNote || defaults.hiddenTeachingNote || '',
    vocabulary: match.vocabulary || defaults.vocabulary || [],
    reflectionCheckpoint: match.reflectionCheckpoint || defaults.reflectionCheckpoint || '',
    rubricNotes: match.rubricNotes || defaults.rubricNotes || []
  };
}
function getAvailableContracts(){
  return isEliteExperience() ? [...CONTRACTS, ...ELITE_CONTRACTS] : CONTRACTS;
}
function getCurrentWeekCard(){
  const week = Math.max(1, Math.min(48, Number(state.week || state.day || 1)));
  return (WGLT_MASTER_DATA.weeks || []).find(w => Number(w.week) === week) || (WGLT_MASTER_DATA.weeks || [])[0] || null;
}
function getScenarioReasonText(){
  const cfg = getModeConfig();
  const weekCard = getCurrentWeekCard();
  const job = JOBS.find(j => j.id === state.jobId) || {};
  const weights = cfg.eventWeights || {life:40,job:30,financial:30};
  const theme = weekCard?.themeKey ? `Theme: ${weekCard.themeKey}.` : '';
  const goal = weekCard?.learningGoal ? ` Goal this week: ${weekCard.learningGoal}.` : '';
  const jobText = job.name ? ` Job filter: ${job.name}.` : '';
  return `This scenario mix is being shaped by ${cfg.name}. Current event weights are ${weights.life || 0}/${weights.job || 0}/${weights.financial || 0} for life/job/financial.${jobText} ${theme}${goal}`.trim();
}
function updateModeBadge(){
  const cfg = getModeConfig();
  if(document.getElementById('teacherModeLabel')) document.getElementById('teacherModeLabel').textContent = cfg.name || 'Mode';
  if(document.getElementById('modeSummaryLabel')) document.getElementById('modeSummaryLabel').textContent = cfg.description || '';
}

function isStandardV1Experience(){
  return (state.experienceLevel || 'standard') !== 'beginner';
}
function ensureStandardV1State(){
  if(!state.standardV1) state.standardV1 = {};
  if(!state.standardV1.weeklyGoals) state.standardV1.weeklyGoals = {};
  if(!state.standardV1.goalHistory) state.standardV1.goalHistory = [];
  if(!state.standardV1.healthHistory) state.standardV1.healthHistory = [];
  if(!state.standardV1.choiceEchoLog) state.standardV1.choiceEchoLog = [];
  if(!state.standardV1.pressureTracks) state.standardV1.pressureTracks = { basics:0, bills:0, impulse:0, resilience:0 };
  if(!state.standardV1.chainHistory) state.standardV1.chainHistory = [];
  if(!state.standardV1.chainWindowsFired) state.standardV1.chainWindowsFired = {};
  if(!state.standardV1.actionPlans) state.standardV1.actionPlans = [];
  if(!state.standardV1.bigConsequenceLog) state.standardV1.bigConsequenceLog = [];
  if(!state.standardV1.focusProgressByMonth) state.standardV1.focusProgressByMonth = {};
  if(!state.standardV1.focusBaselines) state.standardV1.focusBaselines = {};
}
function derivePressureTrack(item){
  const hay = `${item?.label || ''} ${item?.sourceLabel || ''}`.toLowerCase();
  if(/lunch|meal|energy|suppl|shortage|burnout|late|skip/.test(hay)) return 'basics';
  if(/contract|renew|bill|charge|fee|tax|overage|dispute|payment|rate/.test(hay)) return 'bills';
  if(/spend|pizza|wants|gift|arcade|stream|club|splurge|impulse/.test(hay)) return 'impulse';
  if(/reward|boost|discipline|milestone|reputation|savings|dividend|goodwill|pays off|strong/.test(hay)) return 'resilience';
  return 'bills';
}
function registerPressureTrack(item, amount){
  ensureStandardV1State();
  const track = derivePressureTrack(item);
  state.standardV1.pressureTracks[track] = Math.max(0, Number(state.standardV1.pressureTracks[track] || 0) + Number(amount || 0));
  return track;
}
function getPressureTrackSummary(){
  ensureStandardV1State();
  const entries = Object.entries(state.standardV1.pressureTracks || {}).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0));
  const top = entries[0] || ['basics',0];
  const labels = { basics:'basics', bills:'bills', impulse:'impulse', resilience:'resilience' };
  return { key:top[0], label:labels[top[0]] || top[0], count:Number(top[1] || 0), total:entries.reduce((s,[,v])=>s+Number(v||0),0) };
}
function maybeQueueConsequenceChain(currentWeek, reason){
  ensureStandardV1State();
  const summary = getPressureTrackSummary();
  if(summary.total < 4) return;
  const chainKey = `${summary.key}:${Math.ceil(Number(currentWeek || 1) / 4)}`;
  if(state.standardV1.chainWindowsFired[chainKey]) return;
  state.standardV1.chainWindowsFired[chainKey] = true;
  const triggerWeek = Math.min(48, Number(currentWeek || 1) + (summary.key === 'resilience' ? 1 : 2));
  const labelMap = {
    basics:'Routine Pressure Wave',
    bills:'Bill Pressure Wave',
    impulse:'Impulse Pressure Wave',
    resilience:'Bounce-Back Bonus'
  };
  const detailMap = {
    basics:'Your basics routine has been shaky for a few weeks, so this week feels tighter.',
    bills:'Recurring bills and old money choices are stacking up, so this week starts with less breathing room.',
    impulse:'Impulse choices are starting to crowd out your plan, so extra pressure hits this week.',
    resilience:'Your better habits are starting to pay you back with a little breathing room.'
  };
  queueConsequenceObject({
    triggerWeek,
    id:`chain_${summary.key}_${triggerWeek}`,
    label:labelMap[summary.key] || 'Pressure Wave',
    major: summary.key !== 'resilience',
    sourceLabel:`v2.1 chain from ${reason || summary.label}`,
    apply:(st)=>{
      ensureStandardV1State();
      if(summary.key === 'resilience'){
        st.bank.savings += 12;
        addLedgerLine(`↩ Bounce-back bonus +${money(12)} to savings`);
        st.standardV1.pressureTracks.basics = Math.max(0, Number(st.standardV1.pressureTracks.basics || 0) - 1);
        st.standardV1.pressureTracks.bills = Math.max(0, Number(st.standardV1.pressureTracks.bills || 0) - 1);
        return `${detailMap[summary.key]} Savings +${money(12)}.`;
      }
      const hit = summary.key === 'bills' ? 18 : (summary.key === 'impulse' ? 14 : 10);
      payFromCheckingThenCashThenSavings(hit);
      st.credit = clamp(Number(st.credit || 650) - (summary.key === 'bills' ? 8 : 4), 300, 850);
      st.standardV1.pressureTracks[summary.key] = Math.max(0, Number(st.standardV1.pressureTracks[summary.key] || 0) - 2);
      addLedgerLine(`↩ ${labelMap[summary.key] || 'Pressure wave'} -${money(hit)}`);
      return `${detailMap[summary.key]} Cost: ${money(hit)}${summary.key === 'bills' ? ' and credit -8.' : '.'}`;
    }
  }, `chain:${summary.key}`);
  state.standardV1.chainHistory.unshift({ week:Number(currentWeek || 1), triggerWeek, key:summary.key, reason:reason || summary.label, label:labelMap[summary.key] || 'Pressure Wave' });
  state.standardV1.chainHistory = state.standardV1.chainHistory.slice(0, 20);
}
const MONTHLY_FOCUS_BANK = [
  { id:'save', name:'Build Savings', emoji:'🏦', desc:'Put future-you first this month.', weights:{life:-5,job:-5,financial:10} },
  { id:'credit', name:'Protect Credit', emoji:'🛡️', desc:'Avoid fees, missed payments, and bad paper trails.', weights:{life:0,job:-5,financial:5} },
  { id:'income', name:'Grow Job Income', emoji:'💼', desc:'Lean into work opportunities and reputation wins.', weights:{life:-10,job:15,financial:-5} },
  { id:'wants', name:'Control Wants', emoji:'🎯', desc:'Beat impulse spending and stay on plan this month.', weights:{life:10,job:-5,financial:-5} }
];
function getCurrentFocusMonth(){
  return Number(state.weekEngine ? weekToMonth(state.weekEngine.week || 1) : state.day || 1);
}
function getWeeklyGoalForWeek(week){
  ensureStandardV1State();
  const month = Number(weekToMonth ? weekToMonth(Number(week || (state.weekEngine && state.weekEngine.week) || 1)) : week || 1);
  return state.standardV1.weeklyGoals[String(month)] || null;
}
function getCurrentWeeklyGoal(){
  const month = getCurrentFocusMonth();
  return state.standardV1.weeklyGoals[String(month)] || null;
}
function setWeeklyGoalForWeek(week, goalId){
  ensureStandardV1State();
  const month = Number(weekToMonth ? weekToMonth(Number(week || (state.weekEngine && state.weekEngine.week) || 1)) : week || 1);
  const goal = MONTHLY_FOCUS_BANK.find(g => g.id === goalId) || MONTHLY_FOCUS_BANK[0];
  const saved = Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0) + Number(totalStockFunds ? totalStockFunds() : 0);
  state.standardV1.weeklyGoals[String(month)] = { month, id:goal.id, name:goal.name, emoji:goal.emoji, desc:goal.desc, selectedAt:new Date().toISOString() };
  state.standardV1.focusBaselines[String(month)] = {
    savings:saved,
    credit:Number(state.credit || 650),
    checking:Number(state.bank?.checking || 0),
    careerLevel:Number(state.elite?.career?.level || 1),
    income:Number(state.plan?.income || 0),
    unplanned:Boolean(state.plan && state.plan.unplannedWantUsedThisMonth)
  };
  state.standardV1.goalHistory.push({ month, id:goal.id, name:goal.name });
  showBanner(`${goal.emoji} Monthly Focus: ${goal.name}`);
  scheduleAutoSave(150);
}
function getCurrentMonthFocusProgress(){
  ensureStandardV1State();
  const month = getCurrentFocusMonth();
  const goal = getCurrentWeeklyGoal();
  if(!goal) return { score:0, label:'Pick focus', detail:'No monthly focus selected yet.' };
  const base = state.standardV1.focusBaselines[String(month)] || {};
  const savedNow = Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0) + Number(totalStockFunds ? totalStockFunds() : 0);
  const savingsGain = Math.max(0, savedNow - Number(base.savings || 0));
  const creditGain = Number(state.credit || 650) - Number(base.credit || state.credit || 650);
  const checking = Number(state.bank?.checking || 0);
  const currentIncome = Number(state.plan?.income || 0) + Number(state.elite?.career?.payBonus || 0);
  const incomeGain = currentIncome - Number(base.income || state.plan?.income || 0);
  const pressure = getPressureTrackSummary();
  const unplanned = Boolean(state.plan && state.plan.unplannedWantUsedThisMonth);
  let score = 28;
  if(goal.id === 'save'){
    score += Math.min(48, Math.round(savingsGain * 1.8));
    if(!unplanned) score += 14;
    if(checking >= 40) score += 10;
  } else if(goal.id === 'credit'){
    score += 28 + Math.max(-20, Math.min(26, creditGain * 3));
    if((pressure.key || '') !== 'bills') score += 12;
    if(checking >= 30) score += 8;
  } else if(goal.id === 'income'){
    score += 24 + Math.max(0, Math.min(28, Math.round(incomeGain / 2)));
    if(Number(state.ledger?.weekIncome || 0) > 0) score += 12;
    if(Number(state.elite?.career?.level || 1) > Number(base.careerLevel || 1)) score += 16;
  } else if(goal.id === 'wants'){
    score += unplanned ? 0 : 36;
    if((pressure.key || '') !== 'impulse') score += 16;
    if(checking >= 35) score += 8;
  }
  if(Number(pressure.total || 0) > 0) score -= Math.min(18, Number(pressure.total || 0) * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));
  let label = 'Needs work';
  if(score >= 85) label = 'Locked in';
  else if(score >= 70) label = 'On track';
  else if(score >= 50) label = 'Building';
  const detailMap = {
    save:`Saved ${money(savingsGain)} this month`,
    credit:`Credit ${creditGain >= 0 ? '+' : ''}${creditGain} this month`,
    income:`Income trend ${incomeGain >= 0 ? '+' : ''}${money(incomeGain)}`,
    wants: unplanned ? 'Impulse hit the plan once' : 'Wants stayed on plan'
  };
  const out = { score, label, detail: detailMap[goal.id] || 'Progress is updating' };
  state.standardV1.focusProgressByMonth[String(month)] = out;
  return out;
}
function getMonthlyGoalStatusText(){
  const goal = getCurrentWeeklyGoal();
  const progress = getCurrentMonthFocusProgress();
  if(!goal) return 'Pick focus';
  if(goal.id === 'save') return progress.score >= 70 ? 'Savings focus holding' : 'Feed savings again';
  if(goal.id === 'credit') return progress.score >= 70 ? 'Credit protected' : 'Watch bills and fees';
  if(goal.id === 'income') return progress.score >= 70 ? 'Income momentum up' : 'Look for one work win';
  if(goal.id === 'wants') return progress.score >= 70 ? 'Wants under control' : 'Impulse watch';
  return progress.label;
}
function getDynamicRandomEventWeights(){
  const base = Object.assign({life:40,job:30,financial:30}, getRandomEventWeights());
  const goal = getCurrentWeeklyGoal();
  const shift = goal ? ((MONTHLY_FOCUS_BANK.find(g => g.id === goal.id) || {}).weights || {}) : {};
  const out = {
    life: Math.max(10, Number(base.life || 0) + Number(shift.life || 0)),
    job: Math.max(10, Number(base.job || 0) + Number(shift.job || 0)),
    financial: Math.max(10, Number(base.financial || 0) + Number(shift.financial || 0))
  };
  const total = out.life + out.job + out.financial || 100;
  out.life = Math.round((out.life / total) * 100);
  out.job = Math.round((out.job / total) * 100);
  out.financial = Math.max(0, 100 - out.life - out.job);
  return out;
}
function ensureEliteState(){
  ensureStandardV1State();
  if(!state.elite) state.elite = {};
  if(!state.elite.investments) state.elite.investments = { stocks:0, costBasis:0, lastChange:0, history:[], portfolios:{conservative:0,balanced:0,aggressive:0} };
  if(!state.elite.investments.portfolios) state.elite.investments.portfolios = {conservative:0,balanced:0,aggressive:0};
  if(!state.elite.career) state.elite.career = { level:1, title:'Starter Worker', promotions:0, payBonus:0, history:[], branch:'' };
  if(!state.elite.endings) state.elite.endings = { final:null, track:'⚖️ Survivor' };
  if(!state.elite.creditAccess) state.elite.creditAccess = { apartment:false, car:false, loan:false };
  if(!state.elite.obligations) state.elite.obligations = [];
  if(state.elite.loanDecisionMonth == null) state.elite.loanDecisionMonth = 0;
}
function totalStockFunds(){
  ensureEliteState();
  const inv = state.elite.investments || {};
  const ports = inv.portfolios || {};
  const portTotal = Number(ports.conservative || 0) + Number(ports.balanced || 0) + Number(ports.aggressive || 0);
  if(portTotal > 0){
    inv.stocks = Math.round(portTotal);
    return inv.stocks;
  }
  return Number(inv.stocks || 0);
}
function getStockMixSummary(){
  ensureEliteState();
  const p = state.elite.investments.portfolios || {};
  const parts = [];
  if(Number(p.conservative || 0) > 0) parts.push(`Shield ${money(p.conservative)}`);
  if(Number(p.balanced || 0) > 0) parts.push(`Blend ${money(p.balanced)}`);
  if(Number(p.aggressive || 0) > 0) parts.push(`Rocket ${money(p.aggressive)}`);
  return parts.length ? parts.join(' • ') : 'None yet';
}
function getCreditTier(){
  const score = Number(state.credit || 650);
  if(score >= 760) return 'Premier';
  if(score >= 700) return 'Strong';
  if(score >= 640) return 'Building';
  if(score >= 580) return 'Watch';
  return 'At Risk';
}
function getCreditUnlocks(){
  const score = Number(state.credit || 650);
  const apartment = score >= 700 ? 'Unlocked' : `Need ${700-score} more`;
  const car = score >= 660 ? 'Unlocked' : `Need ${660-score} more`;
  const loan = score >= 620 ? 'Unlocked' : `Need ${620-score} more`;
  ensureEliteState();
  state.elite.creditAccess = { apartment:score >= 700, car:score >= 660, loan:score >= 620 };
  return { apartment, car, loan, score };
}

function getDynamicTomorrowBill(){
  const checkingFee = state.bank.checkingType ? Number((BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType) || {}).monthlyFee || 0) : 0;
  const contractFee = state.contractActive ? Number((CONTRACTS.find(x=>x.id===state.contractId) || {}).monthly || 0) : 0;
  const eliteFee = ((state.elite && state.elite.obligations) || []).filter(o=>Number(o.monthsLeft||0)>0).reduce((sum,o)=>sum + Number(o.monthly || 0), 0);
  const fallback = 15;
  const bill = Math.max(8, contractFee || eliteFee || checkingFee || fallback);
  let label = 'planned bill';
  if(contractFee) label = 'contract charge';
  else if(eliteFee) label = 'financing payment';
  else if(checkingFee) label = 'bank fee';
  return { amount: bill, label };
}

function getTeacherDashboardSummary(){
  const goal = getCurrentWeeklyGoal ? getCurrentWeeklyGoal() : null;
  const health = computeFinancialHealth ? computeFinancialHealth() : { score:0, label:'—' };
  const focus = getCurrentMonthFocusProgress ? getCurrentMonthFocusProgress() : { score:0, label:'—' };
  const unlocks = getCreditUnlocks ? getCreditUnlocks() : { apartment:'—', car:'—', loan:'—', score:Number(state.credit || 650) };
  const activeObligations = ((state.elite && state.elite.obligations) || []).filter(o=>Number(o.monthsLeft||0)>0);
  return {
    week: state.weekEngine ? state.weekEngine.week : state.day,
    month: typeof weekToMonthName === 'function' ? weekToMonthName(state.weekEngine ? state.weekEngine.week : 1) : `Month ${state.day || 1}`,
    focusName: goal ? `${goal.emoji} ${goal.name}` : 'Not selected',
    focusScore: focus.score || 0,
    focusLabel: focus.label || '—',
    healthScore: health.score || 0,
    healthLabel: health.label || '—',
    credit: Number(state.credit || 650),
    unlocks,
    obligations: activeObligations.length,
    obligationTotal: activeObligations.reduce((sum,o)=>sum + Number(o.monthly || 0), 0),
    ending: (state.elite && state.elite.endings && (state.elite.endings.track || state.elite.endings.final)) || 'In progress'
  };
}

function getJobCareerBranch(){
  const job = (state.jobs && state.jobs[state.jobIndex]) || {};
  const id = job.id || '';
  if(['babysitting','pet','dogwalk'].includes(id)) return { key:'care', name:'Care Services', titles:['Neighborhood Helper','Trusted Care Pro','Senior Care Lead','Family Services Captain','Community Care Director','Youth Care Manager','Care Business Owner'], bonus:[15,20,25,30,35,40] };
  if(['lawn','cars','chores','errands'].includes(id)) return { key:'ops', name:'Operations', titles:['Starter Worker','Route Runner','Shift Lead','Operations Captain','Service Manager','Field Director','Neighborhood Ops Owner'], bonus:[15,20,25,30,35,40] };
  return { key:'specialist', name:'Creative & Academic', titles:['Starter Specialist','Skilled Builder','Lead Specialist','Program Captain','Studio Manager','Community Expert','Brand Owner'], bonus:[20,25,30,35,40,45] };
}

function getEliteObligationSummary(){
  ensureEliteState();
  const active = (state.elite.obligations || []).filter(o => Number(o.monthsLeft || 0) > 0);
  if(!active.length) return 'No active financing';
  const total = active.reduce((sum,o)=>sum + Number(o.monthly || 0), 0);
  return `${active.length} active • ${money(total)}/mo`;
}
function addEliteObligation(kind, config){
  ensureEliteState();
  const existing = (state.elite.obligations || []).find(o => o.kind === kind && Number(o.monthsLeft || 0) > 0);
  if(existing) return false;
  state.elite.obligations.push(Object.assign({ kind }, config || {}));
  return true;
}
function applyEliteObligationCharges(monthName){
  ensureEliteState();
  if(!isEliteExperience()) return [];
  const active = (state.elite.obligations || []).filter(o => Number(o.monthsLeft || 0) > 0);
  const results = [];
  active.forEach(o=>{
    const payment = Number(o.monthly || 0);
    const available = Number(state.bank?.checking || 0) + Number(state.cash || 0) + Number(state.bank?.savings || 0);
    if(available >= payment){
      payFromCheckingThenCashThenSavings(payment);
      state.ledger.weekExpenses += payment;
      o.monthsLeft = Math.max(0, Number(o.monthsLeft || 0) - 1);
      addLedgerLine(`${monthName}: ${o.name} payment -${money(payment)} (${o.monthsLeft} mo left)`);
      if(o.kind === 'car') state.plan.income = Number(state.plan?.income || 0) + 10;
      if(o.kind === 'apartment') state.credit = clamp(Number(state.credit || 650) + 3, 300, 850);
      results.push(`${o.name} -${money(payment)}`);
      if(Number(o.monthsLeft || 0) <= 0){
        addLedgerLine(`${monthName}: ${o.name} paid off`);
        state.credit = clamp(Number(state.credit || 650) + 10, 300, 850);
      }
    } else {
      o.monthsLeft = Math.max(0, Number(o.monthsLeft || 0) - 1);
      state.credit = clamp(Number(state.credit || 650) - 18, 300, 850);
      addLedgerLine(`${monthName}: Missed ${o.name} payment — credit -18`);
      queueBigConsequence(`Missed ${o.name} payment`, `⚠️ This decision is catching up to you... Your ${o.name.toLowerCase()} payment was missed and your credit dropped.`);
      results.push(`Missed ${o.name} payment`);
    }
  });
  state.elite.obligations = (state.elite.obligations || []).filter(o => Number(o.monthsLeft || 0) > 0);
  return results;
}
function promptEliteCreditOpportunity(onDone){
  ensureEliteState();
  if(!isEliteExperience()) return onDone && onDone();
  const month = getCurrentFocusMonth();
  if(state.elite.loanDecisionMonth === month) return onDone && onDone();
  const unlocks = getCreditUnlocks();
  const offers = [];
  const hasKind = kind => (state.elite.obligations || []).some(o => o.kind === kind && Number(o.monthsLeft || 0) > 0);
  if(state.elite.creditAccess.loan && !hasKind('loan')) offers.push({ id:'loan', label:'Starter Loan +$150 now', hint:'Pay $35/month for 5 months', apply:()=>{ state.bank.checking += 150; addEliteObligation('loan', { name:'Starter Loan', monthly:35, monthsLeft:5 }); state.credit = clamp(Number(state.credit || 650) + 4, 300, 850); addLedgerLine('Elite v1.2: Starter Loan approved +$150 • $35/mo for 5 months'); return 'Starter Loan approved. +$150 now, $35/month for 5 months.'; } });
  if(state.elite.creditAccess.car && !hasKind('car')) offers.push({ id:'car', label:'Used Car Plan', hint:'Down $90 • $55/month for 6 months', apply:()=>{ if((Number(state.bank?.checking||0)+Number(state.cash||0)) < 90) return 'Not enough for the down payment.'; payFromCheckingThenCashThenSavings(90); addEliteObligation('car', { name:'Used Car Plan', monthly:55, monthsLeft:6 }); state.plan.income = Number(state.plan?.income || 0) + 20; state.credit = clamp(Number(state.credit || 650) + 6, 300, 850); addLedgerLine('Elite v1.2: Used Car financed -$90 down • $55/mo for 6 months • income +$20/mo'); return 'Used Car Plan started. Income potential +$20/month.'; } });
  if(state.elite.creditAccess.apartment && !hasKind('apartment')) offers.push({ id:'apartment', label:'Shared Apartment Setup', hint:'Down $120 • $85/month for 6 months', apply:()=>{ if((Number(state.bank?.checking||0)+Number(state.cash||0)) < 120) return 'Not enough for the setup payment.'; payFromCheckingThenCashThenSavings(120); addEliteObligation('apartment', { name:'Shared Apartment Setup', monthly:85, monthsLeft:6 }); state.credit = clamp(Number(state.credit || 650) + 8, 300, 850); addLedgerLine('Elite v1.2: Shared Apartment setup -$120 down • $85/mo for 6 months'); return 'Shared Apartment setup approved. On-time payments can strengthen credit.'; } });
  state.elite.loanDecisionMonth = month;
  if(!offers.length) return onDone && onDone();
  openHtmlModal({
    title:`🏁 Elite Credit Paths • ${weekToMonthName(state.weekEngine ? state.weekEngine.week : 1)}`,
    meta:`Credit can unlock real monthly obligations now`,
    html:`<div style="font-weight:900;margin-bottom:10px">Your credit opened new doors. Pick one path, or skip and stay flexible this month.</div><div class="choice-grid">${offers.map(o=>`<button class="choice-btn" data-credit-offer="${o.id}">${o.label}<small>${o.hint}</small></button>`).join('')}<button class="choice-btn" data-credit-offer="skip">Skip for now<small>No new monthly payment this month</small></button></div>`,
    buttons:[],
    onRender:()=>{
      document.querySelectorAll('[data-credit-offer]').forEach(btn=>{
        btn.onclick=()=>{
          const pick = btn.dataset.creditOffer;
          let msg = 'Skipped new financing for now.';
          if(pick !== 'skip'){
            const offer = offers.find(o => o.id === pick);
            if(offer) msg = offer.apply();
          }
          closeHtmlModal();
          showBanner(msg);
          renderAll();
          if(onDone) onDone();
        };
      });
    }
  });
}
function getEliteEndingTrack(){
  ensureEliteState();
  const saved = Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0) + totalStockFunds();
  const health = Number((state.standardV1 && state.standardV1.healthScore) || computeFinancialHealth().score || 0);
  const credit = Number(state.credit || 650);
  const cashFlow = Number(state.bank?.checking || 0) + Number(state.cash || 0);
  let label = '⚖️ Survivor';
  if(saved >= 450 && credit >= 700 && health >= 72) label = '💎 Wealth Builder';
  else if(cashFlow < 40 || credit < 610 || health < 45) label = '🚨 Financially Struggling';
  state.elite.endings.track = label;
  return label;
}
function getMonthlyActionPlan(snapshot){
  ensureEliteState();
  const snap = snapshot || {};
  const pressure = getPressureTrackSummary();
  const health = Number((snap.healthScore != null ? snap.healthScore : (state.standardV1 && state.standardV1.healthScore)) || computeFinancialHealth().score || 0);
  if(state.plan && state.plan.unplannedWantUsedThisMonth) return 'Next month focus on saving consistency and planning your wants before you spend.';
  if(pressure.key === 'bills' && Number(pressure.count || 0) >= 2) return 'Next month focus on bill timing, recurring contracts, and protecting your credit score.';
  if(pressure.key === 'impulse' && Number(pressure.count || 0) >= 2) return 'Next month focus on pausing before wants so impulse spending stops crowding out your plan.';
  if(Number(state.credit || 650) < 650) return 'Next month focus on protecting credit by paying on time and avoiding avoidable fees.';
  if(health < 60) return 'Next month focus on stabilizing cash flow before taking on extra risk.';
  if(totalStockFunds() > 0) return 'Next month focus on balancing safe saving with risk so one bad week does not shake your whole plan.';
  return 'Next month focus on saving consistency.';
}
function applyEliteMarketCycle(monthName){
  ensureEliteState();
  if(!isEliteExperience()) return null;
  const inv = state.elite.investments;
  const ports = inv.portfolios || {conservative:0, balanced:0, aggressive:0};
  const total = totalStockFunds();
  if(total <= 0) return null;
  const profiles = {
    conservative:[-0.04,-0.02,-0.01,0.01,0.02,0.03,0.04],
    balanced:[-0.08,-0.05,-0.02,0.03,0.05,0.08,0.1],
    aggressive:[-0.16,-0.1,-0.06,0.05,0.1,0.14,0.18]
  };
  let delta = 0;
  const lines = [];
  ['conservative','balanced','aggressive'].forEach(key=>{
    const amt = Number(ports[key] || 0);
    if(amt <= 0) return;
    const swings = profiles[key];
    const pct = swings[Math.floor(Math.random()*swings.length)];
    const change = Math.round(amt * pct);
    ports[key] = Math.max(0, amt + change);
    delta += change;
    lines.push(`${key}: ${change >= 0 ? '+' : '-'}${money(Math.abs(change))} (${Math.round(pct*100)}%)`);
  });
  inv.stocks = Math.round(Number(ports.conservative||0)+Number(ports.balanced||0)+Number(ports.aggressive||0));
  inv.lastChange = delta;
  inv.history.push({ month: monthName || '', delta, value: inv.stocks, mix:getStockMixSummary() });
  if(delta >= 0){
    state.credit = clamp(state.credit + (delta >= Math.round(total*0.08) ? 3 : 1), 300, 850);
    addLedgerLine(`${monthName || 'Month'}: Stock market gain +${money(delta)} | ${lines.join(' | ')}`);
    return `Market gain: +${money(delta)} | ${lines.join(' • ')}`;
  }
  state.credit = clamp(state.credit - (delta <= -Math.round(total*0.08) ? 4 : 2), 300, 850);
  addLedgerLine(`${monthName || 'Month'}: Stock market swing -${money(Math.abs(delta))} | ${lines.join(' | ')}`);
  return `Market swing: -${money(Math.abs(delta))} | ${lines.join(' • ')}`;
}
function maybeAdvanceCareer(monthName){
  ensureEliteState();
  if(!isEliteExperience()) return null;
  const health = Number((state.standardV1 && state.standardV1.healthScore) || computeFinancialHealth().score || 0);
  const saved = Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0) + totalStockFunds();
  const career = state.elite.career;
  const branch = getJobCareerBranch();
  career.branch = branch.name;
  const threshold = career.level * 120;
  if(health >= 68 && Number(state.credit || 650) >= 660 && saved >= threshold){
    career.level += 1;
    career.promotions += 1;
    const payRaise = branch.bonus[Math.min(branch.bonus.length-1, Math.max(0, career.level-2))] || 20;
    career.payBonus += payRaise;
    state.plan.income += payRaise;
    career.title = branch.titles[Math.min(branch.titles.length-1, career.level-1)] || `Level ${career.level}`;
    career.history.push({ month: monthName || '', level: career.level, title: career.title, branch:branch.name, payRaise });
    addLedgerLine(`${monthName || 'Month'}: Career promotion → ${career.title} (${branch.name}) (+$${payRaise} monthly pay)`);
    return `${career.title} unlocked in ${branch.name}. Monthly pay +$${payRaise}.`;
  }
  return null;
}
function renderEliteOverview(){
  ensureEliteState();
  const card = document.getElementById('eliteCommandCard');
  if(card) card.style.display = isEliteExperience() ? 'block' : 'none';
  if(!isEliteExperience()) return;
  const career = state.elite.career;
  const endingTrack = getEliteEndingTrack();
  const unlocks = getCreditUnlocks();
  if(document.getElementById('eliteCreditTier')) document.getElementById('eliteCreditTier').textContent = getCreditTier();
  if(document.getElementById('eliteCareerPath')) document.getElementById('eliteCareerPath').textContent = career.title || 'Starter Worker';
  if(document.getElementById('eliteCareerLevel')) document.getElementById('eliteCareerLevel').textContent = `Lv ${career.level || 1}`;
  if(document.getElementById('eliteStockValue')) document.getElementById('eliteStockValue').textContent = money(totalStockFunds());
  if(document.getElementById('eliteEndingTrack')) document.getElementById('eliteEndingTrack').textContent = endingTrack;
  if(document.getElementById('eliteStockMix')) document.getElementById('eliteStockMix').textContent = getStockMixSummary();
  if(document.getElementById('eliteCreditUnlocks')) document.getElementById('eliteCreditUnlocks').textContent = `Apt: ${unlocks.apartment} • Car: ${unlocks.car} • Loan: ${unlocks.loan}`;
  if(document.getElementById('eliteCareerBranch')) document.getElementById('eliteCareerBranch').textContent = career.branch || getJobCareerBranch().name;
  if(document.getElementById('eliteObligations')) document.getElementById('eliteObligations').textContent = getEliteObligationSummary();
  const latestPlan = (state.standardV1.actionPlans || []).slice(-1)[0] || getMonthlyActionPlan({});
  if(document.getElementById('eliteActionPlan')) document.getElementById('eliteActionPlan').textContent = latestPlan;
}

function getChoiceEchoPreview(){
  const pending = ((state.weekEngine && state.weekEngine.pending) || []).slice().sort((a,b)=>Number(a.triggerWeek||99)-Number(b.triggerWeek||99));
  const masterTracks = Object.entries((state.masterScenario && state.masterScenario.trackCounts) || {}).filter(([,v])=>Number(v||0) > 0).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0));
  const pressure = getPressureTrackSummary();
  const pressureCount = masterTracks.reduce((sum,[,v])=>sum + Number(v || 0), 0) + Number(pressure.total || 0);
  if(!pending.length && !pressureCount) return {count:0, text:'none queued', next:null, pressure:null};
  const next = pending[0] || null;
  const masterPressure = masterTracks[0] ? { key:masterTracks[0][0], count:Number(masterTracks[0][1]||0) } : null;
  const parts = [];
  if(pending.length) parts.push(`${pending.length} queued`);
  if(next) parts.push(`next W${next.triggerWeek}: ${next.label || 'Echo'}`);
  if(pressure && pressure.count) parts.push(`chain pressure: ${pressure.label} x${pressure.count}`);
  else if(masterPressure) parts.push(`pressure: ${masterPressure.key} x${masterPressure.count}`);
  return { count:pending.length + pressureCount, text:parts.join(' • '), next, pressure:pressure && pressure.count ? pressure : masterPressure };
}
function getIdentitySnapshot(source){
  const base = source || {};
  const saved = Number(base.savings ?? state.bank?.savings ?? 0) + Number(base.hysa ?? state.bank?.hysaPrincipal ?? 0) + Number(base.cd ?? (typeof totalCdFunds === 'function' ? totalCdFunds() : 0));
  const checking = Number(base.checking ?? state.bank?.checking ?? 0);
  const credit = Number(base.credit ?? state.credit ?? 650);
  const unplanned = !!(base.unplannedWantUsed ?? (state.plan && state.plan.unplannedWantUsedThisMonth));
  const goalPct = Number(base.savingsGoalPct ?? (state.savingsGoal ? Math.min(100, Math.round((saved / Math.max(1, Number(state.savingsGoal || 1))) * 100)) : 0));
  const health = base.healthScore != null ? Number(base.healthScore) : Number((state.standardV1 && state.standardV1.healthScore) || computeFinancialHealth().score || 0);
  const pending = Number(((state.weekEngine && state.weekEngine.pending && state.weekEngine.pending.length) || 0));
  const pressure = getPressureTrackSummary();

  let title = 'Balanced Builder';
  let emoji = '⚖️';
  let detail = 'You are balancing spending, saving, and staying in the game.';

  if(health >= 82 && goalPct >= 45 && !unplanned){
    title = 'Saver Identity';
    emoji = '💎';
    detail = 'Your habits are stacking toward savings and long-term wins.';
  } else if((credit < 625 || checking <= 0 || unplanned) && health < 55){
    title = 'Debt Risk Trend';
    emoji = '⚠️';
    detail = 'Unplanned money pressure is starting to squeeze your budget.';
  } else if((pending >= 4 || pressure.total >= 5) && health < 65){
    title = 'Pressure Week';
    emoji = '🌪️';
    detail = pressure.key === 'bills'
      ? 'Bills and older choices are stacking together, so this is a protect-your-plan stretch.'
      : pressure.key === 'impulse'
        ? 'Impulse choices are echoing forward, so this week needs tighter control.'
        : 'Earlier choices are still echoing, so this is a protect-your-plan stretch.';
  } else if(credit >= 680 && saved >= 75){
    title = 'Strong Builder';
    emoji = '🏗️';
    detail = 'You are building stability with credit, savings, and cleaner decisions.';
  }

  return { emoji, title, detail };
}
function computeFinancialHealth(){
  ensureStandardV1State();
  const saved = Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0);
  const liquid = Number(state.cash || 0) + Number(state.bank?.checking || 0) + Number(state.bank?.savings || 0);
  const goalPct = state.savingsGoal ? Math.min(1, saved / Math.max(1, Number(state.savingsGoal))) : 0;
  const pendingCount = Number((state.weekEngine && state.weekEngine.pending && state.weekEngine.pending.length) || 0);
  const pressure = getPressureTrackSummary();
  let score = 52;
  score += Math.max(-12, Math.min(18, Math.round((Number(state.credit || 650) - 650) / 8)));
  score += Math.max(0, Math.min(16, Math.round(saved / 18)));
  score += Math.max(-10, Math.min(8, Math.round((liquid - 60) / 20)));
  score += Math.round(goalPct * 12);
  if(state.plan && state.plan.unplannedWantUsedThisMonth) score -= 7;
  if(Number(state.localTaxDue || 0) > 0) score -= Math.min(10, Math.round(Number(state.localTaxDue || 0) / 8));
  if(Number(state.bank?.checking || 0) <= 0) score -= 6;
  score -= Math.min(12, pendingCount * 2);
  score -= Math.min(10, Number(pressure.total || 0));
  if(pressure.key === 'resilience' && Number(pressure.count || 0) >= 2) score += 4;
  const goal = getCurrentWeeklyGoal();
  const goalHealthMap = {
    save: saved >= 50 ? 5 : saved >= 20 ? 2 : -1,
    credit: Number(state.credit || 650) >= 670 ? 5 : Number(state.credit || 650) >= 650 ? 2 : -2,
    income: Number(state.ledger?.weekIncome || 0) > 0 || Number(state.plan?.income || 0) >= 360 ? 4 : 0,
    wants: state.plan && state.plan.unplannedWantUsedThisMonth ? -4 : 4
  };
  if(goal && Object.prototype.hasOwnProperty.call(goalHealthMap, goal.id)) score += Number(goalHealthMap[goal.id] || 0);
  score = Math.max(0, Math.min(100, Math.round(score)));
  let label = 'steady';
  if(score >= 85) label = 'excellent';
  else if(score >= 70) label = 'strong';
  else if(score >= 55) label = 'steady';
  else if(score >= 40) label = 'watch it';
  else label = 'danger';
  state.standardV1.healthScore = score;
  state.standardV1.healthLabel = label;
  return {score, label};
}
function getWeeklyGoalStatusText(){
  return getMonthlyGoalStatusText();
}
function renderStandardV1HUD(){
  ensureStandardV1State();
  const health = computeFinancialHealth();
  const goal = getCurrentWeeklyGoal();
  const echo = getChoiceEchoPreview();
  const identity = getIdentitySnapshot({ healthScore: health.score });
  if(document.getElementById('healthScore')) document.getElementById('healthScore').textContent = `${health.score}`;
  if(document.getElementById('healthLabel')) document.getElementById('healthLabel').textContent = health.label;
  if(document.getElementById('weeklyGoalBadge')) document.getElementById('weeklyGoalBadge').textContent = goal ? `${goal.emoji} ${goal.name}` : 'Pick focus';
  if(document.getElementById('consequenceBadge')) document.getElementById('consequenceBadge').textContent = echo.count ? `${echo.count} active` : '0 pending';
  if(document.getElementById('identityBadge')) document.getElementById('identityBadge').textContent = `${identity.emoji} ${identity.title}`;
  if(document.getElementById('impactHealth')) document.getElementById('impactHealth').textContent = `${health.score}/100 • ${health.label}`;
  if(document.getElementById('impactEchoes')) document.getElementById('impactEchoes').textContent = echo.text;
  if(document.getElementById('impactGoalStatus')) document.getElementById('impactGoalStatus').textContent = getMonthlyGoalStatusText();
  const focusProgress = getCurrentMonthFocusProgress();
  if(document.getElementById('impactFocusProgress')) document.getElementById('impactFocusProgress').textContent = `${focusProgress.score}% • ${focusProgress.label}`;
  if(document.getElementById('focusProgressDetail')) document.getElementById('focusProgressDetail').textContent = focusProgress.detail;
  if(document.getElementById('focusProgressFill')) document.getElementById('focusProgressFill').style.width = `${focusProgress.score}%`;
  if(document.getElementById('focusProgressFill')) document.getElementById('focusProgressFill').setAttribute('aria-valuenow', String(focusProgress.score));
  if(document.getElementById('impactIdentity')) document.getElementById('impactIdentity').textContent = `${identity.emoji} ${identity.title}`;
  renderEliteOverview();
}
function promptWeeklyGoalIfNeeded(onDone){
  ensureStandardV1State();
  if(!isStandardV1Experience() || !(state.mission && state.mission.active)){
    if(onDone) onDone();
    return;
  }
  const week = Number((state.weekEngine && state.weekEngine.week) || 1);
  const month = getCurrentFocusMonth();
  if(getCurrentWeeklyGoal()){
    if(onDone) onDone();
    return;
  }
  openHtmlModal({
    title:`🎯 ${weekToMonthName ? weekToMonthName(week) : `Month ${month}`} Focus`,
    meta:`Choose one focus for this month`,
    html:`<div style="font-weight:900;margin-bottom:10px">Choose a focus for this month. Your random events, coaching, and focus progress tracker will react to this choice.</div>
      <div class="choice-grid">${MONTHLY_FOCUS_BANK.map(g=>`<button class="choice-btn" data-weekly-goal="${g.id}">${g.emoji} ${g.name}<small>${g.desc}</small></button>`).join('')}</div>`,
    buttons:[],
    onRender:()=>{
      document.querySelectorAll('[data-weekly-goal]').forEach(btn=>{
        btn.onclick=()=>{
          beep('click');
          setWeeklyGoalForWeek(week, btn.dataset.weeklyGoal);
          closeHtmlModal();
          renderAll();
          if(onDone) onDone();
        };
      });
    }
  });
}
function queueConsequenceObject(item, sourceLabel=''){
  ensureStandardV1State();
  if(!state.weekEngine) initWeekEngine();
  const entry = Object.assign({}, item || {});
  entry.sourceWeek = Number((state.weekEngine && state.weekEngine.week) || 1);
  entry.sourceLabel = sourceLabel || entry.sourceLabel || '';
  state.weekEngine.pending.push(entry);
  const delta = entry.major ? 2 : (/bonus|reward|boost|milestone|discipline|goodwill|dividend/i.test(String(entry.label || '')) ? -1 : 1);
  registerPressureTrack(entry, delta);
  state.standardV1.choiceEchoLog.unshift({ week:entry.sourceWeek, triggerWeek:entry.triggerWeek, label:entry.label || 'Echo', sourceLabel:entry.sourceLabel || '' });
  state.standardV1.choiceEchoLog = state.standardV1.choiceEchoLog.slice(0, 18);
  maybeQueueConsequenceChain(entry.sourceWeek, entry.label || entry.sourceLabel || 'echo');
}

const SHARED_PROFILE_KEY = 'wgltSharedPlayerProfile';
function loadSharedProfile(){
  try{ const raw = localStorage.getItem(SHARED_PROFILE_KEY); return raw ? JSON.parse(raw) : null; }catch(err){ return null; }
}
function renderSharedProfileBadge(){
  const pill = document.getElementById('sharedProfilePill');
  const badge = document.getElementById('sharedProfileBadge');
  if(!pill || !badge) return;
  const profile = loadSharedProfile();
  if(profile && (profile.playerName || profile.avatar)){
    badge.textContent = `${profile.avatar || '🙂'} ${profile.playerName || profile.avatarName || 'Player'}`;
    pill.style.display = 'inline-flex';
  } else {
    pill.style.display = 'none';
  }
}

let decisionBadgeTimer = null;
function showDecisionBadge(text){
  const box = document.getElementById('decisionBadge');
  const label = document.getElementById('decisionBadgeText');
  if(!box || !label || !text) return;
  label.textContent = text;
  box.style.display = 'inline-flex';
  box.classList.add('show');
  clearTimeout(decisionBadgeTimer);
  decisionBadgeTimer = setTimeout(()=>{
    box.classList.remove('show');
    box.style.display = 'none';
  }, 2600);
}
function formatSourceLabel(src){
  if(src === 'cd') return 'CD';
  if(src === 'hysa') return 'HYSA';
  if(src === 'checking') return 'Checking';
  if(src === 'savings') return 'Savings';
  if(src === 'cash') return 'Cash';
  return src ? String(src).charAt(0).toUpperCase() + String(src).slice(1) : 'Selected Account';
}

const AUTO_REFLECTION_BANK = {
  spending: [
    { type: "spending", question: "Was this worth the money?" },
    { type: "spending", question: "Was that a need or a want?" },
    { type: "spending", question: "How did this choice affect your money?" },
    { type: "spending", question: "Would you make the same choice again?" },
    { type: "spending", question: "Did this help your future or just right now?" },
    { type: "spending", question: "What could you have done differently?" },
    { type: "spending", question: "Was this a smart money move? Why?" },
    { type: "spending", question: "Did you follow your plan or change it?" },
    { type: "spending", question: "How might this choice affect you later?" },
    { type: "spending", question: "Was this worth the money you spent?" }
  ],
  save: [
    { type: "save", question: "Did this help future you?" },
    { type: "save", question: "Did you save as much as you wanted?" },
    { type: "save", question: "How did saving change your money?" },
    { type: "save", question: "Was saving now a smart move?" },
    { type: "save", question: "Would you make this save choice again?" },
    { type: "save", question: "Did you stick to your plan?" }
  ],
  share: [
    { type: "share", question: "How did sharing affect your money?" },
    { type: "share", question: "Was helping worth it for your budget?" },
    { type: "share", question: "Did you help and still protect your plan?" },
    { type: "share", question: "Would you share the same way again?" },
    { type: "share", question: "Was this kind and smart?" }
  ],
  general: [
    { type: "general", question: "What was the best part of your decision?" },
    { type: "general", question: "Would you do anything differently next time?" },
    { type: "general", question: "Did this choice help now or later?" }
  ]
};

function ensureReflectionState(){
  if(!state.ui) state.ui = {};
  if(!state.ui.reflectionRotation) state.ui.reflectionRotation = {spending:0, save:0, share:0, general:0};
  if(!state.ui.reflectionShownByWeek) state.ui.reflectionShownByWeek = {};
}

function normalizeDecisionReflectionType(type){
  if(type === 'spend') return 'spending';
  if(type === 'saving') return 'save';
  return ['spending','save','share','general'].includes(type) ? type : 'general';
}

function getDecisionBenchmark(type){
  const map = {spending:'2', save:'3', share:'6', general:''};
  return map[normalizeDecisionReflectionType(type)] || '';
}

function getNextReflectionQuestion(type){
  ensureReflectionState();
  const normalized = normalizeDecisionReflectionType(type);
  const pool = AUTO_REFLECTION_BANK[normalized] || AUTO_REFLECTION_BANK.general;
  const idx = Number(state.ui.reflectionRotation[normalized] || 0) % pool.length;
  state.ui.reflectionRotation[normalized] = (idx + 1) % pool.length;
  return pool[idx];
}

function inferDecisionReflectionType(meta={}){
  const forced = normalizeDecisionReflectionType(meta.type || '');
  if(forced !== 'general') return forced;
  const blob = `${meta.title || ''} ${meta.label || ''} ${meta.summary || ''} ${meta.note || ''}`.toLowerCase();
  if(/\b(lend|loan|donate|gift|share|help(ed)?|friend|family|community|generous)\b/.test(blob)) return 'share';
  if(/\b(save|saving|savings|invest|invested|cd|hysa|goal|deposit to savings)\b/.test(blob)) return 'save';
  if(Number(meta.amount || 0) > 0 || /\b(spend|spent|buy|bought|pay|paid|cost|shopping|wants|gifts)\b/.test(blob)) return 'spending';
  return 'general';
}

function shouldAskDecisionReflection(meta={}){
  ensureReflectionState();
  if(state.ui && state.ui.suppressDecisionReflections) return false;
  const week = Number((state.weekEngine && state.weekEngine.week) || state.day || 1);
  const type = inferDecisionReflectionType(meta);
  const key = `${week}_${type}`;
  if(state.ui.reflectionShownByWeek[key]) return false;
  state.ui.reflectionShownByWeek[key] = true;
  return true;
}

function queueDecisionReflection(meta={}){
  if(!shouldAskDecisionReflection(meta)) return;
  const type = inferDecisionReflectionType(meta);
  const question = getNextReflectionQuestion(type);
  const week = Number((state.weekEngine && state.weekEngine.week) || state.day || 1);
  const monthName = typeof weekToMonthName === 'function' ? weekToMonthName(week) : '';
  const promptMeta = {
    ...meta,
    type,
    week,
    monthName,
    question: question.question
  };
  setTimeout(()=>openDecisionReflectionPrompt(promptMeta), 180);
}

function openDecisionReflectionPrompt(meta={}){
  const type = normalizeDecisionReflectionType(meta.type);
  const titleMap = {
    spending: "💸 Quick Money Check",
    save: "🪙 Quick Save Check",
    share: "🤝 Quick Share Check",
    general: "🧠 Quick Choice Check"
  };
  const introMap = {
    spending: "Quick thought after that money move:",
    save: "Quick thought after saving:",
    share: "Quick thought after helping or sharing:",
    general: "Quick thought after that choice:"
  };
  const html = `
    <div style="display:grid;gap:10px">
      <div style="background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:14px;padding:12px">
        <div style="font-weight:900;font-size:12px;opacity:.85">${introMap[type] || introMap.general}</div>
        <div style="font-weight:900;font-size:20px;line-height:1.25;margin-top:6px">${escapeHtml(meta.question || "What was the best part of your decision?")}</div>
      </div>
      <label style="font-weight:900;font-size:12px">Student answer
        <input id="quickReflectionStudent" maxlength="140" style="width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:12px" placeholder="Short answer here">
      </label>
      <label style="font-weight:900;font-size:12px">Teacher Mode tracker
        <input id="quickReflectionTeacher" maxlength="160" style="width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:12px" placeholder="What would you tell a friend to do here?">
      </label>
      <div class="muted" style="font-size:12px">Tag: ${escapeHtml(type.charAt(0).toUpperCase() + type.slice(1))}${meta.amount ? ` • Amount: ${escapeHtml(money(Number(meta.amount || 0)))}` : ''}</div>
    </div>
  `;
  openHtmlModal({
    title: titleMap[type] || titleMap.general,
    meta: `Week ${meta.week || 1}${meta.monthName ? ` • ${meta.monthName}` : ''}`,
    html,
    buttons: [
      {label:"Skip", kind:"secondary", onClick: closeHtmlModal},
      {label:"Save Reflection", kind:"success", onClick: ()=>saveQuickDecisionReflection(meta)}
    ]
  });
}

function saveQuickDecisionReflection(meta={}){
  const studentAnswer = ($("quickReflectionStudent")?.value || "").trim();
  const teacherAnswer = ($("quickReflectionTeacher")?.value || "").trim();
  const type = normalizeDecisionReflectionType(meta.type);
  const reflection = {
    id: `refl_auto_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    week: meta.week || (state.weekEngine ? state.weekEngine.week : 1),
    month: meta.monthName || (typeof weekToMonthName === "function" ? weekToMonthName(state.weekEngine ? state.weekEngine.week : 1) : ""),
    createdAt: new Date().toISOString(),
    title: meta.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Reflection`,
    coverageType: 'auto',
    benchmark: getDecisionBenchmark(type),
    notes: meta.label || meta.summary || meta.note || '',
    q1: meta.question || '',
    q2: studentAnswer || "Skipped by student",
    q3: teacherAnswer || "No teacher note",
    q4: meta.summary || '',
    decisionType: type
  };
  teacherReflections.unshift(reflection);
  closeHtmlModal();
  renderReflectionReport(true);
  scheduleAutoSave(100);
  showBanner("Reflection saved");
}

/* ============================================================
   INLINED WIX-FRIENDLY MASTER DATA
   This keeps the simulator single-file for Wix HTML embed use.
   The existing simulator can keep running, and the full 48-week
   data blueprint is now available in this same file for future
   scenario-engine upgrades.
   ============================================================ */



window.WGLT_MASTER_DATA = WGLT_MASTER_DATA;

function getMasterWeekData(week){
  if(!window.WGLT_MASTER_DATA || !Array.isArray(WGLT_MASTER_DATA.weeks)) return null;
  return WGLT_MASTER_DATA.weeks.find(w => w.week === week) || null;
}

function getMasterRandomScenarioForWeek(week){
  const wk = getMasterWeekData(week);
  if(!wk || !Array.isArray(wk.scenarios) || !wk.scenarios.length) return null;
  const locked = state && state.weekEngine && state.weekEngine.masterScenarioLocks
    ? state.weekEngine.masterScenarioLocks[week]
    : null;
  if(locked){
    return wk.scenarios.find(s => s.id === locked) || wk.scenarios[0];
  }
  const picked = wk.scenarios[Math.floor(Math.random() * wk.scenarios.length)];
  if(state && state.weekEngine){
    if(!state.weekEngine.masterScenarioLocks) state.weekEngine.masterScenarioLocks = {};
    state.weekEngine.masterScenarioLocks[week] = picked.id;
  }
  return picked;
}

function describeMasterWeek(week){
  const wk = getMasterWeekData(week);
  if(!wk) return null;
  const picked = getMasterRandomScenarioForWeek(week);
  return {
    week: wk.week,
    learningGoal: wk.learningGoal,
    scenarioTitle: picked ? picked.title : null,
    choiceLabels: picked ? picked.choices.map(c => c.label) : []
  };
}


function ensureMasterScenarioState(){
  if(!state.masterScenario) state.masterScenario = { played:{}, trackCounts:{}, firedWindows:{} };
  if(!state.masterScenario.played) state.masterScenario.played = {};
  if(!state.masterScenario.trackCounts) state.masterScenario.trackCounts = {};
  if(!state.masterScenario.firedWindows) state.masterScenario.firedWindows = {};
}

function applyMasterScenarioChoice(choice, scenario, week, options={}){
  ensureMasterScenarioState();
  const lines = [];
  const moneyDelta = Number(choice.moneyDelta || 0);
  const savingsDelta = Number(choice.savingsDelta || 0);
  const stressDelta = Number(choice.stressDelta || 0);
  const wantsDelta = Number(choice.wantsDelta || 0);
  const needsDelta = Number(choice.needsDelta || 0);
  const skipMoneySpend = !!options.skipMoneySpend;

  if(moneyDelta > 0){
    state.cash += moneyDelta;
    lines.push(`Cash ${money(moneyDelta)}`);
  } else if(moneyDelta < 0){
    if(!skipMoneySpend) payFromCheckingThenCashThenSavings(Math.abs(moneyDelta));
    lines.push(`Spent ${money(Math.abs(moneyDelta))}`);
  }

  if(savingsDelta > 0){
    state.bank.savings += savingsDelta;
    lines.push(`Savings +${money(savingsDelta)}`);
  } else if(savingsDelta < 0){
    const cut = Math.min(state.bank.savings, Math.abs(savingsDelta));
    state.bank.savings -= cut;
    lines.push(`Savings -${money(cut)}`);
  }

  state.masterScenario.stress = (state.masterScenario.stress || 0) + stressDelta;
  state.masterScenario.wantsPressure = (state.masterScenario.wantsPressure || 0) + wantsDelta;
  state.masterScenario.needsPressure = (state.masterScenario.needsPressure || 0) + needsDelta;

  if(choice.flags){
    Object.keys(choice.flags).forEach(flag=>{
      state.masterScenario.trackCounts[flag] = (state.masterScenario.trackCounts[flag] || 0) + Number(choice.flags[flag] || 1);
    });
  }

  state.masterScenario.played[week] = scenario.id;
  addLedgerLine(`Week ${week} life scenario: ${scenario.title} → ${choice.label}`);
  if(choice.trackTouched) lines.push(`Track: ${choice.trackTouched}`);
  if(choice.summary) lines.push(choice.summary);
  renderHeader();
  renderSheet();
  return lines.join(' • ');
}

function maybeFireMasterDelayedConsequences(week){
  ensureMasterScenarioState();
  const tracks = (window.WGLT_MASTER_DATA && WGLT_MASTER_DATA.delayedConsequenceTracks) || [];
  const due = [];
  tracks.forEach(track=>{
    if(!(track.triggerWindows || []).includes(week)) return;
    const key = `${track.id}_${week}`;
    if(state.masterScenario.firedWindows[key]) return;
    const count = Number(state.masterScenario.trackCounts[track.id] || 0);
    if(count <= 0) return;
    state.masterScenario.firedWindows[key] = true;
    let body = '';
    if(count >= 3){
      payFromCheckingThenCashThenSavings(10);
      body = `${track.label} caught up this week. Repeated choices earlier in the year created pressure now. Cost: ${money(10)}.`;
    } else if(count === 2){
      state.bank.savings += 5;
      body = `${track.label} is showing up. You adjusted in time and protected part of your plan. Savings +${money(5)}.`;
    } else {
      state.credit = clamp(state.credit + 2, 300, 850);
      body = `${track.label} showed a small echo from earlier weeks. Because the habit stayed manageable, you handled it well. Credit +2.`;
    }
    due.push({ title: track.label, body });
  });
  if(!due.length) return;
  let idx = 0;
  function showNext(){
    const item = due[idx++];
    if(!item){ renderAll(); return; }
    openModal({
      title:`⚡ Delayed Consequence`,
      meta:`Week ${week} • Cause and effect check`,
      body:`${item.title}

${item.body}`,
      buttons:[{id:'ok',label:'Got it',kind:'primary'}],
      onPick:showNext
    });
  }
  showNext();
}

function runLifeScenarioDecision(){
  const week = state.weekEngine ? state.weekEngine.week : 1;
  const wk = getMasterWeekData(week);
  const picked = getMasterRandomScenarioForWeek(week);
  if(!wk || !picked){
    showBanner('No life scenario loaded for this week.');
    return;
  }
  openModal({
    title:`📘 Week ${week} Life Scenario`,
    meta:`${wk.learningGoal} • ${picked.title}`,
    body:`${picked.prompt}`,
    buttons: picked.choices.map((choice, idx)=>({ id:String(idx), label:choice.label, kind: idx===0 ? 'primary' : (idx===1 ? 'secondary' : 'warn') })),
    onPick:(pickId)=>{
      const choice = picked.choices[Number(pickId)];
      if(!choice) return;
      const finishChoice = (skipMoneySpend=false, srcLabel='')=>{
        const summary = applyMasterScenarioChoice(choice, picked, week, {skipMoneySpend});
        openModal({
          title:'Life Scenario Result',
          meta:`Week ${week} • ${picked.title}`,
          body: (summary || choice.summary || 'Choice applied.') + (srcLabel ? `

Source used: ${srcLabel}` : ''),
          buttons:[{id:'ok',label:'Continue',kind:'primary'}],
          onPick:()=>{
            queueDecisionReflection({ title: picked.title, label: choice.label, summary, amount: Math.abs(Number(choice.moneyDelta || 0)) });
            maybeFireMasterDelayedConsequences(week);
            notifyAction('job_event');
          }
        });
      };
      if(Number(choice.moneyDelta || 0) < 0){
        const amt = Math.abs(Number(choice.moneyDelta || 0));
        chooseFundingSource(amt, `Life scenario choice: ${choice.label}`, (src)=> finishChoice(true, src));
        return;
      }
      finishChoice(false, '');
    }
  });
}

function runFinancialDecision(){
  const useSchool = Math.random() < 0.5;
  if(useSchool) return runSchoolDecision();
  return runSocialDecision();
}



/* ============================================================
   48-WEEK CHOICE ENGINE
   June (week 1) → May (week 48)
   Each week: 1 guaranteed scenario + ~37% chance of bonus
   Delayed consequences queue fires on nextWeek()
   ============================================================ */

/* ── Calendar helpers ────────────────────────────────────── */


function weekToMonth(w){ return (WEEK_CALENDAR[w]||WEEK_CALENDAR[48]).m; }
function weekToMonthName(w){ return (WEEK_CALENDAR[w]||WEEK_CALENDAR[48]).name; }

/* ── Scenario consequence helpers ───────────────────────── */
/* Each consequence: { triggerWeek, id, label, apply(state) } */
/* apply() returns a summary string for the modal/log       */

function queueConsequence(triggerWeek, id, label, applyFn){
  queueConsequenceObject({ triggerWeek, id, label, apply: applyFn });
}

function fireDueConsequences(currentWeek){
  const due = state.weekEngine.pending.filter(c => c.triggerWeek === currentWeek);
  state.weekEngine.pending = state.weekEngine.pending.filter(c => c.triggerWeek !== currentWeek);
  if(!due.length) return;

  const major = due.filter(c => c.major);
  const minor = due.filter(c => !c.major);

  // Minor consequences → ledger log only
  minor.forEach(c => {
    const msg = c.apply(state);
    if(/bonus|reward|boost|milestone|discipline|goodwill|dividend/i.test(String(c.label || ''))) registerPressureTrack(c, -1);
    else registerPressureTrack(c, 1);
    addLedgerLine(`↩ ${c.label}: ${msg}`);
    renderHeader();
  });

  // Major consequences → modal one at a time
  if(major.length){
    showBanner(`Choice Echoes arrived for Week ${currentWeek}`);
    let idx = 0;
    function showNext(){
      if(idx >= major.length){
        maybeQueueConsequenceChain(currentWeek, major.map(c=>c.label).join(', '));
        renderAll();
        return;
      }
      const c = major[idx++];
      const msg = c.apply(state);
      registerPressureTrack(c, 1);
      renderHeader();
      if(!state.standardV1.bigConsequenceLog) state.standardV1.bigConsequenceLog = [];
      state.standardV1.bigConsequenceLog.push({ week: currentWeek, label: c.label, message: msg });
      openModal({
        title:`⚠️ This decision is catching up to you…`,
        meta:`Week ${currentWeek} • ${c.label}`,
        body: `${msg}

Takeaway: earlier choices can echo forward and change what this week feels like.`,
        buttons:[{id:"ok",label:"Got it",kind:"primary"}],
        onPick: showNext
      });
    }
    showNext();
  } else {
    maybeQueueConsequenceChain(currentWeek, minor.map(c=>c.label).join(', '));
    renderAll();
  }
}

/* ── Scenario choice modal builder ─────────────────────── */
function inferScenarioFunding(opt, job){
  if(!opt || !opt.apply) return null;
  try{
    const src = opt.apply.toString();
    const patterns = [
      { kind:'cash', re:/st\.cash\s*=\s*Math\.max\(0\s*,\s*st\.cash\s*-\s*(\d+)\s*\)/ },
      { kind:'cash', re:/st\.cash\s*-=\s*(\d+)/ },
      { kind:'checking', re:/st\.bank\.checking\s*=\s*Math\.max\(0\s*,\s*st\.bank\.checking\s*-\s*(\d+)\s*\)/ },
      { kind:'checking', re:/st\.bank\.checking\s*-=\s*(\d+)/ },
      { kind:'savings', re:/st\.bank\.savings\s*=\s*Math\.max\(0\s*,\s*st\.bank\.savings\s*-\s*(\d+)\s*\)/ },
      { kind:'savings', re:/st\.bank\.savings\s*-=\s*(\d+)/ },
      { kind:'pay_chain', re:/payFromCheckingThenCashThenSavings\((\d+)\)/ }
    ];
    for(const p of patterns){
      const m = src.match(p.re);
      if(m) return { amount:Number(m[1]), originalSource:p.kind, inferred:true };
    }
    const constAmt = src.match(/const\s+amt\s*=\s*(\d+)\s*;/);
    if(constAmt){
      const amt = Number(constAmt[1]);
      if(/st\.cash\s*=\s*Math\.max\(0\s*,\s*st\.cash\s*-\s*amt\s*\)|st\.cash\s*-=\s*amt/.test(src)) return { amount:amt, originalSource:'cash', inferred:true };
      if(/st\.bank\.checking\s*=\s*Math\.max\(0\s*,\s*st\.bank\.checking\s*-\s*amt\s*\)|st\.bank\.checking\s*-=\s*amt/.test(src)) return { amount:amt, originalSource:'checking', inferred:true };
      if(/st\.bank\.savings\s*=\s*Math\.max\(0\s*,\s*st\.bank\.savings\s*-\s*amt\s*\)|st\.bank\.savings\s*-=\s*amt/.test(src)) return { amount:amt, originalSource:'savings', inferred:true };
      if(/addToHysa\(amt/.test(src) || /createCD\([^)]*amt/.test(src)) return { amount:amt, originalSource:'invest_only', inferred:true };
    }
    const investAmt = src.match(/addToHysa\((\d+)/);
    if(investAmt) return { amount:Number(investAmt[1]), originalSource:/st\.bank\.checking\s*=|st\.bank\.checking\s*-=/ .test(src) ? 'checking' : (/st\.cash\s*=|st\.cash\s*-=/.test(src) ? 'cash' : 'invest_only'), inferred:true };
    const cdAmt = src.match(/createCD\([^,]+,\s*(\d+)/);
    if(cdAmt) return { amount:Number(cdAmt[1]), originalSource:'invest_only', inferred:true };
  }catch(err){}
  return null;
}

function runApplyWithFundingOverride(applyFn, paymentInfo, job){
  if(!paymentInfo || !paymentInfo.amount || !paymentInfo.originalSource) return applyFn(state, job);
  if(paymentInfo.originalSource === 'invest_only') return applyFn(state, job);
  if(paymentInfo.originalSource === 'pay_chain'){
    const originalSpendFn = payFromCheckingThenCashThenSavings;
    let spendSkipped = false;
    payFromCheckingThenCashThenSavings = function(amount){
      if(!spendSkipped && Number(amount) === Number(paymentInfo.amount)){
        spendSkipped = true;
        return;
      }
      return originalSpendFn(amount);
    };
    try{
      return applyFn(state, job);
    } finally {
      payFromCheckingThenCashThenSavings = originalSpendFn;
    }
  }
  let skipped = false;
  const targetSource = paymentInfo.originalSource;
  const targetAmount = Number(paymentInfo.amount);
  const bankProxy = new Proxy(state.bank, {
    get(target, prop){ return target[prop]; },
    set(target, prop, value){
      if(!skipped && prop === targetSource){
        const current = Number(target[prop] || 0);
        const numericValue = Number(value);
        const expected = Math.max(0, current - targetAmount);
        if(Number.isFinite(numericValue) && numericValue === expected){
          skipped = true;
          return true;
        }
      }
      target[prop] = value;
      return true;
    }
  });
  const stateProxy = new Proxy(state, {
    get(target, prop){
      if(prop === 'bank') return bankProxy;
      return target[prop];
    },
    set(target, prop, value){
      if(!skipped && prop === targetSource){
        const current = Number(target[prop] || 0);
        const numericValue = Number(value);
        const expected = Math.max(0, current - targetAmount);
        if(Number.isFinite(numericValue) && numericValue === expected){
          skipped = true;
          return true;
        }
      }
      target[prop] = value;
      return true;
    }
  });
  return applyFn(stateProxy, job);
}


function openScenarioModal(scenario, onDone){
  const job = state.jobs[state.jobIndex];
  const title = scenario.title(job);
  const body  = scenario.body(job);
  const opts  = scenario.options(job, state);

  const displayWeek = scenario.week || state.weekEngine.week;
  const displayMonth = weekToMonthName(displayWeek);

  $("mTitle").textContent = `📅 Week ${displayWeek} • ${displayMonth}`;
  $("mMeta").textContent  = title;
  $("mBody").innerHTML    = `<div style="font-weight:900;margin-bottom:12px">${body}</div><div class="choice-grid" id="scenChoiceGrid"></div>`;

  const grid = document.getElementById("scenChoiceGrid");

  function finalizeChoice(opt, choiceIndex, summary, paymentInfo){
    if(summary){
      const suffix = paymentInfo && paymentInfo.source ? ` (from ${paymentInfo.source})` : '';
      addLedgerLine(`✏ ${title}: ${summary}${suffix}`);
    }
    if(opt.consequences){
      opt.consequences.forEach(c => queueConsequenceObject(Object.assign({}, c), title));
    }
    if(scenario.id) state.weekEngine.choices[scenario.id] = choiceIndex;
    renderHeader();
    renderLedger();
    renderSheet();
    renderTeacherToolkit();
    updateImpactStrip();
    if(!opt.skipReflection){
      queueDecisionReflection({
        title,
        label: opt.label,
        summary,
        amount: paymentInfo && paymentInfo.amount ? paymentInfo.amount : 0
      });
    }
    if(onDone) onDone();
  }

  opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.innerHTML = `${opt.label}<small>${opt.hint || ""}</small>`;
    btn.onclick = () => {
      beep("click");

      if(typeof opt.onSelect === "function"){
        closeModal();
        opt.onSelect({
          state,
          job,
          scenario,
          complete:(summary, extra={})=>{
            if(extra.banner) showBanner(extra.banner);
            if(extra.badge) showDecisionBadge(extra.badge);
            finalizeChoice(opt, i, summary, extra.paymentInfo || extra);
          }
        });
        return;
      }

      const resolvedCost = typeof opt.cost === "function" ? opt.cost(job) : opt.cost;
      const inferredFunding = (!resolvedCost || resolvedCost <= 0) ? inferScenarioFunding(opt, job) : null;
      const paymentAmount = (resolvedCost && resolvedCost > 0) ? resolvedCost : (inferredFunding ? inferredFunding.amount : 0);

      if(paymentAmount && paymentAmount > 0){
        closeModal();
        setTimeout(()=>{
          chooseFundingSource(paymentAmount, `${opt.label}

Choose which account to pay from:`, (src)=>{
            let summary;
            if(opt.applyAfterFunding){
              summary = opt.applyAfterFunding(state, job, src);
            }else if(inferredFunding){
              summary = runApplyWithFundingOverride(opt.apply, inferredFunding, job);
            }else{
              summary = opt.apply(state, job);
            }
            showDecisionBadge(`Paid from ${formatSourceLabel(src)}: ${money(paymentAmount)}`);
            finalizeChoice(opt, i, summary, {source:src, amount:paymentAmount});
          });
        }, 50);
      } else {
        closeModal();
        const summary = opt.apply(state, job);
        finalizeChoice(opt, i, summary, {amount: resolvedCost || 0});
      }
    };
    grid.appendChild(btn);
  });

  $("mFoot").innerHTML = '<button class="btn secondary" id="mCancel">Skip</button>';
  $("mCancel").onclick = () => { beep("warn"); closeModal(); if(onDone) onDone(); };
  $("overlay").classList.add("show");
  $("overlay").setAttribute("aria-hidden","false");
}

/* ── End-of-week summary/* ── End-of-week summary ─────────────────────────────────── */
function showWeekSummary(week, onDone){
  const echoes = state.weekEngine.pending.filter(c => c.triggerWeek <= week + 6 && c.triggerWeek > week);
  const lines = [];
  if(echoes.length){
    lines.push("⚠️ Choices you made are still in play:");
    echoes.forEach(c => lines.push(`  • ${c.label} (arrives Week ${c.triggerWeek})`));
  }
  const hotTracks = Object.entries((state.masterScenario && state.masterScenario.trackCounts) || {}).filter(([,v])=>Number(v||0) >= 2).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)).slice(0,2);
  if(hotTracks.length){
    lines.push("");
    lines.push("🧠 Pattern pressure is building:");
    hotTracks.forEach(([k,v])=>lines.push(`  • ${k} track at x${v} — protect your next few choices.`));
  }
  const cal = WEEK_CALENDAR[week] || WEEK_CALENDAR[48];
  const nextCal = WEEK_CALENDAR[Math.min(week+1,48)] || WEEK_CALENDAR[48];
  const monthChange = nextCal.m !== cal.m;

  if(!lines.length && !monthChange){
    if(onDone) onDone();
    return;
  }

  let body = "";
  if(monthChange) body += `📅 Entering ${nextCal.name}!\n\n`;
  if(lines.length) body += lines.join("\n");

  openModal({
    title: `Week ${week} Complete`,
    meta: `${cal.name} → ${nextCal.name || cal.name}`,
    body: body.trim() || "Another week done. Keep building!",
    buttons:[{id:"ok",label:"Next Week ▶",kind:"primary"}],
    onPick: onDone
  });
}

/* ── 48-WEEK SCENARIO DECK ──────────────────────────────── */
/* Format:
   id          – unique key (used for conditional bonus triggers)
   week        – which week this fires (1-48)
   bonus       – true = only fires if trigger condition met or ~37% random
   triggerIf   – optional fn(choices) => bool for conditional bonus
   category    – flavor tag
   title(job)  – fn returning string
   body(job)   – fn returning string
   options(job,state) – fn returning array of {label,hint,apply(state,job),consequences:[]}
   Each consequence: { triggerWeek, id, label, major, apply(state) }
*/

const WEEKLY_SCENARIOS = [

/* ══ WEEK 1 – June, first week of summer ══ */
{
  id:"w1_main", week:1, bonus:false, category:"daily",
  title: j => `First Week of Summer — ${j.name}`,
  body:  j => `It's June and you just landed your ${j.name} job. Your first paycheck is coming Friday. A friend wants you to go out tonight and spend $15. Do you go?`,
  options: (j,s) => [
    { label:"Go out — YOLO it's summer!",  hint:"-$15 from cash • fun energy",
      apply: (st) => { st.cash = Math.max(0, st.cash - 15); st.ledger.weekExpenses += 15; addLedgerLine("Week 1: Went out opening night -$15"); return "-$15 cash, great energy boost"; },
      consequences:[{ triggerWeek:3, id:"c_w1_a", label:"Summer Energy Boost", major:false,
        apply:(st) => { st.bank.checking += 5; addLedgerLine("↩ Good energy from week 1 — client tipped extra +$5"); return "+$5 tip from happy client"; } }]
    },
    { label:"Stay in — save the money",  hint:"Keep $15 • steady start",
      apply: (st) => { addLedgerLine("Week 1: Stayed in, saved $15"); return "Saved $15 — solid first move"; },
      consequences:[{ triggerWeek:4, id:"c_w1_b", label:"Discipline Dividend", major:false,
        apply:(st) => { st.bank.savings += 8; addLedgerLine("↩ Week 1 discipline paid off — savings bonus +$8"); return "+$8 savings bonus"; } }]
    },
    { label:"Compromise — grab a $5 snack",  hint:"-$5 • balanced choice",
      apply: (st) => { st.cash = Math.max(0, st.cash - 5); st.ledger.weekExpenses += 5; addLedgerLine("Week 1: $5 snack compromise"); return "-$5 cash, good balance"; }
    }
  ]
},
/* Week 1 bonus — no trigger, pure random 37% */
{
  id:"w1_bonus", week:1, bonus:true, category:"banking",
  title: j => "Open a Bank Account?",
  body:  j => "Your mom says you should open a student checking account before your first paycheck hits. It takes 20 minutes but saves you check-cashing fees. Do you do it now or wait?",
  options: (j,s) => [
    { label:"Do it now", hint:"+$5 fee avoided later",
      apply: (st) => { st.credit = Math.min(850, st.credit + 3); addLedgerLine("Week 1 bonus: Opened bank account early — credit +3"); return "Credit +3, set for direct deposit"; },
      consequences:[{ triggerWeek:5, id:"c_w1bank", label:"No Check-Cashing Fee", major:false,
        apply:(st) => { st.cash += 5; addLedgerLine("↩ No check-cashing fee — saved $5"); return "+$5 saved on fees"; } }]
    },
    { label:"Wait until next week", hint:"No change now",
      apply: (st) => { addLedgerLine("Week 1 bonus: Delayed bank account"); return "No change yet"; },
      consequences:[{ triggerWeek:3, id:"c_w1bank_late", label:"Check Cashing Fee", major:false,
        apply:(st) => { st.cash = Math.max(0,st.cash-5); addLedgerLine("↩ Had to pay $5 check-cashing fee"); return "-$5 check-cashing fee"; } }]
    }
  ]
},

/* ══ WEEK 2 ══ */
{
  id:"w2_main", week:2, bonus:false, category:"ledger",
  title: j => `${j.name}: Supply Decision`,
  body:  j => {
    const map = { lawn:"Your mower ran low on gas before your Saturday clients.", pet:"You're running low on pet treats before weekend visits.", babysitting:"You promised craft activities but forgot supplies.", dogwalk:"Rain is forecast — you need a poncho for dog walks.", cars:"You're almost out of car soap right before a big Saturday.", tutor:"You need new flash cards for a student's exam this week.", chores:"Your cleaning spray is almost gone before a big house job.", errands:"Your bus pass only has one ride left for a busy week.", crafts:"You're low on craft materials before a weekend market." };
    return (map[j.id] || map.lawn) + " Do you buy supplies now or improvise?";
  },
  options: (j,s) => {
    const costMap = {lawn:12,pet:10,babysitting:10,dogwalk:6,cars:9,tutor:7,chores:5,errands:4,crafts:12};
    const itemMap = {lawn:"gas",pet:"petfood",babysitting:"snacks",dogwalk:"poncho",cars:"soap",tutor:"cards",chores:"spray",errands:"fare",crafts:"materials"};
    const cost = costMap[j.id]||8;
    const itemId = itemMap[j.id]||"gas";
    return [
      { label:"Buy supplies now", hint:`-$${cost} • adds to inventory`, cost,
        applyAfterFunding: (st,j) => {
          setInvQty(itemId, invQty(itemId)+1);
          st.ledger.weekExpenses += cost;
          recalcProfit();
          const invVal = calcInventoryValue();
          addLedgerLine(`Week 2: Bought ${j.name} supplies -$${cost} | Inv. value: ${money(invVal)}`);
          renderHeader();
          renderLedger();
          return `-$${cost}, added to inventory`;
        },
        apply: (st,j) => {
          setInvQty(itemId, invQty(itemId)+1);
          st.ledger.weekExpenses += cost;
          st.cash = Math.max(0,st.cash-cost);
          recalcProfit();
          const invVal = calcInventoryValue();
          addLedgerLine(`Week 2: Bought ${j.name} supplies -$${cost} | Inv. value: ${money(invVal)}`);
          renderHeader();
          renderLedger();
          return `-$${cost}, added to inventory`;
        },
        consequences:[{ triggerWeek:6, id:"c_w2_supplies", label:"Well-Stocked Worker", major:false,
          apply:(st) => { st.bank.checking += 10; addLedgerLine("↩ Stocked supplies paid off — client booked again +$10"); return "+$10 repeat client booking"; } }]
      },
      { label:"Improvise this week", hint:"No cost now, risk later",
        apply: (st) => { addLedgerLine("Week 2: Improvised without supplies"); return "No cost now"; },
        consequences:[{ triggerWeek:4, id:"c_w2_noBuy", label:"Supply Shortage", major:true,
          apply:(st) => { const c=15; st.bank.checking = Math.max(0,st.bank.checking-c); addLedgerLine(`↩ Week 2 improvise backfired — rush supply cost -$${c}`); return `You ran out of supplies mid-job. Rush cost -$${c} from checking.`; } }]
      }
    ];
  }
},

/* ══ WEEK 3 ══ */
{
  id:"w3_main", week:3, bonus:false, category:"daily",
  title: j => "Forgot Your Lunch",
  body:  j => "You forgot lunch today. You have three options. What do you do?",
  options: (j,s) => [
    { label:"Buy school lunch — $4", hint:"-$4 • full energy", cost:4,
      applyAfterFunding: (st) => { st.ledger.weekExpenses += 4; addLedgerLine("Week 3: Bought school lunch -$4"); return "-$4, full energy"; },
      apply: (st) => { st.cash = Math.max(0, st.cash-4); st.ledger.weekExpenses += 4; addLedgerLine("Week 3: Bought school lunch -$4"); return "-$4, full energy"; },
      consequences:[{ triggerWeek:4, id:"c_lunch_buy", label:"Good Energy at Work", major:false,
        apply:(st) => { st.bank.checking += 5; addLedgerLine("↩ Ate well → strong work week → tip +$5"); return "+$5 tip from energy boost"; } }]
    },
    { label:"Skip lunch — save the $", hint:"No cost • tired later",
      apply: (st) => { addLedgerLine("Week 3: Skipped lunch"); return "Saved money but energy dipped"; },
      consequences:[{ triggerWeek:4, id:"c_lunch_skip", label:"Low Energy Tax", major:false,
        apply:(st) => { st.ledger.weekExpenses += 5; st.bank.checking = Math.max(0,st.bank.checking-5); addLedgerLine("↩ Skipped lunch → tired → made mistake at work -$5"); return "Low energy cost -$5 from checking"; } }]
    },
    { label:"Grab a vending snack — $2", hint:"-$2 • partial energy", cost:2,
      applyAfterFunding: (st) => { st.ledger.weekExpenses += 2; addLedgerLine("Week 3: Vending snack -$2"); return "-$2, okay energy"; },
      apply: (st) => { st.cash = Math.max(0, st.cash-2); st.ledger.weekExpenses += 2; addLedgerLine("Week 3: Vending snack -$2"); return "-$2 cash, okay energy"; }
    }
  ]
},
{
  id:"w3_bonus", week:3, bonus:true, category:"contract",
  title: j => {
    if(!state.randomRun) state.randomRun = {};
    if(!state.randomRun.contractOfferId) state.randomRun.contractOfferId = pickRandomContractId();
    const c = getContractById(state.randomRun.contractOfferId);
    return `${c.name} Offer`;
  },
  body:  j => {
    if(!state.randomRun) state.randomRun = {};
    if(!state.randomRun.contractOfferId) state.randomRun.contractOfferId = pickRandomContractId();
    const c = getContractById(state.randomRun.contractOfferId);
    return `A company is offering you a ${c.name.toLowerCase()} for ${money(c.monthly)}/month. Read the fine print.

Auto-renew: ${c.autoRenew ? "Yes" : "No"}
Cancellation fee: ${money(c.cancelFee)}

${c.disclosure}`;
  },
  options: (j,s) => {
    if(!state.randomRun) state.randomRun = {};
    if(!state.randomRun.contractOfferId) state.randomRun.contractOfferId = pickRandomContractId();
    const c = getContractById(state.randomRun.contractOfferId);
    return [
      { label:`Accept ${c.name}`, hint:`-${money(c.monthly)} now`, cost:c.monthly,
        applyAfterFunding: (st) => {
          st.contractActive = true;
          st.contractId = c.id;
          addCoverage(10);
          addCoverage(13);
          return `${c.name} accepted at ${money(c.monthly)}/month`;
        },
        apply: (st) => {
          st.contractActive = true;
          st.contractId = c.id;
          st.bank.checking = Math.max(0,st.bank.checking-c.monthly);
          addCoverage(10);
          addCoverage(13);
          return `${c.name} accepted at ${money(c.monthly)}/month`;
        },
        consequences:[{ triggerWeek:19, id:"c_contract_renew", label:`${c.name} Auto-Renewal`, major:true,
          apply:(st) => {
            if(!st.contractActive || st.contractId !== c.id) return `No active ${c.name} renewed.`;
            st.bank.checking = Math.max(0,st.bank.checking-c.monthly);
            return `Your ${c.name} auto-renewed later in the year. -${money(c.monthly)} from checking.`;
          } }]
      },
      { label:"Decline the offer", hint:"No change now",
        apply: (st) => { addCoverage(10); return `No contract change`; }
      },
      { label:"Research more first", hint:"Delay the decision",
        apply: (st) => "Delayed decision"
      }
    ];
  }
},

/* ══ WEEK 4 — paycheck prompt replaces old "First Paycheck Decision" ══ */
/* (Paycheck investment popup fires automatically from nextWeek on month boundary) */
{
  id:"w4_pizza_social", week:4, bonus:true, triggerIf: ()=>true, category:"daily",
  title: j => "🍕 Friends Want Pizza Tonight",
  body:  j => {
    const hasPizza = hasWantInInventory("pizza");
    if(hasPizza){
      return `Your friends are heading out for pizza tonight. You budgeted for Pizza Night this month — it's already in your wants!\n\nSince it's in your budget, you can go without spending extra!`;
    } else {
      return `Your friends are heading out for pizza tonight. Pizza Night costs about $18.\n\nYou didn't budget for pizza this month, so if you go, it's coming out of checking or cash!`;
    }
  },
  options: (j,s) => {
    const hasPizza = hasWantInInventory("pizza");
    if(hasPizza){
      return [
        { label:"Go — it's already in my budget! 🍕", hint:"No extra cost — budgeted!",
          apply:(st)=>{ useWantFromInventory("pizza"); addLedgerLine("Pizza night: used from wants budget — no extra cost!"); addCoverage(12); return "Pizza with friends — budgeted! No extra cost"; }
        },
        { label:"Skip tonight — save the slot for later", hint:"Keep your pizza budget for another time",
          apply:(st)=>{ addLedgerLine("Pizza night: skipped — keeping wants for later"); return "Saved the pizza slot for another time"; }
        }
      ];
    } else {
      return [
        { label:"Go anyway — pay $18 from checking", hint:"-$18 checking (not budgeted)",
          apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-18); st.ledger.weekExpenses+=18; markUnplannedWantUsed("Pizza Night"); addLedgerLine("Pizza night: paid $18 unbudgeted — from checking"); addCoverage(12); return "-$18 checking (over budget)"; }
        },
        { label:"Go — pay $18 from cash", hint:"-$18 cash (not budgeted)",
          apply:(st)=>{ st.cash=Math.max(0,st.cash-18); st.ledger.weekExpenses+=18; markUnplannedWantUsed("Pizza Night"); addLedgerLine("Pizza night: paid $18 unbudgeted — from cash"); return "-$18 cash (over budget)"; }
        },
        { label:"Skip — not in the budget", hint:"No cost, friends understand",
          apply:(st)=>{ addLedgerLine("Pizza night: skipped — not in budget"); return "Skipped pizza — budget discipline!"; },
          consequences:[{ triggerWeek:6, id:"c_skip_pizza", label:"Budget Discipline", major:false,
            apply:(st)=>{ st.bank.savings+=5; addLedgerLine("↩ Budget discipline rewarded — +$5 savings"); return "+$5 savings for staying on budget"; } }]
        }
      ];
    }
  }
},

/* ══ WEEK 5 – July begins ══ */
{
  id:"w5_main", week:5, bonus:false, category:"daily",
  title: j => `July Heat — ${j.name} Challenge`,
  body:  j => {
    const map = { lawn:"Heat wave hit. Mowing in 95° heat is brutal. You can buy extra water/electrolytes ($6) or push through.", pet:"It's too hot to walk dogs in the afternoon. You could offer early-morning slots (lose $8 but protect the animals) or keep the schedule.", babysitting:"Family wants outdoor activities in this heat. You could pay for pool admission ($10) or suggest indoor crafts.", dogwalk:"Heat advisory today. Cancel afternoon walks and refund $12, or walk anyway and risk a sick dog.", cars:"Demand is high in summer heat — cars get dirty fast. You could advertise a special ($5 off, gain 2 clients) or keep standard pricing.", tutor:"Student wants to skip this week because of summer. Offer a discount ($7 less) to keep them, or let them go.", chores:"Heat makes cleaning exhausting. You could do half the job and charge half ($15 less), or power through.", errands:"Bus is packed and hot. Pay for a rideshare ($8) or deal with the crowded bus.", crafts:"Heat slows market foot traffic. Set up a fan for $12 or hope for a breeze." };
    return (map[j.id]||map.lawn);
  },
  options: (j,s) => {
    const cost = {lawn:6,pet:8,babysitting:10,dogwalk:12,cars:0,tutor:7,chores:15,errands:8,crafts:12}[j.id]||8;
    return [
      { label:"Spend the extra $ for comfort/safety", hint:`-$${cost} • better outcome`, cost: cost > 0 ? cost : undefined,
        applyAfterFunding: (st) => { st.ledger.weekExpenses+=cost; addLedgerLine(`Week 5: Spent $${cost} for summer comfort`); return `-$${cost}, smart safety/comfort choice`; },
        apply: (st) => { st.cash=Math.max(0,st.cash-cost); st.ledger.weekExpenses+=cost; addLedgerLine(`Week 5: Spent $${cost} for summer comfort`); return `-$${cost}, smart safety/comfort choice`; },
        consequences:[{ triggerWeek:8, id:"c_w5_spend", label:"Client Kept / Animal Safe", major:false,
          apply:(st)=>{ st.bank.checking+=10; addLedgerLine("↩ Good July decision — retained client/animal safe +$10"); return "+$10 client retention bonus"; } }]
      },
      { label:"Push through — save the cash", hint:"No cost • potential problem",
        apply: (st) => { addLedgerLine("Week 5: Pushed through summer heat"); return "No cost, took the risk"; },
        consequences:[{ triggerWeek:7, id:"c_w5_push", label:"Heat Consequence", major:true,
          apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-18); addLedgerLine("↩ Week 5 heat risk backfired — lost client/vet bill -$18"); return "Pushing through the heat cost you: a client complaint or an animal got sick. -$18 from checking."; } }]
      }
    ];
  }
},
{
  id:"w5_bonus", week:5, bonus:true, category:"investing",
  title: j => "Friend's Investment Tip",
  body:  j => "Your older cousin says everyone's buying a hot stock. 'Put in $25 and double your money!' It's unverified. Do you invest?",
  options: (j,s) => [
    { label:"Invest $25 — sounds good!", hint:"-$25 • 50/50 result", cost:25,
      applyAfterFunding: (st)=>{ addLedgerLine("Week 5 bonus: Invested $25 in tip stock"); addCoverage(8); return "-$25 invested"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-25); addLedgerLine("Week 5 bonus: Invested $25 in tip stock"); addCoverage(8); return "-$25 invested"; },
      consequences:[{ triggerWeek:10, id:"c_stock_tip", label:"Stock Tip Result", major:true,
        apply:(st)=>{ const win = Math.random()>0.5; if(win){ st.bank.checking+=40; addLedgerLine("↩ Stock tip paid off! +$40"); return "Your cousin's tip worked out! +$40 back to checking. Lucky — but it could have gone the other way."; } else { addLedgerLine("↩ Stock tip failed — lost the $25"); return "The stock tanked. You lost your $25 investment. Unverified tips are risky — always research first."; } } }]
    },
    { label:"Skip it — research first", hint:"No loss • smart move",
      apply:(st)=>{ addLedgerLine("Week 5 bonus: Skipped unverified stock tip"); addCoverage(8); return "Smart — skipped the gamble"; }
    }
  ]
},

/* ══ WEEK 6 ══ */
{
  id:"w6_main", week:6, bonus:false, category:"billing",
  title: j => "Mystery Charge on Statement",
  body:  j => "You check your bank app and see a $22 charge you don't recognize from last month. What do you do?",
  options: (j,s) => [
    { label:"Dispute it immediately", hint:"Credit +5 • smart consumer",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+5); addLedgerLine("Week 6: Disputed mystery charge — credit +5"); addCoverage(11); addCoverage(13); return "Dispute filed. Credit +5"; },
      consequences:[{ triggerWeek:9, id:"c_w6_dispute", label:"Dispute Resolution", major:true,
        apply:(st)=>{ st.bank.checking+=22; addLedgerLine("↩ Dispute resolved — $22 refunded"); return "The bank investigated and refunded $22 to your checking account. Always dispute unauthorized charges!"; } }]
    },
    { label:"Ignore it — probably fine", hint:"Credit -8 • risky",
      apply:(st)=>{ st.credit=Math.max(300,st.credit-8); addLedgerLine("Week 6: Ignored mystery charge — credit -8"); return "Credit -8 — bad habit"; },
      consequences:[{ triggerWeek:9, id:"c_w6_ignore", label:"Charge Compounds", major:true,
        apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-22); addLedgerLine("↩ Mystery charge repeated — -$22 again"); return "The charge hit again. Ignoring it cost you $22 more. Always check your statements and dispute anything suspicious."; } }]
    },
    { label:"Call bank to understand it", hint:"No immediate effect",
      apply:(st)=>{ addLedgerLine("Week 6: Called bank about charge"); addCoverage(11); return "Called bank — smart first step"; },
      consequences:[{ triggerWeek:8, id:"c_w6_call", label:"Bank Call Outcome", major:false,
        apply:(st)=>{ st.bank.checking+=22; st.credit=Math.min(850,st.credit+2); addLedgerLine("↩ Bank call resolved charge +$22, credit +2"); return "+$22 refund, credit +2 for proactive action"; } }]
    }
  ]
},
{
  id:"w6_bonus", week:6, bonus:true, triggerIf: choices => choices["w3_main"] === 0, // bought lunch
  category:"daily",
  title: j => "Lunch Habit Check",
  body:  j => "You've been buying lunch every day. That's $3.50 × 5 days = $17.50 a week. A friend suggests meal prepping on Sunday to save $12/week. Sound worth it?",
  options: (j,s) => [
    { label:"Start meal prepping — $5 groceries", hint:"-$5 now, save $12/wk", cost:5,
      applyAfterFunding: (st)=>{ st.ledger.weekExpenses+=5; addLedgerLine("Week 6 bonus: Started meal prep -$5"); return "Started meal prepping -$5"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-5); st.ledger.weekExpenses+=5; addLedgerLine("Week 6 bonus: Started meal prep -$5"); return "Started meal prepping -$5"; },
      consequences:[{ triggerWeek:10, id:"c_mealprep", label:"Meal Prep Savings", major:false,
        apply:(st)=>{ st.bank.savings+=25; addLedgerLine("↩ 4 weeks of meal prep saved $25"); return "+$25 meal prep savings"; } }]
    },
    { label:"Keep buying lunch", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 6 bonus: Kept buying lunch"); return "Kept buying lunch"; }
    }
  ]
},

/* ══ WEEK 7 ══ */
{
  id:"w7_main", week:7, bonus:false, category:"contract",
  title: j => "Gym Membership Offer",
  body:  j => "A local gym is offering a student special — $20/month, auto-renews, $40 cancellation fee. Your friend is joining. Do you sign up?",
  options: (j,s) => [
    { label:"Join the gym", hint:"-$20/mo • $40 cancel fee", cost:20,
      applyAfterFunding: (st)=>{ st.contractActive=true; st.contractId="gym"; addLedgerLine("Week 7: Joined gym -$20"); addCoverage(10); addCoverage(13); return "-$20/mo gym contract"; },
      apply:(st)=>{ st.contractActive=true; st.contractId="gym"; st.bank.checking=Math.max(0,st.bank.checking-20); addLedgerLine("Week 7: Joined gym -$20"); addCoverage(10); addCoverage(13); return "-$20/mo gym contract"; },
      consequences:[
        { triggerWeek:15, id:"c_gym_renew", label:"Gym Auto-Renewal", major:true,
          apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-20); addLedgerLine("↩ Gym auto-renewed -$20 (school got busy)"); return "School started and you forgot about the gym. Auto-renewal charged -$20. Cancel fee would be $40. Pay or cancel?"; } },
        { triggerWeek:23, id:"c_gym_renew2", label:"Gym Renews Again", major:false,
          apply:(st)=>{ if(st.contractActive && st.contractId==="gym"){ st.bank.checking=Math.max(0,st.bank.checking-20); addLedgerLine("↩ Gym auto-renewed again -$20"); return "-$20 gym auto-renewal"; } return "No gym charge (already cancelled)"; } }
      ]
    },
    { label:"Skip — save the $20/mo", hint:"No contract risk",
      apply:(st)=>{ addLedgerLine("Week 7: Skipped gym membership"); addCoverage(10); return "No gym contract"; }
    },
    { label:"Month-to-month only ($25)", hint:"-$25 now • no lock-in", cost:25,
      applyAfterFunding: (st)=>{ addLedgerLine("Week 7: Month-to-month gym -$25"); return "-$25 no commitment"; },
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-25); addLedgerLine("Week 7: Month-to-month gym -$25"); return "-$25 no commitment"; }
    }
  ]
},

/* ══ WEEK 8 ══ */
{
  id:"w8_main", week:8, bonus:false, category:"ledger",
  title: j => `End of July — ${j.name} Business Review`,
  body:  j => "You've been working 2 months now. A client/customer wants to pay you less than your usual rate, claiming other people charge less. Do you lower your price?",
  options: (j,s) => [
    { label:"Hold your rate — you're worth it", hint:"No income loss",
      apply:(st)=>{ addLedgerLine("Week 8: Held rate — professional"); return "Kept rate, stayed professional"; },
      consequences:[{ triggerWeek:12, id:"c_w8_rate_hold", label:"Reputation Reward", major:false,
        apply:(st)=>{ st.bank.checking+=15; addLedgerLine("↩ Held rate — new referral client +$15"); return "Your client respected your rate and referred a friend. +$15 bonus"; } }]
    },
    { label:"Lower by $5 to keep them", hint:"-$5/session but client stays",
      apply:(st)=>{ st.ledger.weekExpenses+=5; addLedgerLine("Week 8: Lowered rate by $5"); return "-$5 per session, kept client"; },
      consequences:[{ triggerWeek:14, id:"c_w8_rate_low", label:"Rate Creep", major:false,
        apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-10); addLedgerLine("↩ Low rate set a precedent — 2 more clients asked for same -$10"); return "Two more clients asked for your discounted rate. -$10 from earnings."; } }]
    }
  ]
},
{
  id:"w8_bonus", week:8, bonus:true, category:"banking",
  title: j => "High-Yield Savings Offer",
  body:  j => {
    if(state.bank.savingsType === 'hysa' && state.bank.hysaPrincipal > 0){
      return `You already have a High-Yield Savings account with ${money(state.bank.hysaPrincipal)} earning 4% APR.\n\nWould you like to invest more into it, or move some funds to a CD instead?`;
    }
    return "Your bank is advertising a high-yield savings account at 4% APR vs your regular 0.5%. You need $25 minimum to open it. Worth switching?";
  },
  options: (j,s) => {
    if(state.bank.savingsType === 'hysa' && state.bank.hysaPrincipal > 0){
      return [
        { label:"Invest $25 more into High-Yield", hint:"+$25 principal at 4% APR", cost:25,
          applyAfterFunding:(st)=>{ addToHysa(25); addLedgerLine("Week 8 bonus: Added $25 more to High-Yield (4% APR)"); addCoverage(4); return "+$25 to HYSA"; },
          apply:(st)=>{ if(st.bank.checking>=25){st.bank.checking-=25; addToHysa(25); addLedgerLine("Week 8 bonus: Added $25 to HYSA"); addCoverage(4); return "+$25 to HYSA";} return "Not enough in checking"; }
        },
        { label:"Open a 3-Month CD instead (4.0%)", hint:"Locked for 3 months, 4% APR",
          apply:(st)=>{ createCD("3m",50,false,"player"); addLedgerLine("Week 8 bonus: Opened 3-Month CD"); addCoverage(9); return "3-Month CD opened"; }
        },
        { label:"Keep current setup", hint:"No change",
          apply:(st)=>{ addLedgerLine("Week 8 bonus: Kept current HYSA setup"); return "No change"; }
        }
      ];
    }
    return [
      { label:"Switch to high-yield", hint:"4% APR • better growth",
        apply:(st)=>{ if(st.bank.savings >= 25){ st.bank.savingsType="hysa"; st.bank.hysaPrincipal=Math.min(st.bank.savings, 100); st.bank.hysaDeposits = st.bank.hysaPrincipal; addLedgerLine("Week 8 bonus: Switched to high-yield savings 4% APR"); addCoverage(4); return "Switched to HYSA — 4% growth"; } else { addLedgerLine("Week 8 bonus: Not enough in savings yet"); return "Need $25+ in savings first"; } }
      },
      { label:"Keep regular savings", hint:"0.5% APR • no change",
        apply:(st)=>{ addLedgerLine("Week 8 bonus: Kept regular savings"); return "Stayed with regular savings"; }
      }
    ];
  }
},

/* ══ WEEK 9 – August begins ══ */
{
  id:"w9_main", week:9, bonus:false, category:"daily",
  title: j => "Back-to-School Shopping Pressure",
  body:  j => "August means back-to-school sales. Your friends are all buying new stuff. You need some supplies but not $80 worth. What's your move?",
  options: (j,s) => [
    { label:"Buy only what you need — $20", hint:"-$20 • smart needs spending", cost:20,
      applyAfterFunding: (st)=>{ st.ledger.weekExpenses+=20; addLedgerLine("Week 9: Bought needed school supplies -$20"); return "-$20 needs only"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-20); st.ledger.weekExpenses+=20; addLedgerLine("Week 9: Bought needed school supplies -$20"); return "-$20 needs only"; }
    },
    { label:"Buy extra stuff — go with the crowd $60", hint:"-$60 • wants", cost:60,
      applyAfterFunding: (st)=>{ st.ledger.weekExpenses+=60; st.plan.wants+=10; addLedgerLine("Week 9: Back-to-school splurge -$60"); return "-$60 wants spending"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-60); st.ledger.weekExpenses+=60; st.plan.wants+=10; addLedgerLine("Week 9: Back-to-school splurge -$60"); return "-$60 wants spending"; },
      consequences:[{ triggerWeek:13, id:"c_bts_splurge", label:"September Budget Squeeze", major:true,
        apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-20); addLedgerLine("↩ Back-to-school splurge → tight Sept budget -$20"); return "The August splurge caught up with you. September budget is tight — had to skip a savings deposit -$20."; } }]
    },
    { label:"Buy secondhand / borrow — $8", hint:"-$8 • great savings habit", cost:8,
      applyAfterFunding: (st)=>{ st.ledger.weekExpenses+=8; st.bank.savings+=10; addLedgerLine("Week 9: Secondhand supplies -$8, saved $10"); return "-$8 smart choice, +$10 savings"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-8); st.ledger.weekExpenses+=8; st.bank.savings+=10; addLedgerLine("Week 9: Secondhand supplies -$8, saved $10"); return "-$8 smart choice, +$10 savings"; }
    }
  ]
},

/* ══ WEEK 10 ══ */
{
  id:"w10_main", week:10, bonus:false, category:"inheritance",
  title: j => "Surprise: Grandparent Gift",
  body:  j => "Your grandparent sends $150 for your birthday. It's unexpected. You have three real choices for this money.",
  options: (j,s) => [
    { label:"Save all of it", hint:"+$150 to savings",
      apply:(st)=>{ st.bank.savings+=150; addLedgerLine("Week 10: Grandparent gift — saved $150"); addCoverage(5); addCoverage(3); return "+$150 to savings"; },
      consequences:[{ triggerWeek:16, id:"c_gift_save", label:"Savings Milestone", major:false,
        apply:(st)=>{ st.bank.savings+=12; addLedgerLine("↩ Consistent saving from gift — growth bonus +$12"); return "+$12 savings milestone reward"; } }]
    },
    { label:"Invest it", hint:"Choose HYSA, CD, or stock path",
      skipReflection:true,
      onSelect:({complete})=>{
        setTimeout(()=>{
          openInvestmentChoiceModal(150, "Birthday gift", (summary)=>{
            addCoverage(5);
            addCoverage(8);
            addLedgerLine(`Week 10: ${summary}`);
            complete(summary, { badge:`Birthday gift invested: ${money(150)}`, banner:"Pick confirmed for the birthday gift." });
          });
        }, 60);
      },
      consequences:[{ triggerWeek:20, id:"c_gift_invest", label:"Investment Growth Check", major:false,
        apply:(st)=>{
          if(st.bank.savingsType === "hysa" && (st.bank.hysaPrincipal || 0) > 0){
            const growth=Math.max(1, Math.round(st.bank.hysaPrincipal*0.04));
            st.bank.hysaPrincipal+=growth;
            st.bank.hysaAccrued+=growth;
            addLedgerLine(`↩ Gift investment grew +$${growth}`);
            return `Your HYSA investment grew +$${growth} — smart choice to invest some of the gift.`;
          }
          return "Your investment choice kept growing quietly in the background.";
        } }]
    },
    { label:"Spend it all — birthday treat!", hint:"+$150 wants, credit -3",
      apply:(st)=>{ st.plan.wants+=20; st.credit=Math.max(300,st.credit-3); addLedgerLine("Week 10: Spent birthday gift -$150 wants"); addCoverage(5); return "-$150 spent on wants, credit -3"; },
      consequences:[{ triggerWeek:14, id:"c_gift_spend", label:"Spent Gift Tax", major:true,
        apply:(st)=>{ addLedgerLine("↩ Spent birthday gift — now short on school expenses"); return "You spent your birthday gift and now a school expense came up you weren't ready for. Try to keep some gifts in savings for unexpected costs."; } }]
    }
  ]
},
{
  id:"w10_bonus", week:10, bonus:true, category:"ledger",
  title: j => `${j.name}: Upgrade Your Equipment?`,
  body:  j => {
    const map={lawn:"A used commercial mower is for sale for $80. It'd let you take on bigger lawns.",pet:"A better pet carrier is $45 — clients would trust you more with their animals.",babysitting:"A first-aid/CPR mini-course is $35 — parents pay more for certified sitters.",dogwalk:"Retractable leashes ($20) would let you walk 2 dogs at once, doubling potential income.",cars:"A pressure washer rental program is $60/month — could triple your car wash income.",tutor:"Education software license is $25 — helps you tutor more subjects.",chores:"A quality vacuum is $55 — do jobs faster and charge more.",errands:"A bike lock + basket ($30) lets you do bike errands, more clients.",crafts:"An Etsy shop ($15 setup) opens online sales beyond local markets."};
    return (map[j.id]||map.lawn) + " Invest or save the money?";
  },
  options: (j,s) => [
    { label:"Invest in the upgrade", hint:"-$20 to $80 • income boost",
      cost: (j=>({lawn:80,pet:45,babysitting:35,dogwalk:20,cars:60,tutor:25,chores:55,errands:30,crafts:15})[j.id]||40),
      applyAfterFunding: (st,j)=>{ const cost={lawn:80,pet:45,babysitting:35,dogwalk:20,cars:60,tutor:25,chores:55,errands:30,crafts:15}[j.id]||40; st.ledger.weekExpenses+=cost; addLedgerLine(`Week 10 bonus: Job upgrade -$${cost}`); addCoverage(1); return `-$${cost} upgrade`; },
      apply:(st,j)=>{ const cost={lawn:80,pet:45,babysitting:35,dogwalk:20,cars:60,tutor:25,chores:55,errands:30,crafts:15}[j.id]||40; st.cash=Math.max(0,st.cash-cost); st.ledger.weekExpenses+=cost; addLedgerLine(`Week 10 bonus: Job upgrade -$${cost}`); addCoverage(1); return `-$${cost} upgrade`; },
      consequences:[{ triggerWeek:16, id:"c_upgrade", label:"Upgrade Pays Off", major:false,
        apply:(st)=>{ st.bank.checking+=25; addLedgerLine("↩ Job upgrade paid off — new client +$25"); return "+$25 from upgrade — new client booked"; } }]
    },
    { label:"Save the money instead", hint:"No income boost",
      apply:(st)=>{ addLedgerLine("Week 10 bonus: Saved instead of upgrading"); return "Kept savings intact"; }
    }
  ]
},

/* ══ WEEK 11 ══ */
{
  id:"w11_main", week:11, bonus:false, category:"daily",
  title: j => "Friend Needs to Borrow Money",
  body:  j => "Your friend asks to borrow $25 until next Friday. They've borrowed before and paid back once but were late. Do you lend it?",
  options: (j,s) => [
    { label:"Lend the $25", hint:"-$25 now • maybe back", cost:25,
      applyAfterFunding: (st)=>{ addLedgerLine("Week 11: Lent $25 to friend"); return "-$25 loaned to friend"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-25); addLedgerLine("Week 11: Lent $25 to friend"); return "-$25 loaned to friend"; },
      consequences:[{ triggerWeek:13, id:"c_lend", label:"Friend Repayment", major:true,
        apply:(st)=>{ const paysBack=Math.random()>0.4; if(paysBack){ st.cash+=25; addLedgerLine("↩ Friend paid back $25 on time"); return "Your friend paid back the $25! Not always the outcome — but this time it worked out."; } else { addLedgerLine("↩ Friend couldn't pay back $25"); return "Your friend couldn't pay you back yet. The $25 is still owed. Lending money to friends can get complicated."; } } }]
    },
    { label:"Say no — protect your budget", hint:"No loss",
      apply:(st)=>{ addLedgerLine("Week 11: Said no to lending money"); return "Protected your budget"; }
    },
    { label:"Lend $10 only", hint:"-$10 compromise", cost:10,
      applyAfterFunding: (st)=>{ addLedgerLine("Week 11: Compromised — lent $10"); return "-$10 compromise loan"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-10); addLedgerLine("Week 11: Compromised — lent $10"); return "-$10 compromise loan"; },
      consequences:[{ triggerWeek:13, id:"c_lend_partial", label:"Partial Loan Return", major:false,
        apply:(st)=>{ st.cash+=10; addLedgerLine("↩ Friend paid back the $10 partial loan"); return "+$10 paid back on time"; } }]
    }
  ]
},

/* ══ WEEK 12 ══ */
{
  id:"w12_main", week:12, bonus:false, category:"ledger",
  title: j => "End of Summer — Client/Customer Appreciation",
  body:  j => `Summer's wrapping up. A regular client for your ${j.name} business wants to give you a $30 tip or a recommendation letter for a school application. What do you choose?`,
  options: (j,s) => [
    { label:"Take the $30 cash", hint:"+$30 checking",
      apply:(st)=>{ st.bank.checking+=30; addLedgerLine("Week 12: Summer tip +$30"); return "+$30 tip received"; }
    },
    { label:"Take the recommendation letter", hint:"+credit score bonus",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+8); addLedgerLine("Week 12: Recommendation letter — credit +8"); return "Recommendation letter — credit +8"; },
      consequences:[{ triggerWeek:20, id:"c_recoletter", label:"Letter Pays Off", major:false,
        apply:(st)=>{ st.credit=Math.min(850,st.credit+5); addLedgerLine("↩ Rec letter helped with school program — credit +5"); return "+5 credit from recommendation letter doors it opened"; } }]
    }
  ]
},
{
  id:"w12_bonus", week:12, bonus:true, category:"savings",
  title: j => "Summer Savings Review",
  body:  j => "Before school starts, you have a chance to move your summer cash into a CD. 3-month CD pays 4% but locks the money until November. Good idea?",
  options: (j,s) => [
    { label:"Open a 3-month CD", hint:"Lock until Nov, earn 4%",
      apply:(st)=>{ if(st.cash>=50||st.bank.savings>=50){ createCD("3m",50,true,"bonus"); addLedgerLine("Week 12 bonus: Opened 3-month summer CD"); addCoverage(4); addCoverage(9); return "3-month CD opened — money locked until Week 24"; } else { return "Not enough funds for a $50 CD minimum"; } }
    },
    { label:"Keep money accessible", hint:"No lock-in",
      apply:(st)=>{ addLedgerLine("Week 12 bonus: Kept savings accessible"); return "Kept funds liquid"; }
    }
  ]
},

/* ══ WEEK 13 – September: School Starts ══ */
{
  id:"w13_main", week:13, bonus:false, category:"schedule",
  title: j => "🏫 School Starts — How Many Hours?",
  body:  j => `School just started. You can't work as many hours as summer. How do you adjust your ${j.name} schedule? This affects your income for the next few months.`,
  options: (j,s) => [
    { label:"Cut to 8 hrs/week — school first", hint:"-40% income • stable grades",
      apply:(st)=>{ st.plan.income = Math.round(st.plan.income * 0.60); addLedgerLine("Week 13: Cut to 8 hrs/wk — income reduced 40%"); return "Income cut 40% — school priority"; },
      consequences:[{ triggerWeek:25, id:"c_school_hrs_low", label:"Grade Benefit", major:false,
        apply:(st)=>{ st.credit=Math.min(850,st.credit+6); addLedgerLine("↩ Good grades from school focus — credit +6"); return "+6 credit for academic responsibility"; } }]
    },
    { label:"Keep 15 hrs/week — hustle both", hint:"Full income • stress risk",
      apply:(st)=>{ addLedgerLine("Week 13: Kept full hours through school start"); return "Full hours, full income"; },
      consequences:[{ triggerWeek:18, id:"c_school_hrs_high", label:"Burnout Check", major:true,
        apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-15); addLedgerLine("↩ Burnout from overwork — missed job, refunded -$15"); return "You took on too much. Missed a job and had to refund a client -$15. Balance school and work carefully."; } }]
    },
    { label:"10 hrs/week — balanced", hint:"20% income cut • manageable",
      apply:(st)=>{ st.plan.income = Math.round(st.plan.income * 0.80); addLedgerLine("Week 13: Balanced 10 hrs/wk — income -20%"); return "Income -20%, balanced approach"; }
    }
  ]
},

/* ══ WEEK 14 ══ */
{
  id:"w13_movie_social", week:13, bonus:true, triggerIf:()=>true, category:"daily",
  title: j => "🎬 Friends Want to See a Movie Tonight",
  body:  j => {
    const hasMovie = hasWantInInventory("movie");
    if(hasMovie){
      return `Your friends are going to see the new movie tonight. You budgeted for a Movie Ticket this month!\n\nIt's already covered in your wants — go enjoy it!`;
    } else {
      return `Your friends want to catch a movie tonight. Ticket costs about $10–12.\n\nMovie Ticket isn't in your wants budget this month. Going means paying out of your other funds.`;
    }
  },
  options: (j,s) => {
    const hasMovie = hasWantInInventory("movie");
    if(hasMovie){
      return [
        { label:"Yes! 🎬 Already budgeted for it!", hint:"No extra cost",
          apply:(st)=>{ useWantFromInventory("movie"); addLedgerLine("Movie night: used from wants budget — no extra cost!"); return "Movie night — already budgeted!"; }
        },
        { label:"Skip — not feeling it tonight", hint:"Save the movie slot",
          apply:(st)=>{ addLedgerLine("Movie: skipped, saving slot"); return "Saved the movie ticket for later"; }
        }
      ];
    } else {
      return [
        { label:"Go — pay $10 from cash", hint:"-$10 cash (not budgeted)",
          apply:(st)=>{ st.cash=Math.max(0,st.cash-10); markUnplannedWantUsed("Movie Ticket"); addLedgerLine("Movie: paid $10 unbudgeted — from cash"); return "-$10 cash (over budget)"; }
        },
        { label:"Skip — not in wants this month", hint:"No cost",
          apply:(st)=>{ addLedgerLine("Movie: skipped — not in budget"); return "Budget discipline — skipped movie"; }
        }
      ];
    }
  }
},

/* ══ WEEK 14 ══ */
{
  id:"w14_main", week:14, bonus:false, category:"daily",
  title: j => "School Activity Fee",
  body:  j => "Your school wants $45 for a club fee. It's a good opportunity but it's not in your budget plan. What do you do?",
  options: (j,s) => [
    { label:"Pay the fee — it's worth it", hint:"-$45 • choose account", cost:45,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 14: Paid club fee -$45"); return "-$45 club fee paid"; },
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-45); addLedgerLine("Week 14: Paid club fee -$45"); return "-$45 from checking"; },
      consequences:[{ triggerWeek:24, id:"c_club_pay", label:"Club Opens Door", major:false,
        apply:(st)=>{ st.credit=Math.min(850,st.credit+5); addLedgerLine("↩ Club membership helped — networking credit +5"); return "+5 credit from club networking opportunity"; } }]
    },
    { label:"Skip the club this semester", hint:"No cost",
      apply:(st)=>{ addLedgerLine("Week 14: Skipped club fee"); return "Skipped club"; }
    },
    { label:"Ask about a payment plan", hint:"-$15 × 3 months", cost:15,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 14: Club payment plan — first of 3 payments -$15"); return "-$15 now, 2 more to go"; },
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-15); addLedgerLine("Week 14: Club payment plan -$15 first"); return "-$15 now, 2 more payments"; },
      consequences:[{ triggerWeek:18, id:"c_club_plan2", label:"Club Payment 2", major:false, apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-15); addLedgerLine("↩ Club payment plan #2 -$15"); return "-$15 club payment"; } },
        { triggerWeek:22, id:"c_club_plan3", label:"Club Payment 3", major:false, apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-15); addLedgerLine("↩ Club payment plan #3 -$15"); return "-$15 final club payment"; } }]
    }
  ]
},

/* ══ WEEK 15 ══ */
{
  id:"w15_main", week:15, bonus:false, category:"ledger",
  title: j => `${j.name}: Slow Week Decision`,
  body:  j => `Work slowed down when school started. You earned $${Math.round(state.plan.income/4)} less than expected this week. Do you dip into savings to cover needs, or cut wants?`,
  options: (j,s) => [
    { label:"Cut wants this week", hint:"No savings touched",
      apply:(st)=>{ st.plan.wants=Math.max(0,st.plan.wants-10); addLedgerLine("Week 15: Cut wants to manage slow week"); return "Cut wants $10 — smart discipline"; }
    },
    { label:"Dip into savings — just this once", hint:"-$20 savings",
      apply:(st)=>{ const amt=20; st.bank.savings=Math.max(0,st.bank.savings-amt); st.bank.checking+=amt; addLedgerLine(`Week 15: Dipped into savings -$${amt}`); return `-$${amt} from savings`; },
      consequences:[{ triggerWeek:20, id:"c_dip_savings", label:"Savings Dip Habit", major:false,
        apply:(st)=>{ addLedgerLine("↩ Dipped into savings again — pattern forming"); return "You dipped into savings again during a slow week. Patterns form fast — try to cut wants instead next time."; } }]
    },
    { label:"Pick up an extra quick job", hint:"+$15 hustle income",
      apply:(st)=>{ st.bank.checking+=15; addLedgerLine("Week 15: Extra quick job +$15"); return "+$15 hustle income"; }
    }
  ]
},
{
  id:"w15_bonus", week:15, bonus:true, category:"contract",
  title: j => "Streaming Subscription Renewal",
  body:  j => "You got an email: your $12/month streaming service is about to auto-renew for 6 months ($72). You've barely used it. Cancel or keep?",
  options: (j,s) => [
    { label:"Cancel it now", hint:"Save $72 • no more charges",
      apply:(st)=>{ st.bank.checking+=12; addLedgerLine("Week 15 bonus: Cancelled streaming — saved $12 this month"); addCoverage(10); addCoverage(13); return "+$12 saved, subscription cancelled"; }
    },
    { label:"Keep it — I use it", hint:"-$12/mo • choose account", cost:12,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 15 bonus: Kept streaming subscription -$12"); addCoverage(10); return "-$12/mo subscription continues"; },
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-12); addLedgerLine("Week 15 bonus: Kept streaming subscription -$12"); addCoverage(10); return "-$12/mo subscription continues"; },
      consequences:[{ triggerWeek:25, id:"c_stream_renew", label:"Streaming Renewal", major:false,
        apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-12); addLedgerLine("↩ Streaming auto-renewed -$12"); return "-$12 streaming auto-renewal"; } }]
    }
  ]
},

/* ══ WEEK 16 ══ */
{
  id:"w16_main", week:16, bonus:false, category:"banking",
  title: j => "Overdraft Warning",
  body:  j => {
    const bill = getDynamicTomorrowBill();
    const checking = Number(state.bank?.checking || 0);
    return `Your checking account is at ${money(checking)}. A ${bill.label} of ${money(bill.amount)} hits tomorrow. You'll overdraft unless you act now. What do you do?`;
  },
  options: (j,s) => [
    { label:"Transfer from savings immediately", hint:"-savings, +checking",
      apply:(st)=>{ const bill=getDynamicTomorrowBill(); const checking=Number(st.bank?.checking||0); const amt=Math.max(0, bill.amount - checking + 2); st.bank.savings=Math.max(0,st.bank.savings-amt); st.bank.checking+=amt; addLedgerLine(`Week 16: Emergency transfer from savings to avoid overdraft (+${money(amt)})`); addCoverage(4); return `Transferred ${money(amt)} from savings — overdraft avoided`; }
    },
    { label:"Do nothing — accept overdraft", hint:"-$10 to $20 fee",
      apply:(st)=>{ const ct=state.bank.checkingType?BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType):null; const fee=ct?ct.overdraftFee:15; st.bank.checking-=fee; st.credit=Math.max(300,st.credit-10); addLedgerLine(`Week 16: Overdraft fee -$${fee}, credit -10`); addCoverage(4); return `-$${fee} overdraft fee, credit -10`; }
    },
    { label:"Call bank — ask about fee waiver", hint:"Maybe free this time",
      apply:(st)=>{ const waived=Math.random()>0.5; if(waived){ addLedgerLine("Week 16: Bank waived overdraft fee — proactive!"); st.credit=Math.min(850,st.credit+3); return "Fee waived! Credit +3 for being proactive"; } else { const ct=state.bank.checkingType?BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType):null; const fee=ct?ct.overdraftFee:15; st.bank.checking-=fee; addLedgerLine(`Week 16: Bank didn't waive — fee -$${fee}`); return `-$${fee} fee, waiver denied`; } }
    }
  ]
},

/* ══ WEEK 17 – October ══ */
{
  id:"w17_main", week:17, bonus:false, category:"daily",
  title: j => "October: Halloween Spending",
  body:  j => "Halloween is coming. Friends want to go all out — costumes, parties. Estimate: $40 total. You could DIY for $10. What do you do?",
  options: (j,s) => [
    { label:"Go all out — $40 fun!", hint:"-$40 • choose account", cost:40,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=40; st.plan.wants+=5; addLedgerLine("Week 17: Halloween all out -$40"); return "-$40 wants spending, great memories"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-40); st.ledger.weekExpenses+=40; st.plan.wants+=5; addLedgerLine("Week 17: Halloween all out -$40"); return "-$40 wants spending, great memories"; }
    },
    { label:"DIY costume — $10", hint:"-$10 • creative solution", cost:10,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=10; addLedgerLine("Week 17: DIY Halloween -$10"); return "-$10 creative savings"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-10); st.ledger.weekExpenses+=10; addLedgerLine("Week 17: DIY Halloween -$10"); return "-$10 creative savings"; },
      consequences:[{ triggerWeek:19, id:"c_halloween_diy", label:"DIY Bonus", major:false,
        apply:(st)=>{ st.bank.savings+=15; addLedgerLine("↩ DIY Halloween discipline — savings +$15"); return "+$15 savings from Halloween discipline"; } }]
    },
    { label:"Skip Halloween spending", hint:"No cost",
      apply:(st)=>{ addLedgerLine("Week 17: Skipped Halloween spending"); return "No Halloween cost"; }
    }
  ]
},

/* ══ WEEK 18 ══ */
{
  id:"w18_main", week:18, bonus:false, category:"investing",
  title: j => "School Business Class Project",
  body:  j => "Your business class has a virtual investing competition. You get a pretend $200 to invest. But your teacher also offers $10 real cash bonus if you show a real investment account. Do you open a real one?",
  options: (j,s) => [
    { label:"Open real account + show teacher", hint:"-$25 to open, +$10 bonus",
      apply:(st)=>{ addToHysa(25); st.bank.savingsType="hysa"; st.bank.checking+=10; addLedgerLine("Week 18: Opened real investing account +$10 teacher bonus"); addCoverage(8); return "Real account opened, teacher bonus +$10"; }
    },
    { label:"Just do the virtual project", hint:"No cost or gain",
      apply:(st)=>{ addLedgerLine("Week 18: Did virtual investing project only"); addCoverage(8); return "Virtual project only"; }
    }
  ]
},
{
  id:"w18_bonus", week:18, bonus:true, category:"contract",
  title: j => "Contract Fine Print Discovery",
  body:  j => "You find out your phone contract has a data overage clause — if you use over 5GB, it charges $10 extra. Last month you used 6GB. Did you check your bill?",
  options: (j,s) => [
    { label:"Dispute the overage charge", hint:"Credit +4, maybe refund",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+4); addLedgerLine("Week 18 bonus: Disputed phone overage"); addCoverage(13); addCoverage(11); return "Dispute filed — credit +4"; },
      consequences:[{ triggerWeek:21, id:"c_overage_dispute", label:"Overage Dispute Result", major:false,
        apply:(st)=>{ st.bank.checking+=10; addLedgerLine("↩ Phone overage dispute resolved — $10 refund"); return "+$10 refund on phone overage"; } }]
    },
    { label:"Pay it without questioning", hint:"-$10 • choose account", cost:10,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 18 bonus: Paid phone overage without dispute -$10"); return "-$10 paid"; },
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-10); addLedgerLine("Week 18 bonus: Paid phone overage without dispute -$10"); return "-$10 paid"; }
    }
  ]
},

/* ══ WEEK 19 ══ */
{
  id:"w19_main", week:19, bonus:false, category:"ledger",
  title: j => `${j.name}: Price Your Services`,
  body:  j => "You've been doing this job for 4 months. You could raise your rates by $5 per session/job now. Some clients might leave, but most probably won't.",
  options: (j,s) => [
    { label:"Raise rates — you've earned it", hint:"+$5/session",
      apply:(st)=>{ st.plan.income=Math.round(st.plan.income*1.05); addLedgerLine("Week 19: Raised rates 5% — income increased"); return "Rates raised +5% income"; },
      consequences:[{ triggerWeek:22, id:"c_rate_raise", label:"Rate Raise Result", major:false,
        apply:(st)=>{ const keep=Math.random()>0.3; if(keep){ addLedgerLine("↩ Rate raise — all clients stayed"); return "All clients accepted your new rate. Your work speaks for itself!"; } else { st.plan.income=Math.round(st.plan.income*0.95); addLedgerLine("↩ Rate raise — 1 client left, income slight drop"); return "One client left after the rate increase, small income dip. Still worth it long term."; } } }]
    },
    { label:"Keep current rates", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 19: Kept current rates"); return "Rates unchanged"; }
    }
  ]
},

/* ══ WEEK 20 ══ */
{
  id:"w20_main", week:20, bonus:false, category:"banking",
  title: j => "CD Maturity — Reinvest or Cash Out?",
  body:  j => "Your 3-month CD from week 12 is about to mature. You'll get principal + 4% back. Do you reinvest it or cash out?",
  options: (j,s) => [
    { label:"Reinvest into a 6-month CD", hint:"Locked until May • choose account",
      onSelect:({complete})=>{
        const val=Math.round(55*1.04);
        chooseFundingSource(val, `Reinvest the matured CD amount of ${money(val)}. Choose where the money comes from:`, (src)=>{
          createCD("6m",val,true,"bonus");
          addLedgerLine(`Week 20: Reinvested matured CD into 6-month CD — ${money(val)} from ${src}`);
          addCoverage(4); addCoverage(9);
          complete(`Reinvested ${money(val)} into 6-month CD`, { paymentInfo:{source:src, amount:val}, badge:`Reinvested from ${formatSourceLabel(src)}: ${money(val)}` });
        });
      }
    },
    { label:"Cash it out — take the profit", hint:"Money back + small gain",
      apply:(st)=>{ const gain=Math.round(50*0.04); st.bank.savings+=50+gain; addLedgerLine(`Week 20: CD cashed out +$${50+gain}`); addCoverage(4); return `+$${50+gain} to savings`; }
    }
  ]
},
{
  id:"w20_bonus", week:20, bonus:true, category:"daily",
  title: j => "🕹️ Friends Heading to the Arcade!",
  body:  j => {
    const hasArcade = hasWantInInventory("arcade");
    if(hasArcade){
      return `Your crew is heading to the arcade after school. You budgeted for Arcade Day this month — it's in your wants!\n\nSince it's already in your budget, you're good to go for free!`;
    } else {
      return `Your crew is heading to the arcade after school. Arcade Day runs about $25.\n\nArcade Day isn't in your wants budget this month — if you go, it comes out of pocket.`;
    }
  },
  options: (j,s) => {
    const hasArcade = hasWantInInventory("arcade");
    if(hasArcade){
      return [
        { label:"Let's go! 🕹️ Already budgeted!", hint:"No extra cost — in your wants",
          apply:(st)=>{ useWantFromInventory("arcade"); addLedgerLine("Arcade day: used from wants budget — no extra cost!"); return "Arcade time — budgeted!"; }
        },
        { label:"Skip — save wants for something else", hint:"Keep the arcade slot",
          apply:(st)=>{ addLedgerLine("Arcade: skipped — saving wants slot"); return "Saved arcade budget for later"; }
        }
      ];
    } else {
      return [
        { label:"Go — pay $25 from checking", hint:"-$25 checking (over budget)",
          apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-25); markUnplannedWantUsed("Arcade Day"); addLedgerLine("Arcade: paid $25 unbudgeted — from checking"); return "-$25 checking"; }
        },
        { label:"Skip — not in this month's wants", hint:"No cost, smart choice",
          apply:(st)=>{ addLedgerLine("Arcade: skipped — not in budget"); return "Budget discipline — skipped arcade"; },
          consequences:[{ triggerWeek:22, id:"c_skip_arcade", label:"Saved $25", major:false,
            apply:(st)=>{ st.bank.savings+=5; addLedgerLine("↩ Skipped arcade — $5 savings bonus"); return "+$5 for budget discipline"; } }]
        }
      ];
    }
  }
},

/* ══ WEEK 21 – November ══ */
{
  id:"w21_main", week:21, bonus:false, category:"daily",
  title: j => "Family Asks for Money",
  body:  j => "A family member asks you to contribute $30 toward Thanksgiving dinner costs. You have it but it wasn't planned. What do you do?",
  options: (j,s) => [
    { label:"Contribute the $30", hint:"-$30 • choose account", cost:30,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 21: Contributed to Thanksgiving -$30"); return "-$30 family contribution"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-30); addLedgerLine("Week 21: Contributed to Thanksgiving -$30"); return "-$30 family contribution"; },
      consequences:[{ triggerWeek:25, id:"c_family_give", label:"Family Goodwill", major:false,
        apply:(st)=>{ st.bank.checking+=20; addLedgerLine("↩ Family goodwill — holiday job referral +$20"); return "+$20 holiday job referral from family goodwill"; } }]
    },
    { label:"Offer $10 — what I can do", hint:"-$10 compromise", cost:10,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 21: Partial family contribution -$10"); return "-$10 compromise"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-10); addLedgerLine("Week 21: Partial family contribution -$10"); return "-$10 compromise"; }
    },
    { label:"Explain your budget limits", hint:"No cost — communication",
      apply:(st)=>{ addLedgerLine("Week 21: Explained budget limits to family"); return "Communicated budget limits"; }
    }
  ]
},

/* ══ WEEK 22 ══ */
{
  id:"w22_main", week:22, bonus:false, category:"inheritance",
  title: j => "Late Uncle's Inheritance Echo",
  body:  j => "Three months ago you received that birthday gift/windfall. The IRS now sends a small notice: gifts over $100 may have a $28 tax implication. Do you pay it or dispute it?",
  options: (j,s) => [
    { label:"Pay the $28 tax bill", hint:"-$28 • choose account", cost:28,
      applyAfterFunding:(st)=>{ st.credit=Math.min(850,st.credit+5); addLedgerLine("Week 22: Paid inheritance tax echo -$28, credit +5"); addCoverage(10); return "-$28 paid, credit +5"; },
      apply:(st)=>{ payFromCheckingThenCashThenSavings(28); st.credit=Math.min(850,st.credit+5); addLedgerLine("Week 22: Paid inheritance tax echo -$28, credit +5"); addCoverage(10); return "-$28 paid, credit +5"; }
    },
    { label:"Research it first — might not apply", hint:"No cost yet",
      apply:(st)=>{ addLedgerLine("Week 22: Researching inheritance tax notice"); return "Researching — smart consumer"; },
      consequences:[{ triggerWeek:26, id:"c_inherit_tax_research", label:"Tax Research Outcome", major:true,
        apply:(st)=>{ const owe=Math.random()>0.5; if(owe){ payFromCheckingThenCashThenSavings(28); addLedgerLine("↩ Tax research — owed $28 after all"); return "Research confirmed the $28 was owed. Paid now. Interest + delay added $4."; } else { st.credit=Math.min(850,st.credit+6); addLedgerLine("↩ Tax research — didn't apply, credit +6"); return "Turns out the tax didn't apply to your situation. Credit +6 for doing your homework."; } } }]
    }
  ]
},
{
  id:"w22_bonus", week:22, bonus:true, category:"billing",
  title: j => "Subscription You Forgot About",
  body:  j => "You check your statement and find a $9/month gaming subscription you forgot about. It's been charging for 3 months — $27 total. Cancel or dispute?",
  options: (j,s) => [
    { label:"Dispute and cancel", hint:"Maybe get 1-2 months back",
      apply:(st)=>{ st.bank.checking+=9; st.credit=Math.min(850,st.credit+3); addLedgerLine("Week 22 bonus: Cancelled forgotten sub, partial refund +$9"); addCoverage(11); return "+$9 partial refund, cancelled sub, credit +3"; }
    },
    { label:"Cancel only — no dispute", hint:"No more charges",
      apply:(st)=>{ addLedgerLine("Week 22 bonus: Cancelled forgotten subscription"); addCoverage(10); return "Subscription cancelled"; }
    },
    { label:"Keep it — I forgot I liked it", hint:"-$9/mo • choose account", cost:9,
      applyAfterFunding:(st)=>{ addLedgerLine("Week 22 bonus: Kept forgotten subscription -$9"); return "-$9/mo continues"; },
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-9); addLedgerLine("Week 22 bonus: Kept forgotten subscription -$9"); return "-$9/mo continues"; }
    }
  ]
},

/* ══ WEEK 23 ══ */
{
  id:"w23_main", week:23, bonus:false, category:"daily",
  title: j => "Holiday Gift Pressure",
  body:  j => "The holidays are coming. Friends expect gifts. You could spend $50 on gifts, make DIY gifts for $10, or set a budget limit and communicate it.",
  options: (j,s) => [
    { label:"Spend $50 on gifts", hint:"-$50 • choose account", cost:50,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=50; addLedgerLine("Week 23: Holiday gifts -$50"); return "-$50 holiday spending"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-50); st.ledger.weekExpenses+=50; addLedgerLine("Week 23: Holiday gifts -$50"); return "-$50 holiday spending"; }
    },
    { label:"DIY gifts — $10 materials", hint:"-$10 • thoughtful + cheap", cost:10,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=10; st.bank.savings+=20; addLedgerLine("Week 23: DIY holiday gifts -$10, saved $20"); return "-$10 DIY, +$20 savings"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-10); st.ledger.weekExpenses+=10; st.bank.savings+=20; addLedgerLine("Week 23: DIY holiday gifts -$10, saved $20"); return "-$10 DIY, +$20 savings"; }
    },
    { label:"Set $15 limit, communicate it", hint:"-$15 • honest approach", cost:15,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=15; addLedgerLine("Week 23: Budget holiday gifts -$15"); return "-$15 budget gifts"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-15); st.ledger.weekExpenses+=15; addLedgerLine("Week 23: Budget holiday gifts -$15"); return "-$15 budget gifts"; }
    }
  ]
},

/* ══ WEEK 24 ══ */
{
  id:"w24_main", week:24, bonus:false, category:"ledger",
  title: j => `${j.name}: December Slowdown`,
  body:  j => "December is slow for most jobs. You have two options: pick up seasonal work (wrapping gifts at a store for $12/hr, 5 hrs/week) or enjoy the break.",
  options: (j,s) => [
    { label:"Take seasonal work — $60 extra", hint:"+$60 this month",
      apply:(st)=>{ st.bank.checking+=60; addLedgerLine("Week 24: Seasonal work +$60"); return "+$60 seasonal income"; }
    },
    { label:"Enjoy the break — recharge", hint:"No income, good rest",
      apply:(st)=>{ addLedgerLine("Week 24: Took holiday break"); return "Rest and recharge"; },
      consequences:[{ triggerWeek:29, id:"c_jan_recharged", label:"January Energy Boost", major:false,
        apply:(st)=>{ st.bank.checking+=12; addLedgerLine("↩ Holiday rest paid off — January energy +$12 job"); return "+$12 from energized January start"; } }]
    }
  ]
},
{
  id:"w24_bonus", week:24, bonus:true, category:"savings",
  title: j => "Year-End Savings Push",
  body:  j => "You're 6 months from finishing the year. Do you do a big savings push now — cut wants by $20 for the next 4 weeks and send it to savings?",
  options: (j,s) => [
    { label:"Yes — push $20 to savings", hint:"-$20 wants, +$20 savings/wk",
      apply:(st)=>{ st.plan.wants=Math.max(0,st.plan.wants-20); st.bank.savings+=20; addLedgerLine("Week 24 bonus: Savings push -$20 wants, +$20 savings"); return "Savings push started"; },
      consequences:[{ triggerWeek:28, id:"c_savings_push", label:"Savings Push Result", major:false,
        apply:(st)=>{ st.bank.savings+=60; addLedgerLine("↩ 4-week savings push completed — +$60 to savings"); return "+$60 from consistent savings push"; } }]
    },
    { label:"Not now — enjoying the holidays", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 24 bonus: Skipped savings push"); return "No savings push"; }
    }
  ]
},

/* ══ WEEK 25 – December ══ */
{
  id:"w25_main", week:25, bonus:false, category:"contract",
  title: j => "Year-End Contract Review",
  body:  j => "You've had a contract active for months. Auto-renewal is coming in January. Do you review and decide now, or let it roll?",
  options: (j,s) => [
    { label:"Review and cancel if not needed", hint:"Save monthly cost",
      apply:(st)=>{ if(st.contractActive){ const c=CONTRACTS.find(x=>x.id===st.contractId)||CONTRACTS[0]; st.bank.checking+=c.monthly; st.contractActive=false; addLedgerLine(`Week 25: Cancelled contract ${c.name}, saved $${c.monthly}/mo`); addCoverage(10); addCoverage(13); return `Cancelled ${c.name} — saved $${c.monthly}/mo`; } else { addLedgerLine("Week 25: No active contract to cancel"); return "No active contract"; } }
    },
    { label:"Let it auto-renew — it's fine", hint:"-monthly cost continues",
      apply:(st)=>{ addLedgerLine("Week 25: Let contract auto-renew"); return "Auto-renewal allowed"; },
      consequences:[{ triggerWeek:30, id:"c_jan_autorenew", label:"January Auto-Renewal", major:true,
        apply:(st)=>{ const c=CONTRACTS.find(x=>x.id===st.contractId)||CONTRACTS[0]; if(st.contractActive){ st.bank.checking=Math.max(0,st.bank.checking-c.monthly); addLedgerLine(`↩ January auto-renewal -$${c.monthly}`); return `Your contract auto-renewed in January. -$${c.monthly} from checking. Did you mean for this?`; } return "No active contract renewed"; } }]
    }
  ]
},

/* ══ WEEK 26 ══ */
{
  id:"w26_main", week:26, bonus:false, category:"banking",
  title: j => "Holiday Bonus Decision",
  body:  j => "A client gives you a $40 holiday bonus. Unexpected! Where does it go?",
  options: (j,s) => [
    { label:"Split: $20 savings, $20 fun", hint:"Balanced bonus use",
      apply:(st)=>{ st.bank.savings+=20; st.cash+=20; addLedgerLine("Week 26: Holiday bonus split — +$20 savings, +$20 cash"); return "+$20 savings, +$20 cash"; }
    },
    { label:"All to savings goal", hint:"+$40 savings",
      apply:(st)=>{ st.bank.savings+=40; addLedgerLine("Week 26: Holiday bonus all to savings +$40"); return "+$40 savings push"; }
    },
    { label:"Spend it on holiday fun", hint:"+$40 wants",
      apply:(st)=>{ st.cash+=40; st.plan.wants+=10; addLedgerLine("Week 26: Holiday bonus spent on fun"); return "+$40 wants spending"; }
    }
  ]
},
{
  id:"w26_bonus", week:26, bonus:true, category:"daily",
  title: j => "Credit Card Offer in the Mail",
  body:  j => "You got a 'pre-approved' student credit card offer in the mail. 22% APR. No annual fee. You're 16 — you'd need a co-signer. Is this the right time?",
  options: (j,s) => [
    { label:"Apply with parent co-signer", hint:"Build credit early, risk if misused",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+8); addLedgerLine("Week 26 bonus: Applied for student credit card — credit +8"); addCoverage(5); return "Credit card opened — credit +8 for credit history start"; },
      consequences:[{ triggerWeek:34, id:"c_credit_card", label:"Credit Card Balance Check", major:true,
        apply:(st)=>{ const balance=25; st.bank.checking=Math.max(0,st.bank.checking-balance); addLedgerLine(`↩ Credit card balance unpaid -$${balance} interest hit`); return `You missed a credit card payment. -$${balance} interest charge. Credit cards need to be paid in full each month.`; } }]
    },
    { label:"Not yet — too early", hint:"No credit risk",
      apply:(st)=>{ addLedgerLine("Week 26 bonus: Declined credit card offer"); addCoverage(5); return "Smart — waited on credit card"; }
    }
  ]
},

/* ══ WEEK 27 ══ */
{
  id:"w27_main", week:27, bonus:false, category:"daily",
  title: j => "End of Year Reflection Spending",
  body:  j => "New Year's eve party — friends want to spend $35 each. You've been disciplined all year. Do you splurge once?",
  options: (j,s) => [
    { label:"Splurge — you earned it!", hint:"-$35 • choose account", cost:35,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=35; st.plan.wants+=5; addLedgerLine("Week 27: New Year splurge -$35"); return "-$35 NYE spending"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-35); st.ledger.weekExpenses+=35; st.plan.wants+=5; addLedgerLine("Week 27: New Year splurge -$35"); return "-$35 NYE spending"; }
    },
    { label:"Keep it to $15", hint:"-$15 balanced", cost:15,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=15; addLedgerLine("Week 27: Budget NYE -$15"); return "-$15 modest NYE"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-15); st.ledger.weekExpenses+=15; addLedgerLine("Week 27: Budget NYE -$15"); return "-$15 modest NYE"; }
    },
    { label:"Host something affordable", hint:"-$10 host", cost:10,
      applyAfterFunding:(st)=>{ st.ledger.weekExpenses+=10; st.credit=Math.min(850,st.credit+3); addLedgerLine("Week 27: Hosted affordable gathering -$10, credit +3"); return "-$10, social credit +3"; },
      apply:(st)=>{ st.cash=Math.max(0,st.cash-10); st.ledger.weekExpenses+=10; st.credit=Math.min(850,st.credit+3); addLedgerLine("Week 27: Hosted affordable gathering -$10, credit +3"); return "-$10, social credit +3"; }
    }
  ]
},

/* ══ WEEK 28 ══ */
{
  id:"w28_main", week:28, bonus:false, category:"ledger",
  title: j => "Year Review: How's the Business?",
  body:  j => `You've been doing ${j.name} for 7 months. A local business asks if you'd want to sub-contract — they'll give you steady work at a fixed $50/week but you lose the ability to take your own clients.`,
  options: (j,s) => [
    { label:"Take the contract — steady $50/wk", hint:"Stable income, less freedom",
      apply:(st)=>{ st.plan.income=50*4; addLedgerLine("Week 28: Sub-contract deal — steady $200/mo income"); return "Sub-contract: steady $200/month"; }
    },
    { label:"Stay independent — keep your clients", hint:"Variable income, more freedom",
      apply:(st)=>{ addLedgerLine("Week 28: Stayed independent"); return "Stayed independent"; },
      consequences:[{ triggerWeek:32, id:"c_independent_reward", label:"Independent Work Reward", major:false,
        apply:(st)=>{ st.bank.checking+=30; addLedgerLine("↩ Staying independent paid off — landed big client +$30"); return "+$30 from landing your own big client"; } }]
    }
  ]
},
{
  id:"w28_bonus", week:28, bonus:true, category:"investing",
  title: j => "New Year Investment Goal",
  body:  j => "It's January. Financial influencers are pushing 'index funds.' Your teacher says index funds are good for long-term investing. You have $50 to commit. Go?",
  options: (j,s) => [
    { label:"Put $50 into index fund (simulated)", hint:"-$50 now, grows long term",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-50); st.bank.hysaPrincipal+=50; addLedgerLine("Week 28 bonus: $50 into simulated index fund"); addCoverage(8); return "$50 invested in index fund simulation"; },
      consequences:[{ triggerWeek:44, id:"c_index_fund", label:"Index Fund Check-In", major:true,
        apply:(st)=>{ const growth=Math.round(50*0.07); st.bank.hysaPrincipal+=growth; addLedgerLine(`↩ Index fund simulation up +$${growth}`); return `Your simulated index fund grew +$${growth} over 16 weeks. Long-term investing works!`; } }]
    },
    { label:"Not sure — research more", hint:"No investment yet",
      apply:(st)=>{ addLedgerLine("Week 28 bonus: Researching index funds"); addCoverage(8); return "Researching — smart"; }
    }
  ]
},

/* ══ WEEK 29 – January ══ */
{
  id:"w29_main", week:29, bonus:false, category:"daily",
  title: j => "New Year Resolutions — Budget Edition",
  body:  j => "New year means new financial habits. You pick one resolution. Which do you commit to for the next month?",
  options: (j,s) => [
    { label:"Save $10 extra every week", hint:"+$40 savings this month",
      apply:(st)=>{ st.bank.savings+=40; addLedgerLine("Week 29: New Year resolution — +$40 savings"); return "+$40 savings resolution"; },
      consequences:[{ triggerWeek:33, id:"c_resolution_save", label:"Resolution Check", major:false,
        apply:(st)=>{ st.bank.savings+=40; addLedgerLine("↩ Kept savings resolution — +$40 more"); return "+$40 continued resolution savings"; } }]
    },
    { label:"Cut one want each week", hint:"Save $10-20/week",
      apply:(st)=>{ st.plan.wants=Math.max(0,st.plan.wants-15); st.bank.savings+=15; addLedgerLine("Week 29: Cut wants resolution — +$15 savings"); return "Cut wants, +$15 savings"; }
    },
    { label:"Track every purchase", hint:"Awareness, no cost",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+4); addLedgerLine("Week 29: Tracking purchases — financial awareness credit +4"); return "Awareness habit — credit +4"; }
    }
  ]
},

/* ══ WEEK 30 ══ */
{
  id:"w30_main", week:30, bonus:false, category:"billing",
  title: j => "January Tax Prep",
  body:  j => "You earned over $600 this year, so you might owe taxes. You can: pay a tax prep service $25, use free software, or ask a parent to help for free.",
  options: (j,s) => [
    { label:"Pay $25 for tax prep service", hint:"-$25 • professional help",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-25); st.credit=Math.min(850,st.credit+6); addLedgerLine("Week 30: Paid tax prep $25 — credit +6"); addCoverage(10); return "-$25, taxes filed, credit +6"; }
    },
    { label:"Use free tax software", hint:"No cost • learning experience",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+4); addLedgerLine("Week 30: Used free tax software — credit +4"); addCoverage(10); return "Free software, credit +4"; }
    },
    { label:"Ask parent to help — free", hint:"No cost",
      apply:(st)=>{ addLedgerLine("Week 30: Parent helped with taxes"); addCoverage(10); return "Parent helped — free taxes"; }
    }
  ]
},
{
  id:"w30_bonus", week:30, bonus:true, category:"contract",
  title: j => "Referral Client Offer",
  body:  j => `A new client found you through referral and wants a 3-month service contract for your ${j.name} job — $${Math.round(state.plan.income/4*3)} total, paid upfront. It's guaranteed but you'd be locked in.`,
  options: (j,s) => [
    { label:"Accept the contract — guaranteed $", hint:"Steady income, less flexibility",
      apply:(st,j)=>{ const amt=Math.round(st.plan.income/4*3); st.bank.checking+=amt; addLedgerLine(`Week 30 bonus: 3-month client contract +$${amt}`); addCoverage(10); addCoverage(13); return `+$${amt} contract income`; }
    },
    { label:"Negotiate month-to-month", hint:"Less upfront, more flexibility",
      apply:(st,j)=>{ const amt=Math.round(st.plan.income/4); st.bank.checking+=amt; addLedgerLine(`Week 30 bonus: Month-to-month negotiated +$${amt}`); return `+$${amt} month deal`; }
    },
    { label:"Decline — keep it casual", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 30 bonus: Declined referral contract"); return "Stayed casual"; }
    }
  ]
},

/* ══ WEEK 31 ══ */
{
  id:"w31_main", week:31, bonus:false, category:"daily",
  title: j => "Winter Weather Problem",
  body:  j => {
    const map={lawn:"Snow and ice — can't mow. Zero income this week unless you pivot.",pet:"Pet sitting demand surges in winter (people travel). You could take 2 extra clients for $30 more.",babysitting:"School cancellations mean more babysitting demand. Take extra jobs +$25?",dogwalk:"Dangerous icy paths. Cancel all walks and refund, or bundle dogs in shorter routes?",cars:"Nobody wants car washes in freezing temps. Week off or offer interior detailing ($15)?",tutor:"Exam week — students desperately need extra help. Offer weekend sessions +$20?",chores:"Winter means more indoor cleaning jobs. Up your rate for deep cleans +$15?",errands:"Bad weather means more delivery/errand demand. Take 3 extra runs +$18?",crafts:"Winter market season — crafts sell well. Set up extra booth day for $20 extra cost, gain $50?"};
    return (map[j.id]||map.lawn);
  },
  options: (j,s) => [
    { label:"Seize the winter opportunity", hint:"Varies by job, net positive",
      apply:(st,j)=>{ const bonus={lawn:0,pet:30,babysitting:25,dogwalk:0,cars:15,tutor:20,chores:15,errands:18,crafts:30}[j.id]||15; st.bank.checking+=bonus; addLedgerLine(`Week 31: Winter opportunity +$${bonus}`); return `+$${bonus} winter opportunity`; }
    },
    { label:"Take the week off", hint:"No income, rest",
      apply:(st)=>{ addLedgerLine("Week 31: Winter week off"); return "Week off, no income"; }
    }
  ]
},

/* ══ WEEK 32 ══ */
{
  id:"w32_main", week:32, bonus:false, category:"banking",
  title: j => "Savings Goal Checkup",
  body:  j => `You set a savings goal at the start. You're ${Math.round((state.bank.savings / (state.savingsGoal||1)) * 100)}% there. Do you do a mid-year push or stay the course?`,
  options: (j,s) => [
    { label:"Mid-year push — $25 extra to savings", hint:"+$25 savings this week",
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-25); st.bank.savings+=25; addLedgerLine("Week 32: Mid-year savings push +$25"); return "+$25 savings push"; }
    },
    { label:"Stay the course — on track", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 32: Staying the course on savings"); return "On track, no change"; }
    },
    { label:"Revisit the goal — lower it", hint:"Less pressure",
      apply:(st)=>{ if(st.savingsGoal>50){ st.savingsGoal=Math.round(st.savingsGoal*0.8); addLedgerLine(`Week 32: Revised savings goal down to $${st.savingsGoal}`); return `Goal lowered to $${st.savingsGoal}`; } return "Goal already modest"; }
    }
  ]
},
{
  id:"w32_bonus", week:32, bonus:true, category:"ledger",
  title: j => `${j.name}: Client Problem`,
  body:  j => {
    const map={lawn:"A client says you damaged their flower bed. They want $20 off.",pet:"A pet got loose while you were pet sitting. Client is upset — wants $15 refund.",babysitting:"A child scraped their knee on your watch. Family wants $10 back.",dogwalk:"You were late on a dog walk. Client wants 30% off that session.",cars:"You scratched a car door (tiny scratch). Owner wants $25.",tutor:"Student failed a test after your session. Parent wants a refund — $30.",chores:"Broke a small item while cleaning. Owner wants $15.",errands:"Package was late because you forgot. Client wants $10 refund.",crafts:"A craft item broke after sale. Customer wants a refund — $12."};
    return (map[j.id]||map.lawn) + " What do you do?";
  },
  options: (j,s) => [
    { label:"Accept responsibility — make it right", hint:"-$10 to $30 • reputation",
      apply:(st,j)=>{ const cost={lawn:20,pet:15,babysitting:10,dogwalk:10,cars:25,tutor:30,chores:15,errands:10,crafts:12}[j.id]||15; st.bank.checking=Math.max(0,st.bank.checking-cost); st.credit=Math.min(850,st.credit+5); addLedgerLine(`Week 32 bonus: Made it right -$${cost}, credit +5`); return `-$${cost}, reputation protected, credit +5`; },
      consequences:[{ triggerWeek:36, id:"c_client_issue_good", label:"Client Loyalty Reward", major:false,
        apply:(st)=>{ st.bank.checking+=25; addLedgerLine("↩ Handled issue well — client stayed and referred +$25"); return "+$25 from client who respected how you handled the issue"; } }]
    },
    { label:"Dispute it — wasn't your fault", hint:"No cost, risk client loss",
      apply:(st)=>{ addLedgerLine("Week 32 bonus: Disputed client complaint"); return "Disputed — no cost, relationship risk"; },
      consequences:[{ triggerWeek:35, id:"c_client_issue_bad", label:"Client Left", major:false,
        apply:(st)=>{ st.plan.income=Math.max(100,st.plan.income-15); addLedgerLine("↩ Disputed client — lost them, income -$15/mo"); return "Client left after dispute. Income -$15/month"; } }]
    }
  ]
},

/* ══ WEEK 33 – February ══ */
{
  id:"w33_main", week:33, bonus:false, category:"daily",
  title: j => "Valentine's Day Spending",
  body:  j => "Valentine's Day pressure. Cards + gifts for friends/significant other could hit $30. DIY cards cost $5. Skip it?",
  options: (j,s) => [
    { label:"Buy gifts and cards — $30", hint:"-$30 wants",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-30); addLedgerLine("Week 33: Valentine's Day spending -$30"); return "-$30 Valentine's"; }
    },
    { label:"DIY cards and small gifts — $5", hint:"-$5 thoughtful",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-5); st.bank.savings+=15; addLedgerLine("Week 33: DIY Valentine's -$5, saved $15"); return "-$5 DIY, +$15 savings"; }
    },
    { label:"Skip it — not a spender", hint:"No cost",
      apply:(st)=>{ addLedgerLine("Week 33: Skipped Valentine's spending"); return "No Valentine's cost"; }
    }
  ]
},

/* ══ WEEK 34 ══ */
{
  id:"w34_main", week:34, bonus:false, category:"banking",
  title: j => "HYSA vs. Checking — Balance Review",
  body:  j => `You have $${state.bank.savings} in savings and $${state.bank.checking} in checking. Your HYSA has been growing. Do you move more money to maximize growth?`,
  options: (j,s) => [
    { label:"Move $30 more to HYSA", hint:"+$30 HYSA, better growth",
      apply:(st)=>{ if(st.bank.checking>=30){ st.bank.checking-=30; addToHysa(30); addLedgerLine("Week 34: Moved $30 more to HYSA"); addCoverage(4); return "+$30 HYSA"; } else { addLedgerLine("Week 34: Not enough in checking to move"); return "Not enough in checking"; } }
    },
    { label:"Keep balance as is", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 34: Kept current balance split"); return "No change"; }
    },
    { label:"Move $20 from savings back to checking", hint:"More spending access",
      apply:(st)=>{ if(st.bank.savings>=20){ st.bank.savings-=20; st.bank.checking+=20; addLedgerLine("Week 34: Moved $20 back to checking"); return "+$20 checking"; } else { return "Not enough in savings"; } }
    }
  ]
},
{
  id:"w34_bonus", week:34, bonus:true, category:"daily",
  title: j => "Snow Day Side Hustle",
  body:  j => "Two snow days this week. You could shovel neighbors' driveways for $15 each or just relax. You have time for 3 driveways.",
  options: (j,s) => [
    { label:"Shovel all 3 — $45 hustle", hint:"+$45 income",
      apply:(st)=>{ st.bank.checking+=45; addLedgerLine("Week 34 bonus: Snow day shoveling +$45"); return "+$45 snow hustle"; }
    },
    { label:"Do 1 driveway — $15", hint:"+$15 easy money",
      apply:(st)=>{ st.bank.checking+=15; addLedgerLine("Week 34 bonus: Shoveled 1 driveway +$15"); return "+$15 quick cash"; }
    },
    { label:"Rest and relax", hint:"No income, good recovery",
      apply:(st)=>{ addLedgerLine("Week 34 bonus: Rested on snow day"); return "Rested"; }
    }
  ]
},

/* ══ WEEK 35 ══ */
{
  id:"w35_main", week:35, bonus:false, category:"billing",
  title: j => "Medical/Dental Bill Surprise",
  body:  j => "A $45 medical copay bill arrived that you didn't expect. Your insurance (if you have it) might cover part. What do you do?",
  options: (j,s) => [
    { label:"Pay it immediately", hint:"-$45 checking or cash",
      apply:(st)=>{ const ins=st.plan.insurance; const cost=ins==="strong"?15:ins==="basic"?30:45; payFromCheckingThenCashThenSavings(cost); st.credit=Math.min(850,st.credit+5); addLedgerLine(`Week 35: Medical bill paid -$${cost} (insurance: ${ins}), credit +5`); addCoverage(9); return `-$${cost} paid (insurance helped), credit +5`; }
    },
    { label:"Call to negotiate or payment plan", hint:"Smaller hit, over time",
      apply:(st)=>{ const ins=st.plan.insurance; const cost=ins==="strong"?8:ins==="basic"?15:20; payFromCheckingThenCashThenSavings(cost); addLedgerLine(`Week 35: Medical bill payment plan -$${cost}/month`); addCoverage(9); return `-$${cost}/month payment plan`; },
      consequences:[{ triggerWeek:38, id:"c_med_plan2", label:"Medical Bill Payment 2", major:false, apply:(st)=>{ const ins=st.plan.insurance; const cost=ins==="strong"?8:ins==="basic"?15:20; payFromCheckingThenCashThenSavings(cost); addLedgerLine(`↩ Medical payment plan -$${cost}`); return `-$${cost} medical payment`; } }]
    },
    { label:"Ignore it for now", hint:"Risk credit damage",
      apply:(st)=>{ st.credit=Math.max(300,st.credit-15); addLedgerLine("Week 35: Ignored medical bill — credit -15"); return "Credit -15 for ignoring bill"; },
      consequences:[{ triggerWeek:39, id:"c_med_ignore", label:"Bill Sent to Collections", major:true,
        apply:(st)=>{ st.credit=Math.max(300,st.credit-20); payFromCheckingThenCashThenSavings(55); addLedgerLine("↩ Ignored medical bill → collections — credit -20, +$10 fee"); return "Medical bill went to collections. Credit -20 and $10 collection fee added. Always address bills early!"; } }]
    }
  ]
},

/* ══ WEEK 36 ══ */
{
  id:"w36_main", week:36, bonus:false, category:"ledger",
  title: j => `${j.name}: Slow February`,
  body:  j => "February is slow. You have two ways to grow: market yourself (flyers, social posts — costs $8) or wait for spring when demand naturally picks up.",
  options: (j,s) => [
    { label:"Spend $8 on marketing now", hint:"-$8, spring boost",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-8); addLedgerLine("Week 36: Marketing spend -$8"); return "-$8 marketing"; },
      consequences:[{ triggerWeek:41, id:"c_marketing", label:"Spring Marketing Payoff", major:false,
        apply:(st)=>{ st.bank.checking+=30; addLedgerLine("↩ February marketing paid off in spring +$30"); return "+$30 spring clients from February marketing"; } }]
    },
    { label:"Wait for spring naturally", hint:"No cost, normal growth",
      apply:(st)=>{ addLedgerLine("Week 36: Waiting for spring demand"); return "Waiting for spring"; }
    }
  ]
},
{
  id:"w36_bonus", week:36, bonus:true, category:"banking",
  title: j => "Bank Statement Error",
  body:  j => "Your bank statement shows a $14 fee you don't recognize — it wasn't disclosed when you opened the account. Dispute or accept it?",
  options: (j,s) => [
    { label:"Dispute the undisclosed fee", hint:"Likely win",
      apply:(st)=>{ st.bank.checking+=14; st.credit=Math.min(850,st.credit+3); addLedgerLine("Week 36 bonus: Disputed bank fee — $14 refund, credit +3"); addCoverage(6); addCoverage(11); return "+$14 refund, credit +3"; }
    },
    { label:"Pay it and move on", hint:"-$14 accepted",
      apply:(st)=>{ st.bank.checking=Math.max(0,st.bank.checking-14); addLedgerLine("Week 36 bonus: Accepted undisclosed fee -$14"); return "-$14 accepted"; }
    }
  ]
},

/* ══ WEEK 37 – March / Tax Season ══ */
{
  id:"w37_main", week:37, bonus:false, category:"billing",
  title: j => "Tax Refund or Owe?",
  body:  j => "Your taxes are filed. You're getting a $45 refund OR you owe $22 (depends on how you played). Either way, there's a decision: what do you do with refund / how do you pay if you owe?",
  options: (j,s) => [
    { label: state.credit >= 680 ? "Put refund in savings" : "Pay any owed taxes first",
      hint: state.credit >= 680 ? "+$45 savings" : "-$22 checking",
      apply:(st)=>{ if(st.credit>=680){ st.bank.savings+=45; addLedgerLine("Week 37: Tax refund to savings +$45"); addCoverage(10); return "+$45 refund to savings"; } else { payFromCheckingThenCashThenSavings(22); st.credit=Math.min(850,st.credit+5); addLedgerLine("Week 37: Paid tax owed -$22, credit +5"); addCoverage(10); return "-$22 taxes paid"; } }
    },
    { label:"Spend the refund on something fun", hint:"+$45 wants if refund",
      apply:(st)=>{ if(st.credit>=680){ st.cash+=45; st.plan.wants+=10; addLedgerLine("Week 37: Spent tax refund on fun"); return "Tax refund spent on fun"; } else { payFromCheckingThenCashThenSavings(22); addLedgerLine("Week 37: Had to pay taxes owed -$22"); return "Taxes owed — paid"; } }
    }
  ]
},

/* ══ WEEK 38 ══ */
{
  id:"w38_main", week:38, bonus:false, category:"contract",
  title: j => "Spring Contract Offer",
  body:  j => `A neighbor wants to sign a 2-month spring contract for your ${j.name} services — guaranteed weekly income but you'd have to turn down other opportunities.`,
  options: (j,s) => [
    { label:"Sign the spring contract", hint:"Steady income, March-April",
      apply:(st)=>{ const weekly=Math.round(st.plan.income/4); st.bank.checking+=weekly*2; addLedgerLine(`Week 38: Spring contract +$${weekly*2}`); addCoverage(10); addCoverage(13); return `+$${weekly*2} spring contract`; }
    },
    { label:"Stay flexible — no contract", hint:"Could earn more or less",
      apply:(st)=>{ addLedgerLine("Week 38: Declined spring contract"); return "Flexible, no contract"; }
    }
  ]
},
{
  id:"w38_bonus", week:38, bonus:true, category:"daily",
  title: j => "Spring Sport / Activity Sign-up",
  body:  j => "Spring sport registration is $55. It'd cut into work hours but is good for mental health and college apps. Pay or skip?",
  options: (j,s) => [
    { label:"Sign up — invest in yourself", hint:"-$55, work less",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-55); st.plan.income=Math.round(st.plan.income*0.9); st.credit=Math.min(850,st.credit+6); addLedgerLine("Week 38 bonus: Spring sport -$55, income -10%, credit +6"); return "-$55, income -10%, well-rounded credit +6"; }
    },
    { label:"Skip — focus on work and savings", hint:"No cost, full income",
      apply:(st)=>{ addLedgerLine("Week 38 bonus: Skipped spring sport"); return "Focused on work"; }
    }
  ]
},

/* ══ WEEK 39 ══ */
{
  id:"w39_main", week:39, bonus:false, category:"investing",
  title: j => "Spring Investing Opportunity",
  body:  j => "Your school is running a mock stock market game with real-money prizes. Entry fee: $10. Top 3 win $50, $30, $20. You'd be simulating real investing. Enter?",
  options: (j,s) => [
    { label:"Enter the competition — $10", hint:"-$10, chance to win $20-$50",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-10); addLedgerLine("Week 39: Entered stock competition -$10"); addCoverage(8); return "-$10 entry fee"; },
      consequences:[{ triggerWeek:43, id:"c_stock_comp", label:"Stock Competition Result", major:true,
        apply:(st)=>{ const place=Math.floor(Math.random()*5); if(place===0){ st.bank.checking+=50; addLedgerLine("↩ Won stock competition 1st place +$50!"); return "You won 1st place in the stock competition! +$50. Your research paid off!"; } else if(place===1){ st.bank.checking+=30; addLedgerLine("↩ Won stock competition 2nd place +$30"); return "2nd place in the competition! +$30. Great result!"; } else if(place===2){ st.bank.checking+=20; addLedgerLine("↩ Won stock competition 3rd place +$20"); return "3rd place — +$20! You got your money back plus more."; } else { addLedgerLine("↩ Stock competition — didn't place, lost $10 entry"); return "You didn't place but learned a lot about investing. The $10 was a learning fee."; } } }]
    },
    { label:"Skip — too risky for $10", hint:"No cost",
      apply:(st)=>{ addLedgerLine("Week 39: Skipped stock competition"); return "Skipped competition"; }
    }
  ]
},

/* ══ WEEK 40 ══ */
{
  id:"w40_main", week:40, bonus:false, category:"daily",
  title: j => "Peer Pressure: New Sneakers",
  body:  j => "Your friend group is getting new $80 sneakers. You have the money. But $80 is a big wants splurge. What do you do?",
  options: (j,s) => [
    { label:"Buy them — you've earned it", hint:"-$80 wants",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-80); st.plan.wants+=15; addLedgerLine("Week 40: Sneaker purchase -$80"); return "-$80 wants splurge"; },
      consequences:[{ triggerWeek:44, id:"c_sneakers_buy", label:"Sneaker Budget Impact", major:false,
        apply:(st)=>{ addLedgerLine("↩ Sneaker splurge tightened April budget"); return "That $80 sneaker purchase made April tighter. Watch wants spending near the year end."; } }]
    },
    { label:"Look for secondhand pair — $25", hint:"-$25 smart compromise",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-25); st.bank.savings+=35; addLedgerLine("Week 40: Secondhand sneakers -$25, saved $35"); return "-$25 smart buy, +$35 savings"; }
    },
    { label:"Skip — don't need them", hint:"No cost",
      apply:(st)=>{ st.bank.savings+=20; addLedgerLine("Week 40: Skipped sneakers, +$20 savings instead"); return "No sneakers, +$20 savings"; }
    }
  ]
},
{
  id:"w40_bonus", week:40, bonus:true, category:"ledger",
  title: j => "Spring Business Boom",
  body:  j => `Spring is here and demand for ${j.name} is back. You have two new clients wanting to start. Do you take both or stay at your current capacity?`,
  options: (j,s) => [
    { label:"Take both new clients", hint:"+$40 income/month",
      apply:(st)=>{ st.plan.income=Math.round(st.plan.income*1.15); addLedgerLine("Week 40 bonus: Added 2 spring clients — income +15%"); return "Income +15% from new clients"; }
    },
    { label:"Take one new client", hint:"+$20 income/month",
      apply:(st)=>{ st.plan.income=Math.round(st.plan.income*1.07); addLedgerLine("Week 40 bonus: Added 1 spring client — income +7%"); return "Income +7% from one new client"; }
    },
    { label:"Stay at current capacity", hint:"No change, less stress",
      apply:(st)=>{ addLedgerLine("Week 40 bonus: Stayed at current capacity"); return "Capacity unchanged"; }
    }
  ]
},

/* ══ WEEK 41 – April ══ */
{
  id:"w41_main", week:41, bonus:false, category:"inheritance",
  title: j => "Inheritance Echo: Final Tax Notice",
  body:  j => "Remember that windfall/gift from August? The IRS sends a final notice. You owe $18 in gift tax or you get a $15 credit (depending on how you handled it). This closes the inheritance loop.",
  options: (j,s) => [
    { label:"Pay what's owed / claim the credit", hint:"Closes the loop",
      apply:(st)=>{ const choiceKey = st.weekEngine.choices["w10_main"]; if(choiceKey===0){ st.bank.savings+=15; addLedgerLine("Week 41: Gift handled well — $15 tax credit"); addCoverage(5); addCoverage(10); return "+$15 tax credit for properly handled inheritance"; } else if(choiceKey===2){ payFromCheckingThenCashThenSavings(18); st.credit=Math.min(850,st.credit+4); addLedgerLine("Week 41: Gift tax notice — paid $18, closed loop, credit +4"); addCoverage(5); addCoverage(10); return "-$18 gift tax, loop closed, credit +4"; } else { st.bank.savings+=8; addLedgerLine("Week 41: Inheritance balance handled — $8 net"); addCoverage(5); return "+$8 net from balanced approach"; } }
    }
  ]
},

/* ══ WEEK 42 ══ */
{
  id:"w42_main", week:42, bonus:false, category:"banking",
  title: j => "April: CD Maturity or HYSA Withdrawal?",
  body:  j => "Any CDs you opened earlier are maturing. You can reinvest for the final stretch or cash out. Your HYSA has also been growing. Do you check and optimize?",
  options: (j,s) => [
    { label:"Reinvest maturing CDs", hint:"Max growth to year end",
      onSelect:({complete})=>{
        const val = Math.max(0, totalCdFunds());
        if(val <= 0){
          state.bank.savings += 10;
          addLedgerLine("Week 42: No CDs — added $10 directly");
          complete("+$10 to savings", { banner:"No active CDs, so the simulator gave a small savings boost instead." });
          return;
        }
        chooseFundingSource(val, `Roll ${money(val)} from maturing CDs into a fresh investment path. Choose which account to use:`, (src)=>{
          if(state.bank.cds && state.bank.cds.length) state.bank.cds = [];
          addToHysa(val, "CD rollover");
          addLedgerLine(`Week 42: Reinvested maturing CDs into HYSA — ${money(val)} from ${src}`);
          addCoverage(4); addCoverage(9);
          complete(`Moved ${money(val)} into HYSA for the final stretch`, { paymentInfo:{source:src, amount:val}, badge:`Rolled CDs into HYSA from ${formatSourceLabel(src)}` });
        });
      }
    },
    { label:"Cash out and put in HYSA", hint:"Flexible high growth",
      apply:(st)=>{ const val=totalCdFunds(); if(val>0){ st.bank.cds=[]; addToHysa(val); addLedgerLine(`Week 42: CD funds moved to HYSA — $${val}`); addCoverage(4); return `+$${val} to HYSA`; } else { st.bank.savings+=10; addLedgerLine("Week 42: No CDs — added $10 to HYSA"); addToHysa(10); return "+$10 to HYSA"; } }
    }
  ]
},
{
  id:"w42_bonus", week:42, bonus:true, category:"daily",
  title: j => "Prom / School Dance Spending",
  body:  j => "Prom is coming. All-in could hit $120 (ticket, outfit, dinner). Budget version: $40. Or skip it entirely.",
  options: (j,s) => [
    { label:"Go all-in — $120", hint:"-$120 wants splurge",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-120); st.plan.wants+=20; addLedgerLine("Week 42 bonus: Prom all-in -$120"); return "-$120 prom"; }
    },
    { label:"Budget prom — $40", hint:"-$40 smart compromise",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-40); addLedgerLine("Week 42 bonus: Budget prom -$40"); return "-$40 budget prom"; }
    },
    { label:"Skip prom — save the money", hint:"No cost",
      apply:(st)=>{ st.bank.savings+=50; addLedgerLine("Week 42 bonus: Skipped prom — +$50 savings"); return "+$50 savings from skipping prom"; }
    }
  ]
},

/* ══ WEEK 43 ══ */
{
  id:"w43_main", week:43, bonus:false, category:"ledger",
  title: j => `${j.name}: Year-End Business Review`,
  body:  j => "You've been working nearly a year. Your business is established. A competitor offers to buy your client list for $80. Do you sell, keep going, or ask for more?",
  options: (j,s) => [
    { label:"Sell the client list — $80", hint:"+$80, business ends",
      apply:(st)=>{ st.bank.checking+=80; st.plan.income=0; addLedgerLine("Week 43: Sold client list +$80, business ended"); return "+$80, business completed"; }
    },
    { label:"Keep going — you're not done", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 43: Kept going — didn't sell"); return "Continuing business"; }
    },
    { label:"Counter-offer at $120", hint:"Maybe get more",
      apply:(st)=>{ const accept=Math.random()>0.5; if(accept){ st.bank.checking+=120; st.plan.income=0; addLedgerLine("Week 43: Counter-offer accepted +$120"); return "+$120 counter-offer accepted!"; } else { addLedgerLine("Week 43: Counter-offer rejected"); return "Counter-offer rejected — kept business"; } }
    }
  ]
},

/* ══ WEEK 44 ══ */
{
  id:"w44_main", week:44, bonus:false, category:"daily",
  title: j => "Senior Year Prep Cost",
  body:  j => "College prep costs are hitting: SAT/ACT fees ($55), application fees ($40), etc. Do you budget for this or handle it differently?",
  options: (j,s) => [
    { label:"Pay SAT prep and app fees now — $95", hint:"-$95 investment in future",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-95); st.credit=Math.min(850,st.credit+6); addLedgerLine("Week 44: College prep fees -$95, credit +6"); return "-$95 college prep, credit +6"; }
    },
    { label:"Use savings — it's worth it", hint:"-$95 from savings",
      apply:(st)=>{ st.bank.savings=Math.max(0,st.bank.savings-95); st.credit=Math.min(850,st.credit+6); addLedgerLine("Week 44: College fees from savings -$95, credit +6"); return "-$95 from savings, credit +6"; }
    },
    { label:"Look for fee waivers first", hint:"Maybe free",
      apply:(st)=>{ const waiver=Math.random()>0.4; if(waiver){ st.credit=Math.min(850,st.credit+6); addLedgerLine("Week 44: Got fee waiver — no cost, credit +6"); return "Fee waiver approved! No cost, credit +6"; } else { st.cash=Math.max(0,st.cash-55); addLedgerLine("Week 44: Partial fees -$55 after waiver search"); return "-$55 after waiver attempt"; } }
    }
  ]
},
{
  id:"w44_bonus", week:44, bonus:true, category:"savings",
  title: j => "Savings Goal Final Push",
  body:  j => `You have 4 weeks left. Your savings goal was $${state.savingsGoal}. You're at $${state.bank.savings + state.bank.hysaPrincipal}. Do you make a final push?`,
  options: (j,s) => [
    { label:"Final push — cut all wants this month", hint:"Max savings, tight month",
      apply:(st)=>{ const cut=Math.min(40,st.plan.wants); st.plan.wants=Math.max(0,st.plan.wants-cut); st.bank.savings+=cut; addLedgerLine(`Week 44 bonus: Final savings push +$${cut}`); return `+$${cut} to savings from final push`; }
    },
    { label:"Stay the course", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 44 bonus: Staying course on savings"); return "Steady as she goes"; }
    }
  ]
},

/* ══ WEEK 45 – May ══ */
{
  id:"w45_main", week:45, bonus:false, category:"contract",
  title: j => "Final Contract Decision",
  body:  j => "Any active contracts are coming up for renewal in May. This is your last chance to review all active subscriptions and contracts before the year ends.",
  options: (j,s) => [
    { label:"Cancel everything unnecessary", hint:"Save monthly costs",
      apply:(st)=>{ const saved = st.contractActive ? (CONTRACTS.find(x=>x.id===st.contractId)||CONTRACTS[0]).monthly : 0; st.contractActive=false; st.bank.checking+=saved; addLedgerLine(`Week 45: Cancelled all unneeded contracts, saved $${saved}/mo`); addCoverage(10); addCoverage(13); return saved>0 ? `+$${saved} monthly savings, contracts cleaned up` : "No active contracts — already clean"; }
    },
    { label:"Keep what I'm using", hint:"Ongoing costs continue",
      apply:(st)=>{ addLedgerLine("Week 45: Kept active contracts"); return "Active contracts continue"; }
    }
  ]
},

/* ══ WEEK 46 ══ */
{
  id:"w46_main", week:46, bonus:false, category:"banking",
  title: j => "End-of-Year Banking Review",
  body:  j => "One month left. Review your banking setup. Your checking and savings have grown all year. Do you do anything final with the money?",
  options: (j,s) => [
    { label:"Max out HYSA before year ends", hint:"Best interest for final month",
      apply:(st)=>{ const move=Math.min(st.bank.checking-20, 50); if(move>0){ st.bank.checking-=move; addToHysa(move); addLedgerLine(`Week 46: Moved $${move} to HYSA for year-end`); addCoverage(4); return `+$${move} to HYSA`; } else { addLedgerLine("Week 46: Not enough to move to HYSA"); return "Already optimized"; } }
    },
    { label:"Keep current setup", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 46: Kept current banking setup"); return "Banking unchanged"; }
    }
  ]
},
{
  id:"w46_bonus", week:46, bonus:true, category:"daily",
  title: j => "Graduation Gift Spending",
  body:  j => "A family friend graduated and you want to give them something. Cards are $5, a $20 gift card is thoughtful, or skip it since you have finals.",
  options: (j,s) => [
    { label:"$20 gift card — generous", hint:"-$20 cash",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-20); addLedgerLine("Week 46 bonus: Grad gift -$20"); return "-$20 gift"; }
    },
    { label:"$5 card — thoughtful and affordable", hint:"-$5",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-5); addLedgerLine("Week 46 bonus: Grad card -$5"); return "-$5 card"; }
    },
    { label:"No gift — focused on finals", hint:"No cost",
      apply:(st)=>{ addLedgerLine("Week 46 bonus: Skipped grad gift, focused on finals"); return "No gift"; }
    }
  ]
},

/* ══ WEEK 47 ══ */
{
  id:"w47_main", week:47, bonus:false, category:"ledger",
  title: j => "Second-to-Last Week — Wind Down",
  body:  j => `Your ${j.name} year is almost done. Any remaining inventory or supplies? Sell them back for 50% value, donate them, or keep for next year.`,
  options: (j,s) => [
    { label:"Sell back supplies — 50% value", hint:"Recover some cash",
      apply:(st)=>{ const val = Math.round(calcInventoryValue() * 0.5); if(val>0){ st.cash+=val; addLedgerLine(`Week 47: Sold back inventory for $${val}`); return `+$${val} from inventory sale`; } else { addLedgerLine("Week 47: No inventory to sell"); return "No inventory"; } }
    },
    { label:"Donate supplies", hint:"No cash, community good",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+4); addLedgerLine("Week 47: Donated supplies — credit +4"); return "Donated, credit +4"; }
    },
    { label:"Keep for next year", hint:"No change",
      apply:(st)=>{ addLedgerLine("Week 47: Kept supplies for next year"); return "Supplies saved"; }
    }
  ]
},

/* ══ WEEK 48 – Final Week of May ══ */
{
  id:"w48_main", week:48, bonus:false, category:"daily",
  title: j => "🎓 Year Complete — Final Reflection",
  body:  j => `You made it through a full year of ${j.name}! Looking back, you made dozens of financial choices. What's your final move with any remaining cash?`,
  options: (j,s) => [
    { label:"Put everything extra in savings", hint:"Best financial finish",
      apply:(st)=>{ const extra=Math.min(st.cash, 50); if(extra>0){ st.cash-=extra; st.bank.savings+=extra; } st.credit=Math.min(850,st.credit+5); addLedgerLine(`Week 48: Final year savings push +$${extra}, credit +5`); addCoverage(3); addCoverage(12); return `+$${extra} savings, credit +5 — great year!`; }
    },
    { label:"Celebrate a little — $20 fun", hint:"-$20 earned treat",
      apply:(st)=>{ st.cash=Math.max(0,st.cash-20); st.bank.savings+=15; addLedgerLine("Week 48: Year-end celebration -$20, saved $15"); return "-$20 celebration, +$15 savings"; }
    },
    { label:"Invest the remainder in HYSA", hint:"Future-focused finish",
      apply:(st)=>{ const extra=Math.min(st.cash, 60); if(extra>0){ st.cash-=extra; addToHysa(extra); } st.credit=Math.min(850,st.credit+6); addLedgerLine(`Week 48: Year-end HYSA invest +$${extra}, credit +6`); addCoverage(8); addCoverage(12); return `+$${extra} to HYSA, credit +6 — future-focused finish!`; }
    }
  ]
},
{
  id:"w48_bonus", week:48, bonus:true, category:"savings",
  title: j => "Savings Goal Reached?",
  body:  j => `Your savings goal was $${state.savingsGoal}. Total saved (savings + HYSA): $${state.bank.savings + state.bank.hysaPrincipal}. ${(state.bank.savings + state.bank.hysaPrincipal) >= state.savingsGoal ? "You hit your goal! 🎉" : "Close but not quite."} What do you take away from this year?`,
  options: (j,s) => [
    { label:"I'll start next year with a bigger goal", hint:"+credit milestone",
      apply:(st)=>{ st.credit=Math.min(850,st.credit+8); addLedgerLine("Week 48 bonus: Year reflection — bigger goals ahead, credit +8"); addCoverage(12); return "Growth mindset — credit +8. See you next year!"; }
    },
    { label:"I'll focus on cutting wants next year", hint:"+savings mindset",
      apply:(st)=>{ st.bank.savings+=15; addLedgerLine("Week 48 bonus: Committed to cutting wants next year +$15"); addCoverage(3); return "+$15 symbolic savings commitment"; }
    }
  ]
}

]; /* end WEEKLY_SCENARIOS */

/* ── Engine integration: add to state ───────────────────── */
/* Called once at mission start to initialize the engine */
function initWeekEngine(){
  state.weekEngine = {
    week: 1,          // current week 1-48
    choices: {},      // scenario id → choice index made
    pending: [],      // consequence queue
    ranBonus: {},     // week → true if bonus already ran
    masterScenarioLocks: {}
  };
  ensureStandardV1State();
  state.masterScenario = { played:{}, trackCounts:{}, firedWindows:{}, stress:0, wantsPressure:0, needsPressure:0 };
  state.standardV1.pressureTracks = { basics:0, bills:0, impulse:0, resilience:0 };
  state.standardV1.chainHistory = [];
  state.standardV1.chainWindowsFired = {};
}

/* Get scenarios for a given week */
function getScenariosForWeek(week){
  return WEEKLY_SCENARIOS.filter(s => s.week === week);
}

/* Should the bonus scenario fire? */
function shouldFireBonus(scenario){
  if(!scenario.bonus) return false;
  if(state.weekEngine.ranBonus[scenario.week]) return false;
  // Conditional trigger
  if(scenario.triggerIf){
    return scenario.triggerIf(state.weekEngine.choices);
  }
  // Random ~37%
  return Math.random() < 0.37;
}

/* Main weekly scenario runner — called from nextWeek() */
function runWeeklyScenarios(week, onAllDone){
  const all = getScenariosForWeek(week);
  const main = all.find(s => !s.bonus);
  // Support multiple bonus scenarios per week (filter, not find)
  const bonuses = all.filter(s => s.bonus && shouldFireBonus(s));
  const queue = [];

  if(main) queue.push(main);
  bonuses.forEach(b => {
    queue.push(b);
    state.weekEngine.ranBonus[week] = true;
  });

  let idx = 0;
  function runNext(){
    if(idx >= queue.length){ if(onAllDone) onAllDone(); return; }
    const s = queue[idx++];
    openScenarioModal(s, runNext);
  }
  runNext();
}

/* Update the header week/month display */
function renderWeekHeader(){
  const w = state.weekEngine ? state.weekEngine.week : 1;
  const cal = WEEK_CALENDAR[Math.min(w,48)] || WEEK_CALENDAR[1];
  if($("weekNum")) $("weekNum").textContent = w;
  if($("monthName")) $("monthName").textContent = cal.name;
  // Also update internal state.day to the calendar month for existing logic
  state.day = cal.m;
}


/* =========================
   WGLT Budget Boss (Clean Single File)
   Upgrades included:
   - Full watermark (header + main background)
   - Glow highlights BOTH required tab + required button
   - Optional auto-jump to required tab when student clicks "Got it"
========================= */

const $ = (id)=>document.getElementById(id);
const money = (n)=>"$" + Math.max(0, Math.round(n)).toLocaleString();
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));

/* Sound FX */
let audioCtx=null;
function beep(type="success"){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const now=audioCtx.currentTime;
    const seq={ success:[660,880], warn:[440,330], click:[520], fail:[220,180] }[type]||[600];
    g.gain.setValueAtTime(0.0001,now);
    g.gain.exponentialRampToValueAtTime(0.12,now+0.01);
    let t=now; seq.forEach(hz=>{ o.frequency.setValueAtTime(hz,t); t+=0.09; });
    g.gain.exponentialRampToValueAtTime(0.0001,now+0.25);
    o.start(now); o.stop(now+0.26);
  }catch(e){}
}

/* Modal */
function openModal({title,meta="",body="",buttons=[{id:"close",label:"Close",kind:"secondary"}],onPick=null}){
  $("mTitle").textContent=title;
  $("mMeta").textContent=meta;
  $("mBody").textContent=body;

  const foot=$("mFoot"); foot.innerHTML="";
  buttons.forEach(b=>{
    const btn=document.createElement("button");
    btn.className="btn "+(b.kind||"secondary");
    if(b.kind==="primary") btn.className="btn";
    if(b.kind==="success") btn.className="btn success";
    if(b.kind==="warn") btn.className="btn warn";
    if(b.kind==="danger") btn.className="btn danger";
    btn.textContent=b.label;
    btn.onclick=()=>{ beep("click"); closeModal(); onPick && onPick(b.id); };
    foot.appendChild(btn);
  });

  $("overlay").classList.add("show");
  $("overlay").setAttribute("aria-hidden","false");
}
function closeModal(){
  $("overlay").classList.remove("show");
  $("overlay").setAttribute("aria-hidden","true");
}
$("overlay").addEventListener("click",(e)=>{ if(e.target===$("overlay")) closeModal(); });

/* Banner */
let bannerTimer=null;
function showBanner(text){
  $("bannerText").textContent=text;
  $("banner").classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer=setTimeout(()=> $("banner").classList.remove("show"), 1400);
}

/* Benchmarks */



/* Bank products */


/* Contracts (6) */


/* Jobs */


/* Ledger item catalog per job (tap-only) */


/* State */
const state = {
  cash: 200,
  day: 1,
  credit: 650,

  teacherMode:true,
  presentationRole:"teacher",
  experienceLevel:"standard",
  currentMode:"teacher_standard",
  lockMode:false,
  standardV1:{
    weeklyGoals:{},
    goalHistory:[],
    healthHistory:[],
    choiceEchoLog:[]
  },

  bank: {
    checking: 0,
    savings: 0,
    checkingType: null,
    savingsType: null,
    cds: [],
    startupFeePaid: false,
    hysaPrincipal: 0,
    hysaDeposits: 0,
    hysaAccrued: 0,
    hysaLastGrowth: 0,
    startCheckingDeposit: 0,
    startSavingsDeposit: 0
  },

  plan: {
    income: 320,
    taxPct: 10,
    needs: 224,
    wants: 32,
    wantsExtras: 0,
    wantsSelections: [],
    wantsCommitted: false,
    save: 48,
    debtPay: 16,
    unplannedWantUsedThisMonth: false,
    unplannedWantLabelsThisMonth: [],
    insurance: "basic",
    model: "rule702010",
    chosenForYear: false,
    lockedForYear: false,
    appliedMonths: new Set()
  },

  checkAmount: 10,
  localTaxDue: 0,

  contractActive: false,
  contractId: null,
  contractLedger: { chargedMonths:{} },

  savingsGoal: 0,
  _wantsRefreshCallback: null,
  savingsMilestones: new Set(),
  savingsGoalChoice: null,


  ledger: {
    inventory: {},
    weekExpenses: 0,
    weekIncome: 0,
    weekProfit: 0,
    history: []
  },

  coverage: new Set(),

  jobs: JOBS,
  jobIndex: 3,

  mission: { active:false, paused:false, index:0, waitingAction:null, steps:[] },
  jobLocked: false,

  playlist: { active:false, paused:false, loop:false, index:0, items:["inheritance","dispute","gen_local_tax","contract_pick"] },
  ui: { pendingBudgetSheetReview:false, suppressDecisionReflections:false, realLifeSelections:{}, randomEventPendingType:null, randomEventCycling:false },
  elite: {
    investments: { stocks:0, costBasis:0, lastChange:0, history:[] },
    career: { level:1, title:'Starter Worker', promotions:0, payBonus:0, history:[] },
    endings: { final:null, track:'⚖️ Survivor' }
  }
};

/* Coverage tracking */
function addCoverage(b){ state.coverage.add(b); }
function trackCoverageForAction(action){
  const map = {
    startup_choose:[1,6,12,3],
    savings_goal:[12,3],
    suggested_plan:[3,7],
    apply_plan:[7],
    next_week:[9,12],
    ledger_buy:[3,1],
    ledger_use:[3],
    ledger_expense:[3],
    job_event:[3,6,12],
    gen_local_tax:[8],
    pay_local_tax:[8],
    inheritance:[5,3],
    dispute:[11,13],
    contract_pick:[10,13],
    review_contract:[10,13],
    write_check:[2,1],
    deposit_check:[1,2],
    transfer_savings:[1,12],
    open_cd:[9,12],
    view_budget_sheet:[12,3]
  };
  (map[action]||[]).forEach(addCoverage);
}

/* Scroll to a button by id after the browser has painted */
function scrollToBtn(id){
  setTimeout(function(){
    var el = document.getElementById(id);
    if(el) el.scrollIntoView({ behavior:"smooth", block:"center" });
  }, 0);
}

/* Required action glow + lock */
function clearGlow(){
  document.querySelectorAll(".glow").forEach(el=>el.classList.remove("glow"));
  document.querySelectorAll(".glow-next").forEach(el=>el.classList.remove("glow-next"));
}
function getRandomEventButtonId(type){
  return type === "job" ? "btnJobEvent" : type === "life" ? "btnSchoolEvent" : "btnSocialEvent";
}
function clearRandomEventPending(){
  if(!state.ui) state.ui = {};
  state.ui.randomEventPendingType = null;
  state.ui.randomEventCycling = false;
}
function applyRandomEventButtonState(){
  if(!state.ui) return;

  const choiceIds = ["btnJobEvent","btnSchoolEvent","btnSocialEvent"];
  const allIds = [...choiceIds, "btnRandomEvent"];
  allIds.forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.classList.remove("glow-next");
    el.style.filter = "";
    el.style.opacity = "";
  });

  const waiting = state.mission && state.mission.active ? state.mission.waitingAction : null;
  const randomBtn = $("btnRandomEvent");

  if(state.ui.randomEventCycling){
    if(randomBtn){
      randomBtn.disabled = true;
      randomBtn.classList.remove("glow-next");
    }
    choiceIds.forEach(id=>{
      const el = $(id);
      if(el){
        el.disabled = true;
        el.style.filter = "grayscale(1)";
        el.style.opacity = ".6";
      }
    });
    return;
  }

  const pending = state.ui.randomEventPendingType;
  if(pending){
    const allowedId = getRandomEventButtonId(pending);
    if(randomBtn){
      randomBtn.disabled = true;
      randomBtn.style.filter = "grayscale(1)";
      randomBtn.style.opacity = ".6";
    }
    choiceIds.forEach(id=>{
      const el = $(id);
      if(!el) return;
      if(id === allowedId){
        el.disabled = false;
        el.classList.add("glow-next");
        el.style.filter = "";
        el.style.opacity = "1";
      } else {
        el.disabled = true;
        el.style.filter = "grayscale(1)";
        el.style.opacity = ".6";
      }
    });
    return;
  }

  if(waiting === "job_event" && randomBtn){
    randomBtn.classList.add("glow-next");
    randomBtn.disabled = false;
  }
}
function requiredControlForAction(action){
  const map = {
    startup_choose:{tab:"bank", el:"btnChooseStartup"},
    savings_goal:{tab:"plan", el:"btnSavingsChallenge"},
    suggested_plan:{tab:"plan", el:"btnSuggestedPlan"},
    apply_plan:{tab:"plan", el:"btnApplyPlan"},
    ledger_buy:{tab:"ledger", el:"btnLedgerBuy"},
    job_event:{tab:"events", el:"btnJobEvent"},
    gen_local_tax:{tab:"events", el:"btnGenLocalTax"},
    pay_local_tax:{tab:"events", el:"btnPayLocalTax"},
    dispute:{tab:"events", el:"btnDispute"},
    inheritance:{tab:"events", el:"btnInheritance"},
    contract_pick:{tab:"contracts", el:"btnOpenContract"},
    review_contract:{tab:"contracts", el:"btnOpenContract"},
    next_week:{tab:"plan", el:"btnNextWeek"},
    write_check:{tab:"bank", el:"btnWriteCheck"},
    deposit_check:{tab:"bank", el:"btnDepositCheck"},
    transfer_savings:{tab:"bank", el:"btnTransferToSavings"},
    open_cd:{tab:"bank", el:"btnOpenCD"},
    view_budget_sheet:{tab:"sheet", el:null}
  };
  return map[action] || null;
}

function applyLockRules(){
  const waiting = state.mission.active ? state.mission.waitingAction : null;
  const step = state.mission.active ? state.mission.steps[state.mission.index] : null;
  const isNonBlocking = step && step.nonBlocking;

  // Glow ALWAYS when waiting exists (tab + button)
  clearGlow();
  const req = waiting ? requiredControlForAction(waiting) : null;

  // Most required tabs glow blue, but Budget Sheet pulses green so students know to click it
  if(req?.tab){
    const tabEl = document.querySelector(`.tab[data-tab="${req.tab}"]`);
    if(tabEl){
      if(waiting === "view_budget_sheet") tabEl.classList.add("glow-next");
      else tabEl.classList.add("glow");
    }
  }
  if(req?.el && $(req.el)) $(req.el).classList.add("glow-next");

  // Monthly snapshot review uses a green pulse on the Budget Sheet tab
  if(state.ui && state.ui.pendingBudgetSheetReview){
    const sheetTab = document.querySelector('.tab[data-tab="sheet"]');
    if(sheetTab) sheetTab.classList.add("glow-next");
  }

  // lock only disables others if lockMode ON AND step is not non-blocking
  if ($("lockHint")) $("lockHint").classList.toggle("show", state.lockMode && !isNonBlocking);

  if(!state.lockMode || !waiting || isNonBlocking){
    
  if($("modeStudentBeginnerBtn")) $("modeStudentBeginnerBtn").onclick=()=>{ beep("click"); selectConfiguration('student','beginner'); };
  if($("modeStudentStandardBtn")) $("modeStudentStandardBtn").onclick=()=>{ beep("click"); selectConfiguration('student','standard'); };
  if($("modeStudentEliteBtn")) $("modeStudentEliteBtn").onclick=()=>{ beep("click"); selectConfiguration('student','elite'); };
  if($("modeTeacherBeginnerBtn")) $("modeTeacherBeginnerBtn").onclick=()=>{ beep("click"); selectConfiguration('teacher','beginner'); };
  if($("modeTeacherStandardBtn")) $("modeTeacherStandardBtn").onclick=()=>{ beep("click"); selectConfiguration('teacher','standard'); };
  if($("modeTeacherEliteBtn")) $("modeTeacherEliteBtn").onclick=()=>{ beep("click"); selectConfiguration('teacher','elite'); };
  if($("btnLoadLocalFromMenu")) $("btnLoadLocalFromMenu").onclick=()=>{ beep("click"); loadTeacherLocal(); };
  if($("btnImportSaveFromMenu")) $("btnImportSaveFromMenu").onclick=()=>{ beep("click"); promptTeacherSaveUpload(); };
  if($("saveFileInput")) $("saveFileInput").addEventListener("change", e=> importTeacherSave(e.target.files && e.target.files[0]));
  if($("btnSaveLocal")) $("btnSaveLocal").onclick=()=>{ beep("click"); saveTeacherLocal(); };
  if($("btnLoadLocal")) $("btnLoadLocal").onclick=()=>{ beep("click"); loadTeacherLocal(); };
  if($("btnDownloadSave")) $("btnDownloadSave").onclick=()=>{ beep("click"); downloadTeacherSave(); };
  if($("btnUploadSave")) $("btnUploadSave").onclick=()=>{ beep("click"); promptTeacherSaveUpload(); };
  if($("btnQuitToMenu")) $("btnQuitToMenu").onclick=()=>{ beep("click"); goTeacherMainMenu(); };
  if($("btnOpenReflection")) $("btnOpenReflection").onclick=()=>{ beep("click"); openTeacherReflectionModal(); };
  if($("btnOpenReflectionReport")) $("btnOpenReflectionReport").onclick=()=>{ beep("click"); openTeacherReflectionModal(); };
  if($("btnReflectionReport")) $("btnReflectionReport").onclick=()=>{ beep("click"); toggleReflectionReport(); };

document.querySelectorAll(".tab").forEach(t=>{ t.style.opacity="1"; t.style.cursor="pointer"; });
    document.querySelectorAll("button").forEach(b=> b.disabled=false);
    applyRandomEventButtonState();
    return;
  }

  const requiredElId = req ? req.el : null;
  const always = new Set([
    "btnPauseMission","btnResetMission","btnStartMission","jobPrev","jobNext",
    "playlistStart","playlistPause","playlistLoop","btnPlaylistNext","btnPlaylistProgress"
  ]);

  document.querySelectorAll("button").forEach(b=>{
    if(always.has(b.id)) { b.disabled=false; return; }
    b.disabled = (b.id !== requiredElId);
  });

  document.querySelectorAll(".tab").forEach(tab=>{
    const requiredTab = req?.tab;
    const tabName = tab.dataset.tab;

    // Budget Sheet should always stay viewable, even when another task is locked in.
    if(tabName === "sheet"){
      tab.style.opacity = "1";
      tab.style.cursor = "pointer";
      return;
    }

    tab.style.opacity = (tabName===requiredTab) ? "1" : ".55";
    tab.style.cursor = (tabName===requiredTab) ? "pointer" : "not-allowed";
  });

  // auto-open required tab in lock mode (use auto flag to avoid triggering notifyAction)
  // but don't auto-open for non-blocking steps, and never yank the student away from Budget Sheet
  const activeTabEl = document.querySelector(".tab.active");
  const activeTab = activeTabEl ? activeTabEl.dataset.tab : null;
  if(req?.tab && !isNonBlocking && req.tab !== "sheet" && activeTab !== "sheet") openTab(req.tab, {auto:true});
  applyRandomEventButtonState();
}

/* Tabs */
function openTab(name, opts={}){
  if(state.lockMode && state.mission.active && state.mission.waitingAction && name !== "sheet"){
    const step = state.mission.steps[state.mission.index];
    const isNonBlocking = step && step.nonBlocking;
    if(!isNonBlocking){
      const req = requiredControlForAction(state.mission.waitingAction);
      if(req?.tab && req.tab !== name){
        beep("warn");
        showBanner("Finish the glowing step");
        return;
      }
    }
  }
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  const t=[...document.querySelectorAll(".tab")].find(x=>x.dataset.tab===name);
  if(t) t.classList.add("active");
  const p=$("panel-"+name);
  if(p) p.classList.add("active");

  // Monthly snapshot review: once the student clicks Budget Sheet, resume the new month flow
  if(name === "sheet" && !opts.auto){
    if(state.ui && state.ui.pendingBudgetSheetReview){
      state.ui.pendingBudgetSheetReview = false;
      applyLockRules();
      setTimeout(()=>{
        const finishMonthReviewFlow = ()=>{
          if(state.ui) state.ui.suppressDecisionReflections = false;
          if(state.weekEngine && state.mission.active){
            runWeeklyScenarios(state.weekEngine.week, ()=>{
              renderAll();
              renderSheet();
              notifyAction("next_week");
            });
          }
        };
        promptWeeklyGoalIfNeeded(finishMonthReviewFlow);
      }, 220);
    } else {
      const currentStep = state.mission.active ? state.mission.steps[state.mission.index] : null;
      const expectsBudgetSheet = !!(currentStep && currentStep.requireActions && currentStep.requireActions.includes("view_budget_sheet"));
      if(expectsBudgetSheet){
        notifyAction("view_budget_sheet");
      }
    }
  }

  // keep glow accurate after switching tabs
  applyLockRules();
  refreshPreMissionPulse();
}

/* UI render */
function renderHeader(){
  $("cash").textContent = money(state.cash);
  if($("day")) $("day").textContent = state.day;
  if(typeof renderWeekHeader === "function") renderWeekHeader();
  $("credit").textContent = state.credit;
  if ($("creditInlineVal")) $("creditInlineVal").textContent = state.credit;
  $("goalBadge").textContent = money(state.savingsGoal);
  if ($("goalStatusInline")) $("goalStatusInline").textContent = state.savingsGoal ? `${money(state.savingsGoal)} by Month 12` : "Not set";
  if ($("budgetModelLabel")) $("budgetModelLabel").textContent = getBudgetModelName();
  if ($("planLockLabel")) $("planLockLabel").textContent = state.plan.lockedForYear ? "Locked" : "Unlocked";
  $("checkingVal").textContent = money(state.bank.checking);
  $("savingsVal").textContent = money(state.bank.savings);
  if ($("cashBankVal")) $("cashBankVal").textContent = money(state.cash);
  $("localTaxDue").textContent = money(state.localTaxDue);

  if ($("toggleTeacher")) $("toggleTeacher").checked = state.teacherMode;
  if ($("toggleLock")) $("toggleLock").checked = state.lockMode;

  const ct = state.bank.checkingType ? BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType)?.name : "Not chosen";
  const st = state.bank.savingsType ? BANK_PRODUCTS.savings.find(x=>x.id===state.bank.savingsType)?.name : "Not chosen";
  $("bankTypeLabel").textContent = `Bank Types: Checking = ${ct} • Savings = ${st}`;

  $("insValLabel").textContent = state.plan.insurance[0].toUpperCase() + state.plan.insurance.slice(1);

  $("incomeVal").textContent = money(state.plan.income);
  $("taxVal").textContent = `${state.plan.taxPct}%`;
  $("needsVal").textContent = money(state.plan.needs);
  $("wantsVal").textContent = money(state.plan.wants + state.plan.wantsExtras);
  updateWantsUI();
  $("saveVal").textContent = money(state.plan.save + state.plan.debtPay);
  $("debtVal").textContent = `S ${money(state.plan.save)} • D ${money(state.plan.debtPay)}`;

  $("checkAmt").textContent = money(state.checkAmount);

  $("contractState").textContent = state.contractActive ? "Active" : "None";

  $("insExplain").textContent =
    state.plan.insurance==="none" ? "No insurance: emergencies cost more. Monthly cost: $0." :
    state.plan.insurance==="basic" ? "Basic insurance: some emergencies are reduced. Monthly cost: $8." :
    "Strong insurance: emergencies are reduced the most. Monthly cost: $15.";

  $("invVal").textContent = money(calcInventoryValue());
  $("wkExp").textContent = money(state.ledger.weekExpenses);
  $("wkProfit").textContent = money(state.ledger.weekProfit);

  if ($("bankChoiceStatus")) {
    const insuranceLabel = state.plan.insurance ? state.plan.insurance[0].toUpperCase() + state.plan.insurance.slice(1) : "Not chosen";
    $("bankChoiceStatus").textContent = `Checking: ${ct}
Savings: ${st}
Insurance: ${insuranceLabel}`;
  }
  if ($("choiceImpactBox")) {
    $("choiceImpactBox").textContent = getChoiceImpactText();
  }

  updateImpactStrip();
  renderCDStatus();
  renderBucketTracker();
  renderMeters();
  renderBankJars();
  renderEliteOverview();
}



function renderBankJars(){
  const ids = ["jarCheckingFill","jarSavingsFill","jarCashFill","jarHysaFill","jarCdFill"];
  if(!ids.every(id => $(id))) return;
  reconcileHysaBalance();
  const cdTotal = (state.bank.cds || []).reduce((sum, cd) => sum + (cd.principal || 0) + (cd.accrued || 0), 0);
  const values = {
    checking: state.bank.checking || 0,
    savings: state.bank.savings || 0,
    cash: state.cash || 0,
    hysa: (state.bank.hysaPrincipal || 0) + (state.bank.hysaAccrued || 0),
    cd: cdTotal
  };
  const scale = Math.max(1000, ...Object.values(values));
  if($("bankJarScaleLabel")) $("bankJarScaleLabel").textContent = `Scale: $0 to ${money(scale)}`;
  const map = [
    ["jarCheckingFill","jarCheckingAmt",values.checking],
    ["jarSavingsFill","jarSavingsAmt",values.savings],
    ["jarCashFill","jarCashAmt",values.cash],
    ["jarHysaFill","jarHysaAmt",values.hysa],
    ["jarCdFill","jarCdAmt",values.cd]
  ];
  map.forEach(([fillId, amtId, amount]) => {
    const pct = Math.max(0, Math.min(100, Math.round((amount / scale) * 100)));
    $(fillId).style.height = pct + "%";
    $(amtId).textContent = money(amount);
    $(fillId).title = `${money(amount)} of ${money(scale)}`;
  });
}

function renderBucketTracker(){
  if(!$("bucketTracker")) return;
  const job = state.jobs[state.jobIndex];
  const jobBuckets = new Set(job.buckets || []);
  const alwaysPossible = new Set([4,5,6,7,8,9,10,11,12,13]);
  const relevant = Object.entries(BENCH).filter(([k]) => jobBuckets.has(Number(k)) || alwaysPossible.has(Number(k)));

  const html = relevant.map(([k,name])=>{
    const done = state.coverage.has(Number(k));
    const isJobBucket = jobBuckets.has(Number(k));
    const border = isJobBucket ? "border:2px solid var(--primary)" : "border:1px solid var(--border)";
    return `<button class="tracker-item ${done ? 'done' : ''}" style="${border};text-align:left;width:100%;cursor:pointer" onclick="showBucketInfo(${k})" type="button" aria-label="Open Benchmark ${k} definition">
      ${done ? '✅' : '⬜'} Benchmark #${k}<br><small>${name}</small><div style="margin-top:6px;color:var(--primary2);font-size:11px;text-decoration:underline">Tap for definition</div>
    </button>`;
  }).join('');
  $("bucketTracker").innerHTML = html;
}

function renderMeters(){
  reconcileHysaBalance();
  const hysaTotal = state.bank.hysaPrincipal;
  const hysaFill = $("hysaMeterFill");
  const hysaText = $("hysaMeterText");
  if(hysaFill && hysaText){
    if(state.bank.hysaPrincipal > 0){
      const pct = Math.min(100, Math.round((hysaTotal / Math.max(25, state.savingsGoal || hysaTotal)) * 100));
      hysaFill.style.width = pct + "%";
      const projected = state.bank.hysaPrincipal >= 25 ? Math.max(1, Math.round(state.bank.hysaPrincipal * 0.04)) : 0;
      const projNote = projected > 0
        ? `📈 Projected next month: +${money(projected)} (4% APR on ${money(state.bank.hysaPrincipal)})`
        : `Need $25 minimum to earn growth`;
      hysaText.textContent = `Principal: ${money(state.bank.hysaPrincipal)} | Earned so far: ${money(state.bank.hysaAccrued)} | ${projNote}`;
    } else {
      hysaFill.style.width = "0%";
      hysaText.textContent = "Add $25+ to a High-Yield account to see projected growth here.";
    }
  }
  const cdFill = $("cdMeterFill");
  const cdText = $("cdMeterText");
  const cdWrap = $("cdMetersWrap");
  if(cdWrap) cdWrap.innerHTML = "";
  if(cdFill && cdText){
    if(state.bank.cds.length){
      const sortedCds = state.bank.cds.slice().sort((a,b)=>a.monthsLeft-b.monthsLeft);
      const nextCd = sortedCds[0];
      const pct = Math.min(100, Math.round(((nextCd.termMonths - nextCd.monthsLeft) / nextCd.termMonths) * 100));
      cdFill.style.width = pct + "%";
      const cdProjected = Math.max(1, Math.round(nextCd.principal * (nextCd.apr/100)));
      cdText.textContent = `${nextCd.name}: ${nextCd.monthsLeft} mo left | Principal ${money(nextCd.principal)} | Growth earned: ${money(nextCd.accrued)} | 📈 Next month: +${money(cdProjected)}`;
      if(cdWrap){
        sortedCds.forEach((cd, idx)=>{
          const rowPct = Math.min(100, Math.round(((cd.termMonths - cd.monthsLeft) / cd.termMonths) * 100));
          const rowProjected = Math.max(1, Math.round(cd.principal * (cd.apr/100)));
          cdWrap.innerHTML += `
            <div class="meter" style="margin:0">
              <div style="font-weight:900">CD #${idx+1}: ${cd.name}</div>
              <div class="muted">${cd.monthsLeft} mo left | Principal ${money(cd.principal)} | Growth earned ${money(cd.accrued)} | 📈 Next month +${money(rowProjected)}</div>
              <div class="meter-bar"><div class="meter-fill" style="width:${rowPct}%"></div></div>
            </div>`;
        });
      }
    } else {
      cdFill.style.width = "0%";
      cdText.textContent = "Open a CD to start the maturity tracker.";
    }
  }
}


function refreshPreMissionPulse(){
  if(state.mission && state.mission.active) return;
  clearGlow();

  const planTab = document.querySelector('.tab[data-tab="plan"]');
  if(planTab) planTab.classList.add("glow");

  if(!state.plan.lockedForYear){
    const planWasChosen = !!state.plan.chosenForYear;
    if(planWasChosen){
      if($("btnApplyPlan")) $("btnApplyPlan").classList.add("glow-next");
    } else {
      if($("btnSuggestedPlan")) $("btnSuggestedPlan").classList.add("glow-next");
    }
    return;
  }

  if(!state.jobLocked){
    if($("btnLockJob")) $("btnLockJob").classList.add("glow-next");
    return;
  }

  if($("btnStartMission")) $("btnStartMission").classList.add("glow-next");
}

function guidePreStart(){
  clearGlow();
  if(!state.plan.lockedForYear){
    openTab("plan");
    const planTab = document.querySelector('.tab[data-tab="plan"]');
    if(planTab) planTab.classList.add("glow");
    const planWasChosen = !!state.plan.chosenForYear;
    if(planWasChosen){
      if($("btnApplyPlan")) $("btnApplyPlan").classList.add("glow-next");
      setLog("Step 1: lock in the year plan you picked.");
      scrollToBtn("btnApplyPlan");
    } else {
      if($("btnSuggestedPlan")) $("btnSuggestedPlan").classList.add("glow-next");
      setLog("Step 1: choose and lock your year plan.");
      scrollToBtn("btnSuggestedPlan");
    }
  } else if(!state.jobLocked && !state.mission.active){
    openTab("plan");
    const planTab = document.querySelector('.tab[data-tab="plan"]');
    if(planTab) planTab.classList.add("glow");
    if($("btnLockJob")) $("btnLockJob").classList.add("glow-next");
    setLog("Step 2: choose a student job, then tap Lock Job After Your Choice.");
    scrollToBtn("btnLockJob");
  } else {
    openTab("plan");
  }
  updateWantsUI();
}

function guideWantsStep(){
  openTab('plan');
  clearGlow();
  const planTab = document.querySelector('.tab[data-tab="plan"]');
  if(planTab) planTab.classList.add('glow');
  const wantsField = $("wantsPick") ? $("wantsPick").closest('.field') : null;
  if(wantsField) wantsField.classList.add('glow');
  updateWantsUI();
  scrollToBtn("btnAddWant");
}

function showBucketInfo(bucketNum){
  const defs = {
    1:"Benchmark #1 is Earning Income. This covers how money is earned through jobs, side work, pay rates, bonuses, and how income choices affect the rest of the budget.",
    2:"Benchmark #2 is Spending. This covers how students use money for purchases, compare costs, make payment choices, and track where money goes when they spend it.",
    3:"Benchmark #3 is Saving. This covers setting money aside, building habits over time, protecting future goals, and seeing how small saving decisions add up.",
    4:"Benchmark #4 is Banking. This covers checking accounts, savings accounts, transfers, checks, CDs, account growth, fees, and digital banking choices.",
    5:"Benchmark #5 is Credit and Debt. Credit scores help lenders, landlords, and sometimes insurers judge how reliably you handle borrowed money. Higher scores can help you qualify more easily and pay less in interest. Missing payments, overdrafts, and poor debt choices can drag the score down.",
    6:"Benchmark #6 is Consumer Protection. This covers safe money habits, reading details carefully, avoiding unfair choices, and knowing how to protect yourself as a buyer.",
    7:"Benchmark #7 is Budgeting. This covers making a spending plan, organizing needs versus wants, choosing a budget model, and locking in a plan before using money.",
    8:"Benchmark #8 is Investing. This covers using money to try to grow money over time, including lessons about risk, return, patience, and long-term thinking.",
    9:"Benchmark #9 is Insurance and Risk Management. This covers planning for unexpected problems, reducing financial harm, and understanding how protection tools lower risk.",
    10:"Benchmark #10 is Taxes. This covers payroll tax withholding, local tax lessons, why taxes exist, and how taxes affect take-home pay and total money available.",
    11:"Benchmark #11 is Financial Decision Making. This covers weighing options, comparing short-term and long-term outcomes, and making choices that match your goals.",
    12:"Benchmark #12 is Career Planning and Financial Goals. This covers choosing jobs, setting savings targets, building future plans, and seeing how career choices connect to money goals.",
    13:"Benchmark #13 is Consumer Finance Laws. This covers agreements, billing disputes, contract rules, and knowing there are laws and protections tied to money decisions."
  };
  openModal({
    title:`Benchmark #${bucketNum}`,
    meta: FL_BUCKETS[bucketNum] || BENCH[bucketNum] || "Financial literacy standard",
    body: defs[bucketNum] || `This benchmark covers ${FL_BUCKETS[bucketNum] || BENCH[bucketNum]}.`,
    buttons:[{id:"close",label:"Close",kind:"secondary"}]
  });
}

function renderJob(){
  const job = state.jobs[state.jobIndex];
  $("jobName").textContent = job.name;
  $("jobPay").textContent = "Weekly Pay: " + money(job.pay);

  const pick = $("ledgerItemPick");
  pick.innerHTML = "";
  const items = LEDGER_CATALOG[job.id] || [];
  items.forEach(it=>{
    const opt=document.createElement("option");
    opt.value=it.id;
    opt.textContent = `${it.name} (${money(it.cost)})`;
    pick.appendChild(opt);
  });
  if(items.length===0){
    const opt=document.createElement("option");
    opt.value="";
    opt.textContent="No items";
    pick.appendChild(opt);
  }

  const tags = $("jobTags");
  tags.innerHTML = "";
  job.buckets.forEach(b=>{
    const chip=document.createElement("div");
    chip.className="chip";
    chip.textContent = getModeConfig().showBenchmarksInMeta ? `Benchmark #${b}: ${BENCH[b]}` : `Benchmark #${b}`;
    tags.appendChild(chip);
  });
}

function setLog(msg){ $("log").textContent = msg; }

function renderLedger(){
  const job = state.jobs[state.jobIndex];
  const cat = LEDGER_CATALOG[job.id] || [];

  // Build inventory on-hand section
  const invLines = [];
  cat.forEach(it => {
    const qty = invQty(it.id);
    invLines.push(`  ${qty > 0 ? qty + ' ×' : '  0'} ${it.name} (${money(it.cost)} each)${qty > 0 ? ' ✓' : ''}`);
  });
  const invHeader = cat.length
    ? `📦 INVENTORY (value: ${money(calcInventoryValue())})\n${invLines.join('\n')}\n${'─'.repeat(36)}`
    : `📦 INVENTORY: (nothing yet)\n${'─'.repeat(36)}`;

  const history = state.ledger.history.slice(-20);
  const historyText = history.length ? history.join('\n') : 'No transactions yet.';
  const box = $("ledgerBox");
  box.textContent = `${invHeader}\n${historyText}`;
  // Scroll to bottom so latest transaction is visible
  box.scrollTop = box.scrollHeight;
}

/* Progress bar */
function renderProgress(){
  const m=state.mission;
  if(!m.active){
    $("barFill").style.width="0%";
    $("stepMeta").textContent="No mission active";
    return;
  }
  const total=m.steps.length||1;
  const pct=Math.round((m.index/total)*100);
  $("barFill").style.width=pct+"%";
  const cur=m.steps[m.index];
  const actualWeek = state.weekEngine ? state.weekEngine.week : (state.day * 4);
  const weekLabel = `Week ${actualWeek}/48`;
  if(cur) $("stepMeta").textContent = `${weekLabel} • Step ${m.index+1}/${total} • ${cur.title}`;
  else $("stepMeta").textContent = `${weekLabel} • Mission complete! ✅`;
}

/* Money movement helpers */
function addLedgerLine(s){
  state.ledger.history.push(s);
  renderLedger();
}
function totalCdFunds(){
  // principal already represents the current CD balance because monthly growth is
  // folded into principal while accrued tracks lifetime interest earned for display.
  return state.bank.cds.reduce((sum,cd)=>sum + cd.principal, 0);
}

function previewCdWithdrawal(amount){
  let need = Math.max(0, Math.round(amount||0));
  let penalty = 0;
  const rows = [];
  const cds = state.bank.cds.slice().sort((a,b)=>a.monthsLeft-b.monthsLeft);
  for(const cd of cds){
    if(need<=0) break;
    const available = cd.principal;
    if(available<=0) continue;
    const take = Math.min(available, need);
    let thisPenalty = 0;
    if(cd.monthsLeft > 0){
      // Usual classroom formula here: interest forfeited.
      thisPenalty = Math.max(1, Math.round(take * (cd.apr/100)));
      penalty += thisPenalty;
    }
    rows.push({
      id: cd.id,
      name: cd.name,
      take,
      monthsLeft: cd.monthsLeft,
      apr: cd.apr,
      penalty: thisPenalty
    });
    need -= take;
  }
  return { amount: Math.max(0, Math.round(amount||0)), penalty, rows, enough: need<=0, shortfall: need };
}

function getFundingChoices(includeCd=true){
  const choices = [
    { id:"cash", label:`Cash (${money(state.cash)})`, amount:state.cash },
    { id:"checking", label:`Checking (${money(state.bank.checking)})`, amount:state.bank.checking },
    { id:"savings", label:`Savings (${money(state.bank.savings)})`, amount:state.bank.savings }
  ];
  if(includeCd){
    choices.push({ id:"cd", label:`CD (${money(totalCdFunds())})`, amount:totalCdFunds() });
  }
  return choices;
}

function withdrawFromCd(amount){
  let need = Math.max(0, Math.round(amount||0));
  if(need<=0) return {paid:0, penalty:0, maturedOnly:false};
  let paid = 0;
  let penalty = 0;
  let maturedOnly = true;
  const cds = state.bank.cds.slice().sort((a,b)=>a.monthsLeft-b.monthsLeft);
  for(const cd of cds){
    if(need<=0) break;
    const available = cd.principal;
    if(available<=0) continue;
    const take = Math.min(available, need);
    cd.principal = Math.max(0, cd.principal - take);
    if(cd.monthsLeft > 0){
      maturedOnly = false;
      const thisPenalty = Math.max(1, Math.round(take * (cd.apr/100)));
      penalty += thisPenalty;
      // Interest forfeited comes out of earned growth first, then principal if needed.
      const fromAccrued = Math.min(cd.accrued, thisPenalty);
      cd.accrued = Math.max(0, cd.accrued - fromAccrued);
      const remainder = thisPenalty - fromAccrued;
      if(remainder > 0) cd.principal = Math.max(0, cd.principal - remainder);
      addLedgerLine(`${cd.name} early withdrawal: ${money(take)} | interest forfeited: ${money(thisPenalty)}`);
    } else {
      addLedgerLine(`${cd.name} used after maturity: ${money(take)}`);
    }
    paid += take;
    need -= take;
  }
  state.bank.cds = state.bank.cds.filter(cd => cd.principal > 0);
  return {paid, penalty, maturedOnly};
}

function spendFromSource(source, amount){
  amount = Math.max(0, Math.round(amount||0));
  if(source === 'cash'){
    if(state.cash < amount) return {ok:false, message:'Not enough cash'};
    state.cash -= amount;
    return {ok:true, summary:`Paid ${money(amount)} from cash`};
  }
  if(source === 'checking'){
    if(state.bank.checking < amount) return {ok:false, message:'Not enough in checking'};
    state.bank.checking -= amount;
    return {ok:true, summary:`Paid ${money(amount)} from checking`};
  }
  if(source === 'savings'){
    if(state.bank.savings < amount) return {ok:false, message:'Not enough in savings'};
    state.bank.savings -= amount;
    return {ok:true, summary:`Paid ${money(amount)} from savings`};
  }
  if(source === 'cd'){
    const total = totalCdFunds();
    if(total < amount) return {ok:false, message:'Not enough in CDs'};
    const result = withdrawFromCd(amount);
    return {ok:true, summary:`Paid ${money(result.paid)} from CD${result.penalty ? ` with ${money(result.penalty)} interest forfeited` : ''}`};
  }
  return {ok:false, message:'Unknown funding source'};
}

function chooseFundingSource(amount, reason, onPaid){
  const choices = getFundingChoices(true);
  const body = `${reason}\n\nChoose where to take ${money(amount)} from:`;
  openModal({
    title:'💳 Choose Payment Source',
    meta:'Pick which account to pay from',
    body,
    buttons:[...choices.map(c=>({id:c.id,label:c.label,kind:'secondary'})), {id:'cancel', label:'Cancel', kind:'secondary'}],
    onPick:(id)=>{
      if(id==='cancel') return;
      if(id === 'cd'){
        const preview = previewCdWithdrawal(amount);
        if(!preview.enough){
          beep('warn');
          showBanner('Not enough in CDs');
          return;
        }
        const lines = preview.rows.map(r => `• ${r.name}: withdraw ${money(r.take)}${r.monthsLeft > 0 ? ` | months left ${r.monthsLeft} | penalty ${money(r.penalty)}` : ' | matured, no penalty'}`);
        openModal({
          title:'⚠️ Early CD Withdrawal',
          meta:'Usual penalty: interest forfeited',
          body:`You are trying to use ${money(amount)} from your CD funds.

Usual Penalty = Interest Forfeited
Your numbers:
${lines.join('\n')}

Total interest forfeited: ${money(preview.penalty)}

Do you still want to take money from the CD, or decline and keep it invested?`,
          buttons:[
            {id:'decline', label:'Decline', kind:'secondary'},
            {id:'confirm', label:`Do It — lose ${money(preview.penalty)} interest`, kind:'warn'}
          ],
          onPick:(pick)=>{
            if(pick !== 'confirm') return;
            const cdResult = spendFromSource('cd', amount);
            if(!cdResult.ok){ beep('warn'); showBanner(cdResult.message || 'CD withdrawal failed'); return; }
            addLedgerLine(cdResult.summary);
            showDecisionBadge(`Paid from ${formatSourceLabel('cd')}: ${money(amount)}`);
            if(onPaid) setTimeout(()=> onPaid('cd', cdResult), 50);
          }
        });
        return;
      }
      const result = spendFromSource(id, amount);
      if(!result.ok){
        // Insufficient funds — offer to transfer from another account or overdraft
        const srcLabel = id === 'cash' ? 'Cash' : id === 'checking' ? 'Checking' : id === 'savings' ? 'Savings' : 'CD';
        const srcBalance = id === 'cash' ? state.cash : id === 'checking' ? state.bank.checking : id === 'savings' ? state.bank.savings : totalCdFunds();
        const shortfall = amount - srcBalance;
        // Find other sources that could cover the gap
        const otherSources = choices.filter(c => c.id !== id && c.amount >= shortfall);
        const transferButtons = otherSources.map(c => ({
          id:`transfer_${c.id}`,
          label:`Transfer ${money(shortfall)} from ${c.id === 'cash' ? 'Cash' : c.id === 'checking' ? 'Checking' : c.id === 'savings' ? 'Savings' : 'CD'} to cover`,
          kind:'secondary'
        }));
        const overdraftFee = state.bank.checkingType ? (BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType)?.overdraftFee||15) : 15;
        openModal({
          title:'⚠️ Not Enough Funds',
          meta:`${srcLabel} only has ${money(srcBalance)} — need ${money(amount)}`,
          body:`You're ${money(shortfall)} short in ${srcLabel}.\n\nYou can:\n• Transfer from another account to cover the difference\n• Overdraft (pay ${money(overdraftFee)} penalty + credit -12)\n• Cancel and choose a different account`,
          buttons:[
            ...transferButtons,
            {id:'overdraft', label:`Overdraft — pay ${money(overdraftFee)} penalty`, kind:'warn'},
            {id:'back',     label:'Pick Different Account',                            kind:'secondary'}
          ],
          onPick:(pick)=>{
            if(pick === 'back'){
              setTimeout(()=> chooseFundingSource(amount, reason, onPaid), 50);
              return;
            }
            if(pick === 'overdraft'){
              // Drain the chosen source to $0, apply overdraft fee, mark paid
              if(id === 'cash') state.cash = 0;
              else if(id === 'checking') state.bank.checking = 0;
              else if(id === 'savings') state.bank.savings = 0;
              state.bank.checking = Math.max(0, state.bank.checking - overdraftFee);
              state.credit = Math.max(300, state.credit - 12);
              addLedgerLine(`Overdraft: paid ${money(amount)} (fee: ${money(overdraftFee)}, credit -12)`);
              showDecisionBadge(`Paid from ${srcLabel} with overdraft fee`);
              renderHeader(); renderLedger();
              setTimeout(()=> onPaid && onPaid(id, {ok:true, summary:`Overdraft from ${srcLabel} — fee ${money(overdraftFee)}`}), 50);
              return;
            }
            if(pick.startsWith('transfer_')){
              const fromSrc = pick.replace('transfer_','');
              // Transfer the shortfall from the other source into the chosen source
              const transferResult = spendFromSource(fromSrc, shortfall);
              if(!transferResult.ok){ beep('warn'); showBanner('Transfer failed'); return; }
              // Now top up the chosen source and spend from it
              if(id === 'cash') state.cash += shortfall;
              else if(id === 'checking') state.bank.checking += shortfall;
              else if(id === 'savings') state.bank.savings += shortfall;
              const finalResult = spendFromSource(id, amount);
              if(!finalResult.ok){ beep('warn'); showBanner('Payment failed after transfer'); return; }
              addLedgerLine(`Transfer: ${money(shortfall)} from ${fromSrc} → ${id} to cover ${money(amount)}`);
              addLedgerLine(finalResult.summary);
              showDecisionBadge(`Paid from ${formatSourceLabel(id)} after transfer`);
              renderHeader(); renderLedger();
              setTimeout(()=> onPaid && onPaid(id, finalResult), 50);
              return;
            }
          }
        });
        return;
      }
      addLedgerLine(result.summary);
      showDecisionBadge(`Paid from ${formatSourceLabel(id)}: ${money(amount)}`);
      // Let onPaid handle rendering after it updates state
      if(onPaid) setTimeout(()=> onPaid(id, result), 50);
    }
  });
}

function payFromCheckingThenCashThenSavings(amount){
  let due = amount;

  const fromChecking = Math.min(due, Math.max(0,state.bank.checking));
  state.bank.checking -= fromChecking;
  due -= fromChecking;

  const fromCash = Math.min(due, state.cash);
  state.cash -= fromCash;
  due -= fromCash;

  if(due>0){
    if(state.bank.savingsType==="cd"){
      const penalty = Math.min(10, Math.max(0,state.bank.savings));
      state.bank.savings -= penalty;
      addLedgerLine(`CD penalty: ${money(penalty)}`);
    }
    const fromSavings = Math.min(due, Math.max(0,state.bank.savings));
    state.bank.savings -= fromSavings;
    due -= fromSavings;
  }

  if(due>0){
    state.credit = clamp(state.credit-10,300,850);
    addLedgerLine("Could not fully pay. Credit -10.");
  }
}

/* Ledger functions */
function getJobCatalogItem(itemId){
  const job = state.jobs[state.jobIndex];
  const cat = LEDGER_CATALOG[job.id] || [];
  return cat.find(x=>x.id===itemId) || null;
}
function invQty(id){ return state.ledger.inventory[id] || 0; }
function setInvQty(id, q){ state.ledger.inventory[id] = Math.max(0,q); }
function calcInventoryValue(){
  const job = state.jobs[state.jobIndex];
  const cat = LEDGER_CATALOG[job.id] || [];
  let total=0;
  cat.forEach(it=> total += invQty(it.id) * it.cost );
  return total;
}
function recalcProfit(){
  state.ledger.weekProfit = state.ledger.weekIncome - state.ledger.weekExpenses;
}
function buildInventoryPanel(){
  // Returns HTML string of current inventory for the right-side panel
  const job = state.jobs[state.jobIndex];
  const cat = LEDGER_CATALOG[job.id] || [];
  if(!cat.length) return '<em>No catalog items</em>';
  const rows = cat.map(it => {
    const qty = invQty(it.id);
    const style = qty > 0 ? 'color:var(--success);font-weight:bold' : 'color:var(--muted)';
    return `<div style="${style}">${qty > 0 ? qty+'×' : '0 '} ${it.name} <small>(${money(it.cost)})</small></div>`;
  });
  const total = calcInventoryValue();
  return `${rows.join('')}<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;font-weight:bold">Total: ${money(total)}</div>`;
}

function openSplitShopModal({title, leftTitle, leftHTML, rightTitle, rightHTML, buttons}){
  // Opens a modal with two side-by-side panels using mBody innerHTML
  $("mTitle").textContent = title;
  $("mMeta").textContent = "";
  $("mBody").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">
      <div>
        <div style="font-weight:1100;font-size:12px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">${leftTitle}</div>
        <div style="font-size:13px">${leftHTML}</div>
      </div>
      <div style="border-left:1px solid var(--border);padding-left:12px">
        <div style="font-weight:1100;font-size:12px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">${rightTitle}</div>
        <div style="font-size:13px" id="splitInventoryPanel">${rightHTML}</div>
      </div>
    </div>`;

  const foot = $("mFoot");
  foot.innerHTML = "";
  buttons.forEach(b => {
    const btn = document.createElement("button");
    btn.className = `btn ${b.kind||"secondary"}`;
    btn.textContent = b.label;
    btn.onclick = () => { beep("click"); closeModal(); b.onClick && b.onClick(); };
    foot.appendChild(btn);
  });
  $("overlay").classList.add("show");
  $("overlay").setAttribute("aria-hidden","false");
}

function ledgerBuyItem(itemId){
  const it = getJobCatalogItem(itemId);
  if(!it){ beep("warn"); return; }

  const currentQty = invQty(it.id);
  if(currentQty >= 5){
    openModal({
      title:"📦 Already Well Stocked",
      meta:`${it.name} inventory`,
      body:`You already have ${currentQty} × ${it.name}.\n\nBuy more anyway or choose a different item?`,
      buttons:[
        {id:"buyanyway", label:"Buy More Anyway",    kind:"secondary"},
        {id:"different", label:"Pick Different Item", kind:"primary"},
        {id:"done",      label:"Done Shopping ✓",    kind:"secondary"}
      ],
      onPick:(pick)=>{
        if(pick==="buyanyway") doBuy();
        else if(pick==="different") ledgerBuy();
        else { notifyAction("ledger_buy"); renderAll(); }
      }
    });
    return;
  }
  doBuy();

  function doBuy(){
    chooseFundingSource(it.cost, `Buy ${it.name} for ${money(it.cost)}.`, (src)=>{
      setInvQty(it.id, invQty(it.id)+1);
      state.ledger.weekExpenses += it.cost;
      recalcProfit();
      const invVal = calcInventoryValue();
      addLedgerLine(`Bought: ${it.name} (-${money(it.cost)}) from ${src} | Inv. value: ${money(invVal)}`);
      renderHeader();
      renderLedger();

      // Split-panel: left = what was just bought, right = full current inventory
      const leftHTML = `
        <div style="background:var(--success-bg,#e8fdf0);border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="font-size:15px;font-weight:bold">✅ ${it.name}</div>
          <div>Cost: ${money(it.cost)} <small>(from ${src})</small></div>
          <div>Now have: ${invQty(it.id)} × ${it.name}</div>
          <div style="margin-top:6px;font-weight:bold">Inv. value: ${money(invVal)}</div>
        </div>
        <div style="font-size:12px;color:var(--muted)">Tap "Buy Another" to keep shopping<br>or "Done" when finished.</div>`;

      setTimeout(()=>{
        openSplitShopModal({
          title:"🛒 Shopping",
          leftTitle:"Just Purchased",
          leftHTML,
          rightTitle:"Your Inventory",
          rightHTML: buildInventoryPanel(),
          buttons:[
            { label:`Buy Another ${it.name}`,  kind:"primary",    onClick:()=> ledgerBuyItem(it.id) },
            { label:"Buy Different Item 🛒",    kind:"secondary",  onClick:()=> ledgerBuy() },
            { label:"Done Shopping ✓",          kind:"secondary",  onClick:()=>{ notifyAction("ledger_buy"); renderAll(); } }
          ]
        });
      }, 50);
    });
  }
}

function ledgerBuy(){
  const job = state.jobs[state.jobIndex];
  const cat = LEDGER_CATALOG[job.id] || [];
  if(!cat.length){ beep("warn"); return; }

  // Left panel: catalog with prices
  const leftHTML = cat.map(it =>
    `<button class="choice-btn" style="margin-bottom:6px;text-align:left" onclick="closeModal();setTimeout(()=>ledgerBuyItem('${it.id}'),50)">
      ${it.name}<small>${money(it.cost)}${invQty(it.id)>0 ? ` • have ${invQty(it.id)}` : ''}</small>
    </button>`
  ).join('') + `<button class="choice-btn" style="margin-bottom:6px" onclick="closeModal();notifyAction('ledger_buy');renderAll()">Done Shopping ✓<small>Finished buying</small></button>`;

  setTimeout(()=>{
    openSplitShopModal({
      title:"🛒 Buy Items",
      leftTitle:"Available to Buy",
      leftHTML,
      rightTitle:"Your Inventory",
      rightHTML: buildInventoryPanel(),
      buttons:[]  // buttons are inline in leftHTML
    });
  }, 50);
}
function ledgerUse(){
  const id = $("ledgerItemPick").value;
  const it = getJobCatalogItem(id);
  if(!it){ beep("warn"); return; }
  const q = invQty(it.id);
  if(q<=0){
    beep("warn");
    openModal({
      title:"No Inventory",
      meta:"Ledger Tip",
      body:`You don't have ${it.name} in inventory.\nBuy it first in the Ledger tab.`,
      buttons:[{id:"close",label:"Close",kind:"secondary"}]
    });
    return;
  }
  setInvQty(it.id, q-1);
  addLedgerLine(`Used: ${it.name} (qty now ${invQty(it.id)})`);
  recalcProfit();
  renderHeader();
  notifyAction("ledger_use");
}
function showInventoryModal(){
  const items = LEDGER_CATALOG[state.jobs[state.jobIndex].id] || [];
  const body = items.length
    ? items.map(it=>`• ${it.name}: ${invQty(it.id)} on hand (${money(it.cost)} each)`).join("\n") + `\n\nTotal inventory value: ${money(calcInventoryValue())}`
    : "No catalog items for this job yet.";
  openModal({
    title:"📦 Inventory",
    meta:`${state.jobs[state.jobIndex].name} supplies`,
    body,
    buttons:[{id:"close", label:"Close", kind:"secondary"}]
  });
}

function ledgerAddExpense(){
  openModal({
    title:"Add Expense (tap-only)",
    meta:"Business costs reduce profit for the current month",
    body:"Choose an expense to add to this month:",
    buttons:[
      {id:"travel5", label:"Travel/Transport ($5)", kind:"secondary"},
      {id:"travel10", label:"Travel/Transport ($10)", kind:"secondary"},
      {id:"repair15", label:"Minor Repair ($15)", kind:"secondary"},
      {id:"fee8", label:"Platform/Fee ($8)", kind:"secondary"},
      {id:"close", label:"Cancel", kind:"secondary"}
    ],
    onPick:(id)=>{
      const map={travel5:5, travel10:10, repair15:15, fee8:8};
      const amt = map[id] || 0;
      if(amt>0){
        chooseFundingSource(amt, `Choose where to pay this ${money(amt)} business expense from.`, (src)=>{
          state.ledger.weekExpenses += amt;
          addLedgerLine(`Expense: -${money(amt)} from ${src}`);
          recalcProfit();
          renderHeader();
          renderLedger();
        });
      }
    }
  });
}
function ledgerClearWeek(){
  state.ledger.weekExpenses = 0;
  state.ledger.weekIncome = 0;
  recalcProfit();
  addLedgerLine("Week ledger reset.");
  renderHeader();
}


function totalCdFunds(){ return state.bank.cds.reduce((s,cd)=>s+cd.principal,0); }
function calcInventoryValue(){ const cat=LEDGER_CATALOG[state.jobs[state.jobIndex].id]||[]; return Object.entries(state.ledger.inventory).reduce((sum,[id,qty])=>{ const item=cat.find(x=>x.id===id); return sum+(item?item.cost*qty:0); },0); }

/* Mission system */
function currentWeekIndex(){
  if(state.weekEngine && state.weekEngine.active) return state.weekEngine.week;
  return state.day;
}

function buildMonthMissionSteps(){
  const job = state.jobs[state.jobIndex];
  const steps = [
    {
      title:"Month 1: Choose bank + insurance",
      bucket:[1,6,12,3],
      prompt:`Choose your checking account, savings account, and insurance.

Required:
• Tap "Choose Bank + Insurance (Start)" (Banking tab)`,
      requireActions:["startup_choose"]
    },
    {
      title:"Month 1: Set Savings Challenge Goal",
      bucket:[12,3],
      prompt:`Pick a year-end savings goal.

Required:
• Tap "Savings Challenge" (Plan tab) and set a goal`,
      requireActions:["savings_goal"]
    },
  ];

  for(let m=1; m<=12; m++){
    if(m % 2 === 1){
      steps.push({
        title:`Month ${m}: Stock up supplies`,
        bucket:[3,1],
        prompt:`Use the Ledger to buy one job item for this month.

Required:
• Buy ONE item in the Ledger tab`,
        requireActions:["ledger_buy"]
      });
    } else {
      steps.push({
        title:`Month ${m}: Run a real-life event`,
        bucket:[3,6,12],
        prompt:`Handle the real-life job event for this month.

Required:
• Run Job Real-Life Event`,
        requireActions:["job_event"]
      });
    }

    if(m===2){
      steps.push({ title:"Month 2: Move money to savings", bucket:[1,12], prompt:`Show the student how moving money changes growth.

Required:
• Transfer money from checking to savings`, requireActions:["transfer_savings"] });
    }
    if(m===3){
      steps.push({ title:"Month 3: Inheritance lesson", bucket:[5,3], prompt:`Required:
• Trigger Inheritance and choose an option.`, requireActions:["inheritance"] });
    }
    if(m===4){
      steps.push({ title:"Month 4: Local tax lesson", bucket:[8,7], prompt:`Required:
• Generate Local Tax (Lesson)
• Pay Local Tax Bill`, requireActions:["gen_local_tax","pay_local_tax"] });
    }
    if(m===5){
      steps.push({ title:"Month 5: Open a CD", bucket:[9,12], prompt:`Open a CD and explain the term length.

Required:
• Open CD`, requireActions:["open_cd"] });
    }
    if(m===6){
      steps.push({ title:"Month 6: Billing dispute", bucket:[11,13], prompt:`Required:
• Start Billing Dispute and choose an action.`, requireActions:["dispute"] });
    }
    if(m===8){
      steps.push({ title:"Month 8: Contract review", bucket:[10,13], prompt:`Pick one contract from the dropdown and review it.

Required:
• Review Selected Contract`, requireActions:["contract_pick","review_contract"] });
    }
    if(m===9){
      steps.push({ title:"Month 9: Transfer more savings", bucket:[1,12], prompt:`Move more money from checking to savings.

Required:
• Transfer money from checking to savings`, requireActions:["transfer_savings"] });
    }
    if(m===10){
      steps.push({ title:"Month 10: Write a check", bucket:[2,1], prompt:`Show money movement with a check.

Required:
• Write Check`, requireActions:["write_check"] });
    }
    if(m===11){
      steps.push({ title:"Month 11: Deposit a check", bucket:[1,2], prompt:`Bring money back into the account.

Required:
• Deposit Check`, requireActions:["deposit_check"] });
    }

    steps.push({
      title:`Month ${m}: Advance to next week`,
      bucket:[9,12],
      prompt:`Tap "Next Week ▶" to advance. Interest, fees, growth, and credit effects apply when the month turns.`,
      requireActions:["next_week"]
    });

  }
  return steps;
}

function getMissionStepDisplay(step){
  let title = step?.title || "";
  let prompt = step?.prompt || "";

  if(/^Month\s+(\d+):/i.test(title)){
    const n = Number(title.match(/^Month\s+(\d+):/i)[1] || 0);
    if(n > 0) title = title.replace(/^Month\s+\d+:/i, `Week ${n*4}:`);
  }

  prompt = prompt
    .replace(/\bthis month\b/gi, "this week")
    .replace(/\bfor this month\b/gi, "for this week");

  if(step && step.requireActions && step.requireActions.includes("view_budget_sheet")) {
    const fallbackWeek = Number(step.weekReview || 0) || 4;
    const liveWeek = state?.weekEngine?.week || 0;
    const completedWeek = liveWeek > 0 ? liveWeek : fallbackWeek;
    title = `Week ${completedWeek}: Review Budget Sheet`;
    prompt = `📊 Tap the "Budget Sheet" tab to review Week ${completedWeek}.\n\nSee your balances, growth, inventory value, and savings goal progress for the paycheck you just finished — then come back to continue.`;
  }

  return { title, prompt };
}

function startMission(){
  if(!state.plan.lockedForYear){
    beep("warn");
    openTab("plan");
    showBanner("Choose and lock the year plan first");
    guidePreStart();
    return;
  }
  if(!state.plan.wantsCommitted || state.plan.wants < getWantsTargetAmount()){
    beep("warn");
    openTab("plan");
    showBanner(`Build wants to at least ${money(getWantsTargetAmount())} first`);
    updateWantsUI();
    return;
  }
  const job = state.jobs[state.jobIndex];
  state.day = 1;
  state.plan.income = job.pay * 4;
  state.plan.wantsExtras = 0;
  state.plan.appliedMonths = new Set();
  const currentModel = state.plan.model || "rule702010";
  const committedWants = state.plan.wants;
  const committedSelections = [...state.plan.wantsSelections];
  const currentInsurance = state.plan.insurance;
  applyBudgetModel(currentModel);
  state.plan.wants = committedWants;
  state.plan.wantsSelections = committedSelections;
  state.plan.wantsCommitted = true;
  state.plan.insurance = currentInsurance;
  state.bank.cds = [];
  state.bank.startupFeePaid = false;
  state.bank.hysaPrincipal = 0;
  state.bank.hysaDeposits = 0;
  state.bank.hysaAccrued = 0;
  state.bank.hysaLastGrowth = 0;
  state.bank.startCheckingDeposit = 0;
  state.bank.startSavingsDeposit = 0;
  state.bank.checking = 0;
  state.bank.savings = 0;
  state.bank.checkingType = null;
  state.bank.savingsType = null;
  state.jobLocked = true;

  state.mission.active=true;
  state.mission.paused=false;
  state.mission.index=0;
  state.mission.steps = buildMonthMissionSteps();
  state.mission.waitingAction=null;
  initWeekEngine();
  renderWeekHeader();

  state.savingsGoal = 0;
  state.savingsMilestones = new Set();

  state.ledger.inventory = {};
  state.ledger.weekExpenses=0;
  state.ledger.weekIncome=0;
  state.ledger.weekProfit=0;
  state.ledger.history=[];
  renderLedger();

  // Initialize monthly tracking
  state.monthSnapshots = [];
  state.plan.unplannedWantUsedThisMonth = false;
  state.plan.unplannedWantLabelsThisMonth = [];
  state.plan.wantsInventoryActive = state.plan.wantsSelections ? state.plan.wantsSelections.map(w=>({label:w.label, value:w.value, available:true})) : [];
  ensureStandardV1State();
  state.standardV1.weeklyGoals = {};
  state.standardV1.goalHistory = [];
  state.standardV1.choiceEchoLog = [];
  state.standardV1.pressureTracks = { basics:0, bills:0, impulse:0, resilience:0 };
  state.standardV1.chainHistory = [];
  state.standardV1.chainWindowsFired = {};

  setLog("Year mission started! June Week 1 — follow the glowing actions. Monthly focus, health, and choice echoes are now live.");
  setTimeout(()=>promptWeeklyGoalIfNeeded(), 200);
  renderAll();
  runCurrentMissionStep();
}

function pauseMission(){
  if(!state.mission.active) return;
  state.mission.paused = !state.mission.paused;
  setLog(state.mission.paused ? "Mission paused." : "Mission resumed.");
}

function resetMission(){
  const currentJob = state.jobs[state.jobIndex];
  state.cash = 200;
  state.day = 1;
  state.credit = 650;
  state.localTaxDue = 0;
  state.contractActive = false;
  state.contractId = null;
  state.contractLedger = { chargedMonths:{} };
  if(!state.randomRun) state.randomRun = {};
  state.randomRun.contractOfferId = pickRandomContractId();
  state.randomRun.lastEventType = null;
  state.randomRun.prevEventType = null;
  state.coverage = new Set();

  state.bank.checking = 0;
  state.bank.savings = 0;
  state.bank.checkingType = null;
  state.bank.savingsType = null;
  state.bank.cds = [];
  state.bank.startupFeePaid = false;
  state.bank.hysaPrincipal = 0;
  state.bank.hysaDeposits = 0;
  state.bank.hysaAccrued = 0;
  state.bank.hysaLastGrowth = 0;
  state.bank.startCheckingDeposit = 0;
  state.bank.startSavingsDeposit = 0;

  state.plan.income = currentJob.pay * 4;
  state.plan.taxPct = 10;
  state.plan.wantsExtras = 0;
  state.plan.wantsSelections = [];
  state.plan.wantsCommitted = false;
  state.plan.insurance = "basic";
  state.plan.model = "rule702010";
  state.plan.chosenForYear = false;
  state.plan.lockedForYear = false;
  state.plan.appliedMonths = new Set();
  applyBudgetModel("rule702010");

  state.savingsGoal = 0;
  state.savingsMilestones = new Set();
  state.savingsGoalChoice = null;

  state.ledger.inventory = {};
  state.ledger.weekExpenses = 0;
  state.ledger.weekIncome = 0;
  state.ledger.weekProfit = 0;
  state.ledger.history = [];

  state.monthSnapshots = [];
  state.plan.unplannedWantUsedThisMonth = false;
  state.plan.unplannedWantLabelsThisMonth = [];
  state.plan.wantsInventoryActive = [];
  state._wantsRefreshCallback = null;

  state.mission.active = false;
  state.mission.paused = false;
  state.mission.index = 0;
  state.mission.waitingAction = null;
  state.mission.steps = [];
  state.jobLocked = false;
  state.weekEngine = null;
  if($("weekNum")) $("weekNum").textContent = "1";
  if($("monthName")) $("monthName").textContent = "June";

  clearGlow();
  renderAll();
  guidePreStart();
  setLog("Game reset. Choose a student job and start a new year mission.");
}

function confirmResetMission(){
  openModal({
    title:"Reset the Whole Game?",
    meta:"This clears the year mission and all choices",
    body:"You are about to reset the whole game. This will clear the mission, bank choices, plan, savings goal, CDs, ledger, report progress, and put everything back to a brand-new game.",
    buttons:[
      {id:"no",label:"No",kind:"secondary"},
      {id:"yes",label:"Yes, Reset",kind:"danger"}
    ],
    onPick:(id)=>{
      if(id === "yes"){
        beep("success");
        resetMission();
      }
    }
  });
}

/* OPTIONAL AUTO-JUMP:
   After student clicks "Got it", we auto-open the correct tab.
   Glow remains on tab + button (because openTab calls applyLockRules). */
function runCurrentMissionStep(){
  const m = state.mission;
  if(!m.active) return;
  if(m.paused){ setLog("Mission paused."); return; }

  const step = m.steps[m.index];
  if(!step){
    m.waitingAction=null;
    renderProgress();
    applyLockRules();
    beep("success");
    showBanner("48 Weeks Complete!");
    openModal({
      title:"🏁 Year Mission Complete",
      meta:"Nice work",
      body:"You finished the year. Generate a Standards Report to see what you covered.",
      buttons:[{id:"report",label:"Go to Report",kind:"primary"},{id:"close",label:"Close",kind:"secondary"}],
      onPick:(id)=>{ if(id==="report") openTab("reports"); }
    });
    return;
  }

  if(!step._done) step._done=new Set();
  const remaining = step.requireActions.filter(a=>!step._done.has(a));
  const nextAction = remaining[0] || null;
  m.waitingAction = nextAction;

  renderProgress();
  applyLockRules();

  const bucketText = state.teacherMode
    ? step.bucket.map(b=>`Benchmark #${b}: ${BENCH[b]}`).join(" • ")
    : step.bucket.map(b=>`Benchmark #${b}`).join(" • ");

  const displayStep = getMissionStepDisplay(step);

  openModal({
    title:`🎯 ${displayStep.title}`,
    meta: bucketText,
    body: displayStep.prompt + (nextAction ? `\n\nNext required action: ${nextAction.replaceAll("_"," ").toUpperCase()}` : ""),
    buttons:[{id:"ok",label:"Got it",kind:"primary"}],
    onPick:(id)=>{
      if(id==="ok" && nextAction){
        const req = requiredControlForAction(nextAction);
        if(req?.tab){
          const openOpts = (nextAction === "view_budget_sheet") ? {auto:true} : {auto:false};
          openTab(req.tab, openOpts);
          if(nextAction === "view_budget_sheet") showBanner("Review the Budget Sheet, then tap the Budget Sheet tab again to continue");
        }
        if(req?.el) scrollToBtn(req.el);
      }
    }
  });
}

/* Notify action -> mission progress */
function notifyAction(action){
  trackCoverageForAction(action);

  const m=state.mission;
  if(!m.active) return;

  const step=m.steps[m.index];
  if(!step) return;

  if(!step._done) step._done=new Set();
  const actionMatchedStep = step.requireActions.includes(action);
  if(actionMatchedStep){
    step._done.add(action);
  }

  const remaining=step.requireActions.filter(a=>!step._done.has(a));
  if(remaining.length===0){
    beep("success");
    showBanner(`Step ${m.index+1} complete`);
    const completedStep = getMissionStepDisplay(step);
    setLog(`✅ Completed: ${completedStep.title}`);
    m.index += 1;
    m.waitingAction=null;
    renderProgress();
    applyLockRules();
    setTimeout(()=>runCurrentMissionStep(), 220);
  }else{
    m.waitingAction=remaining[0];
    applyLockRules();
    const nextNeeded = remaining[0];
    const nr = requiredControlForAction(nextNeeded);
    if(actionMatchedStep){
      if(nr?.tab) openTab(nr.tab, {auto:true});
      if(nr?.el) scrollToBtn(nr.el);
    }
  }
}

function getBudgetModelName(){
  return state.plan.model === "rule503020" ? "50-30-20 Rule" : "70-20-10 Rule";
}

function getWantsTargetRatio(){
  return state.plan.model === "rule503020" ? 0.30 : 0.10;
}

function getWantsTargetAmount(){
  return Math.round(state.plan.income * getWantsTargetRatio());
}

function getSelectedWantInputs(){
  const box = $("wantsPick");
  if(!box) return [];
  return [...box.querySelectorAll('input[type="checkbox"]:checked')];
}

function syncWantsChecklistStyles(){
  const box = $("wantsPick");
  if(!box) return;
  box.querySelectorAll('.wants-option').forEach(label=>{
    const cb = label.querySelector('input[type="checkbox"]');
    label.classList.toggle('checked', !!cb?.checked);
  });
}

function getPendingWantsSelectionTotal(){
  const sel = $("wantsPick");
  if(!sel) return state.plan.wants;
  return getSelectedWantInputs().reduce((sum,o)=>sum + Number(o.value||0), 0);
}

function updateWantsUI(){
  syncWantsChecklistStyles();
  const wantsEl = $("wantsVal");
  const addBtn = $("btnAddWant");
  const startBtn = $("btnStartMission");
  const target = getWantsTargetAmount();
  const pending = getPendingWantsSelectionTotal();
  if($("wantsTargetLabel")) $("wantsTargetLabel").textContent = money(target);
  if($("wantsPendingLabel")) $("wantsPendingLabel").textContent = money(pending);
  if($("wantsDef")) $("wantsDef").textContent = `Pick one or more wants that add up to at least ${money(target)} for the ${getBudgetModelName()} before you start the year.`;
  if(wantsEl){
    wantsEl.style.color = state.plan.wantsCommitted && state.plan.wants >= target ? 'var(--success)' : 'var(--danger)';
  }
  if(addBtn){
    const canPulseDuringSetup = !state.mission.active && state.plan.lockedForYear;
    const canPulseDuringMonthlyRefresh = !!state._wantsRefreshCallback;
    const shouldGlow = pending >= target && !state.plan.wantsCommitted && (canPulseDuringSetup || canPulseDuringMonthlyRefresh);
    addBtn.classList.toggle('glow-next', shouldGlow);
    addBtn.classList.remove('glow');  // never blue-glow this button
  }
  if(startBtn){
    const startReady = !state.mission.active && state.plan.lockedForYear && state.plan.wantsCommitted && state.plan.wants >= target;
    startBtn.classList.toggle('glow-next', startReady);
    startBtn.classList.remove('glow');  // never blue-glow this button
    if(startReady) scrollToBtn("btnStartMission");
  }
}

function getSavingsMonthlyGrowth(){
  const s = state.bank.savingsType ? BANK_PRODUCTS.savings.find(x=>x.id===state.bank.savingsType) : null;
  if(!s) return {rate:0, amount:0, note:"pick a savings account"};
  if(s.id==="cd"){
    if(!state.bank.cds.length) return {rate:0, amount:0, note:"open a CD term to start locked growth"};
    const monthly = state.bank.cds.reduce((sum, cd)=> sum + Math.max(1, Math.round(cd.principal * (cd.apr/100))), 0);
    return {rate:0, amount:monthly, note:`${state.bank.cds.length} active CD(s), projected growth next month about ${money(monthly)}`};
  }
  const eligible = !(s.id === "hysa" && state.bank.hysaPrincipal < 25);
  const base = s.id === 'hysa' ? state.bank.hysaPrincipal : state.bank.savings;
  const amount = eligible ? Math.max(1, Math.round(base * (s.apr/100))) : 0;
  const note = eligible
    ? (s.id === 'hysa'
        ? `${money(base)} in high-yield at ${s.apr}% APR projects about +${money(amount)} next month`
        : `${money(base)} growing at ${s.apr}% next month = about ${money(base + amount)}`)
    : `needs ${money(s.minBalance)} minimum before growth starts`;
  return {rate:s.apr, amount, note};
}

function getCreditTrendText(){
  const c = state.bank.checkingType ? BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType) : null;
  const s = state.bank.savingsType ? BANK_PRODUCTS.savings.find(x=>x.id===state.bank.savingsType) : null;
  if(!c && !s) return 'stable';
  let parts=[];
  if(c){
    if(c.id==='student') parts.push('no monthly fee but overdraft is $20');
    if(c.id==='standard') parts.push('$5 savings fee and $10 overdraft');
    if(c.id==='rewards') parts.push('$10 savings fee and overdraft waived');
  }
  if(s){
    if(s.id==='basic') parts.push('regular savings is steady');
    if(s.id==='hysa') parts.push('high-yield can add +1 monthly confidence');
    if(s.id==='cd') parts.push('CDs can add +1 or +2 at maturity');
  }
  return parts.join(' • ');
}

function updateImpactStrip(){
  if (!$("impactCash")) return;
  const c = state.bank.checkingType ? BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType) : null;
  const growth = getSavingsMonthlyGrowth();
  const hysaTotal = state.bank.hysaPrincipal;
  $("impactCash").textContent = c ? (c.monthlyFee ? `${money(c.monthlyFee)}/mo fees` : 'no monthly fees') : 'use cash to fund accounts';
  $("impactCredit").innerHTML = `<button class="linkish" id="btnImpactCreditInfo" type="button">${getCreditTrendText()}</button>`;
  $("impactGoal").textContent = state.savingsGoal ? `${money(state.bank.savings + hysaTotal)} saved toward ${money(state.savingsGoal)}` : 'not set';
  $("impactGrowth").textContent = growth.note;
  if($("btnImpactCreditInfo")) $("btnImpactCreditInfo").onclick = ()=> showBucketInfo(5);
  renderStandardV1HUD();
}

function getChoiceImpactText(){
  const c = state.bank.checkingType ? BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType) : null;
  const s = state.bank.savingsType ? BANK_PRODUCTS.savings.find(x=>x.id===state.bank.savingsType) : null;
  const ins = state.plan.insurance || null;
  const growth = getSavingsMonthlyGrowth();
  const cashLine = c ? (c.monthlyFee>0 ? `• Cash: ${c.name} charges ${money(c.monthlyFee)} each month from savings. Overdraft fee is ${c.overdraftFee ? money(c.overdraftFee) : 'waived'} if checking goes below $0.` : `• Cash: Student Checking has no monthly fee, but overdraft still costs ${money(c.overdraftFee || 20)}.`) : '• Cash: choose a checking account and fund it with cash';
  const creditLine = s?.id==='cd' ? `• Credit Score: CDs reward patience, but early withdrawal hurts credit.` : s?.id==='hysa' ? `• Credit Score: High-yield stays strongest when you keep the account active and funded.` : c ? `• Credit Score: ${c.id==='student' ? 'no monthly fee, but an overdraft costs $20' : c.id==='standard' ? 'smaller overdraft fee with a monthly savings charge' : 'monthly savings charge, but overdraft is waived'}` : '• Credit Score: account choices affect overdraft and payment risk';
  const savingsLine = s ? `• Savings Goal: ${s.id==='cd' ? 'open a CD below and watch its maturity meter move each month' : s.id==='hysa' ? 'fund savings with at least $30 so $25 can move to high-yield and $5 stays behind' : `${s.name} grows about ${money(growth.amount)} each month`}` : '• Savings Goal: choose a savings account to see growth';
  const insuranceLine = ins ? `• Insurance: ${ins==='none' ? 'monthly cost $0, but emergencies hit harder' : ins==='basic' ? 'monthly cost $8 with balanced protection' : 'monthly cost $15 with the strongest protection'}` : '• Insurance: choose protection level to see risk impact';
  return `Choice Impact
${cashLine}
${creditLine}
${savingsLine}
${insuranceLine}`;
}

function splitSavingsDebt(total){
  total = Math.max(0, Math.round(Number(total)||0));
  const save = Math.round(total * 0.75);
  const debt = Math.max(0, total - save);
  return { save, debt };
}

function setSavingsDebtTotal(total){
  const split = splitSavingsDebt(total);
  state.plan.save = split.save;
  state.plan.debtPay = split.debt;
}

function applyBudgetModel(model){
  const income = state.plan.income;
  state.plan.model = model;
  state.plan.wants = 0;
  state.plan.wantsExtras = 0;
  state.plan.wantsSelections = [];
  state.plan.wantsCommitted = false;
  if($("wantsPick")) $("wantsPick").querySelectorAll('input[type="checkbox"]').forEach(o=> o.checked = false);
  syncWantsChecklistStyles();
  if(model === "rule503020"){
    state.plan.needs = Math.round(income * 0.50);
    setSavingsDebtTotal(Math.round(income * 0.20));
  } else {
    state.plan.needs = Math.round(income * 0.70);
    setSavingsDebtTotal(Math.round(income * 0.20));
  }
  updateWantsUI();
}

function canLockCurrentPlan(){
  return state.plan.needs > 0 && state.plan.wantsCommitted && state.plan.wants >= getWantsTargetAmount() && (state.plan.save + state.plan.debtPay) > 0;
}

function startupSelectionComplete(){
  if(!(state.bank.checkingType && state.bank.savingsType && state.plan.insurance)) return false;
  const check = Number(state.bank.startCheckingDeposit || 0);
  const save = Number(state.bank.startSavingsDeposit || 0);
  if((check + save) > state.cash) return false;
  if(state.bank.savingsType === 'hysa' && save < 30) return false;
  return true;
}


function renderCDStatus(){
  if(!$("cdStatusBox")) return;
  const lines = [];
  if(state.bank.hysaPrincipal > 0){
    const hysaProjected = state.bank.hysaPrincipal >= 25 ? Math.max(1, Math.round(state.bank.hysaPrincipal * 0.04)) : 0;
    lines.push(`High-Yield Savings: principal ${money(state.bank.hysaPrincipal)} • growth ${money(state.bank.hysaAccrued)} • next month +${money(hysaProjected)} • Benchmark #4`);
  }
  if(state.bank.cds.length){
    state.bank.cds.forEach((cd, idx)=> lines.push(`CD #${idx+1} ${cd.name}: ${money(cd.principal)} • ${cd.apr}% APR • ${cd.monthsLeft} month(s) left • accrued ${money(cd.accrued)} • next month +${money(Math.max(1, Math.round(cd.principal * (cd.apr/100))))} • Benchmark #4`));
  }
  $("cdStatusBox").textContent = lines.length ? lines.join("\n") : "No active high-yield investment or CDs yet.";

  // Update CD term picker — grey out terms that won't mature before year end (no 1-year option)
  const cdPick = $("cdTermPick");
  if(cdPick){
    const monthsLeft = state.weekEngine ? (12 - weekToMonth(state.weekEngine.week) + 1) : (12 - state.day + 1);
    cdPick.querySelectorAll("option").forEach(opt=>{
      const termMonths = {"3m":3,"6m":6}[opt.value]||99;
      if(termMonths > monthsLeft){
        opt.textContent = opt.value === "3m" ? "3-Month CD • 4.0% APR ⛔ won't mature" : "6-Month CD • 4.5% APR ⛔ won't mature";
        opt.style.color = "#aaa";
        opt.style.fontStyle = "italic";
      } else {
        opt.textContent = opt.value === "3m" ? "3-Month CD • 4.0% APR ✅" : "6-Month CD • 4.5% APR ✅";
        opt.style.color = "";
        opt.style.fontStyle = "";
      }
    });
  }
}

function createCD(termKey, deposit, silent=false, source='player'){
  const term = BANK_PRODUCTS.cdTerms[termKey];
  if(!term) return false;
  deposit = Number(deposit||0);
  if(deposit < 25){ if(!silent){ beep("warn"); showBanner("CD minimum is $25"); } return false; }
  // Use week-engine month if available, else fallback to state.day
  const currentMonth = state.weekEngine ? weekToMonth(state.weekEngine.week) : state.day;
  const monthsRemaining = 12 - currentMonth + 1;
  if(monthsRemaining < term.months){
    if(!silent){ beep("warn"); showBanner(`Only ${monthsRemaining} month(s) left — that CD won't mature before year end`); }
    return false;
  }
  const finishCreate=()=>{
    state.bank.cds.push({ id:`cd_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, term:termKey, name:term.name, apr:term.apr, termMonths:term.months, monthsLeft:term.months, principal:deposit, accrued:0 });
    state.bank.savingsType = 'cd';
    renderHeader(); renderSheet(); renderCDStatus();
    return true;
  };
  if(source==='bonus' || source==='paycheck'){ finishCreate(); return true; }
  chooseFundingSource(deposit, `Choose where to take ${money(deposit)} for your ${term.name}.`, ()=>{
    finishCreate(); addLedgerLine(`Opened ${term.name} for ${money(deposit)}`); queueDecisionReflection({ type:'save', title:'Opened a CD', label:`${term.name} for ${money(deposit)}`, summary:`You locked ${money(deposit)} into ${term.name}.`, amount:deposit }); notifyAction('open_cd');
  });
  return 'pending';
}

function transferToSavings(){
  const amt = Number($("transferAmt").value || 0);
  if(state.bank.checking < amt){
    beep("warn");
    showBanner("Not enough in checking");
    return;
  }
  state.bank.checking -= amt;
  state.bank.savings += amt;
  addLedgerLine(`Transfer: ${money(amt)} from checking to savings`);
  renderHeader();
  renderSheet();
  queueDecisionReflection({ type:'save', title:'Transfer to Savings', label:`Moved ${money(amt)} to savings`, summary:`${money(amt)} moved from checking to savings`, amount:amt });
  notifyAction("transfer_savings");
}
function transferToChecking(){
  const amt = Number($("transferAmt").value || 0);
  if(state.bank.savings < amt){
    beep("warn");
    showBanner("Not enough in savings");
    return;
  }
  state.bank.savings -= amt;
  state.bank.checking += amt;
  addLedgerLine(`Transfer: ${money(amt)} from savings to checking`);
  renderHeader();
  renderSheet();
  notifyAction("transfer_savings");
}

function renderSheet(){
  reconcileHysaBalance();
  if(!$("sheetBox")) return;
  const totalIncome = state.plan.income;
  const wantsTotal = state.plan.wants + state.plan.wantsExtras;
  const savingsDebt = state.plan.save + state.plan.debtPay;
  const activeJob = state.jobs[state.jobIndex];

  // Build wants inventory display
  const wantsLines = [];
  if(state.plan.wantsSelections && state.plan.wantsSelections.length > 0){
    wantsLines.push(`WANTS (My Monthly Budget)`);
    state.plan.wantsSelections.forEach(w => {
      const inv = state.plan.wantsInventoryActive ? state.plan.wantsInventoryActive.find(x=>x.label===w.label) : null;
      const status = inv ? (inv.available ? "⬜ budgeted / not used yet" : "✅ used from budget") : "⬜ budgeted / not used yet";
      wantsLines.push(`  ${w.label} ............. ${money(w.value)} [${status}]`);
    });
    wantsLines.push(`  Total wants ........... ${money(wantsTotal)}`);
  } else {
    wantsLines.push(`WANTS`);
    wantsLines.push(`  Wants budget .......... ${money(wantsTotal)}`);
  }

  const activeCdLines = state.bank.cds.length
    ? state.bank.cds.map((cd, idx)=>`    • CD #${idx+1}: ${cd.name} | ${money(cd.principal)} | ${cd.monthsLeft} mo left | next +${money(Math.max(1, Math.round(cd.principal * (cd.apr/100))))}`)
    : ["    • none open"];
  const hysaView = getHysaSnapshot({projectFirstMonth:true});

  const lines = [
    "WGLT BUDGET SHEET",
    `Job: ${activeJob.name}`,
    `Year Plan: ${getBudgetModelName()}${state.plan.lockedForYear ? " (Locked)" : ""}`,
    "",
    `INCOME`,
    `  Monthly Salary ........ ${money(totalIncome)}`,
    `  Tax (${state.plan.taxPct}%) ............... -${money(Math.round(totalIncome*(state.plan.taxPct/100)))}`,
    `  Take-Home ............. ${money(totalIncome - Math.round(totalIncome*(state.plan.taxPct/100)))}`,
    "",
    `NEEDS`,
    `  Needs budget .......... ${money(state.plan.needs)}`,
    `  Insurance ............. ${state.plan.insurance[0].toUpperCase()+state.plan.insurance.slice(1)}`,
    "",
    ...wantsLines,
    "",
    `SAVINGS & DEBT`,
    `  Savings ............... ${money(state.plan.save)}`,
    `  Debt pay .............. ${money(state.plan.debtPay)}`,
    `  Savings goal .......... ${state.savingsGoal ? money(state.savingsGoal) : "Not set"}`,
    "",
    `LIVE ACCOUNTS`,
    `  Checking .............. ${money(state.bank.checking)}`,
    `  Savings ............... ${money(state.bank.savings)}`,
    `  Active CDs ............ ${state.bank.cds.length}`,
    ...activeCdLines,
    `  High-yield principal .. ${money(hysaView.balance)}`,
    `  High-yield growth ..... ${money(hysaView.totalGrowth)}${hysaView.isEligible ? ` | Next month proj ${money(hysaView.nextMonthProjection)}` : " | Needs $25 min"}`,
    `  CD value total ........ ${money(totalCdFunds())}`,
    `  Credit score .......... ${state.credit}`,
    "",
    `JOB LEDGER`,
    `  Week expenses ......... ${money(state.ledger.weekExpenses)}`,
    `  Week profit ........... ${money(state.ledger.weekProfit)}`,
    "",
    `NOTES`,
    `  Current growth ........ ${getSavingsMonthlyGrowth().note}`
  ];

  // Build HTML with colored monthly snapshots
  let html = `<pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap">${lines.join('\n')}</pre>`;

  // Monthly snapshots in color
  if(state.monthSnapshots && state.monthSnapshots.length > 0){
    html += `<div style="margin-top:14px">`;
    const colors = ["#e8f4fd","#e8fdf0","#fdf8e8","#f8e8fd","#fde8e8","#e8f0fd","#fdf0e8","#e8fdf8","#f0fde8","#fde8f0","#e8fdfd","#fdeee8"];
    state.monthSnapshots.forEach((snap, i) => {
      const color = colors[i % colors.length];
      const hysaGrowthMonthStr = snap.hysaGrowthMonth > 0 ? `+${money(snap.hysaGrowthMonth)}` : money(snap.hysaGrowthMonth || 0);
      const hysaGrowthStr = snap.hysaGrowth > 0 ? `+${money(snap.hysaGrowth)}` : money(snap.hysaGrowth);
      const goalStr = snap.savingsGoalPct > 0 ? `${snap.savingsGoalPct}% of goal` : "Goal not set";
      const wantsSummaryHtml = (snap.wantsSummary && snap.wantsSummary.length)
        ? `<div style="margin-top:8px;border-top:1px dashed rgba(0,0,0,.12);padding-top:8px">
             <div style="font-weight:1100;font-size:12px;margin-bottom:6px;color:#0b57d0">Wants Summary</div>
             ${snap.wantsSummary.map(w => `
               <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin:2px 0">
                 <span>${w.used ? '✅' : '⬜'} ${w.label}</span>
                 <span>${money(w.value)}</span>
               </div>
             `).join('')}
             ${(snap.wantsSummary || []).some(w => w.used) ? `<div style="margin-top:6px;font-size:12px;color:#1fa971;font-weight:1000">Budgeting pays off when a social choice was already planned.</div>` : ``}
             ${snap.unplannedWantUsed ? `<div style="margin-top:6px;font-size:12px;color:#b45309;font-weight:1000">Sometimes it's ok to treat your self but lets try to plan for that next time or skip it.</div>` : ``}
             ${snap.unplannedWantUsed && (snap.unplannedWantLabels || []).length ? `<div style="margin-top:4px;font-size:12px;color:#92400e;font-weight:1000">${(snap.unplannedWantLabels || []).map(label => `⚠️ ${label}`).join('<br>')}</div>` : ``}
           </div>`
        : '';
      html += `<div style="background:${color};border-radius:10px;padding:10px 12px;margin-bottom:8px;border:1px solid rgba(0,0,0,.07)">
        <div style="font-weight:1100;font-size:13px;margin-bottom:6px">📅 ${snap.monthName} — End of Month ${snap.month}</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre">Checking: ${money(snap.checking)}   Savings: ${money(snap.savings)}   Cash: ${money(snap.cash)}
High-Yield balance: ${money(snap.hysa)} (this month growth: ${hysaGrowthMonthStr} • total growth: ${hysaGrowthStr})
CD total: ${money(snap.cd)}   Credit: ${snap.credit}
Savings goal: ${goalStr}</div>
        ${(snap.identityTitle || snap.identityDetail) ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.58);font-size:12px;line-height:1.45"><b>${snap.identityEmoji || '🧾'} ${snap.identityTitle || 'Identity Snapshot'}</b><br>${snap.identityDetail || ''}</div>` : ''}
        ${wantsSummaryHtml}
      </div>`;
    });
    html += `</div>`;
  }

  $("sheetBox").innerHTML = html;
}

/* Startup chooser: bank + insurance (tap only) */
function startupChoose(){
  function choiceCard(label, note, selected, action){
    return `<button class="choice-btn ${selected ? 'selected' : ''}" data-startup-action="${action}">${label}<small>${note}</small></button>`;
  }

  function renderStartupModal(){
    $("mTitle").textContent = "🏦 Startup: Bank + Insurance";
    $("mMeta").textContent = getModeConfig().showBenchmarksInMeta ? `Benchmark #1: ${BENCH[1]} • Benchmark #6: ${BENCH[6]} • Benchmark #12: ${BENCH[12]}` : "Benchmark #1 • #6 • #12";

    $("mBody").innerHTML = `
      <div style="font-weight:1000">Pick a checking account, choose a savings path, fund your new accounts with cash, then choose insurance. Your choices stay highlighted.</div>
      <div class="impact-box" style="margin-top:12px">Starter Cash
You begin with ${money(state.cash)} in cash.
• Checking starts at $0.
• Savings starts at $0.
• High-Yield needs $30 sent into savings first, so $25 can move into high-yield and $5 stays behind to keep savings open.
• CDs use cash, checking, or savings above the $5 safety floor.</div>

      <div style="margin-top:12px;font-weight:1100">Starter Funding</div>
      <div class="choice-grid">
        ${[0,25,50,100].map(val => choiceCard(`Checking Deposit ${money(val)}`, 'Move cash into checking', state.bank.startCheckingDeposit===val, `d_check_${val}`)).join('')}
        ${[0,5,10,25,30,50].map(val => choiceCard(`Savings Deposit ${money(val)}`, 'Move cash into savings', state.bank.startSavingsDeposit===val, `d_save_${val}`)).join('')}
      </div>

      <div style="margin-top:12px;font-weight:1100">1) Checking Account</div>
      <div class="choice-grid">
        ${choiceCard('Student Checking', 'No monthly checking fee. Overdraft fee is $20.', state.bank.checkingType==='student', 'c_student')}
        ${choiceCard('Standard Checking', '$5 monthly fee from savings. Overdraft fee is $10.', state.bank.checkingType==='standard', 'c_standard')}
        ${choiceCard('Rewards Checking', '$10 monthly fee from savings. Overdraft fee is waived.', state.bank.checkingType==='rewards', 'c_rewards')}
      </div>

      <div style="margin-top:14px;font-weight:1100">2) Savings Account</div>
      <div class="choice-grid">
        ${choiceCard('Regular Savings', '0.5% APR and no minimum.', state.bank.savingsType==='basic', 's_basic')}
        ${choiceCard('High-Yield Savings', '4% APR with just a $25 minimum.', state.bank.savingsType==='hysa', 's_hysa')}
        ${choiceCard('CD Builder', 'Open CDs in 3 or 6 month terms.', state.bank.savingsType==='cd', 's_cd')}
      </div>

      <div style="margin-top:14px;font-weight:1100">3) Insurance</div>
      <div class="choice-grid">
        ${choiceCard('None', 'Keeps more money now, but emergencies hit harder.', state.plan.insurance==='none', 'i_none')}
        ${choiceCard('Basic', 'Balanced protection for common surprises. $8/mo.', state.plan.insurance==='basic', 'i_basic')}
        ${choiceCard('Strong', 'Best protection against surprise costs. $15/mo.', state.plan.insurance==='strong', 'i_strong')}
      </div>

      <div class="impact-box">${getChoiceImpactText().split('\n').join('<br>')}</div>
    `;

    const foot = $("mFoot");
    foot.innerHTML = '';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn secondary';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = ()=>{ beep('click'); closeModal(); };

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn success' + (startupSelectionComplete() ? ' done-ready' : '');
    doneBtn.textContent = startupSelectionComplete() ? 'Done ✓' : 'Done';
    doneBtn.onclick = ()=>{
      if(!startupSelectionComplete()){
        beep('warn');
        showBanner(state.bank.savingsType==='hysa' ? 'High-yield needs $30 in savings first' : 'Finish your startup choices first');
        return;
      }
      const totalDeposit = Number(state.bank.startCheckingDeposit || 0) + Number(state.bank.startSavingsDeposit || 0);
      if(totalDeposit > state.cash){
        beep('warn');
        showBanner('That uses more cash than you have');
        return;
      }
      state.cash -= Number(state.bank.startCheckingDeposit || 0);
      state.bank.checking += Number(state.bank.startCheckingDeposit || 0);
      state.cash -= Number(state.bank.startSavingsDeposit || 0);
      state.bank.savings += Number(state.bank.startSavingsDeposit || 0);

      if(state.bank.savingsType === 'hysa'){
        if(state.bank.savings < 30){
          beep('warn');
          showBanner('High-yield needs $30 in savings first');
          return;
        }
        state.bank.savings -= 25;
        addToHysa(25);
        state.bank.startupFeePaid = true;
      }
      beep('success');
      closeModal();
      // Ask where they want their monthly paycheck deposited
      openModal({
        title:"💵 Where Should Your Paycheck Go?",
        meta:"You can change this any time",
        body:`You've set up your bank account. Each month when you get paid, where should your paycheck be deposited?

Your accounts:
• Checking (${BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType)?.name || 'Checking'})
• Savings (${BANK_PRODUCTS.savings.find(x=>x.id===state.bank.savingsType)?.name || 'Savings'})
• Cash (keep it as cash)

Most people deposit to checking so bills can be paid easily.`,
        buttons:[
          {id:"checking", label:"Deposit to Checking ✓", kind:"primary"},
          {id:"savings",  label:"Deposit to Savings", kind:"secondary"},
          {id:"cash",     label:"Keep as Cash", kind:"secondary"}
        ],
        onPick:(dest)=>{
          state.bank.paycheckDestination = dest;
          const destLabels = {checking:"Checking", savings:"Savings", cash:"Cash"};
          addLedgerLine(`Paycheck destination set: ${destLabels[dest]}`);
          setLog(`Startup complete: bank + insurance selected. Paycheck → ${destLabels[dest]}.`);
          renderHeader();
          renderSheet();
          notifyAction('startup_choose');
        }
      });
    };

    foot.appendChild(closeBtn);
    foot.appendChild(doneBtn);

    $("overlay").classList.add('show');
    $("overlay").setAttribute('aria-hidden','false');

    document.querySelectorAll('[data-startup-action]').forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.dataset.startupAction;
        if(id==='c_student') state.bank.checkingType='student';
        if(id==='c_standard') state.bank.checkingType='standard';
        if(id==='c_rewards') state.bank.checkingType='rewards';
        if(id==='s_basic') state.bank.savingsType='basic';
        if(id==='s_hysa') state.bank.savingsType='hysa';
        if(id==='s_cd') state.bank.savingsType='cd';
        if(id==='i_none') state.plan.insurance='none';
        if(id==='i_basic') state.plan.insurance='basic';
        if(id==='i_strong') state.plan.insurance='strong';
        if(id.startsWith('d_check_')) state.bank.startCheckingDeposit = Number(id.replace('d_check_',''));
        if(id.startsWith('d_save_')) state.bank.startSavingsDeposit = Number(id.replace('d_save_',''));
        beep('click');
        renderHeader();
        renderStartupModal();
      };
    });
  }

  renderStartupModal();
}

/* Savings challenge */
function openSavingsChallenge(){
  const options = [50,100,200,300,500];

  function renderSavingsModal(){
    $("mTitle").textContent = "🏁 Savings Challenge";
    $("mMeta").textContent = "Pick a goal and keep it highlighted";
    $("mBody").innerHTML = `
      <div style="font-weight:1000">Pick a year-end savings goal. Your choice stays highlighted when you come back.</div>
      <div class="choice-grid" style="margin-top:12px">
        ${options.map(goal => `<button class="choice-btn ${state.savingsGoal===goal ? 'selected' : ''}" data-goal="${goal}">Goal: ${money(goal)}<small>Track progress all year long</small></button>`).join('')}
      </div>
      <div class="impact-box" style="margin-top:12px">Current Goal
${state.savingsGoal ? `${money(state.savingsGoal)} by Month 12` : 'Not set yet'}

Rewards
• 25% goal: +$5 bonus
• 50% goal: +$10 bonus
• 75% goal: +$15 bonus
• 100% goal: +$25 bonus</div>`;

    const foot = $("mFoot");
    foot.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn secondary';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = ()=>{ beep('click'); closeModal(); };

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn success' + (state.savingsGoal ? ' done-ready' : '');
    doneBtn.textContent = state.savingsGoal ? 'Done ✓' : 'Done';
    doneBtn.onclick = ()=>{
      if(!state.savingsGoal){
        beep('warn');
        showBanner('Choose a savings goal first');
        return;
      }
      beep('success');
      closeModal();
      setLog(`Savings challenge set: ${money(state.savingsGoal)} by Month 12.`);
      renderHeader();
      notifyAction("savings_goal");
    };
    foot.appendChild(closeBtn);
    foot.appendChild(doneBtn);

    $("overlay").classList.add('show');
    $("overlay").setAttribute('aria-hidden','false');
    document.querySelectorAll('[data-goal]').forEach(btn=>{
      btn.onclick = ()=>{
        state.savingsGoal = Number(btn.dataset.goal);
        beep('click');
        renderHeader();
        renderSavingsModal();
      };
    });
  }
  renderSavingsModal();
}

function checkSavingsMilestones(){
  if(state.savingsGoal<=0) return;

  const saved = state.bank.savings;
  const goal = state.savingsGoal;
  const pct = saved / goal;

  const hits = [
    {k:"25", thr:0.25, bonus:5},
    {k:"50", thr:0.50, bonus:10},
    {k:"75", thr:0.75, bonus:15},
    {k:"100", thr:1.00, bonus:25}
  ];

  hits.forEach(h=>{
    if(pct>=h.thr && !state.savingsMilestones.has(h.k)){
      state.savingsMilestones.add(h.k);
      state.bank.savings += h.bonus;
      showBanner(`Savings milestone ${h.k}%! +${money(h.bonus)} reward`);
      addLedgerLine(`Savings milestone ${h.k}% reward +${money(h.bonus)} (to savings)`);
      addCoverage(12);
    }
  });
}

/* Suggested plan */
function suggestedPlan(){
  const income = state.plan.income;
  const models = {
    rule702010: {
      name:'70-20-10 Rule (Beginner)',
      meta:'70% Needs • 20% Savings/Debt • 10% Wants',
      needs: Math.round(income*0.70),
      wantsTarget: Math.round(income*0.10),
      savingsDebt: Math.round(income*0.20),
      chart:{needs:70, save:20, wants:10},
      note:'70% goes to Needs, 20% goes to Savings/Debt, 10% goes to Wants.'
    },
    rule602020: {
      name:'60-20-20 Rule (Balanced)',
      meta:'60% Needs • 20% Wants • 20% Savings/Debt',
      needs: Math.round(income*0.60),
      wantsTarget: Math.round(income*0.20),
      savingsDebt: Math.round(income*0.20),
      chart:{needs:60, save:20, wants:20},
      note:'60% goes to Needs, 20% goes to Wants, 20% goes to Savings/Debt.'
    },
    rule503020: {
      name:'50-30-20 Rule (Lifestyle)',
      meta:'50% Needs • 30% Wants • 20% Savings/Debt',
      needs: Math.round(income*0.50),
      wantsTarget: Math.round(income*0.30),
      savingsDebt: Math.round(income*0.20),
      chart:{needs:50, save:20, wants:30},
      note:'50% goes to Needs, 30% goes to Wants, 20% goes to Savings/Debt.'
    },
    rule504010: {
      name:'50-40-10 Rule (Future Builder)',
      meta:'50% Needs • 10% Wants • 40% Savings/Debt',
      needs: Math.round(income*0.50),
      wantsTarget: Math.round(income*0.10),
      savingsDebt: Math.round(income*0.40),
      chart:{needs:50, save:40, wants:10},
      note:'50% goes to Needs, 10% goes to Wants, 40% goes to Savings/Debt.'
    }
  };

  function planChartHTML(chart){
    return `
      <div style="margin-top:8px">
        <div style="display:flex;height:14px;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:#fff">
          <div style="width:${chart.needs}%;background:#e74c3c"></div>
          <div style="width:${chart.save}%;background:#1fa971"></div>
          <div style="width:${chart.wants}%;background:#f4c542"></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;font-weight:900">
          <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#e74c3c;display:inline-block"></span>Needs</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#1fa971;display:inline-block"></span>Savings / Debt</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#f4c542;display:inline-block"></span>Wants</span>
        </div>
      </div>`;
  }

  function renderPlanModal(){
    const chosen = state.plan.model || 'rule702010';
    const m = models[chosen];
    const split = splitSavingsDebt(m.savingsDebt);
    $("mTitle").textContent = '📊 Year Plan';
    $("mMeta").textContent = state.plan.lockedForYear ? 'Locked for this year mission' : m.meta;
    $("mBody").innerHTML = `
      <div style="font-weight:1000">Choose the budget style for the whole year. Wants now start at $0 and must be built by the player from the wants list before the mission can start.</div>
      <div class="choice-grid" style="margin-top:12px">
        ${Object.entries(models).map(([key,val]) => `
          <button class="choice-btn ${chosen===key ? 'selected' : ''}" data-model="${key}">
            <div style="font-weight:1100">${val.name}</div>
            <small style="display:block;margin-top:4px">${val.note}</small>
            ${planChartHTML(val.chart)}
          </button>`).join('')}
      </div>
      <div class="impact-box" style="margin-top:12px">${m.name}
Income: ${money(income)}
Needs: ${money(m.needs)}
Wants target to build: ${money(m.wantsTarget)}
Savings + Debt: ${money(m.savingsDebt)}
Auto split inside that benchmark: Savings ${money(split.save)} • Debt ${money(split.debt)}

${state.plan.lockedForYear ? 'This plan is already locked for the current year.' : 'Pick the rule you want to teach, then build wants from the dropdown on the Plan tab.'}</div>`;

    const foot = $("mFoot");
    foot.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn secondary';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = ()=>{ beep('click'); closeModal(); };

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn success' + (state.plan.lockedForYear ? '' : ' done-ready');
    applyBtn.textContent = state.plan.lockedForYear ? 'Locked ✓' : 'Use This Rule';
    applyBtn.onclick = ()=>{
      if(state.plan.lockedForYear){ beep('warn'); showBanner('Year plan already locked'); return; }
      state.plan.model = chosen;
      state.plan.chosenForYear = true;
      applyBudgetModel(chosen);
      closeModal();
      renderAll();
      guidePreStart();
      showBanner(`${models[chosen].name} selected. Lock it in next.`);
      setLog(`${models[chosen].name} selected. Tap Lock Plan for Year to lock this rule, then choose a job.`);
    };
    foot.appendChild(closeBtn);
    foot.appendChild(applyBtn);

    $("overlay").classList.add('show');
    $("overlay").setAttribute('aria-hidden','false');
    document.querySelectorAll('[data-model]').forEach(btn=>{
      btn.onclick = ()=>{
        if(state.plan.lockedForYear){ beep('warn'); showBanner('Year plan already locked'); return; }
        state.plan.model = btn.dataset.model;
        beep('click');
        renderPlanModal();
      };
    });
  }
  renderPlanModal();
}

/* Apply Plan */
function applyPlan(){
  if(state.plan.lockedForYear){
    beep("warn");
    showBanner("Year plan already locked");
    return;
  }
  state.plan.lockedForYear = true;
  state.plan.chosenForYear = true;
  state.plan.appliedMonths = new Set();

  // Reconnect the budgeting benchmark when the year plan is locked.
  // This keeps Benchmark #7 checked even before the mission starts.
  trackCoverageForAction("apply_plan");

  if(state.mission.active){
    state.plan.appliedMonths.add(state.day);
    applyMonthlyPlanForCurrentMonth();
    setLog(`${getBudgetModelName()} locked for the year and applied for Month ${state.day}.`);
    notifyAction("apply_plan");
  } else {
    state.plan.wantsCommitted = false;
    setLog(`${getBudgetModelName()} locked. Benchmark #7 checked off. Step 2: choose a student job, then build wants and start the year mission.`);
    showBanner("Year plan locked. Budgeting benchmark checked.");
  }
  beep("success");
  renderHeader();
  renderSheet();
  renderBucketTracker();
  guidePreStart();
}

function applyMonthlyPlanForCurrentMonth(){
  if(state.plan.appliedMonths.has(state.day) && state.plan.lockedForYear && state.day !== 1){
    return;
  }
  const gross=state.plan.income;
  const tax=Math.round(gross*(state.plan.taxPct/100));
  const takeHome=gross-tax;

  // Only add paycheck if NOT in week-engine mode (week engine handles it in nextWeek)
  if(!state.weekEngine || !state.mission.active){
    state.bank.checking += takeHome;
    state.ledger.weekIncome += takeHome;
  }

  const spend = state.plan.needs + state.plan.wants + state.plan.wantsExtras;
  state.bank.checking -= spend;
  state.ledger.weekExpenses += spend;

  state.bank.checking -= state.plan.save;
  state.bank.savings += state.plan.save;

  state.bank.checking -= state.plan.debtPay;
  state.credit = clamp(state.credit + Math.round(state.plan.debtPay/5), 300, 850);
  const insuranceCost = state.plan.insurance==='basic' ? 8 : state.plan.insurance==='strong' ? 15 : 0;
  if(insuranceCost>0){
    state.bank.checking -= insuranceCost;
    state.ledger.weekExpenses += insuranceCost;
    addLedgerLine(`Insurance premium: -${money(insuranceCost)}`);
  }
  applyRecurringContractCharge(state.day, `Month ${state.day}`);
  state.plan.appliedMonths.add(state.day);

  if(state.bank.checking < 0){
    const ct = state.bank.checkingType ? BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType) : null;
    const fee = ct ? ct.overdraftFee : 15;
    if(fee>0){
      state.bank.checking -= fee;
      addLedgerLine(`Overdraft fee: -${money(fee)}`);
      setLog(`Overdraft! Fee ${money(fee)} applied. Credit -12.`);
    } else {
      addLedgerLine('Overdraft fee waived by Rewards Checking.');
      setLog('Overdraft happened, but Rewards Checking waived the fee. Credit -12.');
    }
    state.credit = clamp(state.credit - 12, 300, 850);
    beep("warn");
  }else{
    setLog(`Week ${state.weekEngine ? state.weekEngine.week : state.day} auto-ran with your year plan. Take-home: ${money(takeHome)} (Tax: ${money(tax)})`);
  }

  recalcProfit();
  renderHeader();
  renderLedger();
  renderSheet();
}

/* Monthly bank effects */

function ensureHysaFields(){
  if(!state.bank) state.bank = {};
  state.bank.hysaPrincipal = Number(state.bank.hysaPrincipal || 0);
  state.bank.hysaDeposits = Number(state.bank.hysaDeposits || 0);
  state.bank.hysaAccrued = Number(state.bank.hysaAccrued || 0);
  state.bank.hysaLastGrowth = Number(state.bank.hysaLastGrowth || 0);
}
function addToHysa(amount, sourceLabel){
  ensureHysaFields();
  const amt = Math.max(0, Math.round(Number(amount || 0)));
  if(!amt) return 0;
  state.bank.hysaPrincipal += amt;
  state.bank.hysaDeposits += amt;
  if(sourceLabel) addLedgerLine(`${sourceLabel}: +${money(amt)} to HYSA`);
  return amt;
}
function reconcileHysaBalance(){
  ensureHysaFields();
  if(state.bank.hysaPrincipal <= 0 && state.bank.hysaAccrued <= 0) return;
  if(state.bank.hysaDeposits <= 0){
    state.bank.hysaDeposits = Math.max(0, state.bank.hysaPrincipal - state.bank.hysaAccrued);
  }
  const expected = state.bank.hysaDeposits + state.bank.hysaAccrued;
  if(expected > state.bank.hysaPrincipal){
    state.bank.hysaPrincipal = expected;
  }
}

function getHysaSnapshot(options = {}){
  ensureHysaFields();
  const apr = 0.04;
  const deposits = Math.max(
    0,
    Number(state.bank.hysaDeposits || 0),
    Math.max(0, Number(state.bank.hysaPrincipal || 0) - Number(state.bank.hysaAccrued || 0))
  );
  let totalGrowth = Math.max(0, Number(state.bank.hysaAccrued || 0));
  let growthThisMonth = Math.max(0, Number(state.bank.hysaLastGrowth || 0));
  const isActive = state.bank.savingsType === 'hysa' || deposits >= 25 || Number(state.bank.hysaPrincipal || 0) >= 25;
  const shouldProjectFirstMonth = options.projectFirstMonth !== false;

  if(isActive && shouldProjectFirstMonth && deposits >= 25 && totalGrowth === 0 && growthThisMonth === 0){
    growthThisMonth = Math.max(1, Math.round(deposits * apr));
    totalGrowth = growthThisMonth;
  }

  const balance = deposits + totalGrowth;
  const nextMonthProjection = deposits >= 25 ? Math.max(1, Math.round(balance * apr)) : 0;

  return {
    deposits,
    growthThisMonth,
    totalGrowth,
    balance,
    nextMonthProjection,
    isActive,
    isEligible: deposits >= 25
  };
}

function applyHysaSnapshot(snapshot, options = {}){
  ensureHysaFields();
  const previousBalance = Number(state.bank.hysaPrincipal || 0);
  state.bank.hysaDeposits = snapshot.deposits;
  state.bank.hysaLastGrowth = snapshot.growthThisMonth;
  state.bank.hysaAccrued = snapshot.totalGrowth;
  state.bank.hysaPrincipal = snapshot.balance;
  if(snapshot.isActive && state.bank.savingsType !== 'hysa') state.bank.savingsType = 'hysa';
  if(options.logCorrection && snapshot.balance > previousBalance){
    const corrected = snapshot.balance - previousBalance;
    addLedgerLine(`High-yield growth correction: +${money(corrected)} at month end`);
  }
  return snapshot;
}

function normalizeHysaMonthEndGrowth(){
  const snap = getHysaSnapshot({projectFirstMonth:true});
  if(!snap.isActive) return;
  applyHysaSnapshot(snap, {logCorrection:(state.bank.hysaAccrued || 0) === 0 && snap.totalGrowth > 0});
}

function applyWeeklyBankEffects(){
  reconcileHysaBalance();
  state.bank.hysaLastGrowth = 0;
  const ct = state.bank.checkingType ? BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType) : null;
  if(ct && ct.monthlyFee>0){
    const takenFromSavings = Math.min(state.bank.savings, ct.monthlyFee);
    state.bank.savings -= takenFromSavings;
    const remainder = ct.monthlyFee - takenFromSavings;
    if(remainder>0) state.bank.checking -= remainder;
    addLedgerLine(`Bank fee: -${money(ct.monthlyFee)} (${takenFromSavings ? 'from savings' : 'from checking'})`);
  }
  const st = state.bank.savingsType ? BANK_PRODUCTS.savings.find(x=>x.id===state.bank.savingsType) : null;
  if(st){
    if(st.id==="basic"){
      const interest = Math.max(0, Math.round(state.bank.savings * (st.apr/100)));
      state.bank.savings += interest;
      if(interest>0) addLedgerLine(`Savings growth: +${money(interest)} for Month ${state.day} at ${st.apr}%`);
    } else if(st.id==="hysa"){
      if(state.bank.hysaPrincipal > 0){
        const interest = state.bank.hysaPrincipal >= 25 ? Math.max(1, Math.round(state.bank.hysaPrincipal * (st.apr/100))) : 0;
        state.bank.hysaLastGrowth = interest;
        state.bank.hysaAccrued += interest;
        state.bank.hysaPrincipal += interest;
        if(interest>0) addLedgerLine(`High-yield growth: +${money(interest)} for Month ${state.day} at ${st.apr}%`);
        else addLedgerLine(`High-yield is funded, but it needs ${money(25 - state.bank.hysaPrincipal)} more to start earning.`);
        state.credit = clamp(state.credit + 1, 300, 850);
      } else addLedgerLine('High-yield is selected, but it still needs funding.');
    } else if(!state.bank.cds.length) addLedgerLine('CD Builder selected, but no CD is open yet.');
    addCoverage(4); addCoverage(5);
  }
  state.bank.cds.forEach(cd=>{ const monthlyInterest=Math.max(1,Math.round(cd.principal*(cd.apr/100))); cd.accrued += monthlyInterest; cd.principal += monthlyInterest; cd.monthsLeft -= 1; addLedgerLine(`${cd.name}: +${money(monthlyInterest)} growth this month`); });
  const matured = state.bank.cds.filter(cd=>cd.monthsLeft<=0);
  if(matured.length){ matured.forEach(cd=>{ const payout=cd.principal; state.bank.savings += payout; state.credit = clamp(state.credit + (cd.termMonths >= 12 ? 2 : 1), 300, 850); addLedgerLine(`${cd.name} matured: +${money(payout)} returned to savings`); }); state.bank.cds = state.bank.cds.filter(cd=>cd.monthsLeft>0); }
  updateImpactStrip(); renderCDStatus(); renderBucketTracker(); renderMeters();
}

/* Next week (48-week engine) */
function nextWeek(){
  // Block advancement until the student actually reviews the Budget Sheet snapshot
  if(state.ui && state.ui.pendingBudgetSheetReview){
    beep("warn");
    openTab("sheet", {auto:true});
    setTimeout(()=>{
      const sheetPanel = $("panel-sheet");
      if(sheetPanel) sheetPanel.scrollIntoView({behavior:"smooth", block:"start"});
    }, 120);
    showBanner("Review the Budget Sheet first");
    return;
  }

  // Block advancement if student chose "Pick New Wants" and hasn't committed yet
  if(state._wantsRefreshCallback){
    beep("warn");
    openModal({
      title:"⏸️ Wants Not Committed Yet",
      meta:"Required before advancing",
      body:"You chose to pick new wants for this month but haven't committed them yet.\n\nGo to the Plan tab, check your wants, then tap \"Add Wants to Plan\" to lock them in.",
      buttons:[
        {id:"go", label:"Go to Plan Tab →", kind:"primary"},
        {id:"skip", label:"Keep Previous Wants Instead", kind:"secondary"}
      ],
      onPick:(id)=>{
        if(id==="go"){
          openTab("plan");
          setTimeout(()=>{
            const wf=$("wantsPick")?$("wantsPick").closest('.field'):null;
            if(wf){wf.classList.add('glow');wf.scrollIntoView({behavior:"smooth",block:"center"});}
            scrollToBtn("btnAddWant");
          },200);
        } else {
          // Student gives up — restore previous wants and continue
          const cb = state._wantsRefreshCallback;
          state._wantsRefreshCallback = null;
          reloadWantsInventoryForNewMonth();
          state.plan.wantsCommitted = true;
          showBanner("Previous wants restored");
          if(cb) setTimeout(cb, 100);
        }
      }
    });
    return;
  }
  if(state.weekEngine && state.mission.active){
    const currentW = state.weekEngine.week;
    if(currentW >= 48){
      renderAll();
      notifyAction("next_week");
      if(isEliteExperience()){
        ensureEliteState();
        const ending = getEliteEndingTrack();
        state.elite.endings.final = ending;
        const career = state.elite.career || { level:1, title:'Starter Worker' };
        const unlocks = getCreditUnlocks();
        const endingScenes = {
          '💎 Wealth Builder': {
            title:'💎 Elite Ending: Wealth Builder',
            meta:'You finished strong',
            body:`You built a sturdy money tower this year.

Career: ${career.title} (${career.branch || getJobCareerBranch().name})
Credit: ${state.credit} (${getCreditTier()})
Investments: ${money(totalStockFunds())} | ${getStockMixSummary()}
Savings: ${money(Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0))}
Credit Unlocks: Apartment ${unlocks.apartment} • Car ${unlocks.car} • Loan ${unlocks.loan}

You finished with options, not just survival.`,
            kind:'success'
          },
          '🚨 Financially Struggling': {
            title:'🚨 Elite Ending: Financially Struggling',
            meta:'A tough year, but readable',
            body:`This year squeezed you hard, but the score tells a story you can learn from.

Career: ${career.title} (${career.branch || getJobCareerBranch().name})
Credit: ${state.credit} (${getCreditTier()})
Investments: ${money(totalStockFunds())} | ${getStockMixSummary()}
Savings: ${money(Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0))}
Credit Unlocks: Apartment ${unlocks.apartment} • Car ${unlocks.car} • Loan ${unlocks.loan}

Action Plan: ${getMonthlyActionPlan({})}`,
            kind:'danger'
          },
          '⚖️ Survivor': {
            title:'⚖️ Elite Ending: Survivor',
            meta:'You stayed standing',
            body:`You kept the machine running and learned where pressure shows up.

Career: ${career.title} (${career.branch || getJobCareerBranch().name})
Credit: ${state.credit} (${getCreditTier()})
Investments: ${money(totalStockFunds())} | ${getStockMixSummary()}
Savings: ${money(Number(state.bank?.savings || 0) + Number(state.bank?.hysaPrincipal || 0) + Number(totalCdFunds ? totalCdFunds() : 0))}
Credit Unlocks: Apartment ${unlocks.apartment} • Car ${unlocks.car} • Loan ${unlocks.loan}

Action Plan: ${getMonthlyActionPlan({})}`,
            kind:'primary'
          }
        };
        const scene = endingScenes[ending] || endingScenes['⚖️ Survivor'];
        openModal({
          title:scene.title,
          meta:scene.meta,
          body:scene.body,
          buttons:[{id:'ok', label:'View Final Budget Sheet', kind:'primary'}],
          onPick:()=>{
            setTimeout(()=>{
              openTab("sheet", {auto:true});
              const sheetPanel = $("panel-sheet");
              if(sheetPanel) sheetPanel.scrollIntoView({behavior:"smooth"});
              showBanner("Year complete! Check your Budget Sheet summary ⬇️");
            }, 250);
          }
        });
      } else {
        // Auto-scroll to budget sheet at end of year
        setTimeout(()=>{
          openTab("sheet", {auto:true});
          const sheetPanel = $("panel-sheet");
          if(sheetPanel) sheetPanel.scrollIntoView({behavior:"smooth"});
          showBanner("Year complete! Check your Budget Sheet summary ⬇️");
        }, 400);
      }
      return;
    }
    const oldM = weekToMonth(currentW);
    const newM  = weekToMonth(currentW + 1);
    const isMonthEnd = newM !== oldM;
    if(isMonthEnd){
      // Apply month-end growth first so the Budget Sheet snapshot shows the updated numbers.
      applyWeeklyBankEffects();
      normalizeHysaMonthEndGrowth();
      checkSavingsMilestones();
      recordMonthSnapshot();
      ensureStandardV1State();
      Object.keys(state.standardV1.pressureTracks || {}).forEach(key=>{
        state.standardV1.pressureTracks[key] = Math.max(0, Number(state.standardV1.pressureTracks[key] || 0) - (key === 'resilience' ? 0 : 1));
      });
      state.day = newM;
      if(state.plan.lockedForYear){
        const gross = state.plan.income;
        const tax = Math.round(gross*(state.plan.taxPct/100));
        const takeHome = gross - tax;
        state.bank.checking += takeHome;
        state.ledger.weekIncome += takeHome;
        const newMonthName = weekToMonthName(currentW+1);
        addLedgerLine(`--- ${newMonthName} started --- Paycheck: +${money(takeHome)} (tax withheld: ${money(tax)})`);
        const contractCharge = applyRecurringContractCharge(newM, newMonthName);
        const eliteObligationResults = applyEliteObligationCharges(newMonthName);
        state.weekEngine.week += 1;
        renderWeekHeader();
        fireDueConsequences(state.weekEngine.week);
        maybeFireMasterDelayedConsequences(state.weekEngine.week);

        // Step 1: Refresh the budget sheet summary of the month we just finished.
        // The Budget Sheet tab will pulse green when the mission asks the student to click it.
        renderSheet();

        // Step 2: Show "Month Complete" summary modal, then paycheck
        const prevMonthName = weekToMonthName(currentW);
        const prevMonthNumber = oldM;
        const snapsForPrevMonth = (state.monthSnapshots || []).filter(x => x && x.month === prevMonthNumber);
        const snap = snapsForPrevMonth.length ? snapsForPrevMonth[snapsForPrevMonth.length - 1] : ((state.monthSnapshots || []).slice(-1)[0] || {});
        const snapChecking = typeof snap.checking === 'number' ? snap.checking : state.bank.checking;
        const snapSavings = typeof snap.savings === 'number' ? snap.savings : state.bank.savings;

        normalizeHysaMonthEndGrowth();
        const hysaSnap = getHysaSnapshot({projectFirstMonth:true});
        applyHysaSnapshot(hysaSnap);
        let snapHysa = typeof snap.hysa === 'number' ? Math.max(snap.hysa, hysaSnap.balance) : hysaSnap.balance;
        let snapHysaGrowthMonth = typeof snap.hysaGrowthMonth === 'number' ? Math.max(snap.hysaGrowthMonth, hysaSnap.growthThisMonth) : hysaSnap.growthThisMonth;
        let snapHysaGrowthTotal = typeof snap.hysaGrowth === 'number' ? Math.max(snap.hysaGrowth, hysaSnap.totalGrowth) : hysaSnap.totalGrowth;
        if(snap && typeof snap === 'object'){
          snap.hysa = snapHysa;
          snap.hysaGrowthMonth = snapHysaGrowthMonth;
          snap.hysaGrowth = snapHysaGrowthTotal;
        }

        const snapCd = typeof snap.cd === 'number' ? snap.cd : totalCdFunds();
        const snapCredit = typeof snap.credit === 'number' ? snap.credit : state.credit;
        const coachingTip = getMonthlyCoachingTip(snap);
        const actionPlan = getMonthlyActionPlan(snap);
        state.standardV1.actionPlans.push(actionPlan);
        const marketSummary = applyEliteMarketCycle(newMonthName);
        const promotionSummary = maybeAdvanceCareer(newMonthName);
        openModal({
          title:`📅 ${prevMonthName} Complete!`,
          meta:`Your budget snapshot is on the Budget Sheet`,
          body:`Here's how ${prevMonthName} ended:\n• Checking: ${money(snapChecking)}\n• Savings: ${money(snapSavings)}\n• HYSA Balance: ${money(snapHysa)}\n• HYSA Growth This Month: +${money(snapHysaGrowthMonth)}\n• HYSA Growth Total: +${money(snapHysaGrowthTotal)}\n• CD Total: ${money(snapCd)}\n• Credit: ${snapCredit}\n• Inventory Value: ${money(calcInventoryValue())}\n\n\nYour ledger and wants are saved to the Budget Sheet.\n\nReady for your ${newMonthName} paycheck of ${money(takeHome)}?${eliteObligationResults && eliteObligationResults.length ? `\n\nElite payments this month: ${eliteObligationResults.join(', ')}` : ''}`,
          buttons:[{id:"ok", label:`Get ${newMonthName} Paycheck 💵`, kind:"primary"}],
          onPick:()=>{
            // Step 3: Paycheck investment prompt
            if(state.ui) state.ui.suppressDecisionReflections = true;
            promptPaycheckInvestmentSimple(takeHome, tax, ()=>{
              const continueToReview = ()=>{
                renderSheet();
                promptMonthlyBudgetSheetReview();
              };
              const continueAfterElite = ()=> isEliteExperience() ? promptEliteCreditOpportunity(continueToReview) : continueToReview();
              if(state.plan.wantsSelections && state.plan.wantsSelections.length > 0){
                triggerMonthlyWantsChoice(()=>{
                  renderSheet();
                  continueAfterElite();
                });
              } else {
                renderSheet();
                continueAfterElite();
              }
            });
          }
        });
        return;
      } else {
        addLedgerLine(`--- ${weekToMonthName(currentW+1)} started ---`);
      }
    } else {
      addLedgerLine(`--- Week ${currentW+1} started ---`);
    }
    state.ledger.weekExpenses = 0;
    state.ledger.weekIncome   = 0;
    state.ledger.weekProfit   = 0;
    state.weekEngine.week += 1;
    renderWeekHeader();
    fireDueConsequences(state.weekEngine.week);
    maybeFireMasterDelayedConsequences(state.weekEngine.week);
    promptWeeklyGoalIfNeeded(()=>{
      runWeeklyScenarios(state.weekEngine.week, ()=>{
        renderAll(); renderSheet(); notifyAction("next_week");
      });
    });
    return;
  }
  // Legacy / pre-mission path
  if(state.day >= 48){ renderAll(); notifyAction("next_week"); return; }
  if(state.plan.lockedForYear){
    applyWeeklyBankEffects(); checkSavingsMilestones();
    recordMonthSnapshot();
    state.day = clamp(state.day + 1, 1, 48);
    state.ledger.weekExpenses = 0; state.ledger.weekIncome = 0; state.ledger.weekProfit = 0;
    addLedgerLine(`--- New week started (Week ${state.day}) ---`);
    applyMonthlyPlanForCurrentMonth();
  } else {
    applyWeeklyBankEffects(); checkSavingsMilestones();
    state.day = clamp(state.day + 1, 1, 48);
    state.ledger.weekExpenses = 0; state.ledger.weekIncome = 0; state.ledger.weekProfit = 0;
    addLedgerLine(`--- New week started (Week ${state.day}) ---`);
    setLog("Choose and lock a year plan before the next week auto-runs.");
  }
  renderAll(); renderSheet(); notifyAction("next_week");
}

function promptMonthlyBudgetSheetReview(onDone){
  state.ui.pendingBudgetSheetReview = true;
  applyLockRules();
  openModal({
    title:"📊 Budget Sheet Check-In",
    meta:"Monthly snapshot",
    body:"Let's take a look at our Budget Sheet to see how we're doing.\n\nTap the button below to jump to the Budget Sheet, then tap the Budget Sheet tab once more after you review it to continue.",
    buttons:[{id:"go", label:"Go View Budget Sheet →", kind:"primary"}],
    onPick:()=>{
      openTab("sheet", {auto:true});
      setTimeout(()=>{
        const sheetPanel = $("panel-sheet");
        if(sheetPanel) sheetPanel.scrollIntoView({behavior:"smooth", block:"start"});
      }, 120);
      showBanner("Review the Budget Sheet, then tap the Budget Sheet tab again to continue");
      if(onDone) onDone();
    }
  });
}

/* Simplified paycheck investment prompt used in nextWeek */
function promptPaycheckInvestmentSimple(takeHome, tax, onDone){
  const hysaAPR = 4;
  const currentWeek = state.weekEngine ? state.weekEngine.week : (state.day * 4);
  const monthsLeft = 12 - weekToMonth(currentWeek) + 1;
  const depositDest = state.bank.paycheckDestination || (state.bank.checkingType ? "checking" : "cash");
  const destLabel = depositDest === "checking" ? (BANK_PRODUCTS.checking.find(x=>x.id===state.bank.checkingType)?.name || "Checking") : "Cash";

  const cdOptions = [];
  if(monthsLeft >= 3) cdOptions.push({id:"cd3", label:"Open 3-Month CD (4.0% APR)", kind:"secondary"});
  if(monthsLeft >= 6) cdOptions.push({id:"cd6", label:"Open 6-Month CD (4.5% APR)", kind:"secondary"});

  const cdNote = cdOptions.length === 0
    ? `\n⛔ No CDs available — less than 3 months left in the year.`
    : `\n• CD options (only terms that mature before year-end shown)`;

  openModal({
    title:"💵 Paycheck Time!",
    meta:`Week ${currentWeek} — ${weekToMonthName(currentWeek)}`,
    body:`${money(takeHome)} deposited to ${destLabel}. Tax withheld: ${money(tax)}.

Your balances:
• Checking: ${money(state.bank.checking)}  • Savings: ${money(state.bank.savings)}  • Cash: ${money(state.cash)}

💡 Invest some now?
• High-Yield Savings: ${hysaAPR}% APR — grows monthly, stays liquid${cdNote}`,
    buttons:[
      {id:"hysa",  label:`Move $25 → High-Yield (${hysaAPR}% APR)`, kind:"success"},
      ...stockButton,
      ...cdOptions,
      {id:"keep",  label:`Keep everything in ${destLabel}`, kind:"secondary"}
    ],
    onPick:(id)=>{
      if(id === "hysa"){
        chooseFundingSource(25, `Move ${money(25)} into High-Yield (${hysaAPR}% APR). Choose where the money comes from:`, (src)=>{
          state.bank.savingsType = "hysa";
          addToHysa(25);
          addLedgerLine(`Paycheck: moved $25 → High-Yield (${hysaAPR}% APR) from ${src}`);
          addCoverage(4);
          showDecisionBadge(`Invested into HYSA from ${formatSourceLabel(src)}: ${money(25)}`);
          showBanner("$25 moved to High-Yield!");
          renderHeader();
          queueDecisionReflection({ type:'save', title:'HYSA Choice', label:'Moved $25 to High-Yield Savings', summary:'You saved money for later growth.', amount:25 });
          if(onDone) onDone();
        });
      } else if(id === "stock"){
        chooseFundingSource(25, `Move ${money(25)} into a stock index fund. Choose where the money comes from:`, (src)=>{
          ensureEliteState();
          state.elite.investments.stocks += 25;
          state.elite.investments.costBasis += 25;
          state.elite.investments.history.push({ month: weekToMonthName(currentWeek), delta: 25, type:'buy' });
          state.credit = clamp(state.credit + 1, 300, 850);
          addLedgerLine(`Paycheck: moved $25 → Stock Index from ${src}`);
          showDecisionBadge(`Risk layer active: stock index +${money(25)}`);
          showBanner('$25 moved into stock index');
          renderHeader();
          queueDecisionReflection({ type:'save', title:'Stock Choice', label:'Moved $25 to Blend ETF', summary:'You chose a risk-and-reward investment.', amount:25 });
          if(onDone) onDone();
        });
      } else if(id === "cd3" || id === "cd6"){
        const termKey = id === "cd3" ? "3m" : "6m";
        const termMonths = id === "cd3" ? 3 : 6;
        const aprLabel = id === "cd3" ? "4.0%" : "4.5%";
        // Ask how much to invest
        openModal({
          title:`Open ${termMonths}-Month CD (${aprLabel} APR)`,
          meta:"Choose amount to invest",
          body:`How much do you want to put into this ${termMonths}-month CD?\n\nMinimum: $25  |  Your checking: ${money(state.bank.checking)}  |  Your cash: ${money(state.cash)}\n\nChoose an amount:`,
          buttons:[
            {id:"25",  label:"$25",  kind:"secondary"},
            {id:"50",  label:"$50",  kind:"secondary"},
            {id:"100", label:"$100", kind:"secondary"},
            {id:"back",label:"← Back", kind:"secondary"}
          ],
          onPick:(amtId)=>{
            if(amtId === "back"){ promptPaycheckInvestmentSimple(takeHome, tax, onDone); return; }
            const deposit = parseInt(amtId);
            chooseFundingSource(deposit, `Open a ${termMonths}-month CD with ${money(deposit)} at ${aprLabel} APR. Choose where the money comes from:`, (src)=>{
              const cd = {
                id:`cd_${Date.now()}`,
                name: BANK_PRODUCTS.cdTerms[termKey].name,
                termMonths,
                monthsLeft: termMonths,
                principal: deposit,
                accrued: 0,
                apr: BANK_PRODUCTS.cdTerms[termKey].apr
              };
              state.bank.cds.push(cd);
              state.bank.savingsType = "cd";
              addLedgerLine(`Paycheck: opened ${cd.name} — ${money(deposit)} at ${aprLabel} APR (from ${src})`);
              addCoverage(4); addCoverage(9);
              showDecisionBadge(`Invested into ${cd.name} from ${formatSourceLabel(src)}: ${money(deposit)}`);
              showBanner(`${cd.name} opened at ${aprLabel}!`);
              renderHeader();
              queueDecisionReflection({ type:'save', title:'CD Choice', label:`Opened ${cd.name}`, summary:`You put ${money(deposit)} into a CD.`, amount:deposit });
              if(onDone) onDone();
            });
          }
        });
      } else {
        addLedgerLine(`Paycheck: kept in ${destLabel}`);
        renderHeader();
        if(onDone) onDone();
      }
    }
  });
}

/* Local tax */
function generateLocalTax(){
  const amount = 15 + Math.floor(Math.random()*46);
  state.localTaxDue += amount;
  addLedgerLine(`Local tax assessed: +${money(amount)} due`);
  renderAll();
  notifyAction("gen_local_tax");
}
function payLocalTax(){
  if(state.localTaxDue<=0){
    beep("warn");
    openModal({title:"No Local Tax Due",meta:"Tip",body:"Tap Generate Local Tax first.",buttons:[{id:"close",label:"Close",kind:"secondary"}]});
    return;
  }
  const due = state.localTaxDue;
  chooseFundingSource(due, `Pay local tax bill of ${money(due)}. Choose which account to use:`, (src)=>{
    state.localTaxDue = 0;
    state.credit = clamp(state.credit + 6, 300, 850);
    showBanner("Local tax paid! Credit +6");
    setLog(`Paid local tax: ${money(due)} from ${src}. Credit +6.`);
    addLedgerLine(`Local tax paid: -${money(due)} from ${src}`);
    renderHeader();
    notifyAction("pay_local_tax");
  });
}

function openInvestmentChoiceModal(amount, label, onDone){
  const currentMonth = state.weekEngine ? weekToMonth(state.weekEngine.week) : state.day;
  const monthsRemaining = 12 - currentMonth + 1;

  const buttons = [
    {id:"hysa", label:`HYSA (4% APR) • ${money(amount)}`, kind:"success"}
  ];
  if(isEliteExperience()){
    buttons.push({id:"stockSafe", label:`Shield Fund (lower risk) • ${money(amount)}`, kind:"warn"});
    buttons.push({id:"stockBlend", label:`Blend ETF (medium risk) • ${money(amount)}`, kind:"warn"});
    buttons.push({id:"stockGrowth", label:`Rocket Growth (high risk) • ${money(amount)}`, kind:"warn"});
  }
  if(monthsRemaining >= 3) buttons.push({id:"cd3", label:`3-Month CD (4.0%) • ${money(amount)}`, kind:"primary"});
  if(monthsRemaining >= 6) buttons.push({id:"cd6", label:`6-Month CD (4.5%) • ${money(amount)}`, kind:"primary"});
  buttons.push({id:"cancel", label:"Cancel", kind:"secondary"});

  openModal({
    title:`📈 Invest ${label}`,
    meta:"Choose where to invest it",
    body:`Amount: ${money(amount)}\nMonths left in year: ${monthsRemaining}\n\nPick HYSA for flexible monthly growth, or choose a CD that can mature before year-end.`,
    buttons,
    onPick:(id)=>{
      if(id==="cancel") return;

      if(id==="hysa"){
        state.bank.savingsType = "hysa";
        addToHysa(amount, `${label} invested`);
        state.credit = clamp(state.credit + 4, 300, 850);
        renderHeader();
        renderSheet();
        renderCDStatus();
        showDecisionBadge(`Invested into HYSA: ${money(amount)}`);
        if(onDone) onDone(`Invested ${money(amount)} into HYSA`);
        return;
      }
      if(id==="stockSafe" || id==="stockBlend" || id==="stockGrowth"){
        ensureEliteState();
        const map = { stockSafe:'conservative', stockBlend:'balanced', stockGrowth:'aggressive' };
        const names = { conservative:'Shield Fund', balanced:'Blend ETF', aggressive:'Rocket Growth' };
        const key = map[id];
        state.elite.investments.portfolios[key] = Number(state.elite.investments.portfolios[key] || 0) + amount;
        state.elite.investments.stocks = totalStockFunds();
        state.elite.investments.costBasis += amount;
        state.elite.investments.history.push({ month: weekToMonthName(state.weekEngine ? state.weekEngine.week : 1), delta: amount, type:'buy', lane:key });
        state.credit = clamp(state.credit + (key==='aggressive' ? 1 : key==='balanced' ? 2 : 3), 300, 850);
        addLedgerLine(`${label} invested: ${money(amount)} into ${names[key]}`);
        renderHeader();
        renderSheet();
        renderCDStatus();
        if(onDone) onDone(`Invested ${money(amount)} into ${names[key]}`);
        return;
      }

      const term = id==="cd6" ? "6m" : "3m";
      const ok = createCD(term, amount, false, "bonus");
      if(ok){
        state.credit = clamp(state.credit + 4, 300, 850);
        addLedgerLine(`${label} invested: ${money(amount)} into ${term==="6m" ? "6-Month CD" : "3-Month CD"}`);
        renderHeader();
        renderSheet();
        renderCDStatus();
        if(onDone) onDone(`Invested ${money(amount)} into ${term==="6m" ? "6-Month CD" : "3-Month CD"}`);
      } else {
        beep("warn");
        showBanner("That CD won't mature before year-end");
      }
    }
  });
}


/* Inheritance + Dispute */
function triggerInheritance(){
  openModal({
    title:"🧾 Inheritance Event",
    meta: getModeConfig().showBenchmarksInMeta ? `Benchmark #5: ${BENCH[5]} • Benchmark #3: ${BENCH[3]}` : "Benchmark #5 • Benchmark #3",
    body:"You receive $200. Choose what to do:",
    buttons:[{id:"save",label:"Save it",kind:"success"},{id:"spend",label:"Spend it",kind:"warn"},{id:"invest",label:"Invest it",kind:"primary"}],
    onPick:(id)=>{
      if(id==="save"){
        state.bank.savings += 200;
        state.credit = clamp(state.credit+3,300,850);
        addLedgerLine("Inheritance saved: +$200 to savings");
        renderHeader();
        renderSheet();
        notifyAction("inheritance");
        return;
      }
      if(id==="spend"){
        state.cash = clamp(state.cash + 120, 0, 999999);
        state.plan.wants += 20;
        state.credit = clamp(state.credit-2,300,850);
        addLedgerLine("Inheritance spent: +$200 received, $80 used for wants");
        renderHeader();
        renderSheet();
        notifyAction("inheritance");
        return;
      }
      openInvestmentChoiceModal(200, "Inheritance", (summary)=>{
        addLedgerLine(summary);
        showBanner(summary);
        notifyAction("inheritance");
      });
    }
  });
}
function startDispute(){
  openModal({
    title:"📞 Billing Dispute",
    meta: getModeConfig().showBenchmarksInMeta ? `Benchmark #11: ${BENCH[11]} • Benchmark #13: ${BENCH[13]}` : "Benchmark #11 • Benchmark #13",
    body:"Mystery charge: $35. What do you do?",
    buttons:[
      {id:"dispute",label:"Dispute",kind:"success"},
      {id:"ignore",label:"Ignore",kind:"danger"}
    ],
    onPick:(id)=>{
      if(id==="dispute"){ state.credit=clamp(state.credit+5,300,850); addLedgerLine("Dispute filed. Credit +5"); }
      else { state.credit=clamp(state.credit-10,300,850); addLedgerLine("Ignored dispute. Credit -10"); }
      renderHeader();
      notifyAction("dispute");
    }
  });
}




function getBudgetedWantEntry(deckItem){
  if(!state.plan.wantsInventoryActive) return null;
  return state.plan.wantsInventoryActive.find(x => x.label.toLowerCase().includes(deckItem.keyword.toLowerCase()) && x.available) || null;
}

function buildWantAwareSocialScenario(deckItem){
  const budgeted = getBudgetedWantEntry(deckItem);
  const alreadyText = budgeted
    ? `You already budgeted for ${deckItem.short} this month, so this can come out of your wants plan instead of checking or cash.`
    : `${deckItem.short[0].toUpperCase() + deckItem.short.slice(1)} is not in your wants plan this month, so going will cost extra money.`;

  return {
    id:"manual_social_" + Date.now(),
    week: state.weekEngine ? state.weekEngine.week : 1,
    title: ()=> deckItem.title,
    body: ()=> `${deckItem.body}\n\n${alreadyText}`,
    options: ()=> {
      if(budgeted){
        return [
          {
            label:"Go for it — already budgeted",
            hint:"Use Wants budget • no extra charge",
            apply:(st)=>{
              useWantFromInventory(deckItem.keyword);
              return `${deckItem.short[0].toUpperCase() + deckItem.short.slice(1)} was already budgeted, so no extra money was spent.`;
            }
          },
          {
            label:"Skip it and save the slot for later",
            hint:"Keep this want available",
            apply:(st)=>`You kept your ${deckItem.short} slot for later.`
          }
        ];
      }
      return [
        {
          label:"Go and pay from checking",
          hint:`-$${deckItem.cost} checking`,
          apply:(st)=>{
            st.bank.checking = Math.max(0, st.bank.checking - deckItem.cost);
            st.ledger.weekExpenses += deckItem.cost;
            markUnplannedWantUsed(deckItem.title.replace(/^🎉\s*/, ""));
            return `You went, but it was not budgeted. -$${deckItem.cost} from checking.`;
          }
        },
        {
          label:"Go and pay from cash",
          hint:`-$${deckItem.cost} cash`,
          apply:(st)=>{
            st.cash = Math.max(0, st.cash - deckItem.cost);
            st.ledger.weekExpenses += deckItem.cost;
            markUnplannedWantUsed(deckItem.title.replace(/^🎉\s*/, ""));
            return `You went, but it was not budgeted. -$${deckItem.cost} from cash.`;
          }
        },
        {
          label:"Skip it and stay on budget",
          hint:"No extra cost",
          apply:(st)=>{
            const bonus = Math.max(1, Math.round(deckItem.cost * 0.2));
            st.bank.savings += bonus;
            return `You skipped it and protected your budget. Savings +$${bonus}.`;
          }
        }
      ];
    }
  };
}

function runSchoolDecision(){
  const schoolDeck = [
    {
      id:"school_homework",
      week: state.weekEngine ? state.weekEngine.week : 1,
      title: ()=> "📚 School Decision: Forgot Homework",
      body: ()=> "You forgot your homework at home. What do you do?",
      options: ()=> [
        { label:"Tell the truth", hint:"Honest choice", apply:(st)=>{ st.credit=Math.min(850,st.credit+2); return "Honesty helped. Credit +2"; } },
        { label:"Make an excuse", hint:"Risky choice", apply:(st)=>{ st.credit=Math.max(300,st.credit-3); return "Teacher was not impressed. Credit -3"; } },
        { label:"Take the zero", hint:"No argument, but grade drops", apply:(st)=>"You took the zero and learned the hard way." }
      ]
    },
    {
      id:"school_test",
      week: state.weekEngine ? state.weekEngine.week : 1,
      title: ()=> "📝 School Decision: Test Tomorrow",
      body: ()=> "You have a big test tomorrow night. What do you do after work?",
      options: ()=> [
        { label:"Study tonight", hint:"Better chance of success", apply:(st)=>{ st.credit=Math.min(850,st.credit+4); return "Prepared and confident. Credit +4"; } },
        { label:"Quick review only", hint:"Balanced choice", apply:(st)=>"Moderate preparation, moderate result." },
        { label:"Skip studying", hint:"Relax now, stress later", apply:(st)=>{ st.credit=Math.max(300,st.credit-5); return "That choice comes back later. Credit -5"; } }
      ]
    },
    {
      id:"school_project",
      week: state.weekEngine ? state.weekEngine.week : 1,
      title: ()=> "👥 School Decision: Group Project",
      body: ()=> "Your group project teammates are not doing much. What do you do?",
      options: ()=> [
        { label:"Do extra work yourself", hint:"Protect the grade", apply:(st)=>{ st.credit=Math.min(850,st.credit+3); return "Project saved. Credit +3"; } },
        { label:"Push the team to help", hint:"Shared responsibility", apply:(st)=>"Teamwork improved." },
        { label:"Ignore it", hint:"Risk a weak project", apply:(st)=>{ st.credit=Math.max(300,st.credit-4); return "Project suffered. Credit -4"; } }
      ]
    }
  ];
  const scenario = schoolDeck[Math.floor(Math.random()*schoolDeck.length)];
  openScenarioModal(scenario, ()=> notifyAction("job_event"));
}

function runSocialDecision(){
  const deckItem = SOCIAL_WANTS_DECK[Math.floor(Math.random()*SOCIAL_WANTS_DECK.length)];
  const scenario = buildWantAwareSocialScenario(deckItem);
  openScenarioModal(scenario, ()=> notifyAction("job_event"));
}

function pickWeightedRandomEventType(){
  if(!state.randomRun) state.randomRun = {};
  const last = state.randomRun.lastEventType || null;
  const prev = state.randomRun.prevEventType || null;

  const weights = getDynamicRandomEventWeights();
  let pool = [
    {type:"life", weight:Number(weights.life || 40)},
    {type:"job", weight:Number(weights.job || 30)},
    {type:"financial", weight:Number(weights.financial || 30)}
  ];

  if(last && prev && last === prev){
    pool = pool.filter(item => item.type !== last);
  }

  const total = pool.reduce((sum,item)=>sum + item.weight, 0);
  let roll = Math.random() * total;
  let pick = pool[0].type;

  for(const item of pool){
    if(roll < item.weight){
      pick = item.type;
      break;
    }
    roll -= item.weight;
  }

  state.randomRun.prevEventType = last;
  state.randomRun.lastEventType = pick;
  return pick;
}

function getRandomEventPresentation(type){
  if(type === 'job') return { label:'💼 Job Event', buttonId:'btnJobEvent', detail:'work and reputation choices' };
  if(type === 'financial') return { label:'⚠️ Financial Decision', buttonId:'btnSocialEvent', detail:'money pressure and protection choices' };
  return { label:'👥 Social / Life Scenario', buttonId:'btnSchoolEvent', detail:'people, school, and daily pressure choices' };
}

function runRandomEvent(){
  if(!state.ui) state.ui = {};
  if(state.ui.randomEventCycling) return;

  showBanner('🎲 Rolling your week...');
  const finalType = pickWeightedRandomEventType();
  const ids = ["btnSchoolEvent","btnJobEvent","btnSocialEvent"];
  let step = 0;
  const totalSteps = 10 + Math.floor(Math.random()*4);

  clearRandomEventPending();
  state.ui.randomEventCycling = true;
  applyLockRules();

  function pulseStep(){
    ids.forEach(id=>{
      const el = $(id);
      if(el) el.classList.remove("glow-next");
    });

    const activeId = ids[step % ids.length];
    const activeEl = $(activeId);
    if(activeEl) activeEl.classList.add("glow-next");

    step += 1;
    if(step < totalSteps){
      setTimeout(pulseStep, 120);
      return;
    }

    ids.forEach(id=>{
      const el = $(id);
      if(el) el.classList.remove("glow-next");
    });

    state.ui.randomEventCycling = false;
    state.ui.randomEventPendingType = finalType;
    applyLockRules();

    const meta = getRandomEventPresentation(finalType);
    const goal = getCurrentWeeklyGoal();
    const goalLine = goal ? ` • Focus: ${goal.name}` : "";
    showBanner(`🎲 Random pick: ${meta.label}${goalLine}. Tap the glowing button.`);
    scrollToBtn(getRandomEventButtonId(finalType));
  }

  pulseStep();
}



function pickRandomContractId(excludeId=null){
  const pool = CONTRACTS.filter(c => c.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function getContractById(id){
  return CONTRACTS.find(c => c.id === id) || CONTRACTS[0];
}

function ensureContractLedger(){
  if(!state.contractLedger) state.contractLedger = {};
  if(!state.contractLedger.chargedMonths) state.contractLedger.chargedMonths = {};
}

function applyRecurringContractCharge(monthNumber, monthName){
  ensureContractLedger();
  if(!state.contractActive || !state.contractId) return 0;
  const c = getContractById(state.contractId);
  if(!c) return 0;
  const key = `${c.id}:${Number(monthNumber || 0)}`;
  if(state.contractLedger.chargedMonths[key]) return 0;
  state.contractLedger.chargedMonths[key] = true;
  payFromCheckingThenCashThenSavings(c.monthly);
  state.ledger.weekExpenses += c.monthly;
  addLedgerLine(`${monthName}: Contract auto-payment -${money(c.monthly)} for ${c.name}`);
  return c.monthly;
}

function getMonthlyCoachingTip(snapshot){
  const snap = snapshot || {};
  const title = String(snap.identityTitle || '');
  const pressure = getPressureTrackSummary();
  if(title === 'Saver Identity') return 'Coach Tip: Keep the streak alive. Protect your wants plan and feed savings first next month.';
  if(title === 'Debt Risk Trend') return pressure.key === 'bills'
    ? 'Coach Tip: Bills are your pressure point right now. Review recurring charges and keep extra cash in checking before month start.'
    : 'Coach Tip: Next month, trim one want and review every recurring bill before it hits.';
  if(title === 'Pressure Week') return pressure.key === 'impulse'
    ? 'Coach Tip: Impulse pressure is building. Pre-plan one treat and say no to the rest next month.'
    : pressure.key === 'basics'
      ? 'Coach Tip: Protect your basics next month. Meals, supplies, and sleep save money later.'
      : 'Coach Tip: You have echoes stacked up. Keep extra cash in checking so old choices do not snowball.';
  if(title === 'Strong Builder') return 'Coach Tip: You are stable. Try turning one strong month into a two-month streak.';
  return 'Coach Tip: Stay balanced next month by checking your bills, wants, and savings before spending.';
}

/* Contracts */
function populateContracts(){
  const sel = $("contractPick");
  sel.innerHTML="";
  getAvailableContracts().forEach(c=>{
    const opt=document.createElement("option");
    opt.value=c.id;
    opt.textContent = `${c.name} ($${c.monthly}/mo)`;
    sel.appendChild(opt);
  });
  if(!state.randomRun) state.randomRun = {};
  if(!state.randomRun.contractOfferId) state.randomRun.contractOfferId = pickRandomContractId();
  sel.value = state.randomRun.contractOfferId;
}
function reviewSelectedContract(){
  const id = $("contractPick").value;
  state.contractId = id;
  const c = getAvailableContracts().find(x=>x.id===id);
  if(!c) return;

  const meta = state.teacherMode
    ? c.bucket.map(b=>`Benchmark #${b}: ${BENCH[b]}`).join(" • ")
    : c.bucket.map(b=>`Benchmark #${b}`).join(" • ");

  openModal({
    title:`📄 Contract: ${c.name}`,
    meta,
    body:
`Monthly cost: ${money(c.monthly)}
Auto-renew: ${c.autoRenew ? "Yes" : "No"}
Cancellation fee: ${money(c.cancelFee)}

Disclosure:
${c.disclosure}

Accept this contract?`,
    buttons:[
      {id:"accept",label:"Accept",kind:"primary"},
      {id:"decline",label:"Decline",kind:"secondary"}
    ],
    onPick:(pick)=>{
      if(pick==="accept"){
        state.contractActive=true;
        ensureContractLedger();
        state.bank.checking -= c.monthly;
        addLedgerLine(`Contract accepted: ${c.name} (-${money(c.monthly)})`);
        state.credit=clamp(state.credit+1,300,850);
      }else{
        state.contractActive=false;
        addLedgerLine(`Contract declined: ${c.name}`);
      }
      renderHeader();
      notifyAction("review_contract");
    }
  });
}
function cancelContract(){
  if(!state.contractActive){
    beep("warn");
    setLog("No active contract.");
    return;
  }
  const id = state.contractId || $("contractPick").value;
  const contracts = getAvailableContracts();
  const c = contracts.find(x=>x.id===id) || contracts[0];

  openModal({
    title:"Cancel Contract?",
    meta:"Avoid auto-renew",
    body:`Cancel fee: ${money(c.cancelFee)}.`,
    buttons:[
      {id:"yes",label:`Cancel (${money(c.cancelFee)})`,kind:"danger"},
      {id:"no",label:"Keep",kind:"secondary"}
    ],
    onPick:(id2)=>{
      if(id2==="yes"){
        state.contractActive=false;
        payFromCheckingThenCashThenSavings(c.cancelFee);
        addLedgerLine(`Contract cancelled: -${money(c.cancelFee)}`);
        state.credit=clamp(state.credit+2,300,850);
        renderHeader();
      }
    }
  });
}

/* Banking: checks */
function writeCheck(){
  const amt = 15 + Math.floor(Math.random()*56);
  state.checkAmount = amt;
  openModal({
    title:"🧾 Bill Due",
    meta:"Write a check to cover the bill",
    body:`A bill is due for ${money(amt)}.\n\nWrite a check from checking to cover it.`,
    buttons:[
      {id:"pay",label:`Write Check for ${money(amt)}`,kind:"primary"},
      {id:"cancel",label:"Cancel",kind:"secondary"}
    ],
    onPick:(pick)=>{
      if(pick!=="pay") return;

      if(state.bank.checking >= amt){
        state.bank.checking -= amt;
        addLedgerLine(`Bill paid by check: -${money(amt)} from checking`);
        renderHeader();
        renderSheet();
        notifyAction("write_check");
        return;
      }

      const shortfall = amt - state.bank.checking;
      openModal({
        title:"Not Enough in Checking",
        meta:"Pull money into checking first",
        body:`Checking is short by ${money(shortfall)}.\n\nChoose where you want to pull the money from before writing the check.`,
        buttons:[
          {id:"cash",label:`Pull ${money(shortfall)} from Cash`,kind:"secondary"},
          {id:"savings",label:`Pull ${money(shortfall)} from Savings`,kind:"secondary"},
          {id:"cd",label:`Pull ${money(shortfall)} from CD`,kind:"warn"},
          {id:"cancel",label:"Cancel",kind:"secondary"}
        ],
        onPick:(srcChoice)=>{
          if(srcChoice==="cancel") return;

          if(srcChoice==="cd"){
            chooseFundingSource(shortfall, `Move ${money(shortfall)} into checking to cover the bill.`, (paidSrc)=>{
              state.bank.checking += shortfall;
              state.bank.checking -= amt;
              addLedgerLine(`Moved ${money(shortfall)} from ${paidSrc} to checking, then wrote check for ${money(amt)}`);
              renderHeader();
              renderSheet();
              notifyAction("write_check");
            });
            return;
          }

          const result = spendFromSource(srcChoice, shortfall);
          if(!result.ok){
            beep("warn");
            showBanner(result.message || "Not enough funds");
            return;
          }

          state.bank.checking += shortfall;
          state.bank.checking -= amt;
          addLedgerLine(`Moved ${money(shortfall)} from ${srcChoice} to checking, then wrote check for ${money(amt)}`);
          renderHeader();
          renderSheet();
          notifyAction("write_check");
        }
      });
    }
  });
}
function depositCheck(){
  const amt = 10 + Math.floor(Math.random()*66);
  state.checkAmount = amt;
  openModal({
    title:"💸 Refund Check",
    meta:"Choose where to deposit the refund",
    body:`You got a refund check for ${money(amt)}.\n\nWhere do you want to deposit it?`,
    buttons:[
      {id:"checking",label:"Deposit to Checking",kind:"primary"},
      {id:"savings",label:"Deposit to Savings",kind:"secondary"},
      {id:"hysa",label:"Deposit to HYSA",kind:"success"},
      {id:"cancel",label:"Cancel",kind:"secondary"}
    ],
    onPick:(dest)=>{
      if(dest==="cancel") return;

      if(dest==="checking"){
        state.bank.checking += amt;
        addLedgerLine(`Refund deposited: +${money(amt)} to checking`);
      }else if(dest==="savings"){
        state.bank.savings += amt;
        addLedgerLine(`Refund deposited: +${money(amt)} to savings`);
      }else if(dest==="hysa"){
        state.bank.savingsType = "hysa";
        addToHysa(amt, "Refund deposited");
      }

      renderHeader();
      renderSheet();
      notifyAction("deposit_check");
    }
  });
}

/* Wants dropdown add-on */
function addWantExtra(){
  const selected = getSelectedWantInputs();
  const total = selected.reduce((sum,o)=>sum + Number(o.value||0), 0);
  const target = getWantsTargetAmount();
  if(total < target){
    beep("warn");
    showBanner(`Choose wants totaling at least ${money(target)}`);
    updateWantsUI();
    return;
  }
  state.plan.wantsSelections = selected.map(o=>({label:o.dataset.label || o.parentElement?.innerText?.trim() || `Want ${o.value}`, value:Number(o.value||0)}));
  state.plan.wants = total;
  state.plan.wantsExtras = 0;
  state.plan.wantsCommitted = true;
  // Reload inventory with new selections
  state.plan.unplannedWantUsedThisMonth = false;
  state.plan.wantsInventoryActive = state.plan.wantsSelections.map(w=>({label:w.label, value:w.value, available:true}));
  renderHeader();
  renderSheet();
  updateWantsUI();
  addLedgerLine(`Wants locked: ${money(total)} — ${state.plan.wantsSelections.map(w=>w.label).join(', ')}`);
  showBanner("Wants committed! ✓");

  // If there's a pending monthly refresh callback, fire it now
  if(state._wantsRefreshCallback){
    const cb = state._wantsRefreshCallback;
    state._wantsRefreshCallback = null;
    setTimeout(cb, 200);
  }
}
function clearWantsExtras(){
  state.plan.wantsSelections = [];
  state.plan.wants = 0;
  state.plan.wantsExtras = 0;
  state.plan.wantsCommitted = false;
  if($("wantsPick")) $("wantsPick").querySelectorAll('input[type="checkbox"]').forEach(o=> o.checked = false);
  syncWantsChecklistStyles();
  renderHeader();
  renderSheet();
  updateWantsUI();
  addLedgerLine("Wants plan cleared.");
}

/* Real-life events */
function runJobRealLifeEvent(){
  const job = state.jobs[state.jobIndex];
  const month = currentWeekIndex();

  function useInventoryOrPay(itemId, fallbackCost, itemName, onDone){
    if(invQty(itemId)>0){
      setInvQty(itemId, invQty(itemId)-1);
      const invVal = calcInventoryValue();
      addLedgerLine(`Used inventory: ${itemName} (free) | Inv. value: ${money(invVal)}`);
      renderHeader();
      renderLedger();
      onDone && onDone(true);
      recalcProfit();
      notifyAction("job_event");
      return;
    }
    // Rush buy — pay and add to inventory (then immediately used)
    chooseFundingSource(fallbackCost, `No ${itemName} in inventory.\nRush price: ${money(fallbackCost)}. Choose where to pay from:`, (src)=>{
      setInvQty(itemId, invQty(itemId)+1);  // add it
      setInvQty(itemId, invQty(itemId)-1);  // immediately use it
      state.ledger.weekExpenses += fallbackCost;
      const invVal = calcInventoryValue();
      addLedgerLine(`Rush buy & used: ${itemName} -${money(fallbackCost)} from ${src} | Inv. value: ${money(invVal)}`);
      renderHeader();
      renderLedger();
      onDone && onDone(false);
      recalcProfit();
      notifyAction("job_event");
    });
  }

  const catalogPack = ((LEDGER_CATALOG[job.id] || LEDGER_CATALOG.lawn || [])
    .filter(item => item && item.type === 'inventory')
    .map(item => [item.name, item.id, item.cost]));
  const fallbackPacks={
    babysitting:[['Snacks Pack','snacks',10],['Craft Kit','craft',12]],
    pet:[['Pet Food','petfood',12],['Treats','treats',8]],
    dogwalk:[['Rain Poncho','poncho',8],['Waste Bags','bags',7]],
    lawn:[['Gas Can','gas',12],['Gloves','gloves',9],['Yard Bags','bags',8]],
    cars:[['Car Soap','soap',11],['Wax','wax',13],['Microfiber Towels','towels',9]],
    tutor:[['Flash Cards','cards',9],['Markers','markers',7]],
    chores:[['Cleaning Spray','spray',7],['Sponges','sponges',6]],
    errands:[['Bus Pass (1 ride)','fare',6],['Reusable Bag','bag',5]],
    crafts:[['Craft Materials','materials',14],['Stickers Pack','stickers',8]]
  };
  const pack = catalogPack.length ? catalogPack : (fallbackPacks[job.id] || fallbackPacks.lawn);
  if(!state.ui.lastRealLifeItemByJob) state.ui.lastRealLifeItemByJob = {};
  if(!state.ui.recentRealLifeItemsByJob) state.ui.recentRealLifeItemsByJob = {};
  const recent = Array.isArray(state.ui.recentRealLifeItemsByJob[job.id]) ? state.ui.recentRealLifeItemsByJob[job.id] : [];
  let idx = Math.floor(Math.random() * pack.length);
  if(pack.length > 1){
    let guard = 0;
    while((pack[idx][1] === state.ui.lastRealLifeItemByJob[job.id] || recent.includes(pack[idx][1])) && guard < 16){
      idx = Math.floor(Math.random() * pack.length);
      guard += 1;
    }
  }
  const pair = pack[idx];
  state.ui.lastRealLifeItemByJob[job.id] = pair[1];
  if(!Array.isArray(state.ui.recentRealLifeItemsByJob[job.id])) state.ui.recentRealLifeItemsByJob[job.id] = [];
  state.ui.recentRealLifeItemsByJob[job.id].push(pair[1]);
  state.ui.recentRealLifeItemsByJob[job.id] = state.ui.recentRealLifeItemsByJob[job.id].slice(-3);
  const itemName=pair[0], itemId=pair[1], rushCost=pair[2];
  const haveIt = invQty(itemId) > 0;
  const bonus = month>=3;

  if(!bonus){
    // Split-panel: left = decision, right = inventory
    const leftHTML = `
      <div style="margin-bottom:10px;padding:10px;background:var(--card-bg,#f8f9fa);border-radius:8px">
        <div style="font-weight:bold;margin-bottom:4px">${itemName}</div>
        <div style="color:${haveIt?'var(--success)':'var(--danger)'}">
          ${haveIt ? `✅ You have ${invQty(itemId)} in inventory — use it FREE` : `❌ None in inventory — rush cost ${money(rushCost)}`}
        </div>
      </div>
      <div style="font-size:13px">
        <strong>Option A:</strong> Use ${itemName} from inventory (free if you have it, rush price if not)<br><br>
        <strong>Option B:</strong> Buy it as a rush purchase for ${money(rushCost)} and add to inventory
      </div>`;

    openSplitShopModal({
      title:`${job.name}: Supply Decision`,
      leftTitle:"This Week's Decision",
      leftHTML,
      rightTitle:"Your Inventory",
      rightHTML: buildInventoryPanel(),
      buttons:[
        { label:`Option A — Use ${itemName}${haveIt?' (FREE)':' (rush '+money(rushCost)+')'}`,
          kind: haveIt ? "success" : "warn",
          onClick:()=>{
            useInventoryOrPay(itemId, rushCost, itemName, hadInv=>{
              if(hadInv){ state.plan.needs += 1; }
              else { state.plan.wants = Math.max(0,state.plan.wants-1); }
            });
          }
        },
        { label:`Option B — Rush Buy & Stock ${itemName} (${money(rushCost)})`,
          kind:"secondary",
          onClick:()=>{
            chooseFundingSource(rushCost, `Rush buy ${itemName} for ${job.name}.\nAdds to inventory.`, (src)=>{
              setInvQty(itemId, invQty(itemId)+1);
              state.ledger.weekExpenses += rushCost;
              state.plan.needs += 1;
              const invVal = calcInventoryValue();
              addLedgerLine(`Rush stocked: ${itemName} -${money(rushCost)} from ${src} | Inv. value: ${money(invVal)}`);
              recalcProfit();
              renderHeader();
              renderLedger();
              notifyAction('job_event');
            });
          }
        }
      ]
    });
    return;
  }

  // Month 3+ money choice — still show inventory panel
  const leftHTML2 = `
    <div style="font-size:13px">
      <strong>Option A — Reinvest:</strong> Put money back into the job. Builds savings discipline (+$12 income, +$4 savings).<br><br>
      <strong>Option B — Take it easy:</strong> Coast this week. Gets some income but leans toward wants (+$6, wants +$4).
    </div>`;

  openSplitShopModal({
    title:`${job.name}: Money Choice`,
    leftTitle:"This Week's Decision",
    leftHTML: leftHTML2,
    rightTitle:"Your Inventory",
    rightHTML: buildInventoryPanel(),
    buttons:[
      { label:"Option A — Reinvest (+$12)", kind:"success",
        onClick:()=>{
          state.bank.checking += 12; state.ledger.weekIncome += 12;
          state.plan.save += 4; state.plan.needs += 1;
          addLedgerLine(`${job.name} bonus earned: +$12 and stronger saving habit.`);
          renderAll(); notifyAction('job_event');
        }
      },
      { label:"Option B — Take It Easy (+$6)", kind:"secondary",
        onClick:()=>{
          state.bank.checking += 6; state.ledger.weekIncome += 6;
          state.plan.wants += 4;
          addLedgerLine(`${job.name} money choice leaned toward wants.`);
          renderAll(); notifyAction('job_event');
        }
      }
    ]
  });
}

/* Compare / Goals / Help */
function compareBanks(){
  openModal({
    title:"🏦 Compare Banks",
    meta: getModeConfig().showBenchmarksInMeta ? `Benchmark #1: ${BENCH[1]} • Benchmark #3: ${BENCH[3]}` : "Benchmark #1 • Benchmark #3",
    body:
`Student Checking: no monthly checking fee. If you spend more than you have, overdraft fee = $20.
Standard Checking: $5/mo fee taken from savings. If you spend more than you have, overdraft fee = $10.
Rewards Checking: $10/mo fee taken from savings. If you spend more than you have, overdraft fee is waived. Any reward bonus in the game goes straight into savings.

Insurance:
None: $0/mo
Basic: $8/mo
Strong: $15/mo

Savings:
Regular Savings: 0.5% growth each month and credit stays stable.
High-Yield: 4% growth each month once funded.
CD Builder: 3-Month 4.0%, 6-Month 4.5%, 1-Year 5.0% monthly classroom growth examples.
CDs are great for steady saving, but the money is locked until maturity. Taking it out early triggers a penalty and a credit hit.`,
    buttons:[{id:"close",label:"Close",kind:"secondary"}]
  });
  addCoverage(1); addCoverage(3);
}
function goalsModal(){
  openModal({
    title:"🎯 Goals",
    meta:"Month goals",
    body:
`Goal 1: Avoid overdraft
Goal 2: Meet Savings Challenge goal
Goal 3: Manage wants and stay on plan
Goal 4: Improve credit`,
    buttons:[{id:"close",label:"Close",kind:"secondary"}]
  });
}
function howToPlayModal(){
  openModal({
    title:"How to Play",
    meta:"Year Mission flow",
    body:
`1) Choose and lock a year plan first.
2) Then choose a Student Job.
3) Build your wants to the target for that plan.
4) Tap "Start Year Mission".
5) Once the year starts, the chosen job locks in until reset.
6) Use your $200 cash to fund checking and savings.
7) Follow the glowing steps in order.
8) Use Savings Challenge, high-yield, transfers, and CDs to grow money and watch credit trends.
9) Generate your report at the end of the year.`,
    buttons:[{id:"close",label:"Close",kind:"secondary"}],
    onPick:()=>{ guidePreStart(); }
  });
}
/* ── Section definition tooltips ── */
function showSectionDef(section){
  const defs = {
    income: {
      title:"💰 Monthly Salary",
      body:`Your Monthly Salary is how much money you earn from your job each month before any deductions.

For students, this is based on your part-time job pay multiplied by 4 weeks.

Key facts:
• This is your GROSS income — before taxes
• The more you earn, the more you can save and spend
• In the 70-20-10 Rule (Beginner): 70% needs, 20% savings/debt, 10% wants
• In the 60-20-20 Rule (Balanced): 60% needs, 20% wants, 20% savings/debt
• In the 50-30-20 Rule (Lifestyle): 50% needs, 30% wants, 20% savings/debt
• In the 50-40-10 Rule (Future Builder): 50% needs, 10% wants, 40% savings/debt

Your actual take-home (after tax) is used to fill your checking account each month.`
    },
    tax: {
      title:"🏛️ Payroll Tax Withholding",
      body:`Payroll tax is money your employer takes OUT of your paycheck before you receive it.

This money goes to the government to fund:
• Social Security (retirement benefits)
• Medicare (health coverage for seniors)
• Federal and state income tax

In this game, tax is shown as a percentage (10%, 15%, 20%). Higher tax = less take-home pay.

Example: If you earn $320/month and tax is 10%, you take home $288.

This is automatic — you don't choose when it happens. It's already gone before you see your paycheck!`
    },
    needs: {
      title:"🛒 Needs",
      body:`Needs are expenses you MUST pay to live and function. These are not optional.

Examples of needs:
• Food and groceries
• Basic phone plan
• School supplies
• Transportation to work
• Hygiene products
• Housing/rent share

In the 70-20-10 Rule (Beginner), 70% of take-home pay goes to needs.
In the 60-20-20 Rule (Balanced), 60% goes to needs.
In the 50-30-20 Rule (Lifestyle), 50% goes to needs.
In the 50-40-10 Rule (Future Builder), 50% goes to needs.

The difference between needs and wants: a basic phone is a need, the latest iPhone is a want. Food is a need, eating out every day is a want.`
    },
    wants: {
      title:"🎮 Wants",
      body:`Wants are things you ENJOY but could live without. These are lifestyle choices.

Examples of wants:
• Pizza nights with friends
• Movie tickets
• Video games
• New shoes/clothes beyond basics
• Streaming services
• Arcade visits
• Concerts

In the 70-20-10 Rule (Beginner), 10% of take-home goes to wants.
In the 60-20-20 Rule (Balanced), 20% goes to wants.
In the 50-30-20 Rule (Lifestyle), 30% goes to wants.
In the 50-40-10 Rule (Future Builder), 10% goes to wants.

Wants make life fun! But they're the first thing to cut when money is tight. The wants you pick here show up in your budget each month — and real-life events will ask you to make choices based on what you have.`
    },
    savings: {
      title:"🏦 Savings + Debt",
      body:`This benchmark covers two important goals: building savings AND paying off debt.

SAVINGS: Money you set aside for future goals, emergencies, or investing.
• Regular Savings: 0.5% growth/month
• High-Yield (HYSA): 4% growth/month once funded
• CDs: 4.0% - 5.0% locked growth

DEBT PAYMENT: Money used to pay down what you owe (credit cards, loans). Paying debt on time raises your credit score.

In the 70-20-10 Rule (Beginner), 20% goes here. In the 60-20-20 Rule (Balanced), 20% goes here. In the 50-30-20 Rule (Lifestyle), 20% goes here. In the 50-40-10 Rule (Future Builder), 40% goes here. The game auto-splits the benchmark: 75% to savings, 25% to debt pay.

Why does this matter?
• Savings = security for emergencies
• Debt pay = better credit score over time
• Credit score affects future loans, housing, and even jobs!`
    },
    insurance: {
      title:"🛡️ Insurance",
      body:`Insurance is a monthly payment that protects you from BIG unexpected costs.

How it works: You pay a small amount every month. In return, if something bad happens (accident, emergency, theft), your cost is reduced.

Options in this game:
• None ($0/mo) — You pay full cost for any emergency. Risky!
• Basic ($8/mo) — Some emergencies are reduced. Balanced.
• Strong ($15/mo) — Emergencies are reduced the most. Safest.

Real-life insurance types include:
• Health insurance (medical bills)
• Car insurance (accidents)
• Renters/home insurance (theft, damage)

Think of it like this: Insurance is paying a small amount now so you don't lose everything later.`
    }
  };
  const d = defs[section];
  if(!d) return;
  openModal({
    title: d.title,
    meta: "Tap this any time to review the definition",
    body: d.body,
    buttons:[{id:"close", label:"Got it!", kind:"primary"}]
  });
}

/* ── Monthly wants refresh and tracking ── */
function getWantsInventory(){
  return state.plan.wantsSelections || [];
}

function reloadWantsInventoryForNewMonth(){
  // Zero out wants inventory flags, but re-load them from committed selections
  if(state.plan.wantsSelections && state.plan.wantsSelections.length > 0){
    state.plan.unplannedWantUsedThisMonth = false;
    state.plan.unplannedWantLabelsThisMonth = [];
    state.plan.wantsInventoryActive = state.plan.wantsSelections.map(w => ({
      label: w.label,
      value: w.value,
      available: true
    }));
  }
}

function triggerMonthlyWantsChoice(onDone){
  if(!state.plan.wantsSelections || state.plan.wantsSelections.length === 0){
    if(onDone) onDone();
    return;
  }
  const monthName = weekToMonthName(state.weekEngine ? state.weekEngine.week : 4);
  openModal({
    title:`🛍️ ${monthName}: Review Your Wants`,
    meta:"Each month you can keep or swap your wants",
    body:`Your wants budget is ${money(state.plan.wants)}/month.

Current wants:
${state.plan.wantsSelections.map(w=>`• ${w.label}: ${money(w.value)}`).join('\n')}

Keep the same wants this month (they reload into your inventory), or pick new ones?`,
    buttons:[
      {id:"keep",   label:"Keep Same Wants ✓",  kind:"success"},
      {id:"change", label:"Pick New Wants 🔄",   kind:"secondary"}
    ],
    onPick:(id)=>{
      if(id==="keep"){
        reloadWantsInventoryForNewMonth();
        addLedgerLine(`${monthName} wants reloaded: ${state.plan.wantsSelections.map(w=>w.label).join(', ')}`);
        renderSheet();
        showBanner("Wants reloaded for this month!");
        if(onDone) setTimeout(onDone, 50);
      } else {
        // Reset wants and store onDone — must re-commit wants before continuing
        state.plan.wantsCommitted = false;
        state.plan.wantsSelections = [];
        state.plan.unplannedWantUsedThisMonth = false;
        state.plan.unplannedWantLabelsThisMonth = [];
        state.plan.wantsInventoryActive = [];
        state.plan.wants = 0;
        if($("wantsPick")) $("wantsPick").querySelectorAll('input[type="checkbox"]').forEach(o=> o.checked = false);
        syncWantsChecklistStyles();
        renderHeader();
        renderSheet();
        // Store the callback so addWantExtra can fire it when done
        state._wantsRefreshCallback = onDone;
        openTab("plan");
        showBanner("📋 Pick your new wants then tap 'Add Wants to Plan'");
        // Scroll to wants section
        setTimeout(()=>{
          const wantsField = $("wantsPick") ? $("wantsPick").closest('.field') : null;
          if(wantsField) wantsField.scrollIntoView({behavior:"smooth", block:"center"});
          else scrollToBtn("btnAddWant");
        }, 200);
        // Show a blocking reminder modal
        setTimeout(()=>{
          openModal({
            title:"📋 Pick Your Wants for " + monthName,
            meta:"You must choose wants before continuing",
            body:`The wants section is highlighted in the Plan tab.\n\nSelect your wants for ${monthName} and tap "Add Wants to Plan" to lock them in.\n\nYou cannot advance to the next week until wants are committed.`,
            buttons:[{id:"ok", label:"Go Pick Wants →", kind:"primary"}],
            onPick:()=>{
              openTab("plan");
              setTimeout(()=>{
                const wantsField = $("wantsPick") ? $("wantsPick").closest('.field') : null;
                if(wantsField){ wantsField.classList.add('glow'); wantsField.scrollIntoView({behavior:"smooth", block:"center"}); }
                scrollToBtn("btnAddWant");
              }, 150);
            }
          });
        }, 400);
      }
    }
  });
}

/* ── Check if a want is in inventory for social scenario ── */
function hasWantInInventory(wantLabel){
  if(!state.plan.wantsInventoryActive) return false;
  const w = state.plan.wantsInventoryActive.find(x => x.label.toLowerCase().includes(wantLabel.toLowerCase()) && x.available);
  return !!w;
}
function useWantFromInventory(wantLabel){
  if(!state.plan.wantsInventoryActive) return false;
  const w = state.plan.wantsInventoryActive.find(x => x.label.toLowerCase().includes(wantLabel.toLowerCase()) && x.available);
  if(w){ w.available = false; addLedgerLine(`Used want: ${w.label} (already in budget)`); return true; }
  return false;
}
function markUnplannedWantUsed(label){
  state.plan.unplannedWantUsedThisMonth = true;
  if(!Array.isArray(state.plan.unplannedWantLabelsThisMonth)) state.plan.unplannedWantLabelsThisMonth = [];
  if(label){
    const clean = String(label).trim();
    if(clean && !state.plan.unplannedWantLabelsThisMonth.includes(clean)){
      state.plan.unplannedWantLabelsThisMonth.push(clean);
    }
  }
}

/* ── Monthly budget snapshot tracking ── */
function recordMonthSnapshot(){
  normalizeHysaMonthEndGrowth();
  const hysaSnap = getHysaSnapshot({projectFirstMonth:true});
  applyHysaSnapshot(hysaSnap);
  const month = state.weekEngine ? weekToMonth(state.weekEngine.week) : state.day;
  const monthName = state.weekEngine ? weekToMonthName(state.weekEngine.week) : `Month ${state.day}`;
  const hysaTotal = hysaSnap.balance;
  const hysaGrowthMonth = hysaSnap.growthThisMonth;
  const hysaGrowthTotal = hysaSnap.totalGrowth;

  const cdTotal = totalCdFunds();
  const savingsGoalPct = state.savingsGoal > 0 ? Math.min(100, Math.round(((state.bank.savings + hysaTotal) / state.savingsGoal)*100)) : 0;
  const wantsSummary = (state.plan.wantsSelections || []).map(w => {
    const inv = state.plan.wantsInventoryActive ? state.plan.wantsInventoryActive.find(x => x.label === w.label) : null;
    return {
      label: w.label,
      value: w.value,
      used: inv ? !inv.available : false
    };
  });

  if(!state.monthSnapshots) state.monthSnapshots = [];
  const identity = getIdentitySnapshot({
    checking: state.bank.checking,
    savings: state.bank.savings,
    hysa: hysaTotal,
    cd: cdTotal,
    credit: state.credit,
    savingsGoalPct,
    unplannedWantUsed: !!state.plan.unplannedWantUsedThisMonth,
    healthScore: computeFinancialHealth().score
  });

  state.monthSnapshots.push({
    month,
    monthName,
    checking: state.bank.checking,
    savings: state.bank.savings,
    hysa: hysaTotal,
    hysaGrowth: hysaGrowthTotal,
    hysaGrowthMonth: hysaGrowthMonth,
    cd: cdTotal,
    credit: state.credit,
    savingsGoalPct,
    cash: state.cash,
    wants: state.plan.wants,
    wantsSummary,
    unplannedWantUsed: !!state.plan.unplannedWantUsedThisMonth,
    unplannedWantLabels: [...(state.plan.unplannedWantLabelsThisMonth || [])],
    identityTitle: identity.title,
    identityEmoji: identity.emoji,
    identityDetail: identity.detail
  });
}

/* ── Paycheck investment prompt ── */
function craftsWalkthroughModal(){
  openModal({
    title:"Selling Crafts Walkthrough",
    meta:"Teacher example — full 48-week / 12-month run",
    body:
`START SETUP
1) Switch job card to "Selling Crafts".
2) Tap "Choose Year Plan" and pick one of the 4 budget models, then tap "Lock Plan for Year".
3) In Wants, pick one or more wants for the month.
   → Wants can be reused each month if the student keeps them.
   → Social decisions can now check whether a want was already budgeted.
4) Tap "Lock Job ✓".
5) Tap "Start Year Mission".
6) Banking → "Choose Bank + Insurance (Start)" to set up checking, savings, and insurance.

MONTH 1 • JUNE • WEEKS 1-4
7) Week 1 starts the mission and gives the opening scenario.
8) Use the Ledger to buy craft materials, stickers, packaging, or display items.
9) Use the Events tab for extra variety:
   • Run Job Real-Life Event
   • Run School Decision
   • Run Social Decision
   • Run Random Event
10) End of June triggers the Budget Sheet review before the student can continue.

MONTH 2 • JULY • WEEKS 5-8
11) Student keeps the same wants or changes them for the new month.
12) Selling Crafts job events might include a booth fee, rush custom order, rainy market day, or display upgrade.
13) Social decisions may now pull from any budgeted or unbudgeted want, not just pizza or arcade.
14) End of July → Budget Sheet review.

MONTH 3 • AUGUST • WEEKS 9-12
15) Student sees more craft inventory choices and can compare profit, expenses, and inventory value.
16) Contracts, inheritance, local tax, and billing disputes can still be used for benchmark practice.
17) End of August → Budget Sheet review.

MONTH 4 • SEPTEMBER • WEEKS 13-16
18) School decisions become more frequent because the school season is active.
19) Student balances work, school, and social pressure.
20) End of September → Budget Sheet review.

MONTH 5 • OCTOBER • WEEKS 17-20
21) Craft orders can grow, and pricing choices matter more.
22) Student should be watching checking, savings, HYSA growth, and debt split.
23) End of October → Budget Sheet review.

MONTH 6 • NOVEMBER • WEEKS 21-24
24) Student may face gift spending, family events, or seasonal job opportunities.
25) Selling Crafts can include holiday-prep style decisions and inventory restocks.
26) End of November → Budget Sheet review.

MONTH 7 • DECEMBER • WEEKS 25-28
27) Wants and social decisions become more important because students may feel holiday pressure.
28) Student sees how budgeting ahead changes the outcome.
29) End of December → Budget Sheet review.

MONTH 8 • JANUARY • WEEKS 29-32
30) New month, same year mission. Student keeps going through all 48 weeks, not just 12.
31) Financial habits should now show up in savings, credit, and cash flow.
32) End of January → Budget Sheet review.

MONTH 9 • FEBRUARY • WEEKS 33-36
33) Student continues getting weekly mission steps plus optional job, school, and social decisions.
34) Contracts and wants-aware social choices keep each run-through different.
35) End of February → Budget Sheet review.

MONTH 10 • MARCH • WEEKS 37-40
36) Student should now see cause-and-effect from earlier decisions.
37) This is a good stretch for teacher discussion on discipline, delayed gratification, and tradeoffs.
38) End of March → Budget Sheet review.

MONTH 11 • APRIL • WEEKS 41-44
39) Student is closing in on the year-end goal.
40) HYSA growth, CDs, and Savings Goal % should all be visible on the Budget Sheet.
41) End of April → Budget Sheet review.

MONTH 12 • MAY • WEEKS 45-48
42) Final 4 weeks complete the full school-year mission.
43) Student finishes the last monthly review after Week 48.
44) Only after all 48 weeks are done should the app move to the final results and standards report.

FINAL RESULTS
45) Generate the report after the full 12 months are complete.
46) Review:
   • total savings
   • spending discipline
   • wants vs needs choices
   • contract outcomes
   • business profit
   • benchmark coverage
47) This walkthrough is now a true 48-week / 12-month example, not a 12-week shortcut.`,
    buttons:[{id:"ok",label:"Got it",kind:"primary"}],
    onPick:()=>{}
  });
}

/* Reports */
function generateReport(){
  const job = state.jobs[state.jobIndex];
  const jobBuckets = new Set(job.buckets || []);
  // Always include core benchmarks that every mission covers
  const coreBuckets = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13]);

  // Show only benchmarks relevant to the current job + always-possible ones from events
  const alwaysPossible = new Set([4,5,6,7,8,9,10,11,12,13]); // can come from events/scenarios
  const relevant = [...coreBuckets].filter(b => jobBuckets.has(b) || alwaysPossible.has(b));

  const covered = [...state.coverage].sort((a,b)=>a-b);
  if(covered.length === 0 && !state.mission.active){
    $("reportBox").innerHTML = "No coverage yet — run the year mission to see benchmarks covered.";
    return;
  }

  const lines = relevant.map(b => {
    const done = state.coverage.has(b);
    const name = BENCH[b] || `Benchmark #${b}`;
    const check = done ? "✅" : "⬜";
    const style = done ? "color:var(--success);font-weight:bold" : "color:var(--muted)";
    const relevantMark = jobBuckets.has(b) ? "" : " <small>(event)</small>";
    return `<div style="${style};padding:3px 0">${check} Benchmark #${b}: ${name}${relevantMark}</div>`;
  }).join('');

  const pct = Math.round((covered.length / relevant.length) * 100);
  $("reportBox").innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px">
      ${job.name} — ${covered.length}/${relevant.length} benchmarks covered (${pct}%)
    </div>
    <div style="background:var(--border);border-radius:4px;height:8px;margin-bottom:12px">
      <div style="background:var(--success);height:8px;border-radius:4px;width:${pct}%"></div>
    </div>
    ${lines}
    <div style="margin-top:10px;font-size:12px;color:var(--muted)">
      ✅ = covered this session &nbsp;⬜ = not yet covered<br>
      Full year mission aims to cover all benchmarks.
    </div>`;
}
function clearReport(){
  state.coverage=new Set();
  $("reportBox").textContent="Cleared.";
  setLog("Session cleared.");
}

/* Playlist */
function startPlaylist(){
  state.playlist.active=true;
  state.playlist.paused=false;
  state.playlist.index=0;
  setLog("Teacher playlist started.");
}
function togglePlaylistLoop(){
  state.playlist.loop=!state.playlist.loop;
  $("playlistLoop").textContent="Loop: "+(state.playlist.loop?"On":"Off");
}
function runNextPlaylistStep(){
  if(!state.playlist.active){
    beep("warn");
    openModal({title:"Playlist not started",meta:"Teacher tool",body:"Tap Start first.",buttons:[{id:"close",label:"Close",kind:"secondary"}]});
    return;
  }
  if(state.playlist.paused){ beep("warn"); setLog("Playlist paused."); return; }
  const item=state.playlist.items[state.playlist.index];
  if(!item){
    if(state.playlist.loop){ state.playlist.index=0; return runNextPlaylistStep(); }
    state.playlist.active=false; setLog("Playlist complete."); return;
  }
  if(item==="inheritance") triggerInheritance();
  if(item==="dispute") startDispute();
  if(item==="gen_local_tax") generateLocalTax();
  if(item==="contract_pick"){ openTab("contracts"); showBanner("Pick a contract"); }
  state.playlist.index += 1;
}
function playlistProgress(){
  openModal({
    title:"Playlist Progress",
    meta:"Teacher tool",
    body:
`Active: ${state.playlist.active}
Paused: ${state.playlist.paused}
Loop: ${state.playlist.loop}
Step: ${state.playlist.index}/${state.playlist.items.length}
Next: ${state.playlist.items[state.playlist.index]||"none"}`,
    buttons:[{id:"close",label:"Close",kind:"secondary"}]
  });
}


/* ============================================================
   TEACHER MODE + REFLECTIONS + SAVE/RESUME
   ============================================================ */
let teacherReflections = [];

function openHtmlModal({title, meta="", html="", onRender=null, buttons=[]}){
  $("mTitle").textContent = title;
  $("mMeta").textContent = meta;
  $("mBody").innerHTML = html;
  const foot = $("mFoot");
  foot.innerHTML = "";
  buttons.forEach(b=>{
    const btn=document.createElement("button");
    btn.className = "btn " + (b.kind||"secondary");
    if(b.kind==="primary") btn.className="btn";
    if(b.kind==="success") btn.className="btn success";
    if(b.kind==="warn") btn.className="btn warn";
    if(b.kind==="danger") btn.className="btn danger";
    btn.textContent=b.label;
    btn.onclick=()=>{ if(b.onClick) b.onClick(); };
    foot.appendChild(btn);
  });
  $("overlay").classList.add("show");
  $("overlay").setAttribute("aria-hidden","false");
  if(onRender) setTimeout(onRender, 0);
}
function closeHtmlModal(){ closeModal(); }


function bindRoleDifficultyMenu(){
  const hoverBox = $("modeHoverInfo");
  const defaultHoverHtml = '<b>Hover a mode</b><br>See the recommended age range, grade band, and best fit before you launch.';
  const bind = (id, role, experience) => {
    const el = $(id);
    if(!el) return;
    const showModeHint = ()=>{
      const range = el.dataset.modeRange || 'Recommended age range coming soon';
      const fit = el.dataset.modeFit || 'Use this mode when you want the best classroom fit.';
      const modeName = (el.textContent || '').split('\n')[0].trim();
      el.title = `${modeName} • ${range} • ${fit}`;
      if(hoverBox) hoverBox.innerHTML = `<b>${escapeHtml(modeName)}</b><br>${escapeHtml(range)}<br><span class="muted">${escapeHtml(fit)}</span>`;
    };
    el.onmouseenter = showModeHint;
    el.onfocus = showModeHint;
    el.onmouseleave = ()=>{ if(hoverBox) hoverBox.innerHTML = defaultHoverHtml; };
    el.onblur = ()=>{ if(hoverBox) hoverBox.innerHTML = defaultHoverHtml; };
    el.onclick = (e)=>{
      if(e) e.preventDefault();
      beep("click");
      selectConfiguration(role, experience);
    };
  };
  bind("modeStudentBeginnerBtn", "student", "beginner");
  bind("modeStudentStandardBtn", "student", "standard");
  bind("modeStudentEliteBtn", "student", "elite");
  bind("modeTeacherBeginnerBtn", "teacher", "beginner");
  bind("modeTeacherStandardBtn", "teacher", "standard");
  bind("modeTeacherEliteBtn", "teacher", "elite");
}

function ensureTeacherModeMenu(){
  const screen = $("modeSelectScreen");
  if(screen) screen.style.display = "flex";
  openTab("plan");
  refreshSaveStatus();
  renderSharedProfileBadge();
}
function selectConfiguration(role='teacher', experience='standard'){
  renderSharedProfileBadge();
  if(experience === 'beginner'){
    try{
      sessionStorage.setItem('wglt_jr_role', role);
      sessionStorage.setItem('wglt_jr_experience', experience);
    }catch(e){}
    window.location.href = './budget-boss-jr.html?teacher=' + (role === 'teacher' ? '1' : '0') + '&role=' + encodeURIComponent(role) + '&experience=' + encodeURIComponent(experience);
    return;
  }
  if($("modeSelectScreen")) $("modeSelectScreen").style.display = "none";
  state.presentationRole = role;
  state.experienceLevel = experience;
  state.teacherMode = role === 'teacher';
  state.currentMode = `${role}_${experience}`;
  state.lockMode = false;
  updateModeBadge();
  openTab("plan");
  const existing = getLocalSaveForMode(role, experience);
  if(hasMeaningfulProgress(existing)){
    applyTeacherSavePayload(existing, false);
    refreshSaveStatus(existing.savedAt ? `Resumed local save from ${new Date(existing.savedAt).toLocaleString()}.` : 'Resumed local save.');
    showBanner(`${getModeConfig().name} resumed`);
    return;
  }
  const cfg = getModeConfig();
  const launchLine = cfg.eliteFeatures
    ? `${cfg.name} ready. Choose and lock your year plan first. Expect stronger pressure, advanced contracts, and consequence chains.`
    : `${cfg.name} ready. Choose and lock your year plan first.`;
  setLog(launchLine);
  refreshPreMissionPulse();
  renderAll();
  scheduleAutoSave(150);
}
window.startRoleDifficulty = function(role, experience){ return selectConfiguration(role, experience); };

function enterTeacherMode(){ selectConfiguration('teacher','standard'); }
function enterEliteMode(){ selectConfiguration('teacher','elite'); }
function refreshSaveStatus(text){
  const el = $("saveStatus");
  if(!el) return;
  if(text){ el.textContent = text; return; }
  const raw = localStorage.getItem(getModeStorageKey());
  if(!raw){ el.textContent = `No ${getModeConfig().name || "mode"} local save yet.`; return; }
  try{
    const payload = JSON.parse(raw);
    const stamp = payload.savedAt ? new Date(payload.savedAt).toLocaleString() : "recently";
    el.textContent = `${getModeConfig().name || "Mode"} save ready from ${stamp}.`;
  }catch{
    el.textContent = "A local save exists but could not be read.";
  }
}
function stateToSnapshot(value){
  if(value instanceof Set) return {__kind:"Set", values:[...value]};
  if(Array.isArray(value)) return value.map(stateToSnapshot);
  if(value && typeof value === "object"){
    const out = {};
    for(const [k,v] of Object.entries(value)) out[k] = stateToSnapshot(v);
    return out;
  }
  return value;
}
function snapshotToState(value){
  if(Array.isArray(value)) return value.map(snapshotToState);
  if(value && typeof value === "object"){
    if(value.__kind === "Set") return new Set((value.values||[]).map(snapshotToState));
    const out = {};
    for(const [k,v] of Object.entries(value)) out[k] = snapshotToState(v);
    return out;
  }
  return value;
}
function mergeIntoState(target, source){
  if(source instanceof Set){
    if(target instanceof Set){
      target.clear();
      source.forEach(v=>target.add(v));
      return target;
    }
    return source;
  }
  if(Array.isArray(source)){
    return source.map(item=>snapshotToState(stateToSnapshot(item)));
  }
  if(source && typeof source === "object"){
    if(!target || typeof target !== "object" || Array.isArray(target) || target instanceof Set) target = {};
    Object.keys(source).forEach(k=>{
      const sv = source[k];
      if(sv instanceof Set){
        target[k] = new Set([...sv]);
      } else if(Array.isArray(sv)){
        target[k] = sv.map(item=>snapshotToState(stateToSnapshot(item)));
      } else if(sv && typeof sv === "object"){
        target[k] = mergeIntoState(target[k], sv);
      } else {
        target[k] = sv;
      }
    });
    return target;
  }
  return source;
}
function getTeacherSavePayload(){
  return {
    version: 2,
    mode: state.currentMode || "teacher_standard",
    presentationRole: state.presentationRole || 'teacher',
    experienceLevel: state.experienceLevel || 'standard',
    savedAt: new Date().toISOString(),
    state: stateToSnapshot(state),
    teacherReflections: teacherReflections.map(r=>({...r}))
  };
}
function applyTeacherSavePayload(payload, announce=true){
  if(!payload || !payload.state) return;
  const restored = snapshotToState(payload.state);
  mergeIntoState(state, restored);
  state.lockMode = false;
  state.presentationRole = payload.presentationRole || restored.presentationRole || state.presentationRole || 'teacher';
  state.experienceLevel = payload.experienceLevel || restored.experienceLevel || state.experienceLevel || 'standard';
  state.teacherMode = state.presentationRole === 'teacher';
  state.currentMode = payload.mode || `${state.presentationRole}_${state.experienceLevel}`;
  teacherReflections = Array.isArray(payload.teacherReflections) ? payload.teacherReflections.map(r=>({...r})) : [];
  renderAll();
  renderReflectionReport();
  if($("modeSelectScreen")) $("modeSelectScreen").style.display = "none";
  openTab("plan");
  refreshSaveStatus(payload.savedAt ? `Loaded save from ${new Date(payload.savedAt).toLocaleString()}.` : "Save loaded.");
  if(announce) showBanner(`${getModeConfig().name} save loaded`);
  scheduleAutoSave(150);
}
function saveTeacherLocal(silent=false){
  try{
    const payload = getTeacherSavePayload();
    localStorage.setItem(getModeStorageKey(), JSON.stringify(payload));
    refreshSaveStatus(`Local save updated ${new Date(payload.savedAt).toLocaleString()}.`);
    if(!silent) showBanner("Saved locally");
  }catch(err){
    console.error(err);
    if(!silent) showBanner("Could not save on this browser");
  }
}
function loadTeacherLocal(){
  try{
    const raw = localStorage.getItem(getModeStorageKey());
    if(!raw){ showBanner("No local save found"); return; }
    applyTeacherSavePayload(JSON.parse(raw), true);
  }catch(err){
    console.error(err);
    showBanner("Could not load local save");
  }
}
function downloadTeacherSave(){
  try{
    const payload = getTeacherSavePayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wglt-teacher-save-${new Date(payload.savedAt).toISOString().slice(0,19).replace(/[T:]/g,"-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    refreshSaveStatus(`Save file downloaded ${new Date(payload.savedAt).toLocaleString()}.`);
    showBanner("Save file downloaded");
  }catch(err){
    console.error(err);
    showBanner("Could not download save file");
  }
}
function promptTeacherSaveUpload(){
  const input = $("saveFileInput");
  if(input){ input.value = ""; input.click(); }
}
function importTeacherSave(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const payload = JSON.parse(String(reader.result || "{}"));
      applyTeacherSavePayload(payload, true);
      saveTeacherLocal(true);
    }catch(err){
      console.error(err);
      showBanner("That save file could not be read");
    }
  };
  reader.readAsText(file);
}
function goTeacherMainMenu(){
  const hasProgress = !!(state.mission.active || (state.weekEngine && state.weekEngine.week > 1) || (state.ledger && state.ledger.history && state.ledger.history.length));
  if(hasProgress){
    saveTeacherLocal(true);
    const ok = window.confirm("Quit to the main menu? Your progress was saved locally first.");
    if(!ok) return;
  }
  if($("modeSelectScreen")) $("modeSelectScreen").style.display = "flex";
  openTab("plan");
  showBanner("Back to main menu");
}
function openTeacherReflectionModal(prefill={}){
  const options = [
    ["weekly","Weekly Scenario"],
    ["monthly","Monthly Snapshot"],
    ["benchmark","Benchmark Checkpoint"],
    ["playlist","Playlist Lesson"],
    ["goal","Savings / Goal Check"],
    ["other","Other"]
  ];
  const benchOptions = ['<option value="">Select benchmark</option>'].concat(Object.entries(BENCH).map(([k,v])=>`<option value="${k}">Benchmark #${k} - ${v}</option>`)).join("");
  const typeOptions = options.map(([v,l])=>`<option value="${v}" ${prefill.coverageType===v?'selected':''}>${l}</option>`).join("");
  const html = `
    <div style="display:grid;gap:10px">
      <label style="font-weight:900;font-size:12px">Reflection Title
        <input id="teacherReflectionTitle" style="width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:12px" value="${(prefill.title||"").replace(/"/g,'&quot;')}" placeholder="Example: Week 4 Pizza Choice Reflection">
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label style="font-weight:900;font-size:12px">What did this reflection cover?
          <select id="teacherReflectionCoverage" style="width:100%;margin-top:6px">${typeOptions}</select>
        </label>
        <label style="font-weight:900;font-size:12px">Linked Benchmark
          <select id="teacherReflectionBenchmark" style="width:100%;margin-top:6px">${benchOptions}</select>
        </label>
      </div>
      <label style="font-weight:900;font-size:12px">Lesson / Scenario / Event Notes
        <input id="teacherReflectionNotes" style="width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:12px" value="${(prefill.notes||"").replace(/"/g,'&quot;')}" placeholder="Example: Friends wanted pizza and the student used unplanned money">
      </label>
      <label style="font-weight:900;font-size:12px">What financial choice impacted the budget most this week?
        <textarea id="teacherReflectionQ1" style="width:100%;margin-top:6px;min-height:70px;padding:10px;border:1px solid var(--line);border-radius:12px">${prefill.q1||""}</textarea>
      </label>
      <label style="font-weight:900;font-size:12px">Was the decision a Need, Want, or Emergency?
        <textarea id="teacherReflectionQ2" style="width:100%;margin-top:6px;min-height:60px;padding:10px;border:1px solid var(--line);border-radius:12px">${prefill.q2||""}</textarea>
      </label>
      <label style="font-weight:900;font-size:12px">How did the decision affect net worth or balances?
        <textarea id="teacherReflectionQ3" style="width:100%;margin-top:6px;min-height:60px;padding:10px;border:1px solid var(--line);border-radius:12px">${prefill.q3||""}</textarea>
      </label>
      <label style="font-weight:900;font-size:12px">What would the student do differently next time?
        <textarea id="teacherReflectionQ4" style="width:100%;margin-top:6px;min-height:60px;padding:10px;border:1px solid var(--line);border-radius:12px">${prefill.q4||""}</textarea>
      </label>
    </div>
  `;
  openHtmlModal({
    title: "Teacher Reflection",
    meta: "Teacher Mode only",
    html,
    onRender: ()=>{
      const benchEl = $("teacherReflectionBenchmark");
      if(benchEl && prefill.benchmark) benchEl.value = String(prefill.benchmark);
    },
    buttons: [
      {label:"Cancel", kind:"secondary", onClick: closeHtmlModal},
      {label:"Save Reflection", kind:"success", onClick: saveTeacherReflection}
    ]
  });
}
function saveTeacherReflection(){
  const title = ($("teacherReflectionTitle")?.value || "").trim();
  const coverageType = ($("teacherReflectionCoverage")?.value || "other").trim();
  const benchmark = ($("teacherReflectionBenchmark")?.value || "").trim();
  const notes = ($("teacherReflectionNotes")?.value || "").trim();
  const q1 = ($("teacherReflectionQ1")?.value || "").trim();
  const q2 = ($("teacherReflectionQ2")?.value || "").trim();
  const q3 = ($("teacherReflectionQ3")?.value || "").trim();
  const q4 = ($("teacherReflectionQ4")?.value || "").trim();
  const reflection = {
    id: `refl_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    week: state.weekEngine ? state.weekEngine.week : 1,
    month: typeof weekToMonthName === "function" ? weekToMonthName(state.weekEngine ? state.weekEngine.week : 1) : "",
    createdAt: new Date().toISOString(),
    title: title || `Reflection for Week ${state.weekEngine ? state.weekEngine.week : 1}`,
    coverageType,
    benchmark,
    notes,
    q1,q2,q3,q4
  };
  teacherReflections.unshift(reflection);
  closeHtmlModal();
  renderReflectionReport(true);
  scheduleAutoSave(100);
  showBanner("Reflection saved");
}
function getCoverageTypeLabel(key){
  return {
    weekly:"Weekly Scenario",
    monthly:"Monthly Snapshot",
    benchmark:"Benchmark Checkpoint",
    playlist:"Playlist Lesson",
    goal:"Savings / Goal Check",
    auto:"Quick Reflection",
    other:"Other"
  }[key] || "Other";
}
function renderReflectionReport(showBox=false){
  const box = $("reflectionReportBox");
  if(!box) return;
  if(showBox) box.style.display = "block";
  if(!teacherReflections.length){
    box.innerHTML = '<div class="reflection-empty">No reflections yet.</div>';
    return;
  }
  const cards = teacherReflections.map(r=>{
    const benchLabel = r.benchmark ? (BENCH[Number(r.benchmark)] ? `Benchmark #${r.benchmark} - ${BENCH[Number(r.benchmark)]}` : `Benchmark #${r.benchmark}`) : "No linked benchmark";
    const created = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
    return `
      <div class="reflection-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <h4>${escapeHtml(r.title || "Reflection")}</h4>
            <div class="reflection-meta">Saved ${escapeHtml(created)} • Week ${escapeHtml(String(r.week||1))} • ${escapeHtml(r.month||"")}</div>
          </div>
          <label style="font-weight:900;font-size:12px;display:flex;gap:6px;align-items:center">
            <input type="checkbox" class="reflection-delete-check" value="${escapeHtml(r.id)}"> Delete
          </label>
        </div>
        <div class="reflection-row"><b>Covered:</b> ${escapeHtml(getCoverageTypeLabel(r.coverageType))}</div>
        <div class="reflection-row"><b>Tag:</b> ${escapeHtml(r.decisionType ? (r.decisionType.charAt(0).toUpperCase() + r.decisionType.slice(1)) : "—")}</div>
        <div class="reflection-row"><b>Linked Benchmark:</b> ${escapeHtml(benchLabel)}</div>
        <div class="reflection-row"><b>Lesson / Event Notes:</b> ${escapeHtml(r.notes || "None")}</div>
        <div class="reflection-row"><b>Question shown:</b> ${escapeHtml(r.q1 || "—")}</div>
        <div class="reflection-row"><b>Student answer:</b> ${escapeHtml(r.q2 || "—")}</div>
        <div class="reflection-row"><b>Teacher note:</b> ${escapeHtml(r.q3 || "—")}</div>
        <div class="reflection-row"><b>Decision summary:</b> ${escapeHtml(r.q4 || "—")}</div>
      </div>`;
  }).join("");
  box.innerHTML = `
    <div class="reflection-delete-bar">
      <button class="btn secondary" type="button" onclick="openTeacherReflectionModal()">New Reflection</button>
      <button class="btn danger" type="button" onclick="deleteSelectedReflections()">Delete Selected</button>
      <span class="muted">Check any reflections you want to remove, then delete them.</span>
    </div>
    <div class="reflection-list">${cards}</div>
  `;
}
function toggleReflectionReport(){
  const box = $("reflectionReportBox");
  if(!box) return;
  const show = box.style.display === "none" || !box.style.display;
  box.style.display = show ? "block" : "none";
  if(show) renderReflectionReport(true);
}
function deleteSelectedReflections(){
  const checks = Array.from(document.querySelectorAll(".reflection-delete-check:checked"));
  if(!checks.length){ showBanner("Select reflection(s) to delete"); return; }
  const ok = window.confirm(`Delete ${checks.length} selected reflection(s)?`);
  if(!ok) return;
  const ids = new Set(checks.map(c=>c.value));
  teacherReflections = teacherReflections.filter(r=>!ids.has(r.id));
  renderReflectionReport(true);
  saveTeacherLocal(true);
  showBanner("Selected reflections deleted");
}
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}


/* Wire UI */
function wire(){
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>openTab(t.dataset.tab)));

  $("jobPrev").onclick=()=>{
    if(!state.plan.lockedForYear){ beep("warn"); showBanner("Lock the year plan first"); openTab("plan"); guidePreStart(); return; }
    if(state.jobLocked || state.mission.active){ beep("warn"); showBanner("Reset to change jobs"); return; }
    beep("click");
    state.jobIndex=(state.jobIndex-1+state.jobs.length)%state.jobs.length;
    state.plan.income=state.jobs[state.jobIndex].pay*4;
    applyBudgetModel(state.plan.model || "rule702010");
    renderJob(); renderHeader(); renderSheet();
  };
  $("jobNext").onclick=()=>{
    if(!state.plan.lockedForYear){ beep("warn"); showBanner("Lock the year plan first"); openTab("plan"); guidePreStart(); return; }
    if(state.jobLocked || state.mission.active){ beep("warn"); showBanner("Reset to change jobs"); return; }
    beep("click");
    state.jobIndex=(state.jobIndex+1)%state.jobs.length;
    state.plan.income=state.jobs[state.jobIndex].pay*4;
    applyBudgetModel(state.plan.model || "rule702010");
    renderJob(); renderHeader(); renderSheet();
  };

  $("btnStartMission").onclick=()=>{ beep("click"); startMission(); };
  $("btnLockJob").onclick=()=>{
    if(!state.plan.lockedForYear){ beep("warn"); showBanner("Lock the year plan first"); openTab("plan"); guidePreStart(); return; }
    if(state.jobLocked || state.mission.active){ beep("warn"); showBanner("Job already locked — reset to change"); return; }
    const job = state.jobs[state.jobIndex];
    beep("success");
    showBanner(job.name + " selected and locked!");
    setLog("Job locked: " + job.name + ". Now build your wants and tap Start Year Mission.");
    guideWantsStep();
    scrollToBtn("btnAddWant");
  };
  $("btnPauseMission").onclick=()=>{ beep("click"); pauseMission(); };
  $("btnResetMission").onclick=()=>{ beep("click"); confirmResetMission(); };

  $("playlistStart").onclick=()=>{ beep("click"); startPlaylist(); };
  $("playlistPause").onclick=()=>{ state.playlist.paused=!state.playlist.paused; setLog(state.playlist.paused?"Playlist paused.":"Playlist resumed."); };
  $("playlistLoop").onclick=()=>{ beep("click"); togglePlaylistLoop(); };
  $("btnPlaylistNext").onclick=()=>{ beep("click"); runNextPlaylistStep(); };
  $("btnPlaylistProgress").onclick=()=>{ beep("click"); playlistProgress(); };

  document.querySelectorAll("[data-tax]").forEach(ch=>ch.addEventListener("click",()=>{ state.plan.taxPct=parseInt(ch.dataset.tax,10); renderHeader(); beep("click"); }));
  document.querySelectorAll("[data-wants]").forEach(ch=>ch.addEventListener("click",()=>{ state.plan.wants=clamp(state.plan.wants+parseInt(ch.dataset.wants,10),0,500); renderHeader(); beep("click"); }));
  document.querySelectorAll("[data-ins]").forEach(ch=>ch.addEventListener("click",()=>{ state.plan.insurance=ch.dataset.ins; renderHeader(); beep("click"); }));

  $("btnSuggestedPlan").onclick=()=> suggestedPlan();
  $("btnApplyPlan").onclick=()=> applyPlan();
  $("btnNextWeek").onclick=()=> nextWeek();
  $("btnSavingsChallenge").onclick=()=> openSavingsChallenge();

  $("btnAddWant").onclick=()=> addWantExtra();
  $("btnClearWants").onclick=()=> clearWantsExtras();
  $("wantsPick").querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    cb.onchange=()=>{ state.plan.wantsCommitted = false; syncWantsChecklistStyles(); updateWantsUI(); };
  });

  document.querySelectorAll("[data-check]").forEach(ch=>ch.addEventListener("click",()=>{ state.checkAmount=clamp(state.checkAmount+parseInt(ch.dataset.check,10),0,500); renderHeader(); beep("click"); }));
  $("btnWriteCheck").onclick=()=> writeCheck();
  $("btnDepositCheck").onclick=()=> depositCheck();

  $("btnChooseStartup").onclick=()=> startupChoose();
  $("btnCompareBanks").onclick=()=> compareBanks();
  $("btnGoals").onclick=()=> goalsModal();
  $("btnTransferToSavings").onclick=()=> transferToSavings();
  if($("btnTransferToChecking")) $("btnTransferToChecking").onclick=()=> transferToChecking();
  $("btnOpenCD").onclick=()=>{
    const termKey = $("cdTermPick").value;
    const deposit = Number($("cdDepositPick").value||0);
    const monthsLeft = state.weekEngine ? (12 - weekToMonth(state.weekEngine.week) + 1) : (12 - state.day + 1);
    const termMonths = {"3m":3,"6m":6}[termKey]||3;
    const aprMap = {"3m":"4.0%","6m":"4.5%"};
    if(termMonths > monthsLeft){
      beep("warn");
      openModal({
        title:"⛔ CD Won't Mature in Time",
        meta:"CD Builder",
        body:`This ${termMonths}-month CD won't mature before the year ends (${monthsLeft} months left).\n\nAvailable CDs this late in the year:\n${monthsLeft>=3?"• 3-Month CD • 4.0% APR ✅":"• No CDs available — too late in year"}\n${monthsLeft>=6?"• 6-Month CD • 4.5% APR ✅":""}\n${monthsLeft>=12?"• 1-Year CD • 5.0% APR ✅":""}\n\nChoose a shorter term that will mature before May.`,
        buttons:[{id:"close",label:"Got it",kind:"secondary"}]
      });
      return;
    }
    chooseFundingSource(deposit, `Open a ${termMonths}-month CD (${aprMap[termKey]} APR) with ${money(deposit)}. Choose where the money comes from:`, (src)=>{
      // Reverse the spendFromSource since createCD handles its own deduction — re-add back then let createCD handle
      // Actually: we already deducted in chooseFundingSource. We need createCD to NOT deduct again.
      // Use a silent flag approach: just call createCD without deduction, it was already paid
      const cd = {
        id: `cd_${Date.now()}`,
        name: BANK_PRODUCTS.cdTerms[termKey].name,
        termMonths,
        monthsLeft: termMonths,
        principal: deposit,
        accrued: 0,
        apr: BANK_PRODUCTS.cdTerms[termKey].apr
      };
      state.bank.cds.push(cd);
      addLedgerLine(`CD opened: ${cd.name} ${money(deposit)} at ${aprMap[termKey]} APR (from ${src})`);
      addCoverage(4); addCoverage(9);
      beep("success");
      showBanner(`${cd.name} opened at ${aprMap[termKey]} APR!`);
      renderHeader();
      notifyAction("open_cd");
    });
  };

  $("btnLedgerBuy").onclick=()=> ledgerBuy();
  $("btnLedgerUse").onclick=()=> ledgerUse();
  if($("btnLedgerInventory")) $("btnLedgerInventory").onclick=()=> showInventoryModal();
  $("btnLedgerExpense").onclick=()=> ledgerAddExpense();
  $("btnLedgerClearWeek").onclick=()=> ledgerClearWeek();

  $("btnGenLocalTax").onclick=()=> generateLocalTax();
  $("btnPayLocalTax").onclick=()=> payLocalTax();
  $("btnInheritance").onclick=()=> triggerInheritance();
  $("btnDispute").onclick=()=> startDispute();
  if($("btnJobEvent")) $("btnJobEvent").textContent = "Run Job Event";
  if($("btnSchoolEvent")) $("btnSchoolEvent").textContent = "Run Life Scenario";
  if($("btnSocialEvent")) $("btnSocialEvent").textContent = "Run Financial Decision";
  if($("btnRandomEvent")) { const w=getDynamicRandomEventWeights(); $("btnRandomEvent").textContent = `Run Random Event (${w.life||40}/${w.job||30}/${w.financial||30})`; }
  $("btnJobEvent").onclick=()=>{
    if(state.ui?.randomEventPendingType && state.ui.randomEventPendingType !== "job") return;
    const hadPending = state.ui?.randomEventPendingType === "job";
    clearRandomEventPending();
    applyLockRules();
    runJobRealLifeEvent();
    maybeTriggerEliteScenario("job");
    if(hadPending) showBanner("Nice. You played the randomly selected event.");
  };
  if($("btnSchoolEvent")) $("btnSchoolEvent").onclick=()=>{
    if(state.ui?.randomEventPendingType && state.ui.randomEventPendingType !== "life") return;
    const hadPending = state.ui?.randomEventPendingType === "life";
    clearRandomEventPending();
    applyLockRules();
    runLifeScenarioDecision();
    maybeTriggerEliteScenario("life");
    if(hadPending) showBanner("Nice. You played the randomly selected event.");
  };
  if($("btnSocialEvent")) $("btnSocialEvent").onclick=()=>{
    if(state.ui?.randomEventPendingType && state.ui.randomEventPendingType !== "financial") return;
    const hadPending = state.ui?.randomEventPendingType === "financial";
    clearRandomEventPending();
    applyLockRules();
    runFinancialDecision();
    maybeTriggerEliteScenario("financial");
    if(hadPending) showBanner("Nice. You played the randomly selected event.");
  };
  if($("btnRandomEvent")) $("btnRandomEvent").onclick=()=> runRandomEvent();

  $("btnOpenContract").onclick=()=>{
    // counts as contract pick + review
    notifyAction("contract_pick");
    reviewSelectedContract();
  };
  $("btnCancelContract").onclick=()=> cancelContract();

  $("btnReport").onclick=()=> generateReport();
  $("btnClearReport").onclick=()=> clearReport();
  $("btnHowToPlay").onclick=()=> howToPlayModal();
  if ($("btnCraftsWalkthrough")) $("btnCraftsWalkthrough").onclick=()=> craftsWalkthroughModal();
  ["btnBucket4Checking","btnBucket4Savings","btnBucket4HYSA","btnBucket4CD","btnBucket4CD2"].forEach(id=>{
    if($(id)) $(id).onclick=()=> showBucketInfo(4);
  });
  if($("btnCreditInfo")) $("btnCreditInfo").onclick=()=> showBucketInfo(5);
}



function maybeTriggerEliteScenario(sourceType='life'){
  if(!isEliteExperience() || !ELITE_SCENARIOS.length) return;
  const currentWeek = Math.max(1, Math.min(48, Number(state.week || state.day || 1)));
  if(!state.ui) state.ui = {};
  if(state.ui.lastEliteWeekTriggered === currentWeek) return;
  if(Math.random() > 0.35) return;
  const options = ELITE_SCENARIOS.filter(ev => {
    const range = ev.weeksAllowed || [1,48];
    return currentWeek >= Number(range[0] || 1) && currentWeek <= Number(range[1] || 48);
  });
  const ev = options[Math.floor(Math.random()*options.length)] || ELITE_SCENARIOS[0];
  if(!ev) return;
  state.ui.lastEliteWeekTriggered = currentWeek;
  openHtmlModal({
    title:`⚡ Elite Scenario: ${ev.title}`,
    meta:`Week ${currentWeek} • Triggered after ${sourceType} event`,
    html:`<div style="font-weight:900;line-height:1.5">${escapeHtml(ev.description || '')}</div>`,
    buttons:(ev.choices || []).map(choice => ({
      label: choice.label,
      kind: 'secondary',
      onClick:()=>{
        const fx = choice.effects || {};
        if(Number(fx.cash || 0) < 0) payFromCheckingThenCashThenSavings(Math.abs(Number(fx.cash || 0)));
        else state.cash += Number(fx.cash || 0);
        state.bank.savings += Number(fx.savings || 0);
        state.credit = clamp(state.credit + Number(fx.credit || 0), 300, 850);
        if(!state.weekEngine) state.weekEngine = {pending:[], choices:{}};
        if(choice.tag === 'disciplined' || choice.tag === 'growth'){
          queueConsequenceObject({label:`Elite echo from ${ev.title}`, triggerWeek:Math.min(48,currentWeek+2)}, ev.title);
        }
        addLedgerLine(`Elite scenario: ${ev.title} → ${choice.label}`);
        closeHtmlModal();
        renderAll();
      }
    })).concat([{label:'Skip Elite Prompt', kind:'warn', onClick:()=>closeHtmlModal()}])
  });
}

function renderConsequenceTimeline(){
  const panel = $("consequenceTimelinePanel");
  if(!panel) return;
  ensureStandardV1State();
  const currentWeek = Number((state.weekEngine && state.weekEngine.week) || 1);
  const pending = (state.weekEngine && Array.isArray(state.weekEngine.pending)) ? state.weekEngine.pending.slice() : [];
  const log = Array.isArray(state.standardV1.choiceEchoLog) ? state.standardV1.choiceEchoLog.slice() : [];
  const pressure = getPressureTrackSummary();
  const rows = [];

  pending
    .sort((a,b)=>Number(a.triggerWeek || 99) - Number(b.triggerWeek || 99))
    .slice(0,4)
    .forEach(item=>{
      rows.push({
        klass:'active',
        weekLabel:`Week ${item.triggerWeek || '?'}`,
        title:item.label || 'Pending echo',
        why:item.sourceLabel ? `Why: ${item.sourceLabel}` : 'Why: Earlier choices scheduled this consequence.',
        order:Number(item.triggerWeek || 99)
      });
    });

  log.forEach(item=>{
    const triggerWeek = Number(item.triggerWeek || item.week || 0);
    const stillPending = pending.some(p=>String(p.id || '') === String(item.id || '') && Number(p.triggerWeek || 0) === triggerWeek && (p.label || '') === (item.label || ''));
    if(stillPending) return;
    if(triggerWeek > currentWeek) return;
    rows.push({
      klass:'arrived',
      weekLabel:`Week ${triggerWeek || '?'}`,
      title:`${item.label || 'Echo'} landed`,
      why:item.sourceLabel ? `Why: ${item.sourceLabel}` : 'Why: A previous choice finally caught up.',
      order:1000 + triggerWeek
    });
  });

  if(pressure && Number(pressure.total || 0) > 0){
    rows.push({
      klass:'pressure',
      weekLabel:'Pattern Watch',
      title:`${pressure.label || 'Pressure'} x${pressure.count || pressure.total || 0}`,
      why:'Why: Repeated habits are stacking together, which raises the chance of harder echo weeks.',
      order:9999
    });
  }

  const deduped = [];
  const seen = new Set();
  rows.sort((a,b)=>a.order-b.order).forEach(row=>{
    const key = `${row.klass}|${row.weekLabel}|${row.title}|${row.why}`;
    if(seen.has(key)) return;
    seen.add(key);
    deduped.push(row);
  });

  if(!deduped.length){
    panel.innerHTML = '<div class="timeline-empty">No active consequence trail yet. Once choices start queuing delayed effects, they will show up here like footprints in fresh paint.</div>';
    return;
  }

  panel.innerHTML = deduped.slice(0,7).map(row=>`
    <div class="timeline-row ${row.klass}">
      <div class="timeline-week">${escapeHtml(row.weekLabel)}</div>
      <div class="timeline-title">${escapeHtml(row.title)}</div>
      <div class="timeline-why">${escapeHtml(row.why)}</div>
    </div>`).join('');
}

function renderTeacherToolkit(){
  const panel = $("panel-teacherToolkit");
  const box = $("teacherToolkitBox");
  if(!panel || !box) return;
  const cfg = getModeConfig();
  if(!cfg.showTeacherTools){
    panel.style.display = 'none';
    box.innerHTML = 'Teacher tools are hidden in Student role.';
    return;
  }
  panel.style.display = 'block';
  const weekCard = getCurrentWeekCard();
  const tool = getTeacherToolConfig(weekCard?.themeKey || '');
  const pending = (state.weekEngine && Array.isArray(state.weekEngine.pending)) ? state.weekEngine.pending : [];
  const masterTracks = (state.masterScenario && state.masterScenario.trackCounts) ? state.masterScenario.trackCounts : {};
  const trackRows = Object.keys(masterTracks).length
    ? Object.entries(masterTracks).map(([k,v])=>`<li><b>${escapeHtml(k)}</b>: ${escapeHtml(String(v))}</li>`).join('')
    : '<li>No master consequence tracks have built up yet.</li>';
  const pendingRows = pending.length
    ? pending.slice(0,6).map(item=>`<li><b>Week ${escapeHtml(String(item.triggerWeek || '?'))}</b>: ${escapeHtml(item.label || 'Pending consequence')}</li>`).join('')
    : '<li>No pending delayed consequences yet.</li>';
  const vocab = (tool.vocabulary || []).map(v=>`<span class="teacher-badge">${escapeHtml(v)}</span>`).join(' ');
  const rubric = (tool.rubricNotes || []).map(r=>`<li>${escapeHtml(r)}</li>`).join('');
  const eliteList = isEliteExperience()
    ? `<div class="impact-box" style="margin-top:10px"><b>Elite Layer Active</b><br>Advanced contracts available: ${escapeHtml(String(getAvailableContracts().length))}. Bonus elite scenarios loaded: ${escapeHtml(String(ELITE_SCENARIOS.length))}. Advanced delayed chains loaded: ${escapeHtml(String(ADVANCED_DELAYED.length))}.</div>`
    : '';
  const reflectionBankHtml = Object.entries(AUTO_REFLECTION_BANK).map(([key,pool])=>{
    const labelMap = {spending:'Spend Reflection Bank', save:'Save Reflection Bank', share:'Share Reflection Bank', general:'General Reflection Bank'};
    const items = (pool || []).map(item=>`<li>${escapeHtml(item.question || '')}</li>`).join('');
    return `<div class="impact-box"><b>${escapeHtml(labelMap[key] || key)}</b><ul>${items || '<li>No reflections loaded.</li>'}</ul></div>`;
  }).join('');
  const recentReflections = teacherReflections.length
    ? teacherReflections.slice(0,5).map(r=>`<li><b>Week ${escapeHtml(String(r.week || 1))}</b> • ${escapeHtml(r.decisionType || 'general')}<br><span class="muted">${escapeHtml(r.q1 || 'No question recorded')}</span><br>Student: ${escapeHtml(r.q2 || '—')}<br>Teacher: ${escapeHtml(r.q3 || '—')}</li>`).join('')
    : '<li>No reflection responses saved yet this session.</li>';
  const dash = getTeacherDashboardSummary();
  box.innerHTML = `
    <div style="display:grid;gap:10px">
      <div class="impact-box" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
        <div><b>Week / Month</b><br>Week ${escapeHtml(String(dash.week))} • ${escapeHtml(dash.month)}</div>
        <div><b>Monthly Focus</b><br>${escapeHtml(dash.focusName)}<br><span class="muted">${escapeHtml(String(dash.focusScore))}% • ${escapeHtml(dash.focusLabel)}</span></div>
        <div><b>Financial Health</b><br>${escapeHtml(String(dash.healthScore))}/100 • ${escapeHtml(dash.healthLabel)}</div>
        <div><b>Credit</b><br>${escapeHtml(String(dash.credit))}</div>
        <div><b>Active Payments</b><br>${escapeHtml(String(dash.obligations))} • ${escapeHtml(money(dash.obligationTotal))}/mo</div>
        <div><b>Unlock Board</b><br>Apt ${escapeHtml(dash.unlocks.apartment)} • Car ${escapeHtml(dash.unlocks.car)} • Loan ${escapeHtml(dash.unlocks.loan)}</div>
      </div>
      <div class="impact-box"><b>Scenario Reason Preview</b><br>${escapeHtml(getScenarioReasonText())}</div>
      <div class="impact-box"><b>Discussion Prompt</b><br>${escapeHtml(tool.discussionPrompt || 'No prompt loaded.')}</div>
      ${cfg.showHiddenNotes ? `<div class="impact-box"><b>Hidden Teaching Note</b><br>${escapeHtml(tool.hiddenTeachingNote || 'No hidden teaching note loaded.')}</div>` : ''}
      <div class="impact-box"><b>Vocabulary Callouts</b><br>${vocab || '<span class="muted">No vocabulary callouts loaded.</span>'}</div>
      <div class="impact-box"><b>Reflection Checkpoint</b><br>${escapeHtml(tool.reflectionCheckpoint || 'No reflection checkpoint loaded.')}</div>
      <div class="impact-box"><b>Teacher Prompt</b><br>What would you tell a friend to do here?</div>
      <div class="impact-box"><b>Recent Reflection Tracker</b><ul>${recentReflections}</ul></div>
      ${reflectionBankHtml}
      ${cfg.showDelayedTracker ? `<div class="impact-box"><b>Visible Delayed Consequence Tracking</b><ul>${trackRows}</ul><div style="height:8px"></div><b>Pending Chain Items</b><ul>${pendingRows}</ul></div>` : ''}
      ${cfg.showRubric ? `<div class="impact-box"><b>Score / Rubric Notes</b><ul>${rubric}</ul></div>` : ''}
      ${eliteList}
    </div>`;
}

/* Render all */
function renderAll(){
  renderHeader();
  renderJob();
  renderLedger();
  renderProgress();
  renderCDStatus();
  renderMeters();
  renderSheet();
  renderTeacherToolkit();
  renderConsequenceTimeline();
  updateImpactStrip();
  applyLockRules();
  if(!state.mission.active){
    if(state.plan.lockedForYear && !state.jobLocked){
      guideWantsStep();
    } else {
      guidePreStart();
    }
    refreshPreMissionPulse();
  }
  if(state.currentMode && $("modeSelectScreen") && $("modeSelectScreen").style.display !== "flex") scheduleAutoSave(250);
}

/* INIT */
populateContracts();
applyBudgetModel(state.plan.model || "rule702010");
wire();
renderAll();
renderReflectionReport();
renderSharedProfileBadge();
refreshSaveStatus();
ensureTeacherModeMenu();
bindRoleDifficultyMenu();
if(window.__WGLT_PENDING_MODE__){ const p = window.__WGLT_PENDING_MODE__; delete window.__WGLT_PENDING_MODE__; selectConfiguration(p.role, p.experience); }

/* Notify Wix loader that the HTML game is ready */
window.addEventListener("load", function () {
  if (window.parent) {
    window.parent.postMessage({ type: "WGLT_READY" }, "*");
  }
});


function openMonthlyReflectionPrompt(monthName){
  const cfg = getModeConfig();
  if(!cfg.requireMonthlyReflection) return;
  openHtmlModal({
    title:`🧠 ${cfg.name} Reflection Check`,
    meta:`${monthName} monthly checkpoint`,
    html:`<div style="font-weight:900;line-height:1.45">Before moving deeper into ${cfg.name}, capture a quick reflection for <b>${monthName}</b>.<br><br>Use the prompt below in the Reflection tool:
<br><br><i>What money choice helped you most this month, what mistake cost you flexibility, and what will you change next month?</i></div>`,
    buttons:[
      {label:"Open Reflection Tool", kind:"primary", onClick:()=>{ closeHtmlModal(); openReflectionPrompt(); }},
      {label:"Later", kind:"secondary", onClick:()=>{ closeHtmlModal(); }}
    ]
  });
}

document.addEventListener('DOMContentLoaded', ()=>{ updateModeBadge(); bindRoleDifficultyMenu(); });


function openReflectionPrompt(){
  openTeacherReflectionModal();
}


/* ============================================================
   PHASE 3 JSON SCENARIO ENGINE
   Reads scenario-index + foundation packs, filters by mode/job/step/focus,
   picks weighted random scenarios, and queues delayed hooks.
   ============================================================ */

const SCENARIO_INDEX = APP_DATA.scenarioIndex || null;
const FOUNDATION_SCENARIO_PACKS = {
  real_life: APP_DATA.scenarioRealLifeFoundation || [],
  financial: APP_DATA.scenarioFinancialFoundation || [],
  opportunity: APP_DATA.scenarioOpportunityFoundation || [],
  elite_credit: APP_DATA.scenarioEliteCreditFoundation || []
};
const FOUNDATION_CONSEQUENCE_MAP = APP_DATA.consequenceMapFoundation || { hooks:[] };

function ensureScenarioFoundationState(){
  if(!state.scenarioFoundation){
    state.scenarioFoundation = {
      playedById: {},
      lastPlayedStep: {},
      categoryHistory: {},
      hookHistory: {},
      runCount: 0
    };
  }
  if(!state.scenarioFoundation.playedById) state.scenarioFoundation.playedById = {};
  if(!state.scenarioFoundation.lastPlayedStep) state.scenarioFoundation.lastPlayedStep = {};
  if(!state.scenarioFoundation.categoryHistory) state.scenarioFoundation.categoryHistory = {};
  if(!state.scenarioFoundation.hookHistory) state.scenarioFoundation.hookHistory = {};
  return state.scenarioFoundation;
}

function getScenarioFoundationModeTags(){
  const tags = [];
  tags.push(isEliteExperience() ? 'elite' : 'standard');
  if(isTeacherRole()) tags.push(isEliteExperience() ? 'teacher_elite' : 'teacher_standard');
  return tags;
}

function getScenarioFoundationFocusIds(){
  const goal = getCurrentWeeklyGoal ? getCurrentWeeklyGoal() : null;
  const map = { save:'build_savings', credit:'protect_credit', income:'grow_job_income', wants:'control_wants' };
  const out = [];
  if(goal && goal.id && map[goal.id]) out.push(map[goal.id]);
  if(goal && goal.id) out.push(goal.id);
  return out;
}

function getScenarioFoundationCurrentStep(){
  return Number((state.weekEngine && state.weekEngine.week) || 1);
}

function getScenarioFoundationCurrentJobIds(){
  const ids = ['all'];
  try{
    const job = (state.jobs && state.jobs[state.jobIndex]) || (JOBS && JOBS[state.jobIndex]) || null;
    if(job && job.id) ids.push(String(job.id));
  }catch(err){}
  return ids;
}

function getScenarioFoundationPacksByCategory(category){
  const pack = FOUNDATION_SCENARIO_PACKS[category];
  return Array.isArray(pack) ? pack.slice() : [];
}

function scenarioFoundationBlockedByRepeat(scenario, step){
  const sf = ensureScenarioFoundationState();
  const rule = scenario.repeat_rule || {};
  const cooldown = Number(rule.cooldown_steps || 0);
  const maxUses = Number(rule.max_uses_per_year || 999);
  const count = Number(sf.playedById[scenario.id] || 0);
  const last = Number(sf.lastPlayedStep[scenario.id] || 0);
  if(count >= maxUses) return true;
  if(last && cooldown > 0 && (step - last) < cooldown) return true;
  return false;
}

function scenarioFoundationMatches(scenario, category){
  const step = getScenarioFoundationCurrentStep();
  const modeTags = getScenarioFoundationModeTags();
  const focusIds = getScenarioFoundationFocusIds();
  const jobIds = getScenarioFoundationCurrentJobIds();
  if(category && String(scenario.category || '') !== String(category)) return false;
  if(Array.isArray(scenario.mode) && scenario.mode.length && !scenario.mode.some(m => modeTags.includes(m))) return false;
  if(Array.isArray(scenario.jobs) && scenario.jobs.length && !scenario.jobs.some(j => jobIds.includes(j))) return false;
  const tr = scenario.triggers || {};
  if(Number(tr.min_step || 1) > step) return false;
  if(Number(tr.max_step || 48) < step) return false;
  if(Array.isArray(tr.requires) && tr.requires.length){
    for(const req of tr.requires){
      if(req === 'elite_mode' && !isEliteExperience()) return false;
      if(req === 'teacher_role' && !isTeacherRole()) return false;
    }
  }
  if(Array.isArray(tr.blocks_if) && tr.blocks_if.length){
    if(tr.blocks_if.includes('contract_already_active') && Array.isArray(state.activeContracts) && state.activeContracts.length) return false;
    if(tr.blocks_if.includes('loan_already_active') && Array.isArray(state.elite?.obligations) && state.elite.obligations.some(o => /loan/i.test(String(o.type || '')))) return false;
    if(tr.blocks_if.includes('already_used_recently') && scenarioFoundationBlockedByRepeat(scenario, step)) return false;
  }
  if(scenarioFoundationBlockedByRepeat(scenario, step)) return false;
  return true;
}

function getScenarioFoundationWeight(scenario){
  let weight = Math.max(1, Number(scenario.weight || 1));
  const tr = scenario.triggers || {};
  const focusIds = getScenarioFoundationFocusIds();
  if(Array.isArray(tr.monthly_focus_bonus) && tr.monthly_focus_bonus.some(f => focusIds.includes(f))){
    weight += 3;
  }
  const sf = ensureScenarioFoundationState();
  const category = String(scenario.category || 'misc');
  const recent = sf.categoryHistory[category] || [];
  if(recent.length){
    weight = Math.max(1, weight - recent.length);
  }
  return weight;
}

function pickWeightedScenarioFoundation(candidates){
  if(!candidates.length) return null;
  const weighted = candidates.map(sc => ({ scenario: sc, weight: getScenarioFoundationWeight(sc) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for(const item of weighted){
    if(roll < item.weight) return item.scenario;
    roll -= item.weight;
  }
  return weighted[0].scenario;
}

function markScenarioFoundationPlayed(scenario){
  const sf = ensureScenarioFoundationState();
  const step = getScenarioFoundationCurrentStep();
  sf.playedById[scenario.id] = Number(sf.playedById[scenario.id] || 0) + 1;
  sf.lastPlayedStep[scenario.id] = step;
  const category = String(scenario.category || 'misc');
  if(!Array.isArray(sf.categoryHistory[category])) sf.categoryHistory[category] = [];
  sf.categoryHistory[category].push(step);
  sf.categoryHistory[category] = sf.categoryHistory[category].slice(-3);
  sf.runCount = Number(sf.runCount || 0) + 1;
}

function getConsequenceHookDefinition(hookId){
  const hooks = Array.isArray(FOUNDATION_CONSEQUENCE_MAP.hooks) ? FOUNDATION_CONSEQUENCE_MAP.hooks : [];
  return hooks.find(h => h.hook === hookId) || null;
}

function getScenarioHookDelay(hookId){
  const map = {
    fatigue_chain: 2,
    low_energy_risk: 1,
    late_fee_chain: 1,
    monthly_contract_charge: 4,
    loan_payment_cycle: 4,
    steady_growth: 4,
    locked_growth: 8,
    budget_squeeze: 1,
    social_tension_minor: 1,
    apartment_approval_path: 2
  };
  return Number(map[hookId] || 2);
}

function applyScenarioFoundationEffects(effects){
  if(!effects || typeof effects !== 'object') return;
  ensureStandardV1State();
  ensureEliteState && ensureEliteState();

  for(const [key, rawVal] of Object.entries(effects)){
    const val = Number(rawVal || 0);
    if(!Number.isFinite(val)) continue;
    if(key === 'checking'){
      state.bank.checking = Math.max(0, Number(state.bank.checking || 0) + val);
      if(val < 0) state.ledger.weekExpenses = Number(state.ledger.weekExpenses || 0) + Math.abs(val);
      if(val > 0) state.ledger.weekIncome = Number(state.ledger.weekIncome || 0) + val;
    } else if(key === 'savings'){
      state.bank.savings = Math.max(0, Number(state.bank.savings || 0) + val);
    } else if(key === 'cd_balance'){
      if(typeof addCdFromScenarioFoundation === 'function') addCdFromScenarioFoundation(val);
      else state.bank.savings = Math.max(0, Number(state.bank.savings || 0) + val);
    } else if(key === 'loan_balance'){
      state.elite.loanBalance = Math.max(0, Number(state.elite.loanBalance || 0) + val);
    } else if(key === 'credit_score' || key === 'credit'){
      state.credit = Math.max(300, Math.min(850, Number(state.credit || 650) + val));
    } else if(key === 'health_score'){
      state.standardV1.healthScore = Math.max(0, Math.min(100, Number(state.standardV1.healthScore || computeFinancialHealth().score || 50) + val));
    } else if(key === 'active_contracts'){
      state.scenarioFoundation.activeContracts = Math.max(0, Number(state.scenarioFoundation.activeContracts || 0) + val);
    } else {
      if(state.scenarioFoundation == null) state.scenarioFoundation = {};
      state.scenarioFoundation[key] = Number(state.scenarioFoundation[key] || 0) + val;
    }
  }
}

function addCdFromScenarioFoundation(amount){
  const principal = Math.max(0, Math.round(Number(amount || 0)));
  if(principal <= 0) return;
  if(!Array.isArray(state.bank.cds)) state.bank.cds = [];
  state.bank.cds.push({
    id: 'scenario_cd_' + Date.now(),
    name: 'Scenario CD',
    principal,
    accrued: 0,
    apr: 4,
    monthsLeft: 6
  });
}

function queueScenarioFoundationHooks(hookIds, sourceLabel){
  if(!Array.isArray(hookIds) || !hookIds.length) return;
  if(!state.weekEngine) initWeekEngine();
  const currentWeek = Number(state.weekEngine.week || 1);
  hookIds.forEach(hookId => {
    const def = getConsequenceHookDefinition(hookId);
    const delay = getScenarioHookDelay(hookId);
    const triggerWeek = Math.min(48, currentWeek + delay);
    const entry = {
      triggerWeek,
      id: hookId,
      label: def ? def.title : hookId,
      major: !!(def && def.popup_text),
      apply: (st)=>{
        if(def && def.effects){
          if(def.effects.checking) st.bank.checking = Math.max(0, Number(st.bank.checking || 0) + Number(def.effects.checking || 0));
          if(def.effects.savings) st.bank.savings = Math.max(0, Number(st.bank.savings || 0) + Number(def.effects.savings || 0));
          if(def.effects.cd_balance && Array.isArray(st.bank.cds) && st.bank.cds.length){
            st.bank.cds[0].principal = Math.max(0, Number(st.bank.cds[0].principal || 0) + Number(def.effects.cd_balance || 0));
          }
          if(def.effects.health_score){
            ensureStandardV1State();
            st.standardV1.healthScore = Math.max(0, Math.min(100, Number(st.standardV1.healthScore || 50) + Number(def.effects.health_score || 0)));
          }
        }
        if(def && Number(def.credit_effect || 0)){
          st.credit = Math.max(300, Math.min(850, Number(st.credit || 650) + Number(def.credit_effect || 0)));
        }
        if(def && def.ledger_note) addLedgerLine(def.ledger_note);
        return def && def.popup_text ? def.popup_text : ((def && def.title) || 'A delayed consequence landed.');
      }
    };
    queueConsequenceObject(entry, sourceLabel || hookId);
  });
}

function runScenarioFoundationCategory(category, fallbackFn){
  const pack = getScenarioFoundationPacksByCategory(category);
  if(!pack.length) return fallbackFn ? fallbackFn() : showBanner('No scenario pack loaded.');
  const candidates = pack.filter(sc => scenarioFoundationMatches(sc, category));
  const picked = pickWeightedScenarioFoundation(candidates);
  if(!picked) return fallbackFn ? fallbackFn() : showBanner('No matching scenario this step.');
  markScenarioFoundationPlayed(picked);
  const buttons = (picked.choices || []).map((choice, idx) => ({
    id: 'choice_' + idx,
    label: choice.label,
    kind: idx === 0 ? 'primary' : 'secondary'
  }));
  const meta = `Step ${getScenarioFoundationCurrentStep()} • ${picked.title}`;
  openModal({
    title: `${category === 'real_life' ? '👥 Life Scenario' : category === 'financial' ? '⚠️ Financial Decision' : category === 'opportunity' ? '💼 Job Opportunity' : '💳 Elite Credit Scenario'}`,
    meta,
    body: picked.prompt,
    buttons,
    onPick: (id)=>{
      const idx = Number(String(id).replace('choice_',''));
      const choice = (picked.choices || [])[idx];
      if(!choice) return;
      applyScenarioFoundationEffects(choice.immediate_effects || {});
      queueScenarioFoundationHooks(choice.delayed_hooks || [], `${picked.title} → ${choice.label}`);
      if(choice.ledger_note) addLedgerLine(choice.ledger_note);
      renderAll();
      const follow = `${choice.ledger_note ? choice.ledger_note + '\n\n' : ''}${choice.reflection_tag ? 'Focus tag: ' + choice.reflection_tag : 'Decision recorded.'}`;
      openModal({
        title: 'Decision recorded',
        meta: picked.title,
        body: follow,
        buttons:[{id:'ok',label:'Continue',kind:'primary'}],
        onPick: ()=> {
          renderAll();
          notifyAction && notifyAction(category === 'opportunity' ? 'job_event' : 'weekly');
        }
      });
    }
  });
}

const __legacyRunLifeScenarioDecision = runLifeScenarioDecision;
const __legacyRunFinancialDecision = runFinancialDecision;
const __legacyRunJobRealLifeEvent = runJobRealLifeEvent;

function runLifeScenarioDecision(){
  return runScenarioFoundationCategory('real_life', __legacyRunLifeScenarioDecision);
}
function runFinancialDecision(){
  const useEliteCredit = isEliteExperience() && Math.random() < 0.25;
  return runScenarioFoundationCategory(useEliteCredit ? 'elite_credit' : 'financial', __legacyRunFinancialDecision);
}
function runJobRealLifeEvent(){
  return runScenarioFoundationCategory('opportunity', __legacyRunJobRealLifeEvent);
}
