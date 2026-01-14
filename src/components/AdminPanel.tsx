import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface AdminPanelProps {
  userId: number;
}

export default function AdminPanel({ userId }: AdminPanelProps) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashData, transData] = await Promise.all([
        api.getAdminDashboard(userId),
        api.getPendingTransactions(userId)
      ]);
      setDashboard(dashData);
      setTransactions(transData.transactions || []);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
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
                      <p className="text-sm text-muted-foreground">Карта: {tx.card_number}</p>
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
    </div>
  );
}
