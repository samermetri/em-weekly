// Keep plain-text editorial paragraphs intact across all reading formats.
export const paragraphs=(text:string)=>text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
