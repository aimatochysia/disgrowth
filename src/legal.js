import { html, raw } from './lib/html.js';

function fill(template, vars) {
  return template.replaceAll(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => vars[key] ?? '');
}

export function legalVars(config) {
  return {
    DATE: config.LEGAL_DATE,
    OPERATOR_LEGAL_NAME: config.OPERATOR_LEGAL_NAME,
    OPERATOR_CONTACT_EMAIL: config.OPERATOR_CONTACT_EMAIL,
    SUPPORT_EMAIL: config.SUPPORT_EMAIL,
    PRIVACY_EMAIL: config.PRIVACY_EMAIL,
    GOVERNING_LAW: config.GOVERNING_LAW,
    LOG_RETENTION_DAYS: String(config.LOG_RETENTION_DAYS),
    SESSION_DAYS: String(config.SESSION_DAYS),
    ORDER_RETENTION_YEARS: '7',
    TRANSFER_MECHANISM: config.TRANSFER_MECHANISM,
    SLA_DAYS: String(config.SLA_DAYS),
  };
}

const DOCS = {
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    kicker: 'Store agreement',
    body: `Last updated: {{DATE}}

**Who we are.** These Terms are between you and **{{OPERATOR_LEGAL_NAME}}** (“Operator”, “we”). The game is offered as **Disgrowth**. Contact: {{OPERATOR_CONTACT_EMAIL}}. We do not publish a street address or country on this site.

**What this site is.** This website (the “Store”) sells Gold Bars for Disgrowth. Play happens in Discord. Card payments are processed by Paddle as Merchant of Record.

**Agreement.** By logging in with Discord or completing a purchase you agree to these Terms, the Virtual Items Policy, the Refund Policy, the Cookie Policy, and the Privacy Policy. If you do not agree, do not log in or pay.

**Eligibility.** You must be allowed to use Discord under Discord’s Terms. You must be **at least 18 years old** (or the age of majority where you live, if higher) to purchase. The Store is not directed at children. We do not knowingly take payment from anyone under 18.

**Your character.** Purchases attach to the Discord account you log in with. You must log in before checkout. You are responsible for that Discord account. We may refuse or reverse a grant if we cannot match the payment to a real Disgrowth character.

**Not Discord.** The Store and the game are not endorsed by Discord Inc. Discord is a trademark of Discord Inc.

**Not Paddle’s game.** Paddle processes payment. Game rules, virtual items, and delivery in Discord are the Operator’s.

**Licence, not ownership.** Gold Bars, Bonds, Credits, Patron, and any other in-game value are **licensed virtual items** as described in the Virtual Items Policy. They have no cash value. You may not sell, swap, or escrow them for real money. We may change, reset, or remove items when we reasonably need to operate or shut down the game.

**Credits.** Credits cannot be purchased on the Store and never will be under these Terms as of the last updated date.

**Gold Bars and Patron.** The Store sells Gold Bars in set packs ($10, $25, $50, $100). Patron is **not** a paid Paddle subscription. If lifetime Gold Bars granted on a Discord account (net of refunds) reach **2,600**, Patron **tier 1** turns on: extra daily Bonds and occasional hints in Discord. Hints are imperfect, not professional advice, not guaranteed, and may pause if you have been away from the Discord server. Logging into this website does not count as server activity. A refund that drops lifetime Gold Bars below 2,600 turns Patron off.

**First Gold Bar purchase.** The first successful Gold Bar grant on a Discord account delivers **double** the Gold Bars listed for that pack. Later purchases on the same Discord account are the listed amount. If that first grant is refunded, doubling can apply again. We can also reset this by hand if you ask support.

**Acceptable use.** Do not attack the Store, scrape with abusive rates, exploit webhooks, falsify Discord identity, launder payments, or use the game or Store for anything illegal. We may suspend Store access and ask that the linked character be suspended in Discord.

**Availability.** The Store and the game may be unavailable. A purchase grants virtual items in the game; it does not guarantee uptime, a particular economic outcome, or rank.

**Changes.** We may change the catalog, prices for future buys, or these Terms. Continued use after notice (this site and/or Discord) counts as acceptance of the new Terms for later purchases. We will not silently convert Credits into a paid product.

**Disclaimer.** THE STORE AND GAME ARE PROVIDED “AS IS”. TO THE MAXIMUM EXTENT PERMITTED BY LAW WE DISCLAIM IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS, AND NON-INFRINGEMENT. SIMULATION OUTCOMES ARE NOT FINANCIAL ADVICE.

**Liability cap.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR’S TOTAL LIABILITY ARISING OUT OF THE STORE OR VIRTUAL ITEMS IN ANY TWELVE-MONTH PERIOD IS LIMITED TO THE AMOUNTS YOU PAID FOR THE SPECIFIC PURCHASE GIVING RISE TO THE CLAIM (OR USD $50 IF GREATER CONSUMER RIGHTS APPLY AND CANNOT BE WAIVED). SOME PLACES DO NOT ALLOW THESE LIMITS.

**Indemnity.** If you break these Terms or the law and that causes claims against us, you will cover reasonable resulting costs, to the extent permitted.

**Governing law.** {{GOVERNING_LAW}}

**Contact.** {{OPERATOR_CONTACT_EMAIL}} / {{SUPPORT_EMAIL}}.

**Entire agreement.** These Terms plus the policies on this legal page are the agreement for the Store. Discord’s terms govern Discord. Paddle’s terms govern payment processing.`,
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    kicker: 'What we hold',
    body: `Last updated: {{DATE}}

**Controller.** {{OPERATOR_LEGAL_NAME}}. Privacy contact: {{PRIVACY_EMAIL}}. We do not publish a street address or country on this site.

**What this policy covers.** This Store and how we connect purchases to your Disgrowth character. It does **not** replace Discord’s Privacy Policy or Paddle’s Privacy Policy.

**Data we collect**

1. **Discord profile (OAuth identify + email).** User id, username, display name, avatar hash, and email when Discord provides it (used to prefill Paddle Checkout).
2. **Session.** An encrypted cookie so we remember who is logged in.
3. **Game account fields we read.** Credits, Bonds, Gold Bars, an internal mirror field, Patron flags, and tutorial progress — to show your account page and to apply purchases.
4. **Payments (via Paddle webhooks).** Event type, order and variant ids, the Discord id and pack you checked out with, status, and related timestamps. Paddle collects your payment card, billing address, and email as Merchant of Record. We do not see your full card number. Stored webhook JSON is redacted (email, card last four, and IP stripped).
5. **Logs.** IP address, browser, URL, time, error codes — security and debugging, retained {{LOG_RETENTION_DAYS}} days unless needed for fraud.

**Why.** Operate the Store, authenticate you, deliver virtual items, prevent fraud, meet accounting and tax cooperation with the Merchant of Record, and answer support.

**Legal bases (where GDPR-style rules apply).** Contract (deliver the item you bought), legitimate interests (security, fraud), consent (only if we ever add non-essential cookies — the session cookie is strictly necessary), legal obligation (if a regulator lawfully asks).

**Sharing.** Paddle (payment). Hosting and database providers processing on our instructions. Discord (you log in there). We do not sell personal information.

**International transfers.** Hosting may be outside your country. {{TRANSFER_MECHANISM}}.

**Retention.** Session: {{SESSION_DAYS}} days idle. Order records: duration of the game plus {{ORDER_RETENTION_YEARS}} years for accounting. Game character row: until you ask for deletion **and** we can process it without breaking legal holds.

**Your rights.** Depending on where you live: access, correction, deletion, restriction, portability, objection, withdrawal of consent, and a complaint to a supervisory authority. To use them: {{PRIVACY_EMAIL}}. We may need to verify your Discord identity.

**Children.** Store purchases are 18+. We do not knowingly collect payment data from children. If you believe we have, contact {{PRIVACY_EMAIL}}.

**California.** We do not sell or share personal information as those words are used in CCPA/CPRA for cross-context advertising. This version of the Store has no advertising pixels.

**Security.** HTTPS, hashed webhook secrets, restricted database credentials. No method is 100% secure.

**Changes.** We will update this chapter and the “last updated” date.`,
  },
  refunds: {
    slug: 'refunds',
    title: 'Refund Policy',
    kicker: 'After payment',
    body: `Last updated: {{DATE}}

Payments are charged by **Paddle** as Merchant of Record. Chargebacks go through them; contacting us first is faster.

**Gold Bars — two-hour unused window.** You may request a refund of a Gold Bar pack if **both** of the following are true:

1. You ask within **two (2) hours** of the purchase; and
2. The Gold Bars from that purchase are still in your Gold Bars wallet — they have not been converted to Bonds or otherwise used.

If more than two hours have passed, we cannot refund. If the Gold Bars have already been converted or spent, we cannot refund. We treat a pack as used if your Gold Bars balance is below the amount actually granted for that purchase (including a first-purchase double). Wallet floors at zero — a reversal will not put the account into negative Gold Bars.

**First-purchase double.** If we refund the grant that used your first-purchase double, that Discord account can receive the double again on a later purchase. Refunding a later (non-doubled) purchase does not restore the double.

**Patron.** Patron follows lifetime Gold Bars bought (net of refunds). If a refund drops you below the unlock line, Patron turns off. We do not sell a standalone Patron subscription on this Store.

**Chargebacks.** If you chargeback after receiving items, we may disable Store access and game perks and dispute with the Merchant of Record.

**EU/UK consumer cooling-off.** Many places let you withdraw from digital content **unless** you consented to immediate delivery and acknowledged that you lose the withdrawal right. Our checkout checkboxes include that acknowledgement. Where the law still forces a refund, we will comply and reverse what we can under this policy.

**How to ask.** Email {{SUPPORT_EMAIL}} in a way we can match to your Discord account, with the Paddle order email or order id. We aim to answer in {{SLA_DAYS}} business days.

**Paddle.** Their buyer terms also apply to the payment contract.`,
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    kicker: 'Strictly necessary',
    body: `Last updated: {{DATE}}

**Strictly necessary.** After Discord login we set an encrypted **session cookie** (httpOnly, Secure, SameSite=Lax) so we know you are you. This is required for the Store to work. It is not advertising.

**OAuth.** A short-lived state cookie to prevent CSRF during Discord login.

**Day and night.** Your browser may remember the day/night preference in local storage. That is not a cookie and is not used to identify you.

**Paddle.** Checkout may load Paddle scripts and open an overlay on this site. Paddle may set cookies on **their** domain. See their policy.

**Analytics.** None in this version of the Store.

**How to control.** You can log out (clears the session) or block cookies in your browser; the Store will not stay logged in.`,
  },
  'virtual-items': {
    slug: 'virtual-items',
    title: 'Virtual Items Policy',
    kicker: 'Licence, not cash',
    body: `Last updated: {{DATE}}

**Licence.** Gold Bars, Bonds, Credits, and Patron are **limited, revocable, non-exclusive, non-transferable licences** to use features of Disgrowth. They are **not** money, e-money, deposits, securities, commodities, or crypto-assets. They cannot be redeemed with us for cash.

**Credits.** Earned and spent inside the simulation. **Not for sale** on the Store.

**Bonds.** Daily spend in Discord. Gold Bars convert **to** Bonds in Discord at 1:1. Conversion is one-way. Never Bonds into Gold Bars. Never either into Credits.

**Gold Bars.** The premium wallet sold on this Store. Dual-recorded internally with a legacy mirror field. Buying Gold Bars does not buy Credits.

**Patron.** A perk unlocked when lifetime Gold Bars granted on a Discord account (net of refunds) reach **2,600** (Patron tier 1). While Patron is on, the game grants extra daily Bonds and may send occasional hints. Hints are imperfect and may pause if you have been away from the Discord server. Logging into this website does not count as Discord server activity. Patron is not a Paddle subscription, not a cash product, and is not sold on its own. First-purchase doubling applies to Gold Bars only.

**No secondary market.** You may not sell accounts, Gold Bars, or Patron for real money. We may reclaim items obtained that way.

**Changes and shutdown.** We may rebalance numbers, close the game, or wipe wallets. If we shut down for good we are not required to cash out. We may offer goodwill at our discretion.

**Bugs and exploits.** Items from bugs may be removed.

**Taxes.** You are responsible for taxes on your side except where Paddle collects as Merchant of Record.`,
  },
};

export const LEGAL_INDEX = [
  DOCS.terms,
  DOCS.privacy,
  DOCS.refunds,
  DOCS.cookies,
  DOCS['virtual-items'],
];

export function getLegalDoc(slug, config) {
  const doc = DOCS[slug];
  if (!doc) return null;
  const vars = legalVars(config);
  return {
    ...doc,
    html: renderLegalBody(fill(doc.body, vars)),
  };
}

function renderLegalBody(text) {
  const blocks = text.trim().split(/\n\n+/);
  const parts = blocks.map((block) => {
    const lines = block.split('\n');
    if (lines[0].startsWith('## ')) {
      const title = inline(lines[0].slice(3).trim());
      const rest = lines.slice(1).filter(Boolean);
      const heading = `<h3>${title}</h3>`;
      if (!rest.length) return heading;
      return `${heading}<p>${rest.map((line) => inline(line)).join('<br />')}</p>`;
    }
    if (/^\d+\.\s/.test(lines[0]) || lines.every((l) => /^\d+\.\s/.test(l) || l.startsWith(' '))) {
      const items = lines.filter(Boolean).map((line) => {
        const cleaned = line.replace(/^\d+\.\s*/, '');
        return `<li>${inline(cleaned)}</li>`;
      });
      return `<ol>${items.join('')}</ol>`;
    }
    const htmlBlock = lines.map((line) => inline(line)).join('<br />');
    if (block.startsWith('Last updated:')) {
      return `<p class="legal-updated">${htmlBlock}</p>`;
    }
    return `<p>${htmlBlock}</p>`;
  });
  return raw(parts.join(''));
}

function inline(line) {
  let s = line
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  s = s.replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return s;
}

export function legalToc() {
  return LEGAL_INDEX.map((d) => html`
    <a href="/legal#${d.slug}">${d.title}</a>
  `);
}

export function legalBookPage(config) {
  return LEGAL_INDEX.map((doc) => {
    const full = getLegalDoc(doc.slug, config);
    return html`
      <section class="legal-chapter" id="${doc.slug}">
        <p class="kicker">${doc.kicker}</p>
        <h2>${doc.title}</h2>
        <div class="legal-body">
          ${full.html}
        </div>
      </section>
    `;
  });
}

export function legalIndexPage() {
  return LEGAL_INDEX.map((d) => html`
    <a class="legal-card" href="/legal#${d.slug}">
      <span class="kicker">${d.kicker}</span>
      <strong>${d.title}</strong>
    </a>
  `);
}