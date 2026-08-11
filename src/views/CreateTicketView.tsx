import React, { useState } from 'react';
import { User, TicketCategory, TicketPriority, Ticket } from '../types';
import { ArrowLeft, CheckCircle2, Upload, AlertCircle, FileText, Send, Building } from 'lucide-react';

interface CreateTicketViewProps {
  currentUser: User;
  onSubmitTicket: (params: {
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    attachmentName?: string;
  }) => Promise<Ticket>;
  onNavigateBack: () => void;
  onNavigateTicketDetail: (ticketId: string) => void;
}

export const CreateTicketView: React.FC<CreateTicketViewProps> = ({
  currentUser,
  onSubmitTicket,
  onNavigateBack,
  onNavigateTicketDetail,
}) => {
  const [category, setCategory] = useState<TicketCategory>('Hardware');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  const categoriesList: TicketCategory[] = [
    'Hardware',
    'Software',
    'Network',
    'Account & Access',
    'Installation / Configuration',
    'IT Equipment',
    'Other IT Concern',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentName(e.target.files[0].name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!subject.trim()) {
      setFormError('Please enter a brief subject describing the IT concern.');
      return;
    }

    if (!description.trim()) {
      setFormError('Please describe the problem or request in detail.');
      return;
    }

    const ticket = await onSubmitTicket({
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority,
      attachmentName: attachmentName || undefined,
    });

    setCreatedTicket(ticket);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets Dashboard</span>
        </button>

        <span className="text-xs text-slate-400 font-mono">
          Bayanihan Bank IT Support Ticket
        </span>
      </div>

      {/* Success Modal / State */}
      {createdTicket ? (
        <div className="bg-white rounded-2xl p-8 border border-emerald-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">
              Ticket Submitted Successfully!
            </h2>
            <p className="text-sm text-slate-600">
              Your IT request has been recorded and routed to Main IT Department.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-md mx-auto space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
              Generated Ticket Number
            </span>
            <span className="text-3xl font-black font-mono text-blue-900 block">
              #{createdTicket.id}
            </span>
            <span className="text-xs text-slate-600 block pt-1">
              Subject: &quot;{createdTicket.subject}&quot;
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigateTicketDetail(createdTicket.id)}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-md cursor-pointer"
            >
              View Ticket Details
            </button>
            <button
              onClick={onNavigateBack}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      ) : (
        /* Ticket Submission Form */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-900 text-white">
            <h2 className="text-xl font-bold tracking-tight">Create IT Service Request</h2>
            <p className="text-xs text-blue-200 mt-1">
              Submit hardware, software, or network issues to Main IT Department
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {formError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Requesting Branch & Requester Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Requesting Branch
                </label>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>{currentUser.branchName || 'Unisan Branch'}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    READ-ONLY
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Requester Employee Name
                </label>
                <div className="text-sm font-bold text-slate-800">
                  {currentUser.name}
                </div>
              </div>
            </div>

            {/* Request Type / Category */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Request Type / Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Subject / Short Summary <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Printer is not working at Counter 1"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Detailed Problem Description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the problem or request in detail. Include any error messages displayed, station numbers, or steps leading up to the issue."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
              />
            </div>

            {/* Priority Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Initial Priority Classification <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Note: Priority classification is subject to IT review.
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['Low', 'Medium', 'High', 'Critical'] as TicketPriority[]).map((p) => (
                  <label
                    key={p}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 ${
                      priority === p
                        ? 'bg-blue-900 text-white border-blue-900 font-bold shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                      className="sr-only"
                    />
                    <span className="text-xs">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* File Attachment Simulator */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Attachment (Optional)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Upload className="w-6 h-6 text-slate-400" />
                  {attachmentName ? (
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>{attachmentName}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-slate-600">
                      Click or drag a file here (Screenshots, photos, or documents)
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    Supported: PNG, JPG, PDF, DOCX (Max 10MB)
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={onNavigateBack}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit IT Request</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
