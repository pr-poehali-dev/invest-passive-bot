import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''Админ-панель для управления платежами и пользователями'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Id'
            },
            'body': ''
        }
    
    try:
        admin_id = event.get('headers', {}).get('x-admin-id') or event.get('headers', {}).get('X-Admin-Id')
        
        if not admin_id:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Admin authentication required'})
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        
        cursor.execute(
            f'SELECT is_admin FROM {schema}.users WHERE telegram_id = %s',
            (admin_id,)
        )
        admin = cursor.fetchone()
        
        if not admin or not admin['is_admin']:
            cursor.close()
            conn.close()
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Access denied'})
            }
        
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'dashboard')
            
            if action == 'dashboard':
                cursor.execute(f'SELECT COUNT(*) as total_users FROM {schema}.users')
                total_users = cursor.fetchone()['total_users']
                
                cursor.execute(f'SELECT COALESCE(SUM(balance), 0) as total_balance FROM {schema}.users')
                total_balance = cursor.fetchone()['total_balance']
                
                cursor.execute(
                    f"SELECT COUNT(*) as pending_deposits FROM {schema}.transactions WHERE type = 'deposit' AND status = 'pending'"
                )
                pending_deposits = cursor.fetchone()['pending_deposits']
                
                cursor.execute(
                    f"SELECT COUNT(*) as pending_withdrawals FROM {schema}.transactions WHERE type = 'withdrawal' AND status = 'pending'"
                )
                pending_withdrawals = cursor.fetchone()['pending_withdrawals']
                
                result = {
                    'total_users': total_users,
                    'total_balance': float(total_balance),
                    'pending_deposits': pending_deposits,
                    'pending_withdrawals': pending_withdrawals
                }
                
            elif action == 'pending_transactions':
                cursor.execute(
                    f'''SELECT t.*, u.username, u.first_name, u.last_name 
                    FROM {schema}.transactions t
                    JOIN {schema}.users u ON t.user_id = u.telegram_id
                    WHERE t.status = 'pending'
                    ORDER BY t.created_at DESC'''
                )
                transactions = cursor.fetchall()
                result = {'transactions': [dict(t) for t in transactions]}
            
            elif action == 'users':
                cursor.execute(
                    f'''SELECT * FROM {schema}.users 
                    ORDER BY created_at DESC LIMIT 100'''
                )
                users = cursor.fetchall()
                result = {'users': [dict(u) for u in users]}
            
            else:
                result = {'error': 'Invalid action'}
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result, default=str)
            }
        
        elif method == 'POST':
            data = json.loads(event.get('body', '{}'))
            action = data.get('action')
            
            if action == 'approve_deposit':
                transaction_id = data.get('transaction_id')
                
                cursor.execute(
                    f'SELECT * FROM {schema}.transactions WHERE id = %s',
                    (transaction_id,)
                )
                transaction = cursor.fetchone()
                
                if not transaction:
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Transaction not found'})
                    }
                
                cursor.execute(
                    f'''INSERT INTO {schema}.deposits (user_id, amount, rate, type) 
                    VALUES (%s, %s, %s, %s)''',
                    (transaction['user_id'], transaction['amount'], 10.6, 'manual')
                )
                
                cursor.execute(
                    f'''UPDATE {schema}.users 
                    SET balance = balance + %s, invested = invested + %s, updated_at = CURRENT_TIMESTAMP 
                    WHERE telegram_id = %s''',
                    (transaction['amount'], transaction['amount'], transaction['user_id'])
                )
                
                cursor.execute(
                    f"UPDATE {schema}.transactions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (transaction_id,)
                )
                
                conn.commit()
                result = {'success': True, 'message': 'Deposit approved'}
                
            elif action == 'approve_withdrawal':
                transaction_id = data.get('transaction_id')
                
                cursor.execute(
                    f'SELECT * FROM {schema}.transactions WHERE id = %s',
                    (transaction_id,)
                )
                transaction = cursor.fetchone()
                
                if not transaction:
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Transaction not found'})
                    }
                
                cursor.execute(
                    f'''UPDATE {schema}.users 
                    SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP 
                    WHERE telegram_id = %s''',
                    (transaction['amount'], transaction['user_id'])
                )
                
                cursor.execute(
                    f"UPDATE {schema}.transactions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (transaction_id,)
                )
                
                conn.commit()
                result = {'success': True, 'message': 'Withdrawal approved'}
                
            elif action == 'reject_transaction':
                transaction_id = data.get('transaction_id')
                
                cursor.execute(
                    f"UPDATE {schema}.transactions SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (transaction_id,)
                )
                
                conn.commit()
                result = {'success': True, 'message': 'Transaction rejected'}
            
            else:
                result = {'error': 'Invalid action'}
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result)
            }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
