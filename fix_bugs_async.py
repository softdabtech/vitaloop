#!/usr/bin/env python3
"""
Fix VITALOOP bugs using Supabase Admin API:
1. Set is_super_admin for bombela1988@gmail.com
2. Check and fix subscription for a@a.com
"""

import os
import sys
import json
import httpx
from datetime import datetime

async def main():
    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    admin_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not admin_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
        print("   Set these from your .env.local or .env file")
        sys.exit(1)
    
    # Remove trailing slash
    supabase_url = supabase_url.rstrip('/')
    
    print(f"🔌 Using Supabase: {supabase_url}")
    print(f"🔑 Admin key set: {admin_key[:10]}...{admin_key[-10:]}")
    
    async with httpx.AsyncClient() as client:
        # ========== FIX #1: Set super_admin flag ==========
        print("\n" + "="*60)
        print("FIX #1: Set is_super_admin for bombela1988@gmail.com")
        print("="*60)
        
        try:
            # Find user by email
            print("\n1️⃣  Finding user...")
            search_url = f"{supabase_url}/rest/v1/auth_users?email=eq.bombela1988@gmail.com"
            
            headers = {
                "Authorization": f"Bearer {admin_key}",
                "apikey": admin_key,
                "Content-Type": "application/json"
            }
            
            response = await client.get(search_url, headers=headers)
            print(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                users = response.json()
                if users:
                    user = users[0]
                    user_id = user.get('id')
                    app_meta = user.get('raw_app_meta_data') or {}
                    print(f"   ✅ User found: {user_id}")
                    print(f"   Current is_super_admin: {app_meta.get('is_super_admin', False)}")
                    
                    if not app_meta.get('is_super_admin'):
                        print("\n2️⃣  Setting is_super_admin = true...")
                        app_meta['is_super_admin'] = True
                        
                        # Use admin API to update
                        update_url = f"{supabase_url}/auth/v1/admin/users/{user_id}"
                        update_data = {
                            "app_metadata": app_meta
                        }
                        
                        update_response = await client.put(
                            update_url,
                            json=update_data,
                            headers={
                                "Authorization": f"Bearer {admin_key}",
                                "apikey": admin_key,
                                "Content-Type": "application/json"
                            }
                        )
                        
                        print(f"   API response: {update_response.status_code}")
                        if update_response.status_code in [200, 201]:
                            result = update_response.json()
                            print(f"   ✅ SUCCESS - is_super_admin flag set!")
                            print(f"   Updated metadata: {result.get('app_metadata', {})}")
                        else:
                            print(f"   Response: {update_response.text}")
                    else:
                        print("   ✅ Already set - no changes needed")
                else:
                    print("   ❌ User not found")
            else:
                print(f"   ❌ Error: {response.status_code}")
                print(f"   Response: {response.text}")
        
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # ========== FIX #2: Check and fix subscription ==========
        print("\n" + "="*60)
        print("FIX #2: Check and fix subscription for a@a.com")
        print("="*60)
        
        try:
            # Find user
            print("\n1️⃣  Finding user a@a.com...")
            user_url = f"{supabase_url}/rest/v1/auth_users?email=eq.a@a.com"
            user_response = await client.get(user_url, headers=headers)
            
            if user_response.status_code == 200:
                users = user_response.json()
                if users:
                    user_id = users[0]['id']
                    print(f"   ✅ User found: {user_id}")
                    
                    # Check subscription
                    print("\n2️⃣  Checking subscription...")
                    sub_url = f"{supabase_url}/rest/v1/subscriptions?user_id=eq.{user_id}&order=updated_at.desc&limit=1"
                    sub_response = await client.get(sub_url, headers=headers)
                    
                    if sub_response.status_code == 200:
                        subs = sub_response.json()
                        if subs:
                            sub = subs[0]
                            print(f"   Status: {sub.get('status')}")
                            print(f"   Plan: {sub.get('plan_name')}")
                            print(f"   Cancel at period end: {sub.get('cancel_at_period_end')}")
                            print(f"   Updated: {sub.get('updated_at')}")
                            
                            # Check if needs fixing
                            needs_fix = (
                                sub.get('status') != 'active' or
                                sub.get('plan_name') == 'free' or
                                sub.get('cancel_at_period_end') == True
                            )
                            
                            if needs_fix:
                                print("\n3️⃣  ⚠️  Subscription needs fixing...")
                                print(f"   Updating subscription {sub.get('id')}...")
                                
                                update_url = f"{supabase_url}/rest/v1/subscriptions?id=eq.{sub.get('id')}"
                                update_data = {
                                    'status': 'active',
                                    'plan_name': 'premium',
                                    'cancel_at_period_end': False,
                                    'updated_at': datetime.utcnow().isoformat() + 'Z'
                                }
                                
                                update_response = await client.patch(update_url, json=update_data, headers=headers)
                                print(f"   API response: {update_response.status_code}")
                                
                                if update_response.status_code in [200, 201]:
                                    print("   ✅ SUCCESS - Subscription fixed!")
                                else:
                                    print(f"   Response: {update_response.text}")
                            else:
                                print("   ✅ Subscription looks good - no changes needed")
                        else:
                            print("   ℹ️  No subscription found - user might be on free plan")
                    else:
                        print(f"   ❌ Error checking subscription: {sub_response.status_code}")
                else:
                    print("   ❌ User not found")
            else:
                print(f"   ❌ Error: {user_response.status_code}")
        
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
        
        print("\n" + "="*60)
        print("✅ Fix script completed")
        print("="*60)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
