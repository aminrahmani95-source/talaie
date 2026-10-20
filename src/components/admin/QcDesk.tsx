import React, { useState } from 'react';
import { Project, User } from '../../types';
import {
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Camera,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  projects: Project[];
  users: User[];
  onUpdateProject: (project: Project) => void;
  onViewProposal: (project: Project) => void;
}

export const QcDesk: React.FC<Props> = ({
  projects,
  users,
  onUpdateProject,
  onViewProposal,
}) => {
  // Filter projects ready for QC (either COMPLETED or already reviewed)
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // QC Form states
  const [qcScore, setQcScore] = useState<number>(5);
  const [qcNotes, setQcNotes] = useState<string>('');

  const relevantProjects = projects.filter((p) => {
    if (filter === 'PENDING') return p.status === 'COMPLETED' || p.qcStatus === 'PENDING';
    if (filter === 'APPROVED') return p.qcStatus === 'APPROVED';
    return true;
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || relevantProjects[0];

  const handleSelectProject = (p: Project) => {
    setSelectedProjectId(p.id);
    setQcScore(p.qcScore || 5);
    setQcNotes(p.qcNotes || '');
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const updated: Project = {
      ...selectedProject,
      qcStatus: 'APPROVED',
      qcScore,
      qcNotes: qcNotes.trim() || 'نصب با تایید کامل واحد کنترل کیفیت انجام شد.',
      qcReviewedAt: new Date().toLocaleDateString('fa-IR'),
      qcReviewedBy: 'مدیر کیوسی',
    };

    onUpdateProject(updated);

    // Fire celebration confetti!
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore if confetti not supported
    }

    alert('تاییدیه کنترل کیفیت با موفقیت ثبت شد و نمره کیفی تکنسین‌ها منظور گردید.');
  };

  const handleReject = () => {
    if (!selectedProject) return;
    const reason = prompt('لطفاً دلیل عدم تایید یا دستور اصلاح را برای تکنسین بنویسید:');
    if (!reason) return;

    const updated: Project = {
      ...selectedProject,
      qcStatus: 'REJECTED',
      qcNotes: reason,
      qcReviewedAt: new Date().toLocaleDateString('fa-IR'),
      qcReviewedBy: 'مدیر کیوسی',
    };

    onUpdateProject(updated);
    alert('وضعیت به "عدم تایید کیفی / نیاز به اصلاح" تغییر یافت.');
  };

  const getUserName = (id?: string) => {
    if (!id) return '';
    return users.find((u) => u.id === id)?.name || '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-black">میز کار نظارت و کنترل کیفیت (QC Desk)</h2>
            </div>
            <p className="text-xs text-purple-200 mt-1">
              بررسی اظهارات و عکس‌های ارسالی تکنسین‌ها، مقایسه با پروپوزال فروش و ثبت نظر و نمره کیفی مسئول کیوسی
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl">
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === 'PENDING' ? 'bg-purple-600 text-white' : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              در انتظار تایید کیوسی
            </button>
            <button
              onClick={() => setFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === 'APPROVED' ? 'bg-purple-600 text-white' : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              تایید شده‌ها
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filter === 'ALL' ? 'bg-purple-600 text-white' : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              همه پروژه‌ها
            </button>
          </div>
        </div>
      </div>

      {relevantProjects.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
          <ShieldCheck className="w-16 h-16 text-purple-200 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">پروژه‌ای در این بخش وجود ندارد</h3>
          <p className="text-xs text-slate-500 mt-1">
            زمانی که تکنسین‌ها نصب پروژه‌ای را سر صحنه به پایان برسانند و عکس‌های نصب را بفرستند، در این میز کار ظاهر می‌شود.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects List on the Left */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-xs font-bold text-slate-600 px-1">
              لیست پروژه‌ها ({toPersianDigits(relevantProjects.length)} مورد):
            </h3>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {relevantProjects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                const leadName = getUserName(p.leadTechnicianId);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/70 shadow-sm ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-bold text-slate-500">{p.code}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          p.qcStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.qcStatus === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.qcStatus === 'APPROVED'
                          ? 'تایید شده'
                          : p.qcStatus === 'REJECTED'
                          ? 'نیاز به اصلاح'
                          : 'در انتظار کیوسی'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 leading-tight">{p.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{p.address}</p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <span>سرپرست: {leadName}</span>
                      <span>
                        {toPersianDigits(p.shadePanels)} شید / {toPersianDigits(p.curtainPanels)} پرده
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Project QC Review Workspace */}
          {selectedProject && (
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Project Head */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {selectedProject.code}
                    </span>
                    <h3 className="font-black text-lg text-slate-900">{selectedProject.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{selectedProject.address}</p>
                </div>

                {selectedProject.proposalImages && selectedProject.proposalImages.length > 0 && (
                  <button
                    onClick={() => onViewProposal(selectedProject)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition self-start"
                  >
                    <FileText className="w-4 h-4" />
                    <span>مشاهده پروپوزال فروش</span>
                  </button>
                )}
              </div>

              {/* Technician Statement & Completion Report */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-purple-600" />
                  اظهارات و عکس‌های پایانی تکنسین نصب:
                </h4>

                {selectedProject.completionNotes ? (
                  <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                    «{selectedProject.completionNotes}»
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">توضیحی توسط تکنسین نوشته نشده است.</p>
                )}

                {/* Completion Photos */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 mb-2">عکس‌های ثبت‌شده بعد از نصب:</div>
                  {selectedProject.completionPhotos && selectedProject.completionPhotos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedProject.completionPhotos.map((photo, i) => (
                        <a key={i} href={photo} target="_blank" rel="noreferrer" className="block w-24 h-24 rounded-xl overflow-hidden border border-slate-300 shadow-xs hover:opacity-90">
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      تکنسین هنوز عکسی از اتمام پروژه آپلود نکرده است.
                    </div>
                  )}
                </div>
              </div>

              {/* QC Evaluation Form */}
              <form onSubmit={handleApprove} className="bg-purple-50/50 rounded-2xl p-5 border border-purple-200/80 space-y-4">
                <h4 className="text-xs font-bold text-purple-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  ارزیابی و نظر مسئول کیوسی (QC):
                </h4>

                {/* Star rating */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    امتیاز کیفی به عملکرد تکنسین‌ها (از ۱ تا ۵ ستاره):
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setQcScore(star)}
                        className="p-1 transition hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= qcScore
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 mr-2">
                      {toPersianDigits(qcScore)} از ۵ ستاره
                    </span>
                  </div>
                </div>

                {/* QC Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    نظر نهایی مسئول کیوسی اضافه بر اظهارات نصاب:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="مثال: کار با رعایت تراز لیزری و بدون چروک در پارچه شید تحویل شد. نحوه جمع‌شو و عملکرد موتور سامفی در ویدیوی ارسالی تست گردید و مورد تایید است."
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>

                {/* Status Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-lg shadow-purple-600/20 text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    تایید نهایی کیفی و ثبت در سابقه
                  </button>

                  <button
                    type="button"
                    onClick={handleReject}
                    className="py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition text-xs flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    عدم تایید / نیاز به اصلاح
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
