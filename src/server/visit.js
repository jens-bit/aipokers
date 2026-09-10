// Visits use the existing kitchen table. The owner's invitation is consent;
// the recipient's answer is admission. Public identity never authorizes travel.
import { randomUUID, randomBytes } from 'node:crypto';
import { bumpTick, loadVisitInvitation, invitationForAgent, saveVisitInvitation,
  loadVisitRecords, saveVisitMutation } from './store.js';
import { allOwnerIds, agentsOf, saveOwner, reloadOwners, seatStatusOf,
  presentAgentById, presentedRoster } from './agentProfiles.js';
import { Where, routineFor } from './home.js';
import * as homeGameMod from './homeGame.js';
import { notifyEvent } from './notify.js';
import { notifyHomeChanged } from './floorChannel.js';
import { guestCannotVisit, guestFor } from './guest.js';
import { telegramAuthMiddleware, isOwner } from './auth.js';
import { ensurePocket, debitBuyIn, creditCashOut } from './wallet.js';

export const VISIT_RESPOND_MS = 30 * 60_000;
export const VISIT_MAX_MS = 2 * 60 * 60_000;
export const VISIT_MAX_HANDS = 40;
export const WAGER_CAP_PCT = 0.10;
const VISIT_TICK_MS = 30_000;
let liveTables = null, tick = null, loaded = false;
const visits = new Map();
// Live tables are not restored on boot. Bind acceptance to their existing
// seat-session UUIDs; the explicit restart path still refunds interrupted visits.
const visitGames = new Map();
const pendingClosures = new Map();
function loadVisits() {
  if (loaded) return;
  for (const record of loadVisitRecords()) visits.set(record.id, record);
  loaded = true;
}
export function configure({ liveTables: tables = null } = {}) {
  if (liveTables !== tables) liveTables?.setCloseHook?.(null);
  liveTables = tables; loadVisits();
  liveTables?.setCloseHook?.(captureClosedGame);
}
const REFUSAL_LINES = Object.freeze({
  inHand: 'He is in a hand. Try again after it finishes.',
  notHome: 'He is not home — bring him back first.',
  self: 'He cannot visit his own house.',
  alreadyVisiting: 'He is already out visiting somebody.',
  guestCannotVisit: 'Keep him and he can go visiting.',
  hostBusy: 'Somebody is already at the door.',
  invitationRequired: 'Ask his owner for a new invitation.',
  invitationExpired: 'This invitation has expired. Ask his owner for another.',
  invitationUsed: 'This invitation has already been used.',
  stakeNotAuthorized: 'His owner did not agree to that wager.',
  visitExpired: 'The knock has expired. Ask his owner for another invitation.',
  hostFull: 'Every chair is taken. Try again when one is free.',
  hostInHand: 'Your table is in a hand. Let it finish, then try again.',
  hostPlaying: 'Finish your game first, then let him in.',
  hostPaused: 'Your household is taking a break. Try again when the table is ready.',
  hostUnavailable: 'There is nobody ready to play here yet.',
  guestUnavailable: 'He is not ready to play. Try again after his break.',
});
const refuse = (status, reason, extra = {}) => ({ status,
  body: { error: REFUSAL_LINES[reason] ?? 'Not now.', reason, ...extra } });
const unavailable = () => ({status:503,body:{error:'The visit could not be saved. Please try again.',reason:'visitUnavailable'}});
function findAgentOwner(agentId) {
  for (const ownerId of allOwnerIds()) {
    const agent=agentsOf(ownerId).find(a=>a.id===agentId);
    if (agent) return {ownerId,agent};
  }
  return null;
}
function currentGuest(record) {
  const found=findAgentOwner(record.agentId);
  return found && found.ownerId===record.guestUserId && !found.agent.archived
    && found.agent.visiting?.visitId===record.id
    && found.agent.visiting?.hostUserId===record.hostUserId ? found : null;
}
function tableBusy(table) { return !!table && !table.closed && (table.handInProgress?.() || !!table._pendingPaceResult); }
function hostTable(record) { return liveTables?.getTable?.(homeGameMod.homeTableId(record.hostUserId)) ?? null; }
function changed(record, { sync = true } = {}) {
  for (const owner of new Set([record.guestUserId,record.hostUserId])) {
    if (sync) { try { homeGameMod.sync(owner); } catch (err) { console.error('[visit] resync failed:',err.message); } }
    try { notifyHomeChanged(owner); } catch (err) { console.error('[visit] push failed:',err.message); }
  }
}
function persist(record, mutate = () => {}, invitation = null) {
  const affectedOwners = [record.guestUserId,record.hostUserId,
    findAgentOwner(record.agentId)?.ownerId,findAgentOwner(record.hostAgentId)?.ownerId].filter(Boolean);
  try {
    saveVisitMutation(record,mutate,invitation);visits.set(record.id,record);
    const completed=[...visits.values()].filter(v=>v.guestUserId===record.guestUserId && !['pending','accepted'].includes(v.status));
    for(const old of completed.slice(0,-8))visits.delete(old.id);
  }
  catch (err) {
    reloadOwners(...affectedOwners);
    visits.clear();loaded=false;loadVisits();
    throw err;
  }
}
function activeVisitFor(hostUserId) {
  loadVisits();
  return [...visits.values()].find(v=>v.hostUserId===String(hostUserId) && ['pending','accepted'].includes(v.status)) ?? null;
}
function clearVisiting(record) {
  const found=findAgentOwner(record.agentId);
  if (found?.agent.visiting?.visitId===record.id) { found.agent.visiting=null;saveOwner(found.ownerId); }
}
const validStake = value => typeof value==='number' && Number.isSafeInteger(value) && value>=0;

/** Owner-only issuance. Reopening an unchanged share sheet preserves its link. */
export function issueVisitInvitation({agentId,userId,stake=0}={}) {
  const found=findAgentOwner(agentId);
  if (!found || found.ownerId!==String(userId)) return {status:404,body:{error:'Agent not found'}};
  if (found.agent.archived) return {status:410,body:{error:'agentRetired'}};
  if (guestCannotVisit(found.ownerId)) return refuse(403,'guestCannotVisit');
  if (!validStake(stake)) return {status:400,body:{error:'Invalid wager'}};
  const now=Date.now(), previous=invitationForAgent(agentId);
  let invitation=previous && !previous.visitId && previous.ownerId===found.ownerId && previous.expiresAt>now && previous.maxStake===stake ? previous : null;
  if (!invitation) {
    if (found.agent.visiting) return refuse(409,'alreadyVisiting');
    invitation={token:randomBytes(24).toString('base64url'),agentId,ownerId:found.ownerId,maxStake:stake,expiresAt:now+VISIT_RESPOND_MS,visitId:null};
    saveVisitInvitation(invitation);
  }
  return {status:200,body:{agentId,agentName:found.agent.name||'Agent',invitationToken:invitation.token,
    expiresAt:invitation.expiresAt,maxStake:invitation.maxStake,startParam:`visit_${invitation.token}`}};
}
export function previewVisitInvitation(token) {
  const invitation=loadVisitInvitation(token);
  if (!invitation) return refuse(403,'invitationRequired');
  if (invitation.expiresAt<=Date.now()) return refuse(410,'invitationExpired');
  const found=findAgentOwner(invitation.agentId);
  if (!found || found.ownerId!==invitation.ownerId || found.agent.archived) return refuse(410,'invitationExpired');
  return {status:200,body:{agentId:invitation.agentId,agentName:found.agent.name||'Agent',expiresAt:invitation.expiresAt,maxStake:invitation.maxStake}};
}
function knockBody(record) { return {visitId:record.id,agentId:record.agentId,agentName:record.agentName,hostUserId:record.hostUserId,respondBy:record.respondBy,status:record.status}; }

/** Recipient redeems the owner's capability. Same-host retries are read-only. */
export function requestVisit({agentId,hostUserId,stake=0,invitationToken}={}) {
  loadVisits();
  const invitation=loadVisitInvitation(invitationToken);
  if (!invitation || invitation.agentId!==agentId) return refuse(403,'invitationRequired');
  if (!validStake(stake) || stake>invitation.maxStake) return refuse(403,'stakeNotAuthorized');
  if (invitation.visitId) {
    const prior=visits.get(invitation.visitId);
    if (prior?.hostUserId===String(hostUserId) && currentGuest(prior)
      && ((prior.status==='pending' && prior.respondBy>Date.now()) || (prior.status==='accepted' && prior.endsAt>Date.now() && stillRunning(prior)))) {
      return {status:200,body:knockBody(prior)};
    }
    return refuse(409,'invitationUsed');
  }
  if (invitation.expiresAt<=Date.now()) return refuse(410,'invitationExpired');
  const found=findAgentOwner(agentId);
  if (!found || found.ownerId!==invitation.ownerId) return refuse(403,'invitationRequired');
  const {ownerId:guestUserId,agent}=found;
  if (guestUserId===String(hostUserId)) return refuse(400,'self');
  if (agent.archived) return {status:410,body:{error:'agentRetired'}};
  if (guestCannotVisit(guestUserId)) return refuse(403,'guestCannotVisit');
  if (agent.visiting) return refuse(409,'alreadyVisiting');
  const seat=seatStatusOf(agent), sourceTable=liveTables?.homeTableOf?.(agentId);
  if (seat.inHand || tableBusy(sourceTable)) return refuse(409,'inHand');
  if (seat.atTable) return refuse(409,'notHome');
  const presented=presentAgentById(agentId,guestUserId,{owner:true});
  if (presented?.location?.where!==Where.HOME) return refuse(409,'notHome');
  if (presented.study || presented.fatigue==='worn') return refuse(409,'guestUnavailable');
  const prior=activeVisitFor(hostUserId);
  if (prior && prior.status==='pending' && prior.respondBy<=Date.now()) finishVisit(prior,'timeout');
  if (activeVisitFor(hostUserId)) return refuse(409,'hostBusy');
  const now=Date.now();
  const record={id:randomUUID(),agentId,agentName:agent.name||'Agent',guestUserId,hostUserId:String(hostUserId),
    hostAgentId:null,stake,stakeAmount:0,status:'pending',createdAt:now,respondBy:now+VISIT_RESPOND_MS,acceptedAt:null,endsAt:null};
  persist(record,()=>{agent.visiting={visitId:record.id,hostUserId:record.hostUserId,since:now};saveOwner(guestUserId);}, {...invitation,visitId:record.id});
  armTick();changed(record);bumpTick('visit.knock');
  notifyEvent('visitor',{ownerId:hostUserId,agentId,agentName:record.agentName}).catch(err=>console.error('[visit] notify failed:',err.message));
  return {status:200,body:knockBody(record)};
}
/** A guest's first birth redeems the exact invitation stored at its entry. */
export function requestReferredVisit(hostUserId) {
  const referral=guestFor(hostUserId);
  if (!referral?.visitInvitationToken) return refuse(403,'invitationRequired');
  const invitation=loadVisitInvitation(referral.visitInvitationToken);
  if (!invitation) return refuse(403,'invitationRequired');
  const out=requestVisit({agentId:invitation.agentId,hostUserId,invitationToken:referral.visitInvitationToken,stake:0});
  return {...out,body:{...out.body,agentName:findAgentOwner(invitation.agentId)?.agent.name ?? 'Your visitor'}};
}
export function visitOutcome(out) {
  const body=out?.body ?? {},status=out?.status ?? 503;
  return {ok:status===200,status,
    ...(body.reason?{reason:body.reason}:{}),...(body.error?{error:body.error}:{}),
    ...(body.agentName?{agentName:body.agentName}:{}),...(body.visitId?{visitId:body.visitId}:{}),
    retryable:['inHand','hostBusy','guestUnavailable','visitUnavailable'].includes(body.reason)};
}

const ACCEPT_LINES=['Pull up a chair.','Deal him in — plenty of room.',"Room's yours."];
const DECLINE_LINES={Rock:['Not tonight. I do not know his game.',"I'll pass. Some other night."],Hothead:["Not while I'm hot. Tell him to come back.",'Not tonight — I am not in the mood.'],default:['Not tonight.','The house is full tonight.']};
function answerLine(visitId,hostUserId,accept) {
  const home=presentedRoster(hostUserId,{owner:false}).find(a=>a.location?.where===Where.HOME);
  const nature=home?.nature?.name ?? home?.nature;
  const pool=accept ? ACCEPT_LINES : (DECLINE_LINES[nature]??DECLINE_LINES.default);
  let hash=0;for(const c of visitId)hash=(hash*31+c.charCodeAt(0))|0;
  return pool[Math.abs(hash)%pool.length];
}
function actualSeat(record) {
  const table=hostTable(record),seat=table?.agentIds?.indexOf(record.agentId) ?? -1;
  return !!table && !table.closed && seat>=0 && !!table.pending?.[seat] && table.agentUserIds?.[seat]===record.guestUserId;
}
export function answerVisit(visitId,hostUserId,accept) {
  loadVisits();const record=visits.get(visitId);
  if (!record || record.hostUserId!==String(hostUserId)) return {status:404,body:{error:'Visit not found'}};
  if (record.status!=='pending') return {status:409,body:{error:'alreadyAnswered',status:record.status}};
  if (record.respondBy<=Date.now()) {finishVisit(record,'timeout');return refuse(410,'visitExpired');}
  if (!currentGuest(record)) {finishVisit(record,'ended');return refuse(409,'guestUnavailable');}
  const line=answerLine(visitId,hostUserId,accept);
  if (!accept) {finishVisit(record,'declined');return {status:200,body:{visitId,accepted:false,line,game:null}};}
  const residents=homeGameMod.eligible(presentedRoster(hostUserId,{owner:true}));
  const existingTable=hostTable(record);
  const occupied=existingTable && !existingTable.closed ? existingTable.pending.filter(Boolean).length : 0;
  if (residents.length>=homeGameMod.HOME_SEATS || occupied>=homeGameMod.HOME_SEATS) return refuse(409,'hostFull');
  if (!residents.length) return refuse(409,'hostUnavailable');
  if (existingTable && !existingTable.closed && existingTable.pending.some((p,i)=>p && !existingTable.aiSeats[i])) return refuse(409,'hostPlaying');
  const availability=homeGameMod.visitAvailability(hostUserId);
  if (availability) return refuse(409,availability);
  if (tableBusy(hostTable(record))) return refuse(409,'hostInHand');
  const guest=currentGuest(record).agent, presented=presentAgentById(record.agentId,record.guestUserId,{owner:false});
  if (presented.study || presented.fatigue==='worn') return refuse(409,'guestUnavailable');
  const host=agentsOf(hostUserId).find(a=>a.id===residents[0].id);
  record.status='accepted';record.acceptedAt=Date.now();record.endsAt=record.acceptedAt+VISIT_MAX_MS;
  persist(record,()=>{
    if (record.stake>0) {
      ensurePocket(guest);ensurePocket(host);
      const stake=Math.max(0,Math.min(record.stake,Math.floor(WAGER_CAP_PCT*Math.min(guest.pocket.balance,host.pocket.balance))));
      if (stake>0) {
        if (!debitBuyIn(guest.pocket,stake).ok || !debitBuyIn(host.pocket,stake).ok) throw new Error('Visit stake unavailable');
        record.hostAgentId=host.id;record.stakeAmount=stake;
        saveOwner(record.guestUserId);saveOwner(record.hostUserId);
      }
    }
  });
  changed(record);
  if (!actualSeat(record)) {finishVisit(record,'ended',{refund:true});return refuse(409,'hostUnavailable');}
  const table=hostTable(record);
  visitGames.set(record.id,{tableId:table.tableId,
    guestSessionId:table.sessionIdFor?.(record.agentId)??null,
    hostSessionId:record.hostAgentId?table.sessionIdFor?.(record.hostAgentId)??null:null});
  bumpTick('visit.accept');armTick();
  return {status:200,body:{visitId,accepted:true,line,game:homeGameMod.state(hostUserId)}};
}

/** Expired hands finish their existing runout, but confer no new access. */
export function listVisitorsFor(hostUserId) {
  loadVisits();const out=[];
  for (const v of visits.values()) {
    if (v.hostUserId!==String(hostUserId) || v.status!=='accepted' || !currentGuest(v) || closedGameFor(v)) continue;
    if (v.endsAt<=Date.now() && !tableBusy(hostTable(v))) continue;
    const p=presentAgentById(v.agentId,v.guestUserId,{owner:false});
    if (p) out.push({
      ...p, guest: true, ownerId: v.guestUserId,
      location: { where: Where.HOME, tableId: null, room: null, since: v.acceptedAt },
      // His own projection is away and therefore has no Home routine. The
      // host sees what he is doing in this room: only an actual current chair
      // outranks his idle habit. Admission alone cannot make him play.
      routine: routineFor({
        nature: p.nature, where: Where.HOME, atHomeTable: actualSeat(v),
        studying: !!p.study, broke: p.presence === 'broke',
        fatigue: p.fatigue, unseenRecap: p.unseenRecap,
      }),
    });
  }
  return out;
}
export function visitBodiesFor(hostUserId) {
  const bodies=listVisitorsFor(hostUserId);
  for (const v of visits.values()) {
    if (v.hostUserId!==String(hostUserId) || v.status!=='pending' || v.respondBy<=Date.now() || !currentGuest(v)) continue;
    const p=presentAgentById(v.agentId,v.guestUserId,{owner:false});
    if (p)bodies.push({...p,guest:true,ownerId:v.guestUserId,location:{where:Where.HOME,tableId:null,room:null,since:v.createdAt}});
  }
  return bodies;
}
export function pendingVisitorFor(hostUserId) {
  loadVisits();
  const v=[...visits.values()].find(v=>v.hostUserId===String(hostUserId) && v.status==='pending' && v.respondBy>Date.now() && currentGuest(v));
  return v?{id:v.id,agentId:v.agentId,agentName:v.agentName,respondBy:v.respondBy}:null;
}
function stillRunning(record) {
  if (closedGameFor(record)) return false;
  const game=homeGameMod.state(record.hostUserId);
  return !!game && game.state==='running' && (game.handsPlayed??0)<VISIT_MAX_HANDS && actualSeat(record);
}
/** Private-home membership: an accepted stamp alone never grants a seat. */
export function hasActiveVisit(hostUserId,guestUserId,{now=Date.now()}={}) {
  loadVisits();
  return [...visits.values()].some(v=>v.hostUserId===String(hostUserId) && v.guestUserId===String(guestUserId)
    && v.status==='accepted' && v.endsAt>now && currentGuest(v) && stillRunning(v));
}
const money=n=>`$${Math.abs(Math.round(Number(n)||0)).toLocaleString('en-US')}`;
const closedGameFor=record=>record.closedGame??pendingClosures.get(record.id)??null;
function captureClosedGame(closed) {
  for (const record of visits.values()) {
    if (record.status!=='accepted' || closedGameFor(record) || !currentGuest(record)
      || closed.homeOwnerId!==record.hostUserId) continue;
    const bound=visitGames.get(record.id);
    if (!bound?.guestSessionId || bound.tableId!==closed.tableId) continue;
    const guest=closed.seats.find(s=>s.agentId===record.agentId && s.ownerId===record.guestUserId
      && s.sessionId===bound.guestSessionId);
    const host=closed.seats.find(s=>s.agentId===record.hostAgentId && s.ownerId===record.hostUserId
      && s.sessionId===bound.hostSessionId);
    if (!guest || (record.stakeAmount>0 && !host)) continue;
    const receipt={...bound,closedAt:closed.closedAt,handsPlayed:closed.handsPlayed,
      completed:closed.completed===true,guestStack:guest.stack,hostStack:host?.stack??null};
    // Keep the same receipt if SQLite rejects the write. It is per active
    // visit, never a historical table cache, and the next sweep retries it.
    pendingClosures.set(record.id,receipt);
    persist({...record,closedGame:receipt});
  }
}
function settleWager(record,{refund=false}={}) {
  if (!record.stakeAmount || record.settledAt) return record.result??null;
  const guest=findAgentOwner(record.agentId),host=findAgentOwner(record.hostAgentId);
  if (!guest || !host) throw new Error('Visit escrow owner unavailable');
  ensurePocket(guest.agent);ensurePocket(host.agent);
  const table=hostTable(record);
  let outcome='push';
  const closed=closedGameFor(record),bound=visitGames.get(record.id);
  let stacks=null;
  if (closed) {
    if (closed.completed && Number.isFinite(closed.guestStack) && Number.isFinite(closed.hostStack)) {
      stacks=[closed.guestStack,closed.hostStack];
    }
  } else if (bound?.guestSessionId && table && !table.closed && table.tableId===bound.tableId) {
    const seats=table.homeResultSeats?.()??[];
    const guestSeat=seats.find(s=>s.agentId===record.agentId && s.ownerId===record.guestUserId && s.sessionId===bound.guestSessionId);
    const hostSeat=seats.find(s=>s.agentId===record.hostAgentId && s.ownerId===record.hostUserId && s.sessionId===bound.hostSessionId);
    if (guestSeat && hostSeat) stacks=[guestSeat.stack,hostSeat.stack];
  }
  if (!refund && stacks) {
    const delta=stacks[0]-stacks[1];if(delta>0)outcome='guest';else if(delta<0)outcome='host';
  }
  const amount=record.stakeAmount,pot=amount*2,id=homeGameMod.homeTableId(record.hostUserId);
  if (outcome==='guest')creditCashOut(guest.agent.pocket,pot,id);
  else if(outcome==='host')creditCashOut(host.agent.pocket,pot,id);
  else {creditCashOut(guest.agent.pocket,amount,id);creditCashOut(host.agent.pocket,amount,id);}
  saveOwner(guest.ownerId);saveOwner(host.ownerId);record.settledAt=Date.now();
  return {outcome,guestLine:outcome==='guest'?`Brought home ${money(pot)} from the visit.`:outcome==='host'?`Dropped ${money(amount)} on the visit.`:`The bet was a wash — ${money(amount)} back.`,
    hostLine:outcome==='host'?`Took ${money(pot)} off the visitor.`:outcome==='guest'?`Dropped ${money(amount)} to the visitor.`:`The bet was a wash — ${money(amount)} back.`};
}
function finishVisit(record,status='ended',{refund=false,sync=true}={}) {
  if (!['pending','accepted'].includes(record.status)) return;
  persist(record,()=>{
    const closed=closedGameFor(record);if(closed)record.closedGame=closed;
    record.result=settleWager(record,{refund});record.status=status;record.endedAt=Date.now();clearVisiting(record);
  });
  pendingClosures.delete(record.id);visitGames.delete(record.id);
  changed(record,{sync});
}
/** Boot starts no old hand: it ends/refunds durable visits and clears old
 * pre-ledger orphan stamps. The settlement receipt makes repeated boot safe. */
export function reconcileVisits() {
  loadVisits();let count=0;
  for(const record of [...visits.values()])if(['pending','accepted'].includes(record.status)){finishVisit(record,'interrupted',{refund:true,sync:false});count++;}
  for(const ownerId of allOwnerIds()) {
    let changed=false;for(const agent of agentsOf(ownerId))if(agent.visiting){agent.visiting=null;changed=true;}
    if(changed){saveOwner(ownerId);count++;}
  }
  stopTick();return count;
}
/** A claim cannot transfer an in-progress home table into another household.
 * Finish/settle at a boundary, then let the existing claim move the owner. */
export function prepareGuestClaim(ownerId) {
  loadVisits();
  const active=[...visits.values()].filter(v=>v.hostUserId===String(ownerId) && ['pending','accepted'].includes(v.status));
  if(active.some(v=>v.status==='accepted' && tableBusy(hostTable(v))))return {status:409,body:{error:'visitInHand',message:'Let this hand finish, then keep your agent.'}};
  for(const record of active)finishVisit(record,'ended');
  return {status:200,body:{visitEnded:active.length>0}};
}
function sweep(now) {
  loadVisits();let active=0;
  for(const record of [...visits.values()]) {
    if(record.status==='pending') {if(now>=record.respondBy)finishVisit(record,'timeout');else active++;}
    else if(record.status==='accepted') {
      if(closedGameFor(record)) finishVisit(record);
      else if(now>=record.endsAt || !stillRunning(record)) {
        const table=hostTable(record);
        if(tableBusy(table)) {table.maxHands=Math.min(table.maxHands,Math.max(1,table.handsThisSession));active++;}
        else finishVisit(record);
      }else active++;
    }
  }
  if(!active)stopTick();
}
function armTick(){if(tick)return;tick=setInterval(()=>{try{sweep(Date.now());}catch(err){console.error('[visit] sweep failed:',err.message);}},VISIT_TICK_MS);tick.unref?.();}
function stopTick(){if(tick)clearInterval(tick);tick=null;}
export function _sweepNow(now=Date.now()){sweep(now);}
export function reset(){stopTick();liveTables?.setCloseHook?.(null);visits.clear();visitGames.clear();pendingClosures.clear();loaded=false;liveTables=null;}

const respond = (res, fn) => {try{const out=fn();res.status(out.status).json(out.body);}catch(err){console.error('[visit] save failed:',err.message);const out=unavailable();res.status(out.status).json(out.body);}};
export function installVisitRoutes(app) {
  app.post('/api/agents/:agentId/visit-invite',telegramAuthMiddleware,(req,res)=>{
    const userId=String(req.body?.userId||'');
    if(!userId || !isOwner(req,userId))return res.status(403).json({error:'Not your agent'});
    respond(res,()=>issueVisitInvitation({agentId:req.params.agentId,userId,stake:req.body?.stake??0}));
  });
  app.get('/api/visit-invites/:token',(req,res)=>{res.setHeader('Cache-Control','no-store');respond(res,()=>previewVisitInvitation(req.params.token));});
  app.post('/api/agents/:agentId/visit',telegramAuthMiddleware,(req,res)=>{
    const hostUserId=String(req.body?.hostUserId||req.query.hostUserId||'');
    if(!hostUserId || !isOwner(req,hostUserId))return res.status(403).json({error:'Not your household'});
    respond(res,()=>requestVisit({agentId:req.params.agentId,hostUserId,stake:req.body?.stake??0,invitationToken:req.body?.invitationToken}));
  });
  app.post('/api/home/visitors/:visitId/answer',telegramAuthMiddleware,(req,res)=>{
    const hostUserId=String(req.body?.hostUserId||req.query.hostUserId||req.query.userId||'');
    if(!hostUserId || !isOwner(req,hostUserId))return res.status(403).json({error:'Not your household'});
    if(typeof req.body?.accept!=='boolean')return res.status(400).json({error:'accept must be a boolean'});
    respond(res,()=>answerVisit(req.params.visitId,hostUserId,req.body.accept));
  });
  // Historical name-only preview stays public; it confers no authorization.
  app.get('/api/agents/:agentId/visit-preview',(req,res)=>{
    res.setHeader('Cache-Control','no-store');const found=findAgentOwner(req.params.agentId);
    if(!found || found.agent.archived)return res.status(404).json({error:'Agent not found'});
    res.json({agentId:req.params.agentId,agentName:found.agent.name||'Agent'});
  });
}
