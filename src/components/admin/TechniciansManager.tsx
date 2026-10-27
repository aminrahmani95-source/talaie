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
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('ALL');

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
        ? 'سرپرست اکیپ'
        : role === 'TECHNICIAN'
        ? 'تکنسین نصب'
        : 'مسئول QC و فنی';

    const updatedUser: User = {
      id: editingUser ? editingUser.id : `u-${Date.now()}`,
      name: `${name.trim()} (${roleTitle})`,
      phone: phone.trim().replace(/\s+/g, ''),
      password: password.trim() || '123',
      role,
      active: true,
    };

    onSaveUser(updatedUser);
    setIsModalOpen(false);
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
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
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
                    <span
                      className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold ${badge.classes}`}
                    >
                      {badge.label}
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
                  {u.phone !== '09124339038' && (
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
                  )}
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
                    {u.password || '123'}
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
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  نقش و سطح دسترسی سازمانی:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('QC_MANAGER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] ${
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
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] ${
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
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-center min-h-[44px] ${
                      role === 'TECHNICIAN'
                        ? 'border-[#212121] dark:border-[#C1A056] bg-[#212121] dark:bg-[#252525] text-[#C1A056]'
                        : 'border-[#E8E4DC] dark:border-[#333333] text-slate-600 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#202020]'
                    }`}
                  >
                    تکنسین نصب
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
                  ذخیره اطلاعات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
