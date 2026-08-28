# Safe Personal Finance Features

This repository now includes **consent-based personal finance analytics** that operate on imported or mocked transaction data only.

## Safety boundaries

- No banking credential collection or storage
- No account takeover, login bypass, MFA bypass, or portal scraping
- No unauthorized data access
- Audit events keep only minimal metadata needed for operational traceability

## Modules

- `src/finance/categories.js`
  - Rule-based transaction categorization with transparent keyword rules
  - Optional pluggable classifier function for future local ML strategies
- `src/finance/budgets.js`
  - Budget limit model helper
  - Alert history model helper
  - Threshold-based monthly over-budget alerts
- `src/finance/recurring.js`
  - Recurring payment detection via merchant normalization, cadence, and amount similarity
  - Returns summary metadata and transaction IDs by default (raw transactions are optional)
- `src/finance/cashflow.js`
  - Income, expenses, net cashflow, and monthly rollup summary
- `src/finance/dashboard.js`
  - Dashboard-facing data model builder for safe finance cards and summaries
- `src/finance/auditLog.js`
  - Structured finance audit events for: import, categorize, budget updates, alert generation, recurring detection, and exports

## Example usage

```js
const {
  buildFinanceDashboardModel,
  createBudgetLimit
} = require('./src/finance');

const budgetLimits = [
  createBudgetLimit({ category: 'groceries', limit: 400 }),
  createBudgetLimit({ category: 'entertainment', limit: 100 })
];

const dashboard = buildFinanceDashboardModel({
  transactions: importedTransactions,
  budgetLimits
});
```

## Tests and sample data

- Fixture: `test/fixtures/imported-transactions.json`
- Unit tests: `test/finance.test.js`
- Run tests: `npm test`
