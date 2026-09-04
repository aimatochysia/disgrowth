# Operator fill-in

Complete before launch. Until `OPERATOR_LEGAL_NAME` is set in the environment, the site shows a preview banner: legal copy is draft.

```
OPERATOR_LEGAL_NAME=
OPERATOR_TRADING_NAME=Market Game
OPERATOR_REGISTERED_ADDRESS=
OPERATOR_COUNTRY=
GOVERNING_LAW=
VENUE=
OPERATOR_CONTACT_EMAIL=
SUPPORT_EMAIL=
PRIVACY_EMAIL=
DISCORD_SUPPORT_INVITE=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
STORE_ORIGIN=
LEMONSQUEEZY store slug / id=
Lawyer review date=
Languages (EN only vs EN+ID)=
```

Also set every key in `.env.example` (session secret, database URL, Lemon Squeezy variants and webhook secret).

After fill-in: remove nothing from git — the banner disappears automatically when `OPERATOR_LEGAL_NAME` is present.
