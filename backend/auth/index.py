import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import hmac

def handler(event: dict, context) -> dict:
    '''Авторизация пользователя через Telegram WebApp'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        data = json.loads(event.get('body', '{}'))
        telegram_id = data.get('telegram_id')
        username = data.get('username')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        referral_code = data.get('referral_code')
        
        if not telegram_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'telegram_id required'})
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        
        cursor.execute(f'SELECT * FROM {schema}.users WHERE telegram_id = %s', (telegram_id,))
        user = cursor.fetchone()
        
        if not user:
            import secrets
            ref_code = secrets.token_urlsafe(8)
            
            is_admin = username == 'lnvest_Pasive' if username else False
            
            cursor.execute(
                f'''INSERT INTO {schema}.users 
                (telegram_id, username, first_name, last_name, referral_code, is_admin) 
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING *''',
                (telegram_id, username, first_name, last_name, ref_code, is_admin)
            )
            user = cursor.fetchone()
            
            if referral_code:
                cursor.execute(
                    f'SELECT telegram_id FROM {schema}.users WHERE referral_code = %s',
                    (referral_code,)
                )
                referrer = cursor.fetchone()
                
                if referrer:
                    cursor.execute(
                        f'''INSERT INTO {schema}.referrals (referrer_id, referred_id) 
                        VALUES (%s, %s)''',
                        (referrer['telegram_id'], telegram_id)
                    )
                    
                    cursor.execute(
                        f'UPDATE {schema}.users SET referred_by = %s WHERE telegram_id = %s',
                        (referrer['telegram_id'], telegram_id)
                    )
            
            conn.commit()
        
        cursor.execute(
            f'''SELECT 
                u.*,
                (SELECT COUNT(*) FROM {schema}.referrals WHERE referrer_id = u.telegram_id) as referrals_count,
                (SELECT COUNT(*) FROM {schema}.referrals r 
                 JOIN {schema}.deposits d ON r.referred_id = d.user_id 
                 WHERE r.referrer_id = u.telegram_id AND d.status = 'active') as active_referrals,
                (SELECT COALESCE(SUM(earned), 0) FROM {schema}.referrals WHERE referrer_id = u.telegram_id) as referral_earnings
            FROM {schema}.users u
            WHERE u.telegram_id = %s''',
            (telegram_id,)
        )
        user_data = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'user': dict(user_data),
                'token': f'session_{telegram_id}'
            }, default=str)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
