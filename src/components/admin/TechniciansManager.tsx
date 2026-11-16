import React, { useState } from 'react';
import { User, UserRole, InstallationTeam, TeamMember } from '../../types';
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
  Building2,
  UserCheck,
  UserMinus,
  Sparkles,
  ClipboardList,
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
  teams?: InstallationTeam[];
  teamMembers?: TeamMember[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onAssignTeamMember?: (teamId: string, userId: string, roleInTeam: 'LEAD' | 'TECHNICIAN') => Promise<{ success: boolean; error?: string }>;
  onRemoveTeamMember?: (userId: string) => Promise<{ success: boolean; error?: string }>;
}

type TabFilter = 'ALL' | 'QC_LEADS' | 'COORDINATORS' | 'CREW_LEADS' | 'CREW' | 'OFFICE';
type MainSection = 'PERSONNEL' | 'TEAMS';

export const TechniciansManager: React.FC<Props> = ({
  users,
  teams,
  teamMembers,
  onSaveUser,
  onDeleteUser,
  onAssignTeamMember,
  onRemoveTeamMember,
}) => {
  const [mainSection, setMainSection] = useState<MainSection>('PERSONNEL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Team action states
  const [teamActionLoading, setTeamActionLoading] = useState(false);
  const [teamActionError, setTeamActionError] = useState<string | null>(null);
  const [selectedTechToAdd, setSelectedTechToAdd] = useState<{ [teamId: string]: string }>({});
  const [selectedLeadToAdd, setSelectedLeadToAdd] = useState<{ [teamId: string]: string }>({});

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
        setModalError('رمز عبور باید حداقل 8 کاراکتر باشد.');
        return;
      }
    }

    setIsSubmitting(true);
    const plainName = getDisplayName(trimmedName);

    try {
      if (editingUser) {
        try {
          const res = await SupabaseSyncService.adminUpdatePersonnel({
            id: editingUser.id,
            name: plainName,
            phone: trimmedPhone,
            role,
            active: isActive,
          });

          if (!res.success && res.error) {
            console.warn('Supabase remote personnel update notice:', res.error);
          }
        } catch (e: any) {
          console.warn('Supabase adminUpdatePersonnel background sync error:', e);
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
        let newId = `u-${Date.now()}`;
        try {
          const res = await SupabaseSyncService.adminCreatePersonnel({
            name: plainName,
            phone: trimmedPhone,
            password: toEnglishDigits(password.trim()),
            role,
          });

          if (res.success && res.data?.user?.id) {
            newId = res.data.user.id;
          } else if (!res.success && res.error) {
            console.warn('Supabase remote personnel create notice:', res.error);
          }
        } catch (e: any) {
          console.warn('Supabase adminCreatePersonnel background sync error:', e);
        }

        const newUser: User = {
          id: newId,
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
      setResetError('رمز عبور باید حداقل 8 کاراکتر باشد.');
      return;
    }

    setIsSubmitting(true);
    setResetError(null);

    try {
      try {
        const res = await SupabaseSyncService.adminResetPersonnelPassword({
          id: selectedUserForReset.id,
          newPassword: toEnglishDigits(newPassword.trim()),
        });

        if (!res.success && res.error) {
          console.warn('Supabase remote password reset notice:', res.error);
        }
      } catch (e: any) {
        console.warn('Supabase adminResetPersonnelPassword background sync error:', e);
      }

      alert(`رمز عبور حساب ${getDisplayName(selectedUserForReset.name)} با موفقیت تغییر یافت.`);
      setIsResetPasswordOpen(false);
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
      try {
        const res = await SupabaseSyncService.adminDeletePersonnel({
          id: u.id,
        });
        if (!res.success && res.error) {
          console.warn('Supabase remote personnel delete notice:', res.error);
        }
      } catch (e: any) {
        console.warn('Supabase adminDeletePersonnel background sync error:', e);
      }
      onDeleteUser(u.id);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف پرسنل.');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const qcLeads = users.filter((u) => u.role === 'QC_MANAGER');
  const coordinators = users.filter((u) => u.role === 'SCHEDULING_COORDINATOR');
  const crewLeads = users.filter((u) => u.role === 'LEAD_TECHNICIAN');
  const crewMembers = users.filter((u) => u.role === 'TECHNICIAN');
  const officePersonnel = users.filter((u) =>
    ['CEO', 'SALES', 'MEASUREMENT_LEAD', 'WAREHOUSE'].includes(u.role)
  );

  const filteredByRole =
    tabFilter === 'QC_LEADS'
      ? qcLeads
      : tabFilter === 'COORDINATORS'
      ? coordinators
      : tabFilter === 'CREW_LEADS'
      ? crewLeads
      : tabFilter === 'CREW'
      ? crewMembers
      : tabFilter === 'OFFICE'
      ? officePersonnel
      : users;

  const filteredUsers = filteredByRole.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return u.name.toLowerCase().includes(q) || u.phone.includes(q);
  });

  const getRoleBadge = (u: User) => {
    if (u.role === 'CEO') {
      return {
        label: 'مدیرعامل',
        classes: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
      };
    }
    if (u.role === 'QC_MANAGER') {
      return {
        label: 'مسئول QC و فنی',
        classes: 'bg-[#C5A059]/20 text-[#E5CA8F] border border-[#C5A059]/40',
      };
    }
    if (u.role === 'SCHEDULING_COORDINATOR') {
      return {
        label: 'مسئول هماهنگی و زمان‌بندی',
        classes: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
      };
    }
    if (u.role === 'SALES') {
      return {
        label: 'کارشناس فروش',
        classes: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
      };
    }
    if (u.role === 'MEASUREMENT_LEAD') {
      return {
        label: 'مسئول متراژ دوم',
        classes: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
      };
    }
    if (u.role === 'WAREHOUSE') {
      return {
        label: 'مسئول انبار و تامین',
        classes: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
      };
    }
    if (u.role === 'LEAD_TECHNICIAN') {
      return {
        label: 'سرپرست اکیپ نصب',
        classes: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
      };
    }
    return {
      label: 'تکنسین نصب',
      classes: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/40',
    };
  };

  const defaultTeams: InstallationTeam[] = [
    { id: 'TEAM_1', name: 'اکیپ نصب فرخ نقدعلیان', code: 'TEAM_1', createdAt: '', updatedAt: '' },
    { id: 'TEAM_2', name: 'اکیپ نصب اصغر فرهادی', code: 'TEAM_2', createdAt: '', updatedAt: '' },
    { id: 'TEAM_3', name: 'اکیپ نصب محسن رضایی', code: 'TEAM_3', createdAt: '', updatedAt: '' },
    { id: 'TEAM_4', name: 'اکیپ نصب حمید کاظمی', code: 'TEAM_4', createdAt: '', updatedAt: '' },
  ];
  const effectiveTeams = teams && teams.length > 0 ? teams : defaultTeams;

  // Map of team members
  const assignedUserIds = React.useMemo(() => {
    const ids = new Set<string>((teamMembers || []).map((m) => m.userId));
    effectiveTeams.forEach((t) => {
      if (t.supervisorId) ids.add(t.supervisorId);
    });
    return ids;
  }, [teamMembers, effectiveTeams]);

  const handleAssignMember = async (teamId: string, userId: string, roleInTeam: 'LEAD' | 'TECHNICIAN') => {
    if (!userId) return;
    setTeamActionLoading(true);
    setTeamActionError(null);
    try {
      if (onAssignTeamMember) {
        await onAssignTeamMember(teamId, userId, roleInTeam);
      } else {
        await SupabaseSyncService.adminAssignTeamMember(teamId, userId, roleInTeam);
      }
    } catch (err: any) {
      setTeamActionError(err.message || 'خطا در ثبت عضو اکیپ.');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setTeamActionLoading(true);
    setTeamActionError(null);
    try {
      if (onRemoveTeamMember) {
        await onRemoveTeamMember(userId);
      } else {
        await SupabaseSyncService.adminRemoveTeamMember(userId);
      }
    } catch (err: any) {
      setTeamActionError(err.message || 'خطا در حذف عضو.');
    } finally {
      setTeamActionLoading(false);
    }
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#151B23] rounded-lg p-3.5 border border-[#212835] ">
          <div className="text-xs text-[#637184]">کل اعضا</div>
          <div className="text-xl font-black text-[#F0F4F8] mt-1">
            {toPersianDigits(users.length)} نفر
          </div>
        </div>

        <div className="bg-[#151B23] rounded-lg p-3.5 border border-[#212835] ">
          <div className="text-xs text-[#C5A059] font-bold">مسئولین QC</div>
          <div className="text-xl font-black text-[#F0F4F8] mt-1">
            {toPersianDigits(qcLeads.length)} نفر
          </div>
        </div>

        <div className="bg-[#151B23] rounded-lg p-3.5 border border-[#212835] ">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-bold">هماهنگی و زمان‌بندی</div>
          <div className="text-xl font-black text-[#F0F4F8] mt-1">
            {toPersianDigits(coordinators.length)} نفر
          </div>
        </div>

        <div className="bg-[#151B23] rounded-lg p-3.5 border border-[#212835] ">
          <div className="text-xs text-[#C5A059] font-bold">سرپرستان اکیپ</div>
          <div className="text-xl font-black text-[#F0F4F8] mt-1">
            {toPersianDigits(crewLeads.length)} نفر
          </div>
        </div>

        <div className="bg-[#151B23] rounded-lg p-3.5 border border-[#212835] ">
          <div className="text-xs text-[#637184]">تکنسین‌های نصب</div>
          <div className="text-xl font-black text-[#F0F4F8] mt-1">
            {toPersianDigits(crewMembers.length)} نفر
          </div>
        </div>
      </div>

      {/* Main Section Switch: Personnel vs 4 Teams */}
      <div className="flex items-center justify-start border-b border-[#212835] pb-3">
        <SegmentedControl
          options={[
            { id: 'PERSONNEL', label: 'حساب‌های پرسنل و دسترسی‌ها', badge: users.length },
            { id: 'TEAMS', label: '4 اکیپ نصب فنی (12 نفر)', badge: effectiveTeams.length },
          ]}
          value={mainSection}
          onChange={(val) => setMainSection(val as MainSection)}
        />
      </div>

      {mainSection === 'TEAMS' ? (
        <div className="space-y-4">
          <div className="bg-[#111620] p-4 rounded-lg border border-[#C5A059]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-[#F0F4F8] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#C5A059]" />
                <span>سازماندهی 4 اکیپ نصب فنی شرکت گالری طلایی</span>
              </h4>
              <p className="text-xs text-[#637184] mt-1 leading-relaxed">
                دپارتمان فنی دارای 4 اکیپ رسمی نصب است. هر اکیپ حداکثر متشکل از 1 سرپرست و 2 تکنسین (مجموعاً 3 نفر) است که کل کادر 12 نفره را پوشش می‌دهد. هر کاربر در یک زمان فقط عضو یک اکیپ می‌تواند باشد.
              </p>
            </div>
          </div>

          {teamActionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{teamActionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {effectiveTeams.map((team) => {
              const leadMember = (teamMembers || []).find(
                (m) => m.teamId === team.id && m.roleInTeam === 'LEAD'
              );
              const supervisorUser = users.find(
                (u) => u.id === (leadMember?.userId || team.supervisorId)
              );

              const techMembers = (teamMembers || []).filter(
                (m) => m.teamId === team.id && m.roleInTeam === 'TECHNICIAN'
              );
              const techUsers = techMembers
                .map((m) => users.find((u) => u.id === m.userId))
                .filter(Boolean) as User[];

              const totalCount = (supervisorUser ? 1 : 0) + techUsers.length;
              const isFull = totalCount >= 3;

              // Users available to be assigned (active, not already assigned to any team)
              const availableUsers = users
                .filter((u) => u.active !== false && !assignedUserIds.has(u.id))
                .sort((a, b) => {
                  const aTech = a.role === 'LEAD_TECHNICIAN' || a.role === 'TECHNICIAN' ? 1 : 0;
                  const bTech = b.role === 'LEAD_TECHNICIAN' || b.role === 'TECHNICIAN' ? 1 : 0;
                  return bTech - aTech;
                });

              return (
                <div
                  key={team.id || team.code}
                  className="bg-[#151B23] rounded-lg p-4 sm:p-5 border border-[#212835]  space-y-4"
                >
                  {/* Team Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#212835]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-[#212121] dark:bg-[#141414] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059]">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#F0F4F8]">
                          {supervisorUser ? `اکیپ نصب ${getDisplayName(supervisorUser.name)}` : team.name}
                        </h4>
                        <span className="text-xs font-mono text-zinc-500">{team.code}</span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        isFull
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {toPersianDigits(totalCount)} از 3 نفر {isFull ? '(تکمیل)' : `(${toPersianDigits(3 - totalCount)} جای خالی)`}
                    </span>
                  </div>

                  {/* 1. Supervisor Slot */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>سرپرست اکیپ (1 نفر):</span>
                      </span>
                      {supervisorUser && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          ثبت شده
                        </span>
                      )}
                    </span>

                    {supervisorUser ? (
                      <div className="flex items-center justify-between p-2.5 rounded-md border border-[#C5A059]/30 bg-[#1C232D]">
                        <div className="flex items-center gap-2">
                          <Avatar name={supervisorUser.name} role={supervisorUser.role} size="sm" />
                          <div>
                            <span className="font-bold text-xs text-[#F0F4F8] block">
                              {supervisorUser.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400" dir="ltr">
                              {supervisorUser.phone}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={teamActionLoading}
                          onClick={() => handleRemoveMember(supervisorUser.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold"
                          icon={<UserMinus className="w-3.5 h-3.5" />}
                        >
                          تغییر / حذف
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedLeadToAdd[team.id] || ''}
                          onChange={(e) =>
                            setSelectedLeadToAdd((prev) => ({ ...prev, [team.id]: e.target.value }))
                          }
                          className="flex-1 text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                        >
                          <option value="">
                            {availableUsers.length > 0
                              ? `انتخاب سرپرست از پرسنل آزاد (${toPersianDigits(availableUsers.length)} نفر)...`
                              : 'هیچ پرسنل آزادی موجود نیست'}
                          </option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.phone}) — {u.role === 'LEAD_TECHNICIAN' ? 'سرپرست' : u.role === 'TECHNICIAN' ? 'تکنسین' : u.role}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!selectedLeadToAdd[team.id] || teamActionLoading}
                          onClick={() => {
                            const uId = selectedLeadToAdd[team.id];
                            if (uId) {
                              handleAssignMember(team.id, uId, 'LEAD');
                              setSelectedLeadToAdd((prev) => ({ ...prev, [team.id]: '' }));
                            }
                          }}
                          icon={<UserCheck className="w-3.5 h-3.5" />}
                        >
                          انتساب
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 2. Technicians Slot (Up to 2) */}
                  <div className="space-y-2 pt-2 border-t border-[#212835]">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>تکنسین‌های نصب ({toPersianDigits(techUsers.length)} از 2 نفر):</span>
                      </span>
                    </span>

                    {/* Assigned Technicians list */}
                    {techUsers.length > 0 && (
                      <div className="space-y-2">
                        {techUsers.map((tech) => (
                          <div
                            key={tech.id}
                            className="flex items-center justify-between p-2.5 rounded-md border border-[#212835] bg-[#1C232D]"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar name={tech.name} role={tech.role} size="sm" />
                              <div>
                                <span className="font-bold text-xs text-[#F0F4F8] block">
                                  {tech.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400" dir="ltr">
                                  {tech.phone}
                                </span>
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={teamActionLoading}
                              onClick={() => handleRemoveMember(tech.id)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold"
                              icon={<UserMinus className="w-3.5 h-3.5" />}
                            >
                              حذف
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Technician input if slots available */}
                    {techUsers.length < 2 && (
                      <div className="flex items-center gap-2 pt-1">
                        <select
                          value={selectedTechToAdd[team.id] || ''}
                          onChange={(e) =>
                            setSelectedTechToAdd((prev) => ({ ...prev, [team.id]: e.target.value }))
                          }
                          className="flex-1 text-xs p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
                        >
                          <option value="">
                            {availableUsers.length > 0
                              ? `افزودن تکنسین از پرسنل آزاد (${toPersianDigits(availableUsers.length)} نفر)...`
                              : 'هیچ تکنسین آزادی موجود نیست'}
                          </option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.phone}) — {u.role === 'TECHNICIAN' ? 'تکنسین' : u.role === 'LEAD_TECHNICIAN' ? 'سرپرست' : u.role}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!selectedTechToAdd[team.id] || teamActionLoading}
                          onClick={() => {
                            const uId = selectedTechToAdd[team.id];
                            if (uId) {
                              handleAssignMember(team.id, uId, 'TECHNICIAN');
                              setSelectedTechToAdd((prev) => ({ ...prev, [team.id]: '' }));
                            }
                          }}
                          icon={<UserPlus className="w-3.5 h-3.5" />}
                        >
                          افزودن
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 3. Daily Capacity Configuration for this Team */}
                  <div className="pt-3 border-t border-[#212835] flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-bold text-slate-700 dark:text-zinc-300 block">
                        ظرفیت روزانه اکیپ:
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {team.dailyCapacityHours
                          ? `${toPersianDigits(team.dailyCapacityHours)} ساعت در روز`
                          : 'پیروی از سقف سامانه یا نامشخص'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="24"
                        step="0.5"
                        placeholder="ساعت"
                        defaultValue={team.dailyCapacityHours ?? ''}
                        id={`capacity-input-${team.id}`}
                        className="w-16 text-center text-xs p-1.5 rounded-lg border border-[#212835] bg-[#0D1117] dark:text-white"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={teamActionLoading}
                        onClick={async () => {
                          const input = document.getElementById(`capacity-input-${team.id}`) as HTMLInputElement;
                          const val = input?.value ? parseFloat(input.value) : null;
                          try {
                            setTeamActionLoading(true);
                            await SupabaseSyncService.updateTeamCapacity(team.id, val);
                            if (team) {
                              team.dailyCapacityHours = val;
                            }
                          } catch (err: any) {
                            setTeamActionError(err.message || 'خطا در ثبت ظرفیت');
                          } finally {
                            setTeamActionLoading(false);
                          }
                        }}
                        className="text-xs"
                      >
                        ثبت سقف
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Filter and Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <SegmentedControl
              options={[
                { id: 'ALL', label: 'همه', badge: users.length },
                { id: 'QC_LEADS', label: 'QC', badge: qcLeads.length },
                { id: 'COORDINATORS', label: 'هماهنگی', badge: coordinators.length },
                { id: 'CREW_LEADS', label: 'سرپرستان', badge: crewLeads.length },
                { id: 'CREW', label: 'تکنسین‌ها', badge: crewMembers.length },
                { id: 'OFFICE', label: 'دفتر و فروش', badge: officePersonnel.length },
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
                className="w-full text-xs pr-9 pl-3 py-2 rounded-md border border-[#212835] bg-[#151B23] text-[#F0F4F8]"
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
                  className="bg-[#151B23] rounded-lg p-4 border border-[#212835]  hover:border-[#C5A059]/60 transition space-y-3 relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={getDisplayName(u.name)} id={u.id} size="lg" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[#F0F4F8] truncate">
                          {getDisplayName(u.name)}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${badge.classes}`}>
                            {badge.label}
                          </span>
                          {u.active === false ? (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              غیرفعال
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
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
                        className="w-8 h-8 flex items-center justify-center text-[#637184] hover:text-[#8E6F27] dark:hover:text-[#E5CA8F] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                        title="ویرایش حساب"
                        aria-label={`ویرایش حساب ${getDisplayName(u.name)}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenResetPassword(u)}
                        className="w-8 h-8 flex items-center justify-center text-[#637184] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                        title="تغییر رمز عبور"
                        aria-label={`تغییر رمز عبور ${getDisplayName(u.name)}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(deleteLoadingId) || isSubmitting}
                        onClick={() => handleDelete(u)}
                        className="w-8 h-8 flex items-center justify-center text-[#637184] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer disabled:opacity-50"
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

                  <div className="bg-[#111620] rounded-md p-2.5 border border-[#E2DDD4] dark:border-[#282828] text-xs">
                    <div className="flex items-center justify-between text-[#637184]">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>موبایل سازمانی:</span>
                      </span>
                      <span className="font-mono font-bold text-[#F0F4F8]" dir="ltr">
                        {u.phone}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Sheet */}
      <Sheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'ویرایش حساب پرسنل' : 'تعریف عضو جدید در سامانه'}
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label htmlFor="tech-name" className="block text-xs font-bold text-[#9BA7B6] mb-1">
              نام و نام‌خانوادگی:
            </label>
            <input
              id="tech-name"
              type="text"
              required
              placeholder="مثال: فرخ نقدعلیان"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm p-2.5 rounded-md border border-[#212835] bg-[#0D1117] dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="tech-phone" className="block text-xs font-bold text-[#9BA7B6] mb-1">
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
              className="w-full text-sm p-2.5 rounded-md border border-[#212835] font-mono text-left bg-[#0D1117] dark:text-white"
              dir="ltr"
            />
          </div>

          {!editingUser && (
            <div>
              <label htmlFor="tech-password" className="block text-xs font-bold text-[#9BA7B6] mb-1">
                رمز عبور اولیه:
              </label>
              <input
                id="tech-password"
                type="password"
                required
                minLength={8}
                placeholder="حداقل 8 کاراکتر"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm p-2.5 rounded-md border border-[#212835] font-mono text-left bg-[#0D1117] dark:text-white"
                dir="ltr"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
              نقش سازمانی:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRole('CEO')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'CEO'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                مدیرعامل
              </button>
              <button
                type="button"
                onClick={() => setRole('QC_MANAGER')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'QC_MANAGER'
                    ? 'border-[#C5A059] bg-[#C5A059]/20 text-[#E5CA8F]'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                مدیر QC
              </button>
              <button
                type="button"
                onClick={() => setRole('SCHEDULING_COORDINATOR')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'SCHEDULING_COORDINATOR'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                مسئول هماهنگی
              </button>
              <button
                type="button"
                onClick={() => setRole('SALES')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'SALES'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                کارشناس فروش
              </button>
              <button
                type="button"
                onClick={() => setRole('MEASUREMENT_LEAD')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'MEASUREMENT_LEAD'
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                مسئول متراژ دوم
              </button>
              <button
                type="button"
                onClick={() => setRole('WAREHOUSE')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'WAREHOUSE'
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                مسئول انبار
              </button>
              <button
                type="button"
                onClick={() => setRole('LEAD_TECHNICIAN')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'LEAD_TECHNICIAN'
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                سرپرست اکیپ
              </button>
              <button
                type="button"
                onClick={() => setRole('TECHNICIAN')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'TECHNICIAN'
                    ? 'border-zinc-500 bg-zinc-500/20 text-zinc-300'
                    : 'border-[#212835] text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                تکنسین نصب
              </button>
            </div>
          </div>

          {editingUser && (
            <div className="pt-2 border-t border-[#212835]">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-[#9BA7B6]">
                  وضعیت فعالیت حساب:
                </span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#C5A059] rounded cursor-pointer"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-[#212835]">
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
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}
            <div className="text-xs text-[#637184]">
              تنظیم رمز عبور جدید برای:
              <div className="font-bold text-sm text-[#F0F4F8] mt-1">
                {getDisplayName(selectedUserForReset.name)}
              </div>
              <div className="text-xs font-mono mt-0.5" dir="ltr">
                {selectedUserForReset.phone}
              </div>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-[#9BA7B6] mb-1">
                رمز عبور جدید:
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                placeholder="حداقل 8 کاراکتر"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-sm p-2.5 rounded-md border border-[#212835] font-mono text-left bg-[#0D1117] dark:text-white"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#212835]">
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
