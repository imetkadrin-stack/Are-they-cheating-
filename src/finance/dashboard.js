const { categorizeTransactions } = require('./categories');
const { detectRecurringTransactions } = require('./recurring');
const { summarizeCashflow } = require('./cashflow');
const { evaluateBudgetAlerts } = require('./budgets');

function buildFinanceDashboardModel({ transactions, budgetLimits = [], alertHistory = [], classifier }) {
  const categorized = categorizeTransactions(transactions, { classifier });
  const recurring = detectRecurringTransactions(categorized);
  const cashflow = summarizeCashflow(categorized, recurring);
  const budget = evaluateBudgetAlerts({
    transactions: categorized,
    budgetLimits,
    alertHistory
  });

  return {
    cards: [
      { id: 'income', label: 'Income', value: cashflow.income },
      { id: 'expenses', label: 'Expenses', value: cashflow.expenses },
      { id: 'net', label: 'Net Cashflow', value: cashflow.netCashflow },
      { id: 'recurring', label: 'Recurring Monthly Commitments', value: cashflow.recurringMonthlyCommitments }
    ],
    recurring,
    budgetAlerts: budget.newAlerts,
    monthlyCashflow: cashflow.monthly,
    categorizedTransactions: categorized
  };
}

module.exports = {
  buildFinanceDashboardModel
};
