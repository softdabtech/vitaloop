#!/usr/bin/env python3
"""
Fix VITALOOP bugs:
1. Set is_super_admin for bombela1988@gmail.com
2. Check and fix subscription for a@a.com
"""

import os
import sys
import json
from supabase import create_client

def main():
    # Get Supabase credentials from environment
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
        print("   Set these from your .env.local or .env file")
        sys.exit(1)
    
    print(f"🔌 Connecting to Supabase: {supabase_url}")
    supabase = create_client(supabase_url, supabase_key)
    
    # ========== FIX #1: Set super_admin flag ==========
    print("\n" + "="*60)
    print("FIX #1: Set is_super_admin for bombela1988@gmail.com")
    print("="*60)
    
    try:
        # Check current status
        print("\n1️⃣  Checking current status...")
        result = supabase.table('auth_users').select('*').eq('email', 'bombela1988@gmail.com').execute()
        
        if not result.data:
            print("❌ User not found: bombela1988@gmail.com")
        else:
            user = result.data[0]
            user_id = user.get('id')
            app_meta = user.get('raw_app_meta_data') or {}
            print(f"   User ID: {user_id}")
            print(f"   Current is_super_admin: {app_meta.get('is_super_admin', False)}")
            
            if app_meta.get('is_super_admin'):
                print("   ✅ Already set - no changes needed")
            else:
                print("\n2️⃣  Setting is_super_admin = true...")
                
                # Update metadata
                app_meta['is_super_admin'] = True
                update_result = supabase.table('auth_users').update({
                    'raw_app_meta_data': app_meta
                }).eq('id', user_id).execute()
                
                if update_result.data:
                    print("   ✅ SUCCESS - is_super_admin flag set!")
                    new_meta = update_result.data[0].get('raw_app_meta_data', {})
                    print(f"   New is_super_admin: {new_meta.get('is_super_admin')}")
                else:
                    print("   ❌ Failed to update")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # ========== FIX #2: Check and fix subscription ==========
    print("\n" + "="*60)
    print("FIX #2: Check subscription for a@a.com")
    print("="*60)
    
    try:
        # Find user
        print("\n1️⃣  Finding user a@a.com...")
        user_result = supabase.table('auth_users').select('id').eq('email', 'a@a.com').execute()
        
        if not user_result.data:
            print("❌ User not found: a@a.com")
        else:
            user_id = user_result.data[0]['id']
            print(f"   User ID: {user_id}")
            
            # Check subscription
            print("\n2️⃣  Checking subscription...")
            sub_result = supabase.table('subscriptions')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('updated_at', desc=True)\
                .limit(1)\
                .execute()
            
            if not sub_result.data:
                print("   ⚠️  No subscription found - user is Free")
                print("   Action: Create premium subscription if needed")
            else:
                sub = sub_result.data[0]
                print(f"   Status: {sub.get('status')}")
                print(f"   Plan: {sub.get('plan_name')}")
                print(f"   Cancel at period end: {sub.get('cancel_at_period_end')}")
                print(f"   Current period end: {sub.get('current_period_end')}")
                print(f"   Updated: {sub.get('updated_at')}")
                
                # Check if needs fixing
                needs_fix = (
                    sub.get('status') != 'active' or
                    sub.get('plan_name') == 'free' or
                    sub.get('cancel_at_period_end') == True
                )
                
                if needs_fix:
                    print("\n3️⃣  ⚠️  Subscription needs fixing...")
                    print("   Status before: ", {
                        'status': sub.get('status'),
                        'plan_name': sub.get('plan_name'),
                        'cancel_at_period_end': sub.get('cancel_at_period_end')
                    })
                    
                    print("\n4️⃣  Fixing subscription...")
                    fix_result = supabase.table('subscriptions').update({
                        'status': 'active',
                        'plan_name': 'premium',
                        'cancel_at_period_end': False,
                        'updated_at': datetime.now().isoformat()
                    }).eq('id', sub.get('id')).execute()
                    
                    if fix_result.data:
                        fixed = fix_result.data[0]
                        print("   ✅ SUCCESS - Subscription fixed!")
                        print("   Status after: ", {
                            'status': fixed.get('status'),
                            'plan_name': fixed.get('plan_name'),
                            'cancel_at_period_end': fixed.get('cancel_at_period_end')
                        })
                    else:
                        print("   ❌ Failed to update subscription")
                else:
                    print("   ✅ Subscription looks good - no changes needed")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("✅ Fix script completed")
    print("="*60)

if __name__ == '__main__':
    from datetime import datetime
    main()
