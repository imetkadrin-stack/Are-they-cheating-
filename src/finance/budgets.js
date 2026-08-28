function toYearMonth(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function createBudgetLimit({ id, category, limit, period = 'monthly', active = true }) {
  const normalizedLimit = Number(limit);
  const resolvedId = id || `budget_${category}_${period}_${normalizedLimit}`;
  return {
    id: resolvedId,
    category,
    limit: normalizedLimit,
    period,
    active: Boolean(active)
  };
}

function createBudgetAlertHistory({ category, periodKey, spent, limit }) {
  return {
    id: `alert_${category}_${periodKey}`,
    category,
    periodKey,
    spent,
    limit,
    threshold: limit > 0 ? spent / limit : 0,
    createdAt: new Date().toISOString(),
    kind: 'budget_threshold_exceeded'
  };
}

function computeSpendByCategory(transactions, period = 'monthly') {
  const spend = {};
  for (const tx of transactions) {
    if (Number(tx.amount) >= 0) continue;
    const category = tx.category || 'uncategorized';
    const periodKey = period === 'monthly' ? toYearMonth(tx.date) : 'all-time';
    if (!periodKey) continue;
    const key = `${category}:${periodKey}`;
    spend[key] = (spend[key] || 0) + Math.abs(Number(tx.amount));
  }
  return spend;
}

function evaluateBudgetAlerts({ transactions, budgetLimits, alertHistory = [] }) {
  const activeLimits = budgetLimits.filter((limit) => limit.active);
  const existingAlertIds = new Set(alertHistory.map((a) => a.id));
  const spendByCategory = computeSpendByCategory(transactions, 'monthly');
  const newAlerts = [];

  for (const budgetLimit of activeLimits) {
    for (const [key, spent] of Object.entries(spendByCategory)) {
      const separatorIndex = key.lastIndexOf(':');
      if (separatorIndex <= 0) continue;
      const category = key.slice(0, separatorIndex);
      const periodKey = key.slice(separatorIndex + 1);
      if (category !== budgetLimit.category) continue;
      if (spent <= Number(budgetLimit.limit)) continue;

      const alert = createBudgetAlertHistory({
        category,
        periodKey,
        spent,
        limit: Number(budgetLimit.limit)
      });

      if (!existingAlertIds.has(alert.id)) {
        newAlerts.push(alert);
      }
    }
  }

  return {
    newAlerts,
    spendByCategory
  };
}

module.exports = {
  createBudgetLimit,
  createBudgetAlertHistory,
  computeSpendByCategory,
  evaluateBudgetAlerts
};
