import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''Управление транзакциями: депозиты, выводы, история'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': ''
        }
    
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        
        if method == 'GET':
            user_id = event.get('queryStringParameters', {}).get('user_id')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'user_id required'})
                }
            
            cursor.execute(
                f'''SELECT * FROM {schema}.transactions 
                WHERE user_id = %s 
                ORDER BY created_at DESC LIMIT 50''',
                (user_id,)
            )
            transactions = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'transactions': [dict(t) for t in transactions]}, default=str)
            }
        
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            action = data.get('action')
            user_id = data.get('user_id')
            amount = data.get('amount')
            
            if not all([action, user_id, amount]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'action, user_id, amount required'})
                }
            
            if action == 'deposit':
                cursor.execute(
                    f'''INSERT INTO {schema}.transactions 
                    (user_id, type, amount, status, description) 
                    VALUES (%s, %s, %s, %s, %s) RETURNING *''',
                    (user_id, 'deposit', amount, 'pending', 'Пополнение баланса')
                )
                transaction = cursor.fetchone()
                
            elif action == 'withdraw':
                card_number = data.get('card_number')
                
                cursor.execute(f'SELECT balance FROM {schema}.users WHERE telegram_id = %s', (user_id,))
                user = cursor.fetchone()
                
                if not user or user['balance'] < float(amount):
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Insufficient balance'})
                    }
                
                cursor.execute(
                    f'''INSERT INTO {schema}.transactions 
                    (user_id, type, amount, status, card_number, description) 
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING *''',
                    (user_id, 'withdrawal', amount, 'pending', card_number, 'Вывод средств')
                )
                transaction = cursor.fetchone()
                
            elif action == 'bonus':
                bonus_type = data.get('bonus_type')
                
                cursor.execute(
                    f'''INSERT INTO {schema}.bonuses (user_id, type, amount, completed) 
                    VALUES (%s, %s, %s, %s)''',
                    (user_id, bonus_type, amount, True)
                )
                
                cursor.execute(
                    f'''INSERT INTO {schema}.deposits (user_id, amount, rate, type) 
                    VALUES (%s, %s, %s, %s) RETURNING *''',
                    (user_id, amount, 10.6, 'bonus')
                )
                deposit = cursor.fetchone()
                
                cursor.execute(
                    f'UPDATE {schema}.users SET balance = balance + %s, invested = invested + %s WHERE telegram_id = %s',
                    (amount, amount, user_id)
                )
                
                cursor.execute(
                    f'''INSERT INTO {schema}.transactions 
                    (user_id, type, amount, status, description) 
                    VALUES (%s, %s, %s, %s, %s) RETURNING *''',
                    (user_id, 'bonus', amount, 'completed', f'Бонус: {bonus_type}')
                )
                transaction = cursor.fetchone()
            
            else:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action'})
                }
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'transaction': dict(transaction)}, default=str)
            }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
