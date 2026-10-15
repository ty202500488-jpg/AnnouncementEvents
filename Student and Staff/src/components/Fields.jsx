import { PROG, YEARS } from "../data/options";
import { DEPTS } from "../data/seed";

export const Field = ({ label, value, onChange, type = "text", id }) => (
  <>
    <label className="plbl">{label}</label>
    <input className="pf-input" id={id} type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  </>
);

export const Area = ({ label, value, onChange, rows = 3 }) => (
  <>
    <label className="plbl">{label}</label>
    <textarea className="pf-input" rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  </>
);

// options: array of strings, or [value, label] pairs
export const Select = ({ label, value, onChange, options }) => (
  <>
    {label && <label className="plbl">{label}</label>}
    <select className="pf-input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>
  </>
);

// locked field (managed by the university)
export const ReadOnly = ({ label, value }) => (
  <div>
    <label className="plbl">{label}</label>
    <div className="sro">
      <input className="pf-input" value={value} readOnly tabIndex={-1} aria-readonly="true" />
      <i className="fa-solid fa-lock"></i>
    </div>
  </div>
);

export const ProgramSelect = ({ U, value, onChange }) => {
  const list = PROG.some((x) => x[1] === U.cc) ? PROG : [[U.course, U.cc], ...PROG];
  return <Select label="Program" value={value} onChange={onChange} options={list.map((p) => [p[1], p[0]])} />;
};
export const YearSelect = ({ value, onChange }) => <Select label="Year level" value={value} onChange={onChange} options={YEARS} />;
export const CollegeSelect = ({ value, onChange }) => (
  <Select label="College" value={value} onChange={onChange} options={DEPTS.slice(1).map((d) => [d[0], d[1]])} />
);
export const progName = (code, U) => (PROG.find((p) => p[1] === code) || [U.course])[0];
