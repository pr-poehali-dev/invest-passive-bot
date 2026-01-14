import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.request
import urllib.error

def handler(event: dict, context) -> dict:
    '''Проверка вступления пользователя в Telegram чат и начисление бонуса'''
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
        user_id = data.get('user_id')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'user_id required'})
            }
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        chat_id = '@invest_passive_chat'
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        
        cursor.execute(
            f"SELECT * FROM {schema}.bonuses WHERE user_id = %s AND type = 'chat_join' AND completed = TRUE",
            (user_id,)
        )
        already_received = cursor.fetchone()
        
        if already_received:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'is_member': True, 'bonus_already_received': True})
            }
        
        try:
            url = f'https://api.telegram.org/bot{bot_token}/getChatMember?chat_id={chat_id}&user_id={user_id}'
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode())
                
                if result.get('ok'):
                    member_status = result.get('result', {}).get('status')
                    is_member = member_status in ['member', 'administrator', 'creator']
                    
                    if is_member:
                        bonus_amount = 100
                        
                        cursor.execute(
                            f'''INSERT INTO {schema}.bonuses (user_id, type, amount, completed) 
                            VALUES (%s, %s, %s, %s)''',
                            (user_id, 'chat_join', bonus_amount, True)
                        )
                        
                        cursor.execute(
                            f'''INSERT INTO {schema}.deposits (user_id, amount, rate, type) 
                            VALUES (%s, %s, %s, %s)''',
                            (user_id, bonus_amount, 10.6, 'bonus')
                        )
                        
                        cursor.execute(
                            f'UPDATE {schema}.users SET balance = balance + %s, invested = invested + %s WHERE telegram_id = %s',
                            (bonus_amount, bonus_amount, user_id)
                        )
                        
                        cursor.execute(
                            f'''INSERT INTO {schema}.transactions (user_id, type, amount, status, description) 
                            VALUES (%s, %s, %s, %s, %s)''',
                            (user_id, 'bonus', bonus_amount, 'completed', 'Бонус за вступление в чат')
                        )
                        
                        conn.commit()
                        
                        cursor.close()
                        conn.close()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'is_member': True,
                                'bonus_received': True,
                                'amount': bonus_amount
                            })
                        }
                    else:
                        cursor.close()
                        conn.close()
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'is_member': False})
                        }
                else:
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Failed to check membership'})
                    }
        except urllib.error.URLError as e:
            cursor.close()
            conn.close()
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Telegram API error: {str(e)}'})
            }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
