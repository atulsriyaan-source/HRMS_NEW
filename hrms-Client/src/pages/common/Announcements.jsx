import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { C, RADIUS } from "../../theme";
import { 
  FiCalendar, 
  FiSearch, 
  FiEye, 
  FiArrowLeft,
  FiUser,
  FiClock,
  FiMessageCircle,
  FiChevronLeft,
  FiChevronRight,
  FiFileText // Added for visual description identity markup
} from "react-icons/fi";

export default function Announcements() {
  const navigate = useNavigate();
  const location = useLocation();
  const [announcements, setAnnouncements] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const userRole = localStorage.getItem("role") || "employee";

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (search.trim() === "") {
      setFiltered(announcements);
    } else {
      const query = search.toLowerCase();
      setFiltered(
        announcements.filter(a => 
          a.Notice?.toLowerCase().includes(query) || 
          a.Description?.toLowerCase().includes(query) // FIXED: Included description inside input search matrices
        )
      );
    }
    setCurrentPage(1);
  }, [search, announcements]);

  useEffect(() => {
    if (location.state?.announcement) {
      setSelectedAnnouncement(location.state.announcement);
      setIsDetailView(true);
      return;
    }

    const path = window.location.pathname;
    const idMatch = path.match(/\/(\d+)$/);
    if (idMatch && announcements.length > 0) {
      const id = parseInt(idMatch[1]);
      const found = announcements.find(a => a.id === id);
      if (found) {
        setSelectedAnnouncement(found);
        setIsDetailView(true);
      }
    }
  }, [location, announcements]);

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch('http://localhost:5000/api/admin/announcements', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
        setFiltered(data);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleView = (announcement) => {
    let basePath = "/employee";
    let viewPath = "announcements";
    
    if (userRole === "admin" || userRole === "hr") {
      basePath = "/admin";
      viewPath = "announcements-view";
    } else if (userRole === "manager") {
      basePath = "/manager";
    }
    
    navigate(`${basePath}/${viewPath}/${announcement.id}`, { 
      state: { announcement } 
    });
  };

  const handleBack = () => {
    setIsDetailView(false);
    setSelectedAnnouncement(null);
    
    let basePath = "/employee";
    let viewPath = "announcements";
    
    if (userRole === "admin" || userRole === "hr") {
      basePath = "/admin";
      viewPath = "announcements-view";
    } else if (userRole === "manager") {
      basePath = "/manager";
    }
    
    navigate(`${basePath}/${viewPath}`, { state: { fromDetail: true } });
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filtered.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Detail View ──────────────────────────────────────────────────────────────
  if (isDetailView && selectedAnnouncement) {
    const bannerImg = selectedAnnouncement.Photo 
      ? `http://localhost:5000/uploads/${selectedAnnouncement.Photo}`
      : "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200";

    return (
      <div style={styles.detailContainer}>
        <button style={styles.backBtn} onClick={handleBack}>
          <FiArrowLeft /> Back to Announcements
        </button>

        <div style={styles.detailCard}>
          <img src={bannerImg} alt="Announcement banner" style={styles.detailBanner} />
          
          <div style={styles.detailContent}>
            <div style={styles.detailMeta}>
              <span style={styles.detailMetaItem}>
                <FiCalendar /> {formatDate(selectedAnnouncement.NoticeDate)}
              </span>
              <span style={styles.detailMetaItem}>
                <FiClock /> {formatTime(selectedAnnouncement.NoticeDate)}
              </span>
              {selectedAnnouncement.CreatedBy && (
                <span style={styles.detailMetaItem}>
                  <FiUser /> Posted by: {selectedAnnouncement.CreatedBy}
                </span>
              )}
            </div>

            {/* Title / Header Context */}
            <h1 style={styles.detailTitle}>{selectedAnnouncement.Notice}</h1>
            
            {/* FIXED: Distinct Block segment generated to isolate and output the detailed structural Description */}
            <div style={styles.detailBodyContainer}>
              <h3 style={styles.sectionSubheading}>
                <FiFileText style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Description Details
              </h3>
              <div style={styles.detailBody}>
                {selectedAnnouncement.Description ? (
                  // whiteSpace pre-wrap enables newline structural breaks parsing automatically from input forms
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedAnnouncement.Description}</p>
                ) : (
                  <p style={{ color: C.muted, fontStyle: 'italic' }}>No additional description details provided for this event.</p>
                )}
              </div>
            </div>

            {selectedAnnouncement.EndDate && (
              <div style={styles.detailFooter}>
                <span style={styles.detailExpiry}>
                  ⏳ Expires on {formatDate(selectedAnnouncement.EndDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📢 Announcements</h1>
          <p style={styles.subtitle}>Stay updated with the latest company news</p>
        </div>
        <div style={styles.headerBadge}>
          <FiMessageCircle /> {filtered.length}
        </div>
      </div>

      <div style={styles.searchBar}>
        <FiSearch style={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search notices or descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => setSearch("")}>✕</button>
        )}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading announcements...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📭</div>
          <h3>No announcements found</h3>
          <p>{search ? "Try adjusting your search" : "No announcements available"}</p>
        </div>
      ) : (
        <>
          <div style={styles.list}>
            {currentItems.map((announcement) => (
              <div key={announcement.id} style={styles.card}>
                <div style={styles.cardContent}>
                  <div style={styles.cardHeader}>
                    <div style={styles.cardDate}>
                      <FiCalendar /> {formatDate(announcement.NoticeDate)}
                    </div>
                    {announcement.EndDate && (
                      <div style={styles.cardExpiry}>
                        Expires: {formatDate(announcement.EndDate)}
                      </div>
                    )}
                  </div>
                  
                  {/* Notice Title Header */}
                  <h3 style={styles.cardTitle}>{announcement.Notice}</h3>
                  
                  {/* FIXED: Added clean summary description view text parser with substring bounding box */}
                  <p style={styles.cardDesc}>
                    {announcement.Description ? (
                      announcement.Description.length > 160 
                        ? `${announcement.Description.substring(0, 160)}...` 
                        : announcement.Description
                    ) : (
                      <span style={{ color: C.muted, fontStyle: 'italic', fontSize: '13px' }}>No additional description text details provided.</span>
                    )}
                  </p>
                  
                  <button style={styles.viewBtn} onClick={() => handleView(announcement)}>
                    <FiEye /> Read More
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button 
                style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <FiChevronLeft /> Previous
              </button>
              
              <div style={styles.pageNumbers}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    style={{ ...styles.pageNumber, ...(currentPage === page ? styles.pageNumberActive : {}) }}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button 
                style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }}
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next <FiChevronRight />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==================== STYLES ====================
const styles = {
  container: { maxWidth: "1000px", margin: "0 auto", padding: "32px 24px", fontFamily: "'Inter', system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" },
  title: { fontSize: "28px", fontWeight: "700", color: C.text, margin: "0 0 4px 0" },
  subtitle: { fontSize: "14px", color: C.muted, margin: 0 },
  headerBadge: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: C.inputBg, border: `1px solid ${C.borderLight}`, borderRadius: "999px", fontSize: "13px", color: C.muted },
  searchBar: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.input, marginBottom: "24px" },
  searchIcon: { color: C.muted, fontSize: "18px" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: "14px", background: "transparent", color: C.text, fontFamily: "inherit" },
  clearBtn: { background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "14px", padding: "4px 8px" },
  loading: { textAlign: "center", padding: "60px 20px", color: C.muted, fontSize: "15px" },
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  list: { display: "flex", flexDirection: "column", gap: "16px" },
  card: { background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.card, overflow: "hidden" },
  cardContent: { padding: "20px 24px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" },
  cardDate: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: C.muted },
  cardExpiry: { fontSize: "12px", color: C.muted, background: C.inputBg, padding: "2px 10px", borderRadius: "999px" },
  cardTitle: { fontSize: "18px", fontWeight: "600", color: C.text, margin: "0 0 8px 0", lineHeight: "1.3" },
  cardDesc: { fontSize: "14px", color: C.muted, margin: "0 0 14px 0", lineHeight: "1.6" },
  viewBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 16px", background: C.inputBg, border: `1px solid ${C.borderLight}`, borderRadius: "6px", color: C.text, fontSize: "13px", fontWeight: "500", cursor: "pointer", transition: "all 0.2s ease" },
  pagination: { display: "flex", justifyCoonent: "center", alignItems: "center", gap: "12px", marginTop: "28px", paddingTop: "20px", borderTop: `1px solid ${C.borderLight}` },
  pageBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: C.inputBg, border: `1px solid ${C.borderLight}`, borderRadius: "6px", color: C.text, fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  pageBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  pageNumbers: { display: "flex", gap: "4px" },
  pageNumber: { width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: "6px", color: C.text, fontSize: "14px", cursor: "pointer" },
  pageNumberActive: { background: C.primary, color: "#fff" },
  
  // Detail View Presentation Layout Configurations
  detailContainer: { maxWidth: "900px", margin: "0 auto", padding: "20px 0" },
  backBtn: { display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "transparent", border: `1px solid ${C.borderLight}`, borderRadius: "6px", color: C.text, cursor: "pointer", fontSize: "14px", fontWeight: "500", marginBottom: "20px" },
  detailCard: { background: C.card, borderRadius: RADIUS.card, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: `1px solid ${C.borderLight}` },
  detailBanner: { width: "100%", height: "280px", objectFit: "cover" },
  detailContent: { padding: "28px 32px" },
  detailMeta: { display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "20px" },
  detailMetaItem: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: C.muted },
  detailTitle: { fontSize: "26px", fontWeight: "700", color: C.text, margin: "0 0 24px 0", lineHeight: "1.3" },
  
  // FIXED: Added contextual layout styles for description container layers
  detailBodyContainer: { backgroundColor: C.inputBg || '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: `1px solid ${C.borderLight}` },
  sectionSubheading: { margin: '0 0 10px 0', fontSize: '15px', fontWeight: '600', color: C.text },
  detailBody: { fontSize: "15px", lineHeight: "1.7", color: C.text },
  
  detailFooter: { paddingTop: "16px", borderTop: `1px solid ${C.borderLight}` },
  detailExpiry: { fontSize: "13px", color: C.muted }
};