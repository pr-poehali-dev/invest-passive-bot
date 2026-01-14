const API_URL = {
  auth: 'https://functions.poehali.dev/feff97e6-e1e6-4c5f-aaef-9082c57cae04',
  transactions: 'https://functions.poehali.dev/96c45909-be58-4465-a7bc-61e872431493',
  admin: 'https://functions.poehali.dev/5b2046ba-b585-417a-8635-43c46837f3ab'
};

export const api = {
  async auth(telegramData: any) {
    const response = await fetch(API_URL.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramData)
    });
    return response.json();
  },

  async getTransactions(userId: number) {
    const response = await fetch(`${API_URL.transactions}?user_id=${userId}`);
    return response.json();
  },

  async createTransaction(data: any) {
    const response = await fetch(API_URL.transactions, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async getAdminDashboard(adminId: number) {
    const response = await fetch(`${API_URL.admin}?action=dashboard`, {
      headers: { 'X-Admin-Id': adminId.toString() }
    });
    return response.json();
  },

  async getPendingTransactions(adminId: number) {
    const response = await fetch(`${API_URL.admin}?action=pending_transactions`, {
      headers: { 'X-Admin-Id': adminId.toString() }
    });
    return response.json();
  },

  async approveDeposit(adminId: number, transactionId: number) {
    const response = await fetch(API_URL.admin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Id': adminId.toString()
      },
      body: JSON.stringify({ action: 'approve_deposit', transaction_id: transactionId })
    });
    return response.json();
  },

  async approveWithdrawal(adminId: number, transactionId: number) {
    const response = await fetch(API_URL.admin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Id': adminId.toString()
      },
      body: JSON.stringify({ action: 'approve_withdrawal', transaction_id: transactionId })
    });
    return response.json();
  },

  async rejectTransaction(adminId: number, transactionId: number) {
    const response = await fetch(API_URL.admin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Id': adminId.toString()
      },
      body: JSON.stringify({ action: 'reject_transaction', transaction_id: transactionId })
    });
    return response.json();
  }
};