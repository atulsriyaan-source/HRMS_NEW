import React, { useState, useEffect } from 'react';
import { C, SHADOW, RADIUS, TYPOGRAPHY } from '../../theme';

const AnnouncementMaster = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIXED: Added 'Description' fields initialization anchor parameters
  const initialFormState = {
    Notice: '',
    Description: '',
    NoticeDate: '',
    EndDate: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState(null); 

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/announcements');
      const data = await response.json();
      setAnnouncements(data);
    } catch (err) {
      console.error("Failed to fetch notices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const openAddModal = () => {
    setFormData({
      ...initialFormState,
      NoticeDate: new Date().toISOString().split('T')[0]
    });
    setSelectedFile(null); 
    setIsEditMode(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    // FIXED: Hydrating 'Description' attribute block for update sequence routing
    setFormData({
      Notice: item.Notice,
      Description: item.Description || '',
      NoticeDate: item.NoticeDate ? new Date(item.NoticeDate).toISOString().split('T')[0] : '',
      EndDate: item.EndDate ? new Date(item.EndDate).toISOString().split('T')[0] : ''
    });
    setSelectedFile(null); 
    setEditId(item.id);
    setIsEditMode(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    // FIXED: Added description processing strings inside multipart structure configuration
    const dataPayload = new FormData();
    dataPayload.append('Notice', formData.Notice);
    dataPayload.append('Description', formData.Description);
    dataPayload.append('NoticeDate', formData.NoticeDate);
    if (formData.EndDate) dataPayload.append('EndDate', formData.EndDate);
    
    if (selectedFile) {
      dataPayload.append('Photo', selectedFile);
    }

    const url = isEditMode 
      ? `http://localhost:5000/api/admin/announcements/${editId}`
      : 'http://localhost:5000/api/admin/announcements';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        body: dataPayload, 
      });

      if (!response.ok) throw new Error("Failed to store announcement record.");

      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this announcement permanently?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/announcements/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error("Deletion rejected by server.");
        fetchAnnouncements();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const formatDateLabel = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString();
  };

  return (
    <div style={{ fontFamily: TYPOGRAPHY.fontFamily }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: C.secondary }}>Notice Board</h2>
        <button onClick={openAddModal} style={styles.addBtn}>+ Create Announcement</button>
      </div>

      <div style={styles.tableContainer}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ borderBottom: `2px solid ${C.borderLight}` }}>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Title / Notice</th>
              <th style={styles.th}>Description</th> {/* FIXED: Column Added */}
              <th style={styles.th}>Image Preview</th> 
              <th style={styles.th}>Notice Date</th>
              <th style={styles.th}>Created Date</th>
              <th style={styles.th}>End Date</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((item) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={styles.td}>#{item.id}</td>
                <td style={{ ...styles.td, maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong style={{ color: C.secondary }}>{item.Notice}</strong>
                </td>
                
                {/* FIXED: Dynamic inline tracking content mapping display box */}
                <td style={{ ...styles.td, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: C.text }}>{item.Description || <span style={{color: C.muted, fontSize: '12px'}}>No Description</span>}</span>
                </td>

                <td style={styles.td}>
                  {item.Photo ? (
                    <img 
                      src={`http://localhost:5000/uploads/${item.Photo}`} 
                      alt="notice entry" 
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  ) : <span style={{ color: C.muted, fontSize: '12px' }}>No Image</span>}
                </td>

                <td style={styles.td}>{formatDateLabel(item.NoticeDate)}</td>
                <td style={styles.td}>{formatDateLabel(item.CreatedDate)}</td>
                <td style={styles.td}>
                  {item.EndDate ? (
                    <span style={{ color: new Date(item.EndDate) < new Date() ? C.danger : C.success, fontWeight: '600' }}>
                      {formatDateLabel(item.EndDate)}
                    </span>
                  ) : <span style={{ color: C.muted }}>Indefinite</span>}
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <button onClick={() => openEditModal(item)} style={styles.actionBtn.edit}>Edit</button>
                  <button onClick={() => handleDelete(item.id)} style={styles.actionBtn.delete}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {announcements.length === 0 && !isLoading && (
          <div style={{ padding: '30px', textAlign: 'center', color: C.muted }}>No announcements have been published yet.</div>
        )}
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: C.secondary }}>{isEditMode ? 'Modify Announcement' : 'New System Announcement'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeModalBtn}>&times;</button>
            </div>

            {formError && <div style={styles.errorBanner}>{formError}</div>}

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={styles.label}>Notice Header / Title *</label>
                <input 
                  type="text"
                  name="Notice" 
                  value={formData.Notice} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="e.g., Independence Day Holiday Notice"
                  style={styles.input}
                />
              </div>

              {/* FIXED: Form Area Input Node Injection for Description tracking */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={styles.label}>Detailed Description / Content Block</label>
                <textarea 
                  name="Description" 
                  value={formData.Description} 
                  onChange={handleInputChange} 
                  rows={4}
                  placeholder="Type full instructions or comprehensive information context updates here..."
                  style={{ ...styles.input, resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={styles.label}>Notice Date *</label>
                  <input type="date" name="NoticeDate" value={formData.NoticeDate} onChange={handleInputChange} required style={styles.input} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={styles.label}>End Date (Optional)</label>
                  <input type="date" name="EndDate" value={formData.EndDate} onChange={handleInputChange} style={styles.input} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={styles.label}>Upload Banner / Attachment Image (Optional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  style={{ ...styles.input, background: '#f8fafc' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px', borderTop: `1px solid ${C.borderLight}`, paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  {isSubmitting ? 'Uploading...' : (isEditMode ? 'Update Notice' : 'Publish Notice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  tableContainer: { overflowX: 'auto', backgroundColor: C.card, borderRadius: RADIUS.card, boxShadow: SHADOW.card },
  th: { padding: '16px', color: C.muted, fontWeight: '600', fontSize: '14px' },
  td: { padding: '16px', color: C.text, fontSize: '14px', verticalAlign: 'middle' },
  addBtn: { border: "none", background: C.accent, color: "#fff", padding: "12px 20px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" },
  label: { marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: C.secondary },
  input: { padding: '12px', borderRadius: RADIUS.input || '8px', border: `1px solid ${C.borderLight}`, outline: 'none', fontSize: '14px' },
  submitBtn: { border: "none", background: C.accent, color: "#fff", padding: "12px 22px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" },
  cancelBtn: { backgroundColor: 'transparent', color: C.muted, border: `1px solid ${C.borderLight}`, padding: '12px 22px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  closeModalBtn: { background: 'none', border: 'none', fontSize: '26px', cursor: 'pointer', color: C.muted },
  errorBanner: { color: C.danger, padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '8px', marginBottom: '14px', fontSize: '14px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' },
  actionBtn: {
    edit: { backgroundColor: 'transparent', color: '#eab308', border: '1px solid #eab308', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', marginRight: '8px', fontSize: '13px', fontWeight: '500' },
    delete: { backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }
  }
};

export default AnnouncementMaster;