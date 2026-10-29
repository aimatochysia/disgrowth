// Chart formulas the player types in the browser, e.g. "sma(close, 20)" or "ema(close, 12) - ema(close, 26)".
// A tiny parser, not eval (the CSP forbids it, and nothing here is ever sent anywhere).

const FIELDS = { open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v' };
const MAX_LENGTH = 120;

function roll(series, n, step) {
  const size = Math.max(1, Math.min(Math.floor(n), series.length || 1));
  return series.map((_, i) => (i + 1 < size ? NaN : step(series.slice(i + 1 - size, i + 1))));
}

const FUNCTIONS = {
  sma: (x, n) => roll(x, n, (w) => w.reduce((a, b) => a + b, 0) / w.length),
  hi: (x, n) => roll(x, n, (w) => Math.max(...w)),
  lo: (x, n) => roll(x, n, (w) => Math.min(...w)),
  ema: (x, n) => {
    const k = 2 / (Math.max(1, Math.floor(n)) + 1);
    let prev = NaN;
    return x.map((v) => (prev = Number.isNaN(prev) ? v : v * k + prev * (1 - k)));
  },
  abs: (x) => x.map(Math.abs),
};

/** Returns a function bars -> numbers (NaN where undefined). Throws an Error with a short message on bad input. */
export function compile(source) {
  const text = String(source).trim();
  if (!text || text.length > MAX_LENGTH) throw new Error(`Write 1 to ${MAX_LENGTH} characters.`);
  const tokens = text.match(/\d+\.?\d*|[a-z]+|[-+*/(),]|\S/gi);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (want) => {
    if (want && tokens[pos] !== want) throw new Error(`Expected "${want}".`);
    return tokens[pos++];
  };
  const lift = (op) => (a, b) => a.map((v, i) => op(v, b[i]));
  const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => (b === 0 ? NaN : a / b) };
  const constant = (n) => ({ n });

  function expr(depth) {
    let left = term(depth);
    while (peek() === '+' || peek() === '-') left = binary(take(), left, term(depth));
    return left;
  }
  function term(depth) {
    let left = unary(depth);
    while (peek() === '*' || peek() === '/') left = binary(take(), left, unary(depth));
    return left;
  }
  function binary(op, a, b) {
    return (bars) => lift(ops[op])(series(a, bars), series(b, bars));
  }
  function unary(depth) {
    if (peek() === '-') {
      take();
      const inner = unary(depth);
      return (bars) => series(inner, bars).map((v) => -v);
    }
    return atom(depth);
  }
  function atom(depth) {
    if (depth > 8) throw new Error('Too deeply nested.');
    const t = take();
    if (t === undefined) throw new Error('Formula ends too soon.');
    if (t === '(') {
      const inner = expr(depth + 1);
      take(')');
      return inner;
    }
    if (/^\d/.test(t)) return constant(Number(t));
    if (!/^[a-z]+$/i.test(t)) throw new Error(`Unexpected "${t}".`);
    const name = t.toLowerCase();
    if (FIELDS[name]) return (bars) => bars.map((bar) => Number(bar[FIELDS[name]]));
    if (!FUNCTIONS[name]) throw new Error(`Unknown name "${t}". Try close, sma, ema, hi, lo, abs.`);
    take('(');
    const args = [expr(depth + 1)];
    while (peek() === ',') {
      take();
      args.push(expr(depth + 1));
    }
    take(')');
    if (args.length !== FUNCTIONS[name].length) throw new Error(`${name} takes ${FUNCTIONS[name].length} values.`);
    return (bars) => FUNCTIONS[name](...args.map((arg, i) => (i === 0 ? series(arg, bars) : number(arg, bars))));
  }
  function series(node, bars) {
    if (typeof node === 'function') return node(bars);
    return bars.map(() => node.n);
  }
  function number(node, bars) {
    if (typeof node === 'function') throw new Error('The second value must be a plain number.');
    return node.n;
  }

  const root = expr(0);
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos]}".`);
  return (bars) => series(root, bars);
}

/** Line-series data for the chart: [{ time, value }], skipping bars the formula has no value for. */
export function evaluate(source, bars) {
  const values = compile(source)(bars);
  return bars.flatMap((bar, i) => (Number.isFinite(values[i]) ? [{ time: bar.t, value: values[i] }] : []));
}
