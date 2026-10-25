/* =========================================================================
   SuperCoin Vault — Offline natural-language command parser
   Works 100% locally, zero API keys required.

   Supported forms (account first, then action):
     "Riya bhabhi 457 pending credited"   -> pending = 457, log gained
     "8056 GoSats Active"                  -> gosatsStatus = Active (phone short code ok)
     "M2 Pro Shopsy day 4"                 -> shopsyDays = 4
     "M2 Pro Shopsy +1"                    -> shopsyDays += 1
     "Dadi used 48 coins"                  -> balance -= 48, log used
     "Papa +50" / "Papa gained 50"         -> balance += 50, log gained
     "Riya balance 100"                    -> balance = 100
     "9169 notes new phone number"         -> notes updated
   ------------------------------------------------------------------ */

export function parseCommand(text, accounts) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const accById = new Map(accounts.map((a) => [a.id, a]));
  const accByAlias = new Map(
    accounts
      .slice()
      .sort((a, b) => b.alias.length - a.alias.length)
      .map((a) => [a.alias.toLowerCase(), a])
  );
  const lower = raw.toLowerCase();

  let account = null;
  let actionText = raw;

  const tokens = raw.match(/#?\d+|[A-Za-z0-9]+/g) || [];

  // 1) explicit account id token: #3, or a bare 1–2 digit id at the very start
  for (const [i, tok] of tokens.entries()) {
    const m = tok.match(/^#?(\d{1,2})$/);
    if (m && accById.has(Number(m[1])) && (tok.startsWith('#') || i === 0)) {
      account = accById.get(Number(m[1]));
      actionText = raw.replace(tok, ' ').trim();
      break;
    }
  }

  // 2) phone short-code / full number token (prefix match, >= 3 digits)
  if (!account) {
    for (const tok of tokens) {
      const m = tok.match(/^(\d{3,})$/);
      if (m) {
        const found = accounts.find(
          (a) => a.phoneNumber && a.phoneNumber.replace(/\D/g, '').startsWith(m[1])
        );
        if (found) {
          account = found;
          actionText = raw.replace(tok, ' ').trim();
          break;
        }
      }
    }
  }

  // 3) alias substring match (longest alias first, case-insensitive)
  if (!account) {
    let best = null;
    for (const [alias, a] of accByAlias) {
      if (alias && lower.includes(alias)) {
        if (!best || alias.length > best[0].length) best = [alias, a];
      }
    }
    if (best) {
      account = best[1];
      actionText = lower.replace(best[0], ' ').trim();
    }
  }

  if (!account) return { error: "I couldn't match that account." };

  const t = actionText.toLowerCase().trim();
  if (!t) return { accountId: account.id, updates: {} };

  /* ---- Shopsy ---- */
  const mDay = t.match(/shopsy\D{0,20}?(\d+)/);
  if (mDay) {
    const n = Math.min(7, Math.max(0, Number(mDay[1])));
    return {
      accountId: account.id,
      updates: { shopsyDays: n },
      history: { type: 'gained', amount: 0, reason: `Shopsy streak set to ${n}/7` },
    };
  }
  if (t.match(/shopsy/) && (t.match(/\+1/) || t.match(/next day/))) {
    const n = Math.min(7, (account.shopsyDays || 0) + 1);
    return {
      accountId: account.id,
      updates: { shopsyDays: n },
      history: { type: 'gained', amount: 0, reason: `Shopsy +1 day (${n}/7)` },
    };
  }

  /* ---- GoSats ---- */
  const mGs = t.match(/gosats\s*(active|inactive)/);
  if (mGs) {
    const status = mGs[1].charAt(0).toUpperCase() + mGs[1].slice(1);
    return {
      accountId: account.id,
      updates: { gosatsStatus: status },
      history: { type: 'gained', amount: 0, reason: `GoSats ${status}` },
    };
  }

  /* ---- Coins: used / spent ---- */
  const mUsed = t.match(/used\s*(\d+)\s*(?:coins)?|spent\s*(\d+)\s*(?:coins)?/);
  if (mUsed) {
    const amt = Number(mUsed[1] || mUsed[2]);
    return {
      accountId: account.id,
      updates: { balance: Math.max(0, (account.balance || 0) - amt) },
      history: { type: 'used', amount: amt, reason: 'Coins used' },
    };
  }

  /* ---- Coins: gained / credited (+N) ---- */
  const mGain = t.match(/(?:\+|gained|credited|add)\s*(\d+)\s*(?:coins)?/);
  if (mGain) {
    const amt = Number(mGain[1]);
    return {
      accountId: account.id,
      updates: { balance: (account.balance || 0) + amt },
      history: { type: 'gained', amount: amt, reason: 'Coins gained' },
    };
  }

  /* ---- Pending credited / set ---- */
  const mPending =
    t.match(/(\d+)\s*(?:pending|coming)\s*(?:credited|added|set)?/) ||
    t.match(/(?:pending|coming)\s*(?:is|to|:)?\s*(\d+)/);
  if (mPending) {
    const amt = Number(mPending[1]);
    return {
      accountId: account.id,
      updates: { pending: amt },
      history: { type: 'gained', amount: amt, reason: 'Pending credited' },
    };
  }

  /* ---- Balance set ---- */
  const mBal = t.match(/balance\s*(?:is|to|:)?\s*(\d+)/);
  if (mBal) {
    const amt = Number(mBal[1]);
    return {
      accountId: account.id,
      updates: { balance: amt },
      history: { type: 'gained', amount: 0, reason: `Balance set to ${amt}` },
    };
  }

  /* ---- Notes (capture from original-case action text) ---- */
  const mNotes = actionText.match(/notes?\s+(.+)/i);
  if (mNotes) {
    return {
      accountId: account.id,
      updates: { notes: mNotes[1].trim() },
      history: { type: 'gained', amount: 0, reason: 'Notes updated' },
    };
  }

  return { error: "I didn't understand that command. Try: 'Riya bhabhi 457 pending credited'" };
}
