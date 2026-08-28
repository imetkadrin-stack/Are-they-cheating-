function normalizeMerchantName(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  const ms = Math.abs(d2.getTime() - d1.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function amountSimilarity(amounts) {
  if (amounts.length < 2) return 0;
  const sorted = amounts.map((x) => Math.abs(Number(x))).sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max === 0) return 1;
  return 1 - (max - min) / max;
}

function inferCadence(dayDiffs) {
  if (!dayDiffs.length) return 'unknown';
  const avg = dayDiffs.reduce((a, b) => a + b, 0) / dayDiffs.length;
  if (avg >= 26 && avg <= 33) return 'monthly';
  if (avg >= 6 && avg <= 8) return 'weekly';
  if (avg >= 13 && avg <= 17) return 'biweekly';
  return 'irregular';
}

function detectRecurringTransactions(transactions, options = {}) {
  const minOccurrences = options.minOccurrences || 3;
  const minSimilarity = options.minSimilarity || 0.9;
  const includeTransactions = options.includeTransactions === true;
  const grouped = new Map();

  for (const tx of transactions) {
    if (Number(tx.amount) >= 0) continue;
    const merchant = normalizeMerchantName(tx.merchant || tx.description);
    if (!merchant) continue;
    if (!grouped.has(merchant)) grouped.set(merchant, []);
    grouped.get(merchant).push(tx);
  }

  const recurring = [];
  for (const [merchant, list] of grouped.entries()) {
    if (list.length < minOccurrences) continue;
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    const amounts = list.map((tx) => tx.amount);
    const similarity = amountSimilarity(amounts);
    if (similarity < minSimilarity) continue;

    const dayDiffs = [];
    for (let i = 1; i < list.length; i += 1) {
      dayDiffs.push(daysBetween(list[i - 1].date, list[i].date));
    }

    const cadence = inferCadence(dayDiffs);
    if (cadence === 'irregular') continue;

    const record = {
      merchant,
      cadence,
      occurrences: list.length,
      averageAmount: amounts.reduce((a, b) => a + Math.abs(Number(b)), 0) / amounts.length,
      latestDate: list[list.length - 1].date,
      transactionIds: list.map((tx) => tx.id).filter(Boolean)
    };

    if (includeTransactions) {
      record.transactions = list;
    }

    recurring.push(record);
  }

  return recurring;
}

module.exports = {
  normalizeMerchantName,
  detectRecurringTransactions
};
