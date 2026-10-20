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
      avatar: role === 'LEAD_TECHNICIAN' ? '🧢' : role === 'TECHNICIAN' ? '🔧' : '👔',
      active: true,
    };

    onSaveUser(updatedUser);
    setIsModalOpen(false);
  };

  const technicianList = users.filter((u) => u.role !== 'QC_MANAGER');
  const leadCount = users.filter((u) => u.role === 'LEAD_TECHNICIAN').length;
  const techCount = users.filter((u) => u.role === 'TECHNICIAN').length;

  return (
    <div className="space-y-6">
      {/* Banner in talaei.ir Obsidian & Gold */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#C1A056]/30">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C1A056]" />
            <h2 className="text-xl font-black text-white">مدیریت اعضای اکیپ‌های نصب و تکنسین‌ها</h2>
          </div>
          <p className="text-xs text-[#E8E4DC] mt-1">
            تعریف و ویرایش حساب کاربری (شماره موبایل و رمز عبور) تکنسین‌ها در مجموعه گالری طلایی
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#A88738] hover:to-[#8E712E] text-white rounded-full text-xs font-bold transition shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>افزودن تکنسین یا سرپرست جدید</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-[#E8E4DC] shadow-xs">
          <div className="text-xs text-slate-500">کل نیروهای اجرایی</div>
          <div className="text-xl font-black text-[#212121] mt-1 font-mono">
            {toPersianDigits(technicianList.length)} نفر
          </div>
        </div>
        <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#C1A056]/30 shadow-xs">
          <div className="text-xs text-[#A88738] font-bold">سرپرستان اکیپ</div>
          <div className="text-xl font-black text-[#C1A056] mt-1 font-mono">
            {toPersianDigits(leadCount)} نفر
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E8E4DC] shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-700 font-bold">تکنسین‌های همکار</div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono">
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
              className="bg-white rounded-3xl p-5 border border-[#E8E4DC] shadow-xs hover:border-[#C1A056]/60 transition space-y-3 relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8E4DC] flex items-center justify-center text-2xl">
                    {u.avatar || '👤'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#212121]">{u.name}</h4>
                    <span
                      className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        isLead
                          ? 'bg-[#C1A056]/20 text-[#A88738]'
                          : 'bg-[#FAF7F2] text-slate-700 border border-[#E8E4DC]'
                      }`}
                    >
                      {isLead ? '⭐ سرپرست نصب' : '🔧 تکنسین'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="p-1.5 text-slate-400 hover:text-[#C1A056] hover:bg-[#FAF7F2] rounded-lg transition"
                    title="ویرایش حساب"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`آیا از حذف حساب ${u.name} اطمینان دارید؟`)) {
                        onDeleteUser(u.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="حذف حساب"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-[#FAF7F2] rounded-2xl p-3 border border-[#E8E4DC] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#C1A056]" />
                    موبایل (نام کاربری):
                  </span>
                  <span className="font-mono font-bold text-[#212121]" dir="ltr">
                    {u.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#C1A056]" />
                    رمز عبور:
                  </span>
                  <span className="font-mono font-bold text-[#212121]" dir="ltr">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#E8E4DC] overflow-hidden">
            <div className="bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
              <h3 className="font-bold text-base text-white">
                {editingUser ? 'ویرایش حساب تکنسین' : 'تعریف تکنسین / سرپرست جدید'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام‌خانوادگی:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: رضا محمدی"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] bg-[#FAF7F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شماره موبایل (جهت ورود):</label>
                <input
                  type="tel"
                  required
                  placeholder="0912..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2]"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رمز عبور ورود:</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] focus:ring-2 focus:ring-[#C1A056] font-mono text-left bg-[#FAF7F2]"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نقش در مجموعه:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('LEAD_TECHNICIAN')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                      role === 'LEAD_TECHNICIAN'
                        ? 'border-[#C1A056] bg-[#FAF7F2] text-[#A88738] ring-2 ring-[#C1A056]/30'
                        : 'border-[#E8E4DC] text-slate-600 hover:bg-[#FAF7F2]'
                    }`}
                  >
                    ⭐ سرپرست اکیپ
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('TECHNICIAN')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                      role === 'TECHNICIAN'
                        ? 'border-[#212121] bg-[#212121] text-[#C1A056]'
                        : 'border-[#E8E4DC] text-slate-600 hover:bg-[#FAF7F2]'
                    }`}
                  >
                    🔧 تکنسین همکار
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E4DC] text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-[#C1A056]/30"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#C1A056]" />
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
