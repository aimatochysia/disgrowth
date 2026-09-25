import { html } from '../lib/html.js';

export function homePage({ config }) {
  const actions = html`
    <div class="cta-row">
      <a class="btn btn-accent" href="${config.DISCORD_COMMUNITY_INVITE}" rel="noopener noreferrer" target="_blank">Join the community</a>
      <a class="btn btn-ghost" href="/store">Shop Gold Bars</a>
    </div>
  `;

  return html`
    <section class="hero">
      <div class="hero-copy">
        <h1 class="display">
          The city opens<br />
          <em>under the canopy.</em>
        </h1>
        <p class="lede">
          Rent a stall, stock the shelves, and grow a company on a shared city market, all inside Discord.
        </p>
        ${actions}
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">Start here</h2>
      <div class="beat-grid">
        <article class="panel beat">
          <p class="kicker">01</p>
          <h3>Join the server</h3>
          <p>Run <code>/disgrowth</code> once to create your character.</p>
        </article>
        <article class="panel beat">
          <p class="kicker">02</p>
          <h3>Play the season</h3>
          <p>One real hour is one market day. The whole city runs on the same clock.</p>
        </article>
        <article class="panel beat">
          <p class="kicker">03</p>
          <h3>Buy when you need it</h3>
          <p>Gold Bars are optional and convert to Bonds in Discord. Credits are earned, never sold.</p>
        </article>
      </div>
    </section>

    <section class="band">
      <h2 class="section-title">How buying works</h2>
      <ol class="steps">
        <li><strong>Log in with Discord</strong> so the purchase lands on your character.</li>
        <li><strong>accept the terms</strong> and navigate to the <a href="/store">store</a></li>
        <li><strong>Pay with Paddle.</strong> We dont store your card details.</li>
        <li><strong>Check your account in Discord.</strong> Gold Bars usually arrive within seconds, plus extra Bonds on your first purchase.</li>
      </ol>
    </section>
  `;
}
