const DEFAULT_CATEGORY_RULES = [
  { category: 'income', keywords: ['salary', 'payroll', 'wage', 'deposit', 'bonus', 'refund', 'reimbursement'] },
  { category: 'groceries', keywords: ['grocery', 'supermarket', 'market', 'aldi', 'lidl', 'tesco', 'whole foods'] },
  { category: 'utilities', keywords: ['utility', 'electric', 'water', 'gas bill', 'internet', 'broadband', 'phone bill'] },
  { category: 'transport', keywords: ['transport', 'uber', 'lyft', 'train', 'metro', 'bus', 'fuel', 'petrol', 'parking', 'toll'] },
  { category: 'entertainment', keywords: ['netflix', 'spotify', 'cinema', 'movie', 'game', 'concert', 'entertainment'] },
  { category: 'transfers', keywords: ['transfer', 'internal transfer', 'zelle', 'venmo', 'cash app'] }
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isIncomeAmount(amount) {
  return Number(amount) > 0;
}

function createRuleBasedCategorizer(rules = DEFAULT_CATEGORY_RULES) {
  return (transaction) => {
    const haystack = normalizeText(`${transaction.description || ''} ${transaction.merchant || ''}`);

    if (isIncomeAmount(transaction.amount)) {
      for (const rule of rules) {
        if (rule.category === 'income' && rule.keywords.some((kw) => haystack.includes(normalizeText(kw)))) {
          return 'income';
        }
      }
    }

    for (const rule of rules) {
      if (rule.category === 'income') continue;
      if (rule.keywords.some((kw) => haystack.includes(normalizeText(kw)))) {
        return rule.category;
      }
    }

    if (isIncomeAmount(transaction.amount)) {
      return 'income';
    }

    return 'uncategorized';
  };
}

function categorizeTransaction(transaction, options = {}) {
  const classifier = typeof options.classifier === 'function'
    ? options.classifier
    : createRuleBasedCategorizer(options.rules || DEFAULT_CATEGORY_RULES);

  const category = classifier(transaction);
  return {
    ...transaction,
    category: category || 'uncategorized'
  };
}

function categorizeTransactions(transactions, options = {}) {
  return transactions.map((tx) => categorizeTransaction(tx, options));
}

module.exports = {
  DEFAULT_CATEGORY_RULES,
  createRuleBasedCategorizer,
  categorizeTransaction,
  categorizeTransactions
};
