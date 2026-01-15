-- Добавление новых полей для разделения балансов
ALTER TABLE users ADD COLUMN IF NOT EXISTS earned_balance DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_number VARCHAR(20);

-- Обновление существующих пользователей: текущий balance становится earned_balance
UPDATE users SET earned_balance = balance WHERE earned_balance = 0;

COMMENT ON COLUMN users.balance IS 'Пополненный баланс (не начисляет проценты)';
COMMENT ON COLUMN users.earned_balance IS 'Заработанный баланс (начисляет проценты и доступен для вывода)';
COMMENT ON COLUMN users.invested IS 'Вложенная сумма (начисляет проценты)';
COMMENT ON COLUMN users.card_number IS 'Номер карты для вывода средств';
