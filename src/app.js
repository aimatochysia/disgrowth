import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { CATALOG, catalogItemsFromConfig, isSku } from './catalog.js';
import { artCss, artHtmlClass, detectArt } from './art.js';
import { checkoutConfigured, createPaddleCheckoutUrl, priceIdForSku } from './checkout.js';
import { authorizeUrl, decodeOAuthState, encodeOAuthState, exchangeCode, fetchIdentify, sessionFromDiscordUser } from './oauth.js';
import { render } from './lib/html.js';
import { firstQueryValue, safeReturnPath } from './lib/security.js';
import { countryFromRequest } from './country.js';
import { createCustomerPortalUrl, createPaddleSdk } from './paddle.js';
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
import { legalHubPage, loginPage, notFoundPage, oauthContinuePage, supportPage, welcomePage } from './views/misc.js';
import { getLegalDoc } from './legal.js';
import { config } from './config.js';
import { createDb } from './db.js';
import { createQuoteCache } from './ticker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

export function createApp({ config, db, fetchImpl = fetch, art = detectArt(rootDir), quoteCache } = {}) {
  const quotes = quoteCache || createQuoteCache({
    load: () => (db && typeof db.latestTickerQuotes === 'function' ? db.latestTickerQuotes() : []),
    interval: config.NODE_ENV !== 'test',
  });
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
          scriptSrc: ["'self'", 'https://cdn.paddle.com', 'https://sandbox-cdn.paddle.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.paddle.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'https://cdn.discordapp.com', 'https://checkout-service.paddle.com', 'data:'],
          connectSrc: [
            "'self'",
            'https://api.paddle.com',
            'https://sandbox-api.paddle.com',
            'https://checkout-service.paddle.com',
            'https://sandbox-checkout-service.paddle.com',
            'https://*.paddle.com',
          ],
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
    validate: { xForwardedForHeader: false, trustProxy: false },
  });

  function buildPaddleBoot(req, user) {
    if (!config.PADDLE_CLIENT_TOKEN) return null;
    if (config.PADDLE_ENV !== 'production' && config.PADDLE_ENV !== 'sandbox') return null;
    const country = countryFromRequest(req);
    const boot = {
      env: config.PADDLE_ENV,
      clientToken: config.PADDLE_CLIENT_TOKEN,
      successUrl: `${config.STORE_ORIGIN}/welcome`,
      catalog: catalogItemsFromConfig(config),
    };
    if (country) boot.country = country;
    if (user?.email) boot.customerEmail = user.email;
    if (user?.discordId) boot.discordId = user.discordId;
    return boot;
  }

  function page(req, res, { title, page: pageName, description, body, status = 200, paddle = false }) {
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
            paddleBoot: paddle ? buildPaddleBoot(req, user) : null,
            tickerQuotes: quotes.snapshot(),
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
      const here = safeReturnPath(req.originalUrl.split('?')[0]);
      res.redirect(302, `/login?next=${encodeURIComponent(here)}`);
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
      paddle: true,
      body: storePage({ items: catalogItemsFromConfig(config) }),
    });
  });

  app.get('/login', authLimit, (req, res) => {
    const next = safeReturnPath(req.query.next);
    const user = readSession(req, config);
    if (user) {
      res.redirect(302, next);
      return;
    }
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
    const next = safeReturnPath(req.query.next);
    const user = readSession(req, config);
    if (user) {
      res.redirect(302, next);
      return;
    }
    if (!config.oauthReady) {
      res.redirect(302, '/login?error=oauth');
      return;
    }
    const state = encodeOAuthState(next, config.SESSION_SECRET);
    setOAuthCookie(res, { state, next }, config);
    res.redirect(302, authorizeUrl({
      clientId: config.DISCORD_CLIENT_ID,
      redirectUri: config.DISCORD_REDIRECT_URI,
      state,
    }));
  });

  app.get('/api/auth/discord/callback', authLimit, async (req, res) => {
    const pendingCookie = readOAuthCookie(req, config);
    clearOAuthCookie(res, config);
    const code = firstQueryValue(req.query.code);
    const state = firstQueryValue(req.query.state);
    const discordError = firstQueryValue(req.query.error);
    const pending = decodeOAuthState(state, config.SESSION_SECRET)
      || (pendingCookie && pendingCookie.state === state ? pendingCookie : null);
    if (discordError || !pending || !code) {
      res.redirect(302, '/login?error=oauth');
      return;
    }
    try {
      const token = await exchangeCode({
        code,
        clientId: config.DISCORD_CLIENT_ID,
        clientSecret: config.DISCORD_CLIENT_SECRET,
        redirectUri: config.DISCORD_REDIRECT_URI,
        fetchImpl,
      });
      const profile = await fetchIdentify(token.access_token, fetchImpl);
      setSessionCookie(res, sessionFromDiscordUser(profile), config);
      const next = safeReturnPath(pending.next);
      res.status(200).type('html').set('Cache-Control', 'no-store').send(oauthContinuePage(next));
    } catch (err) {
      console.error('[store] oauth callback', err.message, err.detail || '');
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
    let paddleCustomer = null;
    if (db) {
      try {
        player = await db.findPlayerByDiscordId(req.user.discordId);
        if (typeof db.findCustomerByDiscordId === 'function') {
          paddleCustomer = await db.findCustomerByDiscordId(req.user.discordId);
        }
      } catch (err) {
        console.error('[store] account query', err.message);
      }
    }
    page(req, res, {
      title: 'Account',
      page: 'account',
      body: accountPage({
        user: req.user,
        player,
        dbReady: Boolean(db),
        paddleCustomer,
        portalError: req.query.portal === 'missing' ? 'No Paddle invoices on this Discord account yet.' : req.query.portal === 'error' ? 'Could not open the invoice portal. Try again in a moment.' : '',
      }),
    });
  });

  app.post('/account/portal', requireSession, async (req, res) => {
    try {
      if (!db || typeof db.findCustomerByDiscordId !== 'function') {
        res.redirect(302, '/account?portal=missing');
        return;
      }
      const customer = await db.findCustomerByDiscordId(req.user.discordId);
      if (!customer?.customer_id) {
        res.redirect(302, '/account?portal=missing');
        return;
      }
      const paddle = createPaddleSdk(config);
      const url = await createCustomerPortalUrl(paddle, customer.customer_id);
      res.redirect(302, url);
    } catch (err) {
      console.error('[store] portal', err.message);
      res.redirect(302, '/account?portal=error');
    }
  });

  function skuWithPrice(skuKey) {
    return { ...CATALOG[skuKey], priceId: priceIdForSku(skuKey, config) };
  }

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
    const sku = skuWithPrice(req.params.sku);
    page(req, res, {
      title: sku.label,
      page: 'buy',
      paddle: Boolean(player),
      body: buyPage({
        sku,
        user: req.user,
        player,
        checkoutReady: checkoutConfigured(config, req.params.sku),
        overlayReady: Boolean(config.PADDLE_CLIENT_TOKEN),
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
    const sku = skuWithPrice(req.params.sku);
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
        paddle: true,
        status: 400,
        body: buyPage({
          sku,
          user: req.user,
          player,
          checkoutReady: checkoutConfigured(config, sku.sku_key),
          overlayReady: Boolean(config.PADDLE_CLIENT_TOKEN),
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
    if (!config.PADDLE_API_KEY) {
      show('Turn on JavaScript to open checkout.');
      return;
    }
    try {
      const url = await createPaddleCheckoutUrl({
        apiKey: config.PADDLE_API_KEY,
        apiBase: config.PADDLE_API_BASE,
        priceId: priceIdForSku(sku.sku_key, config),
        discordId: req.user.discordId,
        skuKey: sku.sku_key,
        successUrl: `${config.STORE_ORIGIN}/welcome`,
        checkoutUrl: config.STORE_ORIGIN,
        fetchImpl,
      });
      res.redirect(302, url);
    } catch (err) {
      console.error('[store] paddle checkout', err.message, err.detail || '');
      show('Checkout could not be started. Try again in a moment.');
    }
  });

  app.get('/welcome', (req, res) => {
    page(req, res, { title: 'Welcome', page: 'success', body: welcomePage() });
  });

  app.get('/success', (_req, res) => {
    res.redirect(302, '/welcome');
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

export const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

export let db = null;
try {
  db = createDb(config.DATABASE_URL);
} catch (err) {
  console.error('[store] database pool failed', err.message);
}

const app = createApp({ config, db });
export default app;
