import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeftLong } from 'react-icons/fa6';
import {
  FiBookOpen, FiUsers, FiVideo, FiTrendingUp, FiPlus, FiSearch,
  FiDownload, FiArrowUpRight, FiGraduationCap, FiFilter
} from 'react-icons/fi';
import img from '../../assets/empty.jpg';

const CHART_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#64748b'];
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const shortName = (value = 'Untitled course', max = 22) => value.length > max ? `${value.slice(0, max - 1)}…` : value;
const getId = (value) => typeof value === 'string' ? value : value?._id?.toString?.() || '';
const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function MetricCard({ label, value, helper, icon: Icon, tone }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function ChartCard({ title, subtitle, children, action }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
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
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState('name');

  const analytics = useMemo(() => {
    const rows = courses.map((course, index) => {
      const title = course?.title || `Course ${index + 1}`;
      const students = Array.isArray(course?.enrolledStudents) ? course.enrolledStudents : [];
      const lectures = Array.isArray(course?.lectures) ? course.lectures.length : 0;
      const price = Number(course?.price) || 0;
      return {
        id: getId(course?._id) || `${title}-${index}`,
        title,
        name: shortName(title),
        category: course?.category || 'Uncategorized',
        students,
        enrolled: students.length,
        lectures,
        price,
        revenue: price * students.length,
        published: Boolean(course?.isPublished),
      };
    });

    const categoryMap = new Map();
    rows.forEach((row) => categoryMap.set(row.category, (categoryMap.get(row.category) || 0) + 1));
    const totalEnrollments = rows.reduce((sum, row) => sum + row.enrolled, 0);
    const totalLectures = rows.reduce((sum, row) => sum + row.lectures, 0);
    const estimatedRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalValue = rows.reduce((sum, row) => sum + row.price, 0);
    const uniqueStudents = new Map();
    rows.forEach((course) => course.students.forEach((student) => {
      if (student && typeof student === 'object' && getId(student._id)) {
        const existing = uniqueStudents.get(getId(student._id)) || { ...student, courses: [] };
        if (!existing.courses.some((entry) => entry.id === course.id)) {
          existing.courses.push({ id: course.id, title: course.title });
        }
        uniqueStudents.set(getId(student._id), existing);
      }
    }));

    return {
      rows,
      totalEnrollments,
      totalLectures,
      estimatedRevenue,
      averageLectures: rows.length ? Math.round(totalLectures / rows.length) : 0,
      averagePrice: rows.length ? Math.round(totalValue / rows.length) : 0,
      publishedCount: rows.filter((row) => row.published).length,
      categoryData: [...categoryMap.entries()].map(([name, value]) => ({ name, value })),
      enrollmentData: [...rows].sort((a, b) => b.enrolled - a.enrolled),
      revenueData: [...rows].sort((a, b) => b.revenue - a.revenue),
      topCourses: [...rows].sort((a, b) => b.enrolled - a.enrolled).slice(0, 5),
      uniqueStudents: [...uniqueStudents.values()],
    };
  }, [courses]);

  const visibleStudents = useMemo(() => {
    const scopedCourses = selectedCourseId === 'all'
      ? analytics.rows
      : analytics.rows.filter((course) => course.id === selectedCourseId);
    const students = new Map();
    scopedCourses.forEach((course) => course.students.forEach((student) => {
      if (!student || typeof student !== 'object' || !getId(student._id)) return;
      const id = getId(student._id);
      const current = students.get(id) || { ...student, courses: [] };
      if (!current.courses.some((entry) => entry.id === course.id)) {
        current.courses.push({ id: course.id, title: course.title });
      }
      students.set(id, current);
    }));
    const query = studentSearch.trim().toLowerCase();
    return [...students.values()]
      .filter((student) => !query || [student.name, student.email].some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => studentSort === 'email'
        ? String(a.email || '').localeCompare(String(b.email || ''))
        : String(a.name || '').localeCompare(String(b.name || '')));
  }, [analytics.rows, selectedCourseId, studentSearch, studentSort]);

  const exportStudents = () => {
    const headers = ['Student name', 'Email', 'Courses'];
    const rows = visibleStudents.map((student) => [
      student.name || '',
      student.email || '',
      student.courses.map((course) => course.title).join('; '),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'teacher-student-enrollments.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Back to home" onClick={() => navigate('/')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50">
              <FaArrowLeftLong />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <FiGraduationCap size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-slate-950">Instructor workspace</p>
              <p className="text-xs text-slate-500">Course performance & student insights</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/createcourses')} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <FiPlus size={17} /> <span className="hidden sm:inline">Create course</span><span className="sm:hidden">Create</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-7 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img src={userData?.photoUrl || img} alt="Educator profile" className="h-16 w-16 shrink-0 rounded-2xl border border-white/20 object-cover shadow-lg sm:h-20 sm:w-20" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Your teaching overview</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back, {userData?.name || 'Educator'}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review course reach, understand who has enrolled, and use the insights below to decide what needs your attention.</p>
              </div>
            </div>
            <div className="grid min-w-[220px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-slate-300">Published courses</p>
                <p className="mt-2 text-2xl font-bold">{analytics.publishedCount}<span className="ml-1 text-sm font-medium text-slate-300">/ {courses.length}</span></p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-slate-300">Est. revenue</p>
                <p className="mt-2 text-2xl font-bold">{formatMoney(analytics.estimatedRevenue)}</p>
              </div>
            </div>
          </div>
          <p className="relative mt-5 text-xs text-slate-400">Revenue is an estimate using listed course price × enrollment count, not a verified payment or payout report.</p>
        </section>

        <section aria-label="Teaching metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Course enrollments" value={analytics.totalEnrollments.toLocaleString('en-IN')} helper="Total course seats filled across your courses" icon={FiUsers} tone="bg-blue-50 text-blue-700" />
          <MetricCard label="Unique students" value={analytics.uniqueStudents.length.toLocaleString('en-IN')} helper="Distinct enrolled students across your courses" icon={FiGraduationCap} tone="bg-violet-50 text-violet-700" />
          <MetricCard label="Lectures available" value={analytics.totalLectures.toLocaleString('en-IN')} helper={`Average ${analytics.averageLectures} lectures per course`} icon={FiVideo} tone="bg-teal-50 text-teal-700" />
          <MetricCard label="Average course price" value={formatMoney(analytics.averagePrice)} helper="Average listed price across your courses" icon={FiTrendingUp} tone="bg-amber-50 text-amber-700" />
        </section>

        {courses.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <FiBookOpen className="mx-auto text-slate-400" size={36} />
            <h2 className="mt-4 text-lg font-bold">Your analytics will appear here</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create a course to start tracking course content, enrollments, and student information.</p>
            <button type="button" onClick={() => navigate('/createcourses')} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Create your first course</button>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ChartCard title="Enrollment by course" subtitle="Compare enrollment counts across your course catalogue">
                <div style={{ height: Math.max(280, analytics.rows.length * 36) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.enrollmentData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={145} interval={0} tick={{ fill: '#475569', fontSize: 11 }} />
                      <Tooltip formatter={(value) => [value, 'Enrollments']} labelFormatter={(label) => `Course: ${label}`} />
                      <Bar dataKey="enrolled" name="Enrollments" fill="#2563eb" radius={[0, 6, 6, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
              <ChartCard title="Estimated revenue by course" subtitle="Revenue estimate based on current listed price and enrollments">
                <div style={{ height: Math.max(280, analytics.rows.length * 36) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={145} interval={0} tick={{ fill: '#475569', fontSize: 11 }} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Estimated revenue']} labelFormatter={(label) => `Course: ${label}`} />
                      <Bar dataKey="revenue" name="Estimated revenue" fill="#0f766e" radius={[0, 6, 6, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
              <ChartCard title="Lecture volume" subtitle="See which courses have the most learning content">
                <div style={{ height: Math.max(280, analytics.rows.length * 36) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={145} interval={0} tick={{ fill: '#475569', fontSize: 11 }} />
                      <Tooltip formatter={(value) => [value, 'Lectures']} labelFormatter={(label) => `Course: ${label}`} />
                      <Bar dataKey="lectures" name="Lectures" fill="#7c3aed" radius={[0, 6, 6, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
              <ChartCard title="Course mix" subtitle="Distribution of your courses by category">
                {analytics.categoryData.length ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={analytics.categoryData} dataKey="value" nameKey="name" cx="50%" cy="46%" outerRadius={96} innerRadius={54} paddingAngle={3} label={({ name, value }) => `${shortName(name, 12)} (${value})`}>
                          {analytics.categoryData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Courses']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-12 text-center text-sm text-slate-500">Category data is not available yet.</p>}
              </ChartCard>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Course performance</h2>
                  <p className="mt-1 text-sm text-slate-500">Compare student demand, content volume, and course status.</p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{analytics.rows.length} courses</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Course</th><th className="px-5 py-3.5 font-semibold">Category</th><th className="px-5 py-3.5 text-right font-semibold">Lectures</th><th className="px-5 py-3.5 text-right font-semibold">Students</th><th className="px-5 py-3.5 text-right font-semibold">Price</th><th className="px-5 py-3.5 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...analytics.rows].sort((a, b) => b.enrolled - a.enrolled).map((course) => (
                      <tr key={course.id} className="transition hover:bg-slate-50">
                        <td className="max-w-[280px] px-5 py-4"><p className="truncate font-semibold text-slate-900">{course.title}</p><p className="mt-1 text-xs text-slate-500">{formatMoney(course.price)} listed price</p></td>
                        <td className="px-5 py-4 text-slate-600">{course.category}</td>
                        <td className="px-5 py-4 text-right tabular-nums text-slate-700">{course.lectures}</td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">{course.enrolled}</td>
                        <td className="px-5 py-4 text-right tabular-nums text-slate-700">{formatMoney(course.price)}</td>
                        <td className="px-5 py-4 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${course.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{course.published ? 'Published' : 'Draft'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><FiUsers className="text-blue-600" size={20} /><h2 className="text-lg font-bold text-slate-950">Student enrollment directory</h2></div>
                    <p className="mt-1 text-sm text-slate-500">Inspect enrolled students, filter by course, search contact details, and export the current list.</p>
                  </div>
                  <button type="button" onClick={exportStudents} disabled={visibleStudents.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    <FiDownload size={16} /> Export CSV
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_190px]">
                  <label className="relative block">
                    <span className="sr-only">Search students</span>
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search by student name or email" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                  </label>
                  <label className="relative block">
                    <span className="sr-only">Filter by course</span>
                    <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
                      <option value="all">All courses</option>
                      {analytics.rows.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="sr-only">Sort students</span>
                    <select value={studentSort} onChange={(event) => setStudentSort(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
                      <option value="name">Sort: Name A–Z</option>
                      <option value="email">Sort: Email A–Z</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Showing <strong className="text-slate-800">{visibleStudents.length}</strong> student{visibleStudents.length === 1 ? '' : 's'}</span>
                  <span>Student details are available for courses returned with populated enrollment data.</span>
                </div>
              </div>

              {visibleStudents.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-3.5 font-semibold">Student</th><th className="px-5 py-3.5 font-semibold">Email</th><th className="px-5 py-3.5 font-semibold">Enrolled courses</th><th className="px-5 py-3.5 text-right font-semibold">Course count</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleStudents.map((student) => (
                        <tr key={getId(student._id)} className="transition hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {student.photoUrl ? <img src={student.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{String(student.name || 'S').trim().charAt(0).toUpperCase()}</span>}
                              <span className="font-semibold text-slate-900">{student.name || 'Unnamed student'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{student.email || 'Email unavailable'}</td>
                          <td className="max-w-[420px] px-5 py-4"><div className="flex flex-wrap gap-1.5">{student.courses.map((course) => <span key={course.id} className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{course.title}</span>)}</div></td>
                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-800">{student.courses.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FiUsers size={22} /></div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">{studentSearch ? 'No matching students' : 'No student details available yet'}</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{studentSearch ? 'Try another name or email, or clear your search.' : 'When students enroll in your courses, their available profile details will appear here.'}</p>
                  {studentSearch && <button type="button" onClick={() => setStudentSearch('')} className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800">Clear search</button>}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><FiArrowUpRight size={20} /></span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Teacher insight</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {analytics.rows.length && analytics.totalEnrollments
                      ? `“${[...analytics.rows].sort((a, b) => b.enrolled - a.enrolled)[0].title}” currently has the highest enrollment count (${[...analytics.rows].sort((a, b) => b.enrolled - a.enrolled)[0].enrolled}). Use the course filter above to inspect its enrolled students.`
                      : 'Once students enroll, this dashboard will help you compare demand and review the student directory.'}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
