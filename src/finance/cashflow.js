function toMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function summarizeCashflow(transactions, recurringCommitments = []) {
  let income = 0;
  let expenses = 0;
  const monthly = {};

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const month = toMonthKey(tx.date);
    if (!month) continue;

    if (!monthly[month]) {
      monthly[month] = { income: 0, expenses: 0, net: 0 };
    }

    if (amount > 0) {
      income += amount;
      monthly[month].income += amount;
    } else if (amount < 0) {
      expenses += Math.abs(amount);
      monthly[month].expenses += Math.abs(amount);
    }

    monthly[month].net = monthly[month].income - monthly[month].expenses;
  }

  const recurringMonthlyCommitments = recurringCommitments.reduce(
    (sum, item) => sum + (item.cadence === 'monthly' ? Number(item.averageAmount) : 0),
    0
  );

  return {
    income,
    expenses,
    netCashflow: income - expenses,
    recurringMonthlyCommitments,
    monthly
  };
}

module.exports = {
  summarizeCashflow
};
