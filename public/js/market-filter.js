// Pure list and heatmap logic for the market page; the page script and the tests both import it.

export const MAX_TILES = 150;

/** A business's tags are its focus commodities (tickers, in share order). Until the engine writes them its sector stands in. */
export function tagsOf(quote) {
  if (quote.tags?.length) return quote.tags;
  return quote.type === 'company' && quote.sector ? [quote.sector] : [];
}

/** A tag also keeps its own commodity in the list. */
export function matchesTag(quote, tag) {
  return !tag || quote.ticker === tag || tagsOf(quote).includes(tag);
}

export function filterQuotes(quotes, { q = '', type = '', tag = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return quotes.filter(
    (quote) =>
      (!type || quote.type === type) &&
      matchesTag(quote, tag) &&
      (!needle || `${quote.ticker} ${quote.name} ${quote.focus || ''}`.toLowerCase().includes(needle))
  );
}

/** Tags worth offering: the ones some business carries. */
export function tagList(quotes) {
  return [...new Set(quotes.filter((quote) => quote.type === 'company').flatMap(tagsOf))];
}

/**
 * Heatmap groups: listed businesses only, one group per tag. A business with several tags sits in each,
 * its market cap split between them so the map's total area stays honest. Beyond maxTiles businesses
 * (by cap) the rest fold into one "other" tile per group.
 */
export function heatGroups(quotes, maxTiles = MAX_TILES) {
  const companies = quotes.filter((quote) => quote.type === 'company' && quote.cap > 0).sort((a, b) => b.cap - a.cap);
  const groups = new Map();
  companies.forEach((quote, i) => {
    const tags = tagsOf(quote);
    for (const tag of tags.length ? tags : ['other']) {
      const group = groups.get(tag) || { value: 0, kept: [], rest: [] };
      const item = { quote, value: quote.cap / (tags.length || 1) };
      (i < maxTiles ? group.kept : group.rest).push(item);
      group.value += item.value;
      groups.set(tag, group);
    }
  });
  return groups;
}
