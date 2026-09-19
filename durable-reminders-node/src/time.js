const formatterCache = new Map();
function formatter(zone) {
  if (!formatterCache.has(zone)) formatterCache.set(zone, new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }));
  return formatterCache.get(zone);
}
function parts(ms, zone) {
  const o = Object.fromEntries(formatter(zone).formatToParts(new Date(ms))
    .filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`;
}

/**
 * Converts YYYY-MM-DDTHH:mm in an IANA zone to UTC. Ambiguous fall-back times
 * select the earlier instant. Nonexistent spring-forward times advance to the
 * next valid local minute. This deliberately rejects second-level local input.
 */
export function localToInstant(local, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('localTime must be YYYY-MM-DDTHH:mm');
  // validates the IANA identifier
  formatter(zone);
  const nominal = Date.parse(`${local}:00Z`);
  const matches = [];
  for (let ms = nominal - 16 * 3600e3; ms <= nominal + 16 * 3600e3; ms += 60000) {
    if (parts(ms, zone) === local) matches.push(ms);
  }
  if (matches.length) return new Date(matches[0]).toISOString();
  // Gap policy: scan forward in requested wall-clock minutes, then apply normal conversion.
  for (let n = 1; n <= 180; n++) {
    const next = new Date(nominal + n * 60000).toISOString().slice(0, 16);
    try { return localToInstant(next, zone); } catch { /* still in the gap */ }
  }
  throw new Error(`could not resolve local time in ${zone}`);
}
