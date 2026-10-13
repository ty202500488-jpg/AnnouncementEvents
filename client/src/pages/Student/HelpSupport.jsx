import { useState } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';
import '../styles/Profile.css';

export default function HelpSupport() {
  const [ticket, setTicket] = useState({
    subject: '',
    category: 'general',
    message: '',
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      q: 'How do I follow or unfollow a university department page?',
      a: 'You can view all approved university and department pages in the right sidebar. Click on any page to view their feed and manage your following status.'
    },
    {
      q: 'How do I update my student profile information?',
      a: 'Navigate to your Profile page from the left sidebar and click the "Edit Profile" button to update your personal details and academic program.'
    },
    {
      q: 'Why am I not receiving notification alerts?',
      a: 'Check your Settings page to make sure that notification toggles for announcements, events, and followed pages are enabled.'
    },
    {
      q: 'How are announcements posted and approved?',
      a: 'Announcements are published by authorized staff members of each department and go through system verification before showing up in your feed.'
    }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTicket(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!ticket.subject || !ticket.message) return;

    // Simulate sending support ticket
    setSuccessMessage('Support ticket submitted successfully! Our team will get back to you via email.');
    setTicket({ subject: '', category: 'general', message: '' });
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const filteredFaqs = faqs.filter(faq => 
    faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout activePage="help">
      {/* ==================== CENTER MAIN CONTENT (HELP & SUPPORT) ==================== */}
      <main className="lg-col-6 space-y-6">
        {successMessage && (
          <div className="alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <span>{successMessage}</span>
          </div>
        )}

        {/* FAQ Section */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Frequently Asked Questions</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Find quick answers to common questions about Crimson.</p>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <input 
              type="text" 
              placeholder="Search help topics..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="space-y-4">
            {filteredFaqs.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', textAlign: 'center', padding: '1rem' }}>No matching help topics found.</p>
            ) : (
              filteredFaqs.map((faq, index) => (
                <div key={index} style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '0.375rem' }}>
                    <i className="fa-solid fa-circle-question" style={{ color: 'var(--color-primary)', marginRight: '0.5rem' }}></i>
                    {faq.q}
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', lineHeight: 1.5, paddingLeft: '1.5rem' }}>
                    {faq.a}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit Support Ticket Card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Submit a Support Ticket</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Need further assistance? Reach out to our technical support team.</p>
            </div>
          </div>

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="form-group full-span">
              <label>Issue Category</label>
              <select 
                name="category" 
                value={ticket.category} 
                onChange={handleChange} 
                className="form-input"
              >
                <option value="general">General Inquiry</option>
                <option value="account">Account & Profile Issues</option>
                <option value="announcement">Announcement / Page Access</option>
                <option value="technical">Technical Bug Report</option>
              </select>
            </div>

            <div className="form-group full-span">
              <label>Subject</label>
              <input 
                type="text" 
                name="subject" 
                placeholder="Brief summary of your issue"
                value={ticket.subject} 
                onChange={handleChange} 
                className="form-input" 
                required 
              />
            </div>

            <div className="form-group full-span">
              <label>Message</label>
              <textarea 
                name="message" 
                rows="4" 
                placeholder="Describe your issue in detail..."
                value={ticket.message} 
                onChange={handleChange} 
                className="form-input"
                required
              ></textarea>
            </div>

            <div className="flex items-center justify-end" style={{ marginTop: '1.5rem' }}>
              <button type="submit" className="save-profile-btn">
                Submit Ticket
              </button>
            </div>
          </form>
        </div>
      </main>
    </DashboardLayout>
  );
}