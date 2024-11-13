!(function (c, l, a, r, i, t, y) {
  if (a[c].v || a[c].t) return a[c]('event', c, 'dup.' + i.projectId)
    ; (a[c].t = !0),
      ((t = l.createElement(r)).async = !0),
      (t.src = 'https://www.clarity.ms/s/0.7.49/clarity.js'),
      (y = l.getElementsByTagName(r)[0]).parentNode.insertBefore(t, y),
      a[c]('start', i),
      a[c].q.unshift(a[c].q.pop()),
      a[c]('set', 'C_IS', '0'),
      a[c]('set', 'C_V', 'v_longTaskControl')
})('clarity', document, window, 'script', {
  projectId: 'ovdzhx610h',
  upload: 'https://r.clarity.ms/collect',
  expire: 365,
  cookies: ['_uetmsclkid', '_uetvid'],
  track: true,
  content: true,
  dob: 1775,
  longTask: 30,
})
