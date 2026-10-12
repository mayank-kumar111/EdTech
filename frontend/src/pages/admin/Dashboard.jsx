import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import img from '../../assets/empty.jpg';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeftLong } from 'react-icons/fa6';

const CHART_COLORS = ['#111827', '#2563eb', '#0f766e', '#9333ea', '#ea580c', '#0891b2', '#be123c'];

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const shortName = (value = 'Untitled course', max = 18) => (
  value.length > max ? `${value.slice(0, max - 1)}…` : value
);

function MetricCard({ label, value, helper, accent = 'bg-gray-900' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-1 w-12 rounded-full ${accent}`} />
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { userData } = useSelector((state) => state.user);
  const { creatorCourseData } = useSelector((state) => state.course);
  const courses = Array.isArray(creatorCourseData) ? creatorCourseData : [];

  const analytics = useMemo(() => {
    const rows = courses.map((course, index) => {
      const title = course?.title || `Course ${index + 1}`;
      const enrolled = Array.isArray(course?.enrolledStudents) ? course.enrolledStudents.length : 0;
      const lectures = Array.isArray(course?.lectures) ? course.lectures.length : 0;
      const price = Number(course?.price) || 0;
      return {
        id: course?._id || `${title}-${index}`,
        title,
        name: shortName(title),
        category: course?.category || 'Uncategorized',
        enrolled,
        lectures,
        price,
        revenue: price * enrolled,
      };
    });

    const categoryMap = new Map();
    rows.forEach((row) => categoryMap.set(row.category, (categoryMap.get(row.category) || 0) + 1));
    const totalEnrollments = rows.reduce((sum, row) => sum + row.enrolled, 0);
    const totalLectures = rows.reduce((sum, row) => sum + row.lectures, 0);
    const estimatedRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalValue = rows.reduce((sum, row) => sum + row.price, 0);

    return {
      rows,
      totalEnrollments,
      totalLectures,
      estimatedRevenue,
      averageLectures: rows.length ? Math.round(totalLectures / rows.length) : 0,
      averagePrice: rows.length ? Math.round(totalValue / rows.length) : 0,
      categoryData: [...categoryMap.entries()].map(([name, value]) => ({ name, value })),
      enrollmentData: [...rows].sort((a, b) => b.enrolled - a.enrolled),
      revenueData: [...rows].sort((a, b) => b.revenue - a.revenue),
      topCourses: [...rows].sort((a, b) => b.enrolled - a.enrolled).slice(0, 5),
    };
  }, [courses]);

  return (
    <div className="min-h-screen bg-slate-50">
      <button
        type="button"
        aria-label="Back to home"
        onClick={() => navigate('/')}
        className="fixed left-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition hover:bg-gray-100 md:left-8 md:top-8"
      >
        <FaArrowLeftLong className="h-5 w-5" />
      </button>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 md:py-10">
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:p-8">
          <img
            src={userData?.photoUrl || img}
            alt="Educator profile"
            className="h-24 w-24 shrink-0 rounded-full border-4 border-gray-900 object-cover shadow-sm"
          />
          <div className="w-full text-center sm:text-left">
            <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Instructor dashboard</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
              Welcome, {userData?.name || 'Educator'} 👋
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {userData?.description || 'Track course performance and student engagement from one place.'}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-lg bg-gray-50 px-4 py-2 text-left">
                <p className="text-xs text-gray-500">Estimated course revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatMoney(analytics.estimatedRevenue)}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                + Create course
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Revenue estimate = listed course price × enrollment count; it may differ from actual payouts/refunds.
            </p>
          </div>
        </section>

        <section aria-label="Course overview metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Courses published" value={courses.length} helper="Courses currently in your dashboard" />
          <MetricCard label="Course enrollments" value={analytics.totalEnrollments.toLocaleString('en-IN')} helper="Total enrollments across your courses" accent="bg-blue-600" />
          <MetricCard label="Lectures uploaded" value={analytics.totalLectures.toLocaleString('en-IN')} helper={`Average ${analytics.averageLectures} lectures per course`} accent="bg-teal-600" />
          <MetricCard label="Average course price" value={formatMoney(analytics.averagePrice)} helper="Average listed price across courses" accent="bg-purple-600" />
        </section>

        {courses.length === 0 ? (
          <section className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-semibold text-gray-900">No course analytics yet</h2>
            <p className="mt-2 text-sm text-gray-500">Create your first course and its enrollment and lecture metrics will appear here.</p>
            <button type="button" onClick={() => navigate('/courses')} className="mt-5 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white">
              Create your first course
            </button>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ChartCard title="Enrollment by course" subtitle="Compare how many enrollments each course has received">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.enrollmentData} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" angle={0} textAnchor="end" interval="preserveStartEnd" height={35} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => [value, 'Enrollments']} labelFormatter={(label) => `Course: ${label}`} />
                      <Bar dataKey="enrolled" name="Enrollments" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Estimated revenue by course" subtitle="Based on listed price multiplied by enrollment count">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueData} margin={{ top: 8, right: 12, left: 8, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" angle={0} textAnchor="end" interval="preserveStartEnd" height={35} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Estimated revenue']} labelFormatter={(label) => `Course: ${label}`} />
                      <Bar dataKey="revenue" name="Estimated revenue" fill="#0f766e" radius={[5, 5, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Course content volume" subtitle="Number of lectures available in each course">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.rows} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" angle={0} textAnchor="end" interval="preserveStartEnd" height={35} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => [value, 'Lectures']} labelFormatter={(label) => `Course: ${label}`} />
                      <Area type="monotone" dataKey="lectures" name="Lectures" stroke="#7c3aed" fill="#c4b5fd" fillOpacity={0.45} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Courses by category" subtitle="How your published courses are distributed by category">
                {analytics.categoryData.length ? (
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={analytics.categoryData} dataKey="value" nameKey="name" cx="50%" cy="46%" outerRadius={100} innerRadius={52} paddingAngle={3} label={({ name, value }) => `${shortName(name, 12)} (${value})`}>
                          {analytics.categoryData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Courses']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-12 text-center text-sm text-gray-500">Category data is not available yet.</p>}
              </ChartCard>
            </section>

            <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col gap-1 border-b border-gray-100 p-5 sm:flex-row sm:items-end sm:justify-between md:p-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Course performance overview</h2>
                  <p className="mt-1 text-sm text-gray-500">Quick comparison to help identify courses that may need attention.</p>
                </div>
                <span className="text-xs text-gray-400">{analytics.rows.length} course{analytics.rows.length === 1 ? '' : 's'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Course</th>
                      <th className="px-5 py-3 font-semibold">Category</th>
                      <th className="px-5 py-3 text-right font-semibold">Lectures</th>
                      <th className="px-5 py-3 text-right font-semibold">Enrollments</th>
                      <th className="px-5 py-3 text-right font-semibold">Price</th>
                      <th className="px-5 py-3 text-right font-semibold">Est. revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...analytics.rows].sort((a, b) => b.enrolled - a.enrolled).map((course) => (
                      <tr key={course.id} className="transition hover:bg-gray-50">
                        <td className="max-w-[260px] px-5 py-4 font-medium text-gray-900">{course.title}</td>
                        <td className="px-5 py-4 text-gray-600">{course.category}</td>
                        <td className="px-5 py-4 text-right tabular-nums">{course.lectures}</td>
                        <td className="px-5 py-4 text-right tabular-nums">{course.enrolled}</td>
                        <td className="px-5 py-4 text-right tabular-nums">{formatMoney(course.price)}</td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums">{formatMoney(course.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Top courses by enrollment</h2>
              <p className="mt-1 text-sm text-gray-500">Your five most-enrolled courses at a glance.</p>
              <div className="mt-5 space-y-4">
                {analytics.topCourses.map((course, index) => {
                  const maxEnrollment = Math.max(1, ...analytics.rows.map((row) => row.enrolled));
                  const percent = Math.round((course.enrolled / maxEnrollment) * 100);
                  return (
                    <div key={course.id}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <span className="truncate text-sm font-medium text-gray-800">{index + 1}. {course.title}</span>
                        <span className="shrink-0 text-sm font-semibold text-gray-900">{course.enrolled} enrollment{course.enrolled === 1 ? '' : 's'}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
