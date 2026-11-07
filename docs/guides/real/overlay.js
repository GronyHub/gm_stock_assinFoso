// Injected into every page while a guide is recorded: a finger marker that glides to what is tapped, a ripple on
// each tap, and a caption bar for the current step. Driven from the recorder via window.__demo.
(() => {
  if (window.__demo) return
  const css = `
  #__demo_finger{position:fixed;z-index:2147483646;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
    background:rgba(255,214,0,.55);border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);pointer-events:none;
    transition:left .6s cubic-bezier(.4,0,.2,1),top .6s cubic-bezier(.4,0,.2,1),transform .15s;left:50%;top:60%}
  #__demo_finger.tap{transform:scale(.7)}
  .__demo_ripple{position:fixed;z-index:2147483645;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;
    border:4px solid rgba(255,214,0,.95);pointer-events:none;animation:__demo_r .6s ease-out forwards}
  @keyframes __demo_r{to{transform:scale(4);opacity:0}}
  #__demo_cap{position:fixed;z-index:2147483647;left:8px;right:8px;bottom:10px;padding:10px 12px;border-radius:12px;
    background:rgba(17,24,39,.92);color:#fff;font:600 15px/1.3 Arial,sans-serif;text-align:center;pointer-events:none;
    box-shadow:0 4px 16px rgba(0,0,0,.4);transition:opacity .3s}
  #__demo_cap b{color:#ffd600}
  #__demo_hl{position:fixed;z-index:2147483644;border:3px solid #ffd600;border-radius:8px;pointer-events:none;
    box-shadow:0 0 0 9999px rgba(0,0,0,.18);transition:all .4s}`
  const add = () => {
    if (document.getElementById('__demo_finger')) return
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
    const f = document.createElement('div'); f.id = '__demo_finger'; document.body.appendChild(f)
    const c = document.createElement('div'); c.id = '__demo_cap'; c.style.opacity = '0'; document.body.appendChild(c)
  }
  window.__demo = {
    move(x, y) { add(); const f = document.getElementById('__demo_finger'); f.style.left = x + 'px'; f.style.top = y + 'px' },
    tap(x, y) {
      add(); const f = document.getElementById('__demo_finger'); f.classList.add('tap'); setTimeout(() => f.classList.remove('tap'), 180)
      const r = document.createElement('div'); r.className = '__demo_ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'
      document.body.appendChild(r); setTimeout(() => r.remove(), 700)
    },
    caption(html) { add(); const c = document.getElementById('__demo_cap'); c.innerHTML = html; c.style.opacity = html ? '1' : '0' },
    highlight(rect) {
      let h = document.getElementById('__demo_hl')
      if (!rect) { if (h) h.remove(); return }
      if (!h) { h = document.createElement('div'); h.id = '__demo_hl'; document.body.appendChild(h) }
      Object.assign(h.style, { left: rect.x - 4 + 'px', top: rect.y - 4 + 'px', width: rect.width + 8 + 'px', height: rect.height + 8 + 'px' })
    },
  }
  if (document.readyState !== 'loading') add(); else document.addEventListener('DOMContentLoaded', add)
})()
