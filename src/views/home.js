import { html } from '../lib/html.js';

const PILLARS = [
  ['Live it', 'Wake up with an energy bar and a stress meter. Fill a schedule with work, study and rest, then rent a place and make it yours.'],
  ['Climb', 'Four districts, from the slow Green Marches up to Grand Boulevard. The higher you go, the more everything costs and the calmer the market gets.'],
  ['Trade', 'A shared market of commodities and listed companies moves while you sleep. Watch it here, play it in Discord, and start a company when you feel ready.'],
];

const DISTRICTS = [
  ['green', 'Green Marches', 'Slow mornings, low rent, and prices that jump at every rumor.'],
  ['quay', 'Quay Commons', 'Quiet streets, front porches, and people who run their own show.'],
  ['metro', 'Metro Flats', 'Packed, quick and lit all night. Nobody waits.'],
  ['grand', 'Grand Boulevard', 'Marble, brass and the steepest rents in town. The market barely flinches.'],
];

export function homePage({ config }) {
  return html`
    <section class="hero">
      <div class="hero-copy">
        <p class="chip">Alpha · now open</p>
        <h1 class="display">
          Make a life in the city.<br />
          <em>Build a business when you're ready.</em>
        </h1>
        <p class="lede">
          A life sim and shared market that lives inside Discord. Your days keep running while you're away.
        </p>
        <div class="cta-row">
          <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the community</a>
          <a class="btn btn-ghost" href="/market">See the market</a>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="beat-grid">
        ${PILLARS.map(
          ([title, text], i) => html`
            <article class="panel beat">
              <p class="kicker">0${i + 1}</p>
              <h3>${title}</h3>
              <p>${text}</p>
            </article>
          `,
        )}
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">One real hour is one city day</h2>
      <div class="panel clock">
        <p class="clock-pair"><strong>1 hour RT</strong><span aria-hidden="true">=</span><strong>1 day VT</strong></p>
        <p>
          RT is the clock on your wall. VT is the city's. Everyone shares the same one, so the market, the shops and your
          neighbours all move together. Step away and your character keeps going: passive earnings fill for about 30 hours,
          then slow down until they stop at 72.
        </p>
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">Four districts, one climb</h2>
      <div class="district-grid">
        ${DISTRICTS.map(
          ([tone, name, text]) => html`
            <article class="panel district district-${tone}">
              <h3>${name}</h3>
              <p>${text}</p>
            </article>
          `,
        )}
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">Start here</h2>
      <ol class="steps">
        <li><strong>Join the server.</strong> Run <code>/disgrowth</code> once to create your character.</li>
        <li><strong>Follow the guide.</strong> It walks you to your first job, then your first day's schedule.</li>
        <li><strong>Settle in.</strong> Earn, study, rent, and look at the market whenever you're curious.</li>
      </ol>
    </section>

    <section class="band">
      <h2 class="section-title">Gold Bars</h2>
      <p class="lede">
        Gold Bars are the optional extras: convenience and speed-ups, never required. Credits are earned in the city and never
        sold. Log in with Discord so the bars land on your character, pick a pack in the <a href="/store">shop</a>, and
        pay through Paddle. Paddle handles the payment, so we never see your card. Gold Bars usually arrive within seconds,
        with a bonus on your first purchase.
      </p>
      <div class="cta-row">
        <a class="btn btn-gold" href="/store">Shop Gold Bars</a>
      </div>
    </section>
  `;
}
