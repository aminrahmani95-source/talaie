import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  Phone,
  CheckCircle2,
  X,
  Shield,
  Wrench,
  ShieldCheck,
  Ruler,
  Lock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { toPersianDigits, toEnglishDigits } from '../../utils/jalali';
import { SupabaseSyncService } from '../../utils/supabase';

interface Props {
  users: User[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

type TabFilter = 'ALL' | 'QC_LEADS' | 'CREW_LEADS' | 'CREW';

export const TechniciansManager: React.FC<Props> = ({
  users,
  onSaveUser,
  onDeleteUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('ALL');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('TECHNICIAN');
  const [isActive, setIsActive] = useState<boolean>(true);

  // Async loading & error feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const handleOpenAdd = () => {
    setFeedback(null);
    setModalError(null);
    setEditingUser(null);
    setName('');
    setPhone('');
    setPassword('');
    setRole('TECHNICIAN');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setFeedback(null);
    setModalError(null);
    setEditingUser(u);
    setName(u.name.split(' (')[0]);
    setPhone(u.phone);
    setPassword('');
    setRole(u.role);
    setIsActive(u.active !== false);
    setIsModalOpen(true);
  };

  const handleOpenResetPassword = (u: User) => {
    setFeedback(null);
    setResetError(null);
    setSelectedUserForReset(u);
    setNewPassword('');
    setIsResetPasswordOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFeedback(null);
    setModalError(null);

    const trimmedName = name.trim();
    const trimmedPhone = toEnglishDigits(phone.trim().replace(/\s+/g, ''));

    if (!trimmedName || !trimmedPhone) {
      setModalError('لطفاً نام و شماره تلفن را وارد کنید.');
      return;
    }

    if (!editingUser) {
      if (!password.trim()) {
        setModalError('لطفاً رمز عبور کاربر جدید را تعیین کنید.');
        return;
      }
      if (password.trim().length < 8) {
        setModalError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
        return;
      }
    }

    setIsSubmitting(true);

    const roleTitle =
      role === 'LEAD_TECHNICIAN'
        ? 'سرپرست اکیپ'
        : role === 'TECHNICIAN'
        ? 'تکنسین نصب'
        : 'مسئول QC و فنی';

    const fullName = `${trimmedName} (${roleTitle})`;

    try {
      if (editingUser) {
        // Update user
        const res = await SupabaseSyncService.adminUpdatePersonnel({
          id: editingUser.id,
          name: fullName,
          phone: trimmedPhone,
          role,
          active: isActive,
        });

        if (!res.success) {
          setModalError(res.error || 'خطا در ویرایش اطلاعات پرسنل در دیتابیس.');
          return;
        }

        const updated: User = {
          ...editingUser,
          name: fullName,
          phone: trimmedPhone,
          role,
          active: isActive,
        };
        onSaveUser(updated);
      } else {
        // Create user
        const res = await SupabaseSyncService.adminCreatePersonnel({
          name: fullName,
          phone: trimmedPhone,
          password: toEnglishDigits(password.trim()),
          role,
        });

        if (!res.success) {
          setModalError(res.error || 'خطا در ثبت پرسنل در دیتابیس.');
          return;
        }

        const newUser: User = {
          id: res.data?.user?.id || `u-${Date.now()}`,
          name: fullName,
          phone: trimmedPhone,
          role,
          active: true,
        };
        onSaveUser(newUser);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'خطا در ثبت اطلاعات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedUserForReset || !newPassword.trim()) {
      setResetError('لطفاً رمز عبور جدید را وارد کنید.');
      return;
    }
    if (newPassword.trim().length < 8) {
      setResetError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setResetError(null);

    try {
      const res = await SupabaseSyncService.adminResetPersonnelPassword({
        id: selectedUserForReset.id,
        newPassword: toEnglishDigits(newPassword.trim()),
      });

      if (!res.success) {
        setResetError(res.error || 'خطا در تغییر رمز عبور در سرور.');
      } else {
        alert(`رمز عبور حساب ${selectedUserForReset.name} با موفقیت تغییر یافت.`);
        setIsResetPasswordOpen(false);
      }
    } catch (err: any) {
      setResetError(err.message || 'خطا در تغییر رمز عبور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (deleteLoadingId || isSubmitting) return;

    if (!confirm(`آیا از حذف حساب پرسنلی «${u.name}» از سامانه و دیتابیس اطمینان دارید؟`)) {
      return;
    }

    setDeleteLoadingId(u.id);
    try {
      const res = await SupabaseSyncService.adminDeletePersonnel({
        id: u.id,
      });
      if (!res.success) {
        alert(res.error || 'خطا در حذف پرسنل از دیتابیس.');
        return;
      }
      onDeleteUser(u.id);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف پرسنل.');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const qcLeads = users.filter((u) => u.role === 'QC_MANAGER');
  const crewLeads = users.filter((u) => u.role === 'LEAD_TECHNICIAN');
  const crewMembers = users.filter((u) => u.role === 'TECHNICIAN');

  const filteredUsers =
    tabFilter === 'QC_LEADS'
      ? qcLeads
      : tabFilter === 'CREW_LEADS'
      ? crewLeads
      : tabFilter === 'CREW'
      ? crewMembers
      : users;

  const getRoleBadge = (u: User) => {
    if (u.role === 'QC_MANAGER') {
      return {
        label: 'مسئول فنی و QC',
        classes: 'bg-[#212121] text-[#C1A056] border border-[#C1A056]/40 dark:bg-[#151515]',
        icon: <ShieldCheck className="w-4 h-4 text-[#C1A056]" />,
      };
    }
    if (u.role === 'LEAD_TECHNICIAN') {
      return {
        label: 'سرپرست اکیپ نصب',
        classes: 'bg-[#C1A056]/20 text-[#A88738] dark:text-[#C1A056] border border-[#C1A056]/30',
        icon: <Shield className="w-4 h-4 text-[#C1A056]" />,
      };
    }
    if (u.name.includes('اندازه‌گیری')) {
      return {
        label: 'تیم اندازه‌گیری و اصلاحات',
        classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
        icon: <Ruler className="w-4 h-4 text-blue-500" />,
      };
    }
    return {
      label: 'تکنسین نصب',
      classes: 'bg-[#FAF7F2] dark:bg-[#252525] text-slate-700 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]',
      icon: <Wrench className="w-4 h-4 text-[#A88738] dark:text-zinc-400" />,
    };
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Banner in talaei.ir Obsidian & Gold */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#C1A056]/30">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C1A056]" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">مدیریت پرسنل، سرپرستان و تکنسین‌ها</h2>
          </div>
          <p className="text-xs text-[#E8E4DC] mt-1">
            چارت سازمانی، سرپرستان اکیپ‌های ۴ گانه، مسئولین فنی و تکنسین‌های گالری طلایی
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#A88738] hover:to-[#8E712E] text-white rounded-full text-xs font-bold transition shadow-md active:scale-95 min-h-[44px] cursor-pointer"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>افزودن عضو جدید</span>
        </button>
      </div>

      {/* Stats Summary according to Official Org Chart */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs">
          <div className="text-xs text-slate-500 dark:text-zinc-400">کل اعضای تیم</div>
          <div className="text-xl font-black text-[#212121] dark:text-white mt-1 font-mono">
            {toPersianDigits(users.length)} نفر
          </div>
        </div>

        <div className="bg-[#212121] text-white rounded-2xl p-4 border border-[#C1A056]/40 shadow-xs">
          <div className="text-xs text-[#C1A056] font-bold">مسئولین فنی و QC</div>
          <div className="text-xl font-black text-white mt-1 font-mono">
            {toPersianDigits(qcLeads.length)} نفر
          </div>
        </div>

        <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#C1A056]/30 shadow-xs">
          <div className="text-xs text-[#A88738] dark:text-[#C1A056] font-bold">سرپرستان اکیپ نصب</div>
          <div className="text-xl font-black text-[#C1A056] mt-1 font-mono">
            {toPersianDigits(crewLeads.length)} نفر
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs">
          <div className="text-xs text-slate-700 dark:text-zinc-300 font-bold">تکنسین‌های اجرایی</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {toPersianDigits(crewMembers.length)} نفر
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setTabFilter('ALL')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            tabFilter === 'ALL'
              ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm'
              : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]'
          }`}
        >
          همه پرسنل ({toPersianDigits(users.length)})
        </button>
        <button
          type="button"
          onClick={() => setTabFilter('QC_LEADS')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            tabFilter === 'QC_LEADS'
              ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm'
              : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]'
          }`}
        >
          مسئولین فنی و QC ({toPersianDigits(qcLeads.length)})
        </button>
        <button
          type="button"
          onClick={() => setTabFilter('CREW_LEADS')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            tabFilter === 'CREW_LEADS'
              ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm'
              : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]'
          }`}
        >
          سرپرستان اکیپ ۴ گانه ({toPersianDigits(crewLeads.length)})
        </button>
        <button
          type="button"
          onClick={() => setTabFilter('CREW')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            tabFilter === 'CREW'
              ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm'
              : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]'
          }`}
        >
          تکنسین‌های اجرایی و اندازه‌گیری ({toPersianDigits(crewMembers.length)})
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((u) => {
          const badge = getRoleBadge(u);

          return (
            <div
              key={u.id}
              className="bg-white dark:bg-[#1C1C1C] rounded-3xl p-5 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs hover:border-[#C1A056]/60 dark:hover:border-[#C1A056]/60 transition space-y-3 relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] dark:bg-[#252525] border border-[#E8E4DC] dark:border-[#333333] flex items-center justify-center font-bold text-sm text-[#C1A056]">
                    {badge.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#212121] dark:text-white">{u.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                      {u.active === false ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                          غیرفعال
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          فعال
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#282828] rounded-lg transition cursor-pointer"
                    title="ویرایش حساب"
                    aria-label={`ویرایش حساب ${u.name}`}
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenResetPassword(u)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                    title="تغییر رمز عبور"
                    aria-label={`تغییر رمز عبور ${u.name}`}
                  >
                    <KeyRound className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(deleteLoadingId) || isSubmitting}
                    onClick={() => handleDelete(u)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="حذف حساب"
                    aria-label={`حذف حساب ${u.name}`}
                  >
                    {deleteLoadingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                    ) : (
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-[#FAF7F2] dark:bg-[#222222] rounded-2xl p-3 border border-[#E8E4DC] dark:border-[#333333] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    موبایل سازمانی:
                  </span>
                  <span className="font-mono font-bold text-[#212121] dark:text-white" dir="ltr">
                    {u.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    امنیت حساب:
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    رمز عبور هش‌شده (Supabase Auth)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tech-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-md w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
              <h3 id="tech-modal-title" className="font-bold text-base text-white">
                {editingUser ? 'ویرایش حساب پرسنل' : 'تعریف عضو جدید در سامانه'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition cursor-pointer"
                aria-label="بستن پنجره"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label htmlFor="tech-name" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  نام و نام‌خانوادگی:
                </label>
                <input
                  id="tech-name"
                  type="text"
                  required
                  placeholder="مثال: فرخ نقدعلیان"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="tech-phone" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  شماره موبایل (جهت ورود به سامانه):
                </label>
                <input
                  id="tech-phone"
                  type="tel"
                  required
                  placeholder="09......"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                  dir="ltr"
                />
              </div>

              {!editingUser && (
                <div>
                  <label htmlFor="tech-password" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    رمز عبور اولیه:
                  </label>
                  <input
                    id="tech-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="حداقل ۸ کاراکتر"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                    dir="ltr"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  نقش و سطح دسترسی سازمانی:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('QC_MANAGER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                      role === 'QC_MANAGER'
                        ? 'border-[#C1A056] bg-[#212121] text-[#C1A056] ring-2 ring-[#C1A056]/30'
                        : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#202020]'
                    }`}
                  >
                    مسئول QC و فنی
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('LEAD_TECHNICIAN')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                      role === 'LEAD_TECHNICIAN'
                        ? 'border-[#C1A056] bg-[#FAF7F2] dark:bg-[#252525] text-[#A88738] dark:text-[#C1A056] ring-2 ring-[#C1A056]/30'
                        : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#202020]'
                    }`}
                  >
                    سرپرست اکیپ
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('TECHNICIAN')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                      role === 'TECHNICIAN'
                        ? 'border-[#212121] dark:border-[#C1A056] bg-[#212121] dark:bg-[#252525] text-[#C1A056]'
                        : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#202020]'
                    }`}
                  >
                    تکنسین نصب
                  </button>
                </div>
              </div>

              {editingUser && (
                <div className="pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      وضعیت فعالیت حساب کاربری:
                    </span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 accent-[#C1A056] rounded cursor-pointer"
                    />
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    در صورت غیرفعال شدن، دسترسی کاربر بلافاصله مسدود می‌شود.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#252525] min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-[#C1A056]/30 min-h-[44px] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#C1A056]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
                  )}
                  <span>ذخیره اطلاعات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordOpen && selectedUserForReset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pass-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-sm w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#C1A056]" />
                <h3 id="reset-pass-title" className="font-bold text-sm text-white">
                  تغییر رمز عبور کاربر
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}
              <div className="text-xs text-slate-600 dark:text-zinc-300">
                تنظیم رمز عبور جدید برای:
                <div className="font-bold text-sm text-[#212121] dark:text-white mt-1">
                  {selectedUserForReset.name}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5" dir="ltr">
                  {selectedUserForReset.phone}
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1"
                >
                  رمز عبور جدید:
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="حداقل ۸ کاراکتر"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#252525] min-h-[44px] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#C1A056] to-[#A88738] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                  <span>تأیید و ذخیره رمز</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
