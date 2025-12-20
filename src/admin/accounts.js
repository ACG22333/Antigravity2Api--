function getAccountsPayload(authManager) {
  const accounts = authManager.getAccountsSummary();
  return {
    count: accounts.length,
    current: {
      claude: authManager.getCurrentAccountIndex("claude"),
      gemini: authManager.getCurrentAccountIndex("gemini"),
    },
    accounts,
  };
}

async function deleteAccount(authManager, fileName) {
  const ok = await authManager.deleteAccountByFile(fileName);
  return ok;
}

async function reloadAccounts(authManager) {
  const accounts = await authManager.reloadAccounts();
  return {
    count: accounts.length,
    current: {
      claude: authManager.getCurrentAccountIndex("claude"),
      gemini: authManager.getCurrentAccountIndex("gemini"),
    },
    accounts,
  };
}

module.exports = {
  getAccountsPayload,
  deleteAccount,
  reloadAccounts,
};

