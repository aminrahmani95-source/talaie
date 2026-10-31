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
  Search,
} from 'lucide-react';
import { toPersianDigits, toEnglishDigits } from '../../utils/jalali';
import { SupabaseSyncService } from '../../utils/supabase';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Sheet } from '../ui/Sheet';
import { getDisplayName } from '../../utils/technicianName';

export { getDisplayName };

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleOpenAdd = () => {
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
    setModalError(null);
    setEditingUser(u);
    setName(getDisplayName(u.name));
    setPhone(u.phone);
    setPassword('');
    setRole(u.role);
    setIsActive(u.active !== false);
    setIsModalOpen(true);
  };

  const handleOpenResetPassword = (u: User) => {
    setResetError(null);
    setSelectedUserForReset(u);
    setNewPassword('');
    setIsResetPasswordOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

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
    const plainName = getDisplayName(trimmedName);

    try {
      if (editingUser) {
        const res = await SupabaseSyncService.adminUpdatePersonnel({
          id: editingUser.id,
          name: plainName,
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
          name: plainName,
          phone: trimmedPhone,
          role,
          active: isActive,
        };
        onSaveUser(updated);
      } else {
        const res = await SupabaseSyncService.adminCreatePersonnel({
          name: plainName,
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
          name: plainName,
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
    setResetError(null);

    try {
      const res = await SupabaseSyncService.adminResetPersonnelPassword({
        id: selectedUserForReset.id,
        newPassword: toEnglishDigits(newPassword.trim()),
      });

      if (!res.success) {
        setResetError(res.error || 'خطا در تغییر رمز عبور در سرور.');
      } else {
        alert(`رمز عبور حساب ${getDisplayName(selectedUserForReset.name)} با موفقیت تغییر یافت.`);
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

    if (!confirm(`آیا از حذف حساب پرسنلی «${getDisplayName(u.name)}» اطمینان دارید؟`)) {
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

  const filteredByRole =
    tabFilter === 'QC_LEADS'
      ? qcLeads
      : tabFilter === 'CREW_LEADS'
      ? crewLeads
      : tabFilter === 'CREW'
      ? crewMembers
      : users;

  const filteredUsers = filteredByRole.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return u.name.toLowerCase().includes(q) || u.phone.includes(q);
  });

  const getRoleBadge = (u: User) => {
    if (u.role === 'QC_MANAGER') {
      return {
        label: 'مسئول QC و فنی',
        classes: 'bg-[#212121] text-[#E5CA8F]',
      };
    }
    if (u.role === 'LEAD_TECHNICIAN') {
      return {
        label: 'سرپرست اکیپ نصب',
        classes: 'bg-[#C1A056]/20 text-[#8E6F27] dark:text-[#E5CA8F]',
      };
    }
    return {
      label: 'تکنسین نصب',
      classes: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
    };
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Page Header */}
      <PageHeader
        title="پرسنل و دسترسی‌ها"
        subtitle="مدیریت حساب‌های کاربری، تعیین نقش‌ها و بازنشانی رمز عبور"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            icon={<UserPlus className="w-4 h-4" />}
          >
            عضو جدید
          </Button>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#69655F] dark:text-[#9E988D]">کل اعضا</div>
          <div className="text-xl font-black text-[#181818] dark:text-white mt-1 font-mono">
            {toPersianDigits(users.length)} نفر
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-bold">مسئولین QC</div>
          <div className="text-xl font-black text-[#181818] dark:text-white mt-1 font-mono">
            {toPersianDigits(qcLeads.length)} نفر
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-bold">سرپرستان اکیپ</div>
          <div className="text-xl font-black text-[#181818] dark:text-white mt-1 font-mono">
            {toPersianDigits(crewLeads.length)} نفر
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3.5 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs">
          <div className="text-xs text-[#69655F] dark:text-[#9E988D]">تکنسین‌های نصب</div>
          <div className="text-xl font-black text-[#181818] dark:text-white mt-1 font-mono">
            {toPersianDigits(crewMembers.length)} نفر
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SegmentedControl
          options={[
            { id: 'ALL', label: 'همه', badge: users.length },
            { id: 'QC_LEADS', label: 'مسئولین QC', badge: qcLeads.length },
            { id: 'CREW_LEADS', label: 'سرپرستان', badge: crewLeads.length },
            { id: 'CREW', label: 'تکنسین‌ها', badge: crewMembers.length },
          ]}
          value={tabFilter}
          onChange={(val) => setTabFilter(val as TabFilter)}
          size="sm"
        />

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#8A857B] absolute right-3 top-3" />
          <input
            type="text"
            placeholder="جستجوی نام یا تلفن..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pr-9 pl-3 py-2 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-[#181818] dark:text-white"
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredUsers.map((u) => {
          const badge = getRoleBadge(u);

          return (
            <div
              key={u.id}
              className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E2DDD4] dark:border-[#2C2C2C] shadow-2xs hover:border-[#C1A056]/60 transition space-y-3 relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={getDisplayName(u.name)} id={u.id} size="lg" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#181818] dark:text-white truncate">
                      {getDisplayName(u.name)}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.classes}`}>
                        {badge.label}
                      </span>
                      {u.active === false ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          غیرفعال
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          فعال
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="w-8 h-8 flex items-center justify-center text-[#69655F] dark:text-[#9E988D] hover:text-[#8E6F27] dark:hover:text-[#E5CA8F] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                    title="ویرایش حساب"
                    aria-label={`ویرایش حساب ${getDisplayName(u.name)}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenResetPassword(u)}
                    className="w-8 h-8 flex items-center justify-center text-[#69655F] dark:text-[#9E988D] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                    title="تغییر رمز عبور"
                    aria-label={`تغییر رمز عبور ${getDisplayName(u.name)}`}
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(deleteLoadingId) || isSubmitting}
                    onClick={() => handleDelete(u)}
                    className="w-8 h-8 flex items-center justify-center text-[#69655F] dark:text-[#9E988D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="حذف حساب"
                    aria-label={`حذف حساب ${getDisplayName(u.name)}`}
                  >
                    {deleteLoadingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-[#FAF7F2] dark:bg-[#141414] rounded-xl p-2.5 border border-[#E2DDD4] dark:border-[#282828] text-xs">
                <div className="flex items-center justify-between text-[#69655F] dark:text-[#9E988D]">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#8E6F27] dark:text-[#E5CA8F]" />
                    <span>موبایل سازمانی:</span>
                  </span>
                  <span className="font-mono font-bold text-[#181818] dark:text-white" dir="ltr">
                    {u.phone}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Sheet */}
      <Sheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'ویرایش حساب پرسنل' : 'تعریف عضو جدید در سامانه'}
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label htmlFor="tech-name" className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
              نام و نام‌خانوادگی:
            </label>
            <input
              id="tech-name"
              type="text"
              required
              placeholder="مثال: فرخ نقدعلیان"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] bg-white dark:bg-[#141414] dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="tech-phone" className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
              شماره موبایل:
            </label>
            <input
              id="tech-phone"
              type="tel"
              required
              placeholder="09......"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] font-mono text-left bg-white dark:bg-[#141414] dark:text-white"
              dir="ltr"
            />
          </div>

          {!editingUser && (
            <div>
              <label htmlFor="tech-password" className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
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
                className="w-full text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] font-mono text-left bg-white dark:bg-[#141414] dark:text-white"
                dir="ltr"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1.5">
              نقش سازمانی:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('QC_MANAGER')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'QC_MANAGER'
                    ? 'border-[#C1A056] bg-[#212121] text-[#E5CA8F]'
                    : 'border-[#E2DDD4] dark:border-[#2C2C2C] text-[#69655F] dark:text-[#9E988D]'
                }`}
              >
                مسئول QC
              </button>
              <button
                type="button"
                onClick={() => setRole('LEAD_TECHNICIAN')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'LEAD_TECHNICIAN'
                    ? 'border-[#C1A056] bg-[#FAF7F2] dark:bg-[#202020] text-[#8E6F27] dark:text-[#E5CA8F]'
                    : 'border-[#E2DDD4] dark:border-[#2C2C2C] text-[#69655F] dark:text-[#9E988D]'
                }`}
              >
                سرپرست اکیپ
              </button>
              <button
                type="button"
                onClick={() => setRole('TECHNICIAN')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'TECHNICIAN'
                    ? 'border-[#212121] dark:border-[#C1A056] bg-[#212121] dark:bg-[#202020] text-[#E5CA8F]'
                    : 'border-[#E2DDD4] dark:border-[#2C2C2C] text-[#69655F] dark:text-[#9E988D]'
                }`}
              >
                تکنسین نصب
              </button>
            </div>
          </div>

          {editingUser && (
            <div className="pt-2 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF]">
                  وضعیت فعالیت حساب:
                </span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#C1A056] rounded cursor-pointer"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={isSubmitting}
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              انصراف
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="flex-1"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              ذخیره اطلاعات
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Reset Password Sheet */}
      <Sheet
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        title="تغییر رمز عبور کاربر"
      >
        {selectedUserForReset && (
          <form onSubmit={handleConfirmResetPassword} className="p-4 space-y-4">
            {resetError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}
            <div className="text-xs text-[#69655F] dark:text-[#9E988D]">
              تنظیم رمز عبور جدید برای:
              <div className="font-bold text-sm text-[#181818] dark:text-white mt-1">
                {getDisplayName(selectedUserForReset.name)}
              </div>
              <div className="text-[11px] font-mono mt-0.5" dir="ltr">
                {selectedUserForReset.phone}
              </div>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-[#4A4742] dark:text-[#BDB8AF] mb-1">
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
                className="w-full text-sm p-2.5 rounded-xl border border-[#E2DDD4] dark:border-[#2C2C2C] font-mono text-left bg-white dark:bg-[#141414] dark:text-white"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#E2DDD4] dark:border-[#2C2C2C]">
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={isSubmitting}
                onClick={() => setIsResetPasswordOpen(false)}
                className="flex-1"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="flex-1"
              >
                تأیید و ذخیره رمز
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
};
