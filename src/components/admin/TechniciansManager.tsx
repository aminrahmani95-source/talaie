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
  Wrench,
  Loader2,
  AlertTriangle,
  Search,
  Building2,
  UserCheck,
  UserMinus,
  Sparkles,
  Eye,
  Plus,
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
  currentUserId?: string;
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onAssignTeamMember?: (teamId: string, userId: string, roleInTeam: 'LEAD' | 'TECHNICIAN') => Promise<{ success: boolean; error?: string }>;
  onRemoveTeamMember?: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onCreateTeam?: () => Promise<{ success: boolean; error?: string }>;
  onDeleteTeam?: (teamId: string) => Promise<{ success: boolean; error?: string }>;
  onImpersonateUser?: (user: User) => void;
  /** view only: the server lets only the QC manager and the CEO change people and teams */
  readOnly?: boolean;
}

type TabFilter = 'ALL' | 'QC_LEADS' | 'COORDINATORS' | 'CREW_LEADS' | 'CREW' | 'OFFICE';
type MainSection = 'PERSONNEL' | 'TEAMS';

export const TechniciansManager: React.FC<Props> = ({
  users,
  teams,
  teamMembers,
  currentUserId,
  onSaveUser,
  onDeleteUser,
  onAssignTeamMember,
  onRemoveTeamMember,
  onCreateTeam,
  onDeleteTeam,
  onImpersonateUser,
  readOnly = false,
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

  // When the app is connected to the server, a failed server call must stop the
  // action: otherwise the screen shows a user/password that does not exist on the server.
  const isServerConnected = () => SupabaseSyncService.getClient() !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setModalError(null);

    const trimmedName = name.trim();
    // digits only (spaces, dashes and Persian digits are normalised, same as the server)
    const trimmedPhone = toEnglishDigits(phone).replace(/\D/g, '');

    if (!trimmedName || !trimmedPhone) {
      setModalError('لطفاً نام و شماره تلفن را وارد کنید.');
      return;
    }

    const duplicate = users.find(
      (u) => u.id !== editingUser?.id && toEnglishDigits(String(u.phone || '')).replace(/\D/g, '') === trimmedPhone,
    );
    if (duplicate) {
      setModalError(`این شماره قبلاً برای «${getDisplayName(duplicate.name)}» ثبت شده است.`);
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
        if (isServerConnected()) {
          const res = await SupabaseSyncService.adminUpdatePersonnel({
            id: editingUser.id,
            name: plainName,
            phone: trimmedPhone,
            role,
            active: isActive,
          });
          if (!res.success) {
            setModalError(`ویرایش روی سرور انجام نشد: ${res.error || 'خطای نامشخص'}`);
            return;
          }
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
        if (isServerConnected()) {
          const res = await SupabaseSyncService.adminCreatePersonnel({
            name: plainName,
            phone: trimmedPhone,
            password: toEnglishDigits(password.trim()),
            role,
          });
          if (!res.success) {
            setModalError(
              `حساب روی سرور ساخته نشد، پس این فرد نمی‌تواند وارد شود: ${res.error || 'خطای نامشخص'}`,
            );
            return;
          }
          const serverId = res.data?.user?.id ?? res.data?.id ?? (typeof res.data === 'string' ? res.data : null);
          if (serverId) newId = String(serverId);
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

      setTabFilter('ALL');
      setSearchQuery('');
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
      if (isServerConnected()) {
        const res = await SupabaseSyncService.adminResetPersonnelPassword({
          id: selectedUserForReset.id,
          newPassword: toEnglishDigits(newPassword.trim()),
        });
        if (!res.success) {
          setResetError(`رمز روی سرور تغییر نکرد: ${res.error || 'خطای نامشخص'}`);
          return;
        }
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
      if (isServerConnected()) {
        const res = await SupabaseSyncService.adminDeletePersonnel({ id: u.id });
        if (!res.success) {
          alert(`حذف روی سرور انجام نشد: ${res.error || 'خطای نامشخص'}`);
          return;
        }
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
    ['CEO', 'MEASUREMENT_LEAD', 'WAREHOUSE', 'SALES_REP'].includes(u.role)
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
        classes: 'bg-brand/20 text-brand-soft border border-brand/40',
      };
    }
    if (u.role === 'SCHEDULING_COORDINATOR') {
      return {
        label: 'مسئول هماهنگی و زمان‌بندی',
        classes: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
      };
    }
    if (u.role === 'SALES_REP' || (u.role as string) === 'SALES') {
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
      classes: 'bg-zinc-500/20 text-ink border border-zinc-500/40',
    };
  };

  const defaultTeams: InstallationTeam[] = [
    { id: 'TEAM_1', name: 'اکیپ نصب ۱', code: 'TEAM_1', createdAt: '', updatedAt: '' },
    { id: 'TEAM_2', name: 'اکیپ نصب ۲', code: 'TEAM_2', createdAt: '', updatedAt: '' },
    { id: 'TEAM_3', name: 'اکیپ نصب ۳', code: 'TEAM_3', createdAt: '', updatedAt: '' },
    { id: 'TEAM_4', name: 'اکیپ نصب ۴', code: 'TEAM_4', createdAt: '', updatedAt: '' },
  ];
  // Sample teams only without a server: on a server their made-up ids cannot take members,
  // so an empty list there shows the «اکیپ جدید» button instead.
  const effectiveTeams =
    teams && teams.length > 0 ? teams : SupabaseSyncService.getClient() ? [] : defaultTeams;

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
      const res = onAssignTeamMember
        ? await onAssignTeamMember(teamId, userId, roleInTeam)
        : await SupabaseSyncService.adminAssignTeamMember(teamId, userId, roleInTeam);
      if (res && !res.success) setTeamActionError(res.error || 'خطا در ثبت عضو اکیپ.');
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
      const res = onRemoveTeamMember
        ? await onRemoveTeamMember(userId)
        : await SupabaseSyncService.adminRemoveTeamMember(userId);
      if (res && !res.success) setTeamActionError(res.error || 'خطا در حذف عضو.');
    } catch (err: any) {
      setTeamActionError(err.message || 'خطا در حذف عضو.');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!onCreateTeam) return;
    setTeamActionLoading(true);
    setTeamActionError(null);
    try {
      const res = await onCreateTeam();
      if (!res.success) setTeamActionError(res.error || 'خطا در ساخت اکیپ.');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleDeleteTeam = async (team: InstallationTeam) => {
    if (!onDeleteTeam) return;
    if (!confirm(`«${team.name}» حذف شود؟`)) return;
    setTeamActionLoading(true);
    setTeamActionError(null);
    try {
      const res = await onDeleteTeam(team.id);
      if (!res.success) setTeamActionError(res.error || 'خطا در حذف اکیپ.');
    } finally {
      setTeamActionLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Page Header */}
      <PageHeader
        title="پرسنل و اکیپ‌ها"
        subtitle={readOnly ? 'فقط مشاهده — تغییر پرسنل و اکیپ‌ها با مدیر QC است' : undefined}
        actions={
          readOnly ? undefined : <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            icon={<UserPlus className="w-4 h-4" />}
          >
            عضو جدید
          </Button>
        }
      />

      {/* Main Section Switch: Personnel vs 4 Teams */}
      <div className="flex items-center justify-start">
        <SegmentedControl
          options={[
            { id: 'PERSONNEL', label: 'پرسنل', badge: users.length },
            { id: 'TEAMS', label: 'اکیپ‌ها', badge: effectiveTeams.length },
          ]}
          value={mainSection}
          onChange={(val) => setMainSection(val as MainSection)}
        />
      </div>

      {mainSection === 'TEAMS' ? (
        <div className="space-y-4">
          {teamActionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{teamActionError}</span>
            </div>
          )}

          {onCreateTeam && !readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">
                {toPersianDigits(effectiveTeams.length)} اکیپ تعریف شده · هر اکیپ یک سرپرست و حداکثر ۲ تکنسین
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                loading={teamActionLoading}
                disabled={teamActionLoading}
                onClick={handleCreateTeam}
              >
                اکیپ جدید
              </Button>
            </div>
          )}

          <fieldset disabled={readOnly} className="min-w-0 grid grid-cols-1 @min-[900px]:grid-cols-2 gap-4">
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

              // Candidates for team lead (strictly technical personnel, unassigned)
              const availableLeads = users.filter(
                (u) =>
                  u.active !== false &&
                  !assignedUserIds.has(u.id) &&
                  (u.role === 'LEAD_TECHNICIAN' || u.role === 'TECHNICIAN')
              );

              // Candidates for team technicians (strictly technical personnel, unassigned)
              const availableTechs = users.filter(
                (u) =>
                  u.active !== false &&
                  !assignedUserIds.has(u.id) &&
                  (u.role === 'TECHNICIAN' || u.role === 'LEAD_TECHNICIAN')
              );

              return (
                <div
                  key={team.id || team.code}
                  className="bg-surface rounded-lg p-4 sm:p-5 border border-line  space-y-4"
                >
                  {/* Team Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-sunken border border-brand/40 flex items-center justify-center text-brand-ink">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-ink">
                          {supervisorUser ? `اکیپ نصب ${getDisplayName(supervisorUser.name)}` : team.name}
                        </h4>
                        <span className="text-xs font-mono text-ink-3">{team.code}</span>
                      </div>
                    </div>

                    {onDeleteTeam && totalCount === 0 && effectiveTeams.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTeam(team)}
                        disabled={teamActionLoading}
                        aria-label={`حذف ${team.name}`}
                        title="حذف اکیپ خالی"
                        className="mr-auto ml-2 w-9 h-9 rounded-md border border-line text-ink-3 hover:text-rose-600 hover:border-rose-500/40 flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

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
                    <span className="text-xs font-bold text-ink flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-ink" />
                        <span>سرپرست اکیپ (1 نفر):</span>
                      </span>
                      {supervisorUser && (
                        <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                          ثبت شده
                        </span>
                      )}
                    </span>

                    {supervisorUser ? (
                      <div className="flex items-center justify-between p-2.5 rounded-md border border-brand/30 bg-raised">
                        <div className="flex items-center gap-2">
                          <Avatar name={supervisorUser.name} role={supervisorUser.role} size="sm" />
                          <div>
                            <span className="font-bold text-xs text-ink block">
                              {supervisorUser.name}
                            </span>
                            <span className="text-[12px] font-mono text-ink-2" dir="ltr">
                              {supervisorUser.phone}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onImpersonateUser && supervisorUser.id !== currentUserId && (
                            <button
                              type="button"
                              onClick={() => onImpersonateUser(supervisorUser)}
                              className="px-2.5 py-1.5 text-brand-ink hover:bg-brand/15 rounded-md transition cursor-pointer flex items-center gap-1 text-xs font-bold border border-brand/40 active:scale-95"
                              title={`ورود و بازرسی پنل سرپرست ${supervisorUser.name}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">بازرسی پنل</span>
                            </button>
                          )}
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
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedLeadToAdd[team.id] || ''}
                          onChange={(e) =>
                            setSelectedLeadToAdd((prev) => ({ ...prev, [team.id]: e.target.value }))
                          }
                          className="flex-1 text-xs p-2.5 rounded-md border border-line bg-canvas text-ink"
                        >
                          <option value="">
                            {availableLeads.length > 0
                              ? `انتخاب سرپرست از کادر فنی آزاد (${toPersianDigits(availableLeads.length)} نفر)...`
                              : 'هیچ نیروی فنی آزادی موجود نیست'}
                          </option>
                          {availableLeads.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.phone}) — {u.role === 'LEAD_TECHNICIAN' ? 'سرپرست' : 'تکنسین'}
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
                  <div className="space-y-2 pt-2 border-t border-line">
                    <span className="text-xs font-bold text-ink flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-brand-ink" />
                        <span>تکنسین‌های نصب ({toPersianDigits(techUsers.length)} از 2 نفر):</span>
                      </span>
                    </span>

                    {/* Assigned Technicians list */}
                    {techUsers.length > 0 && (
                      <div className="space-y-2">
                        {techUsers.map((tech) => (
                          <div
                            key={tech.id}
                            className="flex items-center justify-between p-2.5 rounded-md border border-line bg-raised"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar name={tech.name} role={tech.role} size="sm" />
                              <div>
                                <span className="font-bold text-xs text-ink block">
                                  {tech.name}
                                </span>
                                <span className="text-[12px] font-mono text-ink-2" dir="ltr">
                                  {tech.phone}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {onImpersonateUser && tech.id !== currentUserId && (
                                <button
                                  type="button"
                                  onClick={() => onImpersonateUser(tech)}
                                  className="px-2 py-1 text-brand-ink hover:bg-brand/15 rounded-md transition cursor-pointer flex items-center gap-1 text-xs font-bold border border-brand/40 active:scale-95"
                                  title={`ورود و بازرسی پنل تکنسین ${tech.name}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">بازرسی پنل</span>
                                </button>
                              )}
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
                          className="flex-1 text-xs p-2.5 rounded-md border border-line bg-canvas text-ink"
                        >
                          <option value="">
                            {availableTechs.length > 0
                              ? `افزودن تکنسین از کادر فنی آزاد (${toPersianDigits(availableTechs.length)} نفر)...`
                              : 'هیچ نیروی فنی آزادی موجود نیست'}
                          </option>
                          {availableTechs.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.phone}) — {u.role === 'TECHNICIAN' ? 'تکنسین' : 'سرپرست'}
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
                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-bold text-ink block">
                        ظرفیت روزانه اکیپ:
                      </span>
                      <span className="text-[11px] text-ink-2">
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
                        className="w-16 text-center text-xs p-1.5 rounded-lg border border-line bg-canvas text-ink"
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
          </fieldset>
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
              <Search className="w-4 h-4 text-ink-3 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="جستجوی نام یا تلفن..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pr-9 pl-3 py-2 rounded-md border border-line bg-surface text-ink"
              />
            </div>
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 @min-[900px]:grid-cols-3 gap-3.5">
            {filteredUsers.map((u) => {
              const badge = getRoleBadge(u);

              return (
                <div
                  key={u.id}
                  className="bg-surface rounded-lg p-4 border border-line  hover:border-brand/60 transition space-y-3 relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={getDisplayName(u.name)} id={u.id} size="lg" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-ink truncate">
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

                    <div className={`flex items-center gap-1 shrink-0 ${readOnly ? 'hidden' : ''}`}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="w-8 h-8 flex items-center justify-center text-ink-3 hover:text-brand-soft hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                        title="ویرایش حساب"
                        aria-label={`ویرایش حساب ${getDisplayName(u.name)}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenResetPassword(u)}
                        className="w-8 h-8 flex items-center justify-center text-ink-3 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                        title="تغییر رمز عبور"
                        aria-label={`تغییر رمز عبور ${getDisplayName(u.name)}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(deleteLoadingId) || isSubmitting}
                        onClick={() => handleDelete(u)}
                        className="w-8 h-8 flex items-center justify-center text-ink-3 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer disabled:opacity-50"
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

                  <div className="bg-sunken rounded-md p-2.5 border border-line-strong text-xs">
                    <div className="flex items-center justify-between text-ink-3">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-brand-ink" />
                        <span>موبایل سازمانی:</span>
                      </span>
                      <span className="font-mono font-bold text-ink" dir="ltr">
                        {u.phone}
                      </span>
                    </div>
                  </div>

                  {onImpersonateUser && u.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => onImpersonateUser(u)}
                      className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-brand/10 hover:bg-brand/20 text-brand-ink border border-brand/40 hover:border-brand flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title={`ورود به پنل و مشاهده سامانه از دیدگاه ${getDisplayName(u.name)}`}
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-ink" />
                      <span>ورود و بازرسی پنل این کاربر</span>
                    </button>
                  )}
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
            <label htmlFor="tech-name" className="block text-xs font-bold text-ink-2 mb-1">
              نام و نام‌خانوادگی:
            </label>
            <input
              id="tech-name"
              type="text"
              required
              placeholder="مثال: علی رضایی"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm p-2.5 rounded-md border border-line bg-canvas text-ink"
            />
          </div>

          <div>
            <label htmlFor="tech-phone" className="block text-xs font-bold text-ink-2 mb-1">
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
              className="w-full text-sm p-2.5 rounded-md border border-line font-mono text-left bg-canvas text-ink"
              dir="ltr"
            />
          </div>

          {!editingUser && (
            <div>
              <label htmlFor="tech-password" className="block text-xs font-bold text-ink-2 mb-1">
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
                className="w-full text-sm p-2.5 rounded-md border border-line font-mono text-left bg-canvas text-ink"
                dir="ltr"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-ink-2 mb-1.5">
              نقش سازمانی:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRole('CEO')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'CEO'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-line text-ink-3 hover:text-ink'
                }`}
              >
                مدیرعامل
              </button>
              <button
                type="button"
                onClick={() => setRole('QC_MANAGER')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'QC_MANAGER'
                    ? 'border-brand bg-brand/20 text-brand-soft'
                    : 'border-line text-ink-3 hover:text-ink'
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
                    : 'border-line text-ink-3 hover:text-ink'
                }`}
              >
                مسئول هماهنگی
              </button>
              <button
                type="button"
                onClick={() => setRole('SALES_REP')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'SALES_REP'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-line text-ink-3 hover:text-ink'
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
                    : 'border-line text-ink-3 hover:text-ink'
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
                    : 'border-line text-ink-3 hover:text-ink'
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
                    : 'border-line text-ink-3 hover:text-ink'
                }`}
              >
                سرپرست اکیپ
              </button>
              <button
                type="button"
                onClick={() => setRole('TECHNICIAN')}
                className={`p-2 rounded-md border text-xs font-bold transition text-center min-h-[44px] cursor-pointer ${
                  role === 'TECHNICIAN'
                    ? 'border-zinc-500 bg-zinc-500/20 text-ink'
                    : 'border-line text-ink-3 hover:text-ink'
                }`}
              >
                تکنسین نصب
              </button>
            </div>
          </div>

          {editingUser && (
            <div className="pt-2 border-t border-line">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-ink-2">
                  وضعیت فعالیت حساب:
                </span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-brand rounded cursor-pointer"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-line">
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
            <div className="text-xs text-ink-3">
              تنظیم رمز عبور جدید برای:
              <div className="font-bold text-sm text-ink mt-1">
                {getDisplayName(selectedUserForReset.name)}
              </div>
              <div className="text-xs font-mono mt-0.5" dir="ltr">
                {selectedUserForReset.phone}
              </div>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-bold text-ink-2 mb-1">
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
                className="w-full text-sm p-2.5 rounded-md border border-line font-mono text-left bg-canvas text-ink"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-line">
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
