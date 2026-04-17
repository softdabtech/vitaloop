import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { 
  Heart, Calendar, AlertCircle, CheckCircle,
  Activity, Download, Settings, LogOut, Menu, Plus, Sparkles, ArrowRight
} from 'lucide-react';
import UserDashboardSidebar from '../components/dashboard/UserDashboardSidebar';
import StatCard from '../components/dashboard/StatCard';
import HealthChart from '../components/dashboard/HealthChart';
import AssignmentCard from '../components/dashboard/AssignmentCard';
import QuickActionsPanel from '../components/dashboard/QuickActionsPanel';
import ProgressTimeline from '../components/dashboard/ProgressTimeline';
import RecommendationsPanel from '../components/dashboard/RecommendationsPanel';
import { enrichAssignments } from '../lib/assignmentScoring.js';
import '../styles/userDashboard.css';
import '../styles/dashboard2026.css';
import { motion, useReducedMotion } from 'framer-motion';

function SectionSkeleton({ rows = 3, rowClass = 'h-12' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={`skeleton ${rowClass} rounded-xl`} />
      ))}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
      <div className="skeleton h-10 w-10 mb-3" />
      <div className="skeleton h-4 w-28 mb-3" />
      <div className="skeleton h-8 w-24" />
    </div>
  );
}

export default function UserDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [user, authLoading, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/summary');
      const payload = response?.data || {};

      const rankedAssignments = enrichAssignments(payload?.blocks?.assignments || [])
        .sort((a, b) => (b?.priority?.score || 0) - (a?.priority?.score || 0));
      const todayFocus = rankedAssignments
        .filter((item) => String(item?.status || '').toLowerCase() !== 'completed')
        .slice(0, 3);

      setSummary({
        ...payload,
        blocks: {
          assignments: Array.isArray(rankedAssignments) ? rankedAssignments : [],
          today_focus: todayFocus,
          progress: Array.isArray(payload?.blocks?.progress) ? payload.blocks.progress : [],
          insights: Array.isArray(payload?.blocks?.insights) ? payload.blocks.insights : [],
        },
      });
      setError(null);
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Could not load dashboard data. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const profile = summary?.profile || {};
  const onboarding = profile?.onboarding || {};
  const stats = summary?.stats || {};
  const nextBestAction = summary?.next_best_action || {};
  const startHere = summary?.start_here || {};
  const assignments = summary?.blocks?.assignments || [];
  const progress = summary?.blocks?.progress || [];
  const insights = summary?.blocks?.insights || [];
  const todayFocus = summary?.blocks?.today_focus || [];

  const displayName = profile?.first_name || user?.user_metadata?.full_name || user?.email?.split('@')?.[0] || 'there';
  const onboardingLabel = onboarding?.requires_onboarding
    ? onboarding?.current_stage_label || 'Continue onboarding'
    : 'Dashboard ready';

  const reduced = useReducedMotion();
  const healthScore = Number(stats?.health_score || 0);
  const ringProgress = Math.max(0, Math.min(100, healthScore));

  return (
    <div className="vtl-shell flex min-h-screen">
      <div className="hidden lg:block">
        <UserDashboardSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="h-full w-72" onClick={(event) => event.stopPropagation()}>
            <UserDashboardSidebar
              collapsed={false}
              mobile
              onCloseMobile={() => setSidebarOpen(false)}
              user={user}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="vtl-header-glass flex h-[76px] items-center justify-between gap-3 border-b border-slate-700/40 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="vtl-focus-ring rounded-xl p-2 transition hover:bg-slate-800 lg:hidden"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-2xl">Welcome back, {displayName}</h1>
              <p className="text-xs text-slate-400 sm:text-sm">{onboardingLabel}</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="vtl-button-secondary vtl-focus-ring px-3 text-sm"
            >
              {sidebarCollapsed ? 'Expand' : 'Collapse'} sidebar
            </button>
            <button
              onClick={handleLogout}
              className="vtl-button-secondary vtl-focus-ring flex items-center gap-2 px-4 text-sm"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Start Here */}
            {startHere?.enabled && (
              <div className="bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-slate-800 border border-emerald-500/30 rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">First value in 30 seconds</p>
                    <h2 className="text-white text-xl sm:text-2xl font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-300" />
                      {startHere.title}
                    </h2>
                    <p className="text-slate-300 text-sm">{startHere.description}</p>
                    <ul className="text-xs sm:text-sm text-slate-300 space-y-1">
                      {(startHere.steps || []).slice(0, 3).map((step, idx) => (
                        <li key={`start-${idx}`}>{idx + 1}. {step}</li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => navigate(startHere.cta_path || '/upload')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-semibold transition"
                  >
                    {startHere.cta_label || 'Start now'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Next Best Action */}
            {!loading && nextBestAction?.title && (
              <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Next best action</p>
                  <p className="text-white font-semibold">{nextBestAction.title}</p>
                  <p className="text-slate-400 text-sm">{nextBestAction.description}</p>
                </div>
                <button
                  onClick={() => navigate(nextBestAction.path || '/dashboard')}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-emerald-300 hover:text-emerald-200 hover:border-emerald-500/40 transition"
                >
                  {nextBestAction.cta_label || 'Open'}
                </button>
              </div>
            )}

            {/* Hero metrics: Health score + key stats + quick actions */}
            <div className="grid gap-4 xl:grid-cols-[300px_1fr_320px]">
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={reduced ? {} : { opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="vtl-card vtl-card-hover p-6"
              >
                <p className="mb-3 text-sm text-slate-400">Health Score</p>
                <div className="mx-auto flex h-[240px] w-[240px] items-center justify-center">
                  <div
                    className="relative h-[220px] w-[220px] rounded-full"
                    style={{
                      background: `conic-gradient(#10B981 ${ringProgress * 3.6}deg, rgba(148,163,184,0.2) 0deg)`,
                    }}
                  >
                    <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-[#0b111f] shadow-inner">
                      <div className="text-center">
                        <p className="text-5xl font-bold text-slate-50">{stats?.health_score ?? '--'}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">out of 100</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {loading ? (
                  <>
                    <StatSkeleton />
                    <StatSkeleton />
                    <StatSkeleton />
                    <StatSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      title="Health Score"
                      value={stats?.health_score ?? '--'}
                      unit="/100"
                      icon={Heart}
                      color="emerald"
                      change={stats?.health_score_change || 0}
                    />
                    <StatCard
                      title="Active Program"
                      value={stats?.active_program || 'None'}
                      unit=""
                      icon={Activity}
                      color="blue"
                    />
                    <StatCard
                      title="Completed Tasks"
                      value={stats?.completed_tasks || 0}
                      unit="total"
                      icon={CheckCircle}
                      color="purple"
                    />
                    <StatCard
                      title="Subscription"
                      value={String(stats?.subscription || 'free').replace('_', ' ')}
                      unit=""
                      icon={Calendar}
                      color="orange"
                    />
                  </>
                )}
              </div>

              <div>
                {loading ? (
                  <div className="vtl-card p-6">
                    <SectionSkeleton rows={6} rowClass="h-10" />
                  </div>
                ) : (
                  <QuickActionsPanel />
                )}
              </div>
            </div>

            {/* Health Trends chart */}
            <div>
              {loading ? (
                <div className="vtl-card p-6">
                  <SectionSkeleton rows={4} rowClass="h-14" />
                </div>
              ) : (
                <HealthChart progress={progress} />
              )}
            </div>

            <div className="dashboard-grid-auto dashboard-work-grid gap-4 sm:gap-6">
              {/* Assignments Section */}
              <div className="vtl-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-500" />
                    Active Assignments
                  </h2>
                  <button
                    onClick={() => navigate('/assignments')}
                    className="flex items-center gap-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </button>
                </div>

                {loading ? (
                  <SectionSkeleton rows={4} rowClass="h-20" />
                ) : assignments.length > 0 ? (
                  <div className="space-y-3">
                    {assignments.slice(0, 5).map((assignment) => (
                        <AssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          onClick={() => navigate(assignment?.id ? `/assignments/${assignment.id}` : '/assignments')}
                        />
                    ))}
                    {assignments.length > 5 && (
                      <button
                        onClick={() => navigate('/assignments')}
                        className="w-full text-center py-2 text-slate-400 hover:text-emerald-400 transition text-sm"
                      >
                        View all {assignments.length} assignments
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-300">No active assignments yet</p>
                    <p className="text-slate-500 text-sm mt-1">Start with onboarding or upload labs to generate your first task list.</p>
                  </div>
                )}
              </div>

              {/* Today Focus */}
              <div className="vtl-card p-6 ring-1 ring-emerald-500/25">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    Today Focus
                  </h2>
                  <button
                    onClick={() => navigate('/assignments')}
                    className="text-sm text-emerald-300 hover:text-emerald-200 transition"
                  >
                    Open planner
                  </button>
                </div>

                {loading ? (
                  <SectionSkeleton rows={3} rowClass="h-20" />
                ) : todayFocus.length > 0 ? (
                  <div className="space-y-3">
                    {todayFocus.map((assignment) => (
                      <AssignmentCard
                        key={`focus-${assignment.id || assignment.title}`}
                        assignment={assignment}
                        onClick={() => navigate(assignment?.id ? `/assignments/${assignment.id}` : '/assignments')}
                      />
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-300 text-sm">No active focus tasks today.</p>
                    <p className="text-slate-500 text-xs mt-1">Use weekly check-in to generate the next recommended action.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations & Progress Timeline */}
            <div className="dashboard-grid-auto dashboard-insights-grid gap-4 sm:gap-6">
              {loading ? (
                <div className="vtl-card p-6">
                  <SectionSkeleton rows={4} rowClass="h-12" />
                </div>
              ) : (
                <RecommendationsPanel insights={insights} />
              )}
              {loading ? (
                <div className="vtl-card p-6">
                  <SectionSkeleton rows={5} rowClass="h-11" />
                </div>
              ) : (
                <ProgressTimeline progress={progress} />
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pb-6">
              <button
                onClick={() => navigate('/upload')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
              >
                <Download className="w-4 h-4" />
                Upload Lab Results
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => navigate('/checkin')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
              >
                Schedule Check-in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
