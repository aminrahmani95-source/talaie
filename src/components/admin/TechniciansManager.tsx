import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  Phone,
  Shield,
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
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-sky-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-black">مدیریت اعضای اکیپ‌های نصب و تکنسین‌ها</h2>
          </div>
          <p className="text-xs text-sky-200 mt-1">
            تعریف حساب کاربری (شماره موبایل و رمز عبور) جهت ورود تکنسین‌ها و سرپرستان به سامانه
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-sky-500/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>افزودن تکنسین یا سرپرست جدید</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">کل نیروهای اجرایی</div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono">
            {toPersianDigits(technicianList.length)} نفر
          </div>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 shadow-xs">
          <div className="text-xs text-amber-700 font-bold">سرپرستان اکیپ</div>
          <div className="text-xl font-black text-amber-900 mt-1 font-mono">
            {toPersianDigits(leadCount)} نفر
          </div>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-blue-700 font-bold">تکنسین‌های همکار</div>
          <div className="text-xl font-black text-blue-900 mt-1 font-mono">
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
              className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition space-y-3 relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
                    {u.avatar || '👤'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{u.name}</h4>
                    <span
                      className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isLead
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isLead ? '⭐ سرپرست نصب' : '🔧 تکنسین'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
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
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="حذف حساب"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    موبایل (نام کاربری):
                  </span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
                    {u.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    رمز عبور:
                  </span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
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
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
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
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-mono text-left"
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
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-mono text-left"
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
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/30'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⭐ سرپرست اکیپ
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('TECHNICIAN')}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                      role === 'TECHNICIAN'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-400/30'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🔧 تکنسین همکار
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
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
