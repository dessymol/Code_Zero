import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FacultyNavbar from './FacultyNavbar';
import { AlertTriangle, User, BookOpen, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const API_VIOLATIONS = 'http://localhost:3000/api/submissions/faculty/violations';
const API_RESET_VIOLATIONS = (studentId, courseId) => `http://localhost:3000/api/submissions/faculty/reset-violations/${studentId}/${courseId}`;

export default function FacultyViolations() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(null);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_VIOLATIONS, { withCredentials: true });
      if (response.data.success) {
        setViolations(response.data.violations);
      }
    } catch (err) {
      setError('Failed to fetch violations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetViolations = async (studentId, courseId) => {
    try {
      setResetting({ studentId, courseId });
      const response = await axios.post(API_RESET_VIOLATIONS(studentId, courseId), {}, { withCredentials: true });
      if (response.data.success) {
        // Remove from local state
        setViolations(prev => prev.filter(v => !(v.studentId === studentId && v.courseId === courseId)));
      }
    } catch (err) {
      setError('Failed to reset violations');
      console.error(err);
    } finally {
      setResetting(null);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <FacultyNavbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading violations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <FacultyNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            Student Violations
          </h1>
          <p className="mt-2 text-slate-600">
            Monitor and manage student exam violations across your courses.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle size={20} />
              {error}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Violation Records</h2>
            <button
              onClick={fetchViolations}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="p-6">
            {violations.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No violations found</h3>
                <p className="text-slate-600">All students are following exam rules in your courses.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {violations.map((violation, index) => (
                  <div key={`${violation.studentId}-${violation.courseId}`} className="border border-slate-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <User className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{violation.studentName}</h3>
                          <p className="text-slate-600">{violation.studentEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-slate-600">Violations</div>
                          <div className={`text-lg font-bold ${violation.blocked ? 'text-red-600' : 'text-amber-600'}`}>
                            {violation.violationCount} / {violation.violationLimit}
                          </div>
                        </div>
                        {violation.blocked && (
                          <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
                            Blocked
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="h-4 w-4 text-slate-500" />
                      <span className="font-medium text-slate-900">{violation.courseName}</span>
                      <span className="text-slate-500">({violation.courseCode})</span>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-slate-900 mb-2">Violation History</h4>
                      <div className="space-y-2">
                        {violation.violations.map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                            <span className="text-slate-700">{v.reason}</span>
                            <span className="text-sm text-slate-500">
                              {new Date(v.time).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => resetViolations(violation.studentId, violation.courseId)}
                        disabled={resetting?.studentId === violation.studentId && resetting?.courseId === violation.courseId}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                      >
                        {resetting?.studentId === violation.studentId && resetting?.courseId === violation.courseId ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Give Another Chance
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}