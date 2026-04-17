import React, { useEffect, useState } from "react";
import {
  RefreshCw, Download, Filter,
  ClipboardList, Users, Code, Clock,
  ChevronDown, ChevronUp, AlertCircle, FileText
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import AdminLayout from "./AdminLayout";

const API_ROOT = "http://localhost:3000/api";
const EXPORT_ROOT = `${API_ROOT}/export`;

// --- Components ---

const SubmissionsTable = ({ subs }) => {
  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'success' || s === 'accepted') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'failed' || s === 'wrong answer') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (s === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'running') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s === 'error' || s === 'compilation error') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'bg-slate-100 text-slate-700';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  return (
    <div className="w-full rounded-xl shadow-sm border border-slate-200 overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-slate-800 text-white uppercase text-xs font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Batch(es)</th>
              <th className="px-6 py-4">Question</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Score</th>
              <th className="px-6 py-4">Output</th>
              <th className="px-6 py-4">Language</th>
              <th className="px-6 py-4">Submitted At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subs.map((s, index) => (
              <tr
                key={s.id ?? `${s.student_id}-${s.question_id}-${s.createdAt}`}
                className="hover:bg-indigo-50/30 transition-colors duration-200 odd:bg-slate-50/30"
              >
                <td className="px-6 py-4 max-w-[220px]">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(s.student_name || 'U').charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm truncate max-w-[150px]">
                        {s.student_name || s.Student?.name || "Unknown"}
                      </h4>
                      <p className="text-xs text-slate-500 truncate max-w-[150px]">
                        {s.student_email || s.Student?.email || ""}
                      </p>
                    </div>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded border border-slate-200 text-[10px] text-slate-400 font-mono">
                    ID: {s.student_id ?? s.Student?.id ?? "-"}
                  </span>
                </td>

                <td className="px-6 py-4 max-w-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {(s.student_batches || s.Student?.Batches || []).length > 0 ? (
                      (s.student_batches || s.Student?.Batches || []).map((b, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                          {b?.code || b?.name}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] border border-slate-200">
                        Unassigned
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 max-w-[200px]">
                  <span className="font-semibold text-slate-700 line-clamp-2" title={s.question_title || s.Question?.title}>
                    {s.question_title || s.Question?.title || s.question_id}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(s.status)}`}>
                    {s.status ?? "-"}
                  </span>
                </td>

                <td className="px-6 py-4">
                  {s.score !== null && s.score !== undefined ? (
                    <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(s.score)}`}>
                      {s.score}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>

                <td className="px-6 py-4 max-w-[250px]">
                  <div className="font-mono text-xs bg-slate-50 p-2 rounded border border-slate-200 max-h-[80px] overflow-y-auto text-slate-600 whitespace-pre-wrap custom-scrollbar">
                    {String(s.output ?? s.stdout ?? "-")}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100 w-fit">
                    <Code size={12} />
                    <span className="text-xs font-bold">
                      {s.language || (s.language_id ? `Lang ${s.language_id}` : "Lang -")}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 min-w-[160px]">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock size={12} />
                    <span className="text-xs font-medium">
                      {s.createdAt || s.created_at || s.timestamp ?
                        new Date(s.createdAt || s.created_at || s.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "-"
                      }
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BatchAccordion = ({ batchTitle, count, children, isOpen, onToggle }) => {
  return (
    <div className={`mb-4 overflow-hidden rounded-xl border transition-all duration-300 ${isOpen ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white hover:from-indigo-50/50 hover:to-white transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          <div>
            <h3 className={`font-bold text-lg ${isOpen ? 'text-indigo-900' : 'text-slate-700'}`}>{batchTitle}</h3>
            <span className="text-sm font-medium text-slate-500">
              {count} {count === 1 ? 'submission' : 'submissions'}
            </span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 bg-white border-t border-indigo-50 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default function AdminCourseSubmissions() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [course, setCourse] = useState(null);
  const [batches, setBatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [expandedBatch, setExpandedBatch] = useState(null);

  // Grouping logic
  const groupByBatch = (subs) => {
    const grouped = {};
    subs.forEach((s) => {
      const studentBatches = s.Student?.Batches || s.student_batches || [];
      if (!studentBatches || studentBatches.length === 0) {
        if (!grouped.unassigned) grouped.unassigned = [];
        grouped.unassigned.push(s);
      } else {
        studentBatches.forEach((b) => {
          const batchId = b?.id ?? "unknown";
          if (!grouped[batchId]) grouped[batchId] = [];
          grouped[batchId].push(s);
        });
      }
    });
    return grouped;
  };

  const extractCourseFromResponse = (d) => {
    if (!d) return null;
    if (d.course) return d.course;
    if (d.data && d.data.course) return d.data.course;
    if (d.courseInfo) return d.courseInfo;
    if (d.courseDetails) return d.courseDetails;
    if (d.name || d.course_code || d.code) return d;
    if (Array.isArray(d.submissions) && d.submissions.length > 0 && d.submissions[0].course) return d.submissions[0].course;
    return null;
  };

  const downloadBlob = async (url) => {
    const token = localStorage.getItem("token") || "";
    try {
      const res = await axios.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: "blob",
        timeout: 120000
      });
      if (!res || !res.data) throw new Error("Empty response");
      const disposition = res.headers["content-disposition"] || res.headers["Content-Disposition"] || "";
      let filename = "";
      if (disposition) {
        const m = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
        if (m && m[1]) filename = decodeURIComponent(m[1]);
      }
      if (!filename) {
        const ct = (res.headers["content-type"] || "").toLowerCase();
        if (ct.includes("csv")) filename = `export_${Date.now()}.csv`;
        else if (ct.includes("sheet") || ct.includes("excel") || ct.includes("openxml")) filename = `export_${Date.now()}.xlsx`;
        else if (ct.includes("zip")) filename = `export_${Date.now()}.zip`;
        else filename = `export_${Date.now()}.bin`;
      }
      const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(blobUrl);
      return { ok: true, filename };
    } catch (err) {
      return { ok: false, error: err };
    }
  };

  const exportBatchUrl = (batchId) => `${EXPORT_ROOT}/batches/${batchId}/export`;
  const exportSubbatchUrl = (subbatchId) => `${EXPORT_ROOT}/subbatches/${subbatchId}/export`;
  const exportCourseCombinedUrl = (cId) => `${EXPORT_ROOT}/courses/${cId}/subbatches/combined`;

  const handleExportCourse = async () => {
    if (!courseId) return alert("Course ID missing");
    setExporting(true); setExportMsg("Preparing course export...");
    try {
      const url = exportCourseCombinedUrl(courseId);
      const out = await downloadBlob(url);
      if (!out.ok) throw out.error || new Error("Export failed");
      setExportMsg(`Download started: ${out.filename}`);
    } catch (err) {
      alert("Course export failed.");
    } finally {
      setTimeout(() => { setExporting(false); setExportMsg(""); }, 800);
    }
  };

  const handleExportBatch = async (batch) => {
    const id = batch?.id ?? batch?._id ?? batch?.code ?? batch?.batchId;
    if (!id) return alert("Batch identifier missing");
    setExporting(true); setExportMsg(`Preparing export for batch ${id}...`);
    try {
      const url = exportBatchUrl(id);
      const out = await downloadBlob(url);
      if (!out.ok) {
        const alt = exportSubbatchUrl(id);
        const out2 = await downloadBlob(alt);
        if (!out2.ok) throw out2.error || new Error("Batch export failed");
        setExportMsg(`Download started: ${out2.filename}`);
      } else {
        setExportMsg(`Download started: ${out.filename}`);
      }
    } catch (err) {
      alert("Batch export failed.");
    } finally {
      setTimeout(() => { setExporting(false); setExportMsg(""); }, 800);
    }
  };

  const fetchData = async () => {
    setLoading(true); setError(""); setCourse(null); setSubmissions([]); setBatches([]);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_ROOT}/submissions/admin/course/${courseId}`, { headers }).catch((err) => { throw err; });
      const d = res.data || {};
      let foundCourse = extractCourseFromResponse(d);
      setSubmissions(Array.isArray(d.submissions ?? d.data?.submissions ?? d.items ?? d.results) ? (d.submissions ?? d.data?.submissions ?? d.items ?? d.results) : []);
      try {
        const bRes = await axios.get(`${API_ROOT}/students/batches/${courseId}`, { headers });
        setBatches(bRes.data?.batches || []);
      } catch (errB) { setBatches([]); }
      // Course Fallback Logic omitted for brevity but retained conceptually if needed
      if (foundCourse) setCourse(foundCourse);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to fetch submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const grouped = groupByBatch(submissions || []);
  const unassignedCount = grouped.unassigned?.length || 0;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/50">
        <div className="fixed inset-0 pt-[64px] overflow-auto bg-slate-50">
          <div className="max-w-[1920px] mx-auto p-4 md:p-8 space-y-8">

            {/* Header Card */}
            <div className="lms-card overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r bg-indigo-600" />
              <div className="p-8 flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg shrink-0">
                  <ClipboardList size={40} />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Course Submissions</h1>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center">
                    <span className="font-bold text-slate-500 text-lg">
                      {course ? (course.name || course.title) : `Course ID: ${courseId}`}
                    </span>
                    {course?.course_code && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-sm font-bold border border-indigo-100 font-mono">
                        {course.course_code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleExportCourse}
                    disabled={exporting || loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {exporting ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
                    <span className="hidden md:inline">{exporting ? "Exporting..." : "Export All"}</span>
                  </button>
                  <button
                    onClick={fetchData}
                    disabled={loading || exporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    <span className="hidden md:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Export Message */}
            {exportMsg && (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <RefreshCw className="animate-spin" size={20} />
                {exportMsg}
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="lms-card flex flex-col items-center justify-center py-20">
                <RefreshCw className="animate-spin text-indigo-600 mb-4" size={48} />
                <p className="text-slate-500 font-bold text-lg">Loading submissions...</p>
              </div>
            ) : error ? (
              <div className="lms-card p-5 flex items-center gap-3 border-red-200 bg-red-50 text-red-700">
                <AlertCircle size={24} />
                {error}
              </div>
            ) : (
              <div className="space-y-6 pb-20">
                {batches.length === 0 && unassignedCount === 0 ? (
                  <div className="lms-card flex flex-col items-center justify-center py-20 text-center px-4">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <ClipboardList className="text-slate-300" size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-700 mb-2">No Submissions Found</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                      There are no submissions recorded for this course yet, or no batches have been assigned.
                    </p>
                  </div>
                ) : (
                  <>
                    {batches.map((batch) => {
                      const batchId = batch.id ?? batch._id ?? batch.code;
                      const batchSubs = grouped[batchId] || [];
                      const batchTitle = batch.code || batch.name || `Batch ${batchId}`;
                      const count = batchSubs.length;

                      return (
                        <BatchAccordion
                          key={batchId}
                          batchTitle={batchTitle}
                          count={count}
                          isOpen={expandedBatch === batchId}
                          onToggle={() => setExpandedBatch(expandedBatch === batchId ? null : batchId)}
                        >
                          {count > 0 ? (
                            <div className="space-y-4">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleExportBatch(batch)}
                                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                                >
                                  <Download size={14} />
                                  Export Batch
                                </button>
                              </div>
                              <SubmissionsTable subs={batchSubs} />
                            </div>
                          ) : (
                            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold">
                              No submissions in this batch
                            </div>
                          )}
                        </BatchAccordion>
                      );
                    })}

                    {unassignedCount > 0 && (
                      <BatchAccordion
                        batchTitle="Unassigned Students"
                        count={unassignedCount}
                        isOpen={expandedBatch === 'unassigned'}
                        onToggle={() => setExpandedBatch(expandedBatch === 'unassigned' ? null : 'unassigned')}
                      >
                        <SubmissionsTable subs={grouped.unassigned} />
                      </BatchAccordion>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}