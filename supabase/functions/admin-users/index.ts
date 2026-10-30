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

        // بررسی حداقل طول رمز عبور (حداقل ۶ کاراکتر)
        if (typeof password !== 'string' || password.length < 6) {
          return new Response(
            JSON.stringify({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // بررسی عدم تکراری بودن شماره موبایل در profiles
        const { data: existingPhone } = await adminClient
          .from('profiles')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();

        if (existingPhone) {
          return new Response(
            JSON.stringify({ error: 'شماره موبایل وارد شده قبلاً در سامانه ثبت شده است.' }),
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

        // دریافت پروفایل فعلی کاربر هدف
        const { data: targetProfile, error: targetProfileError } = await adminClient
          .from('profiles')
          .select('id, role, active, phone')
          .eq('id', id)
          .single();

        if (targetProfileError || !targetProfile) {
          return new Response(
            JSON.stringify({ error: 'کاربر مورد نظر یافت نشد.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ۱. بررسی حفاظت از خود مدیر (مدیر نتواند خود را غیرفعال کند یا نقش خود را تغییر دهد)
        if (callerUser.id === id) {
          if (active === false) {
            return new Response(
              JSON.stringify({ error: 'شما نمی‌توانید حساب کاربری خود را غیرفعال نمایید.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (role !== undefined && role !== 'QC_MANAGER') {
            return new Response(
              JSON.stringify({ error: 'شما نمی‌توانید نقش حساب کاربری خود را تغییر دهید.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // ۲. بررسی آخرین QC_MANAGER فعال (نباید آخرین مدیر غیرفعال شود یا نقشش عوض شود)
        if (targetProfile.role === 'QC_MANAGER' && targetProfile.active) {
          const willDeactivate = active === false;
          const willChangeRole = role !== undefined && role !== 'QC_MANAGER';

          if (willDeactivate || willChangeRole) {
            const { count } = await adminClient
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('role', 'QC_MANAGER')
              .eq('active', true);

            if (count !== null && count <= 1) {
              return new Response(
                JSON.stringify({ error: 'امکان غیرفعال‌سازی یا تغییر نقش آخرین مدیر QC فعال در سامانه وجود ندارد.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // ۳. بررسی یکتایی شماره همراه جدید
        if (phone && phone !== targetProfile.phone) {
          const { data: dupPhone } = await adminClient
            .from('profiles')
            .select('id')
            .eq('phone', phone)
            .neq('id', id)
            .maybeSingle();

          if (dupPhone) {
            return new Response(
              JSON.stringify({ error: 'این شماره موبایل متعلق به کاربر دیگری در سامانه است.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // ۴. تشکیل تغییرات فقط بر اساس فیلدهای ارسالی
        const profileUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (name !== undefined) profileUpdates.name = name;
        if (phone !== undefined) profileUpdates.phone = phone;
        if (role !== undefined) profileUpdates.role = role;
        if (avatar !== undefined) profileUpdates.avatar = avatar;
        if (active !== undefined) profileUpdates.active = Boolean(active);

        // ۵. به‌روزرسانی auth.users با بررسی خطا
        const authUpdates: Record<string, any> = {};
        if (phone) authUpdates.email = phoneToEmail(phone);
        if (name !== undefined || phone !== undefined || role !== undefined) {
          authUpdates.user_metadata = {
            ...(name !== undefined ? { name } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(role !== undefined ? { role } : {}),
          };
        }

        if (Object.keys(authUpdates).length > 0) {
          const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, authUpdates);
          if (authUpdateError) {
            return new Response(
              JSON.stringify({ error: `خطا در به‌روزرسانی اطلاعات حساب کاربری: ${authUpdateError.message}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // ۶. به‌روزرسانی جدول profiles
        const { data: updatedProfile, error: updateError } = await adminClient
          .from('profiles')
          .update(profileUpdates)
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

        if (typeof newPassword !== 'string' || newPassword.length < 6) {
          return new Response(
            JSON.stringify({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' }),
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

        // ۱. جلوگیری از حذف حساب کاربری خود مدیر
        if (callerUser.id === id) {
          return new Response(
            JSON.stringify({ error: 'شما نمی‌توانید حساب کاربری خود را حذف کنید.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ۲. دریافت پروفایل کاربر هدف و بررسی آخرین QC_MANAGER فعال
        const { data: targetProfile, error: targetProfileError } = await adminClient
          .from('profiles')
          .select('id, role, active')
          .eq('id', id)
          .single();

        if (targetProfileError || !targetProfile) {
          return new Response(
            JSON.stringify({ error: 'کاربر مورد نظر یافت نشد.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (targetProfile.role === 'QC_MANAGER' && targetProfile.active) {
          const { count } = await adminClient
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'QC_MANAGER')
            .eq('active', true);

          if (count !== null && count <= 1) {
            return new Response(
              JSON.stringify({ error: 'امکان حذف آخرین مدیر QC فعال در سامانه وجود ندارد.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // ۳. حذف کاربر از Supabase Auth با بررسی خطا
        const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(id);
        if (authDeleteError) {
          return new Response(
            JSON.stringify({ error: `خطا در حذف حساب کاربری: ${authDeleteError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ۴. حذف از جدول profiles با بررسی خطا
        const { error: profileDeleteError } = await adminClient.from('profiles').delete().eq('id', id);
        if (profileDeleteError) {
          return new Response(
            JSON.stringify({ error: `خطا در حذف پروفایل پرسنل: ${profileDeleteError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
