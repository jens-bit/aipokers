// client/src/components/wallet/SafeSheet.jsx — SAFE-2
//
// THE SAFE. Board 29 F12 "one number, three verbs" and F12b "the ledger,
// newest first", ported from design-refs/mood-floor58.jsx `SafeSheet`.
//
// WHAT THIS REPLACES, and why. YOU-2's MoneySheet was a per-agent GRID: four
// pockets, four refill rules, four figures, and the balance somewhere among
// them. Opening a safe asks one question — how much is in it — and offers the
// three things you can do about it. So the front of this surface is:
//
//   ONE NUMBER      what is in the safe, and no second money figure beside it
//   THREE VERBS     GIVE to a pocket · TAKE the winnings out · RULES per agent
//   TONIGHT         three lines, every figure carrying the sentence that
//                   caused it (lib/safeLines.js). No number floats anywhere.
//
// The grid is not deleted — it is what is BEHIND a verb. GIVE is the pockets
// you can give to, TAKE is the ones with something to bring home, RULES is how
// each of them is backed. Same components (PocketList, FundSheet), same routes
// (WALLET-7's /fund and /collect); what changed is that you arrive at them
// having asked for one of three things rather than being handed all three.
//
// FOUR RULES THIS SURFACE OBEYS:
//
//   1. A VERB IS A PAGE OF THIS SHEET, not a new one. It slides in from the
//      right and back returns to the number — so the owner is never more than
//      one back-tap from the thing he opened the safe to see, and a decision
//      never buries the balance it is being made against.
//   2. THE LEDGER IS THE SHEET'S SECOND SIZE. Pulled up, the same glass keeps
//      the number and grows the record under it. It is not a screen: leaving
//      the ledger is putting the sheet back down, not navigating.
//   3. DATA BELONGS TO THE HOST. YOU and the room both already read the wallet
//      and the roster; a sheet that fetched them again would disagree with the
//      screen behind it for as long as the request took. It is handed them and
//      says when something moved.
//   4. NO WALLET, NO VERBS. On a deployment without one the safe says it does
//      not know rather than drawing three buttons onto a 404.

import { useCallback, useMemo, useState } from 'react';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';

import { FundSheet } from './FundSheet.jsx';
import { LedgerList } from './LedgerList.jsx';
import { PocketList } from './PocketRow.jsx';
import { Lbl, ModeTag, Num } from './atoms.jsx';
import {
  callInAgent, collectFrom, collectsEverything, fundAgent, hasPocket, money,
  pocketOf, refillLabel, signedMoney,
} from '../../lib/wallet.js';
import { tonightOf } from '../../lib/safeLines.js';
import { presenceOf } from '../floor/agentView.js';
import '../../styles/safe.css';

const M_TEAL  = '#00D4AA';
const M_GOLD  = '#CDB380';
const M_DIM   = '#A1A1A1';
const M_MUTED = '#6B6B6B';

// The ref's three, in the ref's order and the ref's words. Every one of them is
// something you can do TO the number above them, and there is nothing you can
// do to it that is not one of these.
export const VERBS = [
  { key: 'give',  label: 'GIVE',  note: 'to a pocket',   color: M_TEAL },
  { key: 'take',  label: 'TAKE',  note: 'winnings out',  color: M_GOLD },
  { key: 'rules', label: 'RULES', note: 'per agent',     color: M_DIM },
];

const TITLES = {
  give:  { title: 'Give', sub: 'to a pocket' },
  take:  { title: 'Take', sub: 'winnings out' },
  rules: { title: 'Rules', sub: 'how each one is backed' },
};

/** How many ledger rows a pull shows, and how many each scroll to the end adds. */
export const LEDGER_PAGE = 12;

// ── the rules page ──────────────────────────────────────────────────────────
// WALLET-7's vocabulary, unchanged: the four stored modes are not the owner's
// words and never appear here. What a rule IS, on this page, is the one toggle
// that survived — whether the safe backs his next bust — plus the tag that says
// where that has left him.
function RuleRow({ agent, busy, onSetRefill }) {
  const pocket = pocketOf(agent);
  if (!pocket) return null;
  const refills = pocket.mode === 'auto';
  const cap = pocket.cap ?? pocket.float ?? pocket.balance ?? 0;
  return (
    <div className="safe-rule" data-agent={agent.id}>
      <div className="safe-rule__head">
        <span className="safe-rule__name">{agent.name}</span>
        <ModeTag mode={pocket.mode} />
        <div style={{ flex: 1 }} />
        <Num size={12} weight={700}>{money(pocket.balance)}</Num>
      </div>
      <label className="wal-toggle safe-rule__toggle">
        <input
          type="checkbox"
          checked={refills}
          disabled={busy}
          onChange={(e) => onSetRefill(agent, e.target.checked, cap)}
        />
        <span className="wal-toggle__text">{refillLabel(cap)}</span>
      </label>
    </div>
  );
}

/**
 * @param wallet        the walletProjection, or null on a deployment without one
 * @param agents        the roster; pockets are filtered out of it here
 * @param onRefresh     called after any verb lands, so the host re-reads
 * @param onClose       put the sheet away
 * @param onOpenProfile tap-through from a pocket row to his card
 * @param variant       'sheet' over a room or a screen · 'rail' inline on the desk
 */
export function SafeSheet({
  wallet, agents = [], onRefresh, onClose, onOpenProfile,
  title = 'The safe', variant = 'sheet', now,
}) {
  const inRail = variant === 'rail';
  const [page, setPage] = useState('safe');
  const [fundTarget, setFundTarget] = useState(null);
  const [busyAgentId, setBusyAgentId] = useState(null);
  // Rule 2: the ledger is this sheet's second size. On the desk there is a
  // column for both, so F12's own note — "desktop puts tonight and the ledger
  // in one scroll" — is the whole of the difference.
  const [pulled, setPulled] = useState(false);
  const [limit, setLimit] = useState(LEDGER_PAGE);

  const showLedger = inRail || pulled;
  // In the rail the scroll belongs to the panel around us, so there is no
  // "scrolled to the end" of our own to listen for — and there is a column for
  // the whole thing anyway. The projection caps the ledger at 20 either way.
  const ledgerLimit = inRail ? (wallet?.ledger?.length ?? LEDGER_PAGE) : limit;

  // BUGS-A job 5: the safe answers the same gesture as the fridge and the
  // thread. Pulled up it has somewhere to go first — a drag down puts the
  // ledger away rather than the whole sheet, which is what a second size means.
  const drag = useSheetDrag(
    () => (pulled ? setPulled(false) : onClose?.()),
    { enabled: !inRail },
  );

  const pocketAgents = useMemo(() => agents.filter(hasPocket), [agents]);
  const nameOf = useCallback(
    (id) => agents.find((a) => String(a.id) === String(id))?.name ?? null,
    [agents],
  );

  // Rule 3: one derivation, from the ledger the host already has. TONIGHT and
  // the list below it read the same entries through the same vocabulary.
  const tonight = useMemo(
    () => tonightOf(wallet?.ledger, { nameOf, now }),
    [wallet?.ledger, nameOf, now],
  );

  // Who has something to bring home. `collectable` is the server's own answer —
  // the winnings, or the whole pocket once he has been called in — so TAKE
  // offers exactly what a collect would actually move.
  const takeable = pocketAgents.filter((a) => {
    const p = pocketOf(a);
    const seated = presenceOf(a) === 'playing';
    return (p.collectable ?? 0) > 0 || (seated && p.balance > 0);
  });

  async function handleFund(decision) {
    if (!fundTarget) return;
    try {
      await fundAgent(fundTarget.id, decision);
      await onRefresh?.();
      setFundTarget(null);
      setPage('safe');
    } catch { /* the page stays open, the choice is not lost */ }
  }

  async function handleCollect(agent) {
    if (busyAgentId) return;
    setBusyAgentId(agent.id);
    // WALLET-7: Collect takes the winnings. A called-in pocket is the one that
    // hands back all of it — he is not sitting down again.
    const all = collectsEverything(pocketOf(agent));
    try { await collectFrom(agent.id, { all }); await onRefresh?.(); }
    catch { /* the row simply stays as it was */ }
    finally { setBusyAgentId(null); }
  }

  async function handleCallIn(agent) {
    if (busyAgentId) return;
    setBusyAgentId(agent.id);
    try { await callInAgent(agent.id); await onRefresh?.(); }
    catch { /* the row simply stays as it was */ }
    finally { setBusyAgentId(null); }
  }

  // The rules page's one control. Zero chips move: this is the same call that
  // gives him chips, with nothing in the envelope — which is exactly what
  // "change how he is backed" has always been on the server (walletFund sets
  // the mode whether or not there is an amount).
  async function handleSetRefill(agent, refill, cap) {
    if (busyAgentId) return;
    setBusyAgentId(agent.id);
    try { await fundAgent(agent.id, { verb: 'give', amount: 0, cap, refill }); await onRefresh?.(); }
    catch { /* the toggle springs back with the next read */ }
    finally { setBusyAgentId(null); }
  }

  // Rule 2's other half: the list grows as it is scrolled rather than stopping
  // at a round number somebody picked. The wallet sends what it sends; when the
  // last of it is on screen there is simply nothing more to add.
  function onScroll(e) {
    if (!showLedger) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 140) return;
    setLimit((n) => (n >= (wallet?.ledger?.length ?? 0) ? n : n + LEDGER_PAGE));
  }

  function back() {
    if (fundTarget) { setFundTarget(null); return; }
    if (page !== 'safe') { setPage('safe'); return; }
    onClose?.();
  }

  // ── the pages ─────────────────────────────────────────────────────────────

  const numberPage = (
    <div className="safe__page" key="safe">
      <div className="safe__number">
        <Lbl size={8.5}>In the safe</Lbl>
        <div className="safe__amount">{wallet ? money(wallet.balance) : '—'}</div>
      </div>

      {wallet ? (
        <div className="safe__verbs">
          {VERBS.map((v) => (
            <button
              key={v.key}
              type="button"
              className="safe__verb"
              data-verb={v.key}
              style={{ '--verb': v.color, borderColor: `${v.color}4D`, background: `${v.color}0F` }}
              onClick={() => setPage(v.key)}
            >
              <span className="safe__verb-label">{v.label}</span>
              <span className="safe__verb-note">{v.note}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="safe__absent">
          There is no safe on this deployment yet. Nothing has been lost — there is
          simply nothing here to count.
        </p>
      )}

      {wallet ? (
        <div className="safe__tonight">
          <Lbl size={8.5}>Tonight</Lbl>
          {tonight.map((line) => (
            <div className="safe__line" key={line.key}>
              <div className="safe__line-text">
                <span className="safe__line-label">{line.label}</span>
                <span className="safe__line-note">{line.note}</span>
              </div>
              <Num size={13} weight={700} color={line.tone === 'in' && line.amount > 0 ? M_TEAL : M_MUTED}>
                {signedMoney(line.amount)}
              </Num>
            </div>
          ))}
        </div>
      ) : null}

      {wallet && !showLedger ? (
        <div className="safe__pull-row">
          <button type="button" className="safe__pull" onClick={() => setPulled(true)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 15l6-6 6 6" />
            </svg>
            Pull up for the ledger
          </button>
        </div>
      ) : null}

      {wallet && showLedger ? (
        <div className="safe__ledger" data-testid="safe-ledger">
          <LedgerList
            entries={wallet.ledger}
            nameOf={nameOf}
            limit={ledgerLimit}
            now={now}
            label="The ledger"
            sub="newest first"
            flush
          />
        </div>
      ) : null}
    </div>
  );

  const givePage = (
    <div className="safe__page" key="give">
      <PocketList
        agents={pocketAgents}
        only={['fund']}
        label="Who gets it"
        sub="pocket size sets his stakes"
        onFund={setFundTarget}
        onOpenProfile={onOpenProfile}
        empty={<p className="safe__absent">Nobody here has a pocket yet.</p>}
      />
    </div>
  );

  const takePage = (
    <div className="safe__page" key="take">
      <PocketList
        agents={takeable}
        only={['collect', 'callIn']}
        label="What is yours to take"
        sub="winnings only"
        onCollect={handleCollect}
        onCallIn={handleCallIn}
        onOpenProfile={onOpenProfile}
        empty={(
          <p className="safe__absent">
            Nothing to bring home. What is in a pocket is what he sits down with.
          </p>
        )}
      />
    </div>
  );

  const rulesPage = (
    <div className="safe__page" key="rules">
      {pocketAgents.length === 0 ? (
        <p className="safe__absent">Nobody here has a pocket yet.</p>
      ) : (
        <div className="safe__rules">
          {pocketAgents.map((a) => (
            <RuleRow
              key={a.id}
              agent={a}
              busy={busyAgentId === a.id}
              onSetRefill={handleSetRefill}
            />
          ))}
        </div>
      )}
    </div>
  );

  const fundPage = fundTarget ? (
    <div className="safe__page" key={`fund-${fundTarget.id}`}>
      <FundSheet
        agent={fundTarget}
        wallet={wallet}
        index={pocketAgents.findIndex((a) => a.id === fundTarget.id)}
        onCancel={() => setFundTarget(null)}
        onConfirm={handleFund}
        onOpenProfile={onOpenProfile}
      />
    </div>
  ) : null;

  const body = fundPage
    ?? { safe: numberPage, give: givePage, take: takePage, rules: rulesPage }[page]
    ?? numberPage;

  const heading = page === 'safe' ? { title, sub: null } : TITLES[page];

  // The funding page is a dialog of its own — it brings its own head and its own
  // name — so ours steps aside there the same way the head does below. Two
  // nested dialogs is two things claiming to be the thing in front.
  const role = inRail || fundTarget ? 'group' : 'dialog';

  return (
    <div
      className={`safe money-sheet wal dr-app${inRail ? ' safe--rail' : ' safe--sheet'}${pulled ? ' is-pulled' : ''}`}
      data-page={fundTarget ? 'fund' : page}
      data-testid="safe-sheet"
      role={role}
      aria-label={title}
    >
      {/* The room, or the screen, stays visible behind it: a sheet is a layer
          over the place you opened it from, never a replacement for it. */}
      {inRail ? null : (
        <button type="button" className="safe__scrim" onClick={onClose} aria-label="Close" />
      )}
      <div
        className={`safe__panel${drag.dragging ? ' is-dragging' : ''}`}
        ref={inRail ? undefined : drag.ref}
        style={inRail ? undefined : drag.style}
        onScroll={onScroll}
        {...(inRail ? {} : drag.handlers)}
      >
        {inRail ? null : (
          <div className="safe__grab" aria-hidden><span /></div>
        )}

        {/* Two heads on one page is the same door drawn twice, so ours steps
            aside twice. The funding page brings its own — a title, and a back
            that cancels the decision rather than the sheet. And in the rail the
            PANEL's head already names the safe and already has the way out, so
            on the number there is nothing left for ours to say; inside a verb
            it is the only way back to the balance, and it returns. */}
        {fundTarget || (inRail && page === 'safe') ? null : (
        <div className="safe__head">
          <button type="button" className="safe__back" onClick={back} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="safe__title">{heading.title}</span>
          {heading.sub ? <span className="safe__sub">{heading.sub}</span> : null}
        </div>
        )}

        <div className="safe__pages">{body}</div>
      </div>
    </div>
  );
}
