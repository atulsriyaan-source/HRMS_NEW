import React, { useState, useEffect } from 'react';

// --- Embedded Shared UI Theme ---
const C = {
  primary: '#0369a1',
  secondary: '#334155',
  muted: '#64748b',
  accent: '#2b7da1',
  card: '#ffffff',
  text: '#0f172a',
  borderLight: '#e2e8f0',
  danger: '#ef4444',
  success: '#16a34a'
};
const TYPOGRAPHY = { fontFamily: 'system-ui, -apple-system, sans-serif' };

const SelectGroup = ({ value, onChange, options, required = false, defaultLabel = "Select...", disabled = false }) => (
  <select value={value} onChange={onChange} required={required} disabled={disabled} style={styles.inlineSelect}>
    <option value="">{defaultLabel}</option>
    {options.map(opt => (
      <option key={opt.id} value={opt.id}>
        {opt.name}
      </option>
    ))}
  </select>
);

const TimeSheetMaster = () => {
  const [timesheets, setTimesheets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [studies, setStudies] = useState([]);
  
  const [currentEmployee, setCurrentEmployee] = useState({ id: null, name: '', role: '', departmentid: '', departmentName: 'Loading...' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [weekOffset, setWeekOffset] = useState(0); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const initialTaskRow = {
    timesheetid: null,
    tothrs: '', totmin: '', billingType: 'billable',
    projectid: '', taskid: '', studyid: '', activitytypeid: '1', nonprojectactivityid: '0',
    roleid: '0', pmscontractid: '0', unitcnt: '0', unitid: '0', comments: '', status: 0,
    rejection_comment: null
  };
  const [taskEntries, setTaskEntries] = useState([]);

  // FIXED: Lock provision constraints setup if weekOffset drops below 0 (Backdated Week Lock)
  const isBackdatedWeekLocked = weekOffset < 0;

  const fetchEmployeeContextAndLogs = async () => {
    setIsLoading(true);
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || !storedUser.id) {
        setFormError("Session validation failed. Please sign in again.");
        setIsLoading(false);
        return;
      }

      const empProfileRes = await fetch(`http://localhost:5000/api/admin/employees/${storedUser.id}`);
      let assignedDeptId = '';
      if (empProfileRes.ok) {
        const empData = await empProfileRes.json();
        assignedDeptId = empData.Department || empData.departmentid || ''; 
      }

      const [tsRes, deptRes, projRes, taskRes, studyRes] = await Promise.all([
        fetch(`http://localhost:5000/api/employee/timesheets?employeeId=${storedUser.id}`),
        fetch('http://localhost:5000/api/admin/departments'),
        fetch('http://localhost:5000/api/admin/projects'),
        fetch('http://localhost:5000/api/admin/tasks'),   
        fetch('http://localhost:5000/api/admin/studies')  
      ]);

      const tsData = tsRes.ok ? await tsRes.json() : [];
      const deptData = deptRes.ok ? await deptRes.json() : [];
      const projData = projRes.ok ? await projRes.json() : [];
      const taskData = taskRes.ok ? await taskRes.json() : [];
      const studyData = studyRes.ok ? await studyRes.json() : [];

      setTimesheets(tsData);
      setDepartments(deptData);
      
      setProjects(projData.map(p => ({ id: p.projectid || p.id, name: p.projectcode || p.name || `Project #${p.projectid}` })));
      setTasks(taskData.map(t => ({ id: t.id || t.taskid, name: t.taskname || t.name })));
      setStudies(studyData.map(s => ({ id: s.id || s.studyid, name: s.studyname || s.title || s.id })));

      const employeeDept = deptData.find(d => String(d.id) === String(assignedDeptId))?.Department || "General Operations";

      setCurrentEmployee({ 
        id: storedUser.id, 
        name: storedUser.name, 
        role: storedUser.role,
        departmentid: assignedDeptId,
        departmentName: employeeDept
      });

    } catch (err) {
      console.error("Error loading master data references:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeContextAndLogs();
  }, []);

  useEffect(() => {
    const dayLogs = timesheets.filter(ts => ts.timesheetdate && ts.timesheetdate.split('T')[0] === selectedDate);
    if (dayLogs.length > 0) {
      setTaskEntries(dayLogs.map(log => ({
        ...initialTaskRow,
        ...log,
        billingType: log.projectid && log.projectid !== 0 ? 'billable' : 'non-billable'
      })));
    } else {
      setTaskEntries([{ ...initialTaskRow }]);
    }
    setFormError(null);
  }, [selectedDate, timesheets]);

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

  const getDayTotalHours = (dateStr) => {
    const logs = timesheets.filter(ts => ts.timesheetdate && ts.timesheetdate.split('T')[0] === dateStr);
    let hrs = 0, mins = 0;
    logs.forEach(l => { hrs += parseInt(l.tothrs || 0); mins += parseInt(l.totmin || 0); });
    hrs += Math.floor(mins / 60);
    const remMins = mins % 60;
    return hrs > 0 || remMins > 0 ? `${hrs}h ${remMins}m` : null;
  };

  const handleAddTaskRow = () => {
    if (isBackdatedWeekLocked) return;
    setTaskEntries(prev => [...prev, { ...initialTaskRow }]);
  };

  const handleRemoveTaskRow = async (index, timesheetid) => {
    if (isBackdatedWeekLocked) return; // Prevent deletions on backdated metrics
    if (timesheetid) {
      if (window.confirm("Delete this saved task permanently?")) {
        try {
          const response = await fetch(`http://localhost:5000/api/employee/timesheets/${timesheetid}`, { method: 'DELETE' });
          if (response.ok) fetchEmployeeContextAndLogs();
          else throw new Error("Failed to delete record.");
        } catch (err) {
          alert(err.message);
        }
      }
    } else {
      if (taskEntries.length === 1) return;
      setTaskEntries(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleRowFieldChange = (index, name, value) => {
    if (isBackdatedWeekLocked) return;
    setTaskEntries(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updatedRow = { ...row, [name]: value };
      
      if (name === 'billingType') {
        if (value === 'billable') {
          updatedRow.activitytypeid = '1'; updatedRow.nonprojectactivityid = '0';
        } else {
          updatedRow.projectid = '0'; updatedRow.taskid = '0'; updatedRow.studyid = '0'; updatedRow.activitytypeid = '0'; updatedRow.nonprojectactivityid = '1';
        }
      }
      return updatedRow;
    }));
  };

  const handleSaveDay = async () => {
    if (isBackdatedWeekLocked) return;
    setFormError(null);
    const emptyRows = taskEntries.filter(r => !r.tothrs && !r.totmin);
    if (emptyRows.length > 0 && taskEntries.length > 1) {
      setFormError("Please remove empty rows or fill in valid hours before saving.");
      return;
    }

    let formHoursSum = 0;
    taskEntries.forEach(row => {
      formHoursSum += (parseInt(row.tothrs) || 0) + ((parseInt(row.totmin) || 0) / 60);
    });

    if (formHoursSum > 0 && formHoursSum < 9) {
      const confirmSubmit = window.confirm(
        `Warning: Total tracked time is ${formHoursSum.toFixed(2)} hours. You haven't hit the 9-hour operational baseline. Save anyway?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmitting(true);

    try {
      for (const entry of taskEntries) {
        if (!entry.timesheetid && (!entry.tothrs || entry.tothrs === '0') && (!entry.totmin || entry.totmin === '0') && !entry.comments) {
          continue; 
        }

        if (entry.status === 1) {
          continue; 
        }

        const payload = {
          ...entry,
          employeeid: currentEmployee.id,
          timesheetdate: selectedDate,
          departmentid: currentEmployee.departmentid || 0 
        };

        const isUpdate = !!entry.timesheetid;
        const url = isUpdate 
          ? `http://localhost:5000/api/employee/timesheets/${entry.timesheetid}`
          : `http://localhost:5000/api/employee/timesheets`;
        
        const bodyPayload = isUpdate ? payload : { isBatch: false, ...payload };

        const response = await fetch(url, {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) throw new Error(`Failed to commit tracking node entries.`);
      }
      
      fetchEmployeeContextAndLogs(); 
      alert("Daily logs submitted successfully.");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  let liveHrs = 0, liveMins = 0;
  taskEntries.forEach(r => { liveHrs += parseInt(r.tothrs || 0); liveMins += parseInt(r.totmin || 0); });
  liveHrs += Math.floor(liveMins / 60);
  liveMins = liveMins % 60;

  const isAllApproved = taskEntries.length > 0 && taskEntries.every(t => t.timesheetid && t.status === 1);

  return (
    <div style={{ fontFamily: TYPOGRAPHY.fontFamily, maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={styles.topHeader}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: C.secondary, fontSize: '22px' }}>Time Sheet Screen</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Select day you want to enter time sheet efforts & provide details below
          </p>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={styles.infoBadge}>
            <span style={styles.infoLabel}>Month</span>
            <strong>{weekMonthLabel}</strong>
          </div>
          <div style={styles.infoBadge}>
            <span style={styles.infoLabel}>Dept</span>
            <strong>{currentEmployee.departmentName}</strong>
          </div>
        </div>
      </div>

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
            const loggedTime = getDayTotalHours(dateStr);
            const isFuture = dateObj > new Date();

            return (
              <div 
                key={dateStr} 
                onClick={() => !isFuture && setSelectedDate(dateStr)}
                style={{
                  ...styles.dayBlock,
                  borderColor: isSelected ? '#2b7da1' : '#e2e8f0',
                  backgroundColor: isSelected ? '#f0f9ff' : (isFuture ? '#f8fafc' : '#fff'),
                  opacity: isFuture ? 0.5 : 1,
                  cursor: isFuture ? 'not-allowed' : 'pointer'
                }}
              >
                <div style={{ fontSize: '12px', color: isSelected ? '#0284c7' : C.muted, fontWeight: '600' }}>{dayName}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: isSelected ? '#0369a1' : C.text, margin: '2px 0' }}>{dayNum}</div>
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', minHeight: '16px' }}>
                  {loggedTime || (isSelected ? 'Editing' : '')}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setWeekOffset(o => o + 1)} style={styles.navBtn}>Next ▶</button>
      </div>

      <div style={styles.entryContainer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#334155', fontSize: '16px' }}>
            Entries for <span style={{ color: '#2b7da1' }}>{new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </h3>
          
          {/* FIXED: Display warning badge if week offset represents backdated history layout */}
          {isAllApproved ? (
            <span style={{ padding: '4px 10px', background: '#ecfdf5', color: C.success, borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>🔒 Locked (Approved)</span>
          ) : isBackdatedWeekLocked ? (
            <span style={{ padding: '4px 10px', background: '#fff2f2', color: C.danger, borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>🔒 Locked (Backdated - Contact HR)</span>
          ) : null}
        </div>

        {formError && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{formError}</div>}

        <div style={styles.rowHeader}>
          <div style={{ flex: 0.8 }}>Type</div>
          <div style={{ flex: 1.5 }}>Project</div>
          <div style={{ flex: 1.5 }}>Task</div>
          <div style={{ flex: 0.6, textAlign: 'center' }}>Hours</div>
          <div style={{ flex: 0.6, textAlign: 'center' }}>Mins</div>
          <div style={{ flex: 2.5 }}>Comments</div>
          <div style={{ flex: 0.5, textAlign: 'center' }}>Action</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {taskEntries.map((row, index) => {
            const isApproved = row.timesheetid && row.status === 1;
            // FIXED: Row inputs get disabled natively if isBackdatedWeekLocked is true
            const isRowDisabled = isApproved || isAllApproved || isBackdatedWeekLocked;

            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ ...styles.entryRow, opacity: isRowDisabled ? 0.75 : 1 }}>
                  
                  {/* Classification */}
                  <div style={{ flex: 0.8 }}>
                    <select 
                      value={row.billingType} 
                      onChange={(e) => handleRowFieldChange(index, 'billingType', e.target.value)} 
                      disabled={isRowDisabled}
                      style={styles.inlineSelect}
                    >
                      <option value="billable">Billable</option>
                      <option value="non-billable">Non-Bill</option>
                    </select>
                  </div>

                  {/* Project */}
                  <div style={{ flex: 1.5 }}>
                    {row.billingType === 'billable' ? (
                      <SelectGroup 
                        value={row.projectid} 
                        options={projects} 
                        onChange={(e) => handleRowFieldChange(index, 'projectid', e.target.value)} 
                        disabled={isRowDisabled}
                        defaultLabel="Select Proj..." 
                      />
                  ) : (
                    <div style={styles.disabledCell}>Internal</div>
                  )}
                  </div>

                  {/* Task */}
                  <div style={{ flex: 1.5 }}>
                    {row.billingType === 'billable' ? (
                      <SelectGroup 
                        value={row.taskid} 
                        options={tasks} 
                        onChange={(e) => handleRowFieldChange(index, 'taskid', e.target.value)} 
                        disabled={isRowDisabled}
                        defaultLabel="Select Task..." 
                      />
                    ) : (
                      <div style={styles.disabledCell}>N/A</div>
                    )}
                  </div>

                  {/* Hours & Mins */}
                  <div style={{ flex: 0.6 }}>
                    <input 
                      type="number" min="0" max="24" 
                      value={row.tothrs} 
                      onChange={(e) => handleRowFieldChange(index, 'tothrs', e.target.value)} 
                      disabled={isRowDisabled}
                      style={{ ...styles.inlineInput, textAlign: 'center' }} 
                      placeholder="0"
                    />
                  </div>
                  <div style={{ flex: 0.6 }}>
                    <input 
                      type="number" min="0" max="59" 
                      value={row.totmin} 
                      onChange={(e) => handleRowFieldChange(index, 'totmin', e.target.value)} 
                      disabled={isRowDisabled}
                      style={{ ...styles.inlineInput, textAlign: 'center' }} 
                      placeholder="0"
                    />
                  </div>

                  {/* Comments Field */}
                  <div style={{ flex: 2.5 }}>
                    <input 
                      type="text" 
                      value={row.comments} 
                      onChange={(e) => handleRowFieldChange(index, 'comments', e.target.value)} 
                      disabled={isRowDisabled}
                      style={styles.inlineInput} 
                      placeholder={isBackdatedWeekLocked ? "Locked" : "What did you work on?"}
                    />
                  </div>

                  {/* Row Delete Action */}
                  <div style={{ flex: 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {!isRowDisabled && (
                      <button 
                        onClick={() => handleRemoveTaskRow(index, row.timesheetid)} 
                        style={styles.iconBtn}
                        title="Remove Row"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {row.status === 2 && row.rejection_comment && (
                  <div style={styles.rejectionFeedbackBanner}>
                    ⚠️ <strong>Correction Required:</strong> {row.rejection_comment}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.entryFooter}>
          <div style={{ flex: 1 }}>
            {/* FIXED: Hiding action triggers if week offset is locked */}
            {!isAllApproved && !isBackdatedWeekLocked && (
              <button onClick={handleAddTaskRow} style={styles.addRowBtn}>+ Add Another Task</button>
            )}
          </div>
          
          <div style={styles.totalsBlock}>
            <span style={{ color: C.muted, fontWeight: '600', marginRight: '10px' }}>DAY TOTAL:</span>
            <div style={styles.totalBox}>{liveHrs} <span style={{fontSize:'12px', fontWeight:'normal'}}>Hrs</span></div>
            <div style={styles.totalBox}>{liveMins} <span style={{fontSize:'12px', fontWeight:'normal'}}>Min</span></div>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {/* FIXED: Hiding Save triggers if week offset is locked */}
            {!isAllApproved && !isBackdatedWeekLocked && (
              <button onClick={handleSaveDay} disabled={isSubmitting} style={styles.saveBtn}>
                {isSubmitting ? 'Saving...' : 'Save Work'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' },
  infoBadge: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  infoLabel: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' },
  weekContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' },
  navBtn: { background: '#f1f5f9', border: 'none', padding: '8px 14px', borderRadius: '6px', color: '#475569', fontWeight: '600', cursor: 'pointer' },
  daysRow: { display: 'flex', gap: '10px', flex: 1, justifyContent: 'center' },
  dayBlock: { width: '80px', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid', borderRadius: '12px', transition: 'all 0.2s' },
  entryContainer: { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  rowHeader: { display: 'flex', gap: '12px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0', marginBottom: '12px', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  entryRow: { display: 'flex', gap: '12px', alignItems: 'center' },
  inlineInput: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fdfefe', outline: 'none', boxSizing: 'border-box' },
  inlineSelect: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fdfefe', outline: 'none', boxSizing: 'border-box' },
  disabledCell: { width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '13px', textAlign: 'center', boxSizing: 'border-box' },
  iconBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px', opacity: 0.6 },
  entryFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' },
  addRowBtn: { background: 'transparent', color: '#2b7da1', border: '1px dashed #2b7da1', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  totalsBlock: { display: 'flex', alignItems: 'center', gap: '8px' },
  totalBox: { border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', fontSize: '16px', fontWeight: '700', backgroundColor: '#f8fafc', color: '#0f172a' },
  saveBtn: { background: '#2b7da1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  
  rejectionFeedbackBanner: {
    alignSelf: 'stretch',
    background: '#fef2f2',
    borderLeft: '4px solid #ef4444',
    padding: '8px 12px',
    borderRadius: '0 6px 6px 0',
    color: '#991b1b',
    fontSize: '12.5px',
    marginLeft: '0px',
    marginRight: '40px'
  }
};

export default TimeSheetMaster;