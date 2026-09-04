import { html, raw } from './lib/html.js';

function fill(template, vars) {
  return template.replaceAll(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => vars[key] ?? '');
}

export function legalVars(config) {
  return {
    DATE: config.LEGAL_DATE,
    OPERATOR_LEGAL_NAME: config.OPERATOR_LEGAL_NAME,
    OPERATOR_REGISTERED_ADDRESS: config.OPERATOR_REGISTERED_ADDRESS,
    OPERATOR_CONTACT_EMAIL: config.OPERATOR_CONTACT_EMAIL,
    SUPPORT_EMAIL: config.SUPPORT_EMAIL,
    PRIVACY_EMAIL: config.PRIVACY_EMAIL,
    GOVERNING_LAW: config.GOVERNING_LAW,
    VENUE: config.VENUE,
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

**Operator.** These Terms are between you and **{{OPERATOR_LEGAL_NAME}}** (“Operator”, “we”), {{OPERATOR_REGISTERED_ADDRESS}}. Contact: {{OPERATOR_CONTACT_EMAIL}}.

**Game.** “Disgrowth” / “Market Game” is a Discord-based simulation game operated by the Operator. The game client is a Discord bot. This website (the “Store”) sells certain virtual items and a subscription. Payments are processed by Lemon Squeezy as Merchant of Record.

**Agreement.** By creating a session (Discord login) or completing a purchase you agree to these Terms, the Virtual Items Policy, the Refund Policy, and the Privacy Policy. If you do not agree, do not log in or pay.

**Eligibility.** You must be allowed to use Discord under Discord’s Terms. You must be **at least 18 years old** (or the age of majority in your place of residence, if higher) to purchase. The Store is not directed at children. We do not knowingly take payment from anyone under 18.

**Account.** Your game identity is your Discord account. You must log in with Discord before checkout so we can attach the purchase to your Discord id. You are responsible for your Discord account security. We may refuse or reverse a grant if the Discord id on the payment does not match a real player row.

**Not Discord.** The Store and the game are not endorsed by Discord Inc. Discord is a trademark of Discord Inc.

**Not Lemon Squeezy’s game.** Lemon Squeezy processes payment. Game rules, virtual items, and Discord delivery are the Operator’s.

**License, not ownership.** Gold Bars, Bonds, Credits, the Accountant pass, and any other in-game value are **licensed virtual items** as described in the Virtual Items Policy. They have no cash value. You may not sell, swap, or escrow them for real money. We may change, reset, or remove items when we reasonably need to operate or shut down the game.

**Credits.** Credits cannot be purchased on the Store and never will be under these Terms as of the last updated date.

**Acceptable use.** Do not attack the Store, scrape with abusive rates, exploit webhooks, falsify Discord identity, launder payments, or use the game or Store for anything illegal. We may suspend Store access and ask the game operators to suspend the linked character.

**Service availability.** The Store and the game may be unavailable. Purchases grant virtual items in the game database; they do not guarantee uptime, a particular economic outcome, or competitive rank.

**Accountant pass.** The pass provides in-game convenience described on the store page (extra daily Bonds issued by the game bot, and occasional DM hints). Hints are imperfect, not professional advice, not guaranteed, and may pause if you are inactive in the Discord server. The pass is billed as a subscription via Lemon Squeezy.

**Changes.** We may change the Store catalog, prices (for future buys), or these Terms. Continued use after notice (site post and/or Discord) counts as acceptance of the new Terms for later purchases. Material changes to virtual-item licences will not silently convert Credits into a paid product.

**Disclaimer.** THE STORE AND GAME ARE PROVIDED “AS IS”. TO THE MAXIMUM EXTENT PERMITTED BY LAW WE DISCLAIM IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS, AND NON-INFRINGEMENT. SIMULATION OUTCOMES ARE NOT FINANCIAL ADVICE.

**Liability cap.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR’S TOTAL LIABILITY ARISING OUT OF THE STORE OR VIRTUAL ITEMS IN ANY TWELVE-MONTH PERIOD IS LIMITED TO THE AMOUNTS YOU PAID FOR THE SPECIFIC PURCHASE GIVING RISE TO THE CLAIM (OR USD $50 IF GREATER CONSUMER RIGHTS APPLY AND CANNOT BE WAIVED). SOME PLACES DO NOT ALLOW THESE LIMITS.

**Indemnity.** If you break these Terms or law and that causes claims against us, you will cover reasonable resulting costs, to the extent permitted.

**Governing law.** {{GOVERNING_LAW}}, excluding conflict-of-law rules. Courts of {{VENUE}} have exclusive jurisdiction, except that consumers may have non-waivable rights to sue where they live.

**Contact.** {{OPERATOR_CONTACT_EMAIL}} / {{SUPPORT_EMAIL}}.

**Entire agreement.** These Terms plus the policies linked in the footer are the agreement for the Store. Discord’s terms govern Discord. Lemon Squeezy’s terms govern payment processing.`,
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    kicker: 'What we hold',
    body: `Last updated: {{DATE}}

**Controller.** {{OPERATOR_LEGAL_NAME}}, {{OPERATOR_REGISTERED_ADDRESS}}. Privacy contact: {{PRIVACY_EMAIL}}.

**What this policy covers.** This site (the Store) and how we connect purchases to the Disgrowth / Market Game Discord bot database. It does **not** replace Discord’s Privacy Policy or Lemon Squeezy’s Privacy Policy.

**Data we collect**

1. **Discord profile (OAuth identify).** User id (snowflake), username, display name, avatar hash. We do **not** request email in this version of the Store.
2. **Session.** Encrypted cookie so we remember who is logged in.
3. **Game account fields we read.** Credits, Bonds, Gold Bars, Marks (legacy mirror), subscription flags, onboarding step — to show the account page and to apply purchases.
4. **Payments (via Lemon Squeezy webhooks).** Event type, order/subscription/variant ids, custom discord id / sku key, status, renewal/end timestamps. Lemon Squeezy collects your payment card, billing address, and email as Merchant of Record. We do not see your full card number. Stored webhook JSON is redacted (email, card last four, IP stripped).
5. **Logs.** IP address, user agent, URL, time, error codes — security and debugging, retained {{LOG_RETENTION_DAYS}} days unless needed for fraud.

**Why.** Operate the Store, authenticate you, deliver virtual items, prevent fraud, meet accounting/tax cooperation with the Merchant of Record, and respond to support.

**Legal bases (GDPR-style, if applicable).** Contract (deliver the item you bought), legitimate interests (security, fraud), consent (cookie banner if we ever add non-essential cookies — the session cookie is strictly necessary), legal obligation (if a regulator lawfully asks).

**Sharing.** Lemon Squeezy (payment). Hosting/database providers processing on our instructions. Discord (you log in there). We do not sell personal information.

**International transfers.** Hosting may be outside your country. {{TRANSFER_MECHANISM}}.

**Retention.** Session: {{SESSION_DAYS}} days idle. store_orders: duration of the game plus {{ORDER_RETENTION_YEARS}} years for accounting. Game players row: until you ask for deletion **and** we can process it without breaking legal holds.

**Your rights.** Depending on where you live: access, correction, deletion, restriction, portability, objection, withdrawal of consent, complaint to a supervisory authority. To use them: {{PRIVACY_EMAIL}}. We may need to verify Discord identity.

**Children.** Store purchases are 18+. We do not knowingly collect payment data from children. If you believe we have, contact {{PRIVACY_EMAIL}}.

**California.** We do not sell or share personal information as those words are used in CCPA/CPRA for cross-context advertising. This version of the Store has no advertising pixels.

**Security.** HTTPS, hashed webhook secrets, restricted database credentials. No method is 100% secure.

**Changes.** We will update this page and the “last updated” date.`,
  },
  refunds: {
    slug: 'refunds',
    title: 'Refund Policy',
    kicker: 'After payment',
    body: `Last updated: {{DATE}}

Payments are charged by **Lemon Squeezy** as Merchant of Record. Chargebacks go through them; contacting us first is faster.

**Virtual items.** Gold Bars and the Accountant pass are digital, delivered to the linked Discord id when our webhook succeeds (usually seconds).

**Gold Bars.** If you request a refund **before** Gold Bars are spent or converted to Bonds, we will try to reverse the Gold Bars (and Marks mirror) and approve a refund via Lemon Squeezy. If you already converted Gold Bars to Bonds or spent Bonds, we **cannot** reliably take Bonds back (other players and the city economy may already be affected). We may refuse or only refund unused Gold Bars. Wallet floors at zero — we will not put your account into negative Gold Bars.

**Accountant pass.** Unused time in the current billing period may be refunded at our discretion; access is turned off when the refund is processed. If you used pass perks (hints, extra Bonds already granted), we may refuse.

**Chargebacks.** If you chargeback after receiving items, we may disable Store access and game perks and dispute with the Merchant of Record.

**EU/UK consumer cooling-off.** Many places let you withdraw from digital content **unless** you consented to immediate delivery and acknowledged that you lose the withdrawal right. Our checkout checkboxes include that acknowledgement. Where the law still forces a refund, we will comply and reverse what we can.

**How to ask.** Email {{SUPPORT_EMAIL}} from a way we can match your Discord id, with the Lemon Squeezy order email / order id. We aim to answer in {{SLA_DAYS}} business days.

**Lemon Squeezy.** Their buyer terms also apply to the payment contract.`,
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    kicker: 'Strictly necessary',
    body: `Last updated: {{DATE}}

**Strictly necessary.** After Discord login we set an encrypted **session cookie** (httpOnly, Secure, SameSite=Lax) so we know you are you. This is required for the Store to work. It is not advertising.

**OAuth.** Short-lived state cookie to prevent CSRF during Discord login.

**Lemon Squeezy.** When you leave our site for checkout, Lemon Squeezy may set cookies on **their** domain. See their policy.

**Analytics.** None in this version of the Store.

**How to control.** You can log out (clears session) or block cookies in your browser; the Store will not stay logged in.`,
  },
  'virtual-items': {
    slug: 'virtual-items',
    title: 'Virtual Items Policy',
    kicker: 'Licence, not cash',
    body: `Last updated: {{DATE}}

**License.** Gold Bars (GL), Bonds (BN), Credits (CR), and the Accountant pass are **limited, revocable, non-exclusive, non-transferable licences** to use features of Disgrowth / Market Game. They are **not** money, e-money, deposits, securities, commodities, or crypto-assets. They cannot be redeemed with us for cash.

**Credits (CR).** Earned and spent inside the simulation. **Not for sale** on the Store.

**Bonds (BN).** Daily spend wallet, granted by the game. Gold Bars convert **to** Bonds in Discord at 1:1. Conversion is one-way. Never Bonds into Gold Bars. Never either into Credits.

**Gold Bars (GL).** Premium wallet sold on the Store. Dual-recorded internally with a legacy “Marks” field. Buying Gold Bars does not buy Credits.

**Accountant pass.** Subscription licence for extra daily Bonds and in-game DM hints, while active and while you meet the game’s activity rules (including inactivity pause). Logging into this website does not count as Discord server activity.

**No secondary market.** You may not sell accounts, Gold Bars, or the pass for real money. We may reclaim items obtained that way.

**Changes and shutdown.** We may rebalance numbers, close the game, or wipe wallets. If we shut down for good we are not required to cash out. We may offer goodwill at our discretion.

**Bugs and exploits.** Items from bugs may be removed.

**Taxes.** You are responsible for taxes on your side except where Lemon Squeezy collects as Merchant of Record.`,
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

export function legalIndexPage() {
  return LEGAL_INDEX.map((d) => html`
    <a class="legal-card" href="/legal/${d.slug}">
      <span class="kicker">${d.kicker}</span>
      <strong>${d.title}</strong>
    </a>
  `);
}
