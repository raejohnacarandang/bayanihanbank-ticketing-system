import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Ticket,
  KeyRound,
  Layers,
  UserCheck,
  Bell,
  AlertCircle,
  BookOpen,
  MessageSquare,
  Clock,
  CheckCircle2,
  Shield,
  Phone,
} from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
  category: string;
}

const FAQ_CATEGORIES = [
  'Getting Started',
  'Tickets',
  'Account & Access',
  'Notifications',
  'Troubleshooting',
];

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'How do I submit a new IT request?',
    answer:
      'Click "New IT Request" in the sidebar or dashboard. Fill in the subject, description, select a category and subcategory, then click Submit. You\'ll receive a unique ticket number (e.g. IT-000125) for tracking.',
    icon: <Ticket className="w-4 h-4" />,
    category: 'Tickets',
  },
  {
    id: '2',
    question: 'What IT categories are available?',
    answer:
      'The system supports: Hardware, Software, Network, Account & Access, Installation/Configuration, IT Equipment, and Other IT Concern. Each category has specific subcategories for more precise routing.',
    icon: <Layers className="w-4 h-4" />,
    category: 'Tickets',
  },
  {
    id: '3',
    question: 'How do I check the status of my ticket?',
    answer:
      'Go to "My Branch Tickets" in the sidebar. You can see all tickets from your branch with their current status (In Progress or Resolved). Click any ticket to view details, comments, and timeline.',
    icon: <Clock className="w-4 h-4" />,
    category: 'Tickets',
  },
  {
    id: '4',
    question: 'How do I know that my issue has been resolved?',
    answer:
      'When an IT Specialist marks your ticket as "Resolved," the ticket status updates immediately and the resolution notes appear in the ticket timeline. No further action is required from your branch.',
    icon: <CheckCircle2 className="w-4 h-4" />,
    category: 'Tickets',
  },
  {
    id: '5',
    question: 'How do I reset my password?',
    answer:
      'Click "Forgot Password?" on the login page. Enter your username and submit a reset request. Your IT administrator will be notified and will set a new password for you. For administrator accounts, a recovery key is required.',
    icon: <KeyRound className="w-4 h-4" />,
    category: 'Account & Access',
  },
  {
    id: '6',
    question: 'What are the different user roles?',
    answer:
      'Branch User: Submit and track IT requests for your branch. IT Specialist: Manage and resolve tickets across assigned branches. Administrator: Full system access including user management. Auditor: View-only access for compliance monitoring.',
    icon: <UserCheck className="w-4 h-4" />,
    category: 'Account & Access',
  },
  {
    id: '7',
    question: 'How do notifications work?',
    answer:
      'You\'ll receive real-time in-app notifications when your ticket status changes, when someone comments on your ticket, or when you\'re assigned a new ticket. Check the bell icon in the header for unread notifications.',
    icon: <Bell className="w-4 h-4" />,
    category: 'Notifications',
  },
  {
    id: '8',
    question: 'What does "Internal IT Note" mean in comments?',
    answer:
      'Internal notes are private comments visible only to IT Specialists and Administrators. Branch users cannot see these notes. Use them for internal coordination or sensitive information that shouldn\'t be shared with the requester.',
    icon: <Shield className="w-4 h-4" />,
    category: 'Tickets',
  },
  {
    id: '9',
    question: 'How do I use @mentions in comments?',
    answer:
      'Type @ followed by a username in the comment box to mention someone. They\'ll receive a notification about your comment. This is useful for directing questions or updates to specific team members.',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'Tickets',
  },
  {
    id: '10',
    question: 'Who do I contact for system issues?',
    answer:
      'For system access or login issues, contact the Main IT Department. For urgent matters, call the IT Helpdesk. You can also submit a ticket using the "Other IT Concern" category for general system issues.',
    icon: <Phone className="w-4 h-4" />,
    category: 'Getting Started',
  },
  {
    id: '11',
    question: 'What happens after a ticket is resolved?',
    answer:
      'Resolved is the final status. If the same problem returns, submit a new ticket and reference the original ticket number so IT has the full history.',
    icon: <AlertCircle className="w-4 h-4" />,
    category: 'Troubleshooting',
  },
  {
    id: '12',
    question: 'How do I access the Knowledge Base?',
    answer:
      'Click "Knowledge Base" in the sidebar to access step-by-step guides for using the system. It covers ticket workflows, best practices, and detailed explanations of each feature.',
    icon: <BookOpen className="w-4 h-4" />,
    category: 'Getting Started',
  },
];

export const HelpCenterView: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredItems = FAQ_ITEMS.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-emerald-600" />
          Help Center
        </h1>
        <p className="text-sm text-slate-500">
          Find answers to common questions about the Bayanihan Bank IT Service
          Desk
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Search frequently asked questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button type="button"
          onClick={() => setActiveCategory('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeCategory === 'All'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {FAQ_CATEGORIES.map((cat) => (
          <button type="button"
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeCategory === cat
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              No questions match your search. Try different keywords.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <motion.div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              initial={false}
            >
              <button type="button"
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {item.question}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {item.category}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    expandedId === item.id ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {expandedId === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-4 pt-0">
                      <div className="pl-11 text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                        {item.answer}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Need More Help?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-emerald-200">
            <p className="text-xs font-bold text-slate-900">Knowledge Base</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Step-by-step guides and workflow documentation
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-emerald-200">
            <p className="text-xs font-bold text-slate-900">IT Helpdesk</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Contact the Main IT Department for urgent issues
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
