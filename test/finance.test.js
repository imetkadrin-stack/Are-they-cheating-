const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/imported-transactions.json');

const {
  categorizeTransactions,
  evaluateBudgetAlerts,
  createBudgetLimit,
  detectRecurringTransactions,
  summarizeCashflow,
  createFinanceAuditEvent,
  buildFinanceDashboardModel
} = require('../src/finance');

test('categorizes imported transactions with safe rule-based defaults', () => {
  const categorized = categorizeTransactions(fixture);
  const byId = Object.fromEntries(categorized.map((tx) => [tx.id, tx.category]));

  assert.equal(byId.t1, 'income');
  assert.equal(byId.t2, 'groceries');
  assert.equal(byId.t3, 'utilities');
  assert.equal(byId.t4, 'transport');
  assert.equal(byId.t5, 'entertainment');
  assert.equal(byId.t10, 'transfers');
});

test('generates budget alerts when monthly spend exceeds limits', () => {
  const categorized = categorizeTransactions(fixture);
  const budgetLimits = [createBudgetLimit({ category: 'entertainment', limit: 16 })];
  const result = evaluateBudgetAlerts({
    transactions: categorized,
    budgetLimits,
    alertHistory: []
  });

  assert.equal(result.newAlerts.length, 1);
  assert.equal(result.newAlerts[0].category, 'entertainment');
  assert.equal(result.newAlerts[0].periodKey, '2026-03');
});

test('detects recurring payments using merchant and amount heuristics', () => {
  const categorized = categorizeTransactions(fixture);
  const recurring = detectRecurringTransactions(categorized);

  const netflix = recurring.find((item) => item.merchant.includes('netflix'));
  assert.ok(netflix, 'netflix recurring entry should exist');
  assert.equal(netflix.cadence, 'monthly');
  assert.ok(netflix.occurrences >= 3);
});

test('summarizes cashflow and recurring commitments', () => {
  const categorized = categorizeTransactions(fixture);
  const recurring = detectRecurringTransactions(categorized);
  const summary = summarizeCashflow(categorized, recurring);

  assert.equal(summary.income, 8400);
  assert.equal(summary.recurringMonthlyCommitments > 15, true);
  assert.ok(summary.monthly['2026-01']);
});

test('creates sanitized finance audit events', () => {
  const event = createFinanceAuditEvent({
    action: 'import',
    actor: 'user:demo',
    metadata: {
      source: 'csv_upload',
      recordCount: 10,
      accountNumber: 'SHOULD_NOT_APPEAR'
    }
  });

  assert.equal(event.domain, 'finance');
  assert.equal(event.action, 'import');
  assert.equal(event.metadata.recordCount, 10);
  assert.equal(event.metadata.accountNumber, undefined);
});

test('builds dashboard-safe finance model from imported data only', () => {
  const model = buildFinanceDashboardModel({
    transactions: fixture,
    budgetLimits: [createBudgetLimit({ category: 'entertainment', limit: 30 })]
  });

  assert.equal(model.cards.length, 4);
  assert.ok(Array.isArray(model.recurring));
  assert.ok(Array.isArray(model.budgetAlerts));
});
