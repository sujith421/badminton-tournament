const DEFAULT_DATA = {
  teams: [
    { id: 't1', name: 'Maya & Nia', short: 'MN', players: 'Maya Chen · Nia Kapoor', pool: 'A' },
    { id: 't2', name: 'Leo & Tomas', short: 'LT', players: 'Leo Martin · Tomas Reed', pool: 'A' },
    { id: 't3', name: 'Aisha & Bea', short: 'AB', players: 'Aisha Khan · Bea Olsen', pool: 'A' },
    { id: 't4', name: 'Owen & Kai', short: 'OK', players: 'Owen Wells · Kai Tan', pool: 'A' },
    { id: 't5', name: 'Zoe & Isla', short: 'ZI', players: 'Zoe Park · Isla Moore', pool: 'B' },
    { id: 't6', name: 'Finn & Arun', short: 'FA', players: 'Finn Cole · Arun Mehta', pool: 'B' },
    { id: 't7', name: 'Cleo & Sam', short: 'CS', players: 'Cleo James · Sam Hall', pool: 'B' },
    { id: 't8', name: 'Noah & Jules', short: 'NJ', players: 'Noah Grant · Jules Perry', pool: 'B' }
  ],
  matches: [
    { id: 'm1', pool: 'A', court: 'Court 1', time: '09:00', a: 't1', b: 't2', status: 'complete', games: [[21, 16]] },
    { id: 'm2', pool: 'A', court: 'Court 2', time: '09:00', a: 't3', b: 't4', status: 'complete', games: [[18, 21]] },
    { id: 'm3', pool: 'B', court: 'Court 3', time: '09:00', a: 't5', b: 't6', status: 'complete', games: [[21, 12]] },
    { id: 'm4', pool: 'B', court: 'Court 4', time: '09:00', a: 't7', b: 't8', status: 'complete', games: [[21, 17]] },
    { id: 'm5', pool: 'A', court: 'Court 2', time: '10:15', a: 't1', b: 't3', status: 'live', games: [] },
    { id: 'm6', pool: 'A', court: 'Court 1', time: '10:15', a: 't2', b: 't4', status: 'upcoming', games: [] },
    { id: 'm7', pool: 'B', court: 'Court 4', time: '10:15', a: 't5', b: 't7', status: 'live', games: [] },
    { id: 'm8', pool: 'B', court: 'Court 3', time: '10:15', a: 't6', b: 't8', status: 'upcoming', games: [] },
    { id: 'm9', pool: 'A', court: 'Court 1', time: '11:30', a: 't1', b: 't4', status: 'upcoming', games: [] },
    { id: 'm10', pool: 'A', court: 'Court 2', time: '11:30', a: 't2', b: 't3', status: 'upcoming', games: [] },
    { id: 'm11', pool: 'B', court: 'Court 3', time: '11:30', a: 't5', b: 't8', status: 'upcoming', games: [] },
    { id: 'm12', pool: 'B', court: 'Court 4', time: '11:30', a: 't6', b: 't7', status: 'upcoming', games: [] }
  ],
  tournament: { name: 'Friendly doubles,', date: 'Saturday, 21 September · 09:00', venue: 'Rally Club Courts', format: 'teams' },
  players: [], rotation: null, registrations: [], requests: [], approved: [], role: 'visitor', scorerName: ''
};
const CLOUD_CONFIG=window.RALLY_SUPABASE||null;
const cloud={client:null,tournamentId:null,ownerId:null,session:null,editorApproved:false,channel:null,saveTimer:null,ready:false,authListening:false,updatedAt:null,pollTimer:null,refreshInFlight:false,refreshListeners:false};
let data = loadData();
let activePool = 'A'; let activeFilter = 'all'; let editingMatchId = null;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function loadData(){ try { const saved=JSON.parse(localStorage.getItem('rally-club-tournament')); return saved?{...structuredClone(DEFAULT_DATA),...saved,tournament:{...DEFAULT_DATA.tournament,...saved.tournament}}:structuredClone(DEFAULT_DATA); } catch { return structuredClone(DEFAULT_DATA); } }
function cloudState(){ const state=structuredClone(data); delete state.role; delete state.scorerName; delete state.requests; delete state.approved; return state; }
function save(){ localStorage.setItem('rally-club-tournament', JSON.stringify(data)); if(cloud.ready&&cloud.tournamentId){clearTimeout(cloud.saveTimer);cloud.saveTimer=setTimeout(saveCloudState,120);} }
function team(id){ return data.teams.find(t => t.id === id); }
function initials(name){ return name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase(); }
function isRotation(){ return data.tournament.format==='rotation'; }
function shareUrl(){ if(!cloud.tournamentId)return ''; const url=new URL(window.location.href); url.search='';url.hash='';url.searchParams.set('tournament',cloud.tournamentId);return url.toString(); }
function setCloudStatus(message){ const status=$('#cloudStatus');if(status)status.textContent=message; }
function updateSharingUi(){ const publish=$('#publishTournamentButton'),copy=$('#copyTournamentLinkButton'),registrationCopy=$('#copyRegistrationLinkButton');if(!publish||!copy)return;publish.disabled=false;publish.textContent=cloud.tournamentId?'Save live tournament':'Publish live tournament';copy.disabled=!cloud.tournamentId;if(registrationCopy)registrationCopy.disabled=!cloud.tournamentId;setCloudStatus(cloud.tournamentId?'This tournament is live. Everyone with the link can update it, and changes appear straight away.':'Publish this tournament once to create a shared live event.'); }
function applyCloudRole(){ data.role='admin';cloud.editorApproved=true; }
function hydrateCloudTournament(row){ if(!row?.state)return;if(cloud.updatedAt&&row.updated_at&&row.updated_at<cloud.updatedAt)return;data={...structuredClone(DEFAULT_DATA),...row.state,tournament:{...DEFAULT_DATA.tournament,...row.state.tournament},requests:[],approved:[],role:'admin',scorerName:''};cloud.tournamentId=row.id;cloud.ownerId=row.owner_id;cloud.updatedAt=row.updated_at||cloud.updatedAt;applyCloudRole();renderTeamsSelect();renderAll();updateSharingUi(); }
async function saveCloudState(){ if(!cloud.client||!cloud.tournamentId)return;const {data:row,error}=await cloud.client.from('tournaments').update({name:data.tournament.name,state:cloudState()}).eq('id',cloud.tournamentId).select('id,updated_at').single();if(error){console.warn('Live save failed',error.message);toast('Could not share that change. Please try again.');return;}cloud.updatedAt=row?.updated_at||cloud.updatedAt; }
async function refreshCloudTournament(){ if(!cloud.client||!cloud.tournamentId||cloud.refreshInFlight)return;cloud.refreshInFlight=true;try{const {data:row,error}=await cloud.client.from('tournaments').select('*').eq('id',cloud.tournamentId).maybeSingle();if(!error&&row?.state&&row.updated_at!==cloud.updatedAt)hydrateCloudTournament(row);}finally{cloud.refreshInFlight=false;} }
function startCloudRefreshFallback(){ if(!cloud.tournamentId)return;clearInterval(cloud.pollTimer);cloud.pollTimer=setInterval(refreshCloudTournament,4000);if(!cloud.refreshListeners){const refreshWhenVisible=()=>{if(!document.hidden)refreshCloudTournament();};document.addEventListener('visibilitychange',refreshWhenVisible);window.addEventListener('focus',refreshWhenVisible);cloud.refreshListeners=true;} }
function subscribeToTournament(){ if(!cloud.client||!cloud.tournamentId)return;if(cloud.channel)cloud.client.removeChannel(cloud.channel);cloud.channel=cloud.client.channel(`tournament-${cloud.tournamentId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournaments',filter:`id=eq.${cloud.tournamentId}`},payload=>{if(payload.new?.state)hydrateCloudTournament(payload.new);}).subscribe();startCloudRefreshFallback(); }
async function publishTournament(archiveCurrent=false){ if(!cloud.client){toast('Live sharing is not configured yet.');return false;}if(archiveCurrent&&cloud.tournamentId){const {error:archiveError}=await cloud.client.from('tournaments').update({status:'archived',archived_at:new Date().toISOString()}).eq('id',cloud.tournamentId);if(archiveError){toast('Could not archive the previous tournament.');return false;}}if(!archiveCurrent&&cloud.tournamentId){await saveCloudState();updateSharingUi();toast('Live tournament saved.');return true;}const {data:row,error}=await cloud.client.from('tournaments').insert({name:data.tournament.name,state:cloudState(),status:'active'}).select().single();if(error){toast(`Could not publish: ${error.message}`);return false;}cloud.tournamentId=row.id;cloud.ownerId=null;cloud.updatedAt=row.updated_at||null;history.replaceState({},'',shareUrl());subscribeToTournament();updateSharingUi();toast('Tournament is live — share the link with everyone.');return true; }
async function initialiseCloud(){ if(!CLOUD_CONFIG?.url||!CLOUD_CONFIG?.publishableKey||!window.supabase)return;cloud.client||=window.supabase.createClient(CLOUD_CONFIG.url,CLOUD_CONFIG.publishableKey);const requestedId=new URLSearchParams(window.location.search).get('tournament');let query=cloud.client.from('tournaments').select('*');query=requestedId?query.eq('id',requestedId):query.eq('status','active').order('updated_at',{ascending:false}).limit(1);const {data:rows,error}=await query;const row=Array.isArray(rows)?rows[0]:rows;if(error){setCloudStatus('Live service is temporarily unavailable. This browser is using its local copy.');return;}cloud.ready=true;if(row){hydrateCloudTournament(row);subscribeToTournament();}else{applyCloudRole();renderAll();updateSharingUi();} }
function player(id){ return data.players.find(p=>p.id===id); }
function rotationMatches(){ return data.rotation?.rounds.flatMap(round=>round.groups.flatMap(group=>group.matches.map(match=>({...match,round:round.number,group:group.name}))))||[]; }
function rotationMatchById(id){ return data.rotation?.rounds.flatMap(round=>round.groups.flatMap(group=>group.matches)).find(match=>match.id===id); }
function rotationMatchDetails(id){ return rotationMatches().find(match=>match.id===id); }
function rotationPair(ids){ return ids.map(id=>player(id)?.name||'TBD').join(' & '); }
function shuffle(items){ return [...items].sort(()=>Math.random()-.5); }
const EXPERIENCE_SCORE={beginner:1,intermediate:2,advanced:3,competitive:4};
function experienceScore(player){ return EXPERIENCE_SCORE[player.experience]||EXPERIENCE_SCORE.intermediate; }
function rotationGroupSizes(playerCount){ let groupCount=Math.ceil(playerCount/5); while(groupCount>1&&Math.floor(playerCount/groupCount)<4)groupCount--; const base=Math.floor(playerCount/groupCount), extras=playerCount%groupCount; return Array.from({length:groupCount},(_,index)=>base+(index>=groupCount-extras?1:0)); }
function balancedRotationGroups(players,groupSizes){ const groups=groupSizes.map(()=>[]), slots=[]; for(let layer=0;layer<Math.max(...groupSizes);layer++){ const eligible=groupSizes.map((size,index)=>size>layer?index:null).filter(index=>index!==null); slots.push(...(layer%2?eligible.reverse():eligible)); } const ranked=shuffle(players).sort((a,b)=>experienceScore(b)-experienceScore(a)); ranked.forEach((person,index)=>groups[slots[index]].push(person.id)); return groups; }
function buildRotationGroupMatches(ids,roundNumber,groupIndex){
  const pairings=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]], matches=[], matchCount=Math.ceil(ids.length*3/4), extraAppearances=matchCount*4-ids.length*3, targets=Object.fromEntries(ids.map(id=>[id,3])), played=Object.fromEntries(ids.map(id=>[id,0])); for(let index=0;index<extraAppearances;index++)targets[ids[(roundNumber+groupIndex+index)%ids.length]]++;
  for(let matchIndex=0;matchIndex<matchCount;matchIndex++){ const players=[...ids].filter(id=>played[id]<targets[id]).sort((a,b)=>(targets[b]-played[b])-(targets[a]-played[a])||played[a]-played[b]||ids.indexOf(a)-ids.indexOf(b)).slice(0,4); players.forEach(id=>played[id]++); const pairs=pairings[matchIndex%pairings.length]; matches.push({id:`r${roundNumber}g${groupIndex+1}m${matches.length+1}`,a:pairs[0].map(index=>players[index]),b:pairs[1].map(index=>players[index]),status:'upcoming',games:[],slot:matches.length+1}); } return matches;
}
function poolLabel(index){ let label='',number=index+1; while(number>0){const remainder=(number-1)%26;label=String.fromCharCode(65+remainder)+label;number=Math.floor((number-1)/26);} return label; }
function buildRotationRound(number,groups){ const placement=['1st-place group','2nd-place group','3rd-place group','4th-place group']; const exactPlaceGroups=groups.length===groups[0]?.length; return {number,groups:groups.map((ids,index)=>({id:`r${number}g${index+1}`,name:number===1?`Group ${poolLabel(index)}`:(exactPlaceGroups&&index<4?placement[index]:`Seeded group ${index+1}`),playerIds:ids,matches:buildRotationGroupMatches(ids,number,index)}))}; }
function pointDifference(match){ return match.games.reduce((total,[a,b])=>total+(a-b),0); }
function signedScore(score){ return `${score>0?'+':''}${score}`; }
function rotationRoundScores(group){
  const scores=group.playerIds.map(id=>({player:player(id),score:0,wins:0,played:0}));
  group.matches.filter(match=>match.status==='complete').forEach(match=>{ const aScore=scores.filter(row=>match.a.includes(row.player.id)), bScore=scores.filter(row=>match.b.includes(row.player.id)), difference=pointDifference(match); const aGames=match.games.filter(([a,b])=>a>b).length,bGames=match.games.filter(([a,b])=>b>a).length; aScore.forEach(row=>{row.played++;row.score+=difference;if(aGames>bGames)row.wins++;});bScore.forEach(row=>{row.played++;row.score-=difference;if(bGames>aGames)row.wins++;}); });
  return scores.sort((a,b)=>b.score-a.score||b.wins-a.wins||a.player.name.localeCompare(b.player.name));
}
function rotationOverallScores(){ const scores=data.players.map(person=>({player:person,score:0,wins:0,played:0})); rotationMatches().filter(match=>match.status==='complete').forEach(match=>{ const aRows=scores.filter(row=>match.a.includes(row.player.id)),bRows=scores.filter(row=>match.b.includes(row.player.id)),difference=pointDifference(match); const aGames=match.games.filter(([a,b])=>a>b).length,bGames=match.games.filter(([a,b])=>b>a).length; aRows.forEach(row=>{row.played++;row.score+=difference;if(aGames>bGames)row.wins++;});bRows.forEach(row=>{row.played++;row.score-=difference;if(bGames>aGames)row.wins++;}); }); return scores.sort((a,b)=>b.score-a.score||b.wins-a.wins||a.player.name.localeCompare(b.player.name)); }
function rotationRoundComplete(round){ return round.groups.every(group=>group.matches.every(match=>match.status==='complete')); }
function regroupRotation(sourceRound){ const sourceGroups=sourceRound.groups, groupSizes=data.rotation.groupSizes||sourceGroups.map(group=>group.playerIds.length), ranked=sourceGroups.map(group=>rotationRoundScores(group).map(row=>row.player.id)), maxSize=Math.max(...groupSizes), byPlace=Array.from({length:maxSize},(_,place)=>ranked.map(group=>group[place]).filter(Boolean)).flat(); let offset=0; return groupSizes.map(size=>{const group=byPlace.slice(offset,offset+size);offset+=size;return group;}); }
function advanceRotation(){ const rounds=data.rotation.rounds; const current=rounds[rounds.length-1]; if(!rotationRoundComplete(current)||rounds.length>=3)return null; const next=buildRotationRound(rounds.length+1,regroupRotation(current)); rounds.push(next); return next; }
function rotationRoundForMatch(id){ return data.rotation?.rounds.find(round=>round.groups.some(group=>group.matches.some(match=>match.id===id))); }
function refreshUnplayedRotationRounds(sourceRound){ const rounds=data.rotation.rounds, sourceIndex=rounds.indexOf(sourceRound); let refreshed=false; for(let index=sourceIndex+1;index<rounds.length;index++){ if(rounds[index].groups.some(group=>group.matches.some(match=>match.status==='complete')))return 'locked'; rounds[index]=buildRotationRound(index+1,regroupRotation(rounds[index-1])); refreshed=true; } return refreshed?'refreshed':'none'; }
function teamBlock(t, reverse=false){ return `<div class="team-block ${reverse?'reverse':''}"><span class="team-avatar">${t.short}</span><div class="team-names">${t.name}<small>${t.players}</small></div></div>`; }
function matchWinner(match){ if(!match.games?.length) return null; let a=0,b=0; match.games.forEach(([x,y]) => x>y ? a++ : y>x ? b++ : null); return a===b ? null : a>b ? match.a : match.b; }
function scoreString(match){ return match.games?.map(([a,b])=>`${a}–${b}`).join('  ') || '—'; }
function standings(pool){
  const rows = data.teams.filter(t=>t.pool===pool).map(t=>({team:t,played:0,wins:0,losses:0,for:0,against:0}));
  data.matches.filter(m=>m.pool===pool && m.status==='complete').forEach(m=>{ const ra=rows.find(r=>r.team.id===m.a), rb=rows.find(r=>r.team.id===m.b); const win=matchWinner(m); ra.played++;rb.played++; if(win===m.a){ra.wins++;rb.losses++;}else if(win===m.b){rb.wins++;ra.losses++;} m.games.forEach(([a,b])=>{ra.for+=a;ra.against+=b;rb.for+=b;rb.against+=a;}); });
  return rows.sort((x,y)=>y.wins-x.wins || (y.for-y.against)-(x.for-x.against) || y.for-x.for);
}
function renderNext(){
  if(isRotation()){ const m=rotationMatches().find(match=>match.status==='upcoming'); if(!m){$('#nextMatch').innerHTML='<p class="rotation-ready">All three rounds are complete. See the leaderboard below.</p>';return;} $('#nextMatch').innerHTML=`<div class="next-match rotation-next"><div class="rotation-pair"><span>${rotationPair(m.a)}</span><small>Round ${m.round} · ${m.group}</small></div><div class="versus">VS<br><small>GROUP GAME ${m.slot}</small></div><div class="rotation-pair reverse"><span>${rotationPair(m.b)}</span><small>Round ${m.round} · ${m.group}</small></div></div>`; return; }
  const m = data.matches.find(m=>m.status==='live') || data.matches.find(m=>m.status==='upcoming'); if(!m) return; $('#nextMatch').innerHTML=`<div class="next-match">${teamBlock(team(m.a))}<div class="versus">VS<br><small>POOL ${m.pool}</small></div>${teamBlock(team(m.b),true)}</div>`;
}
function renderStats(){ const matches=isRotation()?rotationMatches():data.matches, done=matches.filter(m=>m.status==='complete').length, left=Math.max(0,matches.length-done); $('#playedCount').textContent=done; $('#remainingCount').textContent=left; $('#liveStatus').textContent=isRotation()?`Round ${data.rotation.rounds.length} of 3`:`${matches.filter(m=>m.status==='live').length} courts live`; const rotationGroupSizes=data.rotation?.groupSizes||data.rotation?.rounds[0]?.groups.map(group=>group.playerIds.length)||[4], groupLabel=[...new Set(rotationGroupSizes)].join('–'); $('#formatStatNumber').textContent=isRotation()?data.rotation.rounds[0].groups.length:poolIds().length; $('#formatStatLabel').textContent=isRotation()?`${data.players.length} players · groups of ${groupLabel}`:`${data.teams.length} pairs · ${poolIds().length} league ${poolIds().length===1?'group':'groups'}`; }
function renderFixtures(){
  if(isRotation()){ renderRotationFixtures(); return; }
  $('#fixtureFormatNote').textContent='1 game · 21 points'; $('#fixturesEyebrow').innerHTML='<span></span> League stage'; $('#fixturesTitle').textContent='League fixtures';
  const statusCopy={live:'LIVE NOW',upcoming:'UP NEXT',complete:'PLAYED'};
  $('#fixturesList').innerHTML=data.matches.map(m=>{const a=team(m.a),b=team(m.b),allowed=canEdit(),actionLabel=m.status==='complete'?(allowed?'Edit score':'Request edit'):(allowed?'Enter score':'Update score'); return `<article class="fixture-item ${m.status}" data-status="${m.status}" ${activeFilter!=='all'&&m.status!==activeFilter?'hidden':''}><div class="fixture-meta"><b>${statusCopy[m.status]}</b>${m.time}<br>${m.court}</div><div class="fixture-teams"><div class="fixture-team"><span class="name"><i class="fixture-dot"></i>${a.name}</span><span class="fixture-score">${m.games[0]?m.games.map(g=>g[0]).join(' '):''}</span></div><div class="fixture-team"><span class="name"><i class="fixture-dot"></i>${b.name}</span><span class="fixture-score">${m.games[0]?m.games.map(g=>g[1]).join(' '):''}</span></div></div><div class="fixture-action"><button class="score-edit" data-match-id="${m.id}">${actionLabel}</button></div></article>`;}).join('');
  $$('.score-edit').forEach(b=>b.addEventListener('click',()=>openScore(b.dataset.matchId)));
}
function renderRotationFixtures(){
  $('#fixtureFormatNote').textContent='1 game · 21 points'; $('#fixturesEyebrow').innerHTML='<span></span> Rotation League'; $('#fixturesTitle').textContent='Rotation fixtures'; const matches=rotationMatches(),allowed=canEdit(); $('#fixturesList').innerHTML=matches.map(match=>{const actionLabel=match.status==='complete'?(allowed?'Edit score':'Request edit'):(allowed?'Enter score':'Update score'); return `<article class="fixture-item ${match.status}" data-status="${match.status}" ${activeFilter!=='all'&&match.status!==activeFilter?'hidden':''}><div class="fixture-meta"><b>${match.status==='complete'?'PLAYED':`ROUND ${match.round}`}</b>${match.group}<br>Group game ${match.slot}</div><div class="fixture-teams"><div class="fixture-team"><span class="name"><i class="fixture-dot"></i>${rotationPair(match.a)}</span><span class="fixture-score">${match.games[0]?match.games.map(game=>game[0]).join(' '):''}</span></div><div class="fixture-team"><span class="name"><i class="fixture-dot"></i>${rotationPair(match.b)}</span><span class="fixture-score">${match.games[0]?match.games.map(game=>game[1]).join(' '):''}</span></div></div><div class="fixture-action"><button class="score-edit" data-match-id="${match.id}">${actionLabel}</button></div></article>`;}).join('')+`${data.rotation.rounds.length<3?`<div class="rotation-wait">Round ${data.rotation.rounds.length+1} groups appear after every group has finished the current round.</div>`:''}`; $$('.score-edit').forEach(button=>button.onclick=()=>openScore(button.dataset.matchId));
}
function renderRotationStandings(){
  $('#standingsTitle').textContent='Overall leaderboard'; $('#poolToggle').innerHTML=`<span class="rotation-round-badge">${data.rotation.rounds.length}/3 rounds</span>`; const rows=rotationOverallScores(); $('#standings').innerHTML=`<table class="standings-table rotation-table"><thead><tr><th>#</th><th>PLAYER</th><th>P</th><th>W</th><th>+/-</th></tr></thead><tbody>${rows.map((row,index)=>`<tr class="${index<3?'leader-row':''}"><td class="standing-rank">${index+1}</td><td>${row.player.name}</td><td>${row.played}</td><td>${row.wins}</td><td>${signedScore(row.score)}</td></tr>`).join('')}</tbody></table>`; $('.standings-note').textContent='Round 2 uses Round 1 +/- only; Round 3 uses Round 2 +/- only. Final places use total +/-.'; }
function poolIds(){ return [...new Set(data.teams.map(t=>t.pool))]; }
function renderStandings(){ if(isRotation()){ renderRotationStandings(); return; } const pools=poolIds(); if(!pools.includes(activePool)) activePool=pools[0]; $('#standingsTitle').textContent=pools.length===1?'League standings':'Pool standings'; $('#poolToggle').innerHTML=pools.map(pool=>`<button class="pool-toggle-btn ${pool===activePool?'active':''}" data-pool="${pool}">${pool}</button>`).join(''); $$('.pool-toggle-btn').forEach(b=>b.onclick=()=>{activePool=b.dataset.pool;renderStandings();}); const rows=standings(activePool); $('#standings').innerHTML=`<table class="standings-table"><thead><tr><th>#</th><th>PAIR</th><th>P</th><th>W</th><th>+/-</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="standing-rank">${i+1}</td><td>${r.team.name}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.for-r.against>0?'+':''}${r.for-r.against}</td></tr>`).join('')}</tbody></table>`; $('.standings-note').textContent='Ranked by wins, then points difference.'; }
function overallTeamRankings(){ return poolIds().flatMap(pool=>standings(pool).map(row=>({...row,pool,rate:row.played?row.wins/row.played:0}))).sort((a,b)=>b.rate-a.rate||b.wins-a.wins||(b.for-b.against)-(a.for-a.against)||b.for-a.for); }
function roundRow(t, winner=false){ const name=typeof t==='string'?t:t?.name; return `<div class="bracket-row ${winner?'winner':''} ${!name?'placeholder':''}"><span>${name||'TBD'}</span><b>${winner?'✓':''}</b></div>`}
function bracketCard(label,a,b,final=false){ return `<div class="bracket-match ${final?'final-card':''}"><div class="bracket-row placeholder"><span>${label}</span><b>${final?'🏆':'—'}</b></div>${roundRow(a)}${roundRow(b)}</div>`; }
function renderBracket(){ if(isRotation()){ renderRotationProgress(); return; } const ranked=overallTeamRankings(), size=ranked.length>=8?8:ranked.length>=4?4:ranked.length>=2?2:0, seeds=ranked.slice(0,size).map(row=>row.team); $('.bracket-section .eyebrow').innerHTML='<span></span> The business end'; $('.bracket-section h2').textContent=size>=2?'Knockout bracket':'League standings'; $('.bracket-key').innerHTML=size>=2?`<span><i class="key-win"></i> Top ${size} qualify</span><span><i></i> Seeded by league results</span>`:'<span><i></i> Add at least two pairs to create a final</span>'; const labels=size>=8?['Quarterfinals','Semifinals','Final']:size>=4?['Semifinals','Final']:['Final']; $('.round-labels').className='round-labels dynamic-bracket-labels'; $('.round-labels').style.setProperty('--bracket-columns',labels.length); $('.round-labels').innerHTML=labels.map(label=>`<span>${label}</span>`).join(''); const columns=size>=8?[[['QF 1',seeds[0],seeds[7]],['QF 2',seeds[3],seeds[4]],['QF 3',seeds[1],seeds[6]],['QF 4',seeds[2],seeds[5]]],[['SF 1','Winner QF 1','Winner QF 2'],['SF 2','Winner QF 3','Winner QF 4']],[['FINAL · 15:15','Winner SF 1','Winner SF 2']]]:size>=4?[[['SF 1',seeds[0],seeds[3]],['SF 2',seeds[1],seeds[2]]],[['FINAL · 15:15','Winner SF 1','Winner SF 2']]]:size===2?[[['FINAL · 15:15',seeds[0],seeds[1]]]]:[]; $('#bracketGrid').className='bracket-grid dynamic-bracket-grid'; $('#bracketGrid').style.setProperty('--bracket-columns',columns.length||1); $('#bracketGrid').innerHTML=columns.map((column,index)=>`<div class="bracket-col ${index===columns.length-1?'final':''}">${column.map(match=>bracketCard(...match,index===columns.length-1)).join('')}</div>`).join('')||'<p class="rotation-ready">The league fixtures will appear after teams are added.</p>'; }
function renderRotationProgress(){
  $('.bracket-section .eyebrow').innerHTML='<span></span> Rotation League'; $('.bracket-section h2').textContent='Three rounds. One leaderboard.'; $('.bracket-key').innerHTML='<span><i class="key-win"></i> Total +/- decides the winners</span>'; $('.round-labels').className='round-labels'; $('.round-labels').style.removeProperty('--bracket-columns'); $('.round-labels').innerHTML='<span>Round 1</span><span>Round 2</span><span>Round 3</span>'; const rounds=data.rotation.rounds; $('#bracketGrid').className='bracket-grid rotation-progress'; $('#bracketGrid').style.removeProperty('--bracket-columns'); $('#bracketGrid').innerHTML=[1,2,3].map(number=>{ const round=rounds[number-1], sourceRound=number-1; if(!round)return `<div class="rotation-round-card pending-round"><p>ROUND ${number}</p><h3>Waiting for round ${sourceRound}</h3><span>Round ${number} will use Round ${sourceRound} +/- only.</span></div>`; return `<div class="rotation-round-card"><p>ROUND ${number}</p><h3>${number===1?'Random groups':`Seeded from Round ${sourceRound} only`}</h3>${round.groups.map(group=>`<div class="rotation-group"><b>${group.name}</b>${rotationRoundScores(group).map((row,index)=>`<span>${number>1?`${index+1}. `:''}${row.player.name} <small>(${signedScore(row.score)})</small></span>`).join('')}</div>`).join('')}</div>`; }).join('');
}
function renderRole(){ const pill=$('#rolePill');pill.className='role-pill admin';pill.innerHTML='<span></span> Live editor';$('#adminButton').textContent='Tournament controls'; }
function renderRequests(){ $('#requestBadge').textContent='∞';$('#requestsPanel').innerHTML='<p class="empty-requests">Everyone with this link can update scores and use the tournament controls. Please check changes carefully before saving.</p>'; }
function canEdit(){return true}
function renderTeamsSelect(){ const select=$('#requestTeam');if(!select)return;const choices=isRotation()?data.players.map(person=>person.name):data.teams.map(t=>t.name);select.innerHTML='<option value="">Choose '+(isRotation()?'your name':'a pair')+'</option>'+choices.map(choice=>`<option>${choice}</option>`).join(''); }
function renderTournamentMeta(){ $('#eventName').textContent=data.tournament.name; $('#eventDate').textContent=data.tournament.date; $('#eventVenue').textContent=data.tournament.venue; if(isRotation()){ const groupSizes=data.rotation.groupSizes||data.rotation.rounds[0].groups.map(group=>group.playerIds.length), groupCount=groupSizes.length, exactThree=groupSizes.every(size=>size%4===0), groupText=groupSizes.join(' / '); $('#heroDescription').textContent=`${data.players.length} players rotate partners in ${groupCount} balanced groups (${groupText} players), matched by experience level.`; $('#formatGuideTitle').innerHTML='Rotate. Rank.<br />Regroup.'; $('#formatGuideSteps').innerHTML=`<li><b>01</b><span>Experience levels are balanced across groups of ${groupText} players.</span></li><li><b>02</b><span>${exactThree?'Every player gets exactly three doubles games each round.':'Groups with 5+ players use a fair 3–4 game rotation.'}</span></li><li><b>03</b><span>Round 2 uses Round 1 +/- only; Round 3 uses Round 2 +/- only. Total +/- decides the podium.</span></li>`; }else{ const qualifierCount=data.teams.length>=8?8:data.teams.length>=4?4:2; $('#heroDescription').textContent=`${data.teams.length} fixed pairs play balanced round-robin league groups before the top ${qualifierCount} contest the knockout stage.`; $('#formatGuideTitle').innerHTML='League play to<br />the podium.'; $('#formatGuideSteps').innerHTML=`<li><b>01</b><span>${data.teams.length} pairs play everyone in their league group.</span></li><li><b>02</b><span>League results seed the top ${qualifierCount} pairs.</span></li><li><b>03</b><span>Win the knockout rounds to lift it.</span></li>`; } }
function renderRules(){ if(isRotation()){const groupSizes=data.rotation.groupSizes||data.rotation.rounds[0].groups.map(group=>group.playerIds.length);$('#formatRuleTitle').textContent='Rotate, rank, regroup';$('#formatRuleText').textContent='Each player receives the match point difference: 21–12 is +9 for the winners and −9 for the opponents. Round 2 groups use Round 1 +/- only; Round 3 groups use Round 2 +/- only. The top 3 are decided by total +/−.';$('#quickFormatRuleTitle').textContent='Balanced rotations';$('#quickFormatRuleText').textContent=`Experience-aware groups of ${groupSizes.join(' / ')} play for +/- points across all three rounds.`;}else{$('#formatRuleTitle').textContent='Play your league';$('#formatRuleText').textContent=`${data.teams.length} fixed pairs play a round robin within balanced league groups before the suitable knockout stage begins.`;$('#quickFormatRuleTitle').textContent='Play your league';$('#quickFormatRuleText').textContent=`${data.teams.length} fixed pairs play round-robin fixtures before the knockout stage.`;} }
function renderAll(){renderTournamentMeta();renderNext();renderStats();renderFixtures();renderStandings();renderBracket();renderRole();renderRules();renderRequests();}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3500)}
function playerInitials(name){ return name.trim().split(/\s+/).map(word=>word[0]||'').join('').slice(0,2).toUpperCase() || 'DB'; }
function displayDate(value){ const date=new Date(`${value}T12:00:00`); return Number.isNaN(date.valueOf())?'Tournament day':`${date.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})} · 09:00`; }
function fixedPoolCount(teamCount){ return teamCount<=4?1:Math.ceil(teamCount/4); }
function generatedMatches(teams){ const matches=[]; const pools=[...new Set(teams.map(t=>t.pool))]; pools.forEach(pool=>{ const members=teams.filter(t=>t.pool===pool); for(let first=0;first<members.length;first++)for(let second=first+1;second<members.length;second++){ const slot=Math.floor(matches.length/4), minutes=9*60+slot*75, time=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; matches.push({id:`m${matches.length+1}`,pool,court:`Court ${(matches.length%4)+1}`,time,a:members[first].id,b:members[second].id,status:'upcoming',games:[]}); }}); return matches; }
function playerCountForBuilder(format){ const requested=Number($('#newPlayerCount')?.value), step=format==='rotation'?1:2, maximum=format==='rotation'?Infinity:20; if(!Number.isInteger(requested)||requested<4)return 4; return Math.min(maximum,requested-((requested-4)%step)); }
function renderPairInputs(format=$('#newFormat')?.value||'teams'){
  const rotation=format==='rotation', countInput=$('#newPlayerCount'), playerCount=playerCountForBuilder(format), pairCount=playerCount/2, rotationGroups=rotation?rotationGroupSizes(playerCount):[], groupCount=rotation?rotationGroups.length:fixedPoolCount(pairCount); countInput.min='4';if(rotation)countInput.removeAttribute('max');else countInput.max='20';countInput.step=rotation?'1':'2'; $('#playerCountHint').textContent=rotation?'Rotation League accepts every whole-number player count from 4 upward.':'Fixed doubles needs an even number of players, up to 10 teams.'; $('#playerBuilderTitle').textContent=rotation?'Your rotation players':'Your fixed doubles pairs'; $('#playerCountLabel').textContent=`${playerCount} players`; $('#newTournamentIntro').textContent=rotation?`Add ${playerCount} individual players. Their experience levels are balanced across ${groupCount} groups of ${rotationGroups.join(' / ')} for three scoring rounds.`:`Add ${pairCount} fixed pairs (${playerCount} players). The app balances them across ${groupCount} league ${groupCount===1?'group':'groups'}, creates round-robin fixtures, and seeds the suitable knockout draw.`; $('#formatBuilderHelp').textContent=rotation?`Enter any whole number of players from 4 upward. The scheduler builds balanced groups of at least four (for example, 14 players become 4 / 5 / 5) and generates fair doubles rotations.`:`Fixed doubles supports 2–10 teams. Enter both players for each pair; every pair plays every other pair once.`;
  $('#playerPairs').classList.toggle('rotation-player-grid',rotation); $('#playerPairs').innerHTML=rotation?Array.from({length:playerCount},(_,index)=>`<label class="rotation-player-input"><span>PLAYER ${String(index+1).padStart(2,'0')}</span><input data-rotation-player="${index}" type="text" maxlength="30" autocomplete="name" placeholder="Player name" required /><select data-rotation-level="${index}" aria-label="Experience level for player ${index+1}"><option value="beginner">Beginner</option><option value="intermediate" selected>Intermediate</option><option value="advanced">Advanced</option><option value="competitive">Competitive</option></select></label>`).join(''):Array.from({length:pairCount},(_,index)=>`<div class="pair-input-row"><div class="pair-number"><b>${String(index+1).padStart(2,'0')}</b><span>Group ${poolLabel(index%groupCount)}</span></div><label>Player 1<input data-player="${index}-a" type="text" maxlength="30" autocomplete="name" placeholder="First player" required /></label><label>Player 2<input data-player="${index}-b" type="text" maxlength="30" autocomplete="name" placeholder="Second player" required /></label></div>`).join('');
}
function openNewTournament(){
  $('#newFormat').value='teams'; $('#newPlayerCount').value='16'; renderPairInputs('teams'); $('#newEventName').value=''; $('#newEventVenue').value=''; $('#newEventDate').value=new Date().toISOString().slice(0,10); $('#newTournamentMessage').textContent=''; $('#dashboardDialog').close(); $('#newTournamentDialog').showModal();
}
function openScore(id){ const m=isRotation()?rotationMatchDetails(id):data.matches.find(match=>match.id===id); if(!canEdit()){editingMatchId=id; $('#accessMessage').textContent=''; $('#accessDialog').showModal(); return;} editingMatchId=id; const sideA=isRotation()?rotationPair(m.a):team(m.a).name, sideB=isRotation()?rotationPair(m.b):team(m.b).name; $('#scoreMatchTitle').textContent=`${sideA} vs ${sideB}`; $('#scoreTeams').textContent=isRotation()?`Round ${m.round} · ${m.group} · Group game ${m.slot}`:`${m.court} · Pool ${m.pool} · ${m.time}`; $('#scoreFormatHint').textContent=m.status==='complete'?'Correct the one-game score, then save the update.':'Record one game to 21 points. The higher score wins the match.'; $('#scoreSideA').textContent=sideA; $('#scoreSideB').textContent=sideB; const fields=$$('#scoreForm input[type=number]'); fields.forEach((field,index)=>{field.value=m.games[0]?.[index]??'';field.setAttribute('aria-label',`${index?'Second':'First'} pair: ${index?sideB:sideA} score`);}); $('#scoreMessage').textContent=''; $('#scoreDialog').showModal(); }
$('#requestAccessButton').onclick=()=>$('#fixtures').scrollIntoView({behavior:'smooth',block:'start'});
$('#adminButton').onclick=()=>$('#dashboardDialog').showModal();
$('#dashboardClose').onclick=()=>$('#dashboardDialog').close(); $('#logOutButton').onclick=()=>$('#dashboardDialog').close();
$$('.dash-tab').forEach(b=>b.onclick=()=>{$$('.dash-tab').forEach(x=>x.classList.toggle('active',x===b));$('#requestsPanel').classList.toggle('hidden',b.dataset.dash!=='requests');$('#settingsPanel').classList.toggle('hidden',b.dataset.dash!=='settings');});
$('#resetButton').onclick=()=>{if(confirm('Reset all score and access-request data to the demo state?')){const role=data.role;data={...structuredClone(DEFAULT_DATA),role,scorerName:''};save();$('#dashboardDialog').close();renderAll();toast('Demo tournament reset.')}};
$('#publishTournamentButton').onclick=()=>publishTournament(false);
$('#copyTournamentLinkButton').onclick=async()=>{const link=shareUrl();if(!link)return;try{await navigator.clipboard.writeText(link);toast('Shareable tournament link copied.');}catch{toast('Copy the address from your browser to share this tournament.');}};
$('#newTournamentButton').onclick=openNewTournament;
$('#newTournamentCancel').onclick=()=>$('#newTournamentDialog').close();
$('#newFormat').onchange=()=>renderPairInputs($('#newFormat').value);
$('#newPlayerCount').addEventListener('input',()=>renderPairInputs($('#newFormat').value));
$('#newTournamentForm').addEventListener('submit',async e=>{
  e.preventDefault(); const previousData=structuredClone(data),name=$('#newEventName').value.trim(), venue=$('#newEventVenue').value.trim(), date=$('#newEventDate').value, format=$('#newFormat').value, playerCount=Number($('#newPlayerCount').value);
  if(!name||!venue||!date){$('#newTournamentMessage').textContent='Please add the tournament name, date, and venue.';return;}
  const role=data.role;
  if(format==='rotation'){
    if(!Number.isInteger(playerCount)||playerCount<4){$('#newTournamentMessage').textContent='Rotation League supports every whole-number player count from 4 upward.';return;}
    const names=$$('[data-rotation-player]').map(input=>input.value.trim()), levels=$$('[data-rotation-level]').map(input=>input.value); if(names.length!==playerCount||names.some(value=>!value)){ $('#newTournamentMessage').textContent=`Please enter all ${playerCount} player names.`;return; } if(levels.length!==playerCount||levels.some(level=>!EXPERIENCE_SCORE[level])){$('#newTournamentMessage').textContent='Choose an experience level for every player.';return;} if(new Set(names.map(value=>value.toLowerCase())).size!==names.length){$('#newTournamentMessage').textContent='Each player name must be unique.';return;}
    if(!confirm(`Create “${name}”? This will replace the current tournament, results, and scorekeeper approvals.`)) return;
    const rotationPlayers=names.map((person,index)=>({id:`p${index+1}`,name:person,experience:levels[index]})), groupSizes=rotationGroupSizes(playerCount), equalGroups=balancedRotationGroups(rotationPlayers,groupSizes); data={tournament:{name,venue,date:displayDate(date),format:'rotation'},teams:[],matches:[],players:rotationPlayers,rotation:{groupSizes,rounds:[buildRotationRound(1,equalGroups)]},registrations:[],requests:[],approved:[],role,scorerName:''};
  } else {
    if(!Number.isInteger(playerCount)||playerCount<4||playerCount>20||playerCount%2!==0){$('#newTournamentMessage').textContent='Fixed doubles needs an even number of 4–20 players (maximum 10 teams).';return;}
    const pairInputs=$$('#playerPairs input'),pairs=[]; for(let i=0;i<pairInputs.length;i+=2){const first=pairInputs[i].value.trim(),second=pairInputs[i+1].value.trim();if(!first||!second){$('#newTournamentMessage').textContent='Please enter both players for every pair.';return;}pairs.push([first,second]);} const allNames=pairs.flat(); if(pairs.length!==playerCount/2){$('#newTournamentMessage').textContent='Player entries do not match the selected count.';return;} if(new Set(allNames.map(value=>value.toLowerCase())).size!==allNames.length){$('#newTournamentMessage').textContent='Each player name must be unique.';return;}
    if(!confirm(`Create “${name}”? This will replace the current tournament, results, and scorekeeper approvals.`)) return;
    const groupCount=fixedPoolCount(pairs.length), teams=pairs.map(([first,second],index)=>({id:`t${index+1}`,name:`${first} & ${second}`,short:`${playerInitials(first)}${playerInitials(second)}`.slice(0,4),players:`${first} · ${second}`,pool:poolLabel(index%groupCount)})); data={tournament:{name,venue,date:displayDate(date),format:'teams'},teams,matches:generatedMatches(teams),players:[],rotation:null,registrations:[],requests:[],approved:[],role,scorerName:''};
  }
  activePool='A';activeFilter='all';let saved=true;if(cloud.client)saved=await publishTournament(Boolean(cloud.tournamentId));else save();if(!saved){data=previousData;renderTeamsSelect();renderAll();$('#newTournamentMessage').textContent='The new tournament could not be published. Your previous tournament is still open.';return;}$('#newTournamentDialog').close();renderTeamsSelect();renderAll();window.scrollTo({top:0,behavior:'smooth'});toast(`${name} is ready to play.`);
});
$('#scoreForm').addEventListener('submit',e=>{e.preventDefault();const m=isRotation()?rotationMatchById(editingMatchId):data.matches.find(match=>match.id===editingMatchId),wasComplete=m.status==='complete';const [a,b]=$$('#scoreForm input[type=number]').map(field=>field.value===''?null:Number(field.value));if(a===null||b===null){$('#scoreMessage').textContent='Please record both scores for the one game.';return;}if(a===b){$('#scoreMessage').textContent='The result needs a winning pair.';return;}m.games=[[a,b]];m.status='complete';let nextRound=null,refresh='none';if(isRotation()){if(wasComplete)refresh=refreshUnplayedRotationRounds(rotationRoundForMatch(editingMatchId));else nextRound=advanceRotation();}save();$('#scoreDialog').close();renderAll();toast(nextRound?`Round ${nextRound.number} groups are ready.`:refresh==='refreshed'?'Score corrected — upcoming rotation groups refreshed.':refresh==='locked'?'Score corrected — standings updated; later completed groups stay as played.':wasComplete?'Score corrected — standings updated.':'Match result saved — standings updated.');});
$$('.pool-toggle-btn').forEach(b=>b.onclick=()=>{activePool=b.dataset.pool;$$('.pool-toggle-btn').forEach(x=>x.classList.toggle('active',x===b));renderStandings();});
$$('.filter-tab').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;$$('.filter-tab').forEach(x=>x.classList.toggle('active',x===b));renderFixtures();});
$$('[data-view]').forEach(b=>b.onclick=()=>{const target=$('#'+b.dataset.view);target.scrollIntoView({behavior:'smooth',block:'start'});$$('[data-view]').forEach(x=>x.classList.toggle('active',x===b));});
$$('[data-scroll]').forEach(b=>b.onclick=()=>$('#'+b.dataset.scroll).scrollIntoView({behavior:'smooth',block:'start'}));
$$('[data-view-target]').forEach(b=>b.onclick=()=>$('#'+b.dataset.viewTarget).scrollIntoView({behavior:'smooth',block:'start'}));
setInterval(()=>{$('#clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});},1000);
renderTeamsSelect();renderAll();
initialiseCloud();

// Fixed doubles uses one complete league: every pair meets every other pair once.
function pairKey(a,b){return [a,b].sort().join('::');}
function generatedMatches(teams){
  const matches=[],rotation=[...teams];
  if(rotation.length%2)rotation.push(null);
  const half=rotation.length/2;
  for(let round=0;round<rotation.length-1;round++){
    const minutes=9*60+round*75,time=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
    for(let court=0;court<half;court++){
      const first=rotation[court],second=rotation[rotation.length-1-court];
      if(!first||!second)continue;
      const swap=(round+court)%2===1,a=swap?second:first,b=swap?first:second;
      matches.push({id:'league-'+pairKey(a.id,b.id),pool:'League',stage:'league',round:round+1,court:'Court '+(court+1),time,a:a.id,b:b.id,status:'upcoming',games:[]});
    }
    rotation.splice(1,0,rotation.pop());
  }
  return matches;
}
function ensureSingleLeague(){
  if(isRotation()||!data.teams?.length||data.tournament.leagueStyle==='single')return;
  const previous=new Map(data.matches.filter(match=>match.stage!=='playoff').map(match=>[pairKey(match.a,match.b),match]));
  data.teams.forEach(item=>{item.pool='League';});
  data.matches=generatedMatches(data.teams).map(match=>{
    const old=previous.get(pairKey(match.a,match.b));
    return old?{...match,status:old.status,games:old.games||[]}:match;
  });
  data.tournament.leagueStyle='single';
}
function standings(){
  const rows=data.teams.map(item=>({team:item,played:0,wins:0,losses:0,for:0,against:0}));
  data.matches.filter(match=>match.stage!=='playoff'&&match.status==='complete').forEach(match=>{
    const a=rows.find(row=>row.team.id===match.a),b=rows.find(row=>row.team.id===match.b),winner=matchWinner(match);
    if(!a||!b)return;
    a.played++;b.played++;
    if(winner===match.a){a.wins++;b.losses++;}else if(winner===match.b){b.wins++;a.losses++;}
    (match.games||[]).forEach(score=>{a.for+=score[0];a.against+=score[1];b.for+=score[1];b.against+=score[0];});
  });
  return rows.sort((a,b)=>b.wins-a.wins||(b.for-b.against)-(a.for-a.against)||b.for-a.for);
}
function poolIds(){return isRotation()?[]:['League'];}
function renderNext(){
  if(isRotation()){const match=rotationMatches().find(item=>item.status==='upcoming');if(!match){$('#nextMatch').innerHTML='<p class="rotation-ready">All three rounds are complete. See the leaderboard below.</p>';return;}$('#nextMatch').innerHTML='<div class="next-match rotation-next"><div class="rotation-pair"><span>'+rotationPair(match.a)+'</span><small>Round '+match.round+' · '+match.group+'</small></div><div class="versus">VS<br><small>GROUP GAME '+match.slot+'</small></div><div class="rotation-pair reverse"><span>'+rotationPair(match.b)+'</span><small>Round '+match.round+' · '+match.group+'</small></div></div>';return;}
  const match=data.matches.find(item=>item.status==='live')||data.matches.find(item=>item.status==='upcoming');if(!match)return;
  const label=match.stage==='playoff'?(match.playoffLabel||'PLAYOFF'):'FULL LEAGUE';
  $('#nextMatch').innerHTML='<div class="next-match">'+teamBlock(team(match.a))+'<div class="versus">VS<br><small>'+label+'</small></div>'+teamBlock(team(match.b),true)+'</div>';
}
function renderStats(){
  const matches=isRotation()?rotationMatches():data.matches,done=matches.filter(match=>match.status==='complete').length,left=Math.max(0,matches.length-done);
  $('#playedCount').textContent=done;$('#remainingCount').textContent=left;
  if(isRotation()){
    const sizes=data.rotation?.groupSizes||data.rotation?.rounds[0]?.groups.map(group=>group.playerIds.length)||[4],label=[...new Set(sizes)].join('–');
    $('#liveStatus').textContent='Round '+data.rotation.rounds.length+' of 3';$('#formatStatNumber').textContent=data.rotation.rounds[0].groups.length;$('#formatStatLabel').textContent=data.players.length+' players · groups of '+label;
  }else{
    $('#liveStatus').textContent=matches.filter(match=>match.status==='live').length+' courts live';$('#formatStatNumber').textContent=data.teams.length;$('#formatStatLabel').textContent='fixed pairs · full round robin';
  }
}
function renderTournamentMeta(){
  $('#eventName').textContent=data.tournament.name;$('#eventDate').textContent=data.tournament.date;$('#eventVenue').textContent=data.tournament.venue;
  if(isRotation()){
    const sizes=data.rotation.groupSizes||data.rotation.rounds[0].groups.map(group=>group.playerIds.length),count=sizes.length,text=sizes.join(' / '),exact=sizes.every(size=>size%4===0);
    $('#heroDescription').textContent=data.players.length+' players rotate partners in '+count+' balanced groups ('+text+' players), matched by experience level.';
    $('#formatGuideTitle').innerHTML='Rotate. Rank.<br />Regroup.';
    $('#formatGuideSteps').innerHTML='<li><b>01</b><span>Experience levels are balanced across groups of '+text+' players.</span></li><li><b>02</b><span>'+(exact?'Every player gets exactly three doubles games each round.':'Groups with 5+ players use a fair 3–4 game rotation.')+'</span></li><li><b>03</b><span>Round 2 uses Round 1 +/- only; Round 3 uses Round 2 +/- only. Total +/- decides the podium.</span></li>';
  }else{
    $('#heroDescription').textContent=data.teams.length+' fixed pairs play one full round-robin league: every pair meets every other pair once. The top four enter the double-chance playoff.';
    $('#formatGuideTitle').innerHTML='One league.<br />Four playoff teams.';
    $('#formatGuideSteps').innerHTML='<li><b>01</b><span>Every pair plays all other '+(data.teams.length-1)+' pairs once.</span></li><li><b>02</b><span>The top 4 qualify for the playoff.</span></li><li><b>03</b><span>#1 vs #2 decides the first finalist; #3 vs #4 begins the second path.</span></li>';
  }
}
function renderRules(){
  if(isRotation()){
    const sizes=data.rotation.groupSizes||data.rotation.rounds[0].groups.map(group=>group.playerIds.length);$('#formatRuleTitle').textContent='Rotate, rank, regroup';$('#formatRuleText').textContent='Each player receives the match point difference: 21–12 is +9 for the winners and −9 for the opponents. Round 2 groups use Round 1 +/- only; Round 3 groups use Round 2 +/- only. The top 3 are decided by total +/−.';$('#quickFormatRuleTitle').textContent='Balanced rotations';$('#quickFormatRuleText').textContent='Experience-aware groups of '+sizes.join(' / ')+' play for +/- points across all three rounds.';
  }else{
    $('#formatRuleTitle').textContent='One full league';$('#formatRuleText').textContent='Every fixed doubles pair meets every other pair once. The top 4 progress to a double-chance playoff: #1 vs #2 sends its winner to the final; #3 vs #4 meets the #1/#2 loser for the other final place.';$('#quickFormatRuleTitle').textContent='Full round robin';$('#quickFormatRuleText').textContent='Every pair plays all other '+(data.teams.length-1)+' pairs once before the top-four playoff.';
  }
}
function renderBracket(){
  if(isRotation()){renderRotationProgress();return;}
  const ranked=overallTeamRankings(),seeds=ranked.slice(0,4).map(row=>row.team);
  $('.bracket-section .eyebrow').innerHTML='<span></span> Top-four playoff';$('.bracket-section h2').textContent='Double-chance path';$('.bracket-key').innerHTML='<span><i class="key-win"></i> #1/#2 winner goes straight to final</span><span><i></i> #3/#4 winner faces the #1/#2 loser</span>';
  $('.round-labels').className='round-labels dynamic-bracket-labels';$('.round-labels').style.setProperty('--bracket-columns',3);$('.round-labels').innerHTML='<span>Final place 1</span><span>Final qualifier</span><span>Final</span>';
  $('#bracketGrid').className='bracket-grid dynamic-bracket-grid';$('#bracketGrid').style.setProperty('--bracket-columns',3);
  if(seeds.length<4){$('#bracketGrid').innerHTML='<p class="rotation-ready">Add at least four pairs to unlock the top-four playoff.</p>';return;}
  const firstFinalist=bracketCard('1 vs 2 · winner to final',seeds[0],seeds[1]);
  const eliminator=bracketCard('3 vs 4 · eliminator',seeds[2],seeds[3]);
  const secondFinalist=bracketCard('Second final place','Winner 3 vs 4','Loser 1 vs 2');
  const final=bracketCard('FINAL','Winner 1 vs 2','Winner second final place',true);
  $('#bracketGrid').innerHTML='<div class="bracket-col">'+firstFinalist+eliminator+'</div><div class="bracket-col semi">'+secondFinalist+'</div><div class="bracket-col final">'+final+'</div>';
}
function renderAll(){if(!isRotation()){ensureSingleLeague();syncFixedPlayoffs();}renderTournamentMeta();renderNext();renderStats();renderFixtures();renderStandings();renderBracket();renderRole();renderRules();renderRequests();}
function openScore(id){
  const match=isRotation()?rotationMatchDetails(id):data.matches.find(item=>item.id===id);if(!match)return;
  editingMatchId=id;const sideA=isRotation()?rotationPair(match.a):team(match.a).name,sideB=isRotation()?rotationPair(match.b):team(match.b).name;
  $('#scoreMatchTitle').textContent=sideA+' vs '+sideB;$('#scoreTeams').textContent=isRotation()?'Round '+match.round+' · '+match.group+' · Group game '+match.slot:(match.stage==='playoff'?(match.playoffLabel||'Playoff'):'Full round-robin league')+' · '+match.court+' · '+match.time;
  $('#scoreFormatHint').textContent=match.status==='complete'?'Correct the one-game score, then save the update.':'Record one game to 21 points. The higher score wins the match.';
  $('#scoreSideA').textContent=sideA;$('#scoreSideB').textContent=sideB;
  const fields=$$('#scoreForm input[type=number]');fields.forEach((field,index)=>{field.value=match.games[0]?.[index]??'';field.setAttribute('aria-label',(index?'Second':'First')+' pair: '+(index?sideB:sideA)+' score');});
  $('#scoreMessage').textContent='';$('#scoreDialog').showModal();
}
const legacyRenderPairInputs=renderPairInputs;
renderPairInputs=function(format=$('#newFormat')?.value||'teams'){
  legacyRenderPairInputs(format);
  if(format==='rotation')return;
  $('#newTournamentIntro').textContent='Add '+(playerCountForBuilder(format)/2)+' fixed pairs (maximum 10 teams). Every pair will play every other pair once, then the top four enter the double-chance playoff.';
  $('#formatBuilderHelp').textContent='Fixed doubles supports 2–10 teams. Every pair plays all other pairs once; there are no league groups.';
  $$('.pair-number span').forEach(label=>{label.textContent='Full league';});
}

function matchLoser(match){const winner=matchWinner(match);return winner===match?.a?match.b:winner===match?.b?match.a:null;}
function playoffById(id){return data.matches.find(match=>match.id===id);}
function upsertPlayoff(id,label,a,b,roundOffset,courtNumber){
  if(!a||!b)return null;
  const existing=playoffById(id);
  if(existing){
    if(existing.status!=='complete'&&(existing.a!==a||existing.b!==b)){existing.a=a;existing.b=b;existing.games=[];existing.status='upcoming';}
    return existing;
  }
  const minutes=9*60+(data.teams.length-1)*75+roundOffset*75;
  const created={id,stage:'playoff',playoffLabel:label,round:'Playoffs',court:label+' · Court '+courtNumber,time:String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0'),a,b,status:'upcoming',games:[]};
  data.matches.push(created);
  return created;
}
function syncFixedPlayoffs(){
  if(isRotation())return '';
  const league=data.matches.filter(match=>match.stage!=='playoff');
  if(data.teams.length<4||league.length===0||league.some(match=>match.status!=='complete'))return '';
  const seeds=standings().slice(0,4).map(row=>row.team.id);
  const before=data.matches.length;
  const qualifierOne=upsertPlayoff('playoff-q1','Qualifier 1 · #1 vs #2',seeds[0],seeds[1],0,1);
  const eliminator=upsertPlayoff('playoff-e','Eliminator · #3 vs #4',seeds[2],seeds[3],0,2);
  if(qualifierOne?.status==='complete'&&eliminator?.status==='complete'){
    const qualifierTwo=upsertPlayoff('playoff-q2','Qualifier 2 · winner #3/#4 vs loser #1/#2',matchWinner(eliminator),matchLoser(qualifierOne),1,1);
    if(qualifierTwo?.status==='complete')upsertPlayoff('playoff-final','FINAL',matchWinner(qualifierOne),matchWinner(qualifierTwo),2,1);
  }
  return data.matches.length>before?'Playoff fixtures are ready.':'';
}
function playoffCard(label,match,fallbackA,fallbackB,final=false){
  const winner=matchWinner(match||{}),a=match?.a?team(match.a):fallbackA,b=match?.b?team(match.b):fallbackB,displayLabel=label+(match?.games?.length?' · '+scoreString(match):'');
  return '<div class="bracket-match '+(final?'final-card':'')+'"><div class="bracket-row placeholder"><span>'+displayLabel+'</span><b>'+(final?'🏆':'—')+'</b></div>'+roundRow(a,winner===match?.a)+roundRow(b,winner===match?.b)+'</div>';
}
function renderBracket(){
  if(isRotation()){renderRotationProgress();return;}
  const seeds=overallTeamRankings().slice(0,4).map(row=>row.team),q1=playoffById('playoff-q1'),eliminator=playoffById('playoff-e'),q2=playoffById('playoff-q2'),final=playoffById('playoff-final');
  $('.bracket-section .eyebrow').innerHTML='<span></span> Top-four playoff';$('.bracket-section h2').textContent='Double-chance path';$('.bracket-key').innerHTML='<span><i class="key-win"></i> #1/#2 winner goes straight to final</span><span><i></i> #3/#4 winner faces the #1/#2 loser</span>';
  $('.round-labels').className='round-labels dynamic-bracket-labels';$('.round-labels').style.setProperty('--bracket-columns',3);$('.round-labels').innerHTML='<span>Qualifier & eliminator</span><span>Second final place</span><span>Final</span>';
  $('#bracketGrid').className='bracket-grid dynamic-bracket-grid';$('#bracketGrid').style.setProperty('--bracket-columns',3);
  if(seeds.length<4){$('#bracketGrid').innerHTML='<p class="rotation-ready">Add at least four pairs to unlock the top-four playoff.</p>';return;}
  const left=playoffCard('Qualifier 1 · #1 vs #2',q1,seeds[0],seeds[1])+playoffCard('Eliminator · #3 vs #4',eliminator,seeds[2],seeds[3]);
  const middle=playoffCard('Qualifier 2',q2,'Winner #3 vs #4','Loser #1 vs #2');
  const right=playoffCard('FINAL',final,'Winner #1 vs #2','Winner qualifier 2',true);
  $('#bracketGrid').innerHTML='<div class="bracket-col">'+left+'</div><div class="bracket-col semi">'+middle+'</div><div class="bracket-col final">'+right+'</div>';
}
$('#scoreForm').addEventListener('submit',()=>{
  if(isRotation())return;
  const match=data.matches.find(item=>item.id===editingMatchId),scores=$$('#scoreForm input[type=number]').map(field=>field.value===''?null:Number(field.value));
  if(!match||scores[0]===null||scores[1]===null||scores[0]===scores[1])return;
  const update=syncFixedPlayoffs();
  if(update){save();renderAll();toast(update);}
});

function tournamentPodium(){
  if(isRotation()){
    const matches=rotationMatches();
    if(data.rotation?.rounds.length<3||matches.length===0||matches.some(match=>match.status!=='complete'))return null;
    const standings=rotationOverallScores();
    return standings.length>1?{winner:standings[0].player.name,runner:standings[1].player.name,detail:'Final total +/-: '+signedScore(standings[0].score)+' to '+signedScore(standings[1].score)}:null;
  }
  const final=playoffById('playoff-final');
  if(final?.status!=='complete')return null;
  const winner=matchWinner(final),runner=matchLoser(final);
  return winner&&runner?{winner:team(winner).name,runner:team(runner).name,detail:'Final score: '+scoreString(final)}:null;
}
function renderPodium(){
  const podium=tournamentPodium(),panel=$('#podiumPanel');
  panel.hidden=!podium;
  if(!podium)return;
  $('#winnerName').textContent=podium.winner;$('#runnerName').textContent=podium.runner;$('#podiumScore').textContent=podium.detail;
}
function renderAll(){if(!isRotation()){ensureSingleLeague();syncFixedPlayoffs();}renderTournamentMeta();renderNext();renderStats();renderFixtures();renderStandings();renderBracket();renderRole();renderRules();renderRequests();renderPodium();renderRegistrationControls();}
var selectedFixtureTeamId='';
function renderTeamFixturePicker(){
  const button=$('.filter-tab[data-filter="team"]'),control=$('#teamFixtureControl'),select=$('#teamFixtureSelect');
  if(isRotation()){
    if(activeFilter==='team')activeFilter='all';
    if(button)button.hidden=true;
    if(control)control.hidden=true;
    return;
  }
  if(button)button.hidden=false;
  if(!control||!select)return;
  control.hidden=activeFilter!=='team';
  const oldValue=selectedFixtureTeamId;
  select.textContent='';
  const prompt=document.createElement('option');prompt.value='';prompt.textContent='Choose a team';select.append(prompt);
  data.teams.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);});
  if(data.teams.some(item=>item.id===oldValue))select.value=oldValue;
  select.onchange=()=>{selectedFixtureTeamId=select.value;renderFixtures();};
}
function fixtureTeamLine(item,score,index){
  const row=document.createElement('div'),name=document.createElement('span'),dot=document.createElement('i'),points=document.createElement('span');
  row.className='fixture-team';name.className='name';dot.className='fixture-dot';points.className='fixture-score';name.append(dot,document.createTextNode(item.name));points.textContent=score;
  row.append(name,points);return row;
}
function renderFixtures(){
  renderTeamFixturePicker();
  if(isRotation()){renderRotationFixtures();return;}
  $('#fixtureFormatNote').textContent='1 game · 21 points';$('#fixturesEyebrow').innerHTML='<span></span> League stage';$('#fixturesTitle').textContent=activeFilter==='team'?'Selected team fixtures':'League fixtures';
  const statusCopy={live:'LIVE NOW',upcoming:'UP NEXT',complete:'PLAYED'},list=$('#fixturesList');
  list.textContent='';
  const visible=data.matches.filter(match=>activeFilter==='team'?selectedFixtureTeamId&&(match.a===selectedFixtureTeamId||match.b===selectedFixtureTeamId):activeFilter==='all'||match.status===activeFilter);
  if(activeFilter==='team'&&!selectedFixtureTeamId){const message=document.createElement('p');message.className='team-filter-empty';message.textContent='Choose a team above to see its fixtures.';list.append(message);return;}
  if(activeFilter==='team'&&visible.length===0){const message=document.createElement('p');message.className='team-filter-empty';message.textContent='No fixtures have been generated for this team yet.';list.append(message);return;}
  visible.forEach(match=>{
    const card=document.createElement('article'),meta=document.createElement('div'),teams=document.createElement('div'),action=document.createElement('div'),button=document.createElement('button');
    card.className='fixture-item '+match.status;meta.className='fixture-meta';meta.innerHTML='<b>'+statusCopy[match.status]+'</b>'+match.time+'<br>'+match.court;
    teams.className='fixture-teams';teams.append(fixtureTeamLine(team(match.a),match.games[0]?match.games.map(score=>score[0]).join(' '):'',0),fixtureTeamLine(team(match.b),match.games[0]?match.games.map(score=>score[1]).join(' '):'',1));
    action.className='fixture-action';button.className='score-edit';button.dataset.matchId=match.id;button.textContent=match.status==='complete'?'Edit score':'Enter score';button.onclick=()=>openScore(match.id);action.append(button);
    card.append(meta,teams,action);list.append(card);
  });
}

// Player registration is stored in the same live tournament state, so the organiser
// can collect names before creating a draw without maintaining a separate list.
var registrationAutoOpened=false;
function registeredPlayers(){return Array.isArray(data.registrations)?data.registrations:[];}
function registrationMode(){return new URLSearchParams(window.location.search).get('register')==='1';}
function registrationUrl(){const shared=shareUrl();if(!shared)return '';const url=new URL(shared);url.searchParams.set('register','1');return url.toString();}
function registrationCountLabel(count){return count+' '+(count===1?'player':'players');}
function registrationIsFixedDoubles(){return data.tournament?.format==='teams';}
function fixedRegistrationLimit(){return 10;}
function normalisedTeamRegistration(entry){
  const members=Array.isArray(entry?.players)?entry.players:entry?.first&&entry?.second?[entry.first,entry.second]:[];
  const names=members.map(member=>typeof member==='string'?member:member?.name).filter(Boolean);
  return names.length===2?{id:entry.id||names.join('::'),players:names,name:names.join(' & ')}:null;
}
function registeredTeams(){
  const entries=registeredPlayers(),teams=entries.map(normalisedTeamRegistration).filter(Boolean),legacy=entries.filter(entry=>entry?.name&&!normalisedTeamRegistration(entry));
  for(let index=0;index+1<legacy.length;index+=2)teams.push({id:legacy[index].id+'::'+legacy[index+1].id,players:[legacy[index].name,legacy[index+1].name],name:legacy[index].name+' & '+legacy[index+1].name});
  return teams;
}
function registeredPlayerRoster(){
  return registeredPlayers().flatMap(entry=>{
    const team=normalisedTeamRegistration(entry);
    if(team)return team.players.map(name=>({name,experience:'intermediate'}));
    return entry?.name?[{name:entry.name,experience:EXPERIENCE_SCORE[entry.experience]?entry.experience:'intermediate'}]:[];
  });
}
function registrationTeamCountLabel(count){return count+' '+(count===1?'team':'teams');}
function updateRegistrationBuilderNote(){
  const roster=registeredPlayerRoster(),teams=registeredTeams(),fixedSignup=registrationIsFixedDoubles(),note=$('#registrationBuilderNote'),count=$('#registeredPlayerCount'),loader=$('#loadRegistrationsButton');
  if(!note||!count||!loader)return;
  count.textContent=fixedSignup?registrationTeamCountLabel(teams.length)+' · '+registrationCountLabel(roster.length):registrationCountLabel(roster.length);
  loader.disabled=roster.length===0;
  if(!roster.length){note.textContent='Share the player sign-up link from Tournament setup to collect names and skill levels.';return;}
  const format=$('#newFormat')?.value||'teams';
  if(roster.length<4){note.textContent=registrationCountLabel(roster.length)+' registered. Add at least '+(4-roster.length)+' more before creating a tournament.';return;}
  if(format==='rotation'){note.textContent=registrationCountLabel(roster.length)+' ready. Loading them keeps their selected experience levels.';return;}
  if(fixedSignup){note.textContent=registrationTeamCountLabel(teams.length)+' ready. Their submitted pairings will be loaded into fixed doubles.';return;}
  note.textContent=registrationCountLabel(roster.length)+' ready. Fixed doubles pairs are filled in sign-up order; you can edit the pairings before creating the tournament.'+(roster.length%2?' Add one more player to complete the final pair.':'');
}
function renderRegistrationControls(){
  const entries=registeredPlayers(),teams=registeredTeams(),summary=$('#registrationSummary'),copy=$('#copyRegistrationLinkButton');
  if(summary){
    if(!entries.length)summary.textContent='No players have registered yet.';
    else if(registrationIsFixedDoubles()){const names=teams.slice(0,5).map(team=>team.name).join(' · '),extra=teams.length>5?' +' +(teams.length-5)+' more':'';summary.textContent=registrationTeamCountLabel(teams.length)+' of '+fixedRegistrationLimit()+' registered · '+Math.max(0,fixedRegistrationLimit()-teams.length)+' team spots left'+(names?': '+names+extra+'.':'.');}
    else{const names=entries.slice(0,6).map(person=>person.name).join(' · '),extra=entries.length>6?' +' +(entries.length-6)+' more':'';summary.textContent=registrationCountLabel(entries.length)+' registered: '+names+extra+'.';}
  }
  if(copy)copy.disabled=!cloud.tournamentId;
  updateRegistrationBuilderNote();
  if(registrationMode()&&cloud.ready&&cloud.tournamentId&&!registrationAutoOpened){registrationAutoOpened=true;openRegistrationDialog();}
  else if(registrationMode()&&$('#registrationDialog')?.open)updateRegistrationDialog();
}
function updateRegistrationDialog(){
  const fixed=registrationIsFixedDoubles(),teamCount=registeredTeams().length,spotsLeft=Math.max(0,fixedRegistrationLimit()-teamCount),secondLabel=$('#registrationSecondPlayerLabel'),experienceLabel=$('#registrationExperienceLabel'),partner=$('#registrationPartnerName'),submit=$('#registrationSubmitButton');
  $('#registrationTitle').innerHTML=fixed?'Register your<br /><em>team.</em>':'Join the<br /><em>tournament.</em>';
  $('#registrationFirstPlayerLabel').firstChild.textContent=fixed?'Player 1':'Your name';
  $('#registrationName').placeholder=fixed?'First player name':'Your name';
  secondLabel.hidden=!fixed;experienceLabel.hidden=fixed;partner.required=fixed;
  if(fixed){$('#registrationTournament').textContent=teamCount+' of '+fixedRegistrationLimit()+' teams registered · '+spotsLeft+' team spots left. Add both player names to hold a team spot.';submit.textContent=spotsLeft?'Register team →':'All team spots filled';submit.disabled=!spotsLeft;}
  else{$('#registrationTournament').textContent='Add your name and experience level for '+data.tournament.name+'. The organiser will load this list into the tournament creator.';submit.innerHTML='Add me to the list <span>→</span>';submit.disabled=false;}
}
function openRegistrationDialog(){
  const dialog=$('#registrationDialog');if(!dialog||dialog.open)return;
  updateRegistrationDialog();$('#registrationMessage').textContent='';
  dialog.showModal();
}
function loadRegisteredPlayersIntoBuilder(announce=false){
  const roster=registeredPlayerRoster(),teams=registeredTeams(),format=$('#newFormat').value,preservePairs=format==='teams'&&registrationIsFixedDoubles();
  if(!roster.length){if(announce)$('#newTournamentMessage').textContent='There are no registered players to load yet.';updateRegistrationBuilderNote();return false;}
  if(format==='teams'&&roster.length>20){$('#newTournamentMessage').textContent='Fixed doubles is limited to 10 teams. Use Rotation League for a larger player list.';return false;}
  const playerCount=Math.max(4,format==='teams'&&roster.length%2?roster.length+1:roster.length);
  $('#newPlayerCount').value=playerCount;
  renderPairInputs(format);
  if(format==='rotation'){
    $$('[data-rotation-player]').forEach((input,index)=>{const entry=roster[index];if(!entry)return;input.value=entry.name;const level=$('[data-rotation-level="'+index+'"]');if(level)level.value=EXPERIENCE_SCORE[entry.experience]?entry.experience:'intermediate';});
  }else{
    const names=preservePairs?teams.flatMap(team=>team.players):roster.map(entry=>entry.name);$$('[data-player]').forEach((input,index)=>{if(names[index])input.value=names[index];});
  }
  updateRegistrationBuilderNote();
  if(announce)$('#newTournamentMessage').textContent=(preservePairs?registrationTeamCountLabel(teams.length):registrationCountLabel(roster.length))+' loaded from the sign-up list.';
  return true;
}
function openNewTournament(){
  $('#newFormat').value='teams';
  $('#newPlayerCount').value='16';
  renderPairInputs('teams');
  $('#newEventName').value='';$('#newEventVenue').value='';$('#newEventDate').value=new Date().toISOString().slice(0,10);$('#newTournamentMessage').textContent='';
  updateRegistrationBuilderNote();
  if(registeredPlayers().length)loadRegisteredPlayersIntoBuilder();
  $('#dashboardDialog').close();$('#newTournamentDialog').showModal();
}
$('#copyRegistrationLinkButton').onclick=async()=>{
  const link=registrationUrl();if(!link){toast('Publish the tournament first to create a player sign-up link.');return;}
  try{await navigator.clipboard.writeText(link);toast('Player sign-up link copied.');}catch{toast('Copy the player sign-up link from your browser address bar.');}
};
$('#loadRegistrationsButton').onclick=()=>loadRegisteredPlayersIntoBuilder(true);
$('#newFormat').addEventListener('change',updateRegistrationBuilderNote);
$('#newPlayerCount').addEventListener('input',updateRegistrationBuilderNote);
$('#registrationForm').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('#registrationName').value.trim(),partner=$('#registrationPartnerName').value.trim(),experience=$('#registrationExperience').value,message=$('#registrationMessage'),fixed=registrationIsFixedDoubles();
  if(!name){message.textContent='Please enter your name.';return;}
  if(!cloud.tournamentId){message.textContent='This player sign-up link is not connected to a live tournament yet.';return;}
  data.registrations=registeredPlayers();
  if(fixed){
    if(!partner){message.textContent='Please enter both player names for the team.';return;}
    if(name.toLocaleLowerCase()===partner.toLocaleLowerCase()){message.textContent='Please enter two different player names.';return;}
    if(registeredTeams().length>=fixedRegistrationLimit()){message.textContent='All '+fixedRegistrationLimit()+' team spots are full.';return;}
    const existingNames=new Set(registeredPlayerRoster().map(player=>player.name.toLocaleLowerCase()));
    if(existingNames.has(name.toLocaleLowerCase())||existingNames.has(partner.toLocaleLowerCase())){message.textContent='One of these players is already registered on a team.';return;}
    data.registrations.push({id:(crypto.randomUUID?crypto.randomUUID():'team-'+Date.now()+'-'+Math.random().toString(36).slice(2)),kind:'team',players:[{name},{name:partner}],createdAt:new Date().toISOString()});
    message.textContent='Team registered. '+Math.max(0,fixedRegistrationLimit()-registeredTeams().length)+' team spots remain.';$('#registrationName').value='';$('#registrationPartnerName').value='';save();renderRegistrationControls();return;
  }
  if(!EXPERIENCE_SCORE[experience]){message.textContent='Please select your experience level.';return;}
  const existing=data.registrations.find(person=>person.name.toLocaleLowerCase()===name.toLocaleLowerCase());
  if(existing){existing.name=name;existing.experience=experience;message.textContent='Your registration has been updated.';}
  else{data.registrations.push({id:(crypto.randomUUID?crypto.randomUUID():'registration-'+Date.now()+'-'+Math.random().toString(36).slice(2)),name,experience,createdAt:new Date().toISOString()});message.textContent='You are on the player list.';}
  save();renderRegistrationControls();$('#registrationName').value='';
});
