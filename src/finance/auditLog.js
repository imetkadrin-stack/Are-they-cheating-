const ALLOWED_ACTIONS = new Set([
  'import',
  'categorize',
  'budget_update',
  'budget_alert_generated',
  'recurring_detection',
  'report_export'
]);

function sanitizeMetadata(metadata = {}) {
  const {
    source,
    recordCount,
    categoryCount,
    budgetCategory,
    alertCount,
    period,
    exportedFormat,
    status
  } = metadata;

  return {
    source,
    recordCount,
    categoryCount,
    budgetCategory,
    alertCount,
    period,
    exportedFormat,
    status
  };
}

function createFinanceAuditEvent({ action, actor = 'system', metadata = {} }) {
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Unsupported finance audit action: ${action}`);
  }

  return {
    timestamp: new Date().toISOString(),
    domain: 'finance',
    action,
    actor,
    metadata: sanitizeMetadata(metadata)
  };
}

function appendAuditEvent(history, eventInput) {
  const event = createFinanceAuditEvent(eventInput);
  return [...history, event];
}

module.exports = {
  ALLOWED_ACTIONS,
  sanitizeMetadata,
  createFinanceAuditEvent,
  appendAuditEvent
};
