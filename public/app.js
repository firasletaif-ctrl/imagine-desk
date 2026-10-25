'use strict';

const STORAGE_KEY = 'imagine-events-desk-platform-v1';
const categoryNames = { participant:'Participant', vip:'VIP', speaker:'Intervenant', press:'Presse', team:'Équipe' };
const defaultStore = { events:[], activeEventId:'', peopleByEvent:{}, cursorByEvent:{}, queueByEvent:{}, deviceId:'', cachedUser:null, authCachedAt:0, logoutPending:false };
function loadStore(){
  try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(saved&&typeof saved==='object') return {...defaultStore,...saved,events:Array.isArray(saved.events)?saved.events:[],peopleByEvent:saved.peopleByEvent||{},cursorByEvent:saved.cursorByEvent||{},queueByEvent:saved.queueByEvent||{},deviceId:saved.deviceId||''}; }
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
    cash:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g[name]||g.info}</svg>`;
}
function renderStaticIcons(){ $$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);}); }
function saveStore(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch(e){console.warn('Impossible d’enregistrer le cache local.',e);}}
function getEvent(id=store.activeEventId){return store.events.find(e=>String(e.id)===String(id))||null;}
function getPeople(eventId=store.activeEventId){if(!eventId)return []; if(!Array.isArray(store.peopleByEvent[eventId]))store.peopleByEvent[eventId]=[];return store.peopleByEvent[eventId];}
function getQueue(eventId=store.activeEventId){if(!eventId)return [];if(!Array.isArray(store.queueByEvent[eventId]))store.queueByEvent[eventId]=[];return store.queueByEvent[eventId];}
function findPerson(id,eventId=store.activeEventId){return getPeople(eventId).find(p=>String(p.id)===String(id));}
function displayCategory(key){return categoryNames[key]||'Participant';}
function categoryClass(key){return ['vip','speaker','press','team'].includes(key)?key:'participant';}
const paymentStatusNames={paid:'Payé',unpaid:'Non payé',exempt:'Exonéré'};
const paymentMethodNames={cash:'Espèces',card:'Carte bancaire',transfer:'Virement',cheque:'Chèque',mobile:'Paiement mobile',other:'Autre'};
const PAYMENT_METHOD_OPTIONS=['cash','card','transfer','cheque','mobile','other'];
function eventCurrency(event=getEvent()){const code=String(event?.currency||'TND').toUpperCase();return /^[A-Z]{3}$/.test(code)?code:'TND';}
function money(value,event=getEvent()){const n=Number(value||0),safe=Number.isFinite(n)?n:0;const digits=Number.isInteger(safe)?0:3;return `${new Intl.NumberFormat('fr-TN',{minimumFractionDigits:digits,maximumFractionDigits:3}).format(safe)} ${eventCurrency(event)}`;}
function paymentOf(p){const status=['paid','exempt'].includes(p?.paymentStatus)?p.paymentStatus:'unpaid';return {status,amount:Number(p?.paymentAmount||0),method:p?.paymentMethod||'',reference:p?.paymentReference||'',at:p?.paymentConfirmedAt||'',by:p?.paymentConfirmedBy||''};}
function needsPayment(p){return paymentOf(p).status==='unpaid';}
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
function renderPeople(){const counts=peopleFilterCounts();const filters=[['all','Tous',counts.all],['pending','À accueillir',counts.pending],['arrived','Arrivés',counts.arrived],['unpaid','Paiement à confirmer',counts.unpaid],['paid','Payés',counts.paid],['vip','VIP',counts.vip],['speaker','Intervenants',counts.speaker]];return `${pendingTotal()?noticeHTML('warning',`<strong>${pendingTotal()} action(s) hors ligne en attente.</strong> Elles seront synchronisées à la reconnexion.`):''}<div class="toolbar"><div class="search-wrap">${icon('search')}<input id="peopleSearch" class="search-input" value="${esc(peopleQuery)}" autocomplete="off" placeholder="Nom, e-mail, organisation ou code badge…" aria-label="Rechercher un participant"></div><span class="count-label" id="peopleCount"></span></div><div class="filters">${filters.map(([id,label,count])=>`<button class="filter ${peopleFilter===id?'active':''}" type="button" data-filter="${id}">${label}<b>${count}</b></button>`).join('')}</div><section class="table-card"><div class="table-scroll"><table><thead><tr><th>Participant</th><th>Catégorie</th><th>Code badge</th><th>Statut</th><th>Paiement</th><th>Heure</th><th style="text-align:right">Actions</th></tr></thead><tbody id="peopleRows"></tbody></table></div></section><div class="footnote">${icon('info')}<span>La recherche rapide accepte les codes que vos lecteurs USB/QR transmettent au champ. La colonne « Paiement » permet de confirmer un encaissement, y compris hors ligne. Les badges de cette version affichent le code en texte, sans QR ni code-barres.</span></div>`;}
function filteredPeople(){const query=norm(peopleQuery);return getPeople().filter(p=>{const match=peopleFilter==='all'||(peopleFilter==='pending'&&!p.checkedIn)||(peopleFilter==='arrived'&&p.checkedIn)||(peopleFilter==='unpaid'&&needsPayment(p))||(peopleFilter==='paid'&&paymentOf(p).status==='paid')||p.category===peopleFilter;const hay=[p.name,p.email,p.company,p.code,displayCategory(p.category),paymentStatusNames[paymentOf(p).status]].join(' ').toLocaleLowerCase('fr');return match&&(!query||hay.includes(query));}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));}
function renderPeopleRows(){const tbody=$('#peopleRows');if(!tbody)return;const list=filteredPeople();const count=$('#peopleCount');if(count)count.textContent=`${list.length} résultat${list.length===1?'':'s'} · ${getPeople().length} inscrit${getPeople().length===1?'':'s'}`;if(!list.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state"><strong>${getPeople().length?'Aucun participant trouvé':'Votre liste est vide'}</strong>${getPeople().length?'Essayez une autre recherche ou un autre filtre.':'Importez un CSV/Excel (.xlsx) ou ajoutez un participant.'}</div></td></tr>`;return;}tbody.innerHTML=list.map(p=>`<tr><td><div class="table-person"><span class="avatar">${esc(initials(p.name))}</span><span class="table-person-copy"><button type="button" data-action="details" data-id="${esc(p.id)}">${esc(p.name)}</button><small>${esc(p.email||p.company||'—')}</small></span></div></td><td><span class="cat-badge ${categoryClass(p.category)}">${esc(displayCategory(p.category))}</span></td><td><span class="code">${esc(p.code||'—')}</span></td><td><span class="status-badge ${p.checkedIn?'arrived':'pending'}"><i></i>${p.checkedIn?'Arrivé':'À accueillir'}</span></td><td>${paymentChipHTML(p)}</td><td>${p.checkedIn?`<span class="time-label">${esc(localTime(p.checkedInAt))}</span>`:'<span style="color:#c4cbd4">—</span>'}</td><td><div class="row-actions"><button class="icon-action" type="button" data-action="badge" data-id="${esc(p.id)}" title="Aperçu badge" aria-label="Aperçu badge">${icon('badge',13)}</button>${p.checkedIn?`<button class="table-action undo" type="button" data-action="undo" data-id="${esc(p.id)}">Annuler</button>`:`<button class="table-action" type="button" data-action="checkin" data-id="${esc(p.id)}" ${getEvent()?.status==='archived'?'disabled':''}>${icon('check',12)}Confirmer</button>`}</div></td></tr>`).join('');}
function badgeHTML(person){const ev=getEvent();return `<div class="badge-preview"><div class="badge-brand"><span class="badge-brand-mark">IE</span><span>IMAGINE EVENTS</span></div><div class="badge-person"><h3>${esc(person.name)}</h3><p>${esc(person.company||'Participant')}</p><span class="cat-badge ${categoryClass(person.category)}">${esc(displayCategory(person.category))}</span></div><div class="badge-bottom"><span>${esc((ev?.name||'CONGRÈS').toLocaleUpperCase('fr-TN'))}</span><code>${esc(person.code||'—')}</code></div></div>`;}
function renderBadges(){const canManage=authUser?.role==='admin';const list=getPeople().filter(p=>!badgeQuery||[p.name,p.company,p.code,displayCategory(p.category)].join(' ').toLocaleLowerCase('fr').includes(norm(badgeQuery)));return `<div class="badge-tools"><div class="badge-tools-main"><span class="badge-tools-icon">${icon('printer',17)}</span><span><strong>Badge nominatif · format 90 × 60 mm</strong><small>Code imprimé en texte (pas de QR/code-barres). Testez le papier et l’échelle avant le tirage.</small></span></div>${canManage?`<button class="btn btn-secondary" type="button" data-action="templates">${icon('file')}Modèles CSV / Excel</button>`:''}</div><div class="toolbar"><div class="search-wrap">${icon('search')}<input id="badgeSearch" class="search-input" value="${esc(badgeQuery)}" placeholder="Rechercher un participant…" autocomplete="off" aria-label="Filtrer les badges"></div><span class="count-label">${list.length} badge${list.length===1?'':'s'}</span></div>${list.length?`<div class="badge-grid">${list.map(p=>`<article class="badge-item">${badgeHTML(p)}<div class="badge-meta"><strong>${esc(p.name)}</strong><span class="cat-badge ${categoryClass(p.category)}">${esc(displayCategory(p.category))}</span></div><div class="badge-buttons"><button class="btn btn-secondary btn-sm" type="button" data-action="badge" data-id="${esc(p.id)}">${icon('eye',12)}Aperçu</button><button class="btn btn-primary btn-sm" type="button" data-action="print-badge" data-id="${esc(p.id)}">${icon('printer',12)}Imprimer</button></div></article>`).join('')}</div>`:`<div class="table-card"><div class="empty-state"><strong>${getPeople().length?'Aucun résultat':'Aucun participant à afficher'}</strong>Importez ou ajoutez des inscrits pour préparer les badges.</div></div>`}<div class="footnote">${icon('info')}<span>L’impression se lance depuis le navigateur. Choisissez une imprimante compatible avec le format 90 × 60 mm.</span></div>`;}
function paymentRowsHTML(){
  const settled=getPeople().filter(p=>paymentOf(p).status!=='unpaid').slice().sort((a,b)=>String(b.paymentConfirmedAt||'').localeCompare(String(a.paymentConfirmedAt||'')));
  if(!settled.length)return '<tr><td colspan="7"><div class="empty-state">Aucun paiement confirmé pour le moment.</div></td></tr>';
  return settled.map(p=>{const pay=paymentOf(p);return `<tr><td>${esc(p.name)}</td><td><span class="pay-badge ${pay.status}">${icon('cash',10)}${esc(paymentStatusNames[pay.status])}</span></td><td>${pay.status==='paid'?esc(money(pay.amount)):'—'}</td><td>${esc(paymentMethodNames[pay.method]||'—')}</td><td>${esc(pay.reference||'—')}</td><td>${esc(pay.at?dateTimeLabel(pay.at):'—')}</td><td>${esc(pay.by||'—')}</td></tr>`;}).join('');
}
function renderReports(){const stats=makeStats(),cats=['participant','vip','speaker','press','team'];const rows=cats.map(c=>{const list=getPeople().filter(p=>(p.category||'participant')===c);if(!list.length)return '';const arrived=list.filter(p=>p.checkedIn).length,pct=Math.round(arrived/list.length*100);return `<div class="report-bar"><div class="report-bar-label"><span>${esc(displayCategory(c))}</span><span>${arrived} / ${list.length} · ${pct}%</span></div><div class="progress"><i class="${categoryClass(c)}" style="width:${pct}%"></i></div></div>`;}).join('');const present=getPeople().filter(p=>p.checkedIn).slice().sort((a,b)=>String(b.checkedInAt||'').localeCompare(String(a.checkedInAt||'')));return `<div class="report-grid"><section class="card report-card"><div class="card-head"><div><h2 class="card-title">État des arrivées</h2><p class="card-subtitle">Progression globale et par catégorie</p></div></div><div class="report-summary"><div class="mini-stat"><span>Inscrits</span><strong>${stats.total}</strong></div><div class="mini-stat"><span>Arrivés</span><strong>${stats.arrived}</strong></div><div class="mini-stat"><span>Présence</span><strong>${stats.percent}%</strong></div></div><div class="report-bars">${rows||'<div class="empty-state">Aucune donnée à afficher.</div>'}</div></section><section class="card report-card"><div class="card-head"><div><h2 class="card-title">Liste de présence</h2><p class="card-subtitle">Arrivées confirmées sur cet événement</p></div></div><div class="report-table"><table><thead><tr><th>Participant</th><th>Catégorie</th><th>Heure</th></tr></thead><tbody>${present.length?present.map(p=>`<tr><td>${esc(p.name)}</td><td><span class="cat-badge ${categoryClass(p.category)}">${esc(displayCategory(p.category))}</span></td><td>${esc(localTime(p.checkedInAt))}</td></tr>`).join(''):'<tr><td colspan="3"><div class="empty-state">Aucune arrivée confirmée.</div></td></tr>'}</tbody></table></div></section></div>
  <section class="card report-card report-payments"><div class="card-head"><div><h2 class="card-title">Confirmation des paiements</h2><p class="card-subtitle">Encaissements et exonérations de ce congrès</p></div><span class="pay-total">${icon('cash',12)}${esc(money(stats.collected))} encaissés</span></div><div class="report-summary four"><div class="mini-stat"><span>Encaissé</span><strong class="money">${esc(money(stats.collected))}</strong></div><div class="mini-stat"><span>Payés</span><strong>${stats.paid}</strong></div><div class="mini-stat"><span>À encaisser</span><strong>${stats.toPay}</strong></div><div class="mini-stat"><span>Exonérés</span><strong>${stats.exempt}</strong></div></div><div class="report-table"><table><thead><tr><th>Participant</th><th>Statut</th><th>Montant</th><th>Moyen</th><th>Référence</th><th>Confirmé le</th><th>Par</th></tr></thead><tbody>${paymentRowsHTML()}</tbody></table></div><div class="footnote">${icon('info')}<span>Chaque confirmation est horodatée et signée par l’agent connecté. Les paiements en attente de synchronisation apparaissent après envoi au serveur.</span></div></section>${noticeHTML(pendingTotal()?'warning':'',pendingTotal()?`<strong>${pendingTotal()} action(s) n’ont pas encore été envoyées au serveur.</strong> Exportez après synchronisation si vous voulez un bilan centralisé.`:`<strong>Export de l’événement actif.</strong> Le CSV contient la catégorie, la présence, le code badge, l’heure d’arrivée et le détail du paiement.`)}`;}
function renderEvents(){
  if(!store.events.length)return renderOnboarding();
  const admin=authUser?.role==='admin';
  const cards=store.events.map(e=>{const total=Number(e.total||0),arrived=Number(e.arrived||0),pct=total?Math.round(arrived/total*100):0;const edit=admin?`<button class="icon-action" type="button" data-action="edit-event" data-id="${esc(e.id)}" title="Paramètres">${icon('settings',13)}</button>`:'';return `<article class="event-card"><div class="event-card-top"><div class="event-card-title"><h3>${esc(e.name)}</h3><p><span>${icon('calendar',12)}${esc(dateLabel(e.date))}</span><span>${icon('pin',12)}${esc(e.venue||'Lieu à préciser')}</span></p></div><span class="event-status ${e.status==='archived'?'archived':''}">${e.status==='archived'?'Archivé':'Actif'}</span></div><div class="event-card-stats"><span>Inscrits<strong>${total}</strong></span><span>Arrivés<strong>${arrived}</strong></span><span>Présence<strong>${pct}%</strong></span></div><div class="event-card-actions"><button class="btn btn-primary btn-sm" type="button" data-action="open-event" data-id="${esc(e.id)}">Ouvrir le desk ${icon('arrow',12)}</button><div>${edit}</div></div></article>`;}).join('');
  const addCard=admin?`<button class="event-add-card" type="button" data-action="new-event"><span class="plus-circle">${icon('plus',17)}</span><strong>Créer un autre congrès</strong><small>Nouvelle liste · nouvel espace d’accueil</small></button>`:'';
  return `<div class="notice">${icon('info')}<span>Chaque congrès possède son propre fichier d’inscrits, son suivi et ses paramètres. Les événements archivés restent consultables.</span></div><div class="events-grid">${cards}${addCard}</div>`;
}
function setPage(page){if(!pageMeta[page])return;currentPage=page;render();window.scrollTo({top:0,behavior:'smooth'});}
function showToast(message){const el=$('#toast');el.innerHTML=`${icon('check',15)}<span>${esc(message)}</span>`;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function mergePeople(eventId,participants){if(!Array.isArray(participants))return false;const map=new Map(getPeople(eventId).map(p=>[String(p.id),p]));let changed=false;participants.forEach(p=>{if(!p||!p.id)return;const old=map.get(String(p.id));if(!old||JSON.stringify(old)!==JSON.stringify(p)){map.set(String(p.id),p);changed=true;}});store.peopleByEvent[eventId]=Array.from(map.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));applyPending(eventId);return changed;}
function applyPending(eventId){const list=store.peopleByEvent[eventId]||[];const map=new Map(list.map(p=>[String(p.id),p]));for(const op of getQueue(eventId)){if(op.action==='create'&&op.participant&&!map.has(String(op.participant.id)))map.set(String(op.participant.id),{...op.participant});if(op.action==='checkin'||op.action==='undo'){const p=map.get(String(op.participantId));if(p){p.checkedIn=op.action==='checkin';p.checkedInAt=op.action==='checkin'?(op.localTime||new Date().toISOString()):'';}}if(op.action==='payment'){const p=map.get(String(op.participantId)),pay=op.payment||{};if(p){const status=['paid','exempt'].includes(pay.status)?pay.status:'unpaid';p.paymentStatus=status;p.paymentAmount=status==='paid'?Number(pay.amount||0):0;p.paymentMethod=status==='paid'?(pay.method||''):'';p.paymentReference=status==='paid'?(pay.reference||''):'';p.paymentConfirmedAt=status==='unpaid'?'':(op.localTime||new Date().toISOString());p.paymentConfirmedBy=status==='unpaid'?'':(authUser?.username||p.paymentConfirmedBy||'');}}}store.peopleByEvent[eventId]=Array.from(map.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));}
async function refreshEvents(silent=false){if(eventsRefreshing||!navigator.onLine)return;eventsRefreshing=true;try{const data=await api('/api/events');store.events=data.events||[];lastEventsRefresh=Date.now();chooseActiveEvent();saveStore();if(!silent||currentPage==='events')render(true);}catch(error){apiOnline=false;updateStatus();}finally{eventsRefreshing=false;}}
async function refreshParticipants(eventId=store.activeEventId,forceFull=false){if(!eventId||!navigator.onLine||participantRefreshes.has(eventId))return;participantRefreshes.add(eventId);try{const cursor=forceFull?'':(store.cursorByEvent[eventId]||'');const url=`/api/events/${encodeURIComponent(eventId)}/participants${cursor?`?since=${encodeURIComponent(cursor)}`:''}`;const data=await api(url);const changed=mergePeople(eventId,data.participants||[]);if(data.serverTime)store.cursorByEvent[eventId]=data.serverTime;apiOnline=true;saveStore();if(changed&&eventId===store.activeEventId)render(true);else updateStatus();}catch(error){apiOnline=false;updateStatus();}finally{participantRefreshes.delete(eventId);}}
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
  if(navigator.onLine){await refreshEvents(true);chooseActiveEvent();if(store.activeEventId){await refreshParticipants(store.activeEventId,!store.cursorByEvent[store.activeEventId]);await syncQueue(store.activeEventId);}}
  saveStore();render();
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
  <form id="eventForm" data-id="${esc(event?.id||'')}"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="eventName">Nom du congrès *</label><input id="eventName" name="name" required maxlength="180" value="${esc(event?.name||'')}" placeholder="Ex. Congrès annuel Imagine Events"></div><div class="field"><label for="eventDate">Date</label><input id="eventDate" name="date" type="date" value="${esc(event?.date||'')}"></div><div class="field"><label for="eventVenue">Lieu</label><input id="eventVenue" name="venue" maxlength="180" value="${esc(event?.venue||'')}" placeholder="Ville, hôtel, salle…"></div><div class="field"><label for="eventCurrency">Devise des paiements</label><input id="eventCurrency" name="currency" maxlength="3" value="${esc(event?.currency||'TND')}" placeholder="TND" style="text-transform:uppercase"><span class="field-hint">Code à 3 lettres (TND, EUR, USD…). Appliqué aux paiements de ce congrès.</span></div>${editing?`<div class="field full"><label for="eventStatus">État</label><select id="eventStatus" name="status"><option value="active" ${status==='active'?'selected':''}>Actif — desk ouvert</option><option value="archived" ${status==='archived'?'selected':''}>Archivé — consultation seulement</option></select><span class="field-hint">L’archivage conserve la liste et le rapport. Vous pouvez réactiver l’événement plus tard.</span></div>`:''}</div><div class="field-hint" style="margin-top:12px">Les montants ne sont pas prédéfinis : l’agent saisit le montant encaissé au moment de la confirmation de paiement. La création et la modification nécessitent une connexion au serveur central.</div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Annuler</button><button class="btn btn-primary" type="submit">${editing?'Enregistrer':'Créer le congrès'}</button></div></form>`,true);
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
function openDetails(id){const p=findPerson(id);if(!p)return;const pay=paymentOf(p);const event=getEvent();openModal(`<div class="modal-head"><div><h2>Fiche participant</h2><p>Inscription à ${esc(event?.name||'ce congrès')}.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="detail-hero"><span class="avatar">${esc(initials(p.name))}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.company||'Organisation non renseignée')}</p></div></div><div class="detail-grid"><div class="detail-cell"><span>Catégorie</span><strong>${esc(displayCategory(p.category))}</strong></div><div class="detail-cell"><span>Statut</span><strong>${p.checkedIn?'Arrivée confirmée':'À accueillir'}</strong></div><div class="detail-cell"><span>E-mail</span><strong>${esc(p.email||'—')}</strong></div><div class="detail-cell"><span>Code badge</span><strong>${esc(p.code||'—')}</strong></div><div class="detail-cell"><span>Paiement</span><strong>${esc(paymentStatusNames[pay.status])}${pay.status==='paid'&&pay.amount>0?` · ${esc(money(pay.amount))}`:''}</strong></div><div class="detail-cell"><span>Moyen de paiement</span><strong>${esc(paymentMethodNames[pay.method]||'—')}</strong></div><div class="detail-cell"><span>Référence</span><strong>${esc(pay.reference||'—')}</strong></div><div class="detail-cell"><span>Paiement confirmé</span><strong>${pay.at?`${esc(dateTimeLabel(pay.at))}${pay.by?` · ${esc(pay.by)}`:''}`:'—'}</strong></div><div class="detail-cell"><span>Heure d’arrivée</span><strong>${esc(localTime(p.checkedInAt))}</strong></div><div class="detail-cell"><span>Synchronisation</span><strong>${getQueue().some(op=>op.participantId===p.id)?'En attente':'À jour / local'}</strong></div></div>${needsPayment(p)?`<div class="notice warning" style="margin-top:12px">${icon('cash')}<span><strong>Paiement non confirmé.</strong> Encaissement possible au desk avant ou après l’arrivée.</span></div>`:''}</div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Fermer</button><button class="btn btn-secondary" type="button" data-action="badge" data-id="${esc(p.id)}">${icon('badge')}Voir le badge</button><button class="btn btn-secondary" type="button" data-action="payment" data-id="${esc(p.id)}" ${event?.status==='archived'?'disabled':''}>${icon('cash')}${needsPayment(p)?'Encaisser':'Paiement'}</button>${p.checkedIn?`<button class="btn btn-danger" type="button" data-action="undo" data-id="${esc(p.id)}">Annuler l’arrivée</button>`:`<button class="btn btn-primary" type="button" data-action="checkin" data-id="${esc(p.id)}" ${event?.status==='archived'?'disabled':''}>${icon('check')}Confirmer l’arrivée</button>`}</div>`,true);}

function paymentMethodOptions(selected){return PAYMENT_METHOD_OPTIONS.map(key=>`<option value="${key}" ${selected===key?'selected':''}>${esc(paymentMethodNames[key])}</option>`).join('');}
function openPaymentModal(id,options={}){
  const p=findPerson(id);if(!p)return;
  const event=getEvent();
  if(!event||event.status==='archived'){showToast('Ce congrès est archivé. Réactivez-le pour enregistrer un paiement.');return;}
  const pay=paymentOf(p);
  const thenCheckin=options.thenCheckin?' data-then-checkin="1"':'';
  const lastMeta=pay.status!=='unpaid'&&pay.at?`<div class="payment-meta">Dernière confirmation : <strong>${esc(dateTimeLabel(pay.at))}</strong>${pay.by?` par <strong>${esc(pay.by)}</strong>`:''}${pay.reference?` · Réf. ${esc(pay.reference)}`:''}</div>`:'';
  openModal(`<div class="modal-head"><div><h2>Confirmation de paiement</h2><p>${esc(p.name)} · ${esc(event.name)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
  <form id="paymentForm" data-id="${esc(p.id)}"${thenCheckin}><div class="modal-body">
    <div class="detail-hero"><span class="avatar">${esc(initials(p.name))}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.company||'Organisation non renseignée')} · ${esc(displayCategory(p.category))}</p></div></div>
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
  const now=new Date().toISOString();
  Object.assign(p,{paymentStatus:status,paymentAmount:amount,paymentMethod:method,paymentReference:reference,paymentConfirmedAt:status==='unpaid'?'':now,paymentConfirmedBy:status==='unpaid'?'':(authUser?.username||''),updatedAt:now});
  queueOp(eventId,{opId:makeId('op'),eventId,participantId:p.id,action:'payment',deviceId:store.deviceId,localTime:now,payment:{status,amount,method,reference}});
  applyPending(eventId);saveStore();render(true);
  showToast(status==='paid'?`Paiement confirmé : ${p.name} — ${money(amount,event)}.`:status==='exempt'?`${p.name} marqué comme exonéré.`:`Paiement annulé : ${p.name}.`);
  if(navigator.onLine)await syncQueue(eventId);
  return true;
}

function openBadgeModal(id){const p=findPerson(id);if(!p)return;openModal(`<div class="modal-head"><div><h2>Aperçu du badge</h2><p>Vérifiez le nom et la catégorie avant impression.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="modal-badge">${badgeHTML(p)}</div><div class="field-hint" style="margin-top:11px;text-align:center">Format prévu : 90 × 60 mm · code en texte, sans QR/code-barres.</div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Fermer</button><button class="btn btn-primary" type="button" data-action="print-badge" data-id="${esc(p.id)}">${icon('printer')}Imprimer</button></div>`,true);}
function openHelp(){openModal(`<div class="modal-head"><div><h2>Guide du desk</h2><p>Préparation pour un ou plusieurs postes d’accueil.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body"><div class="guide-steps"><div class="guide-step"><b>1</b><div><strong>Créez un congrès distinct</strong><br>Nom, date et lieu sont propres à chaque événement. Les données ne se mélangent pas.</div></div><div class="guide-step"><b>2</b><div><strong>Importez la liste</strong><br>Les modèles CSV/Excel acceptent nom complet, e-mail, organisation, catégorie, code badge, statut et colonnes de paiement (paiement, montant, moyen). Les doublons sont rapprochés par e-mail ou code.</div></div><div class="guide-step"><b>3</b><div><strong>Ouvrez le même événement sur chaque poste</strong><br>Tous les appareils doivent accéder à la même adresse du serveur central pour synchroniser les check-ins.</div></div><div class="guide-step"><b>4</b><div><strong>Confirmez les paiements</strong><br>Ouvrez la colonne « Paiement » d’un inscrit (ou sa fiche) pour saisir le montant encaissé, le moyen de paiement et une référence. La confirmation est horodatée et signée par l’agent connecté. Les inscrits non payés déclenchent un avertissement au check-in, sans bloquer l’arrivée.</div></div><div class="guide-step"><b>5</b><div><strong>En cas de coupure</strong><br>Les arrivées, les paiements et les ajouts faits sur cet appareil sont mis en file locale. À la reconnexion, ils sont renvoyés automatiquement. Gardez l’onglet ouvert pendant la panne.</div></div><div class="guide-step"><b>6</b><div><strong>À la fin</strong><br>Vérifiez l’indicateur « synchronisé », exportez le rapport CSV (présences et paiements), puis archivez le congrès.</div></div></div><div class="notice warning" style="margin:15px 0 0">${icon('info')}<span>Les comptes administrateur et agent sont actifs. Avant toute mise en production, ajoutez un domaine HTTPS et des sauvegardes automatiques; ne saisissez pas de vraies données personnelles dans l’aperçu de démonstration.</span></div></div><div class="modal-footer"><button class="btn btn-primary" type="button" data-action="close-modal">Compris</button></div>`,true);}
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
function printBadge(id){const p=findPerson(id);if(!p)return;$('#printArea').innerHTML=badgeHTML(p);closeModal();setTimeout(()=>window.print(),80);}
function downloadFile(filename,content,type='text/csv;charset=utf-8'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
function exportCSV(){const event=getEvent();if(!event){showToast('Sélectionnez un congrès avant l’export.');return;}const headers=['Nom complet','E-mail','Organisation','Catégorie','Code badge','Statut','Heure d’arrivée','Paiement','Montant payé',`Devise`,'Moyen de paiement','Référence paiement','Paiement confirmé le','Paiement confirmé par','Synchronisation'];const q=getQueue(event.id);const rows=getPeople(event.id).map(p=>{const pay=paymentOf(p);return [p.name,p.email,p.company,displayCategory(p.category),p.code,p.checkedIn?'Arrivé':'À accueillir',p.checkedIn?localTime(p.checkedInAt):'',paymentStatusNames[pay.status],pay.status==='paid'?String(pay.amount).replace('.',','):'',pay.status==='paid'?eventCurrency(event):'',pay.method?paymentMethodNames[pay.method]:'',pay.reference,pay.at?dateTimeLabel(pay.at):'',pay.by,q.some(op=>op.participantId===p.id)?'En attente':'À jour'];});const csv='\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n');const slug=event.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'congres';downloadFile(`imagine-events-${slug}-presences.csv`,csv);showToast('Rapport CSV téléchargé avec le détail des paiements.');}
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
  else if(action==='export-db'){await exportDatabaseBackup();return;}
  else if(action==='restore-backup'){openRestoreBackupModal();return;}
  else if(action==='new-event')openEventModal();
  else if(action==='settings'){const ev=getEvent();if(ev)openEventModal(ev);else openEventModal();}
  else if(action==='edit-event')openEventModal(getEvent(id));
  else if(action==='close-modal')closeModal();
  else if(action==='add-person')openAddModal();
  else if(action==='import-csv'){if(!getEvent())showToast('Sélectionnez un congrès avant l’import.');else openImportModal();}
  else if(action==='select-import-file'){closeModal();$('#csvFile').click();}
  else if(action==='templates')openImportModal();
  else if(action==='template'||action==='template-csv')downloadTemplate();
  else if(action==='template-xlsx')downloadExcelTemplate();
  else if(action==='export')exportCSV();
  else if(action==='go-people')setPage('people');
  else if(action==='open-event'){store.activeEventId=id;peopleQuery='';peopleFilter='all';badgeQuery='';currentPage='home';saveStore();render();await refreshParticipants(id,!store.cursorByEvent[id]);await syncQueue(id);}
  else if(action==='details')openDetails(id);
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
  if(event.target.id==='paymentStatus'){const paid=event.target.value==='paid';['paymentAmount','paymentMethod','paymentReference'].forEach(id=>{const field=$('#'+id);if(field)field.disabled=!paid;});}
  if(event.target.matches('[data-user-role]')){const id=event.target.dataset.id,role=event.target.value;try{await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({role})});showToast('Rôle mis à jour; ce compte devra se reconnecter.');await openAccountsModal();}catch(error){showToast(error.message||'Modification impossible.');await openAccountsModal();}return;}
  if(event.target.id==='eventSelect'){const id=event.target.value;store.activeEventId=id;currentPage='home';peopleQuery='';peopleFilter='all';badgeQuery='';saveStore();render();if(id){await refreshParticipants(id,!store.cursorByEvent[id]);await syncQueue(id);}}
  if(event.target.id==='csvFile'){const file=event.target.files?.[0];if(file)await importFile(file);event.target.value='';}
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
    const payload={status:String(fd.get('status')||'unpaid'),amount:String(fd.get('amount')||''),method:String(fd.get('method')||''),reference:String(fd.get('reference')||'')};
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
