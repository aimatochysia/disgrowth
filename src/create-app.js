// Named create-app.js on purpose. Vercel's Express preset treats src/app.js as
// the HTTP entry and would invoke createApp(req, res) on every request.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { CATALOG, isSku } from './catalog.js';
import { artCss, artHtmlClass, detectArt } from './art.js';
import { checkoutConfigured, createPaddleCheckoutUrl, priceIdForSku } from './checkout.js';
import { authorizeUrl, exchangeCode, fetchIdentify, newOAuthState, sessionFromDiscordUser } from './oauth.js';
import { render } from './lib/html.js';
import { safeNextPath } from './lib/security.js';
import {
  clearOAuthCookie,
  clearSessionCookie,
  readOAuthCookie,
  readSession,
  setOAuthCookie,
  setSessionCookie,
} from './session.js';
import { handlePaddleWebhook } from './webhook.js';
import { layout } from './views/layout.js';
import { homePage } from './views/home.js';
import { storePage } from './views/store.js';
import { buyPage } from './views/buy.js';
import { accountPage } from './views/account.js';
import { legalHubPage, loginPage, notFoundPage, successPage, supportPage } from './views/misc.js';
import { getLegalDoc } from './legal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

export function createApp({ config, db, fetchImpl = fetch, art = detectArt(rootDir) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.production || process.env.VERCEL ? true : 1);

  const artClass = artHtmlClass(art);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'https://cdn.discordapp.com', 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ['https://*.paddle.com', 'https://sandbox-buy.paddle.com', 'https://buy.paddle.com'],
          formAction: ["'self'", 'https://*.paddle.com', 'https://sandbox-buy.paddle.com', 'https://buy.paddle.com'],
          objectSrc: ["'none'"],
          ...(config.production ? {} : { upgradeInsecureRequests: null }),
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.post(
    '/api/webhooks/paddle',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const result = await handlePaddleWebhook({
        rawBody,
        signature: req.headers['paddle-signature'],
        config,
        db,
        log: console,
      });
      res.status(result.status).json(result.body);
    },
  );

  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(express.static(path.join(rootDir, 'public'), { maxAge: config.production ? '1h' : 0 }));

  app.get('/art.css', (_req, res) => {
    res.type('css').send(artCss(art));
  });

  const authLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.NODE_ENV === 'test',
    validate: { xForwardedForHeader: false },
  });

  function page(req, res, { title, page: pageName, description, body, status = 200 }) {
    try {
      const user = readSession(req, config);
      res.status(status).type('html').send(
        render(
          layout({
            title,
            path: req.path,
            user,
            config,
            page: pageName,
            description,
            body,
            artClass,
          }),
        ),
      );
    } catch (err) {
      console.error('[store] render failed', err);
      if (!res.headersSent) {
        res.status(500).type('html').send('Store is temporarily unavailable.');
      }
    }
  }

  function requireSession(req, res, next) {
    const user = readSession(req, config);
    if (!user) {
      res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl.split('?')[0])}`);
      return;
    }
    req.user = user;
    next();
  }

  app.get('/healthz', async (_req, res) => {
    const dbStatus = db ? await db.health() : 'down';
    res.status(200).json({
      ok: true,
      db: dbStatus,
      oauth: Boolean(config.oauthReady),
      checkout: Boolean(config.checkoutReady),
      missing: config.bootErrors || [],
    });
  });

  app.get('/', (req, res) => {
    page(req, res, {
      title: 'Store',
      page: 'home',
      body: homePage({ config }),
    });
  });

  app.get('/store', (req, res) => {
    page(req, res, {
      title: 'Shop',
      page: 'store',
      body: storePage(),
    });
  });

  app.get('/login', authLimit, (req, res) => {
    const next = safeNextPath(req.query.next, '/account');
    page(req, res, {
      title: 'Login',
      page: 'login',
      body: loginPage({
        next,
        oauthReady: config.oauthReady,
        error: req.query.error === 'oauth' ? 'Discord login failed. Try again.' : '',
      }),
    });
  });

  app.get('/auth/discord', authLimit, (req, res) => {
    if (!config.oauthReady) {
      res.redirect(302, '/login?error=oauth');
      return;
    }
    const { state, next } = newOAuthState(req.query.next);
    setOAuthCookie(res, { state, next }, config);
    res.redirect(302, authorizeUrl({
      clientId: config.DISCORD_CLIENT_ID,
      redirectUri: config.DISCORD_REDIRECT_URI,
      state,
    }));
  });

  app.get('/api/auth/discord/callback', authLimit, async (req, res) => {
    const pending = readOAuthCookie(req, config);
    clearOAuthCookie(res, config);
    const { code, state } = req.query;
    if (!pending || !code || !state || pending.state !== state) {
      res.redirect(302, '/login?error=oauth');
      return;
    }
    try {
      const token = await exchangeCode({
        code: String(code),
        clientId: config.DISCORD_CLIENT_ID,
        clientSecret: config.DISCORD_CLIENT_SECRET,
        redirectUri: config.DISCORD_REDIRECT_URI,
        fetchImpl,
      });
      const profile = await fetchIdentify(token.access_token, fetchImpl);
      setSessionCookie(res, sessionFromDiscordUser(profile), config);
      res.redirect(302, safeNextPath(pending.next, '/account'));
    } catch (err) {
      console.error('[store] oauth callback', err.message);
      res.redirect(302, '/login?error=oauth');
    }
  });

  function logout(req, res) {
    clearSessionCookie(res, config);
    res.redirect(302, '/');
  }
  app.get('/logout', logout);
  app.post('/logout', logout);
  app.post('/api/auth/logout', logout);

  app.get('/account', requireSession, async (req, res) => {
    let player = null;
    if (db) {
      try {
        player = await db.findPlayerByDiscordId(req.user.discordId);
      } catch (err) {
        console.error('[store] account query', err.message);
      }
    }
    page(req, res, {
      title: 'Account',
      page: 'account',
      body: accountPage({ user: req.user, player, dbReady: Boolean(db) }),
    });
  });

  app.get('/buy/:sku', requireSession, async (req, res) => {
    if (!isSku(req.params.sku)) {
      page(req, res, { title: 'Not found', page: 'legal', body: notFoundPage(), status: 404 });
      return;
    }
    let player = null;
    let firstPurchaseAvailable = true;
    if (db) {
      try {
        player = await db.findPlayerByDiscordId(req.user.discordId);
        if (player && typeof db.hasUsedFirstPurchase === 'function') {
          firstPurchaseAvailable = !(await db.hasUsedFirstPurchase(req.user.discordId));
        }
      } catch (err) {
        console.error('[store] buy query', err.message);
      }
    }
    page(req, res, {
      title: CATALOG[req.params.sku].label,
      page: 'buy',
      body: buyPage({
        sku: CATALOG[req.params.sku],
        user: req.user,
        player,
        checkoutReady: checkoutConfigured(config, req.params.sku),
        firstPurchaseAvailable,
        error: '',
      }),
    });
  });

  app.post('/buy/:sku', requireSession, async (req, res) => {
    if (!isSku(req.params.sku)) {
      page(req, res, { title: 'Not found', page: 'legal', body: notFoundPage(), status: 404 });
      return;
    }
    const sku = CATALOG[req.params.sku];
    let player = null;
    let firstPurchaseAvailable = true;
    if (db) {
      try {
        player = await db.findPlayerByDiscordId(req.user.discordId);
        if (player && typeof db.hasUsedFirstPurchase === 'function') {
          firstPurchaseAvailable = !(await db.hasUsedFirstPurchase(req.user.discordId));
        }
      } catch (err) {
        console.error('[store] buy query', err.message);
      }
    }
    const show = (error) =>
      page(req, res, {
        title: sku.label,
        page: 'buy',
        status: 400,
        body: buyPage({
          sku,
          user: req.user,
          player,
          checkoutReady: checkoutConfigured(config, sku.sku_key),
          firstPurchaseAvailable,
          error,
        }),
      });

    if (!player) {
      show('Run /disgrowth in Discord, then refresh.');
      return;
    }
    if (req.body?.age !== 'yes' || req.body?.terms !== 'yes' || req.body?.novalue !== 'yes') {
      show('Confirm all three checkboxes to continue.');
      return;
    }
    if (!checkoutConfigured(config, sku.sku_key)) {
      show('Checkout is not configured.');
      return;
    }
    try {
      const url = await createPaddleCheckoutUrl({
        apiKey: config.PADDLE_API_KEY,
        apiBase: config.PADDLE_API_BASE,
        priceId: priceIdForSku(sku.sku_key, config),
        discordId: req.user.discordId,
        skuKey: sku.sku_key,
        successUrl: `${config.STORE_ORIGIN}/success`,
        fetchImpl,
      });
      res.redirect(302, url);
    } catch (err) {
      console.error('[store] paddle checkout', err.message, err.detail || '');
      show('Checkout could not be started. Try again in a moment.');
    }
  });

  app.get('/success', (req, res) => {
    page(req, res, { title: 'Payment sent', page: 'success', body: successPage() });
  });

  app.get('/support', (req, res) => {
    page(req, res, { title: 'Support', page: 'legal', body: supportPage({ config }) });
  });

  app.get('/legal', (req, res) => {
    page(req, res, { title: 'Legal', page: 'legal', body: legalHubPage(config) });
  });

  app.get('/legal/:slug', (req, res) => {
    const doc = getLegalDoc(req.params.slug, config);
    if (!doc) {
      page(req, res, { title: 'Not found', page: 'legal', body: notFoundPage(), status: 404 });
      return;
    }
    res.redirect(302, `/legal#${doc.slug}`);
  });

  app.use((req, res) => {
    page(req, res, { title: 'Not found', page: 'legal', body: notFoundPage(), status: 404 });
  });

  app.use((err, req, res, next) => {
    console.error('[store] request failed', err);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).type('html').send('Store is temporarily unavailable.');
  });

  return app;
}
