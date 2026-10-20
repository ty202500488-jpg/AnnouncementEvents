import { useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import { useData } from "../context/DataContext.jsx";

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
  const unique = (key) => [...new Set(archives.map((record) => record[key]))];
  const set = (key) => (event) =>
    setFilters((current) => ({ ...current, [key]: event.target.value }));

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

  return (
    <>
      <div className="page-head">
        <div>
          <span className="badge">ADMINISTRATOR WORKSPACE</span>
          <h1>Academic archives</h1>
          <p className="muted">Browse historical announcements and events.</p>
        </div>
      </div>

      <div className="card filters">
        <label className="field-label">
          SCHOOL YEAR
          <select className="select" value={filters.year} onChange={set("year")}>
            <option value="">All school years</option>
            {unique("year").map((year) => <option key={year}>{year}</option>)}
          </select>
        </label>
        <label className="field-label">
          COLLEGE / ORGANIZATION
          <select className="select" value={filters.college} onChange={set("college")}>
            <option value="">All</option>
            {unique("college").map((college) => <option key={college}>{college}</option>)}
          </select>
        </label>
        <label className="field-label">
          DEPARTMENT
          <select className="select" value={filters.dept} onChange={set("dept")}>
            <option value="">All departments</option>
            {unique("dept").map((dept) => <option key={dept}>{dept}</option>)}
          </select>
        </label>
        <label className="field-label">
          FROM DATE
          <input type="date" className="select" value={filters.from} onChange={set("from")} />
        </label>
        <label className="field-label">
          TO DATE
          <input type="date" className="select" value={filters.to} onChange={set("to")} />
        </label>
      </div>

      <div className="card table-card">
        <div className="table-head">
          <div>
            <h3>Archived records</h3>
            <div className="muted small">{rows.length} records found</div>
          </div>
          <button className="btn-soft" style={{ marginTop: 0 }} onClick={exportCsv}>
            <Bookmark size={18} /> Export list
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>RECORD</th><th>COLLEGE / ORGANIZATION</th><th>DEPARTMENT</th>
              <th>SCHOOL YEAR</th><th>DATE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id}>
                <td>
                  <div className="t-title">{record.title}</div>
                  <div className="muted small">{record.type}</div>
                </td>
                <td style={{ fontWeight: 600 }}>{record.college}</td>
                <td className="muted">{record.dept}</td>
                <td><span className="year-pill">{record.year}</span></td>
                <td className="muted">{formatDate(record.date)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="empty">No archived records match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
