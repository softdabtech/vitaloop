import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { 
  Heart, Calendar, AlertCircle, CheckCircle, 
  Activity, Download, Settings, LogOut, Menu, X, Plus 
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

export default function UserDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const normalizeList = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
      };

      const assignmentsRequest = api
        .get('/assignments')
        .catch(() => api.get('/crm/assignments'));

      const [profileResult, assignmentsResult, progressResult, insightsResult] = await Promise.allSettled([
        api.get('/auth/me').catch(() => api.get('/me')),
        assignmentsRequest,
        api.get('/progress'),
        api.get('/insights'),
      ]);

      const profileData = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
      const assignmentsData = assignmentsResult.status === 'fulfilled' ? normalizeList(assignmentsResult.value.data) : [];
      const progressData = progressResult.status === 'fulfilled' ? normalizeList(progressResult.value.data) : [];
      const insightsData = insightsResult.status === 'fulfilled' ? normalizeList(insightsResult.value.data) : [];
      const rankedAssignments = enrichAssignments(assignmentsData)
        .sort((a, b) => (b?.priority?.score || 0) - (a?.priority?.score || 0));

      setDashboardData(profileData);
      setAssignments(Array.isArray(rankedAssignments) ? rankedAssignments : []);
      setProgress(Array.isArray(progressData) ? progressData : []);
      setInsights(Array.isArray(insightsData) ? insightsData : []);
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

  const todayFocus = assignments
    .filter((item) => String(item?.status || '').toLowerCase() !== 'completed')
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Heart className="w-12 h-12 text-emerald-500" />
          </div>
          <p className="text-white text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <UserDashboardSidebar 
        isOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-white" />
              )}
            </button>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {user?.name || 'User'}!
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Health Score"
                value={dashboardData?.health_score || '--'}
                unit="/100"
                icon={Heart}
                color="emerald"
                change={dashboardData?.health_score_change || 0}
              />
              <StatCard
                title="Active Program"
                value={dashboardData?.current_program || 'None'}
                unit=""
                icon={Activity}
                color="blue"
              />
              <StatCard
                title="Completed Tasks"
                value={dashboardData?.completed_tasks || 0}
                unit="this week"
                icon={CheckCircle}
                color="purple"
              />
              <StatCard
                title="Subscription"
                value={dashboardData?.sub_status || 'Free'}
                unit=""
                icon={Calendar}
                color="orange"
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Health Trends Chart - Spans 2 columns */}
              <div className="lg:col-span-2">
                <HealthChart progress={progress} />
              </div>

              {/* Quick Actions */}
              <div>
                <QuickActionsPanel />
              </div>
            </div>

            {/* Assignments Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
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

              {assignments.length > 0 ? (
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
                <p className="text-slate-400 text-center py-8">No active assignments yet</p>
              )}
            </div>

            {/* Today Focus */}
            <div className="bg-slate-800 border border-emerald-500/30 rounded-lg p-6">
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

              {todayFocus.length > 0 ? (
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
                <p className="text-slate-400 text-sm">No active focus tasks today. Great momentum.</p>
              )}
            </div>

            {/* Recommendations & Progress Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecommendationsPanel insights={insights} />
              <ProgressTimeline progress={progress} />
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex gap-4 pb-6">
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
