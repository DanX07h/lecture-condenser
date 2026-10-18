// AI output is untrusted. Sanitize after Markdown parsing before inserting HTML.
export function renderNotes(text) {
  const html = globalThis.marked.parse(text, {gfm:true, breaks:false});
  return globalThis.DOMPurify.sanitize(html, {
    ALLOWED_TAGS:['h1','h2','h3','h4','p','strong','em','ul','ol','li','blockquote','table','thead','tbody','tr','th','td','code','pre','br','hr','del'],
    ALLOWED_ATTR:['start'],
  });
}
