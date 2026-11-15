// Category summaries use the existing log without changing saved records.
export function categorySummary(entries, mode = 'all') {
  const groups = new Map();
  let savings = 0;
  for (const entry of entries || []) {
    if (!entry || !Number.isSafeInteger(entry.amount) || entry.amount <= 0) continue;
    if (entry.type === 'saving') { savings += entry.amount; continue; }
    if (!['bill','spending'].includes(entry.type)) continue;
    if (mode !== 'all' && entry.type !== mode) continue;
    const category = entry.category || 'Other';
    const name = category === 'Amazon' ? (entry.subscribe ? 'Amazon Subscribe & Save' : 'Regular Amazon') : category;
    const group = groups.get(name) || { name, amount: 0, entries: [] };
    group.amount += entry.amount;
    group.entries.push(entry);
    groups.set(name, group);
  }
  const categories = [...groups.values()].sort((a,b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return { categories, total: categories.reduce((sum, group) => sum + group.amount, 0), savings };
}

if (typeof document !== 'undefined') {
  const pounds = value => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(value / 100);
  const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  let mode = 'all', signature = '', host, queued = false;
  const root = document.getElementById('root');
  function refresh() {
    queued = false;
    const shell = root?.querySelector('.shell');
    if (!shell) return;
    if (!host || !host.isConnected) {
      host = node('section','category-breakdown');
      host.setAttribute('aria-labelledby','category-breakdown-heading');
      const before = shell.querySelector('.transactions') || shell.querySelector('.regular-panel') || shell.querySelector('.backup-panel');
      shell.insertBefore(host,before);
      signature = '';
    }
    let month, error = '';
    try {
      const saved = JSON.parse(localStorage.getItem('monthly-money-phone-v1') || 'null');
      const selected = shell.querySelector('#month-select')?.value;
      month = saved?.data?.months?.find(m => m.id === selected);
    } catch { error = 'Your category totals could not be read. Your saved log has not been changed.'; }
    const next = JSON.stringify([month?.id, month?.entries, mode, error]);
    if (next === signature) return;
    signature = next;
    const opened = new Set([...host.querySelectorAll('details[open]')].map(detail=>detail.dataset.category));
    const heading = node('h2','','Spending by category');
    heading.id = 'category-breakdown-heading';
    const intro = node('p','category-intro','Totals for your selected month. Tap a category to see its entries.');
    host.replaceChildren(heading,intro);
    if (error || !month) { host.append(node('p','category-empty',error || 'Choose or set up a spending month to see your category totals.')); return; }
    const tools = node('div','category-controls');
    const label = node('label','','Include');
    const select = node('select'); select.setAttribute('aria-label','Category totals include');
    for (const [value,text] of [['all','Spending & bills'],['spending','Other spending only'],['bill','Bills only']]) { const option = node('option','',text); option.value=value; select.append(option); }
    select.value = mode;
    select.addEventListener('change',()=>{mode=select.value;refresh();host.querySelector('select')?.focus();});
    label.append(select); tools.append(label); host.append(tools);
    const summary = categorySummary(month.entries,mode);
    const total = node('p','category-total'); total.append(node('span','',mode==='all'?'Total spending & bills':mode==='bill'?'Total bills':'Total other spending'),node('strong','',pounds(summary.total)));
    total.setAttribute('aria-live','polite'); host.append(total);
    const list = node('div','category-list');
    for (const group of summary.categories) {
      const detail = node('details','category-group'); detail.dataset.category=group.name; detail.open=opened.has(group.name);
      const row = node('summary','category-row');
      const info = node('div','category-info'); info.append(node('strong','',group.name),node('span','',`${group.entries.length} ${group.entries.length===1?'entry':'entries'}`));
      row.append(info,node('strong','category-amount',pounds(group.amount)));
      const track = node('span','category-bar'); track.setAttribute('aria-hidden','true');
      const fill = node('span'); fill.style.width=`${summary.total?group.amount/summary.total*100:0}%`; track.append(fill);row.append(track);
      const entries = node('ul','category-entry-list');
      for (const entry of [...group.entries].sort((a,b)=>String(b.date).localeCompare(String(a.date)))) {
        const li=node('li'); const description=node('div');description.append(node('span','',entry.name));
        const date=new Date(entry.date+'T12:00:00');
        description.append(node('small','',`${Number.isNaN(date.getTime())?entry.date:date.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · ${entry.type==='bill'?'Bill':'Spending'}`));
        li.append(description,node('strong','',pounds(entry.amount)));entries.append(li);
      }
      detail.append(row,entries);list.append(detail);
    }
    if (!summary.categories.length) list.append(node('p','category-empty','No entries in this view yet. Add purchases or bills to see them here.'));
    host.append(list,node('p','category-savings',`Savings kept separate: ${pounds(summary.savings)}`));
  }
  function schedule() { if (!queued) { queued=true; queueMicrotask(refresh); } }
  if (root) new MutationObserver(changes=>{if(changes.some(change=>!host || (change.target!==host && !host.contains(change.target)))) schedule();}).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value']});
  document.addEventListener('change',event=>{if(event.target?.id==='month-select')schedule();});
  window.addEventListener('storage',event=>{if(event.key==='monthly-money-phone-v1')schedule();});
  schedule();
}
