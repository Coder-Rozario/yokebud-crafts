import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, ToastContainer } from 'react-toastify';
import { FiSearch, FiMail, FiMessageSquare, FiClock, FiSend, FiArrowLeft, FiCheckCircle, FiUser } from 'react-icons/fi';
import 'react-toastify/dist/ReactToastify.css';
import { apiFetch } from '../../utils/api';

const AdminMessages = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMessageList, setShowMessageList] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await apiFetch('/api/messages', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();
        setMessages(data);
        const unread = data.filter(msg => !msg.is_read).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 30000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMobile && selectedMessage) {
      setShowMessageList(false);
    } else {
      setShowMessageList(true);
    }
  }, [isMobile, selectedMessage]);

  const handleSelectMessage = async (message) => {
    if (!message.is_read) {
      try {
        const response = await apiFetch(`/api/messages/${message.id}/read`, {
          method: 'PUT',
          credentials: 'include'
        });
        if (response.ok) {
          setMessages(prev => prev.map(msg =>
            msg.id === message.id ? { ...msg, is_read: 1 } : msg
          ));
          setUnreadCount(prev => prev - 1);
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
    setSelectedMessage(message);
    if (isMobile) setShowMessageList(false);
  };

  const handleBackToList = () => {
    setShowMessageList(true);
    if(isMobile) setSelectedMessage(null); 
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedMessage) return;

    setIsSendingReply(true);

    try {
      const response = await apiFetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messageId: selectedMessage.id,
          email: selectedMessage.email,
          replyText: replyText
        }),
      });

      if (response.ok) {
        toast.success('Reply sent successfully!');
        setReplyText('');
        setMessages(prev => prev.map(msg =>
          msg.id === selectedMessage.id ? { ...msg, is_replied: 1 } : msg
        ));
      } else {
        throw new Error('Failed to send reply');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const filteredMessages = messages.filter(message => 
    message.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Premium Modern Styles (Fixed Scrolling & Width) ---
  const cssStyles = `
    /* Fix: Use flexbox for full viewport height without overflow */
    .admin-container {
      display: flex;
      height: 100vh;
      width: 100%;
      background-color: #09090b;
      color: #e0e0e0;
      font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
      overflow: hidden; /* Prevent body scroll */
    }

    /* Fix: Main content flex column to manage header + inbox height */
    .main-content {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 2rem;
      overflow: hidden;
      position: relative;
    }
    
    @media (max-width: 768px) {
      .main-content { margin-left: 0; padding: 1rem; }
    }
    
    .page-header {
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0; /* Prevent header from shrinking */
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }
    
    /* Fix: Inbox Layout uses flex:1 to fill remaining space */
    .inbox-layout {
      display: flex;
      gap: 1.5rem;
      flex: 1;           /* Take remaining vertical space */
      min-height: 0;     /* Crucial for nested scrolling to work */
      width: 100%;
    }

    @media (max-width: 768px) {
      .inbox-layout { gap: 0; }
    }

    /* --- List Column --- */
    .message-list-col {
      flex: 1;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      background: rgba(30, 30, 35, 0.4);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      height: 100%; /* Fill parent */
      overflow: hidden;
    }

    @media (max-width: 768px) {
       /* On mobile, full width and toggle visibility */
       .message-list-col { 
          max-width: 100%; 
          display: ${!isMobile || showMessageList ? 'flex' : 'none'}; 
          width: 100%;
       }
    }

    .search-wrapper {
        position: relative;
        margin-bottom: 1rem;
        flex-shrink: 0;
    }
    .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #71717a;
    }
    .search-input {
      width: 100%;
      padding: 0.8rem 1rem 0.8rem 2.5rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
      color: #e0e0e0;
      font-size: 0.95rem;
      outline: none;
      transition: all 0.3s ease;
    }
    .search-input:focus {
      border-color: rgba(255, 165, 0, 0.5);
      box-shadow: 0 0 0 4px rgba(255, 165, 0, 0.1);
      background: rgba(0, 0, 0, 0.4);
    }

    /* Scrollable List - Independent Scroll */
    .scrollable-list {
        overflow-y: auto;
        padding-right: 5px;
        flex: 1; /* Grow to fill space */
    }
    .scrollable-list::-webkit-scrollbar { width: 6px; }
    .scrollable-list::-webkit-scrollbar-track { background: transparent; }
    .scrollable-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
    .scrollable-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

    .message-item {
      padding: 1.2rem;
      margin-bottom: 0.8rem;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .message-item:hover {
       background: rgba(255, 255, 255, 0.06);
       transform: translateY(-2px);
    }
    .message-item.active {
       background: rgba(255, 165, 0, 0.08);
       border-color: rgba(255, 165, 0, 0.3);
    }
    .message-item.unread {
       border-left: 3px solid #FFA500;
    }
    
    .msg-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.4rem;
    }
    .msg-name { font-weight: 600; color: #fff; font-size: 0.95rem; }
    .msg-date { font-size: 0.75rem; color: #71717a; }
    .msg-preview {
        font-size: 0.85rem;
        color: #a1a1aa;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .msg-badges { display: flex; gap: 5px; margin-top: 8px; }
    .badge {
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .badge-new { background: rgba(255, 165, 0, 0.2); color: #FFA500; }
    .badge-replied { background: rgba(52, 211, 153, 0.15); color: #34d399; }

    /* --- Details Column --- */
    .message-detail-col {
      flex: 2;
      background: rgba(24, 24, 27, 0.6);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100%; /* Fill parent */
      overflow: hidden;
    }

    @media (max-width: 768px) {
       .message-detail-col { 
          display: ${isMobile && !showMessageList ? 'flex' : 'none'}; 
          width: 100%;
       }
    }

    .detail-header {
        padding: 1.5rem;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        background: rgba(0,0,0,0.2);
        flex-shrink: 0;
    }
    .detail-top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .detail-name { font-size: 1.4rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
    .detail-meta { display: flex; gap: 1.5rem; color: #a1a1aa; font-size: 0.9rem; margin-top: 5px; flex-wrap: wrap;}
    .detail-meta span { display: flex; align-items: center; gap: 6px; }

    /* Detail Body - Independent Scroll */
    .detail-body {
        flex: 1; /* Take remaining space */
        padding: 2rem;
        overflow-y: auto; /* Scroll only this part */
        font-size: 1.05rem;
        line-height: 1.7;
        color: #d4d4d8;
        white-space: pre-wrap;
    }
    .detail-body::-webkit-scrollbar { width: 6px; }
    .detail-body::-webkit-scrollbar-track { background: transparent; }
    .detail-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
    
    .detail-actions {
        padding: 1.5rem;
        border-top: 1px solid rgba(255,255,255,0.05);
        background: rgba(0,0,0,0.2);
        flex-shrink: 0;
    }
    .reply-area {
        position: relative;
    }
    .reply-textarea {
        width: 100%;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 1rem;
        color: #fff;
        font-size: 0.95rem;
        min-height: 100px;
        resize: vertical;
        outline: none;
        transition: all 0.3s;
    }
    .reply-textarea:focus {
        border-color: rgba(255, 165, 0, 0.4);
        background: rgba(255,255,255,0.05);
    }
    .send-btn {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%);
        color: #000;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .send-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(255, 165, 0, 0.3); }
    .send-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #52525b;
        text-align: center;
    }
    .back-btn {
        background: transparent;
        border: none;
        color: #FFA500;
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;
        margin-bottom: 1rem;
        cursor: pointer;
    }
  `;

  return (
    <div className="admin-container">
      <style>{cssStyles}</style>

      <main className="main-content">
        <header className="page-header">
          <h1 className="page-title">Inbox</h1>
        </header>

        <div className="inbox-layout">
            
            {/* --- Left Column: Message List --- */}
            <div className="message-list-col">
                <div className="search-wrapper">
                    <FiSearch className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="scrollable-list">
                    {isLoading ? (
                        <div style={{textAlign: 'center', padding: '2rem', color: '#71717a'}}>Loading...</div>
                    ) : (
                        <AnimatePresence>
                            {filteredMessages.length > 0 ? (
                                filteredMessages.map((message) => (
                                    <motion.div 
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`message-item ${selectedMessage?.id === message.id ? 'active' : ''} ${!message.is_read ? 'unread' : ''}`}
                                        onClick={() => handleSelectMessage(message)}
                                    >
                                        <div className="msg-header">
                                            <span className="msg-name">{message.name}</span>
                                            <span className="msg-date">{new Date(message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                        <div className="msg-preview">
                                            {message.message}
                                        </div>
                                        <div className="msg-badges">
                                            {!message.is_read && <span className="badge badge-new"><div style={{width: 6, height: 6, borderRadius: '50%', background: 'currentColor'}}></div> New</span>}
                                            {message.is_replied === 1 && <span className="badge badge-replied"><FiCheckCircle /> Replied</span>}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div style={{textAlign: 'center', padding: '2rem', color: '#52525b'}}>
                                    No messages found
                                </div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* --- Right Column: Message Details --- */}
            <div className="message-detail-col">
                {selectedMessage ? (
                    <>
                        {isMobile && (
                            <div style={{padding: '1rem', flexShrink: 0}}>
                                <button className="back-btn" onClick={handleBackToList}><FiArrowLeft /> Back</button>
                            </div>
                        )}
                        
                        <div className="detail-header">
                            <div className="detail-top-row">
                                <div className="detail-name">
                                    <FiUser style={{ color: '#FFA500', opacity: 0.8 }} /> {selectedMessage.name}
                                </div>
                                <div style={{display: 'flex', gap: 10}}>
                                    {selectedMessage.is_replied === 1 && <span className="badge badge-replied" style={{fontSize: '0.8rem', padding: '4px 10px'}}><FiCheckCircle /> Replied</span>}
                                </div>
                            </div>
                            <div className="detail-meta">
                                <span><FiMail size={14}/> {selectedMessage.email}</span>
                                <span><FiClock size={14}/> {new Date(selectedMessage.created_at).toLocaleString()}</span>
                                {selectedMessage.whatsapp && <span><FiMessageSquare size={14}/> {selectedMessage.whatsapp}</span>}
                            </div>
                        </div>

                        <div className="detail-body">
                            {selectedMessage.message}
                        </div>

                        <div className="detail-actions">
                            <form onSubmit={handleReplySubmit} className="reply-area">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="reply-textarea"
                                    placeholder={`Reply to ${selectedMessage.name}...`}
                                    disabled={isSendingReply}
                                />
                                <motion.button
                                    type="submit"
                                    className="send-btn"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={isSendingReply || !replyText.trim()}
                                >
                                    {isSendingReply ? 'Sending...' : <><FiSend /> Send Reply</>}
                                </motion.button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="empty-state">
                        <FiMessageSquare size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <h3 style={{ margin: 0, fontWeight: 600 }}>No message selected</h3>
                        <p style={{ fontSize: '0.9rem', maxWidth: '250px', margin: '10px auto', opacity: 0.6 }}>Choose a message from the list to view details and reply.</p>
                    </div>
                )}
            </div>

        </div>
      </main>
      
      <ToastContainer position="top-right" theme="dark" />
    </div>
  );
};

export default AdminMessages;