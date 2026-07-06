import React, { useState, useEffect } from 'react';
import { C, SHADOW, RADIUS, TYPOGRAPHY } from '../../theme';

const FormGroup = ({ label, name, type = "text", value, onChange, required = false, placeholder = "" }) => (
  <div style={st.formGroup}>
    <label style={st.label}>{label}{required && <span style={{ color: '#e11d48', marginLeft: 2 }}>*</span>}</label>
    <input
      type={type} name={name} value={value} onChange={onChange}
      required={required} placeholder={placeholder} style={st.input}
    />
  </div>
);

const SelectGroup = ({ label, name, value, onChange, required = false, children }) => (
  <div style={st.formGroup}>
    <label style={st.label}>{label}{required && <span style={{ color: '#e11d48', marginLeft: 2 }}>*</span>}</label>
    <select name={name} value={value} onChange={onChange} required={required} style={st.input}>
      {children}
    </select>
  </div>
);

const PhoneGroup = ({ codeLabel, codeName, codeValue, numLabel, numName, numValue, onChange, required }) => (
  <div style={{ ...st.formGroup, gridColumn: "span 2" }}>
    <label style={st.label}>{numLabel}{required && <span style={{ color: '#e11d48', marginLeft: 2 }}>*</span>}</label>
    <div style={{ display: "flex", gap: "8px" }}>
      <input name={codeName} value={codeValue} onChange={onChange} placeholder="+91" style={{ ...st.input, width: "72px", flexShrink: 0 }} />
      <input name={numName} value={numValue} onChange={onChange} required={required} placeholder="Phone number" style={{ ...st.input, flex: 1 }} />
    </div>
  </div>
);

const SectionHead = ({ children }) => (
  <div style={{ gridColumn: "1 / -1", fontSize: "12px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: C.primary, paddingBottom: "8px", borderBottom: `1.5px solid ${C.borderLight}`, marginTop: "4px" }}>
    {children}
  </div>
);

export default function Employees() {
  const [employees,       setEmployees]       = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]); // FIXED: Added client-side filtered data pool
  const [employeeStatuses,setEmployeeStatuses]= useState([]);
  const [departments,     setDepartments]     = useState([]);
  const [directSupervisors, setDirectSupervisors] = useState([]);
  const [indirectSupervisors, setIndirectSupervisors] = useState([]);
  
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState(null);
  const [userRole,        setUserRole]        = useState("");
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [isEditMode,      setIsEditMode]      = useState(false);
  const [isViewMode,      setIsViewMode]      = useState(false);
  const [editEmployeeId,  setEditEmployeeId]  = useState(null);
  const [selectedFile,    setSelectedFile]    = useState(null);
  const [activeTab,       setActiveTab]       = useState('Personal');
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [formError,       setFormError]       = useState(null);

  // FIXED: Dynamic Advanced Matrix Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active"); // Defaults to showing active workforce
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const initialFormState = {
    FirstName:'', MiddleName:'', LastName:'', DateOfBirth:'', Gender:'', BloodGroup:'', MaritalStatus:'', Nationality:'', NomineeName:'', NomineeRelation:'',
    EmailId:'', AlternateEmailId:'', CurrentContactNo:'', CountryCode1:'', AlternateContactNo:'', CountryCode2:'', EmergencyContactNo:'', CountryCode3:'', CurrentAddress:'', PermanantAddress:'',
    role:'', Status:'Active', StatusOfEmployee:'', Password:'', Department:'', Designation:'', DesignationStartDate:'', DesignationEndDate:'', StartDate:'', EndDate:'', CompanyBranch:'', WorkingBranch:'', WorkLocation:'', DirectSupervisor:'', IndirectSupervisor:'',
    AccountHolderName:'', BankName:'', AccountNumber:'', IFSCCode:'', NEFT:'', Branch:'', PANNo:'', AadharNo:'', PFNo:'', PFUANNo:'', ESICNo:'', DrivingLicense:'', ExpiryDrivingLicense:'', PassportNo:'', PassportLocation:'', Photo:''
  };
  const [formData, setFormData] = useState(initialFormState);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const r = await fetch('http://localhost:5000/api/admin/employees');
      if (!r.ok) throw new Error('Failed to fetch');
      const data = await r.json();
      setEmployees(data);
      setFilteredEmployees(data); // Pre-fill matrices tracking pool
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    const role = localStorage.getItem("role") || sessionStorage.getItem("role") || "";
    setUserRole(role.toUpperCase());
    fetchEmployees();
    fetch('http://localhost:5000/api/admin/employee-statuses').then(r => r.ok && r.json()).then(d => d && setEmployeeStatuses(d)).catch(()=>{});
    fetch('http://localhost:5000/api/admin/departments').then(r => r.ok && r.json()).then(d => d && setDepartments(d)).catch(()=>{});
    fetch('http://localhost:5000/api/admin/supervisors').then(r => r.ok && r.json()).then(d => d && setDirectSupervisors(d)).catch(()=>{});
    fetch('http://localhost:5000/api/admin/in-direct-supervisors').then(r => r.ok && r.json()).then(d => d && setIndirectSupervisors(d)).catch(()=>{});
  }, []);

  // FIXED: Real-time Multi-parameter Filter Computation Effect
  useEffect(() => {
    let result = [...employees];

    // 1. Text Search Filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp => 
        emp.FirstName?.toLowerCase().includes(query) || 
        emp.LastName?.toLowerCase().includes(query) || 
        emp.EmailId?.toLowerCase().includes(query) || 
        String(emp.EmployeeID).includes(query)
      );
    }

    // 2. Status & Archive Filter
    if (statusFilter !== "all") {
      result = result.filter(emp => emp.Status === statusFilter);
    }

    // 3. System Role Filter
    if (roleFilter !== "all") {
      result = result.filter(emp => emp.role === roleFilter);
    }

    // 4. Department Filter
    if (deptFilter !== "all") {
      result = result.filter(emp => String(emp.Department) === String(deptFilter));
    }

    setFilteredEmployees(result);
  }, [searchQuery, statusFilter, roleFilter, deptFilter, employees]);

  // FIXED: CSV Format Sheet Export Engine Logic Flow
  const exportToCSV = () => {
    if (filteredEmployees.length === 0) {
      alert("No data track logs available to export.");
      return;
    }

    // Defining Clean Row Headers Layout
    const headers = ["EmployeeID", "Full Name", "Email", "System Role", "Work Status", "Joining Date", "Department ID"];
    
    const csvRows = [
      headers.join(','), // First line contains column names
      ...filteredEmployees.map(emp => [
        emp.EmployeeID,
        `"${emp.FirstName} ${emp.LastName}"`,
        emp.EmailId,
        emp.role,
        emp.Status,
        emp.StartDate || '-',
        emp.Department || '-'
      ].join(','))
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Workforce_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatEmployeeData = (data) => {
    const d = { ...initialFormState, ...data };
    ['DateOfBirth','DesignationStartDate','DesignationEndDate','StartDate','EndDate','ExpiryDrivingLicense'].forEach(f => {
      if (d[f]) {
        try {
          if (/^\d{2}-\d{2}-\d{4}$/.test(d[f])) {
            const [day,month,year] = d[f].split('-');
            d[f] = `${year}-${month}-${day}`;
          } else {
            const dt = new Date(d[f]);
            d[f] = isNaN(dt) ? '' : dt.toISOString().split('T')[0];
          }
        } catch { d[f] = ''; }
      } else { d[f] = ''; }
    });
    Object.keys(d).forEach(k => { if (d[k] === null) d[k] = ''; });
    return d;
  };

  const openModal = () => {
    setFormData(initialFormState); setSelectedFile(null);
    setIsEditMode(false); setIsViewMode(false);
    setEditEmployeeId(null); setActiveTab('Personal');
    setFormError(null); setIsModalOpen(true);
  };

  const handleView = async (id) => {
    const r = await fetch(`http://localhost:5000/api/admin/employees/${id}`);
    if (!r.ok) return alert("Error loading employee");
    setFormData(formatEmployeeData(await r.json()));
    setSelectedFile(null); setIsViewMode(true); setIsEditMode(false);
    setEditEmployeeId(id); setActiveTab('Personal'); setFormError(null); setIsModalOpen(true);
  };

  const handleEdit = async (id) => {
    const r = await fetch(`http://localhost:5000/api/admin/employees/${id}`);
    if (!r.ok) return alert("Error loading employee");
    setFormData(formatEmployeeData(await r.json()));
    setSelectedFile(null); setIsEditMode(true); setIsViewMode(false);
    setEditEmployeeId(id); setActiveTab('Personal'); setFormError(null); setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Archive this employee profile permanently?")) return;
    const r = await fetch(`http://localhost:5000/api/admin/employees/${id}`, { method: 'DELETE' });
    if (!r.ok) return alert("Error archiving employee");
    fetchEmployees();
  };

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); setFormError(null);
    const fd = new FormData();
    Object.keys(formData).forEach(k => { if (formData[k] != null) fd.append(k, formData[k]); });
    if (selectedFile) fd.append('Photo', selectedFile);
    try {
      const r = await fetch(
        isEditMode ? `http://localhost:5000/api/admin/employees/${editEmployeeId}` : 'http://localhost:5000/api/admin/employees',
        { method: isEditMode ? 'PUT' : 'POST', body: fd }
      );
      if (!r.ok) throw new Error(`Failed to ${isEditMode ? 'update' : 'save'}`);
      alert(`Employee ${isEditMode ? 'updated' : 'added'} successfully!`);
      setIsModalOpen(false); fetchEmployees();
    } catch (err) { setFormError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const tabs = ['Personal', 'Contact', 'Job Details', 'Financial & ID'];

  if (isLoading && employees.length === 0) return <div style={{ color: C.text, padding: 20 }}>Loading employees…</div>;
  if (error) return <div style={{ color: C.danger, padding: 20 }}>Error: {error}</div>;

  return (
    <div style={{ fontFamily: TYPOGRAPHY?.fontFamily, position: 'relative' }}>

      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: C.text }}>Employees Master Workspace</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: C.muted }}>Showing {filteredEmployees.length} of {employees.length} entries registered</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {/* FIXED: Added Export Trigger Engine Actions Button */}
          <button onClick={exportToCSV} style={st.exportBtn}>📥 Export Data (CSV)</button>
          <button onClick={openModal} style={st.addBtn}>+ Add Employee</button>
        </div>
      </div>

      {/* ================= FIXED: ADVANCED DYNAMIC FILTERS TOOLBAR ROW ================= */}
      <div style={st.filterBarContainer}>
        <div style={st.filterGroup}>
          <input 
            type="text" 
            placeholder="Search Name, ID or Email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={st.filterInput}
          />
        </div>
        
        <div style={st.filterGroup}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={st.filterSelect}>
            <option value="all">All Operational Status</option>
            <option value="Active">Active Users</option>
            <option value="Inactive">Inactive Logs</option>
            <option value="Suspended">Suspended / Archived</option>
          </select>
        </div>

        <div style={st.filterGroup}>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={st.filterSelect}>
            <option value="all">All System Roles</option>
            <option value="admin">Admin Accounts</option>
            <option value="hr">HR Desk</option>
            <option value="supervisor">Supervisors Pool</option>
            <option value="employee">Standard Employees</option>
          </select>
        </div>

        <div style={st.filterGroup}>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={st.filterSelect}>
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id || d.departmentid} value={d.id || d.departmentid}>
                {d.Department || d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Data Render Layer */}
      <div style={st.tableWrap}>
        <table style={st.table}>
          <thead>
            <tr style={st.theadRow}>
              <th style={st.th}>Photo</th>
              <th style={st.th}>ID</th>
              <th style={st.th}>Name</th>
              <th style={st.th}>Email</th>
              <th style={st.th}>Role</th>
              <th style={st.th}>Status</th>
              <th style={{ ...st.th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp, i) => (
              <tr key={emp.EmployeeID || emp.id} style={{ ...st.tr, background: i % 2 === 0 ? C.card : C.inputBg }}>
                <td style={st.td}>
                  {emp.Photo
                    ? <img src={`http://localhost:5000/uploads/${emp.Photo}`} alt="" style={st.avatar} />
                    : <div style={st.avatarFallback}>{emp.FirstName?.[0] || 'U'}</div>
                  }
                </td>
                <td style={{ ...st.td, color: C.muted, fontSize: "13px" }}>{emp.EmployeeID}</td>
                <td style={st.td}><strong style={{ color: C.text }}>{emp.FirstName} {emp.LastName}</strong></td>
                <td style={{ ...st.td, color: C.muted }}>{emp.EmailId}</td>
                <td style={st.td}><span style={st.roleBadge}>{emp.role}</span></td>
                <td style={st.td}>
                  <span style={{ 
                    ...st.statusBadge, 
                    background: emp.Status === 'Active' ? '#dcfce7' : emp.Status === 'Suspended' ? '#fef3c7' : '#fee2e2', 
                    color: emp.Status === 'Active' ? '#16a34a' : emp.Status === 'Suspended' ? '#d97706' : '#dc2626' 
                  }}>
                    {emp.Status}
                  </span>
                </td>
                <td style={{ ...st.td, textAlign: 'center' }}>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    <button onClick={() => handleView(emp.EmployeeID)}   style={st.btnView}>View</button>
                    <button onClick={() => handleEdit(emp.EmployeeID)}   style={st.btnEdit}>Edit</button>
                    <button onClick={() => handleDelete(emp.EmployeeID)} style={st.btnArchive}>Archive</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEmployees.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted, fontSize: '14px' }}>
            🔍 No system matching records tracking your current filters query criteria.
          </div>
        )}
      </div>

      {/* Modal Profile Management Logic Wrapper stays exact same below... */}
      {isModalOpen && (
        <div style={st.overlay}>
          <div style={st.modal}>
            <div style={st.modalHead}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: C.text }}>
                  {isViewMode ? 'Employee Details' : isEditMode ? 'Edit Employee' : 'Add New Employee'}
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: "13px", color: C.muted }}>
                  {isViewMode ? 'Viewing record' : 'Fill in the details below'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={st.closeBtn}>✕</button>
            </div>

            {formError && (
              <div style={{ margin: "0 0 16px", padding: "11px 14px", background: "#fde8ef", border: "1px solid #fca5a5", borderRadius: "8px", color: "#dc2626", fontSize: "13.5px" }}>
                {formError}
              </div>
            )}

            <div style={st.tabBar}>
              {tabs.map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  style={{ ...st.tab, ...(activeTab === tab ? st.tabActive : {}) }}>
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={st.formScroll}>
                <fieldset disabled={isViewMode} style={{ border: 'none', padding: 0, margin: 0 }}>

                  {/* ── Personal ── */}
                  {activeTab === 'Personal' && (
                    <div style={st.grid}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={st.label}>Profile photo</label>
                        {isViewMode && formData.Photo ? (
                          <img src={`http://localhost:5000/uploads/${formData.Photo}`} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.borderLight}`, display: "block", marginTop: 6 }} />
                        ) : (
                          <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                            style={{ ...st.input, padding: "9px 12px", cursor: "pointer", marginTop: 6 }} />
                        )}
                        {isEditMode && formData.Photo && !selectedFile && (
                          <p style={{ margin: "6px 0 0", fontSize: "12px", color: C.muted }}>Current: {formData.Photo}</p>
                        )}
                      </div>

                      <FormGroup label="First name"  name="FirstName"       value={formData.FirstName}       onChange={handleChange} required />
                      <FormGroup label="Middle name" name="MiddleName"      value={formData.MiddleName}      onChange={handleChange} />
                      <FormGroup label="Last name"   name="LastName"        value={formData.LastName}        onChange={handleChange} required />
                      <FormGroup label="Date of birth" name="DateOfBirth"   value={formData.DateOfBirth}     onChange={handleChange} type="date" />
                      <SelectGroup label="Gender" name="Gender" value={formData.Gender} onChange={handleChange}>
                        <option value="">Select…</option>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </SelectGroup>
                      <SelectGroup label="Marital status" name="MaritalStatus" value={formData.MaritalStatus} onChange={handleChange}>
                        <option value="">Select…</option>
                        <option>Single</option><option>Married</option>
                      </SelectGroup>
                      <FormGroup label="Blood group"      name="BloodGroup"      value={formData.BloodGroup}      onChange={handleChange} />
                      <FormGroup label="Nationality"      name="Nationality"     value={formData.Nationality}     onChange={handleChange} />
                      <FormGroup label="Nominee name"     name="NomineeName"     value={formData.NomineeName}     onChange={handleChange} />
                      <FormGroup label="Nominee relation" name="NomineeRelation" value={formData.NomineeRelation} onChange={handleChange} />
                    </div>
                  )}

                  {/* ── Contact ── */}
                  {activeTab === 'Contact' && (
                    <div style={st.grid}>
                      <FormGroup label="Primary email"   name="EmailId"          value={formData.EmailId}          onChange={handleChange} type="email" required />
                      <FormGroup label="Alternate email" name="AlternateEmailId" value={formData.AlternateEmailId} onChange={handleChange} type="email" />
                      <PhoneGroup codeLabel="Code" codeName="CountryCode1" codeValue={formData.CountryCode1} numLabel="Primary contact" numName="CurrentContactNo"   numValue={formData.CurrentContactNo}   onChange={handleChange} required />
                      <PhoneGroup codeLabel="Code" codeName="CountryCode2" codeValue={formData.CountryCode2} numLabel="Alternate contact" numName="AlternateContactNo" numValue={formData.AlternateContactNo} onChange={handleChange} />
                      <PhoneGroup codeLabel="Code" codeName="CountryCode3" codeValue={formData.CountryCode3} numLabel="Emergency contact" numName="EmergencyContactNo" numValue={formData.EmergencyContactNo} onChange={handleChange} />
                      <div style={{ ...st.formGroup, gridColumn: "1 / -1" }}>
                        <label style={st.label}>Current address</label>
                        <input name="CurrentAddress" value={formData.CurrentAddress} onChange={handleChange} style={st.input} />
                      </div>
                      <div style={{ ...st.formGroup, gridColumn: "1 / -1" }}>
                        <label style style={st.label}>Permanent address</label>
                        <input name="PermanantAddress" value={formData.PermanantAddress} onChange={handleChange} style={st.input} />
                      </div>
                    </div>
                  )}

                  {/* ── Job Details ── */}
                  {activeTab === 'Job Details' && (
                    <div style={st.grid}>
                      <SelectGroup label="System role" name="role" value={formData.role} onChange={handleChange} required>
                        <option value="">Select role…</option>
                        <option value="admin">Admin</option>
                        <option value="hr">HR</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="employee">Employee</option>
                      </SelectGroup>
                      <FormGroup label="Password" name="Password" type="password" value={formData.Password} onChange={handleChange} required />
                      <SelectGroup label="Employee status" name="Status" value={formData.Status} onChange={handleChange}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Suspended">Suspended</option>
                      </SelectGroup>
                      <SelectGroup label="Employment type" name="StatusOfEmployee" value={formData.StatusOfEmployee} onChange={handleChange}>
                        <option value="">Select type…</option>
                        {employeeStatuses.map(s => <option key={s.id} value={s.employee_status}>{s.employee_status}</option>)}
                      </SelectGroup>
                      
                      <SelectGroup label="Department" name="Department" value={formData.Department} onChange={handleChange}>
                        <option value="">Select department…</option>
                        {departments.map(d => (
                          <option key={d.id || d.departmentid} value={d.id || d.departmentid}>
                            {d.Department || d.name || `Department #${d.id}`}
                          </option>
                        ))}
                      </SelectGroup>

                      <FormGroup label="Designation ID"  name="Designation"        value={formData.Designation}        onChange={handleChange} type="number" />
                      <FormGroup label="Designation start" name="DesignationStartDate" value={formData.DesignationStartDate} onChange={handleChange} type="date" />
                      <FormGroup label="Designation end"   name="DesignationEndDate"   value={formData.DesignationEndDate}   onChange={handleChange} type="date" />
                      <FormGroup label="Joining date"    name="StartDate"          value={formData.StartDate}          onChange={handleChange} type="date" />
                      <FormGroup label="End date"        name="EndDate"            value={formData.EndDate}            onChange={handleChange} type="date" />
                      <FormGroup label="Company branch"  name="CompanyBranch"      value={formData.CompanyBranch}      onChange={handleChange} type="number" />
                      <FormGroup label="Working branch"  name="WorkingBranch"      value={formData.WorkingBranch}      onChange={handleChange} type="number" />
                      <FormGroup label="Work location"   name="WorkLocation"       value={formData.WorkLocation}       onChange={handleChange} />
                      
                      <SelectGroup label="Direct supervisor" name="DirectSupervisor" value={formData.DirectSupervisor} onChange={handleChange}>
                        <option value="">Select direct supervisor…</option>
                        {directSupervisors.map(s => (
                          <option key={`d-${s.EmployeeID || s.id}`} value={s.EmployeeID || s.id}>
                            {s.FirstName} {s.LastName} (#{s.EmployeeID || s.id})
                          </option>
                        ))}
                      </SelectGroup>

                      <SelectGroup label="Indirect supervisor" name="IndirectSupervisor" value={formData.IndirectSupervisor} onChange={handleChange}>
                        <option value="">Select indirect supervisor…</option>
                        {indirectSupervisors.map(s => (
                          <option key={`i-${s.EmployeeID || s.id}`} value={s.EmployeeID || s.id}>
                            {s.FirstName} {s.LastName} (#{s.EmployeeID || s.id})
                          </option>
                        ))}
                      </SelectGroup>
                    </div>
                  )}

                  {/* ── Financial & ID ── */}
                  {activeTab === 'Financial & ID' && (
                    <div style={st.grid}>
                      <SectionHead>Banking details</SectionHead>
                      <FormGroup label="Account holder" name="AccountHolderName" value={formData.AccountHolderName} onChange={handleChange} />
                      <FormGroup label="Bank name"      name="BankName"          value={formData.BankName}          onChange={handleChange} />
                      <FormGroup label="Account number" name="AccountNumber"     value={formData.AccountNumber}     onChange={handleChange} />
                      <FormGroup label="IFSC code"      name="IFSCCode"          value={formData.IFSCCode}          onChange={handleChange} />
                      <FormGroup label="Bank branch"    name="Branch"            value={formData.Branch}            onChange={handleChange} />
                      <FormGroup label="NEFT status"    name="NEFT"              value={formData.NEFT}              onChange={handleChange} />

                      <SectionHead>Government IDs</SectionHead>
                      <FormGroup label="PAN number"       name="PANNo"               value={formData.PANNo}               onChange={handleChange} />
                      <FormGroup label="Aadhar number"    name="AadharNo"            value={formData.AadharNo}            onChange={handleChange} />
                      <FormGroup label="PF number"        name="PFNo"                value={formData.PFNo}                onChange={handleChange} />
                      <FormGroup label="PF UAN number"    name="PFUANNo"             value={formData.PFUANNo}             onChange={handleChange} />
                      <FormGroup label="ESIC number"      name="ESICNo"              value={formData.ESICNo}              onChange={handleChange} />
                      <FormGroup label="Driving license"  name="DrivingLicense"      value={formData.DrivingLicense}      onChange={handleChange} />
                      <FormGroup label="DL expiry"        name="ExpiryDrivingLicense" value={formData.ExpiryDrivingLicense} onChange={handleChange} type="date" />
                      <FormGroup label="Passport number"  name="PassportNo"          value={formData.PassportNo}          onChange={handleChange} />
                      <FormGroup label="Passport location" name="PassportLocation"   value={formData.PassportLocation}    onChange={handleChange} />
                    </div>
                  )}
                </fieldset>
              </div>

              <div style={st.modalFoot}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={st.cancelBtn}>
                  {isViewMode ? 'Close' : 'Cancel'}
                </button>
                {!isViewMode && (
                  <button type="submit" disabled={isSubmitting} style={{ ...st.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}>
                    {isSubmitting ? (isEditMode ? 'Updating…' : 'Saving…') : (isEditMode ? 'Update employee' : 'Save employee')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// FIXED: Styled configurations extended to structure filters layout cleanly
const st = {
  filterBarContainer: { display: "grid", gridTemplateColumns: "1.2fr repeat(3, 1fr)", gap: "12px", backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: `1px solid ${C.borderLight}`, marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" },
  filterGroup: { display: "flex", flexDirection: "column" },
  filterInput: { padding: "10px 14px", borderRadius: "8px", border: `1.5px solid ${C.borderLight}`, fontSize: "13.5px", outline: "none", backgroundColor: "#f8fafc" },
  filterSelect: { padding: "10px 14px", borderRadius: "8px", border: `1.5px solid ${C.borderLight}`, fontSize: "13.5px", outline: "none", backgroundColor: "#f8fafc", cursor: "pointer" },
  exportBtn: { border: `1px solid ${C.primary}`, background: "transparent", color: C.primary, padding: "11px 18px", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "14px", transition: "all 0.2s" },

  tableWrap:    { overflowX: 'auto', backgroundColor: C.card, borderRadius: RADIUS?.card ?? 12, boxShadow: SHADOW?.card ?? "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.borderLight}` },
  table:        { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  theadRow:     { borderBottom: `2px solid ${C.borderLight}` },
  th:           { padding: '14px 16px', color: C.muted, fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  tr:           { borderBottom: `1px solid ${C.borderLight}` },
  td:           { padding: '13px 16px', color: C.text, fontSize: '14px', verticalAlign: 'middle' },
  avatar:       { width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', display: 'block' },
  avatarFallback:{ width: 38, height: 38, borderRadius: '50%', background: C.inputBg, border: `1.5px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: C.primary, fontSize: '14px' },
  statusBadge:  { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', display: 'inline-block' },
  roleBadge:    { background: C.inputBg, color: C.primary, border: `1px solid ${C.borderLight}`, padding: '3px 9px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize', display: 'inline-block' },
  addBtn:       { border: "none", background: C.accent ?? "#d63a6e", color: "#fff", padding: "11px 20px", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  btnView:      { background: 'transparent', color: C.primary, border: `1px solid ${C.primary}`, padding: '5px 11px', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '500' },
  btnEdit:      { background: 'transparent', color: '#d97706', border: '1px solid #d97706', padding: '5px 11px', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '500' },
  btnArchive:   { background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', padding: '5px 11px', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '500' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal:      { background: C.card ?? '#fff', borderRadius: '16px', width: '100%', maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', overflow: 'hidden' },
  modalHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 24px 16px', borderBottom: `1px solid ${C.borderLight}`, flexShrink: 0 },
  closeBtn:   { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted, lineHeight: 1, padding: '4px 6px' },
  tabBar:     { display: 'flex', borderBottom: `2px solid ${C.borderLight}`, padding: '0 24px', flexShrink: 0, overflowX: 'auto' },
  tab:        { padding: '12px 18px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', marginBottom: '-2px', color: C.muted, fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', transition: 'color 0.15s' },
  tabActive:  { borderBottomColor: C.primary, color: C.primary },
  formScroll: { flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 },
  grid:       { display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, 1fr)' },
  formGroup:  { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:      { fontSize: '12.5px', fontWeight: '600', color: C.text },
  input:      { padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${C.borderLight}`, background: C.inputBg ?? '#f8fafc', color: C.text, fontSize: '13.5px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  modalFoot:  { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: `1px solid ${C.borderLight}`, flexShrink: 0 },
  cancelBtn:  { background: 'transparent', color: C.muted, border: `1px solid ${C.borderLight}`, padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px' },
  submitBtn:  { background: C.accent ?? '#d63a6e', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px' },
};