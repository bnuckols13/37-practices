/**
 * Styles and script for illuminated pages. The base stylesheet is the site's
 * own (extracted from build/template.html, as build.mjs does for verses/);
 * these add the page chrome from build.mjs PAGE_CSS and the illumination layer.
 */

// From build/build.mjs PAGE_CSS (masthead title, breadcrumbs, hub intro).
export const PAGE_CSS = `
.masthead .title{font-size:clamp(26px,4.4vw,38px);font-weight:300;margin:0 0 6px;line-height:1.15}
.masthead .title a{color:inherit;text-decoration:none}
.crumbs{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-top:16px;color:rgba(250,245,236,.55)}
.crumbs a{color:var(--saffron-light);text-decoration:none;margin-right:0}
.crumbs a:hover{color:#fff;text-decoration:underline}
.crumbs .sep{margin:0 8px;color:rgba(250,245,236,.4)}
.vhead h1{font-size:clamp(25px,3.6vw,36px);font-weight:300;color:var(--maroon);line-height:1.2;margin:0 0 13px}
.hub-intro{font-size:18px;font-weight:300;color:var(--ink-soft);max-width:62ch;margin:26px 0 8px}
@media (max-width:900px){ .app .sidebar{order:2;border-bottom:0;border-top:1px solid var(--rule)} }
@media print{ .crumbs{display:none!important} }
`;

export const ILLUM_CSS = `
.vlink.later{color:rgba(61,43,26,.42);cursor:default}
.vlink.later .num{color:rgba(200,130,26,.45);font-weight:400}
.vlink.textonly{cursor:default}
.toggles{display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 22px}
.toggles button,.gfilters button{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:.6px;padding:5px 12px;border:1px solid var(--rule);
  background:#fff;color:var(--ink-soft);cursor:pointer;border-radius:14px}
.toggles button[aria-pressed="true"],.gfilters button[aria-pressed="true"]{background:var(--maroon);border-color:var(--maroon);color:var(--cream)}
.badges{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:-6px 0 14px}
.badge{font-family:'Lato',sans-serif;font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--saffron);
  border:1px solid var(--rule);padding:3px 9px;border-radius:10px;background:#fff}
.badge.lost{color:var(--maroon);border-color:var(--maroon)}
.prov{font-family:'Lato',sans-serif;font-size:11.5px;letter-spacing:.2px;color:rgba(61,43,26,.72);margin:0 0 18px;
  border-left:3px solid var(--saffron);padding:5px 11px;background:rgba(200,130,26,.06)}
.prov.draft{border-left-color:var(--maroon);color:var(--maroon);background:rgba(107,26,26,.06)}
.summary{font-size:17px;font-weight:300;color:var(--ink-soft);margin:0 0 6px;max-width:62ch}
.song-head{font-family:'Cinzel',serif;font-size:12px;letter-spacing:2px;color:var(--saffron);margin:0 0 4px}
.couplet{position:relative;padding:14px 0 14px 56px;border-top:1px solid var(--rule)}
.couplet:target{background:rgba(200,130,26,.07)}
.couplet .pno{position:absolute;left:0;top:19px;font-family:'Lato',sans-serif;font-size:11px;letter-spacing:1px;color:var(--saffron);
  text-decoration:none;font-weight:700}
.couplet .tag{display:block;font-family:'Lato',sans-serif;font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(200,130,26,.85);margin-bottom:4px}
.ln{margin:0 0 7px}
.ln .en{font-size:20px;font-style:italic;color:var(--maroon);line-height:1.55;margin:0}
.ln .src,.ln .tl,.ln .lit{display:none;margin:2px 0 0}
.ln .src{font-family:'Noto Serif Bengali','Noto Serif Tibetan','Cormorant Garamond',serif;font-size:17px;color:var(--ink)}
.ln .tl{font-size:15.5px;color:var(--ink-soft)}
.ln .lit{font-family:'Lato',sans-serif;font-size:12px;letter-spacing:.2px;color:rgba(61,43,26,.62)}
body.show-src .ln .src,body.show-tl .ln .tl,body.show-lit .ln .lit{display:block}
.lacuna{font-family:'Lato',sans-serif;font-size:12px;letter-spacing:.5px;color:rgba(61,43,26,.55);padding:12px 0 12px 56px;border-top:1px solid var(--rule)}
.muni{display:none;margin:12px 0 4px;border-left:3px solid var(--saffron);background:rgba(200,130,26,.06);padding:10px 16px}
body.show-comm .muni{display:block}
.muni .label{font-family:'Lato',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--saffron);font-weight:700;margin-bottom:4px}
.muni p{margin:0;font-size:16.5px;line-height:1.7;font-weight:300;color:var(--ink-soft)}
.muni details{margin-top:8px}
.muni summary{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:.5px;color:var(--maroon);cursor:pointer}
.muni .full p{margin-top:6px}
.muni .full .tl{font-size:14.5px;color:rgba(61,43,26,.7)}
a.gl{color:inherit;text-decoration:none;border-bottom:1px dotted var(--saffron);cursor:pointer}
a.gl:hover,a.gl:focus-visible{background:rgba(200,130,26,.13);outline:none}
a.gl.person{font-family:'Lato',sans-serif;font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;border:1px solid var(--rule);
  padding:3px 9px;border-radius:10px;background:#fff;color:var(--maroon)}
.gl-pop{position:absolute;z-index:60;width:min(340px,calc(100vw - 32px));background:#fff;border:1px solid var(--rule);border-top:3px solid var(--saffron);
  box-shadow:0 10px 30px rgba(28,16,8,.18);padding:14px 16px 12px;font-size:15px;line-height:1.5;color:var(--ink)}
.gl-pop[hidden]{display:none}
.gl-pop .hw{font-size:20px;font-weight:600;color:var(--maroon);margin:0}
.gl-pop .ty{font-family:'Lato',sans-serif;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--saffron);margin-bottom:6px}
.gl-pop .forms{font-size:14.5px;color:var(--ink-soft);margin:0 0 6px}
.gl-pop .def{margin:0 0 6px}
.gl-pop .sym{margin:0 0 6px;font-size:14.5px;color:var(--ink-soft)}
.gl-pop .more{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:.5px}
.att{font-family:'Lato',sans-serif;font-size:9px;letter-spacing:.5px;border:1px solid var(--rule);padding:0 4px;border-radius:6px;color:var(--saffron);margin-left:3px;vertical-align:1px}
.nref{font-family:'Lato',sans-serif;font-size:10px;margin-left:2px}
.nref a{text-decoration:none;color:var(--saffron)}
.endnotes{padding-left:22px;font-size:15.5px;font-weight:300;color:var(--ink-soft);line-height:1.65}
.endnotes li{margin-bottom:8px}
.endnotes .kind{font-family:'Lato',sans-serif;font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:var(--saffron);margin-right:6px}
.termlist{columns:2;padding-left:18px;font-size:15.5px;margin:0}
.hubtable{width:100%;border-collapse:collapse;font-size:15.5px;margin-top:18px}
.hubtable th{text-align:left;font-family:'Lato',sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--saffron);
  border-bottom:1px solid var(--rule);padding:6px 8px;font-weight:700}
.hubtable td{border-bottom:1px solid var(--rule);padding:7px 8px;vertical-align:top}
.hubtable tr.pending td{color:rgba(61,43,26,.5)}
.gfilters{display:flex;flex-wrap:wrap;gap:7px;margin:20px 0 6px}
.gentry{border-top:1px solid var(--rule);padding:16px 0 12px;scroll-margin-top:12px}
.gentry:target{background:rgba(200,130,26,.08)}
.gentry[hidden]{display:none}
.gentry h2{font-size:23px;font-weight:600;color:var(--maroon);margin:0}
.gentry .ty{font-family:'Lato',sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--saffron);margin-bottom:6px}
.gentry p{margin:4px 0;font-size:16.5px;line-height:1.65}
.gentry .forms,.gentry .where{font-size:15px;color:var(--ink-soft)}
.legend{font-family:'Lato',sans-serif;font-size:11.5px;color:rgba(61,43,26,.7);line-height:1.8;margin-top:28px;border-top:1px solid var(--rule);padding-top:12px}
@media (max-width:900px){ .couplet{padding-left:42px} .lacuna{padding-left:42px} .termlist{columns:1} }
@media print{
  .toggles,.gfilters,.gl-pop{display:none!important}
  .ln .src,.ln .tl,.ln .lit,.muni{display:block!important}
  a.gl{border:0}
}
`;

// Popovers (click or Enter on a term), Esc to close; view toggles remembered per browser.
export const SCRIPT = `
(function(){
  var node=document.getElementById('gloss-data'); var data=node?JSON.parse(node.textContent):{};
  var pop=document.createElement('div'); pop.className='gl-pop'; pop.hidden=true; pop.setAttribute('role','dialog'); pop.tabIndex=-1;
  document.body.appendChild(pop); var cur=null;
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function open(a){
    var e=data[a.getAttribute('data-g')]; if(!e) return;
    var h='<p class="hw">'+esc(e.en)+'</p><div class="ty">'+esc(e.type)+'</div>';
    if(e.forms.length) h+='<p class="forms">'+e.forms.map(function(f){return esc(f.lang)+' '+esc(f.text)+(f.att?'<span class="att" title="'+esc(f.attTitle)+'">'+esc(f.att)+'</span>':'');}).join(' · ')+'</p>';
    if(e.def) h+='<p class="def">'+esc(e.def)+'</p>';
    if(e.sym) h+='<p class="sym">'+esc(e.sym)+'</p>';
    h+='<a class="more" href="'+esc(a.getAttribute('href'))+'">Full entry →</a>';
    pop.innerHTML=h; pop.hidden=false; pop.setAttribute('aria-label',e.en);
    var r=a.getBoundingClientRect(), w=pop.offsetWidth;
    var left=Math.max(16,Math.min(window.scrollX+r.left,window.scrollX+document.documentElement.clientWidth-w-16));
    pop.style.left=left+'px'; pop.style.top=(window.scrollY+r.bottom+8)+'px';
    if(cur) cur.setAttribute('aria-expanded','false'); cur=a; a.setAttribute('aria-expanded','true');
    if(window.track) window.track('glossary_open',{term:a.getAttribute('data-g')});
  }
  function close(refocus){ if(!cur) return; pop.hidden=true; cur.setAttribute('aria-expanded','false'); if(refocus) cur.focus(); cur=null; }
  document.addEventListener('click',function(ev){
    var a=ev.target.closest&&ev.target.closest('a.gl');
    if(a&&data[a.getAttribute('data-g')]){ ev.preventDefault(); if(cur===a) close(false); else open(a); return; }
    if(cur&&!pop.contains(ev.target)) close(false);
  });
  document.addEventListener('keydown',function(ev){ if(ev.key==='Escape'&&cur) close(true); });
  function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  Array.prototype.forEach.call(document.querySelectorAll('.toggles button'),function(b){
    var cls=b.getAttribute('data-toggle'), saved=store('tr-'+cls);
    function set(on){ b.setAttribute('aria-pressed',on?'true':'false'); document.body.classList.toggle(cls,on); }
    if(saved==='1'||saved==='0') set(saved==='1'); else set(document.body.classList.contains(cls));
    b.addEventListener('click',function(){ var on=b.getAttribute('aria-pressed')!=='true'; set(on); store('tr-'+cls,on?'1':'0'); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.gfilters button'),function(b){
    b.addEventListener('click',function(){
      var t=b.getAttribute('data-type');
      Array.prototype.forEach.call(document.querySelectorAll('.gfilters button'),function(x){ x.setAttribute('aria-pressed',x===b?'true':'false'); });
      Array.prototype.forEach.call(document.querySelectorAll('.gentry'),function(g){ g.hidden=!(t==='all'||g.getAttribute('data-type')===t); });
    });
  });
  window.addEventListener('beforeprint',function(){ Array.prototype.forEach.call(document.querySelectorAll('details'),function(d){ d.open=true; }); });
})();
`;
