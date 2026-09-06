// client/src/components/wallet/MoneySheet.jsx — YOU-2
//
// ONE money surface. The wallet block, the pocket rows and the funding sheet
// were assembled inline on the YOU screen, which made YOU the only place the
// money could be worked on — so anything else that wanted to open the money
// (the safe) had to build a second copy of it. Two copies of a money UI is
// two places for the same bug to be fixed once.
//
// This is that surface, extracted whole. Every piece inside it is the shipped
// component, unchanged: WalletBlock is still WUI-1's, PocketList is still
// PocketRow's, FundSheet is still WUI-2/WALLET-7's. What moved here is the
// assembly and the three verbs that hang off it.
//
// Data belongs to the HOST, not to the sheet: YOU already reads the wallet and
// the roster for its own summary and its own ledger, and a sheet that fetched
// them again would have the screen and the sheet disagreeing about the balance
// for as long as the second request took. The host passes them in and is told
// when something moved.

import { useState } from 'react';

import { WalletBlock } from './WalletBlock.jsx';
import { PocketList } from './PocketRow.jsx';
import { FundSheet } from './FundSheet.jsx';
import {
  callInAgent, collectFrom, collectsEverything, fundAgent, hasPocket, pocketOf,
} from '../../lib/wallet.js';
import { presenceOf } from '../floor/agentView.js';

const M_BG     = '#1A1A1E';
const M_PANEL  = '#232329';
const M_BORDER = 'rgba(255,255,255,0.12)';
const M_TEXT   = '#EDEDED';
const PLAYFAIR = '"Playfair Display",Georgia,serif';

/**
 * @param wallet        the walletProjection, or null on a deployment without one
 * @param agents        the roster; pockets are filtered out of it here
 * @param onRefresh     called after any verb lands, so the host re-reads
 * @param onClose       back out of the sheet
 * @param onOpenProfile tap-through from a pocket row to his card
 */
export function MoneySheet({ wallet, agents = [], onRefresh, onClose, onOpenProfile, title = 'Money' }) {
  const [fundTarget, setFundTarget] = useState(null);
  const [busyAgentId, setBusyAgentId] = useState(null);

  // WUI-1 — pockets only exist for agents the backend has given one. On a
  // deployment without the wallet this list is empty and nothing renders.
  const pocketAgents = agents.filter(hasPocket);
  const playingCount = agents.filter((a) => presenceOf(a) === 'playing').length;

  async function handleFund(decision) {
    if (!fundTarget) return;
    try { await fundAgent(fundTarget.id, decision); await onRefresh?.(); setFundTarget(null); }
    catch { /* the sheet stays open, the choice is not lost */ }
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

  // WALLET-7 — the second verb. He finishes the hand he is in, takes a seat at
  // the bar, and everything in the pocket comes back to the wallet.
  async function handleCallIn(agent) {
    if (busyAgentId) return;
    setBusyAgentId(agent.id);
    try { await callInAgent(agent.id); await onRefresh?.(); }
    catch { /* the row simply stays as it was */ }
    finally { setBusyAgentId(null); }
  }

  // WUI-2: the funding sheet takes the whole screen, the way the floor zoom
  // does. It is a decision, not a popover on top of a scrolling list.
  if (fundTarget) {
    return (
      <div className="wal dr-app money-sheet" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}>
        <FundSheet
          agent={fundTarget}
          wallet={wallet}
          index={pocketAgents.findIndex((a) => a.id === fundTarget.id)}
          onCancel={() => setFundTarget(null)}
          onConfirm={handleFund}
          onOpenProfile={onOpenProfile}
        />
      </div>
    );
  }

  return (
    <div className="wal dr-app money-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden auto', background: M_BG }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        padding: '8px 14px 10px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL,
      }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: M_TEXT, cursor: 'pointer', padding: 0, marginLeft: -8, flexShrink: 0 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {/* DESK-2: the safe is this surface reached from the furniture, so it
            is allowed to be called what the room calls it. One money surface,
            two doors into it. */}
        <span style={{ flex: 1, fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>{title}</span>
      </div>

      <WalletBlock wallet={wallet} playingCount={playingCount} agentCount={agents.length} />
      <PocketList
        agents={pocketAgents}
        onFund={setFundTarget}
        onCollect={handleCollect}
        onCallIn={handleCallIn}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}
