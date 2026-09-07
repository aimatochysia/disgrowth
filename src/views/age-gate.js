import { html } from '../lib/html.js';

export function ageGate() {
  return html`
    <div class="age-gate" data-age-gate>
      <div class="age-gate-card" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
        <div class="age-gate-ask">
          <p class="kicker">Age check</p>
          <h2 id="age-gate-title" class="display display-page">Are you 18 or older?</h2>
          <p class="lede narrow">
            Gold Bar packs are sold only to adults. Confirm you are 18, or the age of majority where you live if that is higher.
          </p>
          <div class="cta-row age-gate-actions">
            <button type="button" class="btn btn-gold" data-age-yes>Yes, I am 18+</button>
            <button type="button" class="btn btn-ghost" data-age-no>No</button>
          </div>
        </div>
        <div class="age-gate-deny" hidden>
          <p class="kicker">Store closed</p>
          <h2 class="display display-page">This shop is 18+</h2>
          <p class="lede narrow">You can still play Disgrowth in Discord. Purchases are not available.</p>
          <div class="cta-row">
            <a class="btn btn-accent" href="/">Back home</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
