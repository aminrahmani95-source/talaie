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
  Sparkles,
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  users: User[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

export const TechniciansManager: React.FC<Props> = ({
  users,
  onSaveUser,
  onDeleteUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('123');
  const [role, setRole] = useState<UserRole>('TECHNICIAN');

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setPhone('');
    setPassword('123');
    setRole('TECHNICIAN');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name.split(' (')[0]);
    setPhone(u.phone);
    setPassword(u.password || '123');
    setRole(u.role);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('لطفاً نام و شماره تلفن را وارد کنید.');
      return;
    }

    const roleTitle =
      role === 'LEAD_TECHNICIAN'
        ? 'سرپرست'
        : role === 'TECHNICIAN'
        ? 'تکنسین'
        : 'مدیر کیوسی';

    const updatedUser: User = {
      id: editingUser ? editingUser.id : `u-${Date.now()}`,
      name: `${name.trim()} (${roleTitle})`,
      phone: phone.trim(),
      password: password.trim() || '123',
      role,
      active: true,
    };

    onSaveUser(updatedUser);
    setIsModalOpen(false);
  };

  const technicianList = users.filter((u) => u.role !== 'QC_MANAGER');
  const leadCount = users.filter((u) => u.role === 'LEAD_TECHNICIAN').length;
  const techCount = users.filter((u) => u.role === 'TECHNICIAN').length;

  return (
    <div className="space-y-6 pb-10">
      {/* Banner in talaei.ir Obsidian & Gold */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#C1A056]/30">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C1A056]" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">مدیریت اعضای اکیپ‌های نصب و تکنسین‌ها</h2>
          </div>
          <p className="text-xs text-[#E8E4DC] mt-1">
            تعریف و ویرایش حساب کاربری (شماره موبایل و رمز عبور) تکنسین‌ها در مجموعه گالری طلایی
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#A88738] hover:to-[#8E712E] text-white rounded-full text-xs font-bold transition shadow-md active:scale-95 min-h-[44px]"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>افزودن تکنسین یا سرپرست جدید</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs">
          <div className="text-xs text-slate-500 dark:text-zinc-400">کل نیروهای اجرایی</div>
          <div className="text-xl font-black text-[#212121] dark:text-white mt-1 font-mono">
            {toPersianDigits(technicianList.length)} نفر
          </div>
        </div>
        <div className="bg-[#FAF7F2] dark:bg-[#202020] rounded-2xl p-4 border border-[#C1A056]/30 shadow-xs">
          <div className="text-xs text-[#A88738] dark:text-[#C1A056] font-bold">سرپرستان اکیپ</div>
          <div className="text-xl font-black text-[#C1A056] mt-1 font-mono">
            {toPersianDigits(leadCount)} نفر
          </div>
        </div>
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-700 dark:text-zinc-300 font-bold">تکنسین‌های همکار</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {toPersianDigits(techCount)} نفر
          </div>
        </div>
      </div>

      {/* Technicians Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {technicianList.map((u) => {
          const isLead = u.role === 'LEAD_TECHNICIAN';

          return (
            <div
              key={u.id}
              className="bg-white dark:bg-[#1C1C1C] rounded-3xl p-5 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs hover:border-[#C1A056]/60 dark:hover:border-[#C1A056]/60 transition space-y-3 relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] dark:bg-[#252525] border border-[#E8E4DC] dark:border-[#333333] flex items-center justify-center font-bold text-sm text-[#C1A056]">
                    {isLead ? (
                      <Shield className="w-6 h-6 text-[#C1A056]" aria-hidden="true" />
                    ) : (
                      <Wrench className="w-6 h-6 text-[#A88738] dark:text-zinc-300" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#212121] dark:text-white">{u.name}</h4>
                    <span
                      className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        isLead
                          ? 'bg-[#C1A056]/20 text-[#A88738] dark:text-[#C1A056]'
                          : 'bg-[#FAF7F2] dark:bg-[#252525] text-slate-700 dark:text-zinc-300 border border-[#E8E4DC] dark:border-[#333333]'
                      }`}
                    >
                      {isLead ? 'سرپرست نصب' : 'تکنسین فنی'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#282828] rounded-lg transition"
                    title="ویرایش حساب"
                    aria-label={`ویرایش حساب ${u.name}`}
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`آیا از حذف حساب ${u.name} اطمینان دارید؟`)) {
                        onDeleteUser(u.id);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    title="حذف حساب"
                    aria-label={`حذف حساب ${u.name}`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="bg-[#FAF7F2] dark:bg-[#222222] rounded-2xl p-3 border border-[#E8E4DC] dark:border-[#333333] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    موبایل (نام کاربری):
                  </span>
                  <span className="font-mono font-bold text-[#212121] dark:text-white" dir="ltr">
                    {u.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    رمز عبور:
                  </span>
                  <span className="font-mono font-bold text-[#212121] dark:text-white" dir="ltr">
                    {u.password || '۱۲۳'}
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
                {editingUser ? 'ویرایش حساب تکنسین' : 'تعریف تکنسین / سرپرست جدید'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition"
                aria-label="بستن پنجره"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="tech-name" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  نام و نام‌خانوادگی:
                </label>
                <input
                  id="tech-name"
                  type="text"
                  required
                  placeholder="مثال: رضا محمدی"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="tech-phone" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  شماره موبایل (جهت ورود):
                </label>
                <input
                  id="tech-phone"
                  type="tel"
                  required
                  placeholder="0912..."
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                  dir="ltr"
                />
              </div>

              <div>
                <label htmlFor="tech-password" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  رمز عبور ورود:
                </label>
                <input
                  id="tech-password"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">نقش در مجموعه:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('LEAD_TECHNICIAN')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center min-h-[44px] ${
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
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center min-h-[44px] ${
                      role === 'TECHNICIAN'
                        ? 'border-[#212121] dark:border-[#C1A056] bg-[#212121] dark:bg-[#252525] text-[#C1A056]'
                        : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#202020]'
                    }`}
                  >
                    تکنسین همکار
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E4DC] dark:border-[#333333] text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#252525] min-h-[44px]"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-[#C1A056]/30 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
                  ذخیره اطلاعات تکنسین
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
