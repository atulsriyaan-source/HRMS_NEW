import React, { useState, useEffect } from 'react';

const C = {
  primary: '#0369a1',
  secondary: '#334155',
  muted: '#64748b',
  accent: '#2b7da1',
  card: '#ffffff',
  text: '#0f172a',
  borderLight: '#e2e8f0',
  danger: '#ef4444',
  success: '#0f6e56',
  warning: '#b45309',
  warningBg: '#fff3cd'
};

const SelectGroup = ({ value, onChange, options, defaultLabel = "Select..." }) => (
  <select value={value} onChange={onChange} style={styles.inlineSelect}>
    <option value="">{defaultLabel}</option>
    {options.map(opt => (
      <option key={opt.id} value={opt.id}>{opt.name}</option>
    ))}
  </select>
);

const ManagerTimesheetReview = () => {
  const [teamLogs, setTeamLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  const [userContext, setUserContext] = useState({ id: null, name: '', role: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [weekOffset, setWeekOffset] = useState(0); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Controls Modal open state and target employee mapping tracking matrices
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Inline Edit State
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchMasterData = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/projects'),
        fetch('http://localhost:5000/api/admin/tasks')
      ]);
      if (projRes.ok) {
        const pData = await projRes.json();
        setProjects(pData.map(p => ({ id: p.projectid || p.id, name: p.projectcode || p.name })));
      }
      if (taskRes.ok) {
        const tData = await taskRes.json();
        setTasks(tData.map(t => ({ id: t.taskid || t.id, name: t.taskname || t.name })));
      }
    } catch (err) {
      console.error("Error loading master data:", err);
    }
  };

  const fetchTeamLogs = async (userId, role) => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/manager/timesheets?supervisorId=${userId}&role=${role}`);
      if (response.ok) {
        setTeamLogs(await response.json());
      }
    } catch (err) {
      console.error("Error accessing supervisor team data payload:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.id) {
      setUserContext({ id: storedUser.id, name: storedUser.name, role: storedUser.role });
      fetchMasterData();
      fetchTeamLogs(storedUser.id, storedUser.role);
    }
  }, []);

  // Close popup and drop pointers whenever timeline switches
  useEffect(() => {
    setSelectedEmployeeId(null);
    setIsModalOpen(false);
    setEditingRow(null);
  }, [selectedDate]);

  const getDaysInWeek = (offset) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); 
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayOfWeek + (offset * 7));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      days.push(dayDate);
    }
    return days;
  };

  const currentWeekDays = getDaysInWeek(weekOffset);
  const weekMonthLabel = currentWeekDays[0].toLocaleString('default', { month: 'short', year: 'numeric' });

  const getPendingAlertCount = (dateStr) => {
    return teamLogs.filter(t => t.timesheetdate && t.timesheetdate.split('T')[0] === dateStr && t.status === 0).length;
  };

  // --- MANAGER ACTIONS ---
  const handleReviewAction = async (timesheetid, targetStatus) => {
    setActionError(null);
    let rejectionComment = null;

    if (targetStatus === 2) {
      rejectionComment = window.prompt("Provide the operational reason for rejecting this entry row block:");
      if (rejectionComment === null) return; 
      if (rejectionComment.trim() === "") {
        alert("A comment is mandatory to let employees know what needs correction.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/manager/timesheets/review/${timesheetid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, supervisorId: userContext.id, rejection_comment: rejectionComment })
      });
      if (!response.ok) throw new Error("Could not update authorization tracking parameters.");
      
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const freshRes = await fetch(`http://localhost:5000/api/manager/timesheets?supervisorId=${storedUser.id}&role=${storedUser.role}`);
      if (freshRes.ok) {
        setTeamLogs(await freshRes.json());
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HR INLINE EDIT ACTIONS ---
  const handleEditClick = (row) => {
    setEditingRow(row.timesheetid);
    setEditForm({
      billingType: row.projectid && row.projectid !== 0 ? 'billable' : 'non-billable',
      projectid: row.projectid || '',
      taskid: row.taskid || '',
      tothrs: row.tothrs || '0',
      totmin: row.totmin || '0',
      comments: row.comments || ''
    });
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'billingType' && value === 'non-billable') {
        updated.projectid = '0';
        updated.taskid = '0';
      }
      return updated;
    });
  };

  const handleSaveEdit = async (timesheetid) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...editForm,
        activitytypeid: editForm.billingType === 'billable' ? 1 : 0,
        nonprojectactivityid: editForm.billingType === 'non-billable' ? 1 : 0,
        projectid: editForm.billingType === 'billable' ? editForm.projectid : 0,
        taskid: editForm.billingType === 'billable' ? editForm.taskid : 0,
        role: userContext.role
      };

      const response = await fetch(`http://localhost:5000/api/employee/timesheets/${timesheetid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save HR modifications.");
      
      setEditingRow(null);
      
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const freshRes = await fetch(`http://localhost:5000/api/manager/timesheets?supervisorId=${storedUser.id}&role=${storedUser.role}`);
      if (freshRes.ok) {
        setTeamLogs(await freshRes.json());
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetailsModal = (empId) => {
    setSelectedEmployeeId(empId);
    setIsModalOpen(true);
  };

  const activeDayEntries = teamLogs.filter(ts => ts.timesheetdate && ts.timesheetdate.split('T')[0] === selectedDate);

  const employeeSummaryMap = {};
  activeDayEntries.forEach(entry => {
    const empId = entry.employeeid || entry.EmployeeID;
    if (!employeeSummaryMap[empId]) {
      employeeSummaryMap[empId] = {
        id: empId,
        firstName: entry.FirstName,
        lastName: entry.LastName,
        departmentName: entry.DepartmentName || 'Operations',
        totalHours: 0,
        totalMins: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        rawEntries: []
      };
    }
    employeeSummaryMap[empId].totalHours += parseInt(entry.tothrs || 0);
    employeeSummaryMap[empId].totalMins += parseInt(entry.totmin || 0);
    employeeSummaryMap[empId].rawEntries.push(entry);

    if (entry.status === 0) employeeSummaryMap[empId].pendingCount++;
    else if (entry.status === 1) employeeSummaryMap[empId].approvedCount++;
    else if (entry.status === 2) employeeSummaryMap[empId].rejectedCount++;
  });

  const uniqueEmployeesFilled = Object.values(employeeSummaryMap);

  const selectedEmployeeData = selectedEmployeeId ? employeeSummaryMap[selectedEmployeeId] : null;
  const selectedEntries = selectedEmployeeData ? selectedEmployeeData.rawEntries : [];

  const isGlobalRole = userContext.role === 'admin' || userContext.role === 'hr';
  const isHrRole = userContext.role === 'hr';

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      
      {/* Top Header Panel */}
      <div style={styles.topHeader}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: C.secondary, fontSize: '22px' }}>Time Sheet Approvals Workspace</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: '13px' }}>
            {isGlobalRole ? "Global Administrative Oversight Mode" : "Monitor peer timelines and approve operational allocations"}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={styles.infoBadge}>
            <span style={styles.infoLabel}>Month</span>
            <strong>{weekMonthLabel}</strong>
          </div>
          <div style={styles.infoBadge}>
            <span style={styles.infoLabel}>Scope</span>
            <strong style={{ color: C.accent, textTransform: 'uppercase' }}>{userContext.role || 'Supervisor'}</strong>
          </div>
        </div>
      </div>

      {/* Week Navigator Bar */}
      <div style={styles.weekContainer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={styles.navBtn}>◀ Prev</button>
          <div style={{ fontSize: '14px', fontWeight: 'bold', width: '60px', textAlign: 'center' }}>WEEK</div>
        </div>
        
        <div style={styles.daysRow}>
          {currentWeekDays.map((dateObj) => {
            const dateStr = dateObj.toISOString().split('T')[0];
            const isSelected = selectedDate === dateStr;
            const dayName = dateObj.toLocaleString('default', { weekday: 'short' });
            const dayNum = dateObj.getDate();
            const pendingTasks = getPendingAlertCount(dateStr);

            return (
              <div 
                key={dateStr} 
                onClick={() => setSelectedDate(dateStr)}
                style={{
                  ...styles.dayBlock,
                  borderColor: isSelected ? '#2b7da1' : '#e2e8f0',
                  backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '12px', color: isSelected ? '#0284c7' : C.muted, fontWeight: '600' }}>{dayName}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: isSelected ? '#0369a1' : C.text, margin: '2px 0' }}>{dayNum}</div>
                <div style={{ minHeight: '16px' }}>
                  {pendingTasks > 0 ? (
                    <span style={styles.pendingIndicator}>⚡ {pendingTasks} Action</span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#16a34a' }}>{isSelected ? 'Open' : ''}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setWeekOffset(o => o + 1)} style={styles.navBtn}>Next ▶</button>
      </div>

      {/* ================= TIER 2: MASTER TABLE VIEW ================= */}
      <div style={styles.entryContainer}>
        <h3 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📊 Submission Summaries for {new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderLight}`, color: C.muted, fontSize: "12.5px", fontWeight: "700" }}>
                <th style={{ padding: "14px" }}>EMPLOYEE</th>
                <th style={{ padding: "14px" }}>DEPARTMENT</th>
                <th style={{ padding: "14px", textAlign: 'center' }}>TOTAL TIME</th>
                <th style={{ padding: "14px", textAlign: 'center' }}>TASK AUDIT STATUS</th>
                <th style={{ padding: "14px", textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {uniqueEmployeesFilled.map((emp) => {
                const calculatedHrs = emp.totalHours + Math.floor(emp.totalMins / 60);
                const calculatedMins = emp.totalMins % 60;

                return (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: C.text }}>
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td style={{ padding: '14px 16px', color: C.muted, fontSize: '13.5px' }}>
                      {emp.departmentName}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: C.primary, fontSize: '14px' }}>
                      {calculatedHrs}h {calculatedMins}m
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center' }}>
                        {emp.pendingCount > 0 && <span style={styles.badgeCount.pending}>{emp.pendingCount} Pending</span>}
                        {emp.approvedCount > 0 && <span style={styles.badgeCount.approved}>{emp.approvedCount} Approved</span>}
                        {emp.rejectedCount > 0 && <span style={styles.badgeCount.rejected}>{emp.rejectedCount} Rejected</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {/* FIXED: Now routes cleanly through our native handleOpenDetailsModal mapping logic */}
                      <button onClick={() => handleOpenDetailsModal(emp.id)} style={styles.viewDetailBtn}>
                        🔍 View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {uniqueEmployeesFilled.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: C.muted, fontSize: '14px' }}>
              📭 No employee effort records logged or compiled on this specific calendar date.
            </div>
          )}
        </div>
      </div>

      {/* ================= TIER 3: HIGH-FIDELITY OVERLAY MODAL WINDOW ================= */}
      {isModalOpen && selectedEmployeeData && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer}>
            
            {/* Modal sticky header */}
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '700' }}>
                  Effort Details: <span style={{ color: C.accent }}>{selectedEmployeeData.firstName} {selectedEmployeeData.lastName}</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: C.muted }}>
                  Logs for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={styles.modalCloseX}>✕</button>
            </div>

            {actionError && <div style={{ ...styles.errorBanner, margin: '16px 24px 0' }}>{actionError}</div>}

            <div style={styles.modalBodyScroll}>
              <div style={styles.rowHeader}>
                <div style={{ flex: 1 }}>Scope Type</div>
                <div style={{ flex: 1.5 }}>Project / Task Specifications</div>
                <div style={{ flex: 0.8, textAlign: 'center' }}>Duration</div>
                <div style={{ flex: 2.5 }}>Work Summary Descriptions</div>
                <div style={{ flex: 1.6, textAlign: 'center' }}>Approval Actions</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedEntries.map((row) => {
                  const isDirect = String(row.DirectSupervisor) === String(userContext.id);
                  const isIndirect = String(row.IndirectSupervisor) === String(userContext.id);
                  const isBillable = row.projectid && row.projectid !== 0;
                  const isOriginalEditing = editingRow === row.timesheetid;

                  return (
                    <div key={row.timesheetid} style={{ display: 'flex', flexDirection: 'column', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      
                      {isOriginalEditing ? (
                        <div style={styles.entryRow}>
                          <div style={{ flex: 1 }}>
                            <select value={editForm.billingType} onChange={(e) => handleEditChange('billingType', e.target.value)} style={styles.inlineSelect}>
                              <option value="billable">Billable</option>
                              <option value="non-billable">Non-Bill</option>
                            </select>
                          </div>

                          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {editForm.billingType === 'billable' ? (
                              <>
                                <SelectGroup value={editForm.projectid} options={projects} onChange={(e) => handleEditChange('projectid', e.target.value)} defaultLabel="Project..." />
                                <SelectGroup value={editForm.taskid} options={tasks} onChange={(e) => handleEditChange('taskid', e.target.value)} defaultLabel="Task..." />
                              </>
                            ) : (
                              <div style={styles.disabledCell}>Internal Work</div>
                            )}
                          </div>

                          <div style={{ flex: 0.8, display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <input type="number" value={editForm.tothrs} onChange={(e) => handleEditChange('tothrs', e.target.value)} style={{ ...styles.inlineInput, textAlign: 'center' }} placeholder="H" />
                            <input type="number" value={editForm.totmin} onChange={(e) => handleEditChange('totmin', e.target.value)} style={{ ...styles.inlineInput, textAlign: 'center' }} placeholder="M" />
                          </div>

                          <div style={{ flex: 2.5 }}>
                            <input type="text" value={editForm.comments} onChange={(e) => handleEditChange('comments', e.target.value)} style={styles.inlineInput} />
                          </div>

                          <div style={{ flex: 1.6, display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button onClick={() => handleSaveEdit(row.timesheetid)} disabled={isSubmitting} style={styles.actionBtn.approve}>Save</button>
                            <button onClick={() => setEditingRow(null)} disabled={isSubmitting} style={styles.actionBtn.cancel}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={styles.entryRow}>
                          <div style={{ flex: 1 }}>
                            {isDirect ? (
                              <span style={{ ...styles.roleBadge, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Direct Line</span>
                            ) : isIndirect ? (
                              <span style={{ ...styles.roleBadge, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>HR Audit</span>
                            ) : (
                              <span style={{ ...styles.roleBadge, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>Oversight</span>
                            )}
                          </div>

                          <div style={{ flex: 1.5 }}>
                            {isBillable ? (
                              <span style={styles.projectTag}>Proj: {row.projectcode || `#${row.projectid}`}</span>
                            ) : (
                              <span style={{ ...styles.projectTag, background: '#e2e8f0', color: '#475569' }}>Internal Work</span>
                            )}
                            <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px', fontWeight: '500' }}>{row.taskname || 'Task Specifications'}</div>
                          </div>

                          <div style={{ flex: 0.8, textAlign: 'center', fontWeight: '700', color: C.primary, fontSize: '14px' }}>
                            {row.tothrs}h {row.totmin}m
                          </div>

                          <div style={{ flex: 2.5, fontSize: '13.5px', color: C.text, paddingRight: '10px', fontStyle: 'italic', lineHeight: '1.4' }}>
                            "{row.comments || 'No comment text summaries provided.'}"
                          </div>

                          <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            <span style={{ 
                              ...styles.statusBadge, 
                              backgroundColor: row.status === 1 ? "#ecfdf5" : row.status === 2 ? "#fef2f2" : C.warningBg, 
                              color: row.status === 1 ? C.success : row.status === 2 ? C.danger : "#b45309"
                            }}>
                              {row.status === 1 ? "✓ Approved" : row.status === 2 ? "✕ Rejected" : "⏳ Pending Action"}
                            </span>

                            <div style={{ display: 'flex', gap: '4px', width: '100%', justifyContent: 'center', marginTop: '2px' }}>
                              {!isGlobalRole && row.status === 0 && (
                                <>
                                  <button disabled={isSubmitting} onClick={() => handleReviewAction(row.timesheetid, 1)} style={styles.actionBtn.approve}>Approve</button>
                                  <button disabled={isSubmitting} onClick={() => handleReviewAction(row.timesheetid, 2)} style={styles.actionBtn.reject}>Reject</button>
                                </>
                              )}
                              {isHrRole && (
                                <button onClick={() => handleEditClick(row)} style={styles.actionBtn.hrEdit}>✏️ Edit</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {row.status === 2 && row.rejection_comment && !isOriginalEditing && (
                        <div style={styles.managerNoteAttachment}>
                          📋 **Rejection Reason Context:** "{row.rejection_comment}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>Done / Close Window</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '16px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' },
  infoBadge: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  infoLabel: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' },
  weekContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' },
  navBtn: { background: '#f1f5f9', border: 'none', padding: '8px 14px', borderRadius: '6px', color: '#475569', fontWeight: '600', cursor: 'pointer' },
  daysRow: { display: 'flex', gap: '10px', flex: 1, justifyContent: 'center' },
  dayBlock: { width: '85px', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid', borderRadius: '12px', transition: 'all 0.2s' },
  pendingIndicator: { fontSize: '10px', color: '#b45309', background: '#fff3cd', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' },
  entryContainer: { backgroundColor: '#fff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' },
  
  viewDetailBtn: { background: 'transparent', border: '1px solid #2b7da1', color: '#2b7da1', padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' },
  modalContainer: { backgroundColor: '#ffffff', width: '100%', maxWidth: '1000px', maxHeight: '85vh', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  modalCloseX: { background: 'transparent', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer', padding: '4px' },
  modalBodyScroll: { padding: '24px', overflowY: 'auto', flex: 1 },
  modalFooter: { padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' },
  modalCloseBtn: { background: '#334155', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '13.5px', cursor: 'pointer' },

  badgeCount: {
    pending: { background: '#fff3cd', color: '#b45309', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', marginRight: '4px' },
    approved: { background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', marginRight: '4px' },
    rejected: { background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px' }
  },
  
  rowHeader: { display: 'flex', gap: '12px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0', marginBottom: '14px', fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' },
  entryRow: { display: 'flex', gap: '12px', alignItems: 'center', width: '100%' },
  inlineInput: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' },
  inlineSelect: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' },
  disabledCell: { width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '12px', textAlign: 'center', boxSizing: 'border-box' },
  roleBadge: { padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', display: 'inline-block' },
  projectTag: { padding: '4px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', background: '#e0f2fe', color: '#0369a1', display: 'inline-block' },
  statusBadge: { padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', width: '100%', textAlign: 'center', boxSizing: 'border-box', whiteSpace: 'nowrap' },
  errorBanner: { color: '#ef4444', background: '#fef2f2', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
  
  actionBtn: {
    approve: { background: '#0f6e56', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', flex: 1 },
    reject: { background: 'transparent', color: '#b91c1c', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', padding: '5px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', flex: 1 },
    hrEdit: { background: '#ffffff', color: '#2b7da1', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', width: '100%' },
    cancel: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', flex: 1 }
  },
  managerNoteAttachment: { fontSize: '12px', color: '#475569', background: '#ffffff', padding: '6px 12px', borderRadius: '6px', marginTop: '6px', border: '1px dashed #cbd5e1', width: 'fit-content' }
};

export default ManagerTimesheetReview;