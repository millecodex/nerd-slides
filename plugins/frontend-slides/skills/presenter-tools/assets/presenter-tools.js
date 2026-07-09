(function(){
  var CFG = Object.assign({
    slide: '.slide',
    editable: 'h1,h2,h3,h4,h5,p,li,blockquote,figcaption,.caption,.title,.subtitle,.kicker,.eyebrow,.label,.stat,.note,.lead,.desc',
    saveName: 'slides.html'
  }, (window.PRESENTER_TOOLS_CONFIG||{}));
  var NS='ptools:'+location.pathname;
  var LS_EDIT=NS+':edits', LS_POS=NS+':pos', LS_STY=NS+':style', LS_RATIO=NS+':ratio', LS_DEL=NS+':del';

  var EDIT_SEL = CFG.editable.split(",").map(function(s){ return CFG.slide+" "+s.trim(); }).join(", ");
  var DRAG_SEL = EDIT_SEL + ", " + CFG.slide + " img, " + CFG.slide + " svg, .lg, .plate";
  var LS_EDIT=LS_EDIT, LS_POS=LS_POS;
  var editEls = [].slice.call(document.querySelectorAll(EDIT_SEL));
  var dragEls = [].slice.call(document.querySelectorAll(DRAG_SEL));
  var state = { laser:false, edit:false, arrange:false };

  // toast
  var toast=document.createElement('div'); toast.className='tools-toast'; document.body.appendChild(toast); var tt;
  function say(m){ toast.textContent=m; toast.classList.add('show'); clearTimeout(tt); tt=setTimeout(function(){toast.classList.remove('show');},1300); }

  // laser dot
  var dot=document.createElement('div'); dot.id='laserDot'; document.body.appendChild(dot);
  document.addEventListener('mousemove', function(e){ if(state.laser) dot.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)'; });

  // toolbar
  var hot=document.createElement('div'); hot.id='tools-hotzone'; document.body.appendChild(hot);
  var bar=document.createElement('div'); bar.id='tools-bar';
  bar.innerHTML='<button id="tb-e">Text (E)</button><button id="tb-g">Move (G)</button><button id="tb-l">Laser (L)</button><button id="tb-r">16:9</button><button id="tb-x">Reset</button><button id="tb-s">Save</button>';
  document.body.appendChild(bar);
  var btnE=bar.querySelector('#tb-e'), btnG=bar.querySelector('#tb-g'), btnL=bar.querySelector('#tb-l'), btnR=bar.querySelector('#tb-r'), btnX=bar.querySelector('#tb-x'), btnS=bar.querySelector('#tb-s');
  var hideT; function showBar(){ clearTimeout(hideT); bar.classList.add('show'); }
  function hideBar(){ hideT=setTimeout(function(){ if(!state.edit&&!state.arrange) bar.classList.remove('show'); },500); }
  [hot,bar].forEach(function(el){ el.addEventListener('mouseenter',showBar); el.addEventListener('mouseleave',hideBar); });

  function setLaser(v){ state.laser=v; dot.style.display=v?'block':'none'; document.body.style.cursor=v?'none':''; btnL.classList.toggle('active',v); }
  function setEdit(v){ state.edit=v; document.body.classList.toggle('tools-edit',v); editEls.forEach(function(el){ el.setAttribute('contenteditable', v?'true':'false'); }); btnE.classList.toggle('active',v); if(v&&state.arrange) setArrange(false); if(!v&&rtbar){ rtbar.classList.remove('show'); curEdit=null; } }
  function setArrange(v){ state.arrange=v; document.body.classList.toggle('tools-arrange',v); btnG.classList.toggle('active',v); if(v&&state.edit) setEdit(false); if(!v&&hoverEl){ hoverEl.classList.remove('zk-hover'); hoverEl=null; } if(!v&&overlay){ overlay.classList.remove('show'); selEl=null; } }

  // persist + restore edits
  function persistEdit(el){ try{ var m=JSON.parse(localStorage.getItem(LS_EDIT)||'{}'); m[editEls.indexOf(el)]=el.innerHTML; localStorage.setItem(LS_EDIT,JSON.stringify(m)); }catch(e){} }
  editEls.forEach(function(el){ el.addEventListener('input', function(){ persistEdit(el); }); });
  try{ var se=JSON.parse(localStorage.getItem(LS_EDIT)||'{}'); Object.keys(se).forEach(function(i){ if(editEls[i]) editEls[i].innerHTML=se[i]; }); }catch(e){}

  // drag to reposition
  var drag=null;
  function persistPos(el){ try{ var m=JSON.parse(localStorage.getItem(LS_POS)||'{}'); m[dragEls.indexOf(el)]=el.style.translate||''; localStorage.setItem(LS_POS,JSON.stringify(m)); }catch(e){} }
  try{ var sp=JSON.parse(localStorage.getItem(LS_POS)||'{}'); Object.keys(sp).forEach(function(i){ if(dragEls[i]) dragEls[i].style.translate=sp[i]; }); }catch(e){}
  document.addEventListener('mousedown', function(e){
    if(!state.arrange) return;
    if(e.target.closest('#tools-bar')) return;
    var handle=e.target.closest('#zk-select .h');
    if(handle && selEl){
      e.preventDefault();
      selEl.style.boxSizing='border-box';
      var c=(selEl.style.translate||'0px 0px').trim().split(/\s+/);
      rz={ el:selEl, dir:handle.dataset.dir, sx:e.clientX, sy:e.clientY, w:selEl.offsetWidth, h:selEl.offsetHeight, ox:parseFloat(c[0])||0, oy:parseFloat(c.length>1?c[1]:c[0])||0 };
      return;
    }
    var el=e.target.closest(DRAG_SEL);
    if(!el){ deselect(); return; }
    e.preventDefault();
    selectEl(el);
    var cur=(el.style.translate||'0px 0px').trim().split(/\s+/);
    drag={ el:el, sx:e.clientX, sy:e.clientY, ox:parseFloat(cur[0])||0, oy:parseFloat(cur.length>1?cur[1]:cur[0])||0 };
  });
  document.addEventListener('mousemove', function(e){
    if(!drag) return;
    var dx=drag.ox+(e.clientX-drag.sx), dy=drag.oy+(e.clientY-drag.sy);
    drag.el.style.translate=dx+'px '+dy+'px';
    placeOverlay();
  });
  document.addEventListener('mouseup', function(){ if(drag){ persistPos(drag.el); placeOverlay(); drag=null; } });
  var hoverEl=null;
  document.addEventListener('mousemove', function(e){
    if(!state.arrange || drag || rz) return;
    var el=e.target.closest(DRAG_SEL);
    if(el!==hoverEl){ if(hoverEl) hoverEl.classList.remove('zk-hover'); hoverEl=el; if(el) el.classList.add('zk-hover'); }
  });

  // ── selection frame + resize handles (move mode) ──
  var overlay=document.createElement('div'); overlay.id='zk-select';
  ['nw','n','ne','e','se','s','sw','w'].forEach(function(d){ var h=document.createElement('div'); h.className='h '+d; h.dataset.dir=d; overlay.appendChild(h); });
  document.body.appendChild(overlay);
  var selEl=null, rz=null;
  var delBtn=document.createElement('div'); delBtn.className='zk-del'; delBtn.textContent='\u2715'; delBtn.title='Delete box (Del)'; overlay.appendChild(delBtn);
  function deleteEl(el){ if(!el) return; var idx=dragEls.indexOf(el); if(idx>=0){ try{ var d=JSON.parse(localStorage.getItem(LS_DEL)||'[]'); if(d.indexOf(idx)<0){ d.push(idx); localStorage.setItem(LS_DEL, JSON.stringify(d)); } }catch(e){} } deselect(); el.remove(); say('Box deleted \u00b7 Reset to restore'); }
  delBtn.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); deleteEl(selEl); });
  try{ (JSON.parse(localStorage.getItem(LS_DEL)||'[]')).forEach(function(i){ if(dragEls[i]) dragEls[i].remove(); }); }catch(e){}
  function placeOverlay(){ if(!selEl){ overlay.classList.remove('show'); return; } var r=selEl.getBoundingClientRect(); overlay.style.left=r.left+'px'; overlay.style.top=r.top+'px'; overlay.style.width=r.width+'px'; overlay.style.height=r.height+'px'; overlay.classList.add('show'); }
  function selectEl(el){ selEl=el; placeOverlay(); }
  function deselect(){ selEl=null; overlay.classList.remove('show'); }
  document.addEventListener('mousemove', function(e){
    if(!rz) return;
    var dx=e.clientX-rz.sx, dy=e.clientY-rz.sy, w=rz.w, h=rz.h, tx=rz.ox, ty=rz.oy, d=rz.dir;
    if(d.indexOf('e')>=0) w=rz.w+dx;
    if(d.indexOf('s')>=0) h=rz.h+dy;
    if(d.indexOf('w')>=0){ w=rz.w-dx; tx=rz.ox+dx; }
    if(d.indexOf('n')>=0){ h=rz.h-dy; ty=rz.oy+dy; }
    w=Math.max(40,w); h=Math.max(20,h);
    rz.el.style.width=w+'px'; rz.el.style.height=h+'px'; rz.el.style.translate=tx+'px '+ty+'px';
    placeOverlay();
  });
  document.addEventListener('mouseup', function(){ if(rz){ persistStyle(rz.el); persistPos(rz.el); rz=null; } });
  document.addEventListener('keydown', function(e){ if(['ArrowRight','ArrowLeft','PageUp','PageDown','Home','End',' '].indexOf(e.key)>=0 && !(e.target&&e.target.isContentEditable)) deselect(); });
  window.addEventListener('resize', function(){ if(selEl) placeOverlay(); });
  document.addEventListener('keydown', function(e){ if(state.arrange && selEl && !(e.target&&e.target.isContentEditable) && (e.key==='Delete'||e.key==='Backspace')){ e.preventDefault(); deleteEl(selEl); } });

  // save edited/repositioned copy
  async function save(){
    var clone=document.documentElement.cloneNode(true);
    var bd=clone.querySelector('body'); if(bd) bd.classList.remove('tools-edit','tools-arrange');
    clone.querySelectorAll('[contenteditable]').forEach(function(el){ el.setAttribute('contenteditable','false'); });
    clone.querySelectorAll('.zk-hover').forEach(function(el){ el.classList.remove('zk-hover'); });
    ['#laserDot','#tools-hotzone','#tools-bar','#rt-bar','#zk-select','.tools-toast'].forEach(function(s){ clone.querySelectorAll(s).forEach(function(n){ n.remove(); }); });
    var html='<!DOCTYPE html>\n'+clone.outerHTML;
    // Preferred: write back to the actual file (one source of truth, no duplicate copies).
    // First save asks you to pick the file (choose the deck file to overwrite it);
    // later saves reuse that choice for one-click overwrite.
    if(window.showSaveFilePicker){
      try{
        if(!window.__deckHandle){
          window.__deckHandle = await window.showSaveFilePicker({ suggestedName:CFG.saveName, types:[{description:'HTML file', accept:{'text/html':['.html']}}] });
        }
        var w = await window.__deckHandle.createWritable();
        await w.write(html); await w.close();
        say('Saved → '+window.__deckHandle.name);
        return;
      }catch(err){
        if(err && err.name==='AbortError'){ say('Save cancelled'); return; }
        /* API blocked (e.g. on file://) — fall back to a download below */
      }
    }
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html'})); a.download=CFG.saveName; a.click();
    say('Downloaded '+CFG.saveName+' (browser can’t overwrite files here)');
  }

  btnE.addEventListener('click', function(){ setEdit(!state.edit); say(state.edit?'Text editing on — click any text':'Text editing off'); });
  btnG.addEventListener('click', function(){ setArrange(!state.arrange); say(state.arrange?'Move mode on — drag to reposition':'Move mode off'); });
  btnL.addEventListener('click', function(){ setLaser(!state.laser); say(state.laser?'Laser on':'Laser off'); });
  btnX.addEventListener('click', function(){ if(confirm('Reset all moved/resized/deleted boxes to their original state? (Text edits are kept.)')){ try{ localStorage.removeItem(LS_POS); localStorage.removeItem(LS_STY); localStorage.removeItem(LS_DEL); }catch(e){} location.reload(); } });
  btnS.addEventListener('click', save);
  function applyRatio(fill){ document.body.classList.toggle('fill-mode', !!fill); btnR.textContent = fill ? 'Fill' : '16:9'; btnR.classList.toggle('active', !fill); try{ localStorage.setItem(LS_RATIO, fill?'fill':'lock'); }catch(e){} if(typeof placeOverlay==='function') placeOverlay(); }
  function toggleRatio(){ applyRatio(!document.body.classList.contains('fill-mode')); say(document.body.classList.contains('fill-mode')?'Fill window':'16:9 locked'); }
  btnR.addEventListener('click', toggleRatio);
  applyRatio(false);   /* always start at 16:9; Fill is an in-session toggle */

  document.addEventListener('keydown', function(e){
    if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){ e.preventDefault(); save(); return; }
    if(e.target && e.target.isContentEditable) return;
    if(e.key==='l'||e.key==='L'){ setLaser(!state.laser); showBar(); hideBar(); }
    else if(e.key==='e'||e.key==='E'){ setEdit(!state.edit); showBar(); hideBar(); say(state.edit?'Text editing on':'Text editing off'); }
    else if(e.key==='g'||e.key==='G'){ setArrange(!state.arrange); showBar(); hideBar(); say(state.arrange?'Move mode on':'Move mode off'); }
    else if(e.key==='r'||e.key==='R'){ toggleRatio(); showBar(); hideBar(); }
  });

  // ── rich-text formatting bar ──
  var curEdit=null;
  var rtbar=document.createElement('div'); rtbar.id='rt-bar';
  rtbar.innerHTML='<button data-cmd="bold" title="Bold"><b>B</b></button>'
    +'<button data-cmd="italic" title="Italic"><i>I</i></button>'
    +'<button data-cmd="underline" title="Underline"><u>U</u></button>'
    +'<span class="sep"></span>'
    +'<button data-sz="-2" title="Smaller">A−</button>'
    +'<button data-sz="2" title="Larger">A+</button>'
    +'<span class="sep"></span>'
    +'<button data-al="left" title="Align left">░≡</button>'
    +'<button data-al="center" title="Align center">≡</button>'
    +'<button data-al="right" title="Align right">≡░</button>'
    +'<span class="sep"></span>'
    +'<button class="ft" data-font="Newsreader" title="Serif · Newsreader" style="font-family:Newsreader,Georgia,serif">Aa</button>'
    +'<button class="ft" data-font="Hanken Grotesk" title="Sans · Hanken Grotesk" style="font-family:&#39;Hanken Grotesk&#39;,sans-serif">Aa</button>'
    +'<button class="ft" data-font="DM Mono" title="Mono · DM Mono" style="font-family:&#39;DM Mono&#39;,monospace">Aa</button>'
    +'<span class="sep"></span>'
    +'<button class="sw" data-color="#1F2BE0" title="Cobalt" style="color:#1F2BE0">A</button>'
    +'<button class="sw" data-color="#3A2516" title="Ink" style="color:#3A2516">A</button>'
    +'<button class="sw" data-color="#E5392A" title="Red" style="color:#E5392A">A</button>'
    +'<span class="sep"></span>'
    +'<button class="hl-sw" data-hl="#F3C7DA" title="Highlight · rose"  style="background:#F3C7DA"></button>'
    +'<button class="hl-sw" data-hl="#F4E08A" title="Highlight · amber" style="background:#F4E08A"></button>'
    +'<button class="hl-sw" data-hl="#C3E7C9" title="Highlight · mint"  style="background:#C3E7C9"></button>'
    +'<button class="hl-sw" data-hl="#C6D2F7" title="Highlight · sky"   style="background:#C6D2F7"></button>'
    +'<button class="hl-sw" data-hl="#E7CBEF" title="Highlight · lilac" style="background:#E7CBEF"></button>'
    +'<button data-hl="transparent" title="Remove highlight">⌫</button>';
  document.body.appendChild(rtbar);
  try{ document.execCommand('styleWithCSS', false, true); }catch(e){}

  var STYLE_PROPS=['fontSize','textAlign','fontWeight','fontStyle','textDecoration','color','letterSpacing','width','height','boxSizing'];
  function persistStyle(el){ try{ var m=JSON.parse(localStorage.getItem(LS_STY)||'{}'); var o={}; STYLE_PROPS.forEach(function(pn){ if(el.style[pn]) o[pn]=el.style[pn]; }); m[editEls.indexOf(el)]=o; localStorage.setItem(LS_STY,JSON.stringify(m)); }catch(e){} }
  try{ var ssty=JSON.parse(localStorage.getItem(LS_STY)||'{}'); Object.keys(ssty).forEach(function(i){ if(editEls[i]){ var o=ssty[i]||{}; STYLE_PROPS.forEach(function(pn){ if(o[pn]) editEls[i].style[pn]=o[pn]; }); } }); }catch(e){}

  function placeBar(){ if(!curEdit) return; var r=curEdit.getBoundingClientRect(); var bw=rtbar.offsetWidth||320, bh=rtbar.offsetHeight||38; var top=r.top-bh-10; if(top<6) top=r.bottom+10; var left=Math.min(Math.max(6,r.left), window.innerWidth-bw-6); rtbar.style.top=top+'px'; rtbar.style.left=left+'px'; }
  function ensureSel(){ if(!curEdit) return; var sel=window.getSelection(); if(sel.rangeCount===0||sel.isCollapsed||!curEdit.contains(sel.anchorNode)){ var r=document.createRange(); r.selectNodeContents(curEdit); sel.removeAllRanges(); sel.addRange(r); } }

  rtbar.addEventListener('mousedown', function(e){
    var b=e.target.closest('button'); if(!b) return;
    e.preventDefault();
    if(!curEdit) return;
    if(b.dataset.cmd){ ensureSel(); document.execCommand(b.dataset.cmd,false,null); persistEdit(curEdit); }
    else if(b.dataset.color){ ensureSel(); document.execCommand('foreColor',false,b.dataset.color); persistEdit(curEdit); }
    else if(b.dataset.sz){ var cs=parseFloat(getComputedStyle(curEdit).fontSize)||20; curEdit.style.fontSize=Math.max(8,cs+parseFloat(b.dataset.sz))+'px'; persistStyle(curEdit); placeBar(); }
    else if(b.dataset.al){ curEdit.style.textAlign=b.dataset.al; persistStyle(curEdit); }
    else if(b.dataset.font){ ensureSel(); document.execCommand('fontName',false,b.dataset.font); persistEdit(curEdit); }
    else if(b.dataset.hl){ ensureSel(); if(!document.execCommand('hiliteColor',false,b.dataset.hl)) document.execCommand('backColor',false,b.dataset.hl); persistEdit(curEdit); }
  });

  document.addEventListener('focusin', function(e){ if(!state.edit) return; var el=e.target; if(el&&el.getAttribute&&el.getAttribute('contenteditable')==='true'){ curEdit=el; rtbar.classList.add('show'); placeBar(); } });
  document.addEventListener('focusout', function(){ setTimeout(function(){ var a=document.activeElement; if(!(a&&a.getAttribute&&a.getAttribute('contenteditable')==='true')){ rtbar.classList.remove('show'); } }, 150); });
  window.addEventListener('resize', function(){ if(rtbar.classList.contains('show')) placeBar(); });

})();
