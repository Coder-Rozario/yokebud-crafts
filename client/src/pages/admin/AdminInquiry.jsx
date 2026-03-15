import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiMessageSquare, FiUser, FiMail, FiPhone,
  FiShoppingCart, FiClock, FiCheck, FiX, FiEye, FiSend,
  FiPaperclip, FiEdit, FiChevronLeft, FiChevronRight,
  FiImage, FiDollarSign, FiCheckCircle, FiAlertCircle,
  FiLoader, FiRefreshCw, FiArrowLeft, FiMessageCircle,
  FiExternalLink, FiFile, FiBell, FiMenu, FiX as FiClose
} from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import io from 'socket.io-client';
import { apiFetch } from '../../utils/api';

// --- PREMIUM THEME CONFIGURATION ---
const THEME = {
  colors: {
    bg: '#050505',
    glassBg: 'rgba(20, 20, 20, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    silverGradient: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
    goldGradient: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    goldRaw: '#BF953F',
    textMain: '#FFFFFF',
    textSec: '#B0B0B0',
    accent: '#E74C3C',
    green: '#2ECC71',
    inputBg: 'rgba(0, 0, 0, 0.3)'
  },
  shadows: {
    card: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    glow: '0 0 15px rgba(191, 149, 63, 0.2)', 
  },
  textStyles: {
    silverTitle: {
      background: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 'bold'
    }
  }
};

// Socket.IO client
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://api.yokebud.fi';
const socket = io(BACKEND_URL, {
  transports: ['websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  forceNew: true,
  timeout: 10000
});

// Constants
const FILE_ICONS = {
  'image/jpeg': FiImage,
  'image/jpg': FiImage,
  'image/png': FiImage,
  'image/webp': FiImage,
  'image/gif': FiImage,
  'application/pdf': FiFile,
  'text/plain': FiFile,
  'application/msword': FiFile,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FiFile,
  'application/vnd.ms-excel': FiFile,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FiFile,
  'application/zip': FiFile,
  'application/vnd.rar': FiFile
};

// Enhanced time formatting
const formatTime = (timestamp) => {
  if (!timestamp) return 'Unknown';
  try {
    const now = new Date();
    const time = new Date(timestamp);
    if (isNaN(time.getTime())) return 'Invalid date';
    
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return time.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Time error';
  }
};

// Helper functions
const getStatusColor = (status) => {
  switch (status) {
    case 'new': return '#e74c3c';
    case 'pending': return THEME.colors.goldRaw;
    case 'processing': return '#3498db';
    case 'completed': return THEME.colors.green;
    case 'cancelled': return '#95a5a6';
    default: return '#95a5a6';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'new': return 'New Inquiry';
    case 'pending': return 'Pending';
    case 'processing': return 'Processing';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};

const safeJsonParse = (str, fallback = {}) => {
  if (!str) return fallback;
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (error) {
    return fallback;
  }
};

const formatPriceRange = (productData) => {
  if (!productData) return 'N/A';
  
  const minPrice = parseFloat(productData.min_price) || parseFloat(productData.discounted_price) || parseFloat(productData.price) || 0;
  const maxPrice = parseFloat(productData.max_price) || parseFloat(productData.price) || 0;
  
  const toEUR = (val) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(val || 0));
  if (minPrice === maxPrice) {
    return toEUR(minPrice);
  }
  
  return `${toEUR(minPrice)} - ${toEUR(maxPrice)}`;
};

// UI Components
const AutoExpandingTextarea = ({ value, onChange, placeholder, disabled, onSend, className = '' }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onSend) onSend();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyPress={handleKeyPress}
      className={`auto-expanding-textarea ${className}`}
      rows={1}
    />
  );
};

const ProductGallery = ({ product, isMobile }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const safeProduct = { product_photos: [], ...product };
  const processedPhotos = Array.isArray(safeProduct.product_photos)
    ? safeProduct.product_photos
    : (typeof safeProduct.product_photos === 'string'
      ? safeJsonParse(safeProduct.product_photos || '[]')
      : []);

  const nextImage = (e) => {
    e.stopPropagation();
    if (processedPhotos.length === 0) return;
    setCurrentImageIndex(prev => prev === processedPhotos.length - 1 ? 0 : prev + 1);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    if (processedPhotos.length === 0) return;
    setCurrentImageIndex(prev => prev === 0 ? processedPhotos.length - 1 : prev - 1);
  };

  const className = `product-gallery ${isMobile ? 'mobile' : ''}`;

  if (processedPhotos.length === 0) {
    return (
      <div className={`${className} no-image`}>
        <FiImage size={24} />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="product-gallery-image-wrapper">
        <img
          src={processedPhotos[currentImageIndex]}
          alt={product.product_name}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="product-gallery-image-error">
          <FiImage size={24} />
        </div>
      </div>

      {processedPhotos.length > 1 && (
        <>
          <button onClick={prevImage} className="gallery-nav prev">
            <FiChevronLeft />
          </button>
          <button onClick={nextImage} className="gallery-nav next">
            <FiChevronRight />
          </button>
          <div className="gallery-counter">
            {currentImageIndex + 1}/{processedPhotos.length}
          </div>
        </>
      )}
    </div>
  );
};

const FileMessage = ({ files }) => {
  const imageFiles = files.filter(file => file.type && file.type.startsWith('image/'));
  const otherFiles = files.filter(file => !file.type || !file.type.startsWith('image/'));

  return (
    <div className="file-message-container">
      {imageFiles.map((file, index) => (
        <div key={`img-${index}`} className="file-message-image">
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            <img 
              src={file.url} 
              alt={file.name} 
              onError={(e) => { 
                e.target.style.display = 'none'; 
                e.target.closest('.file-message-image').classList.add('error');
              }}
            />
          </a>
        </div>
      ))}

      {otherFiles.map((file, index) => {
        const FileIcon = FILE_ICONS[file.type] || FiFile;
        return (
          <div
            key={`file-${index}`}
            className="file-message-item"
            onClick={() => window.open(file.url, '_blank')}
          >
            <FileIcon size={16} />
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-size">
                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'File'}
              </div>
            </div>
            <button
              className="file-open-button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(file.url, '_blank');
              }}
            >
              <FiExternalLink size={10} />
              Open
            </button>
          </div>
        );
      })}
    </div>
  );
};

const FilePreview = ({ files, onRemove }) => (
  <div className="file-preview-container">
    {files.map((file, index) => {
      const isImage = file.type && file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      const Icon = isImage ? FiImage : FiPaperclip;

      return (
        <div key={index} className="file-preview-item">
          {isImage && previewUrl ? (
            <img src={previewUrl} alt="Preview" className="file-image-preview" onLoad={() => URL.revokeObjectURL(previewUrl)} />
          ) : (
            <Icon size={12} />
          )}
          <span>{file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="remove-file-button"
          >
            <FiX size={12} />
          </button>
        </div>
      );
    })}
  </div>
);

const StatusBadge = ({ status, className = '' }) => (
  <span
    className={`status-badge ${className}`}
    style={{ 
      background: 'rgba(0,0,0,0.3)',
      color: getStatusColor(status),
      border: `1px solid ${getStatusColor(status)}`
    }}
  >
    {getStatusText(status)}
  </span>
);

const InquiryListItem = React.memo(({ inquiry, isSelected, onSelect }) => {
  const productData = inquiry.product_data;
  const hasUnreadMessages = inquiry.admin_unread_count > 0;
  const hasNewStatus = inquiry.status === 'new';

  let itemClasses = 'inquiry-list-item';
  if (isSelected) itemClasses += ' selected';
  if (hasNewStatus) itemClasses += ' new-status';
  if (hasUnreadMessages) itemClasses += ' unread';

  return (
    <motion.div
      className={itemClasses}
      onClick={() => onSelect(inquiry)}
      whileHover={{ scale: 1.01, borderColor: THEME.colors.goldRaw }}
      whileTap={{ scale: 0.99 }}
      layout
    >
      <div className="item-row top">
        <span className="item-customer">
          {hasUnreadMessages && <span className="unread-dot"></span>}
          {inquiry.customer_name}
        </span>
        <span className="item-time">
          {formatTime(inquiry.last_activity || inquiry.created_at)}
        </span>
      </div>
      
      <div className="item-row product">
        <FiShoppingCart size={14} style={{color: THEME.colors.goldRaw}} />
        <span className="item-product-name">{productData?.product_name}</span>
      </div>

      <div className="item-row bottom">
        <span className="item-inquiry-number">
          {inquiry.inquiry_number}
        </span>
        
        {/* --- MODIFIED: Only show status badge if status is NEW --- */}
        {inquiry.status === 'new' && <StatusBadge status={inquiry.status} />}
        
        {hasUnreadMessages && (
          <span className="admin-unread-badge">
            {inquiry.admin_unread_count}
          </span>
        )}
      </div>
    </motion.div>
  );
});

const InquiryList = ({ inquiries, selectedInquiry, isLoading, onSelectInquiry }) => {
  return (
    <div className="inquiry-list-container">
      {isLoading ? (
        <div className="list-loading-placeholder">
          <FiLoader size={24} className="spin" style={{color: THEME.colors.goldRaw}} />
          <div style={{marginTop: '10px', color: THEME.colors.textSec}}>Loading inquiries...</div>
        </div>
      ) : inquiries.length > 0 ? (
        <AnimatePresence>
          {inquiries.map((inquiry) => (
            <InquiryListItem
              key={inquiry.id}
              inquiry={inquiry}
              isSelected={selectedInquiry?.id === inquiry.id}
              onSelect={onSelectInquiry}
            />
          ))}
        </AnimatePresence>
      ) : (
        <div className="list-empty-placeholder">
          <FiMessageSquare size={48} style={{color: THEME.colors.textSec, opacity: 0.5}} />
          <h3 className="premium-text-silver">No inquiries found</h3>
          <p style={{color: THEME.colors.textSec}}>Try adjusting your search filters</p>
        </div>
      )}
    </div>
  );
};

const CustomerInfo = ({ inquiry }) => (
  <div className="context-card">
    <h3 className="context-card-title">
      <FiUser style={{color: THEME.colors.goldRaw}}/> 
      <span className="premium-text-silver">Customer Information</span>
    </h3>
    <div className="context-card-body">
      <div className="info-item">
        <strong>Name:</strong>
        <div>{inquiry.customer_name}</div>
      </div>
      <div className="info-item">
        <strong>Email:</strong>
        <div>{inquiry.customer_email}</div>
      </div>
      <div className="info-item">
        <strong>Phone:</strong>
        <div>{inquiry.customer_phone}</div>
      </div>
      <div className="info-item">
        <strong>Company:</strong>
        <div>{inquiry.customer_company || 'N/A'}</div>
      </div>
      <div className="info-item">
        <strong>Country:</strong>
        <div>{inquiry.customer_country || 'N/A'}</div>
      </div>
    </div>
  </div>
);

const ProductInfo = ({
  inquiry,
  productDetail,
  isMobile
}) => {
  const productData = inquiry.product_data;

  return (
    <div className="context-card">
      <h3 className="context-card-title">
        <FiShoppingCart style={{color: THEME.colors.goldRaw}}/> 
        <span className="premium-text-silver">Product & Pricing</span>
      </h3>
      <div className="context-card-body">
        <div className="product-info-header">
          <div className="product-info-gallery">
            <ProductGallery product={productData} isMobile={isMobile} />
          </div>
          <div className="product-info-summary">
            <div className="product-info-name">
              {productData?.product_name}
            </div>
            <div className="product-info-meta">
              <div>SKU: {productData?.sku || 'N/A'}</div>
              <div>MOQ: {productData?.moq || 'N/A'}</div>
            </div>
          </div>
        </div>

        {productDetail && (
          <div className="product-info-details">
            <div><strong>Material:</strong> {productDetail.material || 'N/A'}</div>
            <br/>
            <div><strong>Care:</strong> {productDetail.care_instructions || 'N/A'}</div>
            {productDetail.features?.length > 0 && (
              <div>
                <br/>
                <strong>Features:</strong> {productDetail.features.slice(0, 2).join(', ')}...
              </div>
            )}
          </div>
        )}

        <div className="product-info-order">
          <div className="info-item">
            <span>Order Quantity:</span>
            <span className="order-quantity-badge">
              {productData?.quantity || '1'}
            </span>
          </div>
          <div className="info-item-meta">
            Size: {productData?.selectedSize || 'Customizable'} <br/><br/>
            Original Price: {formatPriceRange(productData)}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatInterface = ({
  inquiry,
  messages,
  isSending,
  onSendMessage
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileAttach = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx'; 
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        setAttachedFiles(prev => [...prev, ...files]);
      }
    };
    input.click();
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && attachedFiles.length === 0) || !inquiry) return;
    if (isSending) return;

    const messageToSend = newMessage.trim();
    const filesToSend = [...attachedFiles];
    
    if (!messageToSend && filesToSend.length === 0) return;

    setNewMessage('');
    setAttachedFiles([]);

    await onSendMessage(inquiry.id, messageToSend, filesToSend);
  };

  return (
    <div className="chat-interface">
      <div 
        ref={messagesContainerRef}
        className="message-list"
      >
        {messages.length === 0 ? (
          <div className="chat-empty-placeholder">
            <FiMessageSquare size={32} style={{color: THEME.colors.goldRaw, opacity: 0.5}}/>
            <div style={{color: THEME.colors.textSec}}>No messages yet</div>
            <div style={{ fontSize: '12px', marginTop: '5px', color: THEME.colors.textSec }}>Start the conversation</div>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id || `${msg.timestamp}-${Math.random()}`}
              className={`message-bubble ${msg.sender_type === 'user' ? 'user' : 'admin'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="message-header">
                <span className="message-sender">{msg.sender_type === 'user' ? 'Customer' : 'Admin'}</span>
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
              {msg.message && <div className="message-content">{msg.message}</div>}
              {msg.files && msg.files.length > 0 && (
                <FileMessage files={msg.files} />
              )}
            </motion.div>
          ))
        )}
        {isSending && (
          <motion.div
            className="message-bubble admin sending"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="sending-indicator">
              <FiLoader className="spin" />
              <span>Sending...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-area">
        {attachedFiles.length > 0 && (
          <FilePreview files={attachedFiles} onRemove={handleRemoveFile} />
        )}
        <div className="message-input-wrapper">
          <button
            type="button"
            className="chat-action-button"
            onClick={handleFileAttach}
            title="Attach files"
          >
            <FiPaperclip />
          </button>
          <AutoExpandingTextarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            onSend={handleSendMessage}
            className="chat-textarea"
          />
          <button
            type="button"
            className="chat-action-button send"
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && attachedFiles.length === 0) || isSending}
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
};

const InquiryDetail = ({
  inquiry,
  messages,
  productDetail,
  isSending,
  isMobile,
  onStatusUpdate,
  onSendMessage,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState('chat');

  if (isMobile && !inquiry) return null;

  if (!inquiry) {
    return (
      <div className="inquiry-detail-container placeholder">
        <FiEye size={48} style={{color: THEME.colors.goldRaw, opacity: 0.5}}/>
        <h3 className="premium-text-silver">Select an inquiry to view details</h3>
        <p style={{color: THEME.colors.textSec}}>Click on an inquiry from the list to view its details and reply</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="inquiry-detail-container mobile">
        <div className="mobile-detail-header">
          <button className="back-to-list-button" onClick={onBack}>
            <FiArrowLeft /> Inquiries
          </button>
          <div className="mobile-detail-tabs">
            <button
              className={activeTab === 'chat' ? 'active' : ''}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={activeTab === 'info' ? 'active' : ''}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
          </div>
        </div>
        <div className="mobile-content-area">
          {activeTab === 'chat' && (
            <ChatInterface
              inquiry={inquiry}
              messages={messages}
              isSending={isSending}
              onSendMessage={onSendMessage}
            />
          )}
          {activeTab === 'info' && (
            <div className="context-sidebar">
              <div className="context-sidebar-scrollable">
                <div className="status-updater-mobile">
                  <h3 className="context-card-title premium-text-silver">Update Status</h3>
                  <select
                    value={inquiry.status}
                    onChange={(e) => onStatusUpdate(inquiry.id, e.target.value, true)}
                  >
                    <option value="new">New Inquiry</option>
                  </select>
                </div>
                <CustomerInfo inquiry={inquiry} />
                <ProductInfo
                  inquiry={inquiry}
                  productDetail={productDetail}
                  isMobile={isMobile}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="inquiry-detail-container">
      <div className="chat-area">
        <div className="chat-header">
          <div>
            <h2 className="chat-title premium-text-silver">{inquiry.inquiry_number}</h2>
            <p className="chat-subtitle">
              Chat with {inquiry.customer_name}
            </p>
          </div>

        </div>
        <ChatInterface
          inquiry={inquiry}
          messages={messages}
          isSending={isSending}
          onSendMessage={onSendMessage}
        />
      </div>

      <div className="context-sidebar">
        <div className="context-sidebar-scrollable">
          <CustomerInfo inquiry={inquiry} />
          <ProductInfo
            inquiry={inquiry}
            productDetail={productDetail}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
};

// MAIN ADMIN INQUIRY COMPONENT
const AdminInquiry = () => {
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [productDetails, setProductDetails] = useState({});
  const [messages, setMessages] = useState({});
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const inquiriesRef = useRef(inquiries);
  const selectedInquiryIdRef = useRef(selectedInquiryId);
  const messagesRef = useRef(messages);

  useEffect(() => {
    inquiriesRef.current = inquiries;
    selectedInquiryIdRef.current = selectedInquiryId;
    messagesRef.current = messages;
  }, [inquiries, selectedInquiryId, messages]);

  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // DATABASE-DRIVEN STATUS MANAGEMENT
  const updateInquiryStatus = async (inquiryId, newStatus, suppressToast = false) => {
    try {
      const response = await fetch(`/api/inquiries/${inquiryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (!suppressToast) {
          toast.success(`Status updated to ${getStatusText(newStatus)}`);
        }
        
        return result;
      } else {
        throw new Error('Failed to update status in database');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
      throw error;
    }
  };

  // REAL-TIME INQUIRY FETCHING
  const fetchInquiries = useCallback(async (isManual = false) => {
    try {
      if (!isManual) setIsLoading(true);

      const response = await apiFetch('/api/inquiries', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch inquiries');

      const data = await response.json();
      
      const processedInquiries = data.map(inquiry => {
        if (inquiry.messages && inquiry.messages.length > 0) {
          const lastMessage = inquiry.messages[inquiry.messages.length - 1];
          return {
            ...inquiry,
            last_activity: lastMessage.timestamp || lastMessage.created_at || inquiry.last_activity,
            created_at: inquiry.messages[0].timestamp || inquiry.messages[0].created_at || inquiry.created_at,
            is_checkout_active: inquiry.is_checkout_active || false,
            price_data: inquiry.price_data || null,
            admin_unread_count: inquiry.admin_unread_count || 0
          };
        }
        return inquiry;
      });

      // Filter out inquiries with no messages (empty/invalid)
      const sortedData = processedInquiries
        .filter(inquiry => inquiry.messages && inquiry.messages.length > 0)
        .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
        
      setInquiries(sortedData);

      sortedData.forEach(inquiry => {
        loadMessages(inquiry.id, inquiry.messages || []);
      });

    } catch (error) {
      console.error('Error fetching inquiries:', error);
      if (isManual) toast.error('Failed to refresh inquiries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (inquiryId, initialMessages = []) => {
    try {
      const response = await apiFetch(`/api/inquiries/${inquiryId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(prev => ({
            ...prev,
            [inquiryId]: data.inquiry.messages || []
          }));
        }
      } else {
        setMessages(prev => ({
          ...prev,
          [inquiryId]: initialMessages
        }));
      }
    } catch (error) {
      setMessages(prev => ({
        ...prev,
        [inquiryId]: initialMessages
      }));
    }
  }, []);

  useEffect(() => {
    fetchInquiries(false);
  }, [fetchInquiries]);

  const manualRefresh = useCallback(() => {
    setIsManualRefresh(true);
    fetchInquiries(true);
    setTimeout(() => setIsManualRefresh(false), 1000);
    toast.success('Inquiries refreshed!');
  }, [fetchInquiries]);

  // MARK ADMIN MESSAGES AS READ WHEN OPENED
  const markAdminMessagesAsRead = useCallback(async (inquiryId) => {
    try {
      const response = await apiFetch(`/api/inquiries/${inquiryId}/messages/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userType: 'admin' })
      });
      // Optimistic update regardless; backend will sync via future fetch/socket
      setInquiries(prev => prev.map(inq =>
        inq.id === inquiryId ? { ...inq, admin_unread_count: 0 } : inq
      ));
      return response.ok;
    } catch (e) {
      // Keep silent; not critical for UX
      return false;
    }
  }, []);

  // REAL-TIME SOCKET.IO UPDATES
  useEffect(() => {
    console.log('Setting up Socket.IO listeners for real-time status updates...');

    const handleNewInquiry = (data) => {
      console.log('New inquiry received:', data);
      toast.info(`📨 New inquiry from ${data.customerName}`, {
        position: "top-right",
        autoClose: 3000
      });

      // Refresh inquiries to get the latest data
      fetchInquiries(true);
    };

    const handleInquiryUpdated = (data) => {
      console.log('Inquiry updated via socket:', data);
      
      setInquiries(prev => 
        prev.map(inq => 
          inq.id === data.inquiryId
            ? { ...inq, status: data.status, last_activity: data.last_activity }
            : inq
        ).sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity))
      );

      // Show status change notification
      if (data.status === 'completed') {
        toast.success(`✅ Inquiry ${data.inquiryId} completed`);
      }
    };

    const handleStatusUpdated = (data) => {
      console.log('Status updated via socket:', data);
      
      setInquiries(prev => 
        prev.map(inq => 
          inq.id === data.inquiryId
            ? { ...inq, status: data.status }
            : inq
        )
      );
    };

    const handleNewMessage = (message) => {
      const isUser = message.sender_type === 'user';
      if (isUser) {
        toast.info(`💬 New message from customer`, {
          position: "top-right",
          autoClose: 3000
        });
        if (inquiriesRef.current.find(inq => inq.id === message.inquiryId)?.status === 'new') {
          updateInquiryStatus(message.inquiryId, 'pending', true);
        }
      }

      setMessages(prev => {
        const existingMessages = prev[message.inquiryId] || [];
        const messageExists = existingMessages.some(
          msg => msg.id === message.id || (msg.temporaryId && msg.temporaryId === message.temporaryId)
        );
        if (messageExists) return prev;
        return {
          ...prev,
          [message.inquiryId]: [...existingMessages, message]
        };
      });
    };

    const handleMessageSent = (data) => {
      if (data.success && data.message && data.temporaryId) {
        setMessages(prev => {
          const existingMessages = prev[data.message.inquiryId] || [];
          const updatedMessages = existingMessages.map(msg => 
            msg.temporaryId === data.temporaryId 
              ? { ...data.message, id: data.message.id }
              : msg
          );

          if (!existingMessages.some(msg => msg.temporaryId === data.temporaryId)) {
            return {
              ...prev,
              [data.message.inquiryId]: [...existingMessages, data.message]
            };
          }

          return {
            ...prev,
            [data.message.inquiryId]: updatedMessages
          };
        });
      }
    };

    

    // Socket event listeners
    socket.on('connect', () => {
      console.log('✅ Admin connected to server via Socket.IO');
      inquiriesRef.current.forEach(inquiry => {
        socket.emit('join_inquiry', inquiry.id);
      });
    });

    socket.on('admin_new_inquiry', handleNewInquiry);
    socket.on('admin_inquiry_updated', handleInquiryUpdated);
    socket.on('inquiry_status_updated', handleStatusUpdated);
    socket.on('new_message', handleNewMessage);
    socket.on('message_sent', handleMessageSent);

    // Auto-refresh inquiries every 30 seconds for real-time updates
    const autoRefreshInterval = setInterval(() => {
      fetchInquiries(true);
    }, 30000);

    return () => {
      socket.off('admin_new_inquiry', handleNewInquiry);
      socket.off('admin_inquiry_updated', handleInquiryUpdated);
      socket.off('inquiry_status_updated', handleStatusUpdated);
      socket.off('new_message', handleNewMessage);
      socket.off('message_sent', handleMessageSent);
      clearInterval(autoRefreshInterval);
    };
  }, [fetchInquiries]);

  useEffect(() => {
    if (selectedInquiryId && socket.connected) {
      socket.emit('join_inquiry', selectedInquiryId);
    }
  }, [selectedInquiryId]);

  // Join inquiry rooms when inquiries are loaded to ensure real-time updates for all visible inquiries
  useEffect(() => {
    if (socket.connected && inquiries.length > 0) {
      inquiries.forEach(inquiry => {
        socket.emit('join_inquiry', inquiry.id);
      });
    }
  }, [inquiries]);

  const loadProductDetails = useCallback(async (productId) => {
    if (!productId || productDetails[productId]) return;
    try {
      const response = await apiFetch(`/api/products/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setProductDetails(prev => ({
          ...prev,
          [productId]: data
        }));
      }
    } catch (error) {
      console.error('Error loading product details:', error);
    }
  }, [productDetails]);

  // ENHANCED STATUS UPDATE HANDLER WITH DATABASE PERSISTENCE
  const handleStatusUpdate = useCallback(async (inquiryId, newStatus, suppressToast = false) => {
    try {
      await updateInquiryStatus(inquiryId, newStatus, suppressToast);
      
      // The real update will come via Socket.IO, but we update locally for immediate feedback
      setInquiries(prev => prev.map(inq =>
        inq.id === inquiryId ? { ...inq, status: newStatus, last_activity: new Date().toISOString() } : inq
      ));
      
    } catch (error) {
      console.error('Status update failed:', error);
    }
  }, []);

  const handleSelectInquiry = useCallback(async (inquiry) => {
    setSelectedInquiryId(inquiry.id);

    // Auto-update status from 'new' to 'pending' when admin opens inquiry
    if (inquiry.status === 'new') {
      await handleStatusUpdate(inquiry.id, 'pending', true);
    }

    if (inquiry.product_id) {
      loadProductDetails(inquiry.product_id);
    }
    
    if (!messagesRef.current[inquiry.id] || messagesRef.current[inquiry.id].length === 0) {
      loadMessages(inquiry.id);
    }

    // Clear admin unread count when opening
    if (inquiry.admin_unread_count > 0) {
      markAdminMessagesAsRead(inquiry.id);
    }
  }, [loadProductDetails, loadMessages, handleStatusUpdate, markAdminMessagesAsRead]);

  const handleBackToList = useCallback(() => {
    setSelectedInquiryId(null);
  }, []);

  

  const sendMessage = useCallback(async (inquiryId, messageText, files = []) => {
    if ((!messageText.trim() && files.length === 0) || !inquiryId) return;

    setIsSendingReply(true);

    const temporaryId = `admin-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage = {
      id: temporaryId,
      temporaryId: temporaryId,
      inquiryId: inquiryId,
      message: messageText,
      sender_type: 'admin',
      files: files,
      timestamp: new Date().toISOString(),
      is_read: true
    };

    setMessages(prev => ({
      ...prev,
      [inquiryId]: [...(prev[inquiryId] || []), tempMessage]
    }));

    try {
      let uploadedFiles = [];
      
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        
        const uploadResponse = await apiFetch(`/api/inquiries/${inquiryId}/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        
        if (uploadResponse.ok) {
          uploadedFiles = (await uploadResponse.json()).files || [];
        } else {
          throw new Error('File upload failed');
        }
      }

      socket.emit('send_message', {
        inquiryId: inquiryId,
        message: messageText,
        senderType: 'admin',
        files: uploadedFiles,
        temporaryId: temporaryId
      });

      // Auto-update status to 'processing' when admin sends first reply
      const currentInquiry = inquiriesRef.current.find(inq => inq.id === inquiryId);
      if (currentInquiry && (currentInquiry.status === 'new' || currentInquiry.status === 'pending')) {
        await handleStatusUpdate(inquiryId, 'processing', true);
      }
        
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => ({
        ...prev,
        [inquiryId]: (prev[inquiryId] || []).filter(msg => msg.temporaryId !== temporaryId)
      }));
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSendingReply(false);
    }
  }, [handleStatusUpdate]);

  const filteredInquiries = React.useMemo(() => {
    const sorted = [...inquiries].sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
    return sorted.filter(inquiry => {
      const matchesSearch =
        inquiry.inquiry_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inquiry.product_data?.product_name?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filterStatus === 'all' || inquiry.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [inquiries, searchTerm, filterStatus]);

  const selectedInquiry = React.useMemo(() => {
    return inquiries.find(inq => inq.id === selectedInquiryId) || null;
  }, [inquiries, selectedInquiryId]);

  const showList = !isMobile || (isMobile && !selectedInquiryId);
  const showDetail = !isMobile || (isMobile && selectedInquiryId);
  
  return (
    <div className="inquiry-container">
      {/* Mobile Header */}
      {isMobile && (
        <div className="mobile-header">
          <button 
            className="mobile-menu-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <FiClose size={24} /> : <FiMenu size={24} />}
          </button>
          <h1 className="mobile-title">
            <FiMessageSquare />
            <span className="premium-text-silver">Inquiries</span>
          </h1>
        </div>
      )}

      <main className="inquiry-main-content">
        {!isMobile && (
          <header className="inquiry-header">
            <motion.h1
              className="inquiry-title premium-text-silver"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <FiMessageSquare style={{color: THEME.colors.goldRaw, marginRight: '10px'}}/>
              Customer Inquiries
              <span style={{ fontSize: '0.5rem', marginLeft: '10px', color: THEME.colors.goldRaw }}>
                Real-time
              </span>
            </motion.h1>
          </header>
        )}

        <div className="inquiry-filters">
          <div className="search-wrapper">
            <FiSearch style={{color: THEME.colors.goldRaw}} />
            <input
              type="text"
              placeholder="Search by inquiry #, customer..."
              className="inquiry-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{display: 'flex', gap:'10px'}}>

          <select
            className="inquiry-status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="new">New Inquiry</option>
          </select>
          <button
            className="inquiry-refresh-button premium-btn-gold"
            onClick={manualRefresh}
            disabled={isManualRefresh}
          >
            <FiRefreshCw className={isManualRefresh ? 'spin' : ''} />
          </button>
          </div>

        </div>

        <div className="inquiry-layout">
          <AnimatePresence>
            {showList && (
              <motion.div
                key="list-panel"
                className={`inquiry-list-panel ${isMobile ? 'full' : ''}`}
                initial={isMobile ? { x: 0 } : false}
                animate={isMobile ? { x: 0 } : false}
                exit={isMobile ? { x: '-100%' } : false}
                transition={isMobile ? { duration: 0.3 } : false}
              >
                <InquiryList
                  inquiries={filteredInquiries}
                  selectedInquiry={selectedInquiry}
                  isLoading={isLoading}
                  onSelectInquiry={handleSelectInquiry}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDetail && (
              <motion.div
                key="detail-panel"
                className={`inquiry-detail-panel ${isMobile ? 'full' : ''}`}
                initial={isMobile ? { x: '100%' } : false}
                animate={isMobile ? { x: 0 } : false}
                exit={isMobile ? { x: '100%' } : false}
                transition={isMobile ? { duration: 0.3 } : false}
              >
                <InquiryDetail
                  inquiry={selectedInquiry}
                  messages={selectedInquiry ? messages[selectedInquiry.id] || [] : []}
                  productDetail={selectedInquiry ? productDetails[selectedInquiry.product_id] : null}
                  isSending={isSendingReply}
                  isMobile={isMobile}
                  onStatusUpdate={handleStatusUpdate}
                  onSendMessage={sendMessage}
                  onBack={handleBackToList}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }

          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: ${THEME.colors.bg};
          }
          ::-webkit-scrollbar-thumb {
            background: ${THEME.colors.goldRaw};
            border-radius: 3px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #D4AF37;
          }
          
          .premium-text-silver {
            background: ${THEME.colors.silverGradient};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 700;
          }

          .premium-btn-gold {
            background: ${THEME.colors.goldGradient};
            color: #000;
            border: none;
            font-weight: bold;
            box-shadow: ${THEME.shadows.glow};
            transition: all 0.3s ease;
          }
          .premium-btn-gold:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 15px rgba(191, 149, 63, 0.4);
          }
          .premium-btn-gold:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          .inquiry-container {
            display: flex;
            height: 100vh; /* Fixed height for viewport */
            width: 100%;   /* Use 100% width, handled by parent flex */
            background-color: ${THEME.colors.bg};
            color: ${THEME.colors.textMain};
            overflow: hidden; /* Prevent body scroll */
            position: relative;
          }

          /* Mobile Header */
          .mobile-header {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: ${THEME.colors.glassBg};
            backdrop-filter: blur(10px);
            border-bottom: 1px solid ${THEME.colors.glassBorder};
            z-index: 1000;
            padding: 0 1rem;
            align-items: center;
            gap: 1rem;
          }

          .mobile-menu-button {
            background: none;
            border: none;
            color: ${THEME.colors.goldRaw};
            cursor: pointer;
            padding: 8px;
          }

          .mobile-title {
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
            color: ${THEME.colors.goldRaw};
          }

          .sidebar-container { position: relative; }
          .sidebar-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999;
          }
          
          /* --- FIXED LAYOUT STYLES --- */
          .inquiry-main-content {
            flex: 1; /* Fill available space */
            /* margin-left: 250px; REMOVED per request */
            padding: 2rem;
            background-color: ${THEME.colors.bg};
            display: flex;
            flex-direction: column;
            height: 100%; /* Fill container height */
            overflow: hidden; /* Prevent double scrollbars */
          }
          
          .inquiry-header { margin-bottom: 1.5rem; flex-shrink: 0; }
          .inquiry-title {
            font-size: 1.8rem;
            margin: 0;
            display: flex;
            align-items: center;
          }

          .inquiry-filters {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
            flex-shrink: 0; /* Prevent shrinking */
          }
          
          .search-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            background: ${THEME.colors.glassBg};
            border: 1px solid ${THEME.colors.glassBorder};
            border-radius: 8px;
            padding: 0 1rem;
            min-width: 250px;
          }

          .inquiry-search-input {
            flex: 1;
            padding: 0.75rem;
            background: transparent;
            border: none;
            color: #fff;
            outline: none;
          }

          .inquiry-status-filter {
            padding: 0.75rem 1rem;
            border-radius: 8px;
            border: 1px solid ${THEME.colors.glassBorder};
            background-color: ${THEME.colors.glassBg};
            color: ${THEME.colors.textMain};
            cursor: pointer;
            min-width: 150px;
            outline: none;
          }
          .inquiry-status-filter option {
            background-color: #111;
          }

          .inquiry-refresh-button {
            padding: 0 1rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
          }

          /* --- FIXED SCROLLING LAYOUT --- */
          .inquiry-layout {
            display: flex;
            gap: 1.5rem;
            flex: 1; /* Take remaining vertical space */
            min-height: 0; /* Crucial for scrolling to work inside flex items */
            width: 100%;
          }
          
          .inquiry-list-panel {
            flex: 0 0 350px;
            display: flex;
            flex-direction: column;
            height: 100%; /* Fill parent height */
            overflow: hidden;
          }
          .inquiry-detail-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100%; /* Fill parent height */
            overflow: hidden;
          }
          
          .inquiry-list-container {
            background: ${THEME.colors.glassBg};
            border: 1px solid ${THEME.colors.glassBorder};
            border-radius: 12px;
            padding: 0.75rem;
            overflow-y: auto; /* Enable scroll here */
            flex: 1;
            backdrop-filter: blur(10px);
          }

          .list-loading-placeholder, .list-empty-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            padding: 2rem;
          }
          
          .inquiry-list-item {
            padding: 1rem;
            margin-bottom: 0.75rem;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid ${THEME.colors.glassBorder};
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .inquiry-list-item:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: ${THEME.colors.goldRaw};
          }

          .inquiry-list-item.new-status {
            border-left: 3px solid ${THEME.colors.accent};
          }
          
          .inquiry-list-item.selected {
            background: rgba(191, 149, 63, 0.15);
            border: 1px solid ${THEME.colors.goldRaw};
          }

          .unread-dot {
            width: 8px; height: 8px;
            background-color: ${THEME.colors.accent};
            border-radius: 50%;
            margin-right: 8px;
            display: inline-block;
          }

          .admin-unread-badge {
            background: ${THEME.colors.accent};
            color: white;
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 0.7rem;
            font-weight: bold;
          }

          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .item-customer {
            font-weight: 600;
            color: ${THEME.colors.textMain};
            font-size: 0.95rem;
            display: flex;
            align-items: center;
          }
          
          .item-time {
            font-size: 0.75rem;
            color: ${THEME.colors.textSec};
          }

          .item-product-name {
             color: ${THEME.colors.textSec};
             font-size: 0.85rem;
             margin-left: 5px;
          }

          .item-inquiry-number {
              font-size: 0.75rem;
              color: ${THEME.colors.goldRaw};
              font-family: monospace;
          }

          .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: capitalize;
            letter-spacing: 0.5px;
          }
          
          .inquiry-detail-container {
            flex: 1;
            background: ${THEME.colors.glassBg};
            border: 1px solid ${THEME.colors.glassBorder};
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            height: 100%;
            backdrop-filter: blur(10px);
          }
          
          .inquiry-detail-container.placeholder {
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          
          .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid ${THEME.colors.glassBorder};
            overflow: hidden;
          }
          .chat-header {
            padding: 1.25rem;
            border-bottom: 1px solid ${THEME.colors.glassBorder};
            background: rgba(0,0,0,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
          }
          .chat-title {
            margin: 0;
            font-size: 1.2rem;
          }
          .chat-subtitle {
            margin: 5px 0 0;
            color: ${THEME.colors.textSec};
            font-size: 0.85rem;
          }
          .chat-status-select select {
            padding: 0.5rem;
            border-radius: 6px;
            border: 1px solid ${THEME.colors.glassBorder};
            background-color: #000;
            color: ${THEME.colors.textMain};
            cursor: pointer;
          }
          
          .context-sidebar {
            flex: 0 0 320px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: rgba(0,0,0,0.2);
          }
          .context-sidebar-scrollable {
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem;
          }
          .context-card {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
            margin-bottom: 1.5rem;
            border: 1px solid ${THEME.colors.glassBorder};
          }
          .context-card-title {
            margin: 0;
            padding: 1rem;
            font-size: 1rem;
            border-bottom: 1px solid ${THEME.colors.glassBorder};
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .context-card-body {
            padding: 1rem;
          }
          .info-item {
            margin-bottom: 0.75rem;
            font-size: 0.9rem;
          }
          .info-item strong {
            color: ${THEME.colors.textSec};
            display: block;
            font-size: 0.75rem;
            margin-bottom: 2px;
          }
          
          .product-info-header {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
          }
          .product-info-gallery {
            width: 60px;
            height: 60px;
            flex-shrink: 0;
          }
          .product-gallery {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 6px;
            overflow: hidden;
            background-color: #000;
            border: 1px solid ${THEME.colors.glassBorder};
          }
          .product-gallery.no-image {
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${THEME.colors.textSec};
          }
          .product-gallery-image-wrapper { width: 100%; height: 100%; }
          .product-gallery-image-wrapper img { width: 100%; height: 100%; object-fit: cover; }
          
          .gallery-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0,0,0,0.7);
            border: none;
            color: #fff;
            cursor: pointer;
            padding: 2px;
            border-radius: 50%;
            display: flex;
          }
          .gallery-nav.prev { left: 2px; }
          .gallery-nav.next { right: 2px; }
          .gallery-counter {
            position: absolute; bottom: 2px; right: 2px;
            font-size: 0.6rem; background: rgba(0,0,0,0.7);
            padding: 1px 4px; border-radius: 4px;
          }

          .product-info-name {
            font-weight: 600;
            color: ${THEME.colors.goldRaw};
            font-size: 0.9rem;
            margin-bottom: 4px;
          }
          .product-info-meta {
            font-size: 0.75rem;
            color: ${THEME.colors.textSec};
          }
          .product-info-details {
            background: rgba(0,0,0,0.3);
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 0.8rem;
            color: ${THEME.colors.textSec};
            border: 1px solid ${THEME.colors.glassBorder};
          }
          .order-quantity-badge {
            font-weight: bold;
            color: ${THEME.colors.goldGradient};
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
          }

          .chat-interface {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .message-list {
            flex: 1;
            padding: 1.5rem;
            overflow-y: auto; /* Independent scroll */
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .chat-empty-placeholder {
            text-align: center;
            color: ${THEME.colors.textSec};
            margin: auto;
            opacity: 0.5;
          }
          .message-bubble {
            padding: 12px 16px;
            border-radius: 18px;
            max-width: 80%;
            word-wrap: break-word;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            white-space: pre-wrap;
            position: relative;
          }
          .message-bubble.user {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid ${THEME.colors.glassBorder};
            color: ${THEME.colors.textMain};
            align-self: flex-start;
            border-bottom-left-radius: 2px;
          }
          .message-bubble.admin {
            background: linear-gradient(135deg, rgba(191, 149, 63, 0.1), rgba(191, 149, 63, 0.2));
            border: 1px solid rgba(191, 149, 63, 0.3);
            color: #fff;
            align-self: flex-end;
            border-bottom-right-radius: 2px;
          }
          .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            gap: 10px;
            font-size: 0.65rem;
            opacity: 0.7;
            text-transform: capitalize;
            letter-spacing: 0.5px;
          }
          
          .message-input-area {
            padding: 1rem 1.5rem;
            border-top: 1px solid ${THEME.colors.glassBorder};
            background: rgba(0,0,0,0.3);
            flex-shrink: 0;
          }
          .message-input-wrapper {
            display: flex;
            gap: 10px;
            align-items: flex-end;
          }
          .chat-action-button {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid ${THEME.colors.glassBorder};
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: ${THEME.colors.goldRaw};
            transition: all 0.3s;
          }
          .chat-action-button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
          }
          .chat-action-button.send {
            background: ${THEME.colors.goldGradient};
            color: #000;
            border: none;
            box-shadow: ${THEME.shadows.glow};
          }
          .chat-action-button.send:disabled {
            background: rgba(255, 255, 255, 0.1);
            box-shadow: none;
            color: rgba(255,255,255,0.3);
          }
          
          .auto-expanding-textarea.chat-textarea {
            width: 100%;
            padding: 12px 15px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid ${THEME.colors.glassBorder};
            border-radius: 25px;
            color: #fff;
            font-size: 15px;
            outline: none;
            resize: none;
            line-height: 1.4;
            overflow-y: scroll; /* Force expand capability */
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE/Edge */
          }
          .auto-expanding-textarea.chat-textarea::-webkit-scrollbar {
            display: none;
          }
          .auto-expanding-textarea.chat-textarea:focus {
            border-color: ${THEME.colors.goldRaw};
          }

          .file-preview-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
          }
          .file-preview-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            font-size: 0.75rem;
            border: 1px solid ${THEME.colors.glassBorder};
          }
          .remove-file-button {
            background: none; border: none; color: #ff6b6b; cursor: pointer;
          }
          .file-message-image img {
            max-width: 200px;
            border-radius: 8px;
            border: 1px solid ${THEME.colors.glassBorder};
          }
          .file-message-item {
            padding: 8px 12px;
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid ${THEME.colors.glassBorder};
            margin-top: 5px;
          }
          .file-open-button {
            background: ${THEME.colors.goldGradient};
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            color: #000;
            cursor: pointer;
            font-size: 0.7rem;
            font-weight: bold;
            display: flex; align-items: center; gap: 4px;
          }

          /* Mobile Styles */
          @media (max-width: 900px) {
            .mobile-header { display: flex; }
            
            .sidebar-container.open .sidebar-overlay { display: block; }
            .sidebar-container.open .admin-sidebar { transform: translateX(0); }
            .admin-sidebar {
              position: fixed; top: 0; left: 0; height: 100vh;
              z-index: 1000; transform: translateX(-100%);
              transition: transform 0.3s ease;
            }

            .inquiry-main-content {
              margin-left: 0;
              padding: 1rem;
              width: 100vw;
              height: calc(100vh - 60px);
              margin-top: 60px;
            }

            .inquiry-layout {
              flex-direction: column;
              height: calc(100vh - 140px);
              position: relative;
            }
            .inquiry-list-panel, .inquiry-detail-panel {
              width: 100%; position: absolute; top: 0; left: 0; height: 100%;
            }
            
            .mobile-detail-header {
              display: flex; justify-content: space-between; align-items: center;
              padding: 1rem;
              background: #000;
              border-bottom: 1px solid ${THEME.colors.glassBorder};
            }
            .back-to-list-button {
              display: flex; align-items: center; gap: 8px;
              padding: 0.5rem 1rem;
              background: transparent;
              border: 1px solid ${THEME.colors.goldRaw};
              color: ${THEME.colors.goldRaw};
              border-radius: 6px;
              cursor: pointer;
            }
            .mobile-detail-tabs { display: flex; gap: 10px; }
            .mobile-detail-tabs button {
              padding: 6px 12px;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid ${THEME.colors.glassBorder};
              border-radius: 6px;
              color: ${THEME.colors.textSec};
            }
            .mobile-detail-tabs button.active {
              background: ${THEME.colors.goldGradient};
              color: #000;
              font-weight: bold;
              border: none;
            }
            
            .mobile-content-area {
              flex: 1; overflow: hidden; display: flex; flex-direction: column;
            }
            .mobile-content-area .chat-interface { height: 100%; }
            .mobile-content-area .context-sidebar { width: 100%; background: transparent; }
            
            .status-updater-mobile {
              background: rgba(255,255,255,0.05);
              padding: 1rem; border-radius: 8px; margin-bottom: 1rem;
              border: 1px solid ${THEME.colors.glassBorder};
            }
            .status-updater-mobile select {
              width: 100%; padding: 0.75rem;
              background: #000; color: #fff;
              border: 1px solid ${THEME.colors.glassBorder};
              border-radius: 6px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default AdminInquiry;