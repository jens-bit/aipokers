// The owner wallet, as a rail panel. Ported from D3WalletScreenM in
// design-refs/mood-wallet.jsx.
//
// The ref splits it across two columns: the wallet figure and the pockets on
// the stage, the Fund sheet in the rail. On the desk as it is built, the stage
// is the room — the floor is the thing desktop exists for, and taking it away
// to show a balance is the modal behaviour the desktop layout was built to
// avoid (mood-ww-ref.jsx S5). So the whole wallet lives in the rail, in the
// ref's own order: the money, then the pockets, then funding one of them.
//
// Every piece here is the mobile component. WalletBlock, PocketList and
// FundSheet are imported as they are, and nothing about the wallet is
// reimplemented for the desk — the desk contributes a panel around them and
// the widths in desktop.css.

import { useState } from 'react';

import { WalletBlock } from '../wallet/WalletBlock.jsx';
import { PocketList } from '../wallet/PocketRow.jsx';
import { FundSheet } from '../wallet/FundSheet.jsx';
import { PanelHead, RailBody } from './panelParts.jsx';
import { SafeReadStatus } from '../wallet/SafeSheet.jsx';

export function DeskWalletPanel({
  wallet, agents = [], onFund, onCollect, onCallIn, onClose,
  walletStatus = wallet ? 'ready' : 'error', onRetry,
}) {
  // Which agent the rail is currently funding. The sheet takes the panel the
  // way it takes the screen on mobile: choosing how an agent gets money is a
  // decision, not a popover over a list.
  const [fundTarget, setFundTarget] = useState(null);
  const [direction, setDirection] = useState('both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const readStatus = refreshFailed ? 'error' : walletStatus;
  async function retryRead() {
    try {
      const result = await onRetry?.();
      if (result !== null) setRefreshFailed(false);
    } catch { /* the completed transfer remains distinct from this read */ }
  }

  function openFunds(agent, nextDirection = 'both') {
    setError(''); setDirection(nextDirection); setFundTarget(agent);
  }

  async function takeAll(agent) {
    if (busy || readStatus !== 'ready') return;
    setBusy(true); setError('');
    try { const receipt = await onFund?.(agent, { verb: 'take', amount: null }); setRefreshFailed(!!receipt?.refreshFailed); }
    catch { setError('Could not move the chips. Try again.'); }
    finally { setBusy(false); }
  }

  const pocketAgents = agents.filter((a) => a?.pocket);

  if (fundTarget) {
    return (
      <div className="dsk-panel dsk-wallet wal">
        <PanelHead
          title={direction === 'take' ? 'Take' : 'Fund'}
          sub={(fundTarget.name || 'AGENT').toUpperCase()}
          onClose={() => setFundTarget(null)}
        />
        <SafeReadStatus status={readStatus} wallet={wallet} onRetry={onRetry ? retryRead : undefined} />
        <div className="dsk-wallet__sheet">
          <FundSheet
            agent={fundTarget}
            wallet={wallet}
            disabled={readStatus !== 'ready'}
            index={pocketAgents.findIndex((a) => a.id === fundTarget.id)}
            onCancel={() => setFundTarget(null)}
            direction={direction}
            onConfirm={async (decision) => {
              const receipt = await onFund?.(fundTarget, decision);
              setRefreshFailed(!!receipt?.refreshFailed);
              setFundTarget(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dsk-panel dsk-wallet wal">
      <PanelHead
        title="Your wallet"
        sub={wallet ? 'BACKER AND HORSE' : 'YOUR SAFE'}
        onClose={onClose}
      />
      <RailBody>
        {refreshFailed && <p className="safe__absent" role="status">Chips moved. Refresh the safe before making another transfer.</p>}
        <SafeReadStatus status={readStatus} wallet={wallet} onRetry={onRetry ? retryRead : undefined} />
        {wallet ? (
          <fieldset className="safe__pages" disabled={readStatus !== 'ready'}>
            <WalletBlock wallet={wallet} />
            {/* PocketList already carries "pocket size sets his stakes" as its
                own header. The desktop ref's line is four words longer — "…
                there is no betting menu" — and printing a second copy of the
                sentence to gain them would be exactly the duplication this
                port is meant to avoid. The component's line stands. */}
            <PocketList
              agents={pocketAgents}
              only={['fund', 'take', 'callIn']}
              sub="uncommitted chips only"
              onFund={openFunds}
              onTake={takeAll}
              onTakeAmount={agent => openFunds(agent, 'take')}
              busy={busy}
              onCallIn={onCallIn}
            />
            {busy && <p className="safe__absent" role="status">Moving chips…</p>}
            {error && <p className="safe__absent" role="alert">{error}</p>}
          </fieldset>
        ) : null}
      </RailBody>
    </div>
  );
}
