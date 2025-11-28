


/**
 * A lightweight Markdown parser to avoid external dependencies.
 * Handles: Headers, Bold, Italic, Strikethrough, Highlight, Tables, Mermaid, Lists, Quotes, Code, Links, Images, Sup, Sub, Footnotes.
 */
export const markdownService = {
  render: (text: string): string => {
    if (!text) return '';

    // Escape HTML to prevent XSS (basic)
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 0. Mermaid Blocks (```mermaid ... ```)
    html = html.replace(/```mermaid([\s\S]*?)```/g, '<div class="mermaid bg-white dark:bg-slate-200 p-4 rounded-lg my-4 overflow-x-auto text-center">$1</div>');

    // 1. Code Blocks (```code```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-800 text-slate-100 p-4 rounded-lg my-4 overflow-x-auto font-mono text-sm"><code>$1</code></pre>');

    // 2. Inline Code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-sm font-mono text-rose-600 dark:text-rose-400">$1</code>');

    // 3. Images (![alt](url))
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl shadow-md my-4 max-w-full h-auto border border-slate-200 dark:border-slate-700" />');

    // 4. Links
    // 4a. Internal Entry Links (entry:uuid) - No target=_blank, special styling
    html = html.replace(/\[([^\]]+)\]\((entry:[^)]+)\)/g, '<a href="$2" class="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer inline-flex items-center gap-1" data-internal-link="true"><span class="text-[10px] opacity-70">🔗</span>$1</a>');
    
    // 4b. Graph Visualization Links (graph:params) - Button Style
    html = html.replace(/\[([^\]]+)\]\((graph:[^)]+)\)/g, '<a href="$2" class="inline-flex items-center gap-1.5 mx-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium hover:bg-purple-200 shadow-sm border border-purple-200 dark:border-purple-800 cursor-pointer no-underline" data-graph-link="true"><span class="text-[10px]">🕸️</span>$1</a>');

    // 4c. External Links ([title](url)) - Standard
    html = html.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">$1</a>');
    // 4d. Generic/Relative Links Fallback
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">$1</a>');

    // 5. Headers (H1 - H6)
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-200 dark:border-slate-800">$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3 text-slate-800 dark:text-slate-200">$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-5 mb-2 text-slate-800 dark:text-slate-200">$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-lg font-semibold mt-4 mb-2 text-slate-700 dark:text-slate-300">$1</h4>');
    html = html.replace(/^##### (.*$)/gim, '<h5 class="text-base font-semibold mt-4 mb-2 text-slate-700 dark:text-slate-300 uppercase tracking-wide">$1</h5>');
    html = html.replace(/^###### (.*$)/gim, '<h6 class="text-sm font-semibold mt-4 mb-2 text-slate-600 dark:text-slate-400 uppercase tracking-wider">$1</h6>');

    // 6. Blockquotes (> quote)
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-4 py-1 italic text-slate-600 dark:text-slate-400 my-4 bg-slate-50 dark:bg-slate-900/50 rounded-r-lg">$1</blockquote>');

    // 7. Horizontal Rule (---)
    html = html.replace(/^---$/gim, '<hr class="my-8 border-slate-200 dark:border-slate-700" />');

    // 8. Task Lists
    html = html.replace(/^\s*-\s\[ \]\s(.*$)/gim, '<div class="flex items-start gap-3 my-2"><input type="checkbox" disabled class="mt-1.5" /><span class="text-slate-700 dark:text-slate-300">$1</span></div>');
    html = html.replace(/^\s*-\s\[x\]\s(.*$)/gim, '<div class="flex items-start gap-3 my-2"><input type="checkbox" checked disabled class="mt-1.5 accent-indigo-600" /><span class="text-slate-500 dark:text-slate-500 line-through">$1</span></div>');

    // 9. Tables
    const tableRegex = /((?:\|.*\|(?:\n|$))+)/g;
    html = html.replace(tableRegex, (match) => {
        if (!match.includes('|---')) return match;
        const rows = match.trim().split('\n');
        let tableHtml = '<div class="overflow-x-auto my-6"><table class="w-full text-sm text-left border-collapse border border-slate-200 dark:border-slate-700">';
        rows.forEach((row, index) => {
            const cols = row.split('|').filter(c => c.trim() !== '');
            if (cols.length === 0) return;
            if (index === 0) {
                tableHtml += '<thead class="bg-slate-100 dark:bg-slate-800"><tr>';
                cols.forEach(col => tableHtml += `<th class="px-4 py-2 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">${col.trim()}</th>`);
                tableHtml += '</tr></thead><tbody>';
            } else if (row.includes('---')) {
                return;
            } else {
                tableHtml += '<tr class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">';
                cols.forEach(col => tableHtml += `<td class="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">${col.trim()}</td>`);
                tableHtml += '</tr>';
            }
        });
        tableHtml += '</tbody></table></div>';
        return tableHtml;
    });

    // 10. Unordered Lists
    html = html.replace(/^\s*[-*]\s(?!\[[ x]\])(.*$)/gim, '<li class="ml-4 list-disc marker:text-slate-400 pl-2">$1</li>');

    // 11. Ordered Lists
    html = html.replace(/^\s*\d+\.\s(.*$)/gim, '<li class="ml-4 list-decimal marker:text-slate-400 pl-2">$1</li>');

    // Wrap Lists
    html = html.replace(/(<li class="ml-4 list-disc.*<\/li>\s*)+/gim, '<ul class="my-4 space-y-1 text-slate-700 dark:text-slate-300">$&</ul>');
    html = html.replace(/(<li class="ml-4 list-decimal.*<\/li>\s*)+/gim, '<ol class="my-4 space-y-1 text-slate-700 dark:text-slate-300">$&</ol>');

    // 12. Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-900 dark:text-slate-100">$1</strong>');

    // 13. Italic
    html = html.replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>');
    html = html.replace(/_(.*?)_/gim, '<em class="italic">$1</em>');

    // 14. Strikethrough
    html = html.replace(/~~(.*?)~~/gim, '<del class="text-slate-400">$1</del>');

    // 15. Highlight
    html = html.replace(/==(.*?)==/gim, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-yellow-100 px-0.5 rounded">$1</mark>');

    // 16. Superscript (^text^)
    html = html.replace(/\^([^\^]+)\^/g, '<sup class="text-xs">$1</sup>');

    // 17. Subscript (~text~)
    html = html.replace(/~([^~]+)~/g, '<sub class="text-xs">$1</sub>');

    // 18. Footnotes ([^1])
    html = html.replace(/\[\^(\d+)\]/g, '<sup id="ref-$1" class="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"><a href="#fn-$1">[$1]</a></sup>');
    // Footnote Definition ([^1]: text)
    html = html.replace(/^\[\^(\d+)\]:\s*(.*)$/gm, '<div id="fn-$1" class="text-sm text-slate-500 mt-2 border-t border-slate-100 pt-1"><a href="#ref-$1" class="mr-1 no-underline">↩</a> <span class="font-bold">[$1]</span> $2</div>');

    // 19. Paragraphs
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(p => {
        if (!p.trim()) return '';
        // Avoid wrapping block elements in <p>
        if (p.trim().match(/^(<h|<ul|<ol|<pre|<div|<block|<hr|<img|<table)/)) return p;
        return `<p class="mb-4 leading-relaxed text-slate-700 dark:text-slate-300">${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');

    return html;
  }
};