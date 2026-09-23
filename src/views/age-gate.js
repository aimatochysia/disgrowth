import { html } from '../lib/html.js';

export function ageGate() {
  return html`
    <div class="age-gate" data-age-gate>
      <div class="age-gate-card" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
        <div class="age-gate-ask">
          <h2 id="age-gate-title" class="display display-page">Are you 18 or older?</h2>
          <p class="lede narrow">Gold Bars are sold only to adults. If your country’s age of majority is higher, that age applies.</p>
          <div class="cta-row age-gate-actions">
            <button type="button" class="btn btn-gold" data-age-yes>Yes, I’m 18+</button>
            <button type="button" class="btn btn-ghost" data-age-no>No</button>
          </div>
        </div>
        <div class="age-gate-deny" hidden>
          <h2 class="display display-page">This shop is 18+</h2>
          <p class="lede narrow">You can still play Disgrowth in Discord.</p>
          <a class="btn btn-accent" href="/">Back to home</a>
        </div>
      </div>
    </div>
  `;
}
