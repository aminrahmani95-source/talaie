// ==============================================================================
// گالری طلایی | Supabase Edge Function: admin-users
// مدیریت پرسنل و دسترسی‌ها با کلید Service Role تحت کنترل مدیر QC
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@talaie.local`;
}

serve(async (req: Request) => {
  // ۱. مدیریت درخواست‌های پیش‌پرواز CORS (Pre-flight OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'تنظیمات محیطی سرور Supabase کامل نیست.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ۲. بررسی هدر احراز هویت (Authorization Bearer Token)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'توکن دسترسی کاربر ارسال نشده است.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ایجاد کلاینت با توکن کاربر جهت تشخیص هویت فراخواننده
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'توکن کاربر نامعتبر یا منقضی شده است.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ایجاد کلاینت ادمین با کلید Service Role
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // ۳. بررسی نقش فراخواننده در جدول profiles (فقط QC_MANAGER فعال مجاز است)
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, role, active')
      .eq('id', callerUser.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'پروفایل کاربر فراخواننده در سامانه یافت نشد.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.role !== 'QC_MANAGER' || !callerProfile.active) {
      return new Response(
        JSON.stringify({ error: 'شما دسترسی لازم (مدیریت QC) برای مدیریت پرسنل را ندارید.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ۴. دریافت بدنه درخواست و اجرای عملیات درخواستی
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // الف) ایجاد کاربر جدید در auth.users و profiles
      case 'create': {
        const { name, phone, password, role, avatar } = body;
        if (!name || !phone || !password || !role) {
          return new Response(
            JSON.stringify({ error: 'نام، شماره موبایل، رمز عبور و نقش پرسنلی الزامی هستند.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const email = phoneToEmail(phone);

        // ایجاد حساب در Supabase Auth
        const { data: authCreated, error: authCreateError } =
          await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, phone, role },
          });

        if (authCreateError) {
          return new Response(
            JSON.stringify({ error: `خطا در ایجاد حساب کاربری: ${authCreateError.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newUserId = authCreated.user.id;

        // ثبت پروفایل در جدول profiles
        const { data: profileCreated, error: profileCreateError } = await adminClient
          .from('profiles')
          .upsert({
            id: newUserId,
            name,
            phone,
            role,
            avatar: avatar || null,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (profileCreateError) {
          // در صورت بروز خطا در ثبت پروفایل، کاربر Auth را حذف می‌کنیم تا داده هرز نماند
          await adminClient.auth.admin.deleteUser(newUserId);
          return new Response(
            JSON.stringify({ error: `خطا در ثبت پروفایل پرسنل: ${profileCreateError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, user: profileCreated }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ب) به‌روزرسانی اطلاعات پرسنل
      case 'update': {
        const { id, name, phone, role, avatar, active } = body;
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'شناسه کاربر الزامی است.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // اگر شماره موبایل تغییر کرده باشد، ایمیل auth.users را هم به‌روز می‌کنیم
        if (phone) {
          const email = phoneToEmail(phone);
          await adminClient.auth.admin.updateUserById(id, {
            email,
            user_metadata: { name, phone, role },
          });
        }

        const { data: updatedProfile, error: updateError } = await adminClient
          .from('profiles')
          .update({
            name,
            phone,
            role,
            avatar: avatar !== undefined ? avatar : null,
            active: active !== undefined ? Boolean(active) : true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, user: updatedProfile }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ج) ریست / تغییر رمز عبور کاربر
      case 'reset-password': {
        const { id, newPassword } = body;
        if (!id || !newPassword) {
          return new Response(
            JSON.stringify({ error: 'شناسه کاربر و رمز عبور جدید الزامی هستند.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: resetError } = await adminClient.auth.admin.updateUserById(id, {
          password: newPassword,
        });

        if (resetError) {
          return new Response(
            JSON.stringify({ error: `خطا در تغییر رمز عبور: ${resetError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'رمز عبور کاربر با موفقیت به‌روزرسانی شد.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // د) حذف کاربر از auth.users و profiles
      case 'delete': {
        const { id } = body;
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'شناسه کاربر جهت حذف الزامی است.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // حذف از auth.users (به دلیل cascade، پروفایل هم حذف می‌شود یا مستقیم حذف می‌کنیم)
        await adminClient.auth.admin.deleteUser(id);
        await adminClient.from('profiles').delete().eq('id', id);

        return new Response(
          JSON.stringify({ success: true, message: 'کاربر با موفقیت حذف گردید.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `عملیات ${action} پشتیبانی نمی‌شود.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'خطای غیرمنتظره در سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
