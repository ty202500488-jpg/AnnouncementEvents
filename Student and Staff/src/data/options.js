import { DEPTS } from "./seed";

export const PROG = [["BS Computer Science", "BSCS"], ["BS Information Technology", "BSIT"], ["BS Information Systems", "BSIS"]];
export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const collegeName = (c) => (DEPTS.find((d) => d[0] === c) || DEPTS[1])[1];
