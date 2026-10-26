'use strict';

const STORAGE_KEY = 'imagine-events-desk-platform-v1';
const categoryNames = { participant:'Participant', vip:'VIP', speaker:'Intervenant', press:'Presse', team:'Équipe' };
const defaultStore = { events:[], trashEvents:[], activeEventId:'', peopleByEvent:{}, cursorByEvent:{}, queueByEvent:{}, pricesByEvent:{}, badgeTemplatesByEvent:{}, trashCountByEvent:{}, trashByEvent:{}, deviceId:'', cachedUser:null, authCachedAt:0, logoutPending:false };
function loadStore(){
  try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(saved&&typeof saved==='object') return {...defaultStore,...saved,events:Array.isArray(saved.events)?saved.events:[],peopleByEvent:saved.peopleByEvent||{},cursorByEvent:saved.cursorByEvent||{},queueByEvent:saved.queueByEvent||{},pricesByEvent:saved.pricesByEvent||{},deviceId:saved.deviceId||''}; }
  catch(e){ console.warn('Cache locale non disponible.',e); }
  return {...defaultStore};
}
let store=loadStore();
let currentPage='home';
let authUser=null;
let pollTimer=null;
let peopleFilter='all';
let peopleQuery='';
let badgeQuery='';
let apiOnline=false;
let eventsRefreshing=false;
const participantRefreshes=new Set();
const syncLocks=new Set();
let lastEventsRefresh=0;
let toastTimer;
if(!store.deviceId) store.deviceId=makeId('device');
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
function makeId(prefix='id'){
  let value='';
  try{ value=crypto.randomUUID(); }catch(e){ value=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
  return `${prefix}-${value}`;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function norm(v){return String(v??'').trim().toLocaleLowerCase('fr');}
function icon(name,size=16){
  const g={
    home:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
    people:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    badge:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 10h4M7 14h2M15 10h2M15 14h2"/>',
    chart:'<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    upload:'<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/>',
    download:'<path d="M12 4v12m0 0 5-5m-5 5-5-5"/><path d="M4 20h16"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    printer:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/><path d="M18 12h.01"/>',
    pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    spark:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1 2.5 2 1-2 1-1 2.5-1-2.5-2-1 2-1 1-2.5Z"/>',
    eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    x:'<path d="m18 6-12 12M6 6l12 12"/>',
    cloud:'<path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.3 1.8A3.7 3.7 0 0 0 7 16.6h11"/><path d="m12 12-3 3m3-3 3 3m-3-3v8"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    cash:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
    rotate:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g[name]||g.info}</svg>`;
}
function renderStaticIcons(){ $$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);}); }
function saveStore(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch(e){try{const trimmed={...store,badgeTemplatesByEvent:{}};localStorage.setItem(STORAGE_KEY,JSON.stringify(trimmed));console.warn('Visuels de badge trop lourds pour le cache local : ils restent en mémoire et sur le serveur.',e);}catch(inner){console.warn('Impossible d’enregistrer le cache local.',inner);}}}
function getEvent(id=store.activeEventId){return store.events.find(e=>String(e.id)===String(id))||null;}
function getPeople(eventId=store.activeEventId){if(!eventId)return []; if(!Array.isArray(store.peopleByEvent[eventId]))store.peopleByEvent[eventId]=[];return store.peopleByEvent[eventId].filter(person=>!person.deletedAt);}
function getQueue(eventId=store.activeEventId){if(!eventId)return [];if(!Array.isArray(store.queueByEvent[eventId]))store.queueByEvent[eventId]=[];return store.queueByEvent[eventId];}
function findPerson(id,eventId=store.activeEventId){return getPeople(eventId).find(p=>String(p.id)===String(id));}
function displayCategory(key){return categoryNames[key]||'Participant';}
function categoryClass(key){return ['vip','speaker','press','team'].includes(key)?key:'participant';}
const paymentStatusNames={paid:'Payé',unpaid:'Non payé',exempt:'Exonéré'};
const paymentMethodNames={cash:'Espèces',card:'Carte bancaire',transfer:'Virement',cheque:'Chèque',mobile:'Paiement mobile',other:'Autre'};
const PAYMENT_METHOD_OPTIONS=['cash','card','transfer','cheque','mobile','other'];
function eventCurrency(event=getEvent()){const code=String(event?.currency||'TND').toUpperCase();return /^[A-Z]{3}$/.test(code)?code:'TND';}
function money(value,event=getEvent()){const n=Number(value||0),safe=Number.isFinite(n)?n:0;const digits=Number.isInteger(safe)?0:3;return `${new Intl.NumberFormat('fr-TN',{minimumFractionDigits:digits,maximumFractionDigits:3}).format(safe)} ${eventCurrency(event)}`;}
function paymentOf(p){const status=['paid','exempt'].includes(p?.paymentStatus)?p.paymentStatus:'unpaid';return {status,amount:Number(p?.paymentAmount||0),method:p?.paymentMethod||'',reference:p?.paymentReference||'',tariff:p?.paymentTariff||'',at:p?.paymentConfirmedAt||'',by:p?.paymentConfirmedBy||''};}
function needsPayment(p){return paymentOf(p).status==='unpaid';}
function pricesForEvent(eventId=store.activeEventId){const list=store.pricesByEvent?.[eventId];return Array.isArray(list)?list:[];}
function activePrices(eventId=store.activeEventId){return pricesForEvent(eventId).filter(pr=>pr.active!==false);}
function priceById(id,eventId=store.activeEventId){return pricesForEvent(eventId).find(pr=>String(pr.id)===String(id))||null;}
async function loadPrices(eventId=store.activeEventId,silent=true){
  if(!eventId||!navigator.onLine)return pricesForEvent(eventId);
  try{const data=await api(`/api/events/${encodeURIComponent(eventId)}/prices`);store.pricesByEvent=store.pricesByEvent||{};store.pricesByEvent[eventId]=Array.isArray(data.prices)?data.prices:[];saveStore();return store.pricesByEvent[eventId];}
  catch(error){if(!silent)showToast(error.message||'Impossible de charger la grille tarifaire.');return pricesForEvent(eventId);}
}
function priceButtonLabel(price){return `${money(Number(price.amount||0))} · ${price.label}`;}
function paymentChipHTML(p){const pay=paymentOf(p);const amount=pay.status==='paid'&&pay.amount>0?` · ${money(pay.amount)}`:'';return `<button class="pay-badge ${pay.status}" type="button" data-action="payment" data-id="${esc(p.id)}" title="Confirmer ou modifier le paiement">${icon('cash',10)}${esc(paymentStatusNames[pay.status])}${esc(amount)}</button>`;}
function dateTimeLabel(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('fr-TN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();}
function localTime(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('fr-TN',{hour:'2-digit',minute:'2-digit'}).format(d);}
function dateLabel(value){if(!value)return 'Date à préciser';const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?'Date à préciser':new Intl.DateTimeFormat('fr-TN',{day:'numeric',month:'long',year:'numeric'}).format(d);}
function makeStats(eventId=store.activeEventId){const list=getPeople(eventId);const arrived=list.filter(p=>p.checkedIn).length;const paidList=list.filter(p=>paymentOf(p).status==='paid');const collected=paidList.reduce((total,p)=>total+paymentOf(p).amount,0);return {total:list.length,arrived,pending:list.length-arrived,percent:list.length?Math.round(arrived/list.length*100):0,special:list.filter(p=>['vip','speaker'].includes(p.category)).length,paid:paidList.length,collected:Math.round(collected*1000)/1000,toPay:list.filter(p=>paymentOf(p).status==='unpaid').length,exempt:list.filter(p=>paymentOf(p).status==='exempt').length};}
function pendingTotal(){return Object.values(store.queueByEvent||{}).reduce((n,q)=>n+(Array.isArray(q)?q.length:0),0);}
function updateStatus(){
  const el=$('#syncStatus');if(!el)return;
  const n=pendingTotal();el.className='sync-status';
  let text='';
  if(n){el.classList.add('pending');text=`${n} action${n===1?'':'s'} à synchroniser`;}
  else if(apiOnline&&navigator.onLine){el.classList.add('online');text='En ligne · synchronisé';}
  else{text='Hors ligne · mode secours';el.classList.add('offline');}
  el.innerHTML=`<i></i><span>${esc(text)}</span>`;
  const footer=$('#footerSync');if(footer)footer.textContent=n?`${n} action${n===1?'':'s'} en attente de synchronisation.`:'Les données restent séparées par congrès.';
}
async function api(path,options={}){
  const headers={...(options.headers||{})};
  if(options.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
  let response;
  try{response=await fetch(path,{...options,headers,cache:'no-store',credentials:'same-origin'});}catch(error){apiOnline=false;updateStatus();throw new Error('Serveur injoignable. Les actions de check-in restent enregistrées sur cet appareil.');}
  let data={};try{data=await response.json();}catch(e){}
  if(response.status===401&&!String(path).startsWith('/api/auth/')){apiOnline=false;authUser=null;store.cachedUser=null;store.authCachedAt=0;saveStore();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}showAuthScreen('login','Votre session a expiré. Reconnectez-vous.');}
  if(!response.ok){const error=new Error(data.error||`Erreur serveur (${response.status}).`);error.status=response.status;throw error;}
  apiOnline=true;updateStatus();return data;
}
function chooseActiveEvent(){
  if(store.activeEventId&&store.events.some(e=>e.id===store.activeEventId))return;
  const active=store.events.find(e=>e.status!=='archived');
  store.activeEventId=(active||store.events[0])?.id||'';
}
function renderEventSelect(){
  const select=$('#eventSelect');if(!select)return;
  const options=store.events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}${e.status==='archived'?' · Archivé':''}</option>`).join('');
  select.innerHTML=options||'<option value="">Aucun congrès créé</option>';
  select.disabled=!store.events.length;select.value=store.activeEventId||'';
}
const pageMeta={
  home:{eyebrow:'ACCUEIL · SUIVI EN DIRECT',title:'Desk d’accueil',description:'Suivez les arrivées et gérez votre point d’accueil pour ce congrès.'},
  people:{eyebrow:'INSCRIPTIONS · CHECK-IN',title:'Participants',description:'Recherchez un inscrit, confirmez sa présence et consultez son badge.'},
  badges:{eyebrow:'PRÉPARATION · IMPRESSION',title:'Badges',description:'Prévisualisez les badges nominaux et lancez leur impression.'},
  reports:{eyebrow:'SUIVI · EXPORT',title:'Rapports',description:'Consultez la fréquentation et exportez la liste de présence.'},
  events:{eyebrow:'IMAGINE EVENTS · PORTFOLIO',title:'Mes congrès',description:'Créez un espace distinct pour chaque événement et retrouvez son historique.'}
};
function headAction(){
  const admin=authUser?.role==='admin';
  if(currentPage==='events')return admin?`<button class="btn btn-primary" data-action="new-event">${icon('plus')}Créer un congrès</button>`:'';
  if(!getEvent())return admin?`<button class="btn btn-primary" data-action="new-event">${icon('plus')}Créer mon premier congrès</button>`:'';
  if(currentPage==='people')return `${admin?`<button class="btn btn-secondary" data-action="import-csv">${icon('upload')}Importer CSV / Excel</button>`:''}<button class="btn btn-primary" data-action="add-person">${icon('plus')}Ajouter participant</button>`;
  if(currentPage==='badges')return authUser?.role==='admin'?`<button class="btn btn-secondary" data-action="templates">${icon('file')}Modèles CSV / Excel</button>`:'';
  if(currentPage==='reports')return `<button class="btn btn-primary" data-action="export">${icon('download')}Exporter CSV</button>`;
  return `<button class="btn btn-primary" data-action="go-people">${icon('people')}Gérer les participants</button>`;
}
function updateRoleControls(){
  const user=authUser,admin=user?.role==='admin';
  const identity=$('#userIdentity');if(identity)identity.textContent=user?`${user.username} · ${admin?'Admin':'Desk'}`:'';
  const accounts=$('#accountsButton');if(accounts)accounts.hidden=!admin;
  const settings=$('#settingsButton');if(settings)settings.hidden=!admin;
  const newEvent=$('#newEventButton');if(newEvent)newEvent.hidden=!admin;
  const logout=$('#logoutButton');if(logout)logout.hidden=!user;
  const app=$('#appRoot');if(app)app.hidden=!user;
}
function renderHead(){
  let info=pageMeta[currentPage]||pageMeta.home;
  if(!getEvent()&&currentPage!=='events')info={eyebrow:'BIENVENUE · IMAGINE EVENTS',title:'Votre espace congrès',description:'Créez un événement pour préparer votre accueil, importer la liste et ouvrir le desk sur plusieurs postes.'};
  $('#pageHead').innerHTML=`<div><div class="eyebrow">${esc(info.eyebrow)}</div><h1>${esc(info.title)}</h1><p>${esc(info.description)}</p></div><div class="heading-actions">${headAction()}</div>`;
}
function noticeHTML(kind,text,button='') {return `<div class="notice ${kind||''}">${icon(kind==='warning'?'info':'cloud')}<span>${text}</span>${button}</div>`;}
function render(){
  const active=document.activeElement;const focusId=active&&active.id?active.id:'';let selectionStart=null;try{selectionStart=active?.selectionStart;}catch(e){}
  chooseActiveEvent();updateRoleControls();renderStaticIcons();renderEventSelect();
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===currentPage));
  renderHead();
  const content=$('#appContent');
  if(currentPage==='events')content.innerHTML=renderEvents();
  else if(!getEvent())content.innerHTML=renderOnboarding();
  else if(currentPage==='home')content.innerHTML=renderHome();
  else if(currentPage==='people'){content.innerHTML=renderPeople();renderPeopleRows();}
  else if(currentPage==='badges')content.innerHTML=renderBadges();
  else content.innerHTML=renderReports();
  updateStatus();
  if(focusId){const next=document.getElementById(focusId);if(next){next.focus({preventScroll:true});try{if(selectionStart!==null)next.setSelectionRange(selectionStart,selectionStart);}catch(e){}}}
}
function renderOnboarding(){
  const admin=authUser?.role==='admin';
  const eventCards=store.events.length?`<div class="empty-events">Vous avez déjà ${store.events.length} congrès enregistré${store.events.length===1?'':'s'}. Choisissez-en un dans la barre supérieure ou ouvrez « Mes congrès ».</div>`:'';
  const createButton=admin?`<button class="btn btn-primary" type="button" data-action="new-event">${icon('plus')}Créer un congrès</button>`:`<div class="empty-events">Aucun événement n’est encore ouvert. Demandez à l’administrateur de créer le congrès et de vous donner l’accès.</div>`;
  return `<div class="onboarding"><div><div class="event-kicker">Un même outil · des événements séparés</div><h2>Préparez votre prochain congrès, puis réutilisez le desk à volonté.</h2><p>Chaque congrès aura sa propre liste d’inscrits, ses catégories, ses réglages et son rapport. Les postes connectés au même serveur partageront les arrivées en temps réel ; si la connexion tombe, le desk garde les check-ins en attente sur l’appareil.</p>${createButton}${eventCards}</div><div class="onboarding-steps"><div class="onboarding-step"><b>1</b><span>Créez un événement avec son nom, sa date et son lieu.</span></div><div class="onboarding-step"><b>2</b><span>Importez votre fichier CSV ou Excel (.xlsx), ou ajoutez des inscrits.</span></div><div class="onboarding-step"><b>3</b><span>Ouvrez le desk sur les postes de votre équipe.</span></div><div class="onboarding-step"><b>4</b><span>Exportez le rapport après l’événement.</span></div></div></div>`;
}
function renderHome(){
  const event=getEvent(),stats=makeStats(),people=getPeople();const eventConfigButton=authUser?.role==='admin'?`<button class="btn btn-secondary" type="button" data-action="edit-event" data-id="${esc(event.id)}">Paramètres ${icon('arrow',12)}</button>`:'';
  const recent=people.filter(p=>p.checkedIn).slice().sort((a,b)=>String(b.checkedInAt||'').localeCompare(String(a.checkedInAt||''))).slice(0,5);
  const cats=['participant','vip','speaker','press','team'];
  const categories=cats.map(c=>{const list=people.filter(p=>(p.category||'participant')===c);if(!list.length)return '';const arrived=list.filter(p=>p.checkedIn).length;const pct=Math.round(arrived/list.length*100);return `<div class="presence-row"><div class="presence-label"><i class="presence-dot ${categoryClass(c)}"></i>${esc(displayCategory(c))}</div><span class="presence-number">${arrived} / ${list.length}</span><div class="progress"><i class="${categoryClass(c)}" style="width:${pct}%"></i></div></div>`;}).join('');
  const offline=(!apiOnline||!navigator.onLine||pendingTotal())?noticeHTML('warning',`<strong>Mode de secours actif.</strong> Les arrivées faites sur cet appareil restent en file d’attente et seront envoyées au serveur dès que la connexion revient. ${pendingTotal()?`<strong>${pendingTotal()} action(s)</strong> en attente.`:''}`):noticeHTML('',`<strong>Postes synchronisés.</strong> Les appareils connectés au même serveur reçoivent les arrivées des autres desks automatiquement.`);
  return `${offline}<section class="event-hero"><div class="event-hero-main"><div class="event-hero-icon">${icon('spark',24)}</div><div><div class="event-kicker">ÉVÉNEMENT ACTIF${event.status==='archived'?' · ARCHIVÉ':''}</div><h2>${esc(event.name)}</h2><div class="event-meta"><span>${icon('calendar',13)}${esc(dateLabel(event.date))}</span><span>${icon('pin',13)}${esc(event.venue||'Lieu à préciser')}</span></div></div></div>${eventConfigButton}</section>
  <section class="stats-grid"><article class="stat-card"><div class="stat-top"><span class="stat-label">Participants inscrits</span><span class="stat-icon teal">${icon('people')}</span></div><div class="stat-value">${stats.total}</div><div class="stat-foot">Dans la liste de ce congrès</div></article><article class="stat-card"><div class="stat-top"><span class="stat-label">Arrivées confirmées</span><span class="stat-icon blue">${icon('check')}</span></div><div class="stat-value">${stats.arrived}</div><div class="stat-foot"><span class="accent">${stats.percent}%</span> des inscrits accueillis</div></article><article class="stat-card"><div class="stat-top"><span class="stat-label">À accueillir</span><span class="stat-icon amber">${icon('clock')}</span></div><div class="stat-value">${stats.pending}</div><div class="stat-foot">En attente de check-in</div></article><article class="stat-card"><div class="stat-top"><span class="stat-label">VIP & intervenants</span><span class="stat-icon violet">${icon('spark')}</span></div><div class="stat-value">${stats.special}</div><div class="stat-foot">Accueil prioritaire</div></article><article class="stat-card"><div class="stat-top"><span class="stat-label">Paiements confirmés</span><span class="stat-icon green">${icon('cash')}</span></div><div class="stat-value compact">${stats.paid}<small> / ${stats.total}</small></div><div class="stat-foot"><span class="accent">${esc(money(stats.collected))}</span> encaissés · ${stats.toPay} à encaisser</div></article></section>
  <div class="lower-grid"><section class="card"><div class="card-head"><div><h2 class="card-title">Accueil express</h2><p class="card-subtitle">Saisissez un code badge, un e-mail ou un nom pour confirmer l’arrivée.</p></div><span class="status-badge ${apiOnline&&navigator.onLine?'arrived':'pending'}"><i></i>${apiOnline&&navigator.onLine?'Desk connecté':'Desk de secours'}</span></div><form class="quick-form" id="quickForm"><div class="search-wrap">${icon('search')}<input id="quickSearch" class="search-input" name="query" autocomplete="off" placeholder="Code badge, nom ou e-mail…" aria-label="Recherche rapide"></div><button class="btn btn-primary" type="submit" ${event.status==='archived'?'disabled':''}>${icon('check')}Confirmer</button></form><div class="recent-list"><div class="recent-head"><h3>Dernières arrivées</h3><button class="link-button" type="button" data-page="people">Voir la liste →</button></div>${recent.length?recent.map(p=>`<div class="recent-row"><span class="avatar">${esc(initials(p.name))}</span><span class="person-info"><strong>${esc(p.name)}</strong><small>${esc(displayCategory(p.category))} · ${esc(p.company||'—')}</small></span><span class="time-label">${esc(localTime(p.checkedInAt))}</span></div>`).join(''):'<div class="empty-state" style="padding:18px 8px">Aucune arrivée enregistrée pour le moment.</div>'}</div></section>
  <section><div class="card"><div class="card-head"><div><h2 class="card-title">Présence par catégorie</h2><p class="card-subtitle">Arrivées confirmées sur les inscrits</p></div></div><div class="presence-list">${categories||'<div class="empty-state" style="padding:18px 6px">Importez des inscrits pour voir la progression.</div>'}</div></div><div class="subtle-callout">${icon('info')}<span><strong>Conseil de fiabilité</strong><br>Gardez au moins un appareil en ligne, puis exportez une copie du rapport à la fin de chaque événement.</span></div></section></div>`;
}
function peopleFilterCounts(){const p=getPeople();return {all:p.length,pending:p.filter(x=>!x.checkedIn).length,arrived:p.filter(x=>x.checkedIn).length,unpaid:p.filter(x=>needsPayment(x)).length,paid:p.filter(x=>paymentOf(x).status==='paid').length,vip:p.filter(x=>x.category==='vip').length,speaker:p.filter(x=>x.category==='speaker').length};}
function renderPeople(){
  const counts=peopleFilterCounts();
  const filters=[['all','Tous',counts.all],['pending','À accueillir',counts.pending],['arrived','Arrivés',counts.arrived],['unpaid','Paiement à confirmer',counts.unpaid],['paid','Payés',counts.paid],['vip','VIP',counts.vip],['speaker','Intervenants',counts.speaker]];
  const trash=trashCount();
  const archived=getEvent()?.status==='archived';
  return `${pendingTotal()?noticeHTML('warning',`<strong>${pendingTotal()} action(s) hors ligne en attente.</strong> Elles seront synchronisées à la reconnexion.`):''}
  <div class="toolbar"><div class="search-wrap">${icon('search')}<input id="peopleSearch" class="search-input" value="${esc(peopleQuery)}" autocomplete="off" placeholder="Nom, e-mail, organisation ou code badge…" aria-label="Rechercher un participant"></div><span class="count-label" id="peopleCount"></span><button class="btn btn-secondary btn-sm trash-button" type="button" data-action="open-trash">${icon('trash',14)}Corbeille${trash?`<b class="trash-count">${trash}</b>`:''}</button></div>
  <div class="filters">${filters.map(([id,label,count])=>`<button class="filter ${peopleFilter===id?'active':''}" type="button" data-filter="${id}">${label}<b>${count}</b></button>`).join('')}</div>
  <div class="selection-bar" id="selectionBar" hidden><span id="selectionCount"></span><div class="selection-actions"><button class="btn btn-secondary btn-sm" type="button" data-action="clear-selection">Annuler la sélection</button><button class="btn btn-danger btn-sm" type="button" data-action="trash-selected" ${archived?'disabled':''}>${icon('trash',12)}Mettre à la corbeille</button></div></div>
  <section class="table-card"><div class="table-scroll"><table><thead><tr><th class="check-col"><input type="checkbox" id="peopleSelectAll" aria-label="Sélectionner tous les inscrits affichés"></th><th>Participant</th><th>Catégorie</th><th>Code badge</th><th>Statut</th><th>Paiement</th><th>Heure</th><th style="text-align:right">Actions</th></tr></thead><tbody id="peopleRows"></tbody></table></div></section>
  <div class="footnote">${icon('info')}<span>La recherche rapide accepte les codes que vos lecteurs USB/QR transmettent au champ. Les inscrits supprimés vont dans la <strong>corbeille</strong> du congrès : ils peuvent être restaurés, ou effacés définitivement par un administrateur.</span></div>`;
}
function filteredPeople(){const query=norm(peopleQuery);return getPeople().filter(p=>{const match=peopleFilter==='all'||(peopleFilter==='pending'&&!p.checkedIn)||(peopleFilter==='arrived'&&p.checkedIn)||(peopleFilter==='unpaid'&&needsPayment(p))||(peopleFilter==='paid'&&paymentOf(p).status==='paid')||p.category===peopleFilter;const hay=[p.name,p.email,p.company,p.code,displayCategory(p.category),paymentStatusNames[paymentOf(p).status]].join(' ').toLocaleLowerCase('fr');return match&&(!query||hay.includes(query));}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));}
function renderPeopleRows(){const tbody=$('#peopleRows');if(!tbody)return;const list=filteredPeople();const count=$('#peopleCount');if(count)count.textContent=`${list.length} résultat${list.length===1?'':'s'} · ${getPeople().length} inscrit${getPeople().length===1?'':'s'}`;if(!list.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state"><strong>${getPeople().length?'Aucun participant trouvé':'Votre liste est vide'}</strong>${getPeople().length?'Essayez une autre recherche ou un autre filtre.':'Importez un CSV/Excel (.xlsx) ou ajoutez un participant.'}</div></td></tr>`;refreshSelectionBar();return;}const archived=getEvent()?.status==='archived';tbody.innerHTML=list.map(p=>{const selected=peopleSelection.has(String(p.id));return `<tr class="${selected?'row-selected':''}"><td class="check-col"><input type="checkbox" data-select-id="${esc(p.id)}" ${selected?'checked':''} aria-label="Sélectionner ${esc(p.name)}"></td><td><div class="table-person"><span class="avatar">${esc(initials(p.name))}</span><span class="table-person-copy"><button type="button" data-action="details" data-id="${esc(p.id)}">${esc(p.name)}</button><small>${esc(p.email||p.company||'—')}</small></span></div></td><td><span class="cat-badge ${categoryClass(p.category)}">${esc(displayCategory(p.category))}</span></td><td><span class="code">${esc(p.code||'—')}</span></td><td><span class="status-badge ${p.checkedIn?'arrived':'pending'}"><i></i>${p.checkedIn?'Arrivé':'À accueillir'}</span></td><td>${paymentChipHTML(p)}</td><td>${p.checkedIn?`<span class="time-label">${esc(localTime(p.checkedInAt))}</span>`:'<span style="color:#c4cbd4">—</span>'}</td><td><div class="row-actions"><button class="icon-action" type="button" data-action="badge" data-id="${esc(p.id)}" title="Aperçu badge" aria-label="Aperçu badge">${icon('badge',13)}</button>${p.checkedIn?`<button class="table-action undo" type="button" data-action="undo" data-id="${esc(p.id)}">Annuler</button>`:`<button class="table-action" type="button" data-action="checkin" data-id="${esc(p.id)}" ${archived?'disabled':''}>${icon('check',12)}Confirmer</button>`}<button class="icon-action danger" type="button" data-action="trash-person" data-id="${esc(p.id)}" title="Mettre à la corbeille" aria-label="Mettre à la corbeille" ${archived?'disabled':''}>${icon('trash',13)}</button></div></td></tr>`;}).join('');refreshSelectionBar();}
function paymentRowsHTML(){
  const settled=getPeople().filter(p=>paymentOf(p).status!=='unpaid').slice().sort((a,b)=>String(b.paymentConfirmedAt||'').localeCompare(String(a.paymentConfirmedAt||'')));
  if(!settled.length)return '<tr><td colspan="8"><div class="empty-state">Aucun paiement confirmé pour le moment.</div></td></tr>';
  return settled.map(p=>{const pay=paymentOf(p);return `<tr><td>${esc(p.name)}</td><td><span class="pay-badge ${pay.status}">${icon('cash',10)}${esc(paymentStatusNames[pay.status])}</span></td><td>${pay.status==='paid'?esc(money(pay.amount)):'—'}</td><td>${esc(pay.tariff||'—')}</td><td>${esc(paymentMethodNames[pay.method]||'—')}</td><td>${esc(pay.reference||'—')}</td><td>${esc(pay.at?dateTimeLabel(pay.at):'—')}</td><td>${esc(pay.by||'—')}</td></tr>`;}).join('');
}
function tariffReportHTML(){
  const grid=pricesForEvent();
  const paid=getPeople().filter(p=>paymentOf(p).status==='paid');
  const groups=new Map();
  paid.forEach(p=>{const pay=paymentOf(p);const label=pay.tariff||'Montant libre';const entry=groups.get(label)||{label,count:0,total:0};entry.count+=1;entry.total+=pay.amount;groups.set(label,entry);});
  const rows=Array.from(groups.values()).sort((a,b)=>b.total-a.total);
  const gridLabels=new Set(grid.map(price=>price.label));
  const unused=grid.filter(price=>price.active&&!groups.has(price.label));
  const body=rows.length?rows.map(row=>`<tr><td>${esc(row.label)}${gridLabels.has(row.label)?'':' <span class="field-hint">(hors grille)</span>'}</td><td>${row.count}</td><td>${esc(money(row.total))}</td></tr>`).join(''):'<tr><td colspan="3"><div class="empty-state">Aucun encaissement enregistré.</div></td></tr>';
  const missing=unused.length?`<div class="field-hint" style="margin-top:9px">Tarifs actifs encore inutilisés : ${unused.map(price=>esc(price.label)).join(' · ')}</div>`:'';
  return `<section class="card report-card report-tariffs"><div class="card-head"><div><h2 class="card-title">Encaissements par tarif</h2><p class="card-subtitle">Répartition des paiements confirmés selon la grille du congrès</p></div><button class="link-button" type="button" data-action="open-prices">Modifier la grille</button></div><div class="report-table"><table><thead><tr><th>Tarif</th><th>Paiements</th><th>Total</th></tr></thead><tbody>${body}</tbody></table></div>${missing}</section>`;
}
function renderReports(){const stats=makeStats(),cats=['participant','vip','speaker','press','team'];const rows=cats.map(c=>{const list=getPeople().filter(p=>(p.category||'participant')===c);if(!list.length)return '';const arrived=list.filter(p=>p.checkedIn).length,pct=Math.round(arrived/list.length*100);return `<div class="report-bar"><div class="report-bar-label"><span>${esc(displayCategory(c))}</span><span>${arrived} / ${list.length} · ${pct}%</span></div><div class="progress"><i class="${categoryClass(c)}" style="width:${pct}%"></i></div></div>`;}).join('');const present=getPeople().filter(p=>p.checkedIn).slice().sort((a,b)=>String(b.checkedInAt||'').localeCompare(String(a.checkedInAt||'')));return `<div class="report-grid"><section class="card report-card"><div class="card-head"><div><h2 class="card-title">État des arrivées</h2><p class="card-subtitle">Progression globale et par catégorie</p></div></div><div class="report-summary"><div class="mini-stat"><span>Inscrits</span><strong>${stats.total}</strong></div><div class="mini-stat"><span>Arrivés</span><strong>${stats.arrived}</strong></div><div class="mini-stat"><span>Présence</span><strong>${stats.percent}%</strong></div></div><div class="report-bars">${rows||'<div class="empty-state">Aucune donnée à afficher.</div>'}</div></section><section class="card report-card"><div class="card-head"><div><h2 class="card-title">Liste de présence</h2><p class="card-subtitle">Arrivées confirmées sur cet événement</p></div></div><div class="report-table"><table><thead><tr><th>Participant</th><th>Catégorie</th><th>Heure</th></tr></thead><tbody>${present.length?present.map(p=>`<tr><td>${esc(p.name)}</td><td><span class="cat-badge ${categoryClass(p.category)}">${esc(displayCategory(p.category))}</span></td><td>${esc(localTime(p.checkedInAt))}</td></tr>`).join(''):'<tr><td colspan="3"><div class="empty-state">Aucune arrivée confirmée.</div></td></tr>'}</tbody></table></div></section></div>
  <section class="card report-card report-payments"><div class="card-head"><div><h2 class="card-title">Confirmation des paiements</h2><p class="card-subtitle">Encaissements et exonérations de ce congrès</p></div><span class="pay-total">${icon('cash',12)}${esc(money(stats.collected))} encaissés</span></div><div class="report-summary four"><div class="mini-stat"><span>Encaissé</span><strong class="money">${esc(money(stats.collected))}</strong></div><div class="mini-stat"><span>Payés</span><strong>${stats.paid}</strong></div><div class="mini-stat"><span>À encaisser</span><strong>${stats.toPay}</strong></div><div class="mini-stat"><span>Exonérés</span><strong>${stats.exempt}</strong></div></div><div class="report-table"><table><thead><tr><th>Participant</th><th>Statut</th><th>Montant</th><th>Tarif</th><th>Moyen</th><th>Référence</th><th>Confirmé le</th><th>Par</th></tr></thead><tbody>${paymentRowsHTML()}</tbody></table></div><div class="footnote">${icon('info')}<span>Chaque confirmation est horodatée et signée par l’agent connecté. Les paiements en attente de synchronisation apparaissent après envoi au serveur.</span></div></section>${tariffReportHTML()}${noticeHTML(pendingTotal()?'warning':'',pendingTotal()?`<strong>${pendingTotal()} action(s) n’ont pas encore été envoyées au serveur.</strong> Exportez après synchronisation si vous voulez un bilan centralisé.`:`<strong>Export de l’événement actif.</strong> Le CSV contient la catégorie, la présence, le code badge, l’heure d’arrivée et le détail du paiement.`)}`;}
// ── Corbeille des congrès : restaurables 30 jours, puis effacés définitivement ──
function getEventTrash(){return Array.isArray(store.trashEvents)?store.trashEvents:[];}
function eventTrashEntry(id){return getEventTrash().find(e=>String(e.id)===String(id))||null;}
function eventTrashSection(){
  const trash=getEventTrash();
  if(!trash.length)return '';
  const admin=canPurge();
  const rows=trash.map(e=>{
    const days=Number(e.daysLeft||0),urgent=days<=3;
    const countdown=days<=0?'effacement imminent':`${days} jour${days===1?'':'s'} restant${days===1?'':'s'}`;
    return `<div class="trash-row"><div class="trash-person"><strong>${esc(e.name)}</strong><span>${esc(dateLabel(e.date))}${e.venue?` · ${esc(e.venue)}`:''} · ${Number(e.total||0)} inscrit${Number(e.total||0)===1?'':'s'} · ${Number(e.arrived||0)} arrivé${Number(e.arrived||0)===1?'':'s'}</span><small>Supprimé le ${esc(dateTimeLabel(e.deletedAt))}${e.deletedBy?` par ${esc(e.deletedBy)}`:''}</small></div><span class="event-trash-countdown ${urgent?'urgent':''}">${icon('clock',12)}${countdown}</span><div class="trash-actions"><button class="btn btn-secondary btn-sm" type="button" data-action="restore-event" data-id="${esc(e.id)}">${icon('rotate',12)}Restaurer</button>${admin?`<button class="btn btn-danger btn-sm" type="button" data-action="purge-event" data-id="${esc(e.id)}" data-name="${esc(e.name)}">${icon('trash',12)}Effacer</button>`:''}</div></div>`;
  }).join('');
  return `<section class="card event-trash-card"><div class="card-head"><div><h2 class="card-title">Corbeille des congrès</h2><p class="card-subtitle">Restaurables pendant 30 jours, puis effacés définitivement avec leurs inscrits, tarifs et modèles de badge.</p></div><span class="trash-count">${trash.length}</span></div><div class="trash-list-wrap" style="padding:0 23px 22px">${rows}</div>${admin?'':`<p class="field-hint" style="padding:0 23px 22px">La restauration est ouverte à tous les comptes ; l’effacement définitif est réservé à l’administrateur.</p>`}</section>`;
}
function renderEvents(){
  const trashHTML=eventTrashSection();
  if(!store.events.length)return renderOnboarding()+trashHTML;
  const admin=authUser?.role==='admin';
  const cards=store.events.map(e=>{const total=Number(e.total||0),arrived=Number(e.arrived||0),pct=total?Math.round(arrived/total*100):0;const edit=admin?`<button class="icon-action" type="button" data-action="edit-event" data-id="${esc(e.id)}" title="Paramètres">${icon('settings',13)}</button>`:'';return `<article class="event-card"><div class="event-card-top"><div class="event-card-title"><h3>${esc(e.name)}</h3><p><span>${icon('calendar',12)}${esc(dateLabel(e.date))}</span><span>${icon('pin',12)}${esc(e.venue||'Lieu à préciser')}</span></p></div><span class="event-status ${e.status==='archived'?'archived':''}">${e.status==='archived'?'Archivé':'Actif'}</span></div><div class="event-card-stats"><span>Inscrits<strong>${total}</strong></span><span>Arrivés<strong>${arrived}</strong></span><span>Présence<strong>${pct}%</strong></span></div><div class="event-card-actions"><button class="btn btn-primary btn-sm" type="button" data-action="open-event" data-id="${esc(e.id)}">Ouvrir le desk ${icon('arrow',12)}</button><div>${edit}</div></div></article>`;}).join('');
  const addCard=admin?`<button class="event-add-card" type="button" data-action="new-event"><span class="plus-circle">${icon('plus',17)}</span><strong>Créer un autre congrès</strong><small>Nouvelle liste · nouvel espace d’accueil</small></button>`:'';
  return `<div class="notice">${icon('info')}<span>Chaque congrès possède son propre fichier d’inscrits, son suivi et ses paramètres. Les événements archivés restent consultables ; un congrès supprimé passe 30 jours en corbeille.</span></div><div class="events-grid">${cards}${addCard}</div>${trashHTML}`;
}
function setPage(page){if(!pageMeta[page])return;currentPage=page;render();window.scrollTo({top:0,behavior:'smooth'});}
function showToast(message){const el=$('#toast');el.innerHTML=`${icon('check',15)}<span>${esc(message)}</span>`;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function mergePeople(eventId,participants){if(!Array.isArray(participants))return false;const raw=Array.isArray(store.peopleByEvent[eventId])?store.peopleByEvent[eventId]:[];const map=new Map(raw.map(p=>[String(p.id),p]));let changed=false;participants.forEach(p=>{if(!p||!p.id)return;const old=map.get(String(p.id));if(p.deletedAt){if(old){map.delete(String(p.id));changed=true;}return;}if(!old||JSON.stringify(old)!==JSON.stringify(p)){map.set(String(p.id),p);changed=true;}});store.peopleByEvent[eventId]=Array.from(map.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));applyPending(eventId);return changed;}
function applyPending(eventId){const list=store.peopleByEvent[eventId]||[];const map=new Map(list.map(p=>[String(p.id),p]));for(const op of getQueue(eventId)){if(op.action==='create'&&op.participant&&!map.has(String(op.participant.id)))map.set(String(op.participant.id),{...op.participant});if(op.action==='checkin'||op.action==='undo'){const p=map.get(String(op.participantId));if(p){p.checkedIn=op.action==='checkin';p.checkedInAt=op.action==='checkin'?(op.localTime||new Date().toISOString()):'';}}if(op.action==='payment'){const p=map.get(String(op.participantId)),pay=op.payment||{};if(p){const status=['paid','exempt'].includes(pay.status)?pay.status:'unpaid';p.paymentStatus=status;p.paymentAmount=status==='paid'?Number(pay.amount||0):0;p.paymentMethod=status==='paid'?(pay.method||''):'';p.paymentReference=status==='paid'?(pay.reference||''):'';p.paymentTariff=status==='paid'?(pay.tariff||''):'';p.paymentConfirmedAt=status==='unpaid'?'':(op.localTime||new Date().toISOString());p.paymentConfirmedBy=status==='unpaid'?'':(authUser?.username||p.paymentConfirmedBy||'');}}}store.peopleByEvent[eventId]=Array.from(map.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));}
async function refreshEvents(silent=false){if(eventsRefreshing||!navigator.onLine)return;eventsRefreshing=true;try{const data=await api('/api/events');store.events=data.events||[];store.trashEvents=Array.isArray(data.trash)?data.trash:(store.trashEvents||[]);lastEventsRefresh=Date.now();chooseActiveEvent();if(store.activeEventId)loadPrices(store.activeEventId);saveStore();if(!silent||currentPage==='events')render(true);}catch(error){apiOnline=false;updateStatus();}finally{eventsRefreshing=false;}}
async function refreshParticipants(eventId=store.activeEventId,forceFull=false){if(!eventId||!navigator.onLine||participantRefreshes.has(eventId))return;participantRefreshes.add(eventId);try{const cursor=forceFull?'':(store.cursorByEvent[eventId]||'');const url=`/api/events/${encodeURIComponent(eventId)}/participants${cursor?`?since=${encodeURIComponent(cursor)}`:''}`;const data=await api(url);const changed=mergePeople(eventId,data.participants||[]);if(typeof data.trashCount==='number')setTrashCount(eventId,data.trashCount);if(data.serverTime)store.cursorByEvent[eventId]=data.serverTime;apiOnline=true;saveStore();if(changed&&eventId===store.activeEventId)render(true);else updateStatus();}catch(error){if(error.status===404){refreshEvents(true);}else{apiOnline=false;}updateStatus();}finally{participantRefreshes.delete(eventId);}}
async function syncQueue(eventId=store.activeEventId){if(!eventId||!navigator.onLine||syncLocks.has(eventId))return;const queue=getQueue(eventId);if(!queue.length)return;syncLocks.add(eventId);try{const data=await api(`/api/events/${encodeURIComponent(eventId)}/sync`,{method:'POST',body:JSON.stringify({operations:queue,deviceId:store.deviceId})});const done=new Set((data.results||[]).filter(r=>r.ok).map(r=>r.opId));if(Array.isArray(data.participants))mergePeople(eventId,data.participants);store.queueByEvent[eventId]=queue.filter(op=>!done.has(op.opId));applyPending(eventId);if(data.serverTime)store.cursorByEvent[eventId]=data.serverTime;saveStore();if(eventId===store.activeEventId)render(true);if(done.size){refreshEvents(true);}const failed=(data.results||[]).filter(r=>!r.ok);if(failed.length)showToast(`${failed.length} action(s) à vérifier : ${failed[0].error||'participant introuvable'}.`);}catch(error){apiOnline=false;updateStatus();}finally{syncLocks.delete(eventId);}}
function renderAuthScreen(mode='login',message=''){
  authUser=null;const app=$('#appRoot');if(app)app.hidden=true;const root=$('#authRoot');if(!root)return;root.hidden=false;
  const isSetup=mode==='setup';
  let form='';
  if(isSetup)form=`<form class="auth-form" id="setupForm"><div class="auth-field"><label for="setupUsername">Nom d’utilisateur administrateur</label><input id="setupUsername" name="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+" autocomplete="username" placeholder="ex. imagine.admin"></div><div class="auth-field"><label for="setupToken">Code de configuration (si demandé)</label><input id="setupToken" name="setupToken" type="password" autocomplete="off" placeholder="Fourni par l’administrateur du serveur"></div><div class="auth-field"><label for="setupPassword">Mot de passe</label><input id="setupPassword" name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password" placeholder="12 caractères minimum"></div><div class="auth-field"><label for="setupPasswordConfirm">Confirmer le mot de passe</label><input id="setupPasswordConfirm" name="passwordConfirm" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></div><button class="btn btn-primary" type="submit">Créer le compte administrateur</button></form>`;
  else if(mode==='login')form=`<form class="auth-form" id="loginForm"><div class="auth-field"><label for="loginUsername">Nom d’utilisateur</label><input id="loginUsername" name="username" required autocomplete="username" placeholder="Votre nom d’utilisateur"></div><div class="auth-field"><label for="loginPassword">Mot de passe</label><input id="loginPassword" name="password" type="password" required autocomplete="current-password" placeholder="Votre mot de passe"></div><button class="btn btn-primary" type="submit">Se connecter</button></form>`;
  else form=`<button class="btn btn-primary" type="button" data-action="auth-retry">Réessayer</button>`;
  const title=isSetup?'Créer le compte principal':'Connexion à Imagine Events';
  const intro=isSetup?'Première utilisation : créez le compte administrateur. Il pourra ensuite créer les comptes individuels de l’équipe.':mode==='login'?'Connectez-vous avec le compte que votre administrateur vous a communiqué.':'Le serveur ne répond pas. Vérifiez votre connexion ou réessayez.';
  const warning=isSetup?`<div class="auth-warning"><strong>Mot de passe :</strong> choisissez-en un unique d’au moins 12 caractères. Si l’hébergeur exige un code, saisissez la valeur IMAGINE_SETUP_TOKEN. Pour l’aperçu de démonstration, n’utilisez pas votre vrai mot de passe.</div>`:'';
  root.innerHTML=`<main class="auth-shell"><section class="auth-card"><div class="auth-brand"><span class="brand-chip"><img class="brand-logo" src="/img/logo.png" alt="Imagine Events"></span></div><div class="event-kicker">ACCÈS SÉCURISÉ</div><h1>${esc(title)}</h1><p class="auth-intro">${esc(intro)}</p>${message?`<div class="auth-error">${esc(message)}</div>`:''}${form}${warning}<div class="auth-footer">Les comptes sont gérés par l’administrateur. Les mots de passe ne sont pas affichés ni stockés en clair.</div></section></main>`;
  setTimeout(()=>$('#authRoot input')?.focus(),30);
}
async function enterWorkspace(user,offline=false){
  authUser=user;if(!offline){store.cachedUser=user;store.authCachedAt=Date.now();}else if(!store.cachedUser){store.cachedUser=user;}saveStore();$('#authRoot').hidden=true;$('#authRoot').innerHTML='';$('#appRoot').hidden=false;
  if(!offline)apiOnline=true;else apiOnline=false;
  render();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  if(navigator.onLine){await refreshEvents(true);chooseActiveEvent();if(store.activeEventId){await Promise.all([refreshParticipants(store.activeEventId,!store.cursorByEvent[store.activeEventId]),loadPrices(store.activeEventId),loadBadgeTemplates(store.activeEventId)]);await syncQueue(store.activeEventId);}}
  saveStore();render();
  await focusBadgeFromQuery();
  if(pollTimer)clearInterval(pollTimer);
  pollTimer=setInterval(async()=>{if(!authUser)return;if(!navigator.onLine){apiOnline=false;updateStatus();return;}if(store.activeEventId)await syncQueue(store.activeEventId);await refreshParticipants(store.activeEventId,false);if(Date.now()-lastEventsRefresh>12000)await refreshEvents(true);},3500);
}
async function boot(){
  try{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}catch(e){}
  try{
    if(store.logoutPending){if(!navigator.onLine){renderAuthScreen('unavailable','La déconnexion serveur sera finalisée dès le retour de la connexion.');return;}await api('/api/auth/logout',{method:'POST',body:JSON.stringify({})});store.logoutPending=false;saveStore();}
    const status=await api('/api/auth/status');
    if(status.setupRequired){store.cachedUser=null;store.authCachedAt=0;saveStore();renderAuthScreen('setup');return;}
    if(status.authenticated&&status.user){await enterWorkspace(status.user,false);return;}
    store.cachedUser=null;store.authCachedAt=0;saveStore();renderAuthScreen('login','Reconnectez-vous pour continuer.');
  }catch(error){
    const age=Date.now()-Number(store.authCachedAt||0);
    if(store.cachedUser&&age>=0&&age<SESSION_TTL_MS){await enterWorkspace(store.cachedUser,true);return;}
    renderAuthScreen('unavailable',error.message||'Impossible de joindre le serveur.');
  }
}
const SESSION_TTL_MS=12*60*60*1000;
function queueOp(eventId,op){const q=getQueue(eventId);q.push(op);store.queueByEvent[eventId]=q;saveStore();updateStatus();}
async function performCheckin(personId,action='checkin',skipPaymentWarning=false){
  const event=getEvent(),eventId=store.activeEventId,p=findPerson(personId,eventId);if(!event||!p)return;
  if(action==='checkin'&&event.status==='archived'){showToast('Cet événement est archivé. Réactivez-le pour accueillir des participants.');return;}
  if(action==='checkin'&&p.checkedIn){showToast(`${p.name} est déjà enregistré comme arrivé.`);return;}
  if(action==='undo'&&!p.checkedIn){showToast('Aucune arrivée à annuler.');return;}
  if(action==='checkin'&&!skipPaymentWarning&&needsPayment(p)){openPaymentWarning(p);return;}
  const localTime=new Date().toISOString();p.checkedIn=action==='checkin';p.checkedInAt=action==='checkin'?localTime:'';p.updatedAt=localTime;
  queueOp(eventId,{opId:makeId('op'),eventId,participantId:p.id,action,deviceId:store.deviceId,localTime});applyPending(eventId);saveStore();render(true);
  showToast(action==='checkin'?`Arrivée enregistrée : ${p.name}`:`Arrivée annulée : ${p.name}`);
  if(navigator.onLine)await syncQueue(eventId);
}
function queuePersonCreate(person,eventId=store.activeEventId){store.peopleByEvent[eventId]=[...getPeople(eventId),person].sort((a,b)=>a.name.localeCompare(b.name,'fr'));queueOp(eventId,{opId:makeId('op'),eventId,participantId:person.id,action:'create',participant:person,deviceId:store.deviceId});applyPending(eventId);saveStore();}

function openModal(html,wide=false){$('#modalRoot').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true">${html}</section></div>`;setTimeout(()=>$('#modalRoot input, #modalRoot select, #modalRoot button')?.focus(),25);}
function closeModal(){$('#modalRoot').innerHTML='';}
function openEventModal(event=null){
  const editing=!!event;
  const status=event?.status||'active';
  openModal(`<div class="modal-head"><div><h2>${editing?'Paramètres du congrès':'Créer un congrès'}</h2><p>${editing?'Modifiez les informations ou archivez cet événement.':'Les participants et le suivi seront isolés dans ce nouvel espace.'}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <form id="eventForm" data-id="${esc(event?.id||'')}"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="eventName">Nom du congrès *</label><input id="eventName" name="name" required maxlength="180" value="${esc(event?.name||'')}" placeholder="Ex. Congrès annuel Imagine Events"></div><div class="field"><label for="eventDate">Date</label><input id="eventDate" name="date" type="date" value="${esc(event?.date||'')}"></div><div class="field"><label for="eventVenue">Lieu</label><input id="eventVenue" name="venue" maxlength="180" value="${esc(event?.venue||'')}" placeholder="Ville, hôtel, salle…"></div><div class="field"><label for="eventCurrency">Devise des paiements</label><input id="eventCurrency" name="currency" maxlength="3" value="${esc(event?.currency||'TND')}" placeholder="TND" style="text-transform:uppercase"><span class="field-hint">Code à 3 lettres (TND, EUR, USD…). Appliqué aux paiements de ce congrès.</span></div>${editing?`<div class="field full"><label for="eventStatus">État</label><select id="eventStatus" name="status"><option value="active" ${status==='active'?'selected':''}>Actif — desk ouvert</option><option value="archived" ${status==='archived'?'selected':''}>Archivé — consultation seulement</option></select><span class="field-hint">L’archivage conserve la liste et le rapport. Vous pouvez réactiver l’événement plus tard.</span></div>`:''}</div>${editing?`<div class="db-backup-panel" style="margin-top:14px"><h3 class="card-title">Grille tarifaire</h3><p>${(()=>{const list=activePrices(event.id);return list.length?`${list.length} tarif(s) actif(s) : ${list.slice(0,3).map(price=>`${esc(price.label)} (${esc(money(Number(price.amount||0),event))})`).join(' · ')}${list.length>3?'…':''}. Les agents choisissent le tarif au moment du paiement.`:'Aucun tarif défini : les agents saisissent un montant libre. Ajoutez vos tarifs (2 nuits, 1 nuit, sans hébergement…) pour accélérer le desk.';})()}</p><div class="db-backup-actions"><button class="btn btn-secondary" type="button" data-action="open-prices">${icon('cash')}${activePrices(event.id).length?'Modifier la grille tarifaire':'Créer la grille tarifaire'}</button></div></div>`:''}
${editing&&canPurge()?`<div class="db-backup-panel" style="margin-top:14px"><h3 class="card-title">Corbeille</h3><p>Le congrès quitte la liste, le sélecteur, le desk et les exports. Ses inscrits, arrivées, paiements, tarifs et modèles de badge sont conservés : il reste restaurable <strong>30 jours</strong>, puis il est effacé définitivement.</p><div class="db-backup-actions"><button class="btn btn-danger" type="button" data-action="trash-event" data-id="${esc(event.id)}">${icon('trash')}Mettre le congrès à la corbeille</button></div></div>`:''}
<div class="field-hint" style="margin-top:12px">Sans tarif sélectionné, l’agent saisit le montant encaissé au moment de la confirmation de paiement. La création et la modification nécessitent une connexion au serveur central.</div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">${editing?'Enregistrer':'Créer le congrès'}</button></div></form>`,true);
}
function openImportModal(){
  if(!getEvent()){showToast('Sélectionnez un congrès avant l’import.');return;}
  if(getEvent().status==='archived'){showToast('Ce congrès est archivé. Réactivez-le avant l’import.');return;}
  openModal(`<div class="modal-head"><div><h2>Importer les participants</h2><p>Choisissez un fichier CSV ou un classeur Excel récent.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="guide-steps"><div class="guide-step"><b>CSV</b><div><strong>Fichier .csv</strong><br>Compatible avec Excel et Google Sheets. Séparateur virgule ou point-virgule accepté.</div></div><div class="guide-step"><b>XLSX</b><div><strong>Classeur Excel .xlsx</strong><br>L’application lit la première feuille. Gardez les titres en première ligne. Les anciens fichiers .xls doivent être enregistrés en .xlsx.</div></div></div><div class="notice" style="margin:14px 0 0">${icon('info')}<span>Colonnes reconnues : nom complet, e-mail, organisation, catégorie, code badge, statut (présence), paiement, montant et moyen de paiement. Les doublons sont rapprochés par e-mail ou code badge.</span></div><div class="field-hint" style="margin-top:10px">L’import nécessite une connexion au serveur. Les lignes sont ajoutées ou mises à jour dans la liste du congrès sélectionné.</div></div><div class="modal-footer" style="justify-content:space-between;flex-wrap:wrap"><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-secondary" type="button" data-action="template-csv">${icon('download')}Modèle CSV</button><button class="btn btn-secondary" type="button" data-action="template-xlsx">${icon('download')}Modèle Excel</button></div><div style="display:flex;gap:7px"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="button" data-action="select-import-file">${icon('upload')}Choisir mon fichier</button></div></div>`,true);
}
function openAddModal(){
  const ev=getEvent();if(!ev){showToast('Créez ou sélectionnez un congrès avant d’ajouter un participant.');return;}if(ev.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le avant d’ajouter des inscrits.');return;}
  openModal(`<div class="modal-head"><div><h2>Ajouter un participant</h2><p>En ligne, l’inscription est enregistrée au serveur. Hors ligne, elle rejoint la file locale.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><form id="personForm"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="personName">Nom complet *</label><input id="personName" name="name" required maxlength="180" placeholder="Ex. Amira Ben Salem"></div><div class="field"><label for="personEmail">E-mail</label><input id="personEmail" name="email" type="email" maxlength="180" placeholder="nom@exemple.tn"></div><div class="field"><label for="personCategory">Catégorie</label><select id="personCategory" name="category"><option value="participant">Participant</option><option value="vip">VIP</option><option value="speaker">Intervenant</option><option value="press">Presse</option><option value="team">Équipe</option></select></div><div class="field full"><label for="personCompany">Organisation</label><input id="personCompany" name="company" maxlength="180" placeholder="Entreprise, institution…"></div><div class="field full"><label for="personCode">Code badge</label><input id="personCode" name="code" maxlength="40" placeholder="Généré automatiquement si vide"><span class="field-hint">Un code court est attribué à chaque participant.</span></div></div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">${icon('plus')}Ajouter</button></div></form>`,true);
}
function openDetails(id){const p=findPerson(id);if(!p)return;const pay=paymentOf(p);const event=getEvent();openModal(`<div class="modal-head"><div><h2>Fiche participant</h2><p>Inscription à ${esc(event?.name||'ce congrès')}.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="detail-hero"><span class="avatar">${esc(initials(p.name))}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.company||'Organisation non renseignée')}</p></div></div><div class="detail-grid"><div class="detail-cell"><span>Catégorie</span><strong>${esc(displayCategory(p.category))}</strong></div><div class="detail-cell"><span>Statut</span><strong>${p.checkedIn?'Arrivée confirmée':'À accueillir'}</strong></div><div class="detail-cell"><span>E-mail</span><strong>${esc(p.email||'—')}</strong></div><div class="detail-cell"><span>Code badge</span><strong>${esc(p.code||'—')}</strong></div><div class="detail-cell"><span>Paiement</span><strong>${esc(paymentStatusNames[pay.status])}${pay.status==='paid'&&pay.amount>0?` · ${esc(money(pay.amount))}`:''}</strong></div><div class="detail-cell"><span>Moyen de paiement</span><strong>${esc(paymentMethodNames[pay.method]||'—')}</strong></div><div class="detail-cell"><span>Référence</span><strong>${esc(pay.reference||'—')}</strong></div>
<div class="detail-cell"><span>Tarif appliqué</span><strong>${esc(pay.tariff||'—')}</strong></div><div class="detail-cell"><span>Paiement confirmé</span><strong>${pay.at?`${esc(dateTimeLabel(pay.at))}${pay.by?` · ${esc(pay.by)}`:''}`:'—'}</strong></div><div class="detail-cell"><span>Heure d’arrivée</span><strong>${esc(localTime(p.checkedInAt))}</strong></div><div class="detail-cell"><span>Synchronisation</span><strong>${getQueue().some(op=>op.participantId===p.id)?'En attente':'À jour / local'}</strong></div></div>${needsPayment(p)?`<div class="notice warning" style="margin-top:12px">${icon('cash')}<span><strong>Paiement non confirmé.</strong> Encaissement possible au desk avant ou après l’arrivée.</span></div>`:''}</div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Fermer</button><button class="btn btn-danger" type="button" data-action="trash-person" data-id="${esc(p.id)}" ${event?.status==='archived'?'disabled':''}>${icon('trash')}Corbeille</button><button class="btn btn-secondary" type="button" data-action="badge" data-id="${esc(p.id)}">${icon('badge')}Voir le badge</button><button class="btn btn-secondary" type="button" data-action="payment" data-id="${esc(p.id)}" ${event?.status==='archived'?'disabled':''}>${icon('cash')}${needsPayment(p)?'Encaisser':'Paiement'}</button>${p.checkedIn?`<button class="btn btn-danger" type="button" data-action="undo" data-id="${esc(p.id)}">Annuler l’arrivée</button>`:`<button class="btn btn-primary" type="button" data-action="checkin" data-id="${esc(p.id)}" ${event?.status==='archived'?'disabled':''}>${icon('check')}Confirmer l’arrivée</button>`}</div>`,true);}

function paymentMethodOptions(selected){return PAYMENT_METHOD_OPTIONS.map(key=>`<option value="${key}" ${selected===key?'selected':''}>${esc(paymentMethodNames[key])}</option>`).join('');}
function openPaymentModal(id,options={}){
  const p=findPerson(id);if(!p)return;
  const event=getEvent();
  if(!event||event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour enregistrer un paiement.');return;}
  const pay=paymentOf(p);
  const thenCheckin=options.thenCheckin?' data-then-checkin="1"':'';
  const lastMeta=pay.status!=='unpaid'&&pay.at?`<div class="payment-meta">Dernière confirmation : <strong>${esc(dateTimeLabel(pay.at))}</strong>${pay.by?` par <strong>${esc(pay.by)}</strong>`:''}${pay.reference?` · Réf. ${esc(pay.reference)}`:''}${pay.tariff?` · Tarif ${esc(pay.tariff)}`:''}</div>`:'';
  const grid=activePrices().slice().sort((a,b)=>(a.category===p.category?0:1)-(b.category===p.category?0:1)||String(a.label).localeCompare(String(b.label),'fr'));
  const tariffBlock=grid.length?`<div class="tariff-picker"><div class="tariff-picker-head"><strong>Grille tarifaire du congrès</strong><small>Un appui choisit le tarif et remplit le montant.</small></div><div class="tariff-buttons">${grid.map(price=>`<button class="tariff-btn ${String(price.label)===String(pay.tariff||'')?'selected':''} ${price.category===p.category?'same-category':''}" type="button" data-action="pick-tariff" data-price="${esc(price.id)}" data-id="${esc(p.id)}"><span class="tariff-amount">${esc(money(Number(price.amount||0),event))}</span><span class="tariff-label">${esc(price.label)}</span><span class="tariff-cat">${esc(displayCategory(price.category))}</span></button>`).join('')}</div><input type="hidden" id="paymentTariff" name="tariff" value="${esc(pay.tariff||'')}"><div class="field-hint">Tarif appliqué : <strong id="paymentTariffLabel">${esc(pay.tariff||'aucun — montant libre')}</strong></div></div>`:'';
  openModal(`<div class="modal-head"><div><h2>Confirmation de paiement</h2><p>${esc(p.name)} · ${esc(event.name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <form id="paymentForm" data-id="${esc(p.id)}"${thenCheckin}><div class="modal-body">
    <div class="detail-hero"><span class="avatar">${esc(initials(p.name))}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.company||'Organisation non renseignée')} · ${esc(displayCategory(p.category))}</p></div></div>
    ${tariffBlock}
    <div class="form-grid">
      <div class="field"><label for="paymentStatus">Statut du paiement</label><select id="paymentStatus" name="status"><option value="paid" ${pay.status==='paid'?'selected':''}>Payé — encaissé</option><option value="unpaid" ${pay.status==='unpaid'?'selected':''}>Non payé — à encaisser</option><option value="exempt" ${pay.status==='exempt'?'selected':''}>Exonéré — ne paie pas</option></select></div>
      <div class="field"><label for="paymentAmount">Montant encaissé (${esc(eventCurrency(event))})</label><input id="paymentAmount" name="amount" type="number" min="0" max="10000000" step="0.001" inputmode="decimal" value="${pay.amount?esc(pay.amount):''}" placeholder="0" ${pay.status==='paid'?'':'disabled'}></div>
      <div class="field"><label for="paymentMethod">Moyen de paiement</label><select id="paymentMethod" name="method" ${pay.status==='paid'?'':'disabled'}>${paymentMethodOptions(pay.method||'cash')}</select></div>
      <div class="field"><label for="paymentReference">Référence / justificatif</label><input id="paymentReference" name="reference" maxlength="120" value="${esc(pay.reference)}" placeholder="N° reçu, virement, badge invité…" ${pay.status==='paid'?'':'disabled'}></div>
    </div>
    <div class="field-hint" style="margin-top:11px">La confirmation est horodatée et enregistrée au nom de ${esc(authUser?.username||'l’agent connecté')}. Hors ligne, elle rejoint la file de synchronisation de cet appareil.</div>
    ${lastMeta}
  </div><div class="modal-footer">${pay.status!=='unpaid'?`<button class="btn btn-secondary" type="button" data-action="payment-reset" data-id="${esc(p.id)}">Marquer non payé</button>`:''}<button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">${icon('cash')}${thenCheckin?'Encaisser puis accueillir':'Enregistrer le paiement'}</button></div></form>`,true);
}

function pickTariff(personId,priceId){
  const price=priceById(priceId,store.activeEventId);
  if(!price)return;
  const form=$('#paymentForm');if(!form)return;
  const status=$('#paymentStatus'),amount=$('#paymentAmount'),method=$('#paymentMethod'),reference=$('#paymentReference'),hidden=$('#paymentTariff'),label=$('#paymentTariffLabel');
  if(status)status.value='paid';
  if(amount){amount.value=String(price.amount||0);amount.disabled=false;}
  if(method)method.disabled=false;
  if(reference)reference.disabled=false;
  if(hidden)hidden.value=price.label;
  if(label)label.textContent=price.label;
  $$('.tariff-btn').forEach(b=>b.classList.toggle('selected',b.dataset.price===String(price.id)));
  (amount||method)?.focus();
}

/* ── Grille tarifaire du congrès ─────────────────────────────────────── */
const PRICE_CATEGORY_OPTIONS=['participant','vip','speaker','press','team'];
function priceRowHTML(price={}){
  const amount=price.amount!==undefined?String(price.amount):'';
  return `<div class="price-row"><input class="price-label" type="text" maxlength="120" value="${esc(price.label||'')}" placeholder="Ex. Participant — 2 nuits d’hôtel" aria-label="Libellé du tarif"><select class="price-category" aria-label="Catégorie">${PRICE_CATEGORY_OPTIONS.map(c=>`<option value="${c}" ${(price.category||'participant')===c?'selected':''}>${esc(displayCategory(c))}</option>`).join('')}</select><input class="price-amount" type="number" min="0" max="10000000" step="0.001" inputmode="decimal" value="${esc(amount)}" placeholder="0" aria-label="Montant"><label class="price-active"><input type="checkbox" ${price.active===false?'':'checked'}> Actif</label><button class="icon-action price-remove" type="button" data-action="price-remove" title="Retirer cette ligne" aria-label="Retirer cette ligne">×</button></div>`;
}
function openPricesModal(){
  const event=getEvent();
  if(!event){showToast('Sélectionnez un congrès avant de définir sa grille tarifaire.');return;}
  if(event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour modifier la grille.');return;}
  const prices=pricesForEvent(event.id);
  openModal(`<div class="modal-head"><div><h2>Grille tarifaire</h2><p>${esc(event.name)} · ${esc(eventCurrency(event))}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <form id="pricesForm"><div class="modal-body">
    <div class="notice" style="margin:0 0 12px">${icon('info')}<span>Autant de lignes que nécessaire : par exemple « 2 nuits d’hôtel », « 1 nuit », « sans hébergement », early bird, tarif sur place. Au paiement, un appui sur le tarif remplit le montant.</span></div>
    <div class="price-head"><span>Libellé</span><span>Catégorie</span><span>Montant</span><span>État</span><span></span></div>
    <div id="priceRows" class="price-rows">${(prices.length?prices:[{label:'',category:'participant',amount:'',active:true},{label:'',category:'participant',amount:'',active:true}]).map(priceRowHTML).join('')}</div>
    <div class="price-actions"><button class="btn btn-secondary" type="button" data-action="price-add">${icon('plus')}Ajouter une ligne</button><button class="btn btn-soft" type="button" data-action="price-template">Modèle hébergement (2 nuits / 1 nuit / sans)</button></div>
    <div class="field-hint" id="priceSummary" style="margin-top:10px"></div>
    <div class="notice warning" style="margin-top:12px">${icon('info')}<span>Modifier la grille ne change <strong>aucun</strong> montant déjà encaissé : chaque paiement garde son montant et le tarif appliqué. Les tarifs sont enregistrés sur le serveur, puis disponibles sur tous les postes (et hors ligne après ouverture).</span></div>
  </div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">${icon('check')}Enregistrer la grille</button></div></form>`,true);
  updatePriceSummary();
}
function addPriceRow(){
  const rows=$('#priceRows');if(!rows)return;
  rows.insertAdjacentHTML('beforeend',priceRowHTML({label:'',category:'participant',amount:'',active:true}));
  updatePriceSummary();
}
function applyPriceTemplate(){
  const rows=$('#priceRows');if(!rows)return;
  const existing=$$('.price-label',rows).map(input=>norm(input.value)).filter(Boolean);
  const lines=[['Participant — 2 nuits d’hôtel','participant'],['Participant — 1 nuit d’hôtel','participant'],['Participant — sans hébergement','participant']];
  lines.forEach(([label,category])=>{
    if(existing.includes(norm(label)))return;
    rows.insertAdjacentHTML('beforeend',priceRowHTML({label,category,amount:'',active:true}));
  });
  updatePriceSummary();
  showToast('Modèle ajouté : renseignez les montants puis enregistrez.');
}
function collectPrices(){
  return $$('#priceRows .price-row').map(row=>({
    label:String($('.price-label',row)?.value||'').trim(),
    category:String($('.price-category',row)?.value||'participant'),
    amount:String($('.price-amount',row)?.value||''),
    active:!!$('.price-active input',row)?.checked,
  })).filter(price=>price.label);
}
function updatePriceSummary(){
  const box=$('#priceSummary');if(!box)return;
  const prices=collectPrices();
  const active=prices.filter(price=>price.active);
  const total=active.reduce((sum,price)=>sum+Number(String(price.amount||'0').replace(',','.'))||0,0);
  box.textContent=prices.length?`${prices.length} tarif${prices.length>1?'s':''} · ${active.length} actif${active.length>1?'s':''} · montant le plus élevé : ${money(Math.max(0,...active.map(price=>Number(String(price.amount||'0').replace(',','.'))||0)))}`:'Aucun tarif : le desk continuera à saisir un montant libre.';
}
async function savePrices(){
  const event=getEvent();if(!event)return false;
  const prices=collectPrices();
  if(!prices.length&&!window.confirm('La grille sera vide : les agents devront saisir un montant libre. Enregistrer quand même ?'))return false;
  try{
    const data=await api(`/api/events/${encodeURIComponent(event.id)}/prices`,{method:'PUT',body:JSON.stringify({prices:prices.map(price=>({...price,amount:price.amount===''?'0':price.amount}))})});
    store.pricesByEvent=store.pricesByEvent||{};store.pricesByEvent[event.id]=Array.isArray(data.prices)?data.prices:[];
    saveStore();closeModal();render();
    showToast(`Grille tarifaire enregistrée : ${(data.prices||[]).length} tarif(s).`);
    return true;
  }catch(error){showToast(error.message||'Enregistrement de la grille impossible.');return false;}
}

function openPaymentWarning(p){
  const event=getEvent();
  openModal(`<div class="modal-head"><div><h2>Paiement non confirmé</h2><p>Aucun paiement n’est enregistré pour cet inscrit.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="detail-hero"><span class="avatar">${esc(initials(p.name))}</span><div><h3>${esc(p.name)}</h3><p>${esc(displayCategory(p.category))} · ${esc(p.company||'—')}</p></div></div><div class="notice warning">${icon('cash')}<span><strong>${esc(p.name)}</strong> n’a pas encore de paiement confirmé pour ${esc(event?.name||'ce congrès')}. Vérifiez l’encaissement avant de remettre le badge.</span></div><div class="field-hint" style="margin-top:10px">L’arrivée peut être confirmée sans paiement : le statut « non payé » restera visible dans la liste et le rapport.</div></div><div class="modal-footer" style="flex-wrap:wrap"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-secondary" type="button" data-action="checkin-force" data-id="${esc(p.id)}">Accueillir sans paiement</button><button class="btn btn-primary" type="button" data-action="payment" data-id="${esc(p.id)}" data-then-checkin="1">${icon('cash')}Encaisser puis accueillir</button></div>`);
}

async function applyPayment(personId,payload){
  const event=getEvent(),eventId=store.activeEventId,p=findPerson(personId,eventId);
  if(!event||!p)return false;
  if(event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour enregistrer un paiement.');return false;}
  const status=['paid','exempt'].includes(payload.status)?payload.status:'unpaid';
  let amount=0;
  if(status==='paid'){
    amount=Number(String(payload.amount??'').replace(/\s/g,'').replace(',','.'));
    if(!Number.isFinite(amount)||amount<0){showToast('Montant invalide. Saisissez un nombre positif.');return false;}
    if(amount>10000000){showToast('Le montant doit rester inférieur à 10 000 000.');return false;}
    amount=Math.round(amount*1000)/1000;
  }
  const method=status==='paid'?(payload.method||'cash'):'';
  const reference=status==='paid'?String(payload.reference||'').trim().slice(0,120):'';
  const tariff=status==='paid'?String(payload.tariff||'').trim().slice(0,120):'';
  const now=new Date().toISOString();
  Object.assign(p,{paymentStatus:status,paymentAmount:amount,paymentMethod:method,paymentReference:reference,paymentTariff:tariff,paymentConfirmedAt:status==='unpaid'?'':now,paymentConfirmedBy:status==='unpaid'?'':(authUser?.username||''),updatedAt:now});
  queueOp(eventId,{opId:makeId('op'),eventId,participantId:p.id,action:'payment',deviceId:store.deviceId,localTime:now,payment:{status,amount,method,reference,tariff}});
  applyPending(eventId);saveStore();render(true);
  showToast(status==='paid'?`Paiement confirmé : ${p.name} — ${money(amount,event)}.`:status==='exempt'?`${p.name} marqué comme exonéré.`:`Paiement annulé : ${p.name}.`);
  if(navigator.onLine)await syncQueue(eventId);
  return true;
}

function openBadgeModal(id){
  const person=findPerson(id);
  if(!person)return;
  const model=activeBadgeTemplate();
  const format=`${Number(model?.format?.width||90)} × ${Number(model?.format?.height||60)} mm`;
  const back=badgeHasBack(model)?`<div class="field-hint" style="margin:14px 0 6px;text-align:center">Verso</div><div class="modal-badge">${badgeFrame(person,model,'back')}</div>`:'';
  openModal(`<div class="modal-head"><div><h2>Aperçu du badge</h2><p>Modèle « ${esc(model?.name||'Modèle de test')} » · ${format}${back?' · recto-verso':''}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="modal-badge">${badgeFrame(person,model,'front')}</div>${back}<div class="field-hint" style="margin-top:11px;text-align:center">${model?.qrMode==='url'?`QR code : ${esc(qrPayload(person,model))}`:'Le QR code contient la référence du badge'} · rendu à l’échelle de l’impression.</div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Fermer</button><button class="btn btn-secondary" type="button" data-action="badge-studio">${icon('file')}Modifier le modèle</button><button class="btn btn-primary" type="button" data-action="print-badge" data-id="${esc(person.id)}">${icon('printer')}Imprimer</button></div>`,true);
}
function openHelp(){openModal(`<div class="modal-head"><div><h2>Guide du desk</h2><p>Préparation pour un ou plusieurs postes d’accueil.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="guide-steps"><div class="guide-step"><b>1</b><div><strong>Créez un congrès distinct</strong><br>Nom, date et lieu sont propres à chaque événement. Les données ne se mélangent pas.</div></div><div class="guide-step"><b>2</b><div><strong>Importez la liste</strong><br>Les modèles CSV/Excel acceptent nom complet, e-mail, organisation, catégorie, code badge, statut et colonnes de paiement (paiement, montant, moyen). Les doublons sont rapprochés par e-mail ou code.</div></div><div class="guide-step"><b>3</b><div><strong>Ouvrez le même événement sur chaque poste</strong><br>Tous les appareils doivent accéder à la même adresse du serveur central pour synchroniser les check-ins.</div></div><div class="guide-step"><b>4</b><div><strong>Définissez la grille tarifaire</strong><br>Paramètres du congrès → <em>Grille tarifaire</em> : autant de lignes que nécessaire (« 2 nuits d’hôtel », « 1 nuit », « sans hébergement », early bird…). Au paiement, un appui sur le tarif remplit le montant.</div></div><div class="guide-step"><b>5</b><div><strong>Confirmez les paiements</strong><br>Ouvrez la colonne « Paiement » d’un inscrit (ou sa fiche) : le tarif se choisit en un appui, le montant, le moyen de paiement et une référence restent modifiables. La confirmation est horodatée et signée par l’agent connecté. Les inscrits non payés déclenchent un avertissement au check-in, sans bloquer l’arrivée.</div></div><div class="guide-step"><b>6</b><div><strong>En cas de coupure</strong><br>Les arrivées, les paiements et les ajouts faits sur cet appareil sont mis en file locale. À la reconnexion, ils sont renvoyés automatiquement. Gardez l’onglet ouvert pendant la panne.</div></div><div class="guide-step"><b>7</b><div><strong>Corbeille, en cas d’erreur</strong><br>Cochez un ou plusieurs inscrits, puis <em>Mettre à la corbeille</em> : ils quittent la liste, les compteurs et les badges sans être perdus. Le bouton <em>Corbeille</em> les restaure tels quels ; seul l’administrateur peut les effacer définitivement.</div></div><div class="guide-step"><b>8</b><div><strong>À la fin</strong><br>Vérifiez l’indicateur « synchronisé », exportez le rapport CSV (présences et paiements), puis archivez le congrès.</div></div></div><div class="notice warning" style="margin:15px 0 0">${icon('info')}<span>Les comptes administrateur et agent sont actifs. Avant toute mise en production, ajoutez un domaine HTTPS et des sauvegardes automatiques; ne saisissez pas de vraies données personnelles dans l’aperçu de démonstration.</span></div></div><div class="modal-footer"><button class="btn btn-primary" type="button" data-action="close-modal">Compris</button></div>`,true);}
async function openAccountsModal(){
  if(authUser?.role!=='admin'){showToast('Seul l’administrateur peut gérer les comptes.');return;}
  let storage=null;
  try{storage=await api('/api/admin/storage');}catch(error){storage=null;}
  try{const data=await api('/api/users');renderAccountsModal(data.users||[],storage);}catch(error){showToast(error.message||'Impossible de charger les comptes.');}
}
function storagePanel(storage){
  if(!storage)return '';
  const postgres=storage.backend==='postgres';
  const size=postgres?'':(storage.sizeBytes?` · ${(storage.sizeBytes/1024).toFixed(0)} Ko`:' · fichier absent');
  const path=esc(storage.path||'—');
  const engine=postgres?'PostgreSQL (DATABASE_URL)':'Base SQLite lue par le serveur';
  const last=storage.lastBackupAt?`Dernière sauvegarde exportée le ${esc(String(storage.lastBackupAt).slice(0,10))}${typeof storage.backupAgeDays==='number'?` (il y a ${storage.backupAgeDays} jour${storage.backupAgeDays>1?'s':''})`:''}.`:'Aucune sauvegarde exportée depuis cette base pour le moment.';
  const expiry=storage.expiresAt?` Échéance de la base : ${esc(String(storage.expiresAt).slice(0,10))}${typeof storage.daysLeft==='number'?` (${storage.daysLeft} jour${storage.daysLeft>1?'s':''} restants)`:''}.`:'';
  const warning=storage.ephemeral?`<div class="notice warning" style="margin-top:10px">${icon('info')}<span><strong>Données non durables.</strong> ${esc(storage.warnings||'')}</span></div>`:`<div class="notice" style="margin-top:10px">${icon('cloud')}<span><strong>${postgres?'Base PostgreSQL connectée':'Base enregistrée sur le serveur'}.</strong> ${postgres?'Les congrès, inscrits et paiements sont conservés par la base gérée (Render) : ils survivent aux redéploiements et aux mises en veille.':'Les congrès, inscrits et paiements restent disponibles après actualisation de la page ou redémarrage du serveur.'} La sauvegarde est un fichier <code>.zip</code> lisible dans Excel et restaurable depuis cette page, sans ligne de commande.</span></div>`;
  return `<section class="db-backup-panel"><h3 class="card-title">Où sont mes données</h3><p>${esc(engine)} : <code class="storage-path">${path}</code>${esc(size)}${!postgres&&storage.envOverride?' · via IMAGINE_DB_PATH':''}</p>${warning}<div class="field-hint" style="margin-top:8px">${last}${expiry}</div></section>`;
}
function renderAccountsModal(users,storage){
  const rows=users.map(u=>{const resetButton=u.id===authUser?.id?'':`<button class="btn btn-secondary" type="button" data-action="reset-user" data-id="${esc(u.id)}" data-username="${esc(u.username)}">Réinitialiser</button>`;return `<div class="account-row"><span class="account-avatar">${esc(initials(u.username))}</span><span class="account-info"><strong>${esc(u.username)}${u.id===authUser?.id?' · vous':''}</strong><small>${u.active?'Compte actif':'Compte désactivé'} · créé ${esc(String(u.createdAt||'').slice(0,10)||'—')}</small></span><div class="account-actions"><select class="account-role-select" data-user-role data-id="${esc(u.id)}" aria-label="Rôle de ${esc(u.username)}"><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="desk" ${u.role==='desk'?'selected':''}>Agent desk</option></select>${resetButton}<button class="btn ${u.active?'btn-danger':'btn-soft'}" type="button" data-action="toggle-user" data-id="${esc(u.id)}" data-active="${u.active?'true':'false'}">${u.active?'Désactiver':'Activer'}</button></div></div>`;}).join('');
  const backupPanel=`${storagePanel(storage||null)}<section class="db-backup-panel"><h3 class="card-title">Sauvegarde et restauration</h3><p>« Exporter la sauvegarde » télécharge un fichier <code>.zip</code> (un CSV par table + manifeste) qui contient les congrès, inscrits, paiements, comptes et historique. « Restaurer une sauvegarde » remplace toutes les données actuelles par celles du fichier, directement depuis ce navigateur.</p><div class="db-backup-actions"><button class="btn btn-secondary" type="button" data-action="export-db">${icon('download')}Exporter la sauvegarde</button><button class="btn btn-primary" type="button" data-action="restore-backup">${icon('upload')}Restaurer une sauvegarde</button></div><div class="notice warning" style="margin-top:10px">${icon('info')}<span>La restauration remplace congrès, inscrits, paiements, comptes et historique. Votre mot de passe est demandé pour confirmer. Elle se fait en une seule transaction : en cas d’erreur, rien n’est modifié et votre compte reste administrateur.</span></div><div class="field-hint" style="margin-top:8px">Le fichier exporté contient les empreintes des mots de passe. Gardez-le dans un endroit privé et sûr.</div></section>`;
  openModal(`<div class="modal-head"><div><h2>Comptes de l’équipe</h2><p>Un compte individuel par personne. Les mots de passe ne sont jamais affichés.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body">${backupPanel}<div class="account-list">${rows||'<div class="empty-state">Aucun compte.</div>'}</div><div style="padding-top:14px;border-top:1px solid #edf0f5"><h3 class="card-title" style="margin:0 0 11px">Créer un compte</h3><form id="createAccountForm"><div class="form-grid"><div class="field"><label for="newUsername">Nom d’utilisateur</label><input id="newUsername" name="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+" placeholder="ex. accueil1"></div><div class="field"><label for="newRole">Rôle</label><select id="newRole" name="role"><option value="desk">Agent desk</option><option value="admin">Administrateur</option></select></div><div class="field"><label for="newPassword">Mot de passe provisoire</label><input id="newPassword" name="password" type="password" required minlength="12" autocomplete="new-password"></div><div class="field"><label for="newPasswordConfirm">Confirmer le mot de passe</label><input id="newPasswordConfirm" name="passwordConfirm" type="password" required minlength="12" autocomplete="new-password"></div></div><div class="field-hint" style="margin-top:8px">12 caractères minimum. Transmettez le mot de passe provisoire de façon privée et demandez à l’agent de le changer après la première connexion.</div><div style="display:flex;justify-content:flex-end;margin-top:11px"><button class="btn btn-primary" type="submit">${icon('plus')}Créer le compte</button></div></form></div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Fermer</button></div>`,true);
}
function openOwnPasswordModal(){
  openModal(`<div class="modal-head"><div><h2>Changer mon mot de passe</h2><p>Compte : ${esc(authUser?.username||'')}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><form id="ownPasswordForm"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="currentPassword">Mot de passe actuel</label><input id="currentPassword" name="currentPassword" type="password" required autocomplete="current-password"></div><div class="field full"><label for="newOwnPassword">Nouveau mot de passe</label><input id="newOwnPassword" name="newPassword" type="password" required minlength="12" autocomplete="new-password"></div><div class="field full"><label for="confirmOwnPassword">Confirmer le nouveau mot de passe</label><input id="confirmOwnPassword" name="passwordConfirm" type="password" required minlength="12" autocomplete="new-password"></div></div><div class="field-hint" style="margin-top:9px">12 caractères minimum. Votre session actuelle sera renouvelée.</div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">Enregistrer</button></div></form>`,true);
}
function openResetPasswordModal(id,username){
  openModal(`<div class="modal-head"><div><h2>Réinitialiser le mot de passe</h2><p>Compte : ${esc(username||'')}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><form id="resetPasswordForm" data-id="${esc(id)}"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="resetPassword">Nouveau mot de passe provisoire</label><input id="resetPassword" name="password" type="password" required minlength="12" autocomplete="new-password"></div><div class="field full"><label for="resetPasswordConfirm">Confirmer le mot de passe</label><input id="resetPasswordConfirm" name="passwordConfirm" type="password" required minlength="12" autocomplete="new-password"></div></div><div class="field-hint" style="margin-top:9px">Toutes les sessions actives de ce compte seront fermées.</div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">Enregistrer</button></div></form>`,true);
}
async function toggleAccount(button){
  const id=button.dataset.id,newActive=button.dataset.active!=='true';
  try{await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({active:newActive})});showToast(newActive?'Compte réactivé.':'Compte désactivé; ses sessions ont été fermées.');await openAccountsModal();}catch(error){showToast(error.message||'Modification impossible.');}
}
async function logout(){
  const queued=pendingTotal();
  if(queued&&!confirm(`${queued} action(s) sont encore en attente. Elles resteront sur cet appareil et seront synchronisées après une prochaine connexion. Se déconnecter ?`))return;
  let serverLogout=false;try{await api('/api/auth/logout',{method:'POST',body:JSON.stringify({})});serverLogout=true;}catch(e){}
  authUser=null;store.cachedUser=null;store.authCachedAt=0;store.logoutPending=!serverLogout;if(!queued){store.peopleByEvent={};store.cursorByEvent={};}saveStore();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  renderAuthScreen('login',serverLogout?'Vous êtes déconnecté. Les actions hors ligne restent sauvegardées sur cet appareil.':'Déconnexion locale effectuée. La session serveur sera fermée dès le retour de la connexion.');
}
function downloadFile(filename,content,type='text/csv;charset=utf-8'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
function exportCSV(){const event=getEvent();if(!event){showToast('Sélectionnez un congrès avant l’export.');return;}const headers=['Nom complet','E-mail','Organisation','Catégorie','Code badge','Statut','Heure d’arrivée','Paiement','Montant payé',`Devise`,'Tarif appliqué','Moyen de paiement','Référence paiement','Paiement confirmé le','Paiement confirmé par','Synchronisation'];const q=getQueue(event.id);const rows=getPeople(event.id).map(p=>{const pay=paymentOf(p);return [p.name,p.email,p.company,displayCategory(p.category),p.code,p.checkedIn?'Arrivé':'À accueillir',p.checkedIn?localTime(p.checkedInAt):'',paymentStatusNames[pay.status],pay.status==='paid'?String(pay.amount).replace('.',','):'',pay.status==='paid'?eventCurrency(event):'',pay.status==='paid'?pay.tariff:'',pay.method?paymentMethodNames[pay.method]:'',pay.reference,pay.at?dateTimeLabel(pay.at):'',pay.by,q.some(op=>op.participantId===p.id)?'En attente':'À jour'];});const csv='\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n');const slug=event.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'congres';downloadFile(`imagine-events-${slug}-presences.csv`,csv);showToast('Rapport CSV téléchargé avec le détail des paiements.');}
function downloadTemplate(){const csv='\uFEFF'+'Nom complet;E-mail;Organisation;Catégorie;Code badge;Statut;Paiement;Montant;Moyen de paiement\r\nAmira Ben Salem;amira@example.tn;Entreprise Exemple;Participant;IE-0001;À accueillir;Non payé;;\r\nMehdi Trabelsi;mehdi@example.tn;Entreprise Exemple;VIP;IE-0002;À accueillir;Payé;150;Espèces';downloadFile('modele-import-participants.csv',csv);showToast('Modèle CSV téléchargé — remplacez les lignes exemple par vos inscrits.');}
function downloadExcelTemplate(){const a=document.createElement('a');a.href='/modele-import-participants.xlsx';a.download='modele-import-participants.xlsx';document.body.appendChild(a);a.click();a.remove();showToast('Modèle Excel téléchargé. Complétez la première feuille « Participants ».');}
function parseCSV(text){const first=(text.split(/\r?\n/)[0]||'');const sem=(first.match(/;/g)||[]).length,comma=(first.match(/,/g)||[]).length,tab=(first.match(/\t/g)||[]).length;const delimiter=sem>=comma&&sem>=tab?';':tab>comma?'\t':',';const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);row=[];cell='';}else cell+=ch;}row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);return rows;}
function normalizeHeader(v){return String(v||'').replace(/^\uFEFF/,'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ');}
function findColumn(headers,aliases){return headers.findIndex(h=>aliases.includes(normalizeHeader(h)));}
function parseCategory(v){const x=normalizeHeader(v);if(x.includes('vip')||x.includes('invite'))return 'vip';if(x.includes('interven')||x.includes('speaker')||x.includes('orateur')||x.includes('conferenc'))return 'speaker';if(x.includes('press')||x.includes('presse')||x.includes('media'))return 'press';if(x.includes('equipe')||x.includes('staff')||x.includes('organisateur'))return 'team';return 'participant';}
function parseCheckin(v){const x=normalizeHeader(v);if(!x)return false;if(['1','true','oui','yes','present','arrive','arrivee','checked in','checked-in'].includes(x)||x.startsWith('arriv')||x.startsWith('present'))return true;return false;}
function parsePaymentStatus(v){const x=normalizeHeader(v);if(!x)return '';if(/(exon|dispens|gratuit|offert|exempt)/.test(x))return 'exempt';if(['0','false','non','no','impaye','unpaid','en attente','pending','a regler','non regle'].includes(x))return 'unpaid';if(['1','true','oui','yes','paye','paid','regle','confirme','recu','encaiss','valide'].includes(x)||/^(pay|regl|encaiss|confirm)/.test(x))return 'paid';if(/^(non |pas )/.test(x))return 'unpaid';return '';}
function parseAmount(v){const text=String(v??'').replace(/\s/g,'').replace(',','.').replace(/(TND|DT|EUR|USD|€|\$)/gi,'');if(!text)return 0;const n=Number(text);return Number.isFinite(n)&&n>=0?Math.min(n,10000000):0;}
function mapCSV(text){const rows=parseCSV(text);if(rows.length<2)throw new Error('Le CSV est vide ou ne contient aucune ligne de participant.');const h=rows[0].map(x=>x.trim());const full=findColumn(h,['nom complet','full name','name','participant','nom et prenom','participant name']);const first=findColumn(h,['prenom','first name','firstname','given name']);const last=findColumn(h,['nom','surname','lastname','last name','family name']);const email=findColumn(h,['email','e mail','courriel','adresse email','mail']);const company=findColumn(h,['organisation','organization','entreprise','company','societe','institution','structure']);const category=findColumn(h,['categorie','category','type','profil','acces','access']);const code=findColumn(h,['code badge','code','reference','ref','badge','ticket','identifiant']);const status=findColumn(h,['statut','status','presence','arrivee','check in','checkin','checked in']);const paymentStatus=findColumn(h,['paiement','payment','statut paiement','statut du paiement','reglement','regle','paye','payment status','paid']);const paymentAmount=findColumn(h,['montant','montant paye','montant du paiement','amount','prix','tarif','montant tnd']);const paymentMethod=findColumn(h,['moyen de paiement','mode de paiement','moyen','payment method','mode de reglement']);if(full<0&&first<0&&last<0)throw new Error('Colonne de nom introuvable. Utilisez « Nom complet » ou « Prénom » et « Nom ».');const output=[];rows.slice(1).forEach((r,i)=>{const val=n=>n>=0?String(r[n]||'').trim():'';const name=val(full)||[val(first),val(last)].filter(Boolean).join(' ');if(!name)return;const person={id:makeId('p'),name,email:val(email),company:val(company),category:parseCategory(val(category)),code:val(code),checkedIn:status>=0?parseCheckin(val(status)):false};const payStatus=paymentStatus>=0?parsePaymentStatus(val(paymentStatus)):'';const payAmount=paymentAmount>=0?parseAmount(val(paymentAmount)):0;if(payStatus)person.paymentStatus=payStatus;if(payAmount>0){person.paymentAmount=payAmount;if(!person.paymentStatus)person.paymentStatus='paid';}const payMethod=paymentMethod>=0?val(paymentMethod):'';if(payMethod&&person.paymentStatus==='paid')person.paymentMethod=payMethod;output.push(person);});if(!output.length)throw new Error('Aucun participant avec un nom valide n’a été trouvé.');return output;}
async function apiUpload(path,formData){
  let response;
  try{response=await fetch(path,{method:'POST',body:formData,cache:'no-store',credentials:'same-origin'});}catch(error){apiOnline=false;updateStatus();throw new Error('Serveur injoignable. Vérifiez la connexion puis réessayez.');}
  let data={};try{data=await response.json();}catch(e){}
  if(response.status===401){authUser=null;store.cachedUser=null;store.authCachedAt=0;saveStore();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}renderAuthScreen('login','Votre session a expiré. Reconnectez-vous.');}
  if(!response.ok)throw new Error(data.error||`Erreur serveur (${response.status}).`);
  apiOnline=true;updateStatus();return data;
}
async function exportDatabaseBackup(){
  if(authUser?.role!=='admin'){showToast('Seul un administrateur peut exporter la base.');return;}
  if(!navigator.onLine){showToast('Connectez-vous au serveur pour exporter la base.');return;}
  try{
    const response=await fetch('/api/admin/backup/export',{method:'GET',cache:'no-store',credentials:'same-origin'});
    if(response.status===401){renderAuthScreen('login','Votre session a expiré. Reconnectez-vous.');return;}
    if(!response.ok){let data={};try{data=await response.json();}catch(e){}throw new Error(data.error||`Erreur serveur (${response.status}).`);}
    const blob=await response.blob();
    const disposition=response.headers.get('Content-Disposition')||'';
    const match=disposition.match(/filename="?([^";]+)"?/i);
    const filename=match?.[1]||`imagine-events-sauvegarde-${new Date().toISOString().slice(0,10)}.zip`;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    apiOnline=true;updateStatus();showToast('Sauvegarde ZIP téléchargée. Conservez-la hors de Render.');
  }catch(error){showToast(error.message||'Export de la sauvegarde impossible.');}
}
function openRestoreBackupModal(){
  openModal(`<div class="modal-head"><div><h2>Restaurer une sauvegarde</h2><p>Le fichier <code>.zip</code> exporté depuis Comptes remplace toutes les données actuelles.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><form id="restoreBackupForm"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="restoreBackupFileInput">Fichier de sauvegarde</label><input id="restoreBackupFileInput" name="file" type="file" accept=".zip,.sqlite3,.sqlite,.db,application/zip,application/x-zip-compressed" required><div class="field-hint" id="restoreBackupFileName" style="margin-top:6px">Choisissez le fichier .zip téléchargé par « Exporter la sauvegarde ».</div></div><div class="field full"><label for="restoreBackupPassword">Mot de passe de votre compte administrateur</label><input id="restoreBackupPassword" name="password" type="password" required autocomplete="current-password"><div class="field-hint" style="margin-top:6px">Confirmation obligatoire : la restauration écrase les données actuelles. Vérifiez d’abord votre dernière sauvegarde.</div></div></div><div class="notice warning" style="margin-top:10px">${icon('info')}<span>Les sessions des autres appareils seront fermées. Votre compte reste administrateur et conserve son mot de passe ; les comptes présents dans la sauvegarde sont rétablis tels quels.</span></div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit" id="restoreBackupSubmit">${icon('upload')}Restaurer</button></div></form>`,true);
}
async function importDatabaseBackup(file,password){
  if(authUser?.role!=='admin'){showToast('Seul un administrateur peut restaurer une sauvegarde.');return false;}
  if(!navigator.onLine){showToast('Connectez-vous au serveur pour restaurer une sauvegarde.');return false;}
  const filename=String(file?.name||'').toLowerCase();
  if(!filename.endsWith('.zip')&&!filename.endsWith('.sqlite3')&&!filename.endsWith('.sqlite')&&!filename.endsWith('.db')){showToast('Choisissez le fichier .zip téléchargé par « Exporter la sauvegarde ».');return false;}
  if(file.size>50*1024*1024){showToast('La sauvegarde dépasse la limite de 50 Mo.');return false;}
  if(!window.confirm(`Restaurer « ${file.name} » ? Les congrès, inscrits, paiements, comptes et historique actuels seront remplacés par ceux de la sauvegarde. Les sessions des autres appareils seront fermées. Continuer ?`))return false;
  const submit=$('#restoreBackupSubmit');
  if(submit){submit.disabled=true;submit.textContent='Restauration…';}
  const queuesBefore=JSON.parse(JSON.stringify(store.queueByEvent||{}));
  try{
    const formData=new FormData();formData.append('file',file,file.name);formData.append('password',String(password||''));
    const data=await apiUpload('/api/admin/backup/import',formData);
    store.events=[];store.activeEventId='';store.peopleByEvent={};store.cursorByEvent={};store.queueByEvent=queuesBefore;saveStore();
    const eventsData=await api('/api/events');store.events=eventsData.events||[];chooseActiveEvent();
    if(store.activeEventId)await refreshParticipants(store.activeEventId,true);
    const restoredIds=new Set(store.events.map(e=>String(e.id)));
    const orphaned=Object.entries(queuesBefore).filter(([eventId,queue])=>Array.isArray(queue)&&queue.length&&!restoredIds.has(String(eventId))).reduce((n,[,queue])=>n+queue.length,0);
    for(const [eventId,queue] of Object.entries(queuesBefore))if(restoredIds.has(String(eventId))&&Array.isArray(queue)&&queue.length&&navigator.onLine)await syncQueue(eventId);
    const remaining=pendingTotal();
    const counts=data.restored||{};
    const detail=data.message||`Restauration : ${counts.events||0} congrès, ${counts.participants||0} inscrits, ${counts.users||0} comptes.`;
    const pendingMessage=remaining?` ${remaining} action(s) hors ligne restent à vérifier${orphaned?` (${orphaned} pour un congrès absent de la sauvegarde)`:''}.`:'';
    saveStore();render();closeModal();
    showToast(`${detail}${pendingMessage}`);
    return true;
  }catch(error){showToast(error.message||'Restauration impossible.');return false;}
  finally{if(submit){submit.disabled=false;submit.textContent='Restaurer';}}
}
async function importFile(file){
  const event=getEvent();
  if(!event){showToast('Sélectionnez un congrès avant l’import.');return;}
  if(event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le avant l’import.');return;}
  if(!navigator.onLine){showToast('L’import CSV/Excel nécessite une connexion au serveur. Les arrivées peuvent toujours être mises en attente hors ligne.');return;}
  const filename=String(file.name||'').toLowerCase();
  if(filename.endsWith('.xls')){showToast('Ce format Excel ancien (.xls) n’est pas pris en charge. Enregistrez le fichier en .xlsx ou en CSV.');return;}
  if(!filename.endsWith('.csv')&&!filename.endsWith('.xlsx')){showToast('Choisissez un fichier .csv ou un classeur Excel .xlsx.');return;}
  try{
    let data;
    if(filename.endsWith('.xlsx')){
      const formData=new FormData();formData.append('file',file,file.name);
      data=await apiUpload(`/api/events/${encodeURIComponent(event.id)}/participants/import-excel`,formData);
    }else{
      const participants=mapCSV(await file.text());
      data=await api(`/api/events/${encodeURIComponent(event.id)}/participants/import`,{method:'POST',body:JSON.stringify({participants})});
    }
    mergePeople(event.id,data.participants||[]);
    if(data.serverTime)store.cursorByEvent[event.id]=data.serverTime;
    saveStore();await refreshEvents(true);render();
    showToast(`${data.added||0} participant(s) ajouté(s), ${data.updated||0} mis à jour.`);
  }catch(error){showToast(error.message||'Import impossible.');}
}
function generateBadgeCode(){return `IE-${makeId('badge').replace(/[^a-z0-9]/gi,'').slice(-7).toUpperCase()}`;}
async function quickCheckin(query){const event=getEvent();if(!event){showToast('Créez ou sélectionnez un congrès avant le check-in.');return;}const q=norm(query);if(!q){showToast('Saisissez un nom, un e-mail ou un code badge.');return;}if(event.status==='archived'){showToast('Cet événement est archivé. Réactivez-le avant d’accueillir des participants.');return;}const list=getPeople();let exact=list.find(p=>[p.code,p.email].some(x=>norm(x)===q));if(exact){await performCheckin(exact.id,'checkin');return;}const found=list.filter(p=>[p.name,p.email,p.company,p.code].some(x=>norm(x).includes(q)));if(found.length===1){await performCheckin(found[0].id,'checkin');return;}peopleQuery=String(query).trim();setPage('people');setTimeout(()=>$('#peopleSearch')?.focus(),50);showToast(found.length?`${found.length} résultats : vérifiez l’identité avant de confirmer.`:'Aucun inscrit trouvé dans le cache de cet appareil. Vérifiez la liste ou reconnectez-vous.');}

/* ═══════════════════════════════════════════════════════════════════
   Modèles de badge : fond importé, champs placés à la souris, format
   libre, recto/verso, QR code généré hors ligne et impression sur une
   planche A4 (y compris une feuille déjà partiellement utilisée).
   ═══════════════════════════════════════════════════════════════════ */
const BADGE_FIELD_LABELS={name:'Nom',company:'Organisation',category:'Catégorie',event:'Congrès',code:'Référence',qr:'QR code',text:'Texte libre'};
const BADGE_SAMPLE_PERSON={id:'demo',name:'Amira Ben Salem',company:'Clinique Pasteur',category:'vip',code:'IE-0101',checkedIn:false};
const A4={width:210,height:297};
const BADGE_QR_OPTIONS={cellSize:4,margin:16,scalable:true,alt:''};

function defaultBadgeFields(){
  return [
    {key:'event',x:6,y:7,w:62,size:4.6,weight:700,color:'#C41E3A',align:'left',uppercase:1,text:''},
    {key:'name',x:6,y:24,w:86,size:12.5,weight:800,color:'#0B1D3A',align:'left',uppercase:0,text:''},
    {key:'company',x:6,y:55,w:62,size:6.2,weight:600,color:'#3F4F68',align:'left',uppercase:0,text:''},
    {key:'category',x:6,y:65,w:45,size:4.6,weight:700,color:'#0B1D3A',align:'left',uppercase:1,text:''},
    {key:'code',x:6,y:84,w:34,size:5.5,weight:800,color:'#0B1D3A',align:'left',uppercase:0,text:''},
    {key:'qr',x:71,y:53,w:24,size:20,weight:600,color:'#0B1D3A',align:'center',uppercase:0,text:''}
  ];
}
function defaultBadgeTemplate(){
  return {id:'',name:'Modèle de test',format:{width:90,height:60},front:{image:'',fields:defaultBadgeFields()},back:{image:'',fields:[]},qrMode:'code',qrPrefix:'',isDefault:true};
}
function badgeTemplatesForEvent(eventId=store.activeEventId){
  const list=store.badgeTemplatesByEvent?.[eventId];
  return Array.isArray(list)&&list.length?list:[defaultBadgeTemplate()];
}
function activeBadgeTemplate(eventId=store.activeEventId){
  const list=badgeTemplatesForEvent(eventId);
  return list.find(template=>template.isDefault)||list[0];
}
function badgeTemplateById(id,eventId=store.activeEventId){
  return badgeTemplatesForEvent(eventId).find(template=>String(template.id)===String(id))||null;
}
async function loadBadgeTemplates(eventId=store.activeEventId,silent=true){
  if(!eventId||!navigator.onLine)return badgeTemplatesForEvent(eventId);
  try{
    const data=await api(`/api/events/${encodeURIComponent(eventId)}/badges`);
    if(Array.isArray(data.templates)&&data.templates.length){
      store.badgeTemplatesByEvent=store.badgeTemplatesByEvent||{};
      store.badgeTemplatesByEvent[eventId]=data.templates;
      saveStore();
    }
    return badgeTemplatesForEvent(eventId);
  }catch(error){
    if(!silent)showToast(error.message||'Impossible de charger les modèles de badge.');
    return badgeTemplatesForEvent(eventId);
  }
}
function sanitizeBadgeTemplate(template){
  return {
    name:String(template?.name||'Modèle').slice(0,80),
    format:{width:Number(template?.format?.width||90),height:Number(template?.format?.height||60)},
    front:{image:String(template?.front?.image||''),fields:Array.isArray(template?.front?.fields)?template.front.fields:[]},
    back:{image:String(template?.back?.image||''),fields:Array.isArray(template?.back?.fields)?template.back.fields:[]},
    qrMode:template?.qrMode==='url'?'url':'code',
    qrPrefix:String(template?.qrPrefix||'').slice(0,300),
    isDefault:!!template?.isDefault
  };
}
async function persistBadgeTemplates(eventId,templates){
  const payload=(templates||[]).map(sanitizeBadgeTemplate);
  if(!payload.length)throw new Error('Aucun modèle à enregistrer.');
  if(!payload.some(template=>template.isDefault))payload[0].isDefault=true;
  const data=await api(`/api/events/${encodeURIComponent(eventId)}/badges`,{method:'PUT',body:JSON.stringify({templates:payload})});
  store.badgeTemplatesByEvent=store.badgeTemplatesByEvent||{};
  if(Array.isArray(data.templates)&&data.templates.length)store.badgeTemplatesByEvent[eventId]=data.templates;
  saveStore();
  return data;
}
function qrPayload(person,template){
  const code=String(person?.code||'').trim();
  if(!code)return '';
  if((template?.qrMode||'code')!=='url')return code;
  let prefix=String(template?.qrPrefix||'').trim();
  if(!prefix)prefix=`${location.origin||''}/p/`;
  if(prefix.includes('{code}'))return prefix.replace('{code}',encodeURIComponent(code));
  return prefix.replace(/\/?$/,'/')+encodeURIComponent(code);
}
function qrSvgMarkup(payload){
  if(!payload||typeof qrcode!=='function')return '';
  try{
    const qr=qrcode(0,'M');
    qr.addData(String(payload));
    qr.make();
    return qr.createSvgTag(BADGE_QR_OPTIONS);
  }catch(error){return '';}
}
function badgeFieldText(person,field){
  switch(field.key){
    case 'name':return person?.name||'';
    case 'company':return person?.company||'';
    case 'category':return person?.category?displayCategory(person.category):'';
    case 'event':return getEvent()?.name||'';
    case 'code':return person?.code||'';
    default:return field.text||'';
  }
}
function renderBadgeMarkup(person,template,side='front',options={}){
  const model=template||defaultBadgeTemplate();
  const face=(model[side]&&typeof model[side]==='object')?model[side]:{image:'',fields:[]};
  const width=Number(model?.format?.width||90)||90;
  const height=Number(model?.format?.height||60)||60;
  const dims=options.preview?'width:100%;height:100%':`width:${width}mm;height:${height}mm`;
  const mirror=!!options.mirror;
  const fields=(Array.isArray(face.fields)?face.fields:[]).map(field=>{
    const boxWidth=Number(field.w||20);
    const left=mirror?Math.max(0,100-Number(field.x||0)-boxWidth):Number(field.x||0);
    const size=Math.max(1,Number(field.size||8));
    const style=`left:${left.toFixed(2)}%;top:${Number(field.y||0).toFixed(2)}%;width:${boxWidth.toFixed(2)}%;font-size:calc(${height}mm * ${(size/100).toFixed(4)});font-size:${size.toFixed(2)}cqh;font-weight:${Number(field.weight||600)};color:${esc(field.color||'#0B1D3A')};text-align:${['left','center','right'].includes(field.align)?field.align:'left'};${field.uppercase?'text-transform:uppercase;':''}`;
    if(field.key==='qr'){
      const svg=qrSvgMarkup(qrPayload(person,model));
      return `<div class="bd-field bd-qr" data-field="qr" style="${style}">${svg||'<span class="bd-qr-missing">QR</span>'}</div>`;
    }
    return `<div class="bd-field" data-field="${esc(field.key)}" style="${style}">${esc(badgeFieldText(person,field))}</div>`;
  }).join('');
  const background=face.image?`<img class="bd-bg" src="${face.image}" alt="">`:'';
  return `<div class="bd ${esc(options.extraClass||'')}" style="${dims}">${background}${fields}</div>`;
}
function badgeHasBack(template){
  const back=template?.back;
  return !!(back&&((back.image&&String(back.image).length)||(Array.isArray(back.fields)&&back.fields.length)));
}
function badgeFrame(person,template,side='front',extra=''){
  const model=template||activeBadgeTemplate();
  const width=Number(model?.format?.width||90)||90;
  const height=Number(model?.format?.height||60)||60;
  return `<div class="bd-frame ${esc(extra)}" style="aspect-ratio:${width}/${height}">${renderBadgeMarkup(person,model,side,{preview:true})}</div>`;
}
function badgeHTML(person,template,side='front'){return badgeFrame(person,template||activeBadgeTemplate(),side);}

/* ── Page « Badges » ──────────────────────────────────────────────── */
async function setDefaultBadgeTemplate(id){
  const event=getEvent();
  if(!event)return;
  if(event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour changer de modèle.');return;}
  const list=badgeTemplatesForEvent(event.id).map(template=>({...template,isDefault:String(template.id)===String(id)}));
  store.badgeTemplatesByEvent=store.badgeTemplatesByEvent||{};
  store.badgeTemplatesByEvent[event.id]=list;
  saveStore();
  render();
  try{await persistBadgeTemplates(event.id,list);showToast('Modèle de badge actif mis à jour.');}
  catch(error){showToast(error.message||'Modèle non enregistré sur le serveur.');}
}
function renderBadges(){
  const event=getEvent();
  const templates=badgeTemplatesForEvent(event?.id);
  const model=activeBadgeTemplate(event?.id);
  const list=filteredBadgePeople();
  const archived=event?.status==='archived';
  const format=`${Number(model?.format?.width||90)} × ${Number(model?.format?.height||60)} mm`;
  return `<div class="badge-tools"><div class="badge-tools-main"><span class="badge-tools-icon">${icon('badge',17)}</span><span><strong>${esc(model?.name||'Modèle de test')} · ${format}</strong><small>${badgeHasBack(model)?'Recto-verso · ':'Recto seul · '}${(model?.qrMode==='url')?'QR code vers le site':'QR code = référence du badge'} · champs placés dans l’atelier de modèle.</small></span></div><div class="badge-tools-actions">${templates.length>1?`<select id="badgeModelSelect" class="event-select" aria-label="Modèle de badge actif">${templates.map(template=>`<option value="${esc(template.id)}" ${template.isDefault?'selected':''}>${esc(template.name)}</option>`).join('')}</select>`:''}<button class="btn btn-secondary" type="button" data-action="badge-studio" ${archived?'disabled':''}>${icon('file')}Modèles de badge</button><button class="btn btn-primary" type="button" data-action="print-all" ${list.length?'':'disabled'}>${icon('printer')}Imprimer ${list.length} badge${list.length===1?'':'s'}</button></div></div>
  <div class="toolbar"><div class="search-wrap">${icon('search')}<input id="badgeSearch" class="search-input" value="${esc(badgeQuery)}" placeholder="Rechercher un participant…" autocomplete="off" aria-label="Filtrer les badges"></div><span class="count-label">${list.length} badge${list.length===1?'':'s'}</span></div>
  ${list.length?`<div class="badge-grid">${list.map(person=>`<article class="badge-item">${badgeHTML(person,model)}<div class="badge-meta"><strong>${esc(person.name)}</strong><span class="cat-badge ${categoryClass(person.category)}">${esc(displayCategory(person.category))}</span></div><div class="badge-buttons"><button class="btn btn-secondary btn-sm" type="button" data-action="badge" data-id="${esc(person.id)}">${icon('eye',12)}Aperçu</button><button class="btn btn-primary btn-sm" type="button" data-action="print-badge" data-id="${esc(person.id)}">${icon('printer',12)}Imprimer</button></div></article>`).join('')}</div>`:`<div class="table-card"><div class="empty-state"><strong>${getPeople().length?'Aucun résultat':'Aucun participant à afficher'}</strong>Importez ou ajoutez des inscrits pour préparer les badges.</div></div>`}
  <div class="footnote">${icon('info')}<span>L’impression part du navigateur : choisissez « 100 % », marges « Aucune » et activez les graphiques d’arrière-plan pour conserver votre visuel.</span></div>`;
}

/* ── Atelier de modèle : import du visuel, placement des champs ────── */
let studio=null;
function studioTemplate(){
  if(!studio)return null;
  return studio.templates[studio.index]||null;
}
function studioFace(){
  const model=studioTemplate();
  if(!model)return null;
  if(!model[studio.side]||typeof model[studio.side]!=='object')model[studio.side]={image:'',fields:[]};
  if(!Array.isArray(model[studio.side].fields))model[studio.side].fields=[];
  return model[studio.side];
}
function openBadgeStudio(index=0,side='front'){
  const event=getEvent();
  if(!event){showToast('Sélectionnez un congrès avant de créer un modèle de badge.');return;}
  if(event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour modifier ses badges.');return;}
  const list=JSON.parse(JSON.stringify(badgeTemplatesForEvent(event.id)));
  studio={eventId:event.id,templates:list,index:Math.min(Math.max(index,0),list.length-1),side:side==='back'?'back':'front',selected:0,drag:null};
  studioShellRender();
}
function studioShellRender(){
  openModal(studioShell(),true);
  $('#modalRoot .modal')?.classList.add('studio-modal');
  bindStudioEvents();
  renderStudio();
}
function studioShell(){
  const model=studioTemplate();
  const sample=getPeople()[0]||BADGE_SAMPLE_PERSON;
  return `<div id="studioRoot"><div class="modal-head"><div><h2>Modèles de badge</h2><p>Importez votre visuel, puis placez chaque information à la souris : l’aperçu correspond à l’impression.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <div class="modal-body studio-body">
    <div class="studio-left">
      <div class="studio-topbar">
        <div class="studio-tabs"><button type="button" class="studio-tab ${studio.side==='front'?'active':''}" data-action="studio-side" data-side="front">Recto</button><button type="button" class="studio-tab ${studio.side==='back'?'active':''}" data-action="studio-side" data-side="back">Verso</button></div>
        <span class="field-hint">Exemple : ${esc(sample.name||'—')} · ${esc(sample.code||'—')}</span>
      </div>
      <div class="studio-canvas-wrap"><div id="studioCanvas" tabindex="0"></div><div class="studio-pos" id="studioPos" hidden></div></div>
      <div class="field-hint studio-tip">Glissez un bloc pour le placer (Maj = pas de 1 %), ou ajustez-le finement avec les flèches du clavier. Cliquez pour régler taille, couleur et alignement.</div>
    </div>
    <div class="studio-right">
      <div class="field"><label for="studioModelSelect">Modèle</label><select id="studioModelSelect">${studio.templates.map((item,i)=>`<option value="${i}" ${i===studio.index?'selected':''}>${esc(item.name||('Modèle '+(i+1)))}</option>`).join('')}</select></div>
      <div class="studio-row"><button class="btn btn-secondary btn-sm" type="button" data-action="studio-new">${icon('plus')}Nouveau</button><button class="btn btn-secondary btn-sm" type="button" data-action="studio-duplicate">Dupliquer</button><button class="btn btn-danger btn-sm" type="button" data-action="studio-delete" ${studio.templates.length<2?'disabled':''}>Supprimer</button></div>
      <div class="field"><label for="studioModelName">Nom du modèle</label><input id="studioModelName" maxlength="80" value="${esc(model?.name||'')}"></div>
      <div class="studio-row2"><div class="field"><label for="studioFmtW">Largeur (mm)</label><input id="studioFmtW" type="number" min="30" max="300" step="0.5" value="${Number(model?.format?.width||90)}"></div><div class="field"><label for="studioFmtH">Hauteur (mm)</label><input id="studioFmtH" type="number" min="30" max="300" step="0.5" value="${Number(model?.format?.height||60)}"></div></div>
      <label class="print-check"><input id="studioIsDefault" type="checkbox" ${model?.isDefault?'checked':''}> Utiliser ce modèle par défaut</label>
      <div class="studio-block"><div class="studio-block-head"><strong>Fond du ${studio.side==='front'?'recto':'verso'}</strong><span class="field-hint">PNG, JPEG, WebP ou SVG</span></div><div class="studio-row"><label class="btn btn-secondary btn-sm studio-file">${icon('upload')}Importer mon visuel<input id="studioImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label><button class="btn btn-secondary btn-sm" type="button" data-action="studio-image-clear">Retirer</button></div><div class="field-hint" id="studioImageName">${studioFace()?.image?'Visuel importé pour cette face.':'Aucun visuel : fond blanc, les champs restent imprimés.'}</div></div>
      <div class="studio-block"><div class="studio-block-head"><strong>Champs</strong><span class="field-hint">${(studioFace()?.fields||[]).length} bloc(s)</span></div>
        <div class="studio-field-list">${(studioFace()?.fields||[]).map((field,index)=>`<button type="button" class="studio-field-chip ${index===studio.selected?'active':''}" data-action="studio-pick" data-index="${index}">${esc(BADGE_FIELD_LABELS[field.key]||field.key)}</button>`).join('')||'<span class="field-hint">Aucun champ sur cette face.</span>'}</div>
        <div class="studio-add-row">${['name','company','category','event','code','qr','text'].map(key=>`<button type="button" class="btn btn-soft btn-sm" data-action="studio-add" data-key="${key}">+ ${esc(BADGE_FIELD_LABELS[key])}</button>`).join('')}</div>
      </div>
      <div class="studio-block" id="studioProps"></div>
      <div class="studio-block"><div class="studio-block-head"><strong>QR code</strong><span class="field-hint">Généré hors ligne</span></div>
        <div class="field"><label for="studioQrMode">Contenu du QR</label><select id="studioQrMode"><option value="code" ${(model?.qrMode||'code')==='code'?'selected':''}>Référence du badge (IE-0101)</option><option value="url" ${model?.qrMode==='url'?'selected':''}>Lien vers le site</option></select></div>
        <div class="field" id="studioQrPrefixWrap" ${model?.qrMode==='url'?'':'hidden'}><label for="studioQrPrefix">Adresse du lien</label><input id="studioQrPrefix" maxlength="300" value="${esc(model?.qrPrefix||'')}" placeholder="${esc((location.origin||'')+'/p/')}"><div class="field-hint">Le code du badge est ajouté à la fin du lien. Laissez vide pour utiliser ce site (…/p/CODE).</div></div>
      </div>
    </div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="studio-reset">Rétablir le modèle de test</button><div style="display:flex;gap:8px"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="button" data-action="studio-save">${icon('check')}Enregistrer les modèles</button></div></div></div>`;
}
function renderStudio(){
  const model=studioTemplate();
  if(!model)return;
  renderStudioPreviewOnly();
  renderStudioProps();
  const nameInput=$('#studioModelName');if(nameInput)nameInput.value=model.name||'';
  const fmtW=$('#studioFmtW');if(fmtW)fmtW.value=Number(model.format?.width||90);
  const fmtH=$('#studioFmtH');if(fmtH)fmtH.value=Number(model.format?.height||60);
  const isDefault=$('#studioIsDefault');if(isDefault)isDefault.checked=!!model.isDefault;
  const qrMode=$('#studioQrMode');if(qrMode)qrMode.value=model.qrMode||'code';
  const qrPrefix=$('#studioQrPrefix');if(qrPrefix)qrPrefix.value=model.qrPrefix||'';
  $('#studioQrPrefixWrap')?.toggleAttribute('hidden',(model.qrMode||'code')!=='url');
  const imageName=$('#studioImageName');
  if(imageName)imageName.textContent=studioFace()?.image?'Visuel importé pour cette face.':'Aucun visuel : fond blanc, les champs restent imprimés.';
  const select=$('#studioModelSelect');if(select)select.value=String(studio.index);
  $$('.studio-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.side===studio.side));
  $$('.studio-field-chip').forEach(chip=>chip.classList.toggle('active',Number(chip.dataset.index)===studio.selected));
}
function renderStudioPreviewOnly(){
  const model=studioTemplate();
  const face=studioFace();
  const canvas=$('#studioCanvas');
  if(!canvas||!model||!face)return;
  const sample=getPeople()[0]||BADGE_SAMPLE_PERSON;
  const width=Number(model.format?.width||90)||90;
  const height=Number(model.format?.height||60)||60;
  canvas.innerHTML=`<div class="bd-frame bd-frame-studio" style="aspect-ratio:${width}/${height}">${renderBadgeMarkup(sample,model,studio.side,{preview:true,extraClass:'bd-studio'})}</div>`;
  (canvas.querySelectorAll('[data-field]')||[]).forEach((node,index)=>{
    node.dataset.index=String(index);
    node.addEventListener('pointerdown',event=>studioDragStart(event,index));
    if(index===studio.selected)node.classList.add('selected');
  });
}
function renderStudioProps(){
  const box=$('#studioProps');
  if(!box)return;
  const face=studioFace();
  const field=face?.fields?.[studio.selected];
  if(!field){box.innerHTML='<div class="studio-block-head"><strong>Réglages du champ</strong></div><div class="field-hint">Sélectionnez un bloc sur l’aperçu, ou ajoutez-en un.</div>';return;}
  const height=Number(studioTemplate()?.format?.height||60);
  box.innerHTML=`<div class="studio-block-head"><strong>Réglages : ${esc(BADGE_FIELD_LABELS[field.key]||field.key)}</strong><button class="link-button" type="button" data-action="studio-remove">Retirer ce champ</button></div>
    ${field.key==='text'?`<div class="field"><label for="propText">Texte affiché</label><input id="propText" maxlength="120" value="${esc(field.text||'')}"></div>`:''}
    <div class="studio-row2"><div class="field"><label for="propSize">Taille (${Math.round(Number(field.size||8)*height/100*10)/10} mm)</label><input id="propSize" type="number" min="1" max="60" step="0.5" value="${Number(field.size||8)}"></div><div class="field"><label for="propWidth">Largeur du bloc (%)</label><input id="propWidth" type="number" min="2" max="100" step="1" value="${Number(field.w||20)}"></div></div>
    <div class="studio-row2"><div class="field"><label for="propWeight">Graisse</label><select id="propWeight">${[300,400,500,600,700,800,900].map(weight=>`<option value="${weight}" ${Number(field.weight||600)===weight?'selected':''}>${weight}</option>`).join('')}</select></div><div class="field"><label for="propAlign">Alignement</label><select id="propAlign">${['left','center','right'].map(align=>`<option value="${align}" ${(field.align||'left')===align?'selected':''}>${align==='left'?'Gauche':align==='center'?'Centré':'Droite'}</option>`).join('')}</select></div></div>
    <div class="studio-row2"><div class="field"><label for="propColor">Couleur</label><input id="propColor" type="color" value="${esc(/^#[0-9a-fA-F]{6}$/.test(field.color||'')?field.color:'#0B1D3A')}"></div><div class="field"><label for="propUpper">Majuscules</label><select id="propUpper"><option value="0" ${!field.uppercase?'selected':''}>Non</option><option value="1" ${field.uppercase?'selected':''}>Oui</option></select></div></div>
    <div class="field-hint" id="studioPosHint">Position : ${Number(field.x||0).toFixed(1)} % · ${Number(field.y||0).toFixed(1)} % — ${(Number(field.x||0)/100*Number(studioTemplate()?.format?.width||90)).toFixed(1)} × ${(Number(field.y||0)/100*height).toFixed(1)} mm</div>`;
}
function bindStudioEvents(){
  const root=$('#studioRoot');
  if(!root)return;
  root.addEventListener('input',event=>{
    const id=event.target.id;
    const model=studioTemplate();
    const face=studioFace();
    const field=face?.fields?.[studio.selected];
    if(id==='studioModelName'&&model)model.name=event.target.value;
    if(id==='studioFmtW'&&model){model.format={...(model.format||{}),width:Math.max(30,Math.min(300,Number(event.target.value)||90))};renderStudio();}
    if(id==='studioFmtH'&&model){model.format={...(model.format||{}),height:Math.max(30,Math.min(300,Number(event.target.value)||60))};renderStudio();}
    if(id==='studioQrMode'&&model){model.qrMode=event.target.value;renderStudio();}
    if(id==='studioQrPrefix'&&model)model.qrPrefix=event.target.value;
    if(id==='studioIsDefault'&&model){model.isDefault=!!event.target.checked;}
    if(field){
      if(id==='propText'){field.text=event.target.value;renderStudioPreviewOnly();}
      if(id==='propSize'){field.size=Math.max(1,Math.min(60,Number(event.target.value)||8));renderStudioPreviewOnly();}
      if(id==='propWidth'){field.w=Math.max(2,Math.min(100,Number(event.target.value)||20));renderStudioPreviewOnly();}
      if(id==='propWeight'){field.weight=Number(event.target.value)||600;renderStudioPreviewOnly();}
      if(id==='propAlign'){field.align=event.target.value;renderStudioPreviewOnly();}
      if(id==='propColor'){field.color=event.target.value;renderStudioPreviewOnly();}
      if(id==='propUpper'){field.uppercase=event.target.value==='1'?1:0;renderStudioPreviewOnly();}
    }
  });
  root.addEventListener('keydown',event=>{
    if(event.target.closest?.('input,select,textarea'))return;
    const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const step=steps[event.key];
    if(!step)return;
    const factor=event.shiftKey?4:1;
    if(studioNudge(step[0]*factor,step[1]*factor))event.preventDefault();
  });
  root.addEventListener('change',async event=>{
    if(event.target.id==='studioModelSelect'){studio.index=Number(event.target.value)||0;studio.selected=0;renderStudio();}
    if(event.target.id==='studioIsDefault'){
      const current=studioTemplate();
      if(current){studio.templates.forEach(item=>{item.isDefault=item===current;});}
    }
    if(event.target.id==='studioImageInput'){
      const file=event.target.files?.[0];
      event.target.value='';
      if(file)await studioImportImage(file);
    }
  });
}
function markStudioSelection(index){
  const changed=studio.selected!==index;
  studio.selected=index;
  $$('#studioCanvas [data-field]').forEach(node=>{node.classList.toggle('selected',Number(node.dataset.index)===index);});
  $$('.studio-field-chip').forEach(chip=>chip.classList.toggle('active',Number(chip.dataset.index)===index));
  /* On ne reconstruit le panneau que si le champ change : aucun saut de mise en page. */
  if(changed)renderStudioProps();
}
const studioRaf=typeof requestAnimationFrame==='function'?requestAnimationFrame:(fn)=>setTimeout(fn,16);
const studioCancelRaf=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:(id)=>clearTimeout(id);
function showStudioPos(x,y){
  const model=studioTemplate();
  const pill=$('#studioPos');
  if(!model)return;
  const width=Number(model.format?.width||90), height=Number(model.format?.height||60);
  const text=`${(x/100*width).toFixed(1)} × ${(y/100*height).toFixed(1)} mm`;
  if(pill){pill.hidden=false;pill.textContent=`${text} · ${x.toFixed(1)} % / ${y.toFixed(1)} %`;}
  const hint=$('#studioPosHint');
  if(hint)hint.textContent=`Position : ${x.toFixed(1)} % · ${y.toFixed(1)} % — ${text}`;
}
function hideStudioPos(){const pill=$('#studioPos');if(pill)pill.hidden=true;}
function studioDragStart(event,index){
  const model=studioTemplate();
  const face=studioFace();
  if(!model||!face||!face.fields[index])return;
  if(typeof event.button==='number'&&event.button>0)return;
  const node=event.currentTarget;
  const badge=node.closest?.('.bd');
  if(!badge)return;
  event.preventDefault();
  markStudioSelection(index);
  const field=face.fields[index];
  const rect=badge.getBoundingClientRect();
  studio.drag={
    index,node,badge,rect,
    startX:event.clientX,startY:event.clientY,
    originX:Number(field.x||0),originY:Number(field.y||0),
    x:Number(field.x||0),y:Number(field.y||0),
    maxX:Math.max(0,100-Number(field.w||20)),
    frame:0
  };
  node.classList.add('dragging');
  badge.classList.add('is-dragging');
  document.body.classList.add('studio-dragging');
  try{node.setPointerCapture?.(event.pointerId);}catch(error){}
  try{$('#studioCanvas')?.focus?.({preventScroll:true});}catch(error){}
  document.addEventListener('pointermove',studioDragMove,{passive:false});
  document.addEventListener('pointerup',studioDragEnd);
  document.addEventListener('pointercancel',studioDragEnd);
  showStudioPos(studio.drag.x,studio.drag.y);
}
function studioDragMove(event){
  const drag=studio?.drag;
  if(!drag)return;
  if(event.pointerType!=='touch'&&event.buttons===0){studioDragEnd();return;}
  if(event.cancelable)event.preventDefault();
  const dx=(event.clientX-drag.startX)/Math.max(drag.rect.width,1)*100;
  const dy=(event.clientY-drag.startY)/Math.max(drag.rect.height,1)*100;
  let x=drag.originX+dx, y=drag.originY+dy;
  if(event.shiftKey){x=Math.round(x);y=Math.round(y);}
  drag.x=Math.max(0,Math.min(drag.maxX,x));
  drag.y=Math.max(0,Math.min(100,y));
  /* Un seul déplacement par image : le glisser reste fluide même à 120 Hz. */
  if(!drag.frame)drag.frame=studioRaf(studioDragPaint);
}
function studioDragPaint(){
  const drag=studio?.drag;
  if(!drag)return;
  drag.frame=0;
  const px=(drag.x-drag.originX)/100*drag.rect.width;
  const py=(drag.y-drag.originY)/100*drag.rect.height;
  drag.node.style.transform=`translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0)`;
  showStudioPos(drag.x,drag.y);
}
function studioDragEnd(){
  document.removeEventListener('pointermove',studioDragMove);
  document.removeEventListener('pointerup',studioDragEnd);
  document.removeEventListener('pointercancel',studioDragEnd);
  document.body.classList.remove('studio-dragging');
  const drag=studio?.drag;
  if(!drag)return;
  if(drag.frame)studioCancelRaf(drag.frame);
  studio.drag=null;
  const face=studioFace();
  const field=face?.fields?.[drag.index];
  if(field){
    field.x=Math.round(drag.x*10)/10;
    field.y=Math.round(drag.y*10)/10;
    drag.node.style.left=`${field.x}%`;
    drag.node.style.top=`${field.y}%`;
  }
  drag.node.style.transform='';
  drag.node.style.willChange='';
  drag.node.classList.remove('dragging');
  drag.badge.classList.remove('is-dragging');
  hideStudioPos();
  renderStudioProps();
}
function studioNudge(dx,dy){
  const face=studioFace();
  if(!face)return false;
  const field=face.fields[studio.selected];
  if(!field)return false;
  const step=0.5;
  field.x=Math.round(Math.max(0,Math.min(100-Number(field.w||20),Number(field.x||0)+dx*step))*10)/10;
  field.y=Math.round(Math.max(0,Math.min(100,Number(field.y||0)+dy*step))*10)/10;
  const node=$(`#studioCanvas [data-field][data-index="${studio.selected}"]`);
  if(node){node.style.left=`${field.x}%`;node.style.top=`${field.y}%`;}
  showStudioPos(field.x,field.y);
  return true;
}
function studioAddField(key){
  const face=studioFace();
  if(!face)return;
  if(face.fields.length>=40){showToast('40 blocs maximum par face.');return;}
  const base={key:'text',x:8,y:40,w:60,size:7,weight:600,color:'#0B1D3A',align:'left',uppercase:0,text:''};
  const presets={
    name:{key:'name',x:6,y:32,w:88,size:13,weight:800},
    company:{key:'company',x:6,y:52,w:62,size:6.2,weight:600,color:'#3F4F68'},
    category:{key:'category',x:6,y:63,w:45,size:4.6,weight:700,uppercase:1},
    event:{key:'event',x:6,y:88,w:62,size:4.6,weight:700,color:'#5E6F87',uppercase:1},
    code:{key:'code',x:6,y:74,w:40,size:5.5,weight:800},
    qr:{key:'qr',x:71,y:53,w:24,size:20,weight:600,align:'center'},
    text:{key:'text',x:8,y:70,w:55,size:7,weight:600,text:'Texte libre',uppercase:0}
  };
  face.fields.push({...base,...(presets[key]||{})});
  studio.selected=face.fields.length-1;
  renderStudio();
  $$('.studio-field-chip').forEach(chip=>chip.classList.toggle('active',Number(chip.dataset.index)===studio.selected));
}
function studioRemoveField(){
  const face=studioFace();
  if(!face||!face.fields.length)return;
  face.fields.splice(studio.selected,1);
  studio.selected=Math.max(0,Math.min(studio.selected,face.fields.length-1));
  renderStudio();
}
function studioNew(){
  if(!studio)return;
  if(studio.templates.length>=12){showToast('12 modèles maximum par congrès.');return;}
  const source=studioTemplate();
  const model=defaultBadgeTemplate();
  model.name=`Modèle ${studio.templates.length+1}`;
  model.format={...(source?.format||model.format)};
  model.isDefault=false;
  studio.templates.push(model);
  studio.index=studio.templates.length-1;
  studio.selected=0;
  studioShellRender();
}
function studioDuplicate(){
  if(!studio)return;
  if(studio.templates.length>=12){showToast('12 modèles maximum par congrès.');return;}
  const copy=JSON.parse(JSON.stringify(studioTemplate()));
  copy.name=`${String(copy.name||'Modèle').slice(0,70)} (copie)`;
  copy.isDefault=false;
  studio.templates.splice(studio.index+1,0,copy);
  studio.index+=1;
  studio.selected=0;
  studioShellRender();
}
function studioDelete(){
  if(!studio)return;
  if(studio.templates.length<2){showToast('Gardez au moins un modèle.');return;}
  studio.templates.splice(studio.index,1);
  studio.index=Math.max(0,studio.index-1);
  studio.selected=0;
  studioShellRender();
}
function studioReset(){
  if(!studio)return;
  const current=studioTemplate();
  if(!current)return;
  const fresh=defaultBadgeTemplate();
  fresh.name='Modèle de test';
  fresh.isDefault=!!current.isDefault||studio.templates.length===1;
  studio.templates[studio.index]=fresh;
  studio.selected=0;
  studio.side='front';
  studioShellRender();
  showToast('Modèle de test rétabli. Enregistrez pour appliquer.');
}
async function studioImportImage(file){
  if(!file)return;
  if(file.size>8*1024*1024){showToast('Image trop lourde : 8 Mo maximum avant compression.');return;}
  try{
    const dataUrl=await shrinkImageFile(file,1600,0.82);
    if(String(dataUrl).length>2300000){showToast('Image encore trop lourde après compression. Utilisez un visuel plus simple (JPEG).');return;}
    const face=studioFace();
    if(!face)return;
    face.image=dataUrl;
    renderStudio();
    showToast('Visuel importé. Placez maintenant les champs sur l’image.');
  }catch(error){showToast(error.message||'Import de l’image impossible.');}
}
function studioClearImage(){
  const face=studioFace();
  if(!face)return;
  face.image='';
  renderStudio();
}
function shrinkImageFile(file,maxSide=1600,quality=0.82){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Lecture du fichier impossible.'));
    reader.onload=()=>{
      const raw=String(reader.result||'');
      if(!/^data:image\//.test(raw)){reject(new Error('Ce fichier n’est pas une image.'));return;}
      if(/^data:image\/svg\+xml/.test(raw)){resolve(raw);return;}
      const image=new Image();
      image.onerror=()=>resolve(raw);
      image.onload=()=>{
        try{
          const scale=Math.min(1,maxSide/Math.max(image.width||1,image.height||1));
          const width=Math.max(1,Math.round((image.width||1)*scale));
          const height=Math.max(1,Math.round((image.height||1)*scale));
          const canvas=document.createElement('canvas');
          canvas.width=width;canvas.height=height;
          const context=canvas.getContext('2d');
          if(!context){resolve(raw);return;}
          context.drawImage(image,0,0,width,height);
          const png=/^data:image\/png/.test(raw);
          resolve(canvas.toDataURL(png?'image/png':'image/jpeg',quality));
        }catch(error){resolve(raw);}
      };
      image.src=raw;
    };
    reader.readAsDataURL(file);
  });
}
async function saveBadgeStudio(){
  const event=getEvent();
  if(!event||!studio)return false;
  if(!studio.templates.some(template=>template.isDefault))studio.templates[0].isDefault=true;
  try{
    const data=await persistBadgeTemplates(event.id,studio.templates);
    studio=null;
    closeModal();
    render();
    showToast(`Modèles de badge enregistrés : ${(data.templates||[]).length}.`);
    return true;
  }catch(error){showToast(error.message||'Enregistrement des modèles impossible.');return false;}
}

/* ── Impression : un badge par page ou planche A4 réutilisable ─────── */
let printStartCell=0;
let printState={list:[],label:''};
function computeSheetCells(config,model){
  const badgeW=Number(model?.format?.width||90);
  const badgeH=Number(model?.format?.height||60);
  const sheet=config.sheet||{};
  const usableW=A4.width-Number(sheet.marginLeft||0)-Number(sheet.marginRight||0);
  const usableH=A4.height-Number(sheet.marginTop||0)-Number(sheet.marginBottom||0);
  const stepX=badgeW+Math.max(0,Number(sheet.gapX||0));
  const stepY=badgeH+Math.max(0,Number(sheet.gapY||0));
  const cols=Math.max(1,Math.floor((usableW+0.01)/stepX));
  const rows=Math.max(1,Math.floor((usableH+0.01)/stepY));
  const positions=[];
  for(let row=0;row<rows;row+=1){
    for(let col=0;col<cols;col+=1){
      positions.push({
        x:Number(sheet.marginLeft||0)+col*stepX+Number(sheet.offsetX||0),
        y:Number(sheet.marginTop||0)+row*stepY+Number(sheet.offsetY||0),
        row,col
      });
    }
  }
  return {badgeW,badgeH,cols,rows,perPage:positions.length,positions};
}
function openPrintModal(list,label='badges'){
  const event=getEvent();
  if(!event){showToast('Sélectionnez un congrès avant d’imprimer des badges.');return;}
  const people=(Array.isArray(list)?list:[]).filter(Boolean);
  if(!people.length){showToast('Aucun inscrit à imprimer.');return;}
  const templates=badgeTemplatesForEvent(event.id);
  const model=activeBadgeTemplate(event.id);
  printStartCell=0;
  printState={list:people,label};
  openModal(`<div class="modal-head"><div><h2>Imprimer les badges</h2><p>${people.length} ${people.length>1?'inscrits':'inscrit'} · ${esc(label)} · ${esc(event.name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <form id="printForm"><div class="modal-body">
    <div class="print-grid">
      <div class="field"><label for="printTemplate">Modèle</label><select id="printTemplate">${templates.map(template=>`<option value="${esc(template.id)}" ${template.isDefault?'selected':''}>${esc(template.name)}${template.isDefault?' (par défaut)':''}</option>`).join('')}</select></div>
      <div class="field"><label for="printCopies">Exemplaires par personne</label><input id="printCopies" type="number" min="1" max="6" step="1" value="1"></div>
      <div class="field"><label for="printLayout">Disposition</label><select id="printLayout"><option value="sheet">Planche A4 (plusieurs badges)</option><option value="page">Un badge par page</option></select></div>
      <div class="field"><label for="printDuplex">Recto-verso</label><select id="printDuplex"><option value="no">Recto seulement</option><option value="yes" ${badgeHasBack(model)?'':'disabled'}>Recto puis verso${badgeHasBack(model)?'':' (aucun verso défini)'}</option></select></div>
    </div>
    <div id="printSheetOptions" class="print-sheet-options">
      <div class="print-grid four">
        <div class="field"><label for="printMarginTop">Marge haut (mm)</label><input id="printMarginTop" type="number" min="0" max="60" step="1" value="10"></div>
        <div class="field"><label for="printMarginLeft">Marge gauche (mm)</label><input id="printMarginLeft" type="number" min="0" max="60" step="1" value="10"></div>
        <div class="field"><label for="printMarginRight">Marge droite (mm)</label><input id="printMarginRight" type="number" min="0" max="60" step="1" value="10"></div>
        <div class="field"><label for="printMarginBottom">Marge bas (mm)</label><input id="printMarginBottom" type="number" min="0" max="60" step="1" value="10"></div>
        <div class="field"><label for="printGapX">Écart horizontal (mm)</label><input id="printGapX" type="number" min="0" max="30" step="1" value="3"></div>
        <div class="field"><label for="printGapY">Écart vertical (mm)</label><input id="printGapY" type="number" min="0" max="30" step="1" value="3"></div>
        <div class="field"><label for="printOffsetX">Décalage fin X (mm)</label><input id="printOffsetX" type="number" min="-20" max="20" step="0.5" value="0"></div>
        <div class="field"><label for="printOffsetY">Décalage fin Y (mm)</label><input id="printOffsetY" type="number" min="-20" max="20" step="0.5" value="0"></div>
      </div>
      <div class="field"><label>Première case libre</label><div id="printSheetPicker" class="sheet-picker"></div><div class="field-hint">Feuille déjà entamée : cliquez sur la première case encore libre. L’impression démarre là et laisse le papier déjà imprimé intact.</div></div>
      <label class="print-check"><input id="printCut" type="checkbox"> Ajouter des repères de coupe aux angles</label>
    </div>
    <div class="notice" style="margin-top:12px">${icon('info')}<span id="printSummary">—</span></div>
    <div class="notice warning" style="margin-top:8px">${icon('info')}<span>Dans la fenêtre d’impression : marges « Aucune », échelle <strong>100 %</strong>, et « Graphiques d’arrière-plan » activé si votre visuel est un fond de couleur. Les images importées s’impriment dans tous les cas.</span></div>
  </div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">${icon('printer')}Imprimer</button></div></form>`,true);
  const form=$('#printForm');
  form?.addEventListener('input',()=>updatePrintSummary());
  form?.addEventListener('change',event=>{if(['printLayout','printTemplate','printDuplex','printCut'].includes(event.target.id))updatePrintSummary();});
  updatePrintSummary();
}
function printConfig(){
  const model=badgeTemplateById($('#printTemplate')?.value)||activeBadgeTemplate();
  const num=(selector,fallback)=>{const value=Number($(selector)?.value);return Number.isFinite(value)?value:fallback;};
  return {
    template:model,
    copies:Math.max(1,Math.min(6,Math.round(num('#printCopies',1)))),
    layout:$('#printLayout')?.value==='page'?'page':'sheet',
    duplex:$('#printDuplex')?.value==='yes'&&badgeHasBack(model),
    cut:!!$('#printCut')?.checked,
    sheet:{
      marginTop:num('#printMarginTop',10),marginLeft:num('#printMarginLeft',10),
      marginRight:num('#printMarginRight',10),marginBottom:num('#printMarginBottom',10),
      gapX:num('#printGapX',3),gapY:num('#printGapY',3),
      offsetX:num('#printOffsetX',0),offsetY:num('#printOffsetY',0),
      start:printStartCell
    }
  };
}
function updatePrintSummary(){
  const config=printConfig();
  const total=(printState.list||[]).length*config.copies;
  const summary=$('#printSummary');
  const picker=$('#printSheetPicker');
  const sheetOptions=$('#printSheetOptions');
  const sheetMode=config.layout==='sheet';
  sheetOptions?.classList.toggle('is-off',!sheetMode);
  let cells=null;
  if(picker){
    cells=computeSheetCells(config,config.template);
    if(printStartCell>=cells.perPage)printStartCell=0;
    picker.innerHTML=`<div class="sheet-picker-grid" style="grid-template-columns:repeat(${cells.cols},minmax(0,1fr))">${cells.positions.map((position,index)=>`<button type="button" class="sheet-cell ${index<printStartCell?'used':''} ${index===printStartCell?'start':''}" data-action="print-cell" data-index="${index}" title="Case ${index+1}">${index+1}</button>`).join('')}</div>`;
  }
  if(!summary)return;
  if(!sheetMode){
    const pages=total*(config.duplex?2:1);
    summary.textContent=`${total} badge(s) · 1 badge par page au format ${Number(config.template?.format?.width||90)} × ${Number(config.template?.format?.height||60)} mm · ${pages} page(s)${config.duplex?' (recto puis verso)':''}.`;
    return;
  }
  cells=cells||computeSheetCells(config,config.template);
  const free=Math.max(0,cells.perPage-printStartCell);
  const pages=total?1+Math.ceil(Math.max(0,total-free)/cells.perPage):0;
  summary.textContent=`${cells.perPage} badge(s) par feuille A4 (${cells.cols} × ${cells.rows}) · ${total} badge(s) · environ ${pages} feuille(s)${config.duplex?' · recto + verso':''}${printStartCell?` · départ à la case ${printStartCell+1}`:''}.`;
}
function printBadges(list,config){
  const model=config.template||activeBadgeTemplate();
  const width=Number(model?.format?.width||90);
  const height=Number(model?.format?.height||60);
  const people=[];
  (list||[]).forEach(person=>{for(let copy=0;copy<config.copies;copy+=1)people.push(person);});
  if(!people.length)return;
  const pages=[];
  if(config.layout==='page'){
    people.forEach(person=>{
      pages.push(`<div class="print-page">${renderBadgeMarkup(person,model,'front',{extraClass:'bd-print'})}</div>`);
      if(config.duplex)pages.push(`<div class="print-page">${renderBadgeMarkup(person,model,'back',{extraClass:'bd-print',mirror:true})}</div>`);
    });
    executePrint(pages.join(''),`${width}mm ${height}mm`,`${width}mm`,`${height}mm`);
    return;
  }
  const cells=computeSheetCells(config,model);
  const sheetPages=new Map();
  let slot=Number(config.sheet?.start||0);
  people.forEach(person=>{
    const pageNumber=Math.floor(slot/cells.perPage);
    if(!sheetPages.has(pageNumber))sheetPages.set(pageNumber,[]);
    sheetPages.get(pageNumber).push({person,position:cells.positions[slot%cells.perPage]});
    slot+=1;
  });
  Array.from(sheetPages.keys()).sort((a,b)=>a-b).forEach(pageNumber=>{
    const entries=sheetPages.get(pageNumber);
    pages.push(renderSheetPage(entries,model,config,false,cells));
    if(config.duplex)pages.push(renderSheetPage(entries,model,config,true,cells));
  });
  executePrint(pages.join(''),'A4 portrait','210mm','297mm');
}
function renderSheetPage(entries,model,config,mirror,cells){
  const badges=entries.map(({person,position})=>{
    const left=mirror?Math.max(0,A4.width-position.x-cells.badgeW):position.x;
    const style=`left:${left.toFixed(2)}mm;top:${position.y.toFixed(2)}mm`;
    const cut=config.cut?'<span class="bd-cut tl"></span><span class="bd-cut tr"></span><span class="bd-cut bl"></span><span class="bd-cut br"></span>':'';
    return `<div class="print-badge" style="${style}">${renderBadgeMarkup(person,model,mirror?'back':'front',{mirror,extraClass:'bd-print'})}${cut}</div>`;
  }).join('');
  return `<div class="print-page print-sheet">${badges}</div>`;
}
function executePrint(html,pageSize,pageWidth,pageHeight){
  const area=$('#printArea');
  if(!area){window.print();return;}
  area.innerHTML=html;
  let style=document.getElementById('printPageStyle');
  if(!style){style=document.createElement('style');style.id='printPageStyle';document.head.appendChild(style);}
  style.textContent=`@page{size:${pageSize};margin:0}html{--print-w:${pageWidth};--print-h:${pageHeight}}`;
  setTimeout(()=>window.print(),180);
}
window.addEventListener('afterprint',()=>{
  const area=$('#printArea');
  if(area)area.innerHTML='';
  document.getElementById('printPageStyle')?.remove();
});
function filteredBadgePeople(){
  return getPeople().filter(person=>!badgeQuery||[person.name,person.company,person.code,displayCategory(person.category)].join(' ').toLocaleLowerCase('fr').includes(norm(badgeQuery)));
}
let badgeQueryHandled=false;
async function focusBadgeFromQuery(){
  if(badgeQueryHandled)return;
  let code='';
  try{code=new URLSearchParams(location.search).get('badge')||'';}catch(e){return;}
  if(!code)return;
  badgeQueryHandled=true;
  try{history.replaceState(null,'',location.pathname);}catch(e){}
  const target=getPeople().find(person=>norm(person.code)===norm(code));
  if(!target){showToast(`Aucun inscrit ne porte la référence ${code}.`);return;}
  currentPage='people';
  render();
  openDetails(target.id);
}
function printBadge(id){
  const person=findPerson(id);
  if(!person){showToast('Inscrit introuvable.');return;}
  openPrintModal([person],'un badge');
}

/* ═══════════════════════════════════════════════════════════════════
   Corbeille des inscrits : suppression réversible, restauration et
   effacement définitif (réservé aux administrateurs).
   ═══════════════════════════════════════════════════════════════════ */
let peopleSelection=new Set();
function selectedPeople(){return getPeople().filter(person=>peopleSelection.has(String(person.id)));}
function pruneSelection(){const existing=new Set(getPeople().map(person=>String(person.id)));peopleSelection=new Set([...peopleSelection].filter(id=>existing.has(id)));}
function trashCount(eventId=store.activeEventId){return Number(store.trashCountByEvent?.[eventId]||0);}
function setTrashCount(eventId,count){store.trashCountByEvent=store.trashCountByEvent||{};store.trashCountByEvent[eventId]=Math.max(0,Number(count||0));}
function refreshSelectionBar(){
  const bar=$('#selectionBar');
  if(!bar)return;
  const total=selectedPeople().length;
  bar.hidden=total===0;
  const label=$('#selectionCount');
  if(label)label.textContent=`${total} inscrit${total===1?'':'s'} sélectionné${total===1?'':'s'}`;
  const master=$('#peopleSelectAll');
  if(master)master.checked=total>0&&total===filteredPeople().length;
}
function togglePersonSelection(id,checked,box){
  const key=String(id);
  if(checked)peopleSelection.add(key);else peopleSelection.delete(key);
  const row=box?.closest?.('tr');
  if(row)row.classList.toggle('row-selected',!!checked);
  refreshSelectionBar();
}
function selectAllVisible(checked){
  const list=filteredPeople();
  if(checked)list.forEach(person=>peopleSelection.add(String(person.id)));
  else peopleSelection.clear();
  $$('#peopleRows [data-select-id]').forEach(box=>{box.checked=checked;});
  refreshSelectionBar();
}
function canPurge(){return authUser?.role==='admin';}
function requireOnline(){
  if(navigator.onLine)return true;
  showToast('Connexion au serveur nécessaire pour modifier la liste des inscrits.');
  return false;
}
function dropFromStore(eventId,ids){
  const drop=new Set((ids||[]).map(String));
  if(!drop.size)return;
  store.peopleByEvent[eventId]=(store.peopleByEvent[eventId]||[]).filter(person=>!drop.has(String(person.id)));
  store.queueByEvent[eventId]=(store.queueByEvent[eventId]||[]).filter(op=>!drop.has(String(op.participantId)));
  peopleSelection=new Set([...peopleSelection].filter(id=>!drop.has(id)));
}
async function loadTrash(silent=true){
  const event=getEvent();
  if(!event||!navigator.onLine)return store.trashByEvent?.[store.activeEventId]||[];
  try{
    const data=await api(`/api/events/${encodeURIComponent(event.id)}/participants?trash=1`);
    store.trashByEvent=store.trashByEvent||{};
    store.trashByEvent[event.id]=Array.isArray(data.participants)?data.participants:[];
    setTrashCount(event.id,data.trashCount??store.trashByEvent[event.id].length);
    saveStore();
    return store.trashByEvent[event.id];
  }catch(error){
    if(!silent)showToast(error.message||'Impossible de charger la corbeille.');
    return [];
  }
}
async function trashPeople(ids){
  const event=getEvent();
  if(!event)return false;
  const list=(ids||[]).map(String).filter(Boolean);
  if(!list.length)return false;
  if(event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour supprimer des inscrits.');return false;}
  if(!requireOnline())return false;
  try{
    const data=await api(`/api/events/${encodeURIComponent(event.id)}/participants/trash`,{method:'POST',body:JSON.stringify({ids:list})});
    dropFromStore(event.id,data.ids||list);
    setTrashCount(event.id,data.trashCount);
    store.trashByEvent=store.trashByEvent||{};
    store.trashByEvent[event.id]=null;
    saveStore();
    closeModal();
    render();
    showToast(data.already&&!data.moved
      ? `${data.already} inscrit(s) déjà dans la corbeille.`
      : `${data.moved} inscrit${data.moved===1?'':'s'} déplacé${data.moved===1?'':'s'} dans la corbeille.`);
    return true;
  }catch(error){showToast(error.message||'Suppression impossible.');return false;}
}
async function restorePeople(ids){
  const event=getEvent();
  if(!event)return false;
  const list=(ids||[]).map(String).filter(Boolean);
  if(!list.length){showToast('Sélectionnez au moins un inscrit.');return false;}
  if(!requireOnline())return false;
  try{
    const data=await api(`/api/events/${encodeURIComponent(event.id)}/participants/restore`,{method:'POST',body:JSON.stringify({ids:list})});
    const restored=(data.participants||[]).map(person=>({...person,deletedAt:'',deletedBy:''}));
    if(restored.length)mergePeople(event.id,restored);
    setTrashCount(event.id,data.trashCount);
    const cache=store.trashByEvent?.[event.id];
    if(Array.isArray(cache))store.trashByEvent[event.id]=cache.filter(person=>!list.includes(String(person.id)));
    saveStore();
    render();
    if(currentPage==='people'&&$('#trashRoot'))await openTrashModal(true);
    showToast(`${data.restored} inscrit${data.restored===1?'':'s'} restauré${data.restored===1?'':'s'}.`);
    return true;
  }catch(error){showToast(error.message||'Restauration impossible.');return false;}
}
async function purgePeople(ids,all=false){
  const event=getEvent();
  if(!event)return false;
  if(!canPurge()){showToast('Seul un administrateur peut effacer définitivement des inscrits.');return false;}
  if(!requireOnline())return false;
  const list=(ids||[]).map(String).filter(Boolean);
  if(!all&&!list.length)return false;
  try{
    const body=all?{all:true}:{ids:list};
    const data=await api(`/api/events/${encodeURIComponent(event.id)}/participants/purge`,{method:'POST',body:JSON.stringify(body)});
    setTrashCount(event.id,data.trashCount);
    const cache=store.trashByEvent?.[event.id];
    store.trashByEvent=store.trashByEvent||{};
    store.trashByEvent[event.id]=all?[]:(Array.isArray(cache)?cache.filter(person=>!list.includes(String(person.id))):null);
    saveStore();
    closeModal();
    render();
    if($('#trashRoot')||currentPage==='people')openTrashModal(true);
    showToast(`${data.purged} inscrit${data.purged===1?'':'s'} effacé${data.purged===1?'':'s'} définitivement.`);
    return true;
  }catch(error){showToast(error.message||'Effacement impossible.');return false;}
}
// ── Corbeille des congrès (30 jours) ──
function forgetEventLocally(eventId){
  const key=String(eventId);
  ['peopleByEvent','cursorByEvent','queueByEvent','pricesByEvent','badgeTemplatesByEvent','trashCountByEvent','trashByEvent'].forEach(name=>{
    if(store[name]&&typeof store[name]==='object')delete store[name][key];
  });
  if(String(store.activeEventId)===key){store.activeEventId='';chooseActiveEvent();}
}
async function openTrashEventConfirm(id){
  const event=getEvent(id);
  if(!event)return;
  if(!canPurge()){showToast('Seul un administrateur peut mettre un congrès à la corbeille.');return;}
  if(!requireOnline())return;
  const stats=makeStats(id);
  openModal(`<div class="modal-head"><div><h2>Mettre le congrès à la corbeille</h2><p>${esc(event.name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <div class="modal-body">
    <div class="detail-grid"><div class="detail-cell"><span>Inscrits</span><strong>${stats.total}</strong></div><div class="detail-cell"><span>Arrivées confirmées</span><strong>${stats.arrived}</strong></div><div class="detail-cell"><span>Paiements encaissés</span><strong>${stats.paid}</strong></div><div class="detail-cell"><span>Montant encaissé</span><strong class="money">${esc(money(stats.collected,event))}</strong></div></div>
    <div class="notice">${icon('info')}<span>Le congrès quitte la liste, le sélecteur, le desk et les exports. <strong>Rien n’est perdu</strong> : il reste dans la <em>corbeille des congrès</em> et peut être restauré à tout moment pendant <strong>30 jours</strong>.</span></div>
    <div class="notice warning" style="margin-top:11px">${icon('clock')}<span>Passé ce délai, il sera <strong>effacé définitivement</strong> avec ses inscrits, ses arrivées, ses paiements, sa grille tarifaire et ses modèles de badge.</span></div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-danger" type="button" data-action="trash-event-do" data-id="${esc(event.id)}">${icon('trash')}Mettre à la corbeille</button></div>`,true);
}
async function trashEvent(id){
  if(!canPurge()){showToast('Seul un administrateur peut mettre un congrès à la corbeille.');return false;}
  if(!requireOnline())return false;
  try{
    const data=await api(`/api/events/${encodeURIComponent(id)}/trash`,{method:'POST',body:'{}'});
    store.events=(store.events||[]).filter(e=>String(e.id)!==String(id));
    store.trashEvents=Array.isArray(data.trash)?data.trash:getEventTrash();
    forgetEventLocally(id);
    saveStore();closeModal();render();
    showToast(`« ${data.name||'Congrès'} » est dans la corbeille pour ${Number(data.retentionDays||30)} jours.`);
    await refreshEvents(true);
    return true;
  }catch(error){showToast(error.message||'Mise à la corbeille impossible.');return false;}
}
async function restoreEvent(id){
  if(!requireOnline())return false;
  try{
    const data=await api(`/api/events/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});
    store.trashEvents=(Array.isArray(data.trash)?data.trash:getEventTrash()).filter(e=>String(e.id)!==String(id));
    saveStore();closeModal();
    await refreshEvents(true);
    const restored=store.events.find(e=>String(e.id)===String(id));
    if(restored){
      store.activeEventId=restored.id;currentPage='home';saveStore();render();
      await Promise.all([refreshParticipants(restored.id,true),loadPrices(restored.id),loadBadgeTemplates(restored.id)]);
    }else render();
    showToast(`« ${data.name||'Congrès'} » restauré avec toutes ses données.`);
    return true;
  }catch(error){showToast(error.message||'Restauration impossible.');return false;}
}
async function openPurgeEventConfirm(id,name){
  const entry=eventTrashEntry(id);
  if(!entry&&!name)return;
  if(!canPurge()){showToast('Seul un administrateur peut effacer définitivement un congrès.');return;}
  if(!requireOnline())return;
  openModal(`<div class="modal-head"><div><h2>Effacer définitivement</h2><p>${esc(entry?.name||name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <div class="modal-body">
    <div class="notice warning">${icon('info')}<span><strong>Cette action est irréversible.</strong> Le congrès, ses ${Number(entry?.total||0)} inscrit${Number(entry?.total||0)===1?'':'s'}, ses arrivées, ses paiements, sa grille tarifaire et ses modèles de badge seront retirés de la base.</span></div>
    <label class="print-check"><input id="purgeEventConfirm" type="checkbox"> Je comprends et je confirme l’effacement définitif de ce congrès</label>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-danger" type="button" data-action="purge-event-do" data-id="${esc(id)}" id="purgeEventButton" disabled>${icon('trash')}Effacer définitivement</button></div>`,true);
}
async function purgeEvent(id){
  if(!canPurge()){showToast('Seul un administrateur peut effacer définitivement un congrès.');return false;}
  if(!requireOnline())return false;
  try{
    const data=await api(`/api/events/${encodeURIComponent(id)}/purge`,{method:'POST',body:'{}'});
    store.trashEvents=(Array.isArray(data.trash)?data.trash:getEventTrash()).filter(e=>String(e.id)!==String(id));
    forgetEventLocally(id);
    saveStore();closeModal();render();
    showToast(`« ${data.name||'Congrès'} » effacé définitivement.`);
    await refreshEvents(true);
    return true;
  }catch(error){showToast(error.message||'Effacement impossible.');return false;}
}

function trashPreviewList(people){
  return `<ul class="trash-list">${people.slice(0,8).map(person=>`<li><strong>${esc(person.name)}</strong><span>${esc(person.code||'—')} · ${esc(displayCategory(person.category))}</span></li>`).join('')}${people.length>8?`<li class="more">et ${people.length-8} autre(s)…</li>`:''}</ul>`;
}
function openTrashConfirm(ids){
  const people=getPeople().filter(person=>(ids||[]).map(String).includes(String(person.id)));
  if(!people.length){showToast('Sélectionnez au moins un inscrit.');return;}
  const event=getEvent();
  if(event?.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour supprimer des inscrits.');return;}
  openModal(`<div class="modal-head"><div><h2>Mettre à la corbeille</h2><p>${people.length} inscrit${people.length===1?'':'s'} · ${esc(event?.name||'')}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <div class="modal-body">
    ${trashPreviewList(people)}
    <div class="notice">${icon('info')}<span>Les inscrits quittent la liste, les compteurs, les badges et l’export. <strong>Rien n’est perdu</strong> : ils restent dans la <em>corbeille</em> du congrès et peuvent être restaurés à tout moment.</span></div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-danger" type="button" data-action="trash-do" data-ids="${esc(ids.join(','))}">${icon('trash')}Mettre à la corbeille</button></div>`,true);
}
async function openTrashModal(refresh=false){
  const event=getEvent();
  if(!event)return;
  const list=refresh?await loadTrash(false):(Array.isArray(store.trashByEvent?.[event.id])?store.trashByEvent[event.id]:await loadTrash(false));
  const people=Array.isArray(list)?list:[];
  const admin=canPurge();
  const rows=people.length?people.map(person=>`<div class="trash-row"><div class="trash-person"><strong>${esc(person.name)}</strong><span>${esc(person.code||'—')} · ${esc(displayCategory(person.category))} · ${esc(person.company||'sans organisation')}</span><small>Supprimé le ${esc(dateTimeLabel(person.deletedAt))}${person.deletedBy?` par ${esc(person.deletedBy)}`:''}</small></div><div class="trash-actions"><button class="btn btn-secondary btn-sm" type="button" data-action="restore-person" data-id="${esc(person.id)}">${icon('rotate',12)}Restaurer</button>${admin?`<button class="icon-action danger" type="button" data-action="purge-person" data-id="${esc(person.id)}" title="Effacer définitivement" aria-label="Effacer définitivement">${icon('trash',13)}</button>`:''}</div></div>`).join(''):`<div class="empty-state"><strong>La corbeille est vide</strong>Aucun inscrit supprimé pour ce congrès.</div>`;
  openModal(`<div id="trashRoot"><div class="modal-head"><div><h2>Corbeille</h2><p>${people.length} inscrit${people.length===1?'':'s'} supprimé${people.length===1?'':'s'} · ${esc(event.name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <div class="modal-body">
    <div class="notice">${icon('info')}<span>Un inscrit dans la corbeille n’apparaît plus dans la liste, les compteurs, les badges ni l’export. <strong>Restaurer</strong> le remet exactement comme avant (arrivée et paiement compris).</span></div>
    <div class="trash-list-wrap">${rows}</div>
    ${people.length&&!admin?`<div class="field-hint" style="margin-top:12px">L’effacement définitif est réservé à l’administrateur ; la restauration reste ouverte à tous les comptes.</div>`:''}
    ${people.length&&admin?`<label class="print-check" style="margin-top:14px"><input id="purgeAllConfirm" type="checkbox"> Je comprends que vider la corbeille efface définitivement ces inscrits</label>`:''}
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Fermer</button>${people.length&&admin?`<button class="btn btn-danger" type="button" data-action="purge-all" id="purgeAllButton" disabled>${icon('trash')}Vider la corbeille</button>`:''}</div></div>`,true);
}
function openPurgeConfirm(ids,all=false){
  const event=getEvent();
  if(!event)return;
  if(!canPurge()){showToast('Seul un administrateur peut effacer définitivement des inscrits.');return;}
  openModal(`<div class="modal-head"><div><h2>Effacer définitivement</h2><p>${all?'Toute la corbeille':'Inscrit sélectionné'} · ${esc(event.name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <div class="modal-body">
    <div class="notice warning">${icon('info')}<span><strong>Cette action est définitive.</strong> Les inscrits et leurs paiements seront retirés de la base : aucune restauration ne sera possible, y compris depuis une sauvegarde plus ancienne.</span></div>
    <label class="print-check"><input id="purgeConfirm" type="checkbox"> Je comprends et je confirme l’effacement définitif</label>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="open-trash">Annuler</button><button class="btn btn-danger" type="button" data-action="purge-do" data-ids="${esc((ids||[]).join(','))}" data-all="${all?'1':'0'}" id="purgeButton" disabled>${icon('trash')}Effacer définitivement</button></div>`,true);
}

// Navigation et actions de l’interface.
document.addEventListener('click',async event=>{
  const page=event.target.closest('[data-page]');if(page){event.preventDefault();setPage(page.dataset.page);return;}
  const filter=event.target.closest('[data-filter]');if(filter){peopleFilter=filter.dataset.filter;render();return;}
  const button=event.target.closest('[data-action]');if(!button){if(event.target.classList.contains('modal-backdrop'))closeModal();return;}
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='auth-retry'){await boot();return;}
  else if(action==='accounts'){await openAccountsModal();return;}
  else if(action==='own-password'){openOwnPasswordModal();return;}
  else if(action==='logout'){await logout();return;}
  else if(action==='toggle-user'){await toggleAccount(button);return;}
  else if(action==='reset-user'){openResetPasswordModal(id,button.dataset.username);return;}
  else if(action==='pick-tariff'){pickTariff(id,button.dataset.price);return;}
  else if(action==='open-prices'){openPricesModal();return;}
  else if(action==='price-add'){addPriceRow();return;}
  else if(action==='price-template'){applyPriceTemplate();return;}
  else if(action==='price-remove'){button.closest('.price-row')?.remove();updatePriceSummary();return;}
  else if(action==='export-db'){await exportDatabaseBackup();return;}
  else if(action==='restore-backup'){openRestoreBackupModal();return;}
  else if(action==='new-event')openEventModal();
  else if(action==='settings'){const ev=getEvent();if(ev)openEventModal(ev);else openEventModal();}
  else if(action==='edit-event')openEventModal(getEvent(id));
  else if(action==='trash-event'){await openTrashEventConfirm(id);return;}
  else if(action==='trash-event-do'){await trashEvent(id);return;}
  else if(action==='restore-event'){await restoreEvent(id);return;}
  else if(action==='purge-event'){await openPurgeEventConfirm(id,button.dataset.name||'');return;}
  else if(action==='purge-event-do'){await purgeEvent(id);return;}
  else if(action==='close-modal')closeModal();
  else if(action==='add-person')openAddModal();
  else if(action==='import-csv'){if(!getEvent())showToast('Sélectionnez un congrès avant l’import.');else openImportModal();}
  else if(action==='select-import-file'){closeModal();$('#csvFile').click();}
  else if(action==='templates')openImportModal();
  else if(action==='template'||action==='template-csv')downloadTemplate();
  else if(action==='template-xlsx')downloadExcelTemplate();
  else if(action==='export')exportCSV();
  else if(action==='go-people')setPage('people');
  else if(action==='open-event'){store.activeEventId=id;peopleQuery='';peopleFilter='all';badgeQuery='';currentPage='home';saveStore();render();await Promise.all([refreshParticipants(id,!store.cursorByEvent[id]),loadPrices(id),loadBadgeTemplates(id)]);await syncQueue(id);}
  else if(action==='badge-studio'){openBadgeStudio();return;}
  else if(action==='studio-side'){if(studio){studio.side=button.dataset.side==='back'?'back':'front';studio.selected=0;renderStudio();}return;}
  else if(action==='studio-pick'){if(studio){markStudioSelection(Number(button.dataset.index)||0);}return;}
  else if(action==='studio-add'){studioAddField(button.dataset.key||'text');return;}
  else if(action==='studio-remove'){studioRemoveField();return;}
  else if(action==='studio-new'){studioNew();return;}
  else if(action==='studio-duplicate'){studioDuplicate();return;}
  else if(action==='studio-delete'){studioDelete();return;}
  else if(action==='studio-reset'){studioReset();return;}
  else if(action==='studio-save'){await saveBadgeStudio();return;}
  else if(action==='studio-image-clear'){studioClearImage();return;}
  else if(action==='print-all'){openPrintModal(filteredBadgePeople(),'tous les badges');return;}
  else if(action==='print-cell'){printStartCell=Number(button.dataset.index)||0;updatePrintSummary();return;}
  else if(action==='details')openDetails(id);
  else if(action==='open-trash'){await openTrashModal();return;}
  else if(action==='trash-person'){openTrashConfirm([id]);return;}
  else if(action==='trash-selected'){const ids=[...peopleSelection];if(!ids.length){showToast('Sélectionnez au moins un inscrit.');return;}openTrashConfirm(ids);return;}
  else if(action==='trash-do'){await trashPeople(String(button.dataset.ids||'').split(',').filter(Boolean));return;}
  else if(action==='clear-selection'){peopleSelection.clear();render();return;}
  else if(action==='restore-person'){await restorePeople([id]);return;}
  else if(action==='purge-person'){openPurgeConfirm([id]);return;}
  else if(action==='purge-all'){openPurgeConfirm([],true);return;}
  else if(action==='purge-do'){await purgePeople(String(button.dataset.ids||'').split(',').filter(Boolean),button.dataset.all==='1');return;}
  else if(action==='badge')openBadgeModal(id);
  else if(action==='print-badge')printBadge(id);
  else if(action==='checkin'){closeModal();await performCheckin(id,'checkin');}
  else if(action==='checkin-force'){closeModal();await performCheckin(id,'checkin',true);}
  else if(action==='payment'){openPaymentModal(id,{thenCheckin:button.dataset.thenCheckin==='1'});}
  else if(action==='payment-reset'){closeModal();await applyPayment(id,{status:'unpaid'});}
  else if(action==='undo'){closeModal();await performCheckin(id,'undo');}
  else if(action==='help')openHelp();
  else if(action==='sync-now'){await syncQueue();await refreshParticipants(store.activeEventId,true);}
});
document.addEventListener('change',async event=>{
  if(event.target.id==='peopleSelectAll'){selectAllVisible(event.target.checked);return;}
  if(event.target.matches&&event.target.matches('[data-select-id]')){togglePersonSelection(event.target.dataset.selectId,event.target.checked,event.target);return;}
  if(event.target.id==='purgeConfirm'){const confirmButton=$('#purgeButton');if(confirmButton)confirmButton.disabled=!event.target.checked;return;}
  if(event.target.id==='purgeAllConfirm'){const allButton=$('#purgeAllButton');if(allButton)allButton.disabled=!event.target.checked;return;}
  if(event.target.id==='purgeEventConfirm'){const purgeEventButton=$('#purgeEventButton');if(purgeEventButton)purgeEventButton.disabled=!event.target.checked;return;}
  if(event.target.id==='paymentStatus'){const paid=event.target.value==='paid';['paymentAmount','paymentMethod','paymentReference'].forEach(id=>{const field=$('#'+id);if(field)field.disabled=!paid;});}
  if(event.target.matches('[data-user-role]')){const id=event.target.dataset.id,role=event.target.value;try{await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({role})});showToast('Rôle mis à jour; ce compte devra se reconnecter.');await openAccountsModal();}catch(error){showToast(error.message||'Modification impossible.');await openAccountsModal();}return;}
  if(event.target.id==='badgeModelSelect'){await setDefaultBadgeTemplate(event.target.value);return;}
  if(event.target.id==='eventSelect'){const id=event.target.value;store.activeEventId=id;currentPage='home';peopleQuery='';peopleFilter='all';badgeQuery='';peopleSelection.clear();saveStore();render();if(id){await Promise.all([refreshParticipants(id,!store.cursorByEvent[id]),loadPrices(id),loadBadgeTemplates(id)]);await syncQueue(id);}}
  if(event.target.id==='csvFile'){const file=event.target.files?.[0];if(file)await importFile(file);event.target.value='';}
  if(event.target.closest?.('#priceRows')){updatePriceSummary();}
  if(event.target.id==='restoreBackupFileInput'){const file=event.target.files?.[0];const label=$('#restoreBackupFileName');if(label)label.textContent=file?`Fichier choisi : ${file.name} (${(file.size/1024).toFixed(0)} Ko)`:'Choisissez le fichier .zip téléchargé par « Exporter la sauvegarde ».';}
});
document.addEventListener('input',event=>{
  if(event.target.id==='peopleSearch'){peopleQuery=event.target.value;renderPeopleRows();}
  if(event.target.id==='badgeSearch'){badgeQuery=event.target.value;const position=event.target.selectionStart;render();const next=$('#badgeSearch');if(next){next.focus();try{next.setSelectionRange(position,position);}catch(e){}}}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeModal();
  if(event.key==='Enter'&&event.target.id==='peopleSearch'){const query=norm(event.target.value);const p=getPeople().find(x=>norm(x.code)===query);if(p){event.preventDefault();if(p.checkedIn)showToast(`${p.name} est déjà enregistré comme arrivé.`);else performCheckin(p.id,'checkin');}}
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id==='printForm'){event.preventDefault();const config=printConfig();const list=printState.list||[];closeModal();printBadges(list,config);return;}
  if(form.id==='setupForm'){
    event.preventDefault();const fd=new FormData(form),username=String(fd.get('username')||'').trim(),password=String(fd.get('password')||''),confirm=String(fd.get('passwordConfirm')||''),setupToken=String(fd.get('setupToken')||'');
    if(password!==confirm){renderAuthScreen('setup','Les deux mots de passe ne correspondent pas.');return;}
    try{const data=await api('/api/auth/setup',{method:'POST',body:JSON.stringify({username,password,setupToken})});store.logoutPending=false;store.cachedUser=data.user;store.authCachedAt=Date.now();await enterWorkspace(data.user,false);showToast('Compte administrateur créé.');}catch(error){renderAuthScreen('setup',error.message||'Création du compte impossible.');}return;
  }
  if(form.id==='loginForm'){
    event.preventDefault();const fd=new FormData(form);try{if(store.logoutPending){await api('/api/auth/logout',{method:'POST',body:JSON.stringify({})});store.logoutPending=false;saveStore();}const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:String(fd.get('username')||'').trim(),password:String(fd.get('password')||'')})});await enterWorkspace(data.user,false);showToast('Connexion réussie.');}catch(error){renderAuthScreen('login',error.message||'Connexion impossible.');}return;
  }
  if(form.id==='createAccountForm'){
    event.preventDefault();const fd=new FormData(form),password=String(fd.get('password')||''),confirm=String(fd.get('passwordConfirm')||'');if(password!==confirm){showToast('Les deux mots de passe ne correspondent pas.');return;}
    try{const data=await api('/api/users',{method:'POST',body:JSON.stringify({username:String(fd.get('username')||'').trim(),password,role:String(fd.get('role')||'desk')})});closeModal();showToast(`Compte ${data.user.username} créé.`);await openAccountsModal();}catch(error){showToast(error.message||'Création du compte impossible.');}return;
  }
  if(form.id==='resetPasswordForm'){
    event.preventDefault();const fd=new FormData(form),password=String(fd.get('password')||''),confirm=String(fd.get('passwordConfirm')||''),id=form.dataset.id;if(password!==confirm){showToast('Les deux mots de passe ne correspondent pas.');return;}
    try{await api(`/api/users/${encodeURIComponent(id)}/password`,{method:'POST',body:JSON.stringify({password})});closeModal();showToast('Mot de passe réinitialisé; les sessions de ce compte ont été fermées.');await openAccountsModal();}catch(error){showToast(error.message||'Réinitialisation impossible.');}return;
  }
  if(form.id==='pricesForm'){
    event.preventDefault();await savePrices();return;
  }
  if(form.id==='restoreBackupForm'){
    event.preventDefault();const fd=new FormData(form),file=fd.get('file'),password=String(fd.get('password')||'');
    if(!file||!file.name){showToast('Choisissez d’abord le fichier .zip de la sauvegarde.');return;}
    await importDatabaseBackup(file,password);return;
  }
  if(form.id==='ownPasswordForm'){
    event.preventDefault();const fd=new FormData(form),newPassword=String(fd.get('newPassword')||''),confirm=String(fd.get('passwordConfirm')||'');if(newPassword!==confirm){showToast('Les nouveaux mots de passe ne correspondent pas.');return;}
    try{await api('/api/auth/password',{method:'POST',body:JSON.stringify({currentPassword:String(fd.get('currentPassword')||''),newPassword})});store.authCachedAt=Date.now();saveStore();closeModal();showToast('Votre mot de passe a été changé.');}catch(error){showToast(error.message||'Modification impossible.');}return;
  }
  if(form.id==='quickForm'){event.preventDefault();const query=new FormData(form).get('query');form.reset();await quickCheckin(query);return;}
  if(form.id==='eventForm'){
    event.preventDefault();const fd=new FormData(form),id=form.dataset.id;const payload={name:String(fd.get('name')||'').trim(),date:String(fd.get('date')||''),venue:String(fd.get('venue')||'').trim(),currency:String(fd.get('currency')||'TND').trim().toUpperCase()};if(!payload.name){showToast('Le nom du congrès est obligatoire.');return;}if(id)payload.status=String(fd.get('status')||'active');
    try{if(id){await api(`/api/events/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});await refreshEvents(true);store.activeEventId=id;showToast('Paramètres du congrès enregistrés.');}else{const data=await api('/api/events',{method:'POST',body:JSON.stringify(payload)});if(data.event)store.events=[data.event,...store.events.filter(x=>x.id!==data.event.id)];store.activeEventId=data.event?.id||'';currentPage='home';lastEventsRefresh=0;showToast('Congrès créé. Vous pouvez importer votre liste.');}saveStore();closeModal();render();}catch(error){showToast(error.message||'Enregistrement impossible.');}return;
  }
  if(form.id==='paymentForm'){
    event.preventDefault();const fd=new FormData(form),id=form.dataset.id,thenCheckin=form.dataset.thenCheckin==='1';
    const payload={status:String(fd.get('status')||'unpaid'),amount:String(fd.get('amount')||''),method:String(fd.get('method')||''),reference:String(fd.get('reference')||''),tariff:String(fd.get('tariff')||'')};
    closeModal();
    const saved=await applyPayment(id,payload);
    if(saved&&thenCheckin)await performCheckin(id,'checkin',true);
    return;
  }
  if(form.id==='personForm'){
    event.preventDefault();const ev=getEvent();if(!ev){showToast('Aucun congrès sélectionné.');return;}if(ev.status==='archived'){closeModal();showToast('Ce congrès est archivé. Réactivez-le avant d’ajouter des inscrits.');return;}const fd=new FormData(form),name=String(fd.get('name')||'').trim();if(!name)return;const person={id:makeId('p'),eventId:ev.id,name,email:String(fd.get('email')||'').trim(),company:String(fd.get('company')||'').trim(),category:String(fd.get('category')||'participant'),code:String(fd.get('code')||'').trim()||generateBadgeCode(),checkedIn:false,checkedInAt:'',updatedAt:new Date().toISOString()};queuePersonCreate(person,ev.id);closeModal();currentPage='people';peopleFilter='all';peopleQuery='';render();showToast(`${person.name} ajouté${navigator.onLine?'':' localement — synchronisation en attente'}.`);if(navigator.onLine)await syncQueue(ev.id);return;
  }
});
$('#eventSelect').addEventListener('change',()=>{}); // Les changements sont gérés par le listener délégué ci-dessus.
window.addEventListener('online',async()=>{apiOnline=false;updateStatus();if(store.logoutPending){try{await api('/api/auth/logout',{method:'POST',body:JSON.stringify({})});store.logoutPending=false;saveStore();renderAuthScreen('login','Déconnexion serveur finalisée. Reconnectez-vous pour continuer.');}catch(e){}return;}if(!authUser)return;if(store.activeEventId){await syncQueue(store.activeEventId);await refreshParticipants(store.activeEventId,true);}await refreshEvents(true);});
window.addEventListener('offline',()=>{apiOnline=false;updateStatus();if(authUser)showToast('Connexion interrompue. Le mode de secours local est actif.');});
document.addEventListener('visibilitychange',()=>{if(authUser&&!document.hidden&&navigator.onLine){refreshEvents(true);if(store.activeEventId){syncQueue(store.activeEventId);refreshParticipants(store.activeEventId,false);}}});
boot();
