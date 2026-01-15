import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface AdminPanelProps {
  userId: number;
}

export default function AdminPanel({ userId }: AdminPanelProps) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [newBalance, setNewBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashData, transData, usersData] = await Promise.all([
        api.getAdminDashboard(userId),
        api.getPendingTransactions(userId),
        api.getUsers(userId)
      ]);
      setDashboard(dashData);
      setTransactions(transData.transactions || []);
      setUsers(usersData.users || []);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userTgId: number) => {
    try {
      const details = await api.getUserDetails(userId, userTgId);
      setUserDetails(details);
      setSelectedUser(details.user);
      setNewBalance(parseFloat(details.user?.balance || 0));
    } catch (error) {
      toast.error('Ошибка загрузки данных пользователя');
    }
  };

  const handleUpdateBalance = async () => {
    if (!selectedUser) return;
    
    try {
      await api.updateBalance(userId, selectedUser.telegram_id, newBalance);
      toast.success('Баланс обновлен');
      loadData();
      loadUserDetails(selectedUser.telegram_id);
    } catch (error) {
      toast.error('Ошибка обновления баланса');
    }
  };

  const handleUpdateTransactionStatus = async (transactionId: number, status: string) => {
    try {
      await api.updateTransactionStatus(userId, transactionId, status);
      toast.success(`Статус изменен на ${status}`);
      if (selectedUser) {
        loadUserDetails(selectedUser.telegram_id);
      }
      loadData();
    } catch (error) {
      toast.error('Ошибка изменения статуса');
    }
  };

  const handleApproveDeposit = async (transactionId: number) => {
    try {
      await api.approveDeposit(userId, transactionId);
      toast.success('Пополнение одобрено');
      loadData();
    } catch (error) {
      toast.error('Ошибка при одобрении');
    }
  };

  const handleApproveWithdrawal = async (transactionId: number) => {
    try {
      await api.approveWithdrawal(userId, transactionId);
      toast.success('Вывод одобрен');
      loadData();
    } catch (error) {
      toast.error('Ошибка при одобрении');
    }
  };

  const handleReject = async (transactionId: number) => {
    try {
      await api.rejectTransaction(userId, transactionId);
      toast.success('Транзакция отклонена');
      loadData();
    } catch (error) {
      toast.error('Ошибка при отклонении');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-in">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Icon name="Shield" size={32} className="text-primary" />
          Админ-панель
        </h1>
        <p className="text-muted-foreground mt-2">Управление платформой</p>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card/50 backdrop-blur-lg">
          <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
          <TabsTrigger value="transactions">Транзакции</TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Users" size={16} className="text-purple-400" />
                <p className="text-xs text-muted-foreground">Всего пользователей</p>
              </div>
              <p className="text-2xl font-bold">{dashboard?.total_users || 0}</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-orange-500/10 border-pink-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Wallet" size={16} className="text-pink-400" />
                <p className="text-xs text-muted-foreground">Общий баланс</p>
              </div>
              <p className="text-2xl font-bold">{dashboard?.total_balance?.toFixed(2) || 0} ₽</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="ArrowUpToLine" size={16} className="text-blue-400" />
                <p className="text-xs text-muted-foreground">Ожидают пополнения</p>
              </div>
              <p className="text-2xl font-bold">{dashboard?.pending_deposits || 0}</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="ArrowDownToLine" size={16} className="text-orange-400" />
                <p className="text-xs text-muted-foreground">Ожидают вывода</p>
              </div>
              <p className="text-2xl font-bold">{dashboard?.pending_withdrawals || 0}</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="Clock" size={20} className="text-primary" />
              Ожидающие транзакции
            </h3>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Нет ожидающих транзакций</p>
              ) : (
                transactions.map((tx: any) => (
                  <div key={tx.id} className="p-4 bg-background/30 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={tx.type === 'deposit' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}>
                            {tx.type === 'deposit' ? 'Пополнение' : 'Вывод'}
                          </Badge>
                          <span className="text-lg font-bold">{tx.amount} ₽</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Пользователь: {tx.first_name} {tx.last_name} (@{tx.username})
                        </p>
                        {tx.card_number && (
                          <div className="mt-2 p-2 bg-primary/10 rounded">
                            <p className="text-xs text-muted-foreground">Реквизиты для вывода:</p>
                            <p className="text-sm font-mono font-bold">{tx.card_number}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(tx.card_number);
                                toast.success('Номер карты скопирован');
                              }}
                              className="mt-1 h-6 text-xs"
                            >
                              <Icon name="Copy" size={12} className="mr-1" />
                              Скопировать
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(tx.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => tx.type === 'deposit' ? handleApproveDeposit(tx.id) : handleApproveWithdrawal(tx.id)}
                          className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        >
                          <Icon name="Check" size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(tx.id)}
                        >
                          <Icon name="X" size={16} />
                        </Button>
                      </div>
                    </div>
                    <Separator className="bg-primary/10" />
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="Users" size={20} className="text-primary" />
              Все пользователи ({users.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {users.map((user: any) => (
                <Dialog key={user.telegram_id}>
                  <DialogTrigger asChild>
                    <div 
                      onClick={() => loadUserDetails(user.telegram_id)}
                      className="p-4 bg-background/30 rounded-lg hover:bg-background/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {user.first_name} {user.last_name}
                            {user.username && <span className="text-muted-foreground"> (@{user.username})</span>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Баланс: {parseFloat(user.balance || 0).toFixed(2)} ₽ | 
                            Вложено: {parseFloat(user.invested || 0).toFixed(2)} ₽
                          </p>
                        </div>
                        <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e2536] border-primary/20">
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        <Icon name="User" size={24} className="text-primary" />
                        {selectedUser?.first_name} {selectedUser?.last_name}
                      </DialogTitle>
                    </DialogHeader>
                    
                    {userDetails && (
                      <div className="space-y-4">
                        <Card className="p-4 bg-background/30">
                          <h4 className="font-semibold mb-3">Управление балансом</h4>
                          <div className="flex gap-3">
                            <Input
                              type="number"
                              value={newBalance}
                              onChange={(e) => setNewBalance(parseFloat(e.target.value))}
                              className="bg-background/50"
                            />
                            <Button onClick={handleUpdateBalance} className="gradient-primary">
                              <Icon name="Save" size={16} className="mr-2" />
                              Сохранить
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Текущий баланс: {parseFloat(selectedUser?.balance || 0).toFixed(2)} ₽
                          </p>
                        </Card>

                        <Card className="p-4 bg-background/30">
                          <h4 className="font-semibold mb-3">Транзакции пользователя</h4>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {userDetails.transactions?.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">Нет транзакций</p>
                            ) : (
                              userDetails.transactions?.map((tx: any) => (
                                <div key={tx.id} className="p-3 bg-background/50 rounded">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <Badge className="mb-1">{tx.type}</Badge>
                                      <p className="text-sm">{tx.description}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(tx.created_at).toLocaleString('ru-RU')}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold">{tx.amount} ₽</p>
                                      <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                                        {tx.status}
                                      </Badge>
                                    </div>
                                  </div>
                                  {tx.status === 'pending' && (
                                    <div className="flex gap-2 mt-2">
                                      <Button 
                                        size="sm" 
                                        onClick={() => handleUpdateTransactionStatus(tx.id, 'completed')}
                                        className="flex-1"
                                      >
                                        Одобрить
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="destructive"
                                        onClick={() => handleUpdateTransactionStatus(tx.id, 'rejected')}
                                        className="flex-1"
                                      >
                                        Отклонить
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </Card>

                        <Card className="p-4 bg-background/30">
                          <h4 className="font-semibold mb-3">Депозиты</h4>
                          <div className="space-y-2">
                            {userDetails.deposits?.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">Нет депозитов</p>
                            ) : (
                              userDetails.deposits?.map((dep: any) => (
                                <div key={dep.id} className="p-3 bg-background/50 rounded flex justify-between">
                                  <div>
                                    <p className="font-medium">{dep.amount} ₽</p>
                                    <p className="text-xs text-muted-foreground">
                                      Ставка: {dep.rate}% | Тип: {dep.type}
                                    </p>
                                  </div>
                                  <Badge>{dep.status}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                        </Card>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}