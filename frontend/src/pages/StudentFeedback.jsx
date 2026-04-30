import React, { useEffect, useState } from 'react';
import axios from 'axios';
import StudentNavbar from './StudentNavbar';
import {
  MessageSquare, BookOpen, AlertCircle, CheckCircle,
  Lightbulb, Star, Calendar
} from 'lucide-react';

const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

const API_FEEDBACK = `${API_ORIGIN}/api/submissions/student/feedback`;

const normalizeFeedbackList = (payload) => {
  const list = Array.isArray(payload) ? payload
    : Array.isArray(payload?.feedback) ? payload.feedback
      : Array.isArray(payload?.data) ? payload.data
        : null;

  if (list) {
    return list
      .map((item) => item?.dataValues ? { ...item.dataValues, ...item } : item)
      .filter((item) => item && item.status !== 'pending');
  }

  if (!payload || typeof payload !== 'object') return [];

  const keys = Object.keys(payload);
  const looksLikeErrorPayload =
    keys.length === 0 ||
    (keys.length <= 3 && ('message' in payload || 'status' in payload || 'error' in payload));

  if (looksLikeErrorPayload) {
    return [];
  }

  if (keys.length > 0) {
    return [payload?.dataValues ? { ...payload.dataValues, ...payload } : payload];
  }
  return [];
};

const getFeedbackErrorMessage = (err) => {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return `Cannot reach the backend at ${API_ORIGIN}. Make sure the API server is running.`;
    }

    if (err.response.status === 401) {
      return 'Your session has expired. Please log in again to view feedback.';
    }

    return err.response.data?.message || 'Failed to load feedback';
  }

  return 'Failed to load feedback';
};

export default function StudentFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(API_FEEDBACK, { headers });
        const data = normalizeFeedbackList(res?.data);
        if (mounted) setFeedback(data);
      } catch (err) {
        console.error('Failed to load feedback:', err);
        if (mounted) setError(getFeedbackErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StudentNavbar />
        <div className="lms-container py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Loading feedback...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StudentNavbar />
        <div className="lms-container py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <AlertCircle size={48} className="text-red-500" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNavbar />
      <div className="lms-container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Feedback</h1>
          <p className="text-slate-600">View AI-generated feedback on your code submissions</p>
        </div>

        {feedback.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageSquare size={64} className="text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No feedback yet</h3>
            <p className="text-slate-500 text-center max-w-md">
              Feedback will appear here once your submissions have been evaluated by our AI system.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {feedback.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">
                      {item.Submission?.Question?.title || 'Unknown Question'}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <BookOpen size={14} />
                        {item.Submission?.Question?.Course?.name || 'Unknown Course'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {item.summary && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <CheckCircle size={16} className="text-emerald-600" />
                        Summary
                      </h4>
                      <p className="text-slate-600 bg-slate-50 rounded-lg p-3">{item.summary}</p>
                    </div>
                  )}

                  {item.what_went_wrong && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600" />
                        What went wrong
                      </h4>
                      <p className="text-slate-600 bg-red-50 rounded-lg p-3 border-l-4 border-red-200">{item.what_went_wrong}</p>
                    </div>
                  )}

                  {item.similarity_percentage !== null && item.similarity_percentage !== undefined && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <CheckCircle size={16} className="text-indigo-600" />
                        Similarity Score
                      </h4>
                      <p className="text-slate-600 bg-indigo-50 rounded-lg p-3 border-l-4 border-indigo-200">
                        {item.similarity_percentage}% match. {item.similarity_feedback}
                      </p>
                    </div>
                  )}

                  {item.testcase_feedback && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <AlertCircle size={16} className="text-orange-600" />
                        Testcase feedback
                      </h4>
                      <p className="text-slate-600 bg-orange-50 rounded-lg p-3 border-l-4 border-orange-200">{item.testcase_feedback}</p>
                    </div>
                  )}

                  {item.hint && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Lightbulb size={16} className="text-amber-600" />
                        Hint
                      </h4>
                      <p className="text-slate-600 bg-amber-50 rounded-lg p-3 border-l-4 border-amber-200">{item.hint}</p>
                    </div>
                  )}

                  {item.positive && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Star size={16} className="text-emerald-600" />
                        Positive aspects
                      </h4>
                      <p className="text-slate-600 bg-emerald-50 rounded-lg p-3 border-l-4 border-emerald-200">{item.positive}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
