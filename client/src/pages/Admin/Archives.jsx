import { useMemo, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "./context/DataContext.jsx";

const formatDate = (iso) => {
  const [year, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
};

export default function Archives() {
  const { archives } = useData();
  const [filters, setFilters] = useState({
    year: "",
    college: "",
    dept: "",
    from: "",
    to: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const unique = (key) => [...new Set(archives.map((record) => record[key]))];
  const set = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setCurrentPage(1); // Reset to page 1 on filter change
  };

  const rows = useMemo(
    () =>
      archives.filter(
        (record) =>
          (!filters.year || record.year === filters.year) &&
          (!filters.college || record.college === filters.college) &&
          (!filters.dept || record.dept === filters.dept) &&
          (!filters.from || record.date >= filters.from) &&
          (!filters.to || record.date <= filters.to),
      ),
    [archives, filters],
  );

  // Pagination computations
  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRows = rows.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const exportCsv = () => {
    const head = ["Record", "Type", "College", "Department", "School Year", "Date"];
    const lines = rows.map((record) =>
      [record.title, record.type, record.college, record.dept, record.year, formatDate(record.date)]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const url = URL.createObjectURL(
      new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "archives.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const styles = {
    pageHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "20px",
      marginBottom: "24px",
      flexWrap: "wrap",
    },
    badge: {
      display: "inline-block",
      background: "#fbe4e8",
      color: "#9b1034",
      fontWeight: 800,
      fontSize: "11.5px",
      letterSpacing: "0.5px",
      padding: "7px 14px",
      borderRadius: "999px",
      wordBreak: "break-word",
    },
    heading: {
      fontSize: "clamp(26px, 4vw, 36px)",
      fontWeight: 800,
      letterSpacing: "-0.5px",
      margin: "12px 0 6px",
      lineHeight: 1.15,
      wordBreak: "break-word",
    },
    muted: {
      color: "#64748b",
    },
    mutedSmall: {
      color: "#64748b",
      fontSize: "13.5px",
    },
    card: {
      background: "#ffffff",
      border: "1px solid #e6ebf0",
      borderRadius: "24px",
      overflow: "hidden",
      width: "100%",
      boxSizing: "border-box",
    },
    filtersCard: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "16px",
      padding: "24px",
      marginBottom: "24px",
      alignItems: "flex-end",
    },
    fieldLabel: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontSize: "11.5px",
      fontWeight: 800,
      letterSpacing: "0.7px",
      color: "#64748b",
      width: "100%",
      marginBottom: 0,
    },
    select: {
      minHeight: "48px",
      padding: "0 16px",
      border: "1px solid #e6ebf0",
      borderRadius: "14px",
      fontSize: "15px",
      background: "#ffffff",
      color: "#16162b",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
    },
    tableCard: {
      width: "100%",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    },
    tableHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      padding: "22px 28px",
    },
    tableHeadTitle: {
      fontSize: "20px",
      fontWeight: 800,
      margin: 0,
    },
    btnSoft: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      minHeight: "48px",
      padding: "10px 22px",
      borderRadius: "14px",
      background: "#fdf0f3",
      color: "#7a0f2b",
      fontSize: "15px",
      fontWeight: 600,
      marginTop: 0,
      border: "none",
      cursor: "pointer",
      whiteSpace: "nowrap",
      boxSizing: "border-box",
    },
    table: {
      width: "100%",
      minWidth: "650px",
      borderCollapse: "collapse",
    },
    theadTr: {
      background: "#f7f9fb",
    },
    th: {
      textAlign: "left",
      fontSize: "11px",
      letterSpacing: "1px",
      color: "#8a97a6",
      padding: "14px 10px",
      fontWeight: 800,
    },
    thFirst: {
      paddingLeft: "28px",
    },
    thLast: {
      paddingRight: "28px",
    },
    td: {
      padding: "18px 10px",
      borderTop: "1px solid #e6ebf0",
      fontSize: "14.5px",
      verticalAlign: "middle",
    },
    titleText: {
      fontWeight: 700,
      fontSize: "15px",
      maxWidth: "320px",
      lineHeight: 1.35,
      wordBreak: "break-word",
    },
    yearPill: {
      display: "inline-block",
      padding: "4px 10px",
      background: "#eef2f6",
      color: "#475569",
      fontSize: "12.5px",
      fontWeight: 700,
      borderRadius: "8px",
      whiteSpace: "nowrap",
    },
    emptyTd: {
      textAlign: "center",
      color: "#64748b",
      padding: "28px",
    },
  };

  return (
    <>
      <div style={styles.pageHead}>
        <div>
          <span style={styles.badge}>ADMINISTRATOR WORKSPACE</span>
          <h1 style={styles.heading}>Academic archives</h1>
          <p style={styles.muted}>Browse historical announcements and events.</p>
        </div>
      </div>

      <div style={{ ...styles.card, ...styles.filtersCard }}>
        <label style={styles.fieldLabel}>
          SCHOOL YEAR
          <select style={styles.select} value={filters.year} onChange={set("year")}>
            <option value="">All school years</option>
            {unique("year").map((year) => <option key={year}>{year}</option>)}
          </select>
        </label>
        <label style={styles.fieldLabel}>
          COLLEGE / ORGANIZATION
          <select style={styles.select} value={filters.college} onChange={set("college")}>
            <option value="">All</option>
            {unique("college").map((college) => <option key={college}>{college}</option>)}
          </select>
        </label>
        <label style={styles.fieldLabel}>
          DEPARTMENT
          <select style={styles.select} value={filters.dept} onChange={set("dept")}>
            <option value="">All departments</option>
            {unique("dept").map((dept) => <option key={dept}>{dept}</option>)}
          </select>
        </label>
        <label style={styles.fieldLabel}>
          FROM DATE
          <input type="date" style={styles.select} value={filters.from} onChange={set("from")} />
        </label>
        <label style={styles.fieldLabel}>
          TO DATE
          <input type="date" style={styles.select} value={filters.to} onChange={set("to")} />
        </label>
      </div>

      <div style={{ ...styles.card, ...styles.tableCard }}>
        <div style={styles.tableHead}>
          <div>
            <h3 style={styles.tableHeadTitle}>Archived records</h3>
            <div style={styles.mutedSmall}>{rows.length} records found</div>
          </div>
          <button style={styles.btnSoft} onClick={exportCsv}>
            <Bookmark size={18} /> Export list
          </button>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadTr}>
              <th style={{ ...styles.th, ...styles.thFirst }}>RECORD</th>
              <th style={styles.th}>COLLEGE / ORGANIZATION</th>
              <th style={styles.th}>DEPARTMENT</th>
              <th style={styles.th}>SCHOOL YEAR</th>
              <th style={{ ...styles.th, ...styles.thLast }}>DATE</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((record) => (
              <tr key={record.id}>
                <td style={{ ...styles.td, ...styles.thFirst }}>
                  <div style={styles.titleText}>{record.title}</div>
                  <div style={styles.mutedSmall}>{record.type}</div>
                </td>
                <td style={{ ...styles.td, fontWeight: 600 }}>{record.college}</td>
                <td style={{ ...styles.td, ...styles.muted }}>{record.dept}</td>
                <td style={styles.td}>
                  <span style={styles.yearPill}>{record.year}</span>
                </td>
                <td style={{ ...styles.td, ...styles.thLast, ...styles.muted }}>
                  {formatDate(record.date)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...styles.td, ...styles.emptyTd }}>
                  No archived records match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {rows.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, rows.length)} of {rows.length} records
            </div>
            <div className="pagination-controls">
              <span className="page-number">
                Page {currentPage} of {totalPages || 1}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-outline icon-only"
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn-outline icon-only"
                  onClick={handleNext}
                  disabled={currentPage === totalPages || totalPages === 0}
                  aria-label="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}