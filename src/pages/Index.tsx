import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { initTelegram, getTelegramUser, getReferralCode } from '@/lib/telegram';
import { api } from '@/lib/api';
import AdminPanel from '@/components/AdminPanel';

const DAILY_RATE = 10.6;
const MIN_DEPOSIT = 100;
const MIN_WITHDRAWAL = 100;
const REFERRAL_BONUS = 25;
const CHAT_BONUS = 100;
const INVITE_25_BONUS = 2000;

export default function Index() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [balance, setBalance] = useState(0);
  const [invested, setInvested] = useState(0);
  const [dailyProfit, setDailyProfit] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [referralsCount, setReferralsCount] = useState(0);
  const [activeReferrals, setActiveReferrals] = useState(0);
  const [referralEarnings, setReferralEarnings] = useState(0);
  const [depositAmount, setDepositAmount] = useState(MIN_DEPOSIT);
  const [withdrawAmount, setWithdrawAmount] = useState(MIN_WITHDRAWAL);
  const [calculatorAmount, setCalculatorAmount] = useState([1000]);
  const [chatJoined, setChatJoined] = useState(false);
  const [inviteProgress, setInviteProgress] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initTelegram();
    const tgUser = getTelegramUser();
    const refCode = getReferralCode();
    
    if (tgUser) {
      authenticateUser(tgUser, refCode);
    } else {
      setLoading(false);
    }
  }, []);

  const authenticateUser = async (tgUser: any, refCode?: string) => {
    try {
      const response = await api.auth({
        telegram_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        referral_code: refCode
      });
      
      if (response.user) {
        setUser(response.user);
        setBalance(parseFloat(response.user.balance || 0));
        setInvested(parseFloat(response.user.invested || 0));
        setReferralsCount(response.user.referrals_count || 0);
        setActiveReferrals(response.user.active_referrals || 0);
        setReferralEarnings(parseFloat(response.user.referral_earnings || 0));
        setIsAdmin(response.user.is_admin || false);
        loadTransactions(tgUser.id);
      }
    } catch (error) {
      toast.error('Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (userId: number) => {
    try {
      const response = await api.getTransactions(userId);
      setTransactions(response.transactions || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (invested > 0) {
        const increment = (invested * DAILY_RATE) / 100 / 86400;
        setBalance(prev => prev + increment);
        setDailyProfit(prev => prev + increment);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [invested]);

  const handleDeposit = async () => {
    if (depositAmount < MIN_DEPOSIT) {
      toast.error(`Минимальная сумма пополнения ${MIN_DEPOSIT} ₽`);
      return;
    }
    
    if (!user) {
      toast.error('Необходима авторизация');
      return;
    }

    try {
      await api.createTransaction({
        action: 'deposit',
        user_id: user.telegram_id,
        amount: depositAmount
      });
      toast.success(`Заявка на пополнение ${depositAmount} ₽ отправлена на проверку`);
      loadTransactions(user.telegram_id);
    } catch (error) {
      toast.error('Ошибка отправки заявки');
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount < MIN_WITHDRAWAL) {
      toast.error(`Минимальная сумма вывода ${MIN_WITHDRAWAL} ₽`);
      return;
    }
    if (withdrawAmount > balance) {
      toast.error('Недостаточно средств');
      return;
    }
    
    if (!user) {
      toast.error('Необходима авторизация');
      return;
    }

    try {
      await api.createTransaction({
        action: 'withdraw',
        user_id: user.telegram_id,
        amount: withdrawAmount,
        card_number: '****'
      });
      toast.success(`Заявка на вывод ${withdrawAmount} ₽ отправлена`);
      loadTransactions(user.telegram_id);
    } catch (error) {
      toast.error('Ошибка отправки заявки');
    }
  };

  const copyReferralLink = () => {
    const link = `https://t.me/InvestPassiveBot?start=${user?.referral_code || 'demo'}`;
    navigator.clipboard.writeText(link);
    toast.success('Реферальная ссылка скопирована!');
  };

  const joinChat = async () => {
    window.open('https://t.me/+tDcs_yy5mcU4MTgx', '_blank');
    
    if (!chatJoined && user) {
      setTimeout(async () => {
        try {
          const result = await api.checkChatMembership(user.telegram_id);
          
          if (result.bonus_already_received) {
            setChatJoined(true);
            toast.info('Вы уже получили этот бонус');
          } else if (result.is_member && result.bonus_received) {
            setChatJoined(true);
            setBalance(prev => prev + CHAT_BONUS);
            setInvested(prev => prev + CHAT_BONUS);
            toast.success(`Получено ${CHAT_BONUS} ₽ за вступление в чат!`);
            loadTransactions(user.telegram_id);
          } else if (!result.is_member) {
            toast.error('Пожалуйста, вступите в чат чтобы получить бонус');
          }
        } catch (error) {
          toast.error('Ошибка проверки вступления');
        }
      }, 3000);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return 'ArrowUpToLine';
      case 'withdrawal': return 'ArrowDownToLine';
      case 'bonus': return 'Gift';
      default: return 'CircleDollarSign';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit': return 'green';
      case 'withdrawal': return 'orange';
      case 'bonus': return 'purple';
      default: return 'blue';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Успешно</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Ожидание</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Отменено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1f2e] via-[#1e2536] to-[#0f1419] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full gradient-primary animate-pulse mx-auto mb-4" />
          <p className="text-lg">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1f2e] via-[#1e2536] to-[#0f1419] text-white">
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          <AdminPanel userId={user?.telegram_id} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1f2e] via-[#1e2536] to-[#0f1419] text-white">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <header className="flex items-center justify-between py-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-glow">
              <Icon name="TrendingUp" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Invest Passive</h1>
              <p className="text-sm text-muted-foreground">Пассивный доход 10.6% в сутки</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="rounded-full border-primary/20 hover:border-primary">
            <Icon name="Bell" size={20} />
          </Button>
        </header>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-card/50 backdrop-blur-lg border border-primary/10">
            <TabsTrigger value="dashboard" className="data-[state=active]:gradient-primary">
              <Icon name="LayoutDashboard" size={18} />
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="data-[state=active]:gradient-primary">
              <Icon name="PieChart" size={18} />
            </TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:gradient-primary">
              <Icon name="Wallet" size={18} />
            </TabsTrigger>
            <TabsTrigger value="referrals" className="data-[state=active]:gradient-primary">
              <Icon name="Users" size={18} />
            </TabsTrigger>
            <TabsTrigger value="bonuses" className="data-[state=active]:gradient-primary">
              <Icon name="Gift" size={18} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 animate-slide-up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:scale-105 transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Wallet" size={16} className="text-purple-400" />
                  <p className="text-xs text-muted-foreground">Баланс</p>
                </div>
                <p className="text-2xl font-bold">{balance.toFixed(2)} ₽</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-orange-500/10 border-pink-500/20 hover:scale-105 transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="TrendingUp" size={16} className="text-pink-400" />
                  <p className="text-xs text-muted-foreground">Прибыль 24ч</p>
                </div>
                <p className="text-2xl font-bold">{dailyProfit.toFixed(2)} ₽</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20 hover:scale-105 transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Users" size={16} className="text-blue-400" />
                  <p className="text-xs text-muted-foreground">Партнеры</p>
                </div>
                <p className="text-2xl font-bold">{referralsCount}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 hover:scale-105 transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="ArrowDownToLine" size={16} className="text-orange-400" />
                  <p className="text-xs text-muted-foreground">Выведено</p>
                </div>
                <p className="text-2xl font-bold">{totalWithdrawn.toFixed(2)} ₽</p>
              </Card>
            </div>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="CreditCard" size={20} className="text-primary" />
                Пополнить баланс
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Сумма пополнения</label>
                  <Input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    min={MIN_DEPOSIT}
                    className="bg-background/50 border-primary/20"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Минимум {MIN_DEPOSIT} ₽</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleDeposit} className="gradient-primary flex-1">
                    <Icon name="Plus" size={18} className="mr-2" />
                    Пополнить баланс
                  </Button>
                  <Button variant="outline" className="border-primary/20">
                    Проверить оплату
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="MessageCircle" size={20} className="text-secondary" />
                Форум проекта
              </h3>
              <Button onClick={joinChat} variant="outline" className="w-full gradient-secondary border-0">
                <Icon name="ExternalLink" size={18} className="mr-2" />
                Перейти на форум
              </Button>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="History" size={20} className="text-accent" />
                История операций
              </h3>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Нет операций</p>
                ) : (
                  transactions.slice(0, 5).map((tx: any) => {
                    const color = getTransactionColor(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
                            <Icon name={getTransactionIcon(tx.type)} size={18} className={`text-${color}-400`} />
                          </div>
                          <div>
                            <p className="font-medium">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{tx.type === 'withdrawal' ? '-' : '+'}{tx.amount} ₽</p>
                          {getStatusBadge(tx.status)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-4 animate-slide-up">
            <Card className="p-6 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-primary/10">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Icon name="PieChart" size={20} className="text-primary" />
                Мой портфель
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Всего вложено</p>
                  <p className="text-2xl font-bold">{invested.toFixed(2)} ₽</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Активных депозитов</p>
                  <p className="text-2xl font-bold">{invested > 0 ? 1 : 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Доход в сутки</p>
                  <p className="text-2xl font-bold text-white">
                    {((invested * DAILY_RATE) / 100).toFixed(2)} ₽
                  </p>
                </div>
              </div>
              <Separator className="my-6 bg-primary/10" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Текущий тариф</span>
                  <Badge className="gradient-primary border-0">{DAILY_RATE}% в сутки</Badge>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Прогресс срока</span>
                    <span>30%</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="Calculator" size={20} className="text-secondary" />
                Калькулятор доходности
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="text-sm text-muted-foreground mb-3 block">
                    Сумма инвестиции: {calculatorAmount[0]} ₽
                  </label>
                  <Slider
                    value={calculatorAmount}
                    onValueChange={setCalculatorAmount}
                    min={MIN_DEPOSIT}
                    max={100000}
                    step={100}
                    className="mb-6"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">За сутки</p>
                    <p className="text-lg font-bold">{((calculatorAmount[0] * DAILY_RATE) / 100).toFixed(2)} ₽</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-pink-500/10 to-orange-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">За неделю</p>
                    <p className="text-lg font-bold">{((calculatorAmount[0] * DAILY_RATE * 7) / 100).toFixed(2)} ₽</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">За месяц</p>
                    <p className="text-lg font-bold">{((calculatorAmount[0] * DAILY_RATE * 30) / 100).toFixed(2)} ₽</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4 animate-slide-up">
            <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="Wallet" size={20} className="text-blue-400" />
                Доступно к выводу
              </h3>
              <p className="text-4xl font-bold mb-2">{balance.toFixed(2)} ₽</p>
              <p className="text-sm text-muted-foreground">Только накопленные проценты</p>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="ArrowDownToLine" size={20} className="text-primary" />
                Вывести средства
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Сумма вывода</label>
                  <Input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    min={MIN_WITHDRAWAL}
                    max={balance}
                    className="bg-background/50 border-primary/20"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Минимум {MIN_WITHDRAWAL} ₽</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Номер карты</label>
                  <Input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    className="bg-background/50 border-primary/20"
                  />
                </div>
                <Button onClick={handleWithdraw} className="w-full gradient-primary">
                  <Icon name="Send" size={18} className="mr-2" />
                  Подать заявку на вывод
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="referrals" className="space-y-4 animate-slide-up">
            <Card className="p-6 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-primary/10">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Icon name="Users" size={20} className="text-primary" />
                Партнерская программа
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Всего</p>
                  <p className="text-2xl font-bold">{referralsCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Активных</p>
                  <p className="text-2xl font-bold">{activeReferrals}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Доход</p>
                  <p className="text-2xl font-bold text-white">
                    {referralEarnings.toFixed(2)} ₽
                  </p>
                </div>
              </div>
              <Separator className="my-6 bg-primary/10" />
              <div className="space-y-4">
                <div className="p-4 bg-background/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Ваш процент</p>
                  <div className="flex items-center gap-2">
                    <Badge className="gradient-secondary border-0 text-lg px-4 py-1">{REFERRAL_BONUS}%</Badge>
                    <span className="text-sm">от депозита реферала</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="Link" size={20} className="text-secondary" />
                Реферальная ссылка
              </h3>
              <div className="flex gap-3">
                <Input
                  readOnly
                  value={`t.me/InvestPassiveBot?start=${user?.referral_code || 'demo'}`}
                  className="bg-background/50 border-primary/20"
                />
                <Button onClick={copyReferralLink} className="gradient-primary">
                  <Icon name="Copy" size={18} />
                </Button>
              </div>
              <Button onClick={copyReferralLink} variant="outline" className="w-full mt-4 border-primary/20">
                <Icon name="Share2" size={18} className="mr-2" />
                Пригласить друзей
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="bonuses" className="space-y-4 animate-slide-up">
            <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Icon name="MessageCircle" size={20} className="text-green-400" />
                    Вступить в чат
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Получи {CHAT_BONUS} ₽ за вступление</p>
                </div>
                {chatJoined && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Icon name="Check" size={14} className="mr-1" />
                    Выполнено
                  </Badge>
                )}
              </div>
              <Button
                onClick={joinChat}
                disabled={chatJoined}
                className={chatJoined ? 'w-full bg-green-500/20 text-green-400' : 'w-full gradient-primary'}
              >
                <Icon name="ExternalLink" size={18} className="mr-2" />
                {chatJoined ? 'Бонус получен!' : 'Открыть чат проекта'}
              </Button>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Icon name="Users" size={20} className="text-purple-400" />
                    Пригласи 25 друзей
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Получи {INVITE_25_BONUS} ₽</p>
                </div>
                <Badge variant="outline" className="border-purple-500/30">
                  {inviteProgress}/25
                </Badge>
              </div>
              <div className="space-y-2">
                <Progress value={(inviteProgress / 25) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  Осталось {25 - inviteProgress} приглашений
                </p>
              </div>
              <Button onClick={copyReferralLink} variant="outline" className="w-full mt-4 border-purple-500/30">
                <Icon name="Share2" size={18} className="mr-2" />
                Пригласить друзей
              </Button>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon name="Trophy" size={20} className="text-accent" />
                Доступные бонусы
              </h3>
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Icon name="Zap" size={24} className="text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium">Ежедневный бонус</p>
                        <p className="text-sm text-muted-foreground">Заходи каждый день</p>
                      </div>
                    </div>
                    <Badge className="gradient-secondary border-0">Скоро</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}