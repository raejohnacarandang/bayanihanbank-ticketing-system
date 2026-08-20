import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, TicketCategory, CategoryInfo, Ticket } from '../types';
import { Button } from '../components/ui/Button';
import { ArrowLeft, CheckCircle2, AlertCircle, Send, Building } from 'lucide-react';

interface CreateTicketViewProps {
  currentUser: User;
  categories: CategoryInfo[];
  onSubmitTicket: (params: {
    subject: string;
    description: string;
    category: TicketCategory;
    subcategory?: string;
    attachmentName?: string;
    requesterName?: string;
  }) => Promise<Ticket>;
  onNavigateBack: () => void;
  onNavigateTicketDetail: (ticketId: string) => void;
}

export const CreateTicketView: React.FC<CreateTicketViewProps> = ({
  currentUser,
  categories,
  onSubmitTicket,
  onNavigateBack,
  onNavigateTicketDetail,
}) => {
  const activeCategories = categories.filter((c) => c.status === 'Active');
  const [category, setCategory] = useState<TicketCategory>(
    activeCategories[0]?.name ?? 'Hardware',
  );
  const [subcategory, setSubcategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [requesterName, setRequesterName] = useState(currentUser.name);
  const [formError, setFormError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  const selectedCategory = activeCategories.find((c) => c.name === category);
  const subcategoriesList =
    selectedCategory?.subcategory
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

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
      subcategory: subcategory.trim() || undefined,
      requesterName: requesterName.trim() || currentUser.name,
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
            <span className="text-3xl font-black font-mono text-emerald-900 block">
              #{createdTicket.id}
            </span>
            <span className="text-xs text-slate-600 block pt-1">
              Subject: &quot;{createdTicket.subject}&quot;
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => onNavigateTicketDetail(createdTicket.id)}
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
            >
              View Ticket Details
            </Button>
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200 bg-slate-900 text-white">
            <h2 className="text-xl font-bold tracking-tight">Create IT Service Request</h2>
            <p className="text-xs text-emerald-200 mt-1">
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
                  <Building className="w-4 h-4 text-emerald-600" />
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
                <div className="flex items-center gap-2">
<input
                      type="text"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
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
                onChange={(e) => {
                  setCategory(e.target.value as TicketCategory);
                  setSubcategory('');
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {activeCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Subcategory
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={subcategoriesList.length === 0}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {subcategoriesList.length === 0
                    ? 'No subcategories for this category'
                    : 'Select subcategory (optional)'}
                </option>
                {subcategoriesList.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
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
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
              />
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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit IT Request</span>
              </Button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};