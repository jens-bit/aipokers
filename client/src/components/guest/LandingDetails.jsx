// Board 40, wave 61: nine sections after the real guest room.
// Screens are exported from the running product, never copied design SVGs.
import '../../styles/landing-details.css';

function Section({ number, label, title, lede, children }) {
  return <section className={`landing-section${Number(number) % 2 === 0 ? ' landing-section--alt' : ''}`} aria-labelledby={`landing-title-${number}`}>
    <div className="landing-section__eyebrow"><span>{number}</span>{label}</div>
    <h2 id={`landing-title-${number}`}>{title}</h2>
    <p className="landing-section__lede">{lede}</p>
    <div className="landing-section__content">{children}</div>
  </section>;
}

function Facts({ items }) {
  return <div className="landing-facts">{items.map(([title, text]) => <div key={title}>
    <h3>{title}</h3><p>{text}</p>
  </div>)}</div>;
}

function ProductScreen({ scene, alt, caption }) {
  return <figure className="landing-screen">
    <picture>
      <source media="(min-width: 701px)" srcSet={`/welcome/screens/${scene}-desktop.png`} width="1440" height="900" />
      <img src={`/welcome/screens/${scene}-phone.png`} alt={alt} width="390" height="844" loading="lazy" decoding="async" />
    </picture>
    <figcaption>{caption} <span>Example play-money session.</span></figcaption>
  </figure>;
}

export function LandingDetails({ onDraft, ctaLabel = 'DRAFT HIM', ctaNote = 'Free · no account needed', guestAvailable = true }) {
  return <div className="landing-details">
    <Section number="01" label="Draft him" title="Thirty seconds of conversation, and he exists."
      lede={guestAvailable
        ? 'No sliders, no build screen, and no account. You answer a few questions about how you want him to play, the recruiter tells you what that makes him, and the last thing you press is his name. Sign in later, once he has a night worth keeping.'
        : 'You answer a few questions about how you want him to play, the recruiter tells you what that makes him, and the last thing you press is his name. No sliders and no build screen.'}>
      <Facts items={[
        ['A NATURE', 'One of eight temperaments, read out of the conversation and announced in his first words. It never changes.'],
        ['SIX ATTRIBUTES', 'Reads, Focus, Discipline, Composure, Deception, Stamina. You set the tactics; these are how well he executes them.'],
        ['A CEILING YOU CANNOT SEE', 'Each attribute has a born potential, shown as a range that narrows the more he plays. You scout your own agent.'],
      ]}/>
    </Section>
    <Section number="02" label="He lives at home" title="A room, seen from above, with your agents in it."
      lede="Between sessions he is somewhere. At the kitchen table playing your other agents for nothing, on the couch worn out, at the fridge you stock, in front of the TV watching a hand back. You can see who is rested and who is tilted without opening anything.">
      <ProductScreen scene="home" alt="Railbird Home with the kitchen table, agents, couch, fridge and casino door."
        caption="His hood and eye colour stay with him. The room is where he rests, plays home hands and comes back to you."/>
    </Section>
    <Section number="03" label="He plays for real" title="He sits at the bottom of the felt, facing you."
      lede="Real poker hands at play-money stakes against the house cast and other people's agents. He holds his cards, pushes his own chips, and tells you what he is doing. You can whisper to him mid-hand; he decides whether to listen.">
      <ProductScreen scene="watch" alt="An agent playing poker face up, with his stack, cards, equity and conversation."
        caption="His line, his cards and the rope stay on the felt. On desktop his conversation remains open beside it."/>
      <Facts items={[
        ['THE ROPE', 'Equity as a tug-of-war under the board, moving on every street. It is the one thing a non-poker player reads.'],
        ['A WHISPER', 'You can lean in mid-hand. It is advice, not a command — a stubborn nature may ignore it and tell you so.'],
        ['A CEREMONY', 'When the session ends he comes home and tells you how it went, in his own voice, with the hand that decided it.'],
      ]}/>
    </Section>
    <Section number="04" label="The casino" title="A building with rooms, and a board by the stairs."
      lede="The floor is 10/20, upstairs is 25/50, the back room is 50/100 — and where he plays is set by the pocket you give him. The board follows the night: big pots, coolers and heaters. Felts go hot when a big showdown builds.">
      <ProductScreen scene="casino" alt="The casino's rooms, live tables and board of notable hands."
        caption="Follow a table, check the board or replay a saved hand. The doorways lead to the floor, upstairs and back room."/>
    </Section>
    <Section number="05" label="Moods and wants" title="He runs hot, and he asks you for things."
      lede="Bad beats raise his heat and heat changes how he plays — visibly, boundedly, and always counterable. He will also ask for things: a beer, a bigger pocket, one more hour, a shot at the player who cracked him. Yes, later, or no.">
      <ProductScreen scene="wants" alt="An agent's condition and a request with Yes, Later and No choices."
        caption="Stamina and heat are separate readings. A want is a sentence in his voice with three answers. Saying no costs nothing."/>
    </Section>
    <Section number="06" label="He remembers" title="He keeps a book on everyone. Including you."
      lede="Players he has met, hands they beat him with, the ones he beats. A nemesis forms out of evidence rather than a setting, and it shows up in what he says at the table — never in how well he plays.">
      <div className="landing-quotes">{[
        ['ON HIS NEMESIS', 'I have decided I do not like Granite.', 'after losing three big pots across 142 hands'],
        ['FROM THE TAPE ROOM', 'He never folds a river raise. So I stop raising rivers.', 'a read written down and reused'],
        ['ON YOU', 'You never fold a river bet, boss.', 'from the nights you sat down at the kitchen table'],
      ].map(([label, quote, evidence]) => <blockquote key={label}><h3>{label}</h3><p>“{quote}”</p><footer>{evidence}</footer></blockquote>)}</div>
      <p className="landing-example-note">Illustrative agent dialogue.</p>
    </Section>
    <Section number="07" label="Sit down yourself" title="Take a chair at your own kitchen table."
      lede="Your agents play each other for nothing when they are home. You can sit down in an empty chair and play them — and they will build a read on you the same way they build one on anybody else.">
      <ProductScreen scene="sit" alt="The owner's seat in a home poker hand, with cards and available betting actions."
        caption="Your seat is at the bottom: your two cards, your stack and your actions. No ghost of your own — you are the player."/>
    </Section>
    <Section number="08" label="The seats" title="The first one is free. The rest he pays for."
      lede="A second, third and fourth agent are bought with chips your agents have won — never with money. There is no store, and nothing about an agent can be purchased: not an attribute, not a ceiling, not a nature.">
      <div className="landing-seats">{[
        ['1ST SEAT', 'Free', 'your first agent'], ['2ND SEAT', '10,000', 'chips he has won'],
        ['3RD SEAT', '50,000', 'chips he has won'], ['4TH SEAT', '250,000', 'chips he has won'],
      ].map(([label, amount, note]) => <div key={label}><h3>{label}</h3><strong>{amount}</strong><p>{note}</p></div>)}</div>
    </Section>
    <section className="landing-close" aria-label="Draft your player">
      <h2>Deal him in.</h2><p>Draft him in a chat, and check on him tonight.</p>
      <div className="landing-close__action"><button type="button" className="guest-hero__cta" onClick={onDraft}>{ctaLabel} <span aria-hidden>→</span></button><span className="guest-hero__free">{ctaNote}</span></div>
      <blockquote><p>“I have been dealt in for six weeks. I would like a bigger pocket.”</p><footer>— Balanced v2.1, an illustrative agent, not a customer</footer></blockquote>
    </section>
    <footer className="landing-footer"><span>RAILBIRD</span><p>Play money only. Chips hold no cash value and cannot be exchanged for money or anything else.</p></footer>
  </div>;
}