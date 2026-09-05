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

export function DeskWalletPanel({
  wallet, agents = [], onFund, onCollect, onClose,
}) {
  // Which agent the rail is currently funding. The sheet takes the panel the
  // way it takes the screen on mobile: choosing how an agent gets money is a
  // decision, not a popover over a list.
  const [fundTarget, setFundTarget] = useState(null);

  const pocketAgents = agents.filter((a) => a?.pocket);

  if (fundTarget) {
    return (
      <div className="dsk-panel dsk-wallet">
        <PanelHead
          title="Fund"
          sub={(fundTarget.name || 'AGENT').toUpperCase()}
          onClose={() => setFundTarget(null)}
        />
        <div className="dsk-wallet__sheet">
          <FundSheet
            agent={fundTarget}
            wallet={wallet}
            index={pocketAgents.findIndex((a) => a.id === fundTarget.id)}
            onCancel={() => setFundTarget(null)}
            onConfirm={async (decision) => {
              await onFund?.(fundTarget, decision);
              setFundTarget(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dsk-panel dsk-wallet">
      <PanelHead
        title="Your wallet"
        sub={wallet ? 'BACKER AND HORSE' : 'NOT ON THIS DEPLOYMENT'}
        onClose={onClose}
      />
      <RailBody>
        {/* Graceful absence, the same as the You screen: no wallet, no money
            UI. The panel says so rather than drawing an empty one. */}
        {!wallet ? (
          <div className="dsk-apanel__empty">
            This deployment has no wallet yet.
          </div>
        ) : (
          <>
            <WalletBlock wallet={wallet} />
            {/* PocketList already carries "pocket size sets his stakes" as its
                own header. The desktop ref's line is four words longer — "…
                there is no betting menu" — and printing a second copy of the
                sentence to gain them would be exactly the duplication this
                port is meant to avoid. The component's line stands. */}
            <PocketList
              agents={pocketAgents}
              onFund={setFundTarget}
              onCollect={onCollect}
            />
          </>
        )}
      </RailBody>
    </div>
  );
}
