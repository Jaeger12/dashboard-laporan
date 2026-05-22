// ═══════════════════════════════════════════════
// THEME TOGGLE SYSTEM
// ═══════════════════════════════════════════════
function initTheme(){
  const savedTheme = localStorage.getItem('dashboardTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme){
  const toggle = document.getElementById('themeToggle');
  if(toggle) toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  
  // Add fade transition for smoother switching
  document.body.style.opacity = '0.95';
  
  setTimeout(() => {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('dashboardTheme', newTheme);
    updateThemeIcon(newTheme);
    
    // Update chart defaults for new theme
    const newChartDefaults = getChartDefaults();
    Object.assign(chartDefaults, newChartDefaults);
    
    // Re-render current page with new theme
    const activePage = document.querySelector('.page.active').id;
    if(activePage==='p1') render_p1();
    if(activePage==='p2') render_p2();
    if(activePage==='p3') render_p3();
    if(activePage==='p4') render_p4();
    
    document.body.style.opacity = '1';
  }, 150);
}

document.addEventListener('DOMContentLoaded', function(){
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if(themeToggle) themeToggle.addEventListener('click', toggleTheme);
});

// ═══════════════════════════════════════════════
// DATA INITIALIZATION & REGIONS MAPPING
// ═══════════════════════════════════════════════
const MGR_MAP = {West:'Anna Andreadi', East:'Chuck Magee', Central:'Kelly Williams', South:'Cassandra Brandow'};
const RAW = superstoreData.map(r => {
  const d = r["Order Date"].split('/');
  const date = new Date(d[2], d[0]-1, d[1]);
  const month = date.getMonth()+1;
  const quarter = Math.ceil(month/3);
  return {
    Year:    +d[2],
    Month:   month,
    Quarter: quarter,
    Region:  r["Region"],
    Segment: r["Segment"],
    Category:     r["Category"],
    "Sub-Category": r["Sub-Category"],
    Sales:    +r["Sales"],
    Profit:   +r["Profit"],
    Quantity: +r["Quantity"],
    Discount: +r["Discount"],
    Manager:  MGR_MAP[r["Region"]] || r["Region"],
    "Ship Mode": r["Ship Mode"]
  };
});

// ═══════════════════════════════════════════════
// GLOBAL CONFIG & CONSTANTS
// ═══════════════════════════════════════════════
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const COLORS = { blue:'#4d9fff', green:'#00d68f', amber:'#ffb830', red:'#ff4d6d', teal:'#00c2c7', purple:'#9b7fff' };
const CAT_COLOR = { 'Technology':'#00c2c7', 'Office Supplies':'#9b7fff', 'Furniture':'#ffb830' };

function getChartDefaults(){
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || !document.documentElement.getAttribute('data-theme');
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tickColor = isDark ? '#6b7d9e' : '#6b7280';
  return {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: tickColor } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor } }
    }
  };
}

const chartDefaults = getChartDefaults();

// ═══════════════════════════════════════════════
// CHART REGISTRY
// ═══════════════════════════════════════════════
const charts = {};
function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
function makeChart(id, cfg){
  destroyChart(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  charts[id] = new Chart(ctx, cfg);
}

// ═══════════════════════════════════════════════
// HELPER UTILITIES
// ═══════════════════════════════════════════════
function sum(arr, key){ return arr.reduce((s,r)=>s+r[key], 0); }
function fmtK(v){ return v<0 ? '-$'+Math.abs(v/1000).toFixed(1)+'K' : '$'+(v/1000).toFixed(1)+'K'; }
function fmt(v){ return Math.round(v).toLocaleString('en-US'); }

function groupBy(arr, key){
  return arr.reduce((acc, r)=>{
    const k = r[key];
    if(!acc[k]) acc[k] = { sales:0, profit:0, qty:0, count:0 };
    acc[k].sales += r.Sales;
    acc[k].profit += r.Profit;
    acc[k].qty += r.Quantity;
    acc[k].count++;
    return acc;
  }, {});
}

// ═══════════════════════════════════════════════
// CORE STATE VARIABLE UNTUK VARIATOR FILTER BARU
// ═══════════════════════════════════════════════
let filterState = {
  year: 'all',
  quarter: 'all',
  region: 'all'
};

// Jalankan event listener untuk komponen UI Filter Kustom
document.querySelectorAll('#group-year .tab-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('#group-year .tab-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
    filterState.year = this.getAttribute('data-value');
    onFilterChange();
  });
});

document.querySelectorAll('#group-quarter .pill-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('#group-quarter .pill-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
    filterState.quarter = this.getAttribute('data-value');
    onFilterChange();
  });
});

document.querySelectorAll('#group-region .rc-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('#group-region .rc-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
    const radioInput = this.querySelector('input[type="radio"]');
    if(radioInput) {
      radioInput.checked = true;
      filterState.region = radioInput.value;
    }
    onFilterChange();
  });
});


// ═══════════════════════════════════════════════
// FILTER SYSTEM RETRIEVAL
// ═══════════════════════════════════════════════
function getFiltered(){
  const fYear     = filterState.year;
  const fQuarter  = filterState.quarter;
  const fRegion   = filterState.region;
  const fSegment  = document.getElementById('f-segment').value;
  const fCategory = document.getElementById('f-category').value;

  return RAW.filter(r => {
    if(fYear !== 'all' && r.Year !== +fYear) return false;
    if(fQuarter !== 'all' && r.Quarter !== +fQuarter) return false;
    if(fRegion !== 'all' && r.Region !== fRegion) return false;
    if(fSegment !== 'all' && r.Segment !== fSegment) return false;
    if(fCategory !== 'all' && r.Category !== fCategory) return false;
    return true;
  });
}

function onFilterChange(){
  const activePage = document.querySelector('.page.active').id;
  if(activePage==='p1') render_p1();
  if(activePage==='p2') render_p2();
  if(activePage==='p3') render_p3();
  if(activePage==='p4') render_p4();
}

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  
  document.getElementById(id).classList.add('active');
  event.currentTarget.classList.add('active');
  
  onFilterChange();
}

// ═══════════════════════════════════════════════
// PAGE 1 — OVERVIEW HISTORIS
// ═══════════════════════════════════════════════
function render_p1(){
  const D = getFiltered();
  const totalSales  = sum(D,'Sales');
  const totalProfit = sum(D,'Profit');
  const totalQty    = sum(D,'Quantity');
  const margin      = totalSales>0 ? totalProfit/totalSales*100 : 0;

  // KPI Render
  document.getElementById('p1-kpis').innerHTML = `
    <div class="kpi-card k-blue"><div class="kpi-label">Total Sales</div><div class="kpi-val">${fmtK(totalSales)}</div><div class="kpi-sub">Semua transaksi terpilih</div></div>
    <div class="kpi-card k-green"><div class="kpi-label">Total Profit</div><div class="kpi-val">${fmtK(totalProfit)}</div><div class="kpi-sub">Net profit setelah diskon</div></div>
    <div class="kpi-card k-amber"><div class="kpi-label">Profit Margin</div><div class="kpi-val">${margin.toFixed(1)}%</div><div class="kpi-sub">Rata-rata keseluruhan</div></div>
    <div class="kpi-card k-teal"><div class="kpi-label">Total Qty Terjual</div><div class="kpi-val">${fmt(totalQty)}</div><div class="kpi-sub">Unit produk terjual</div></div>
  `;

  // Narasi Dinamis Paragraf Page 1
  const byYear = groupBy(D,'Year');
  const years = Object.keys(byYear).sort();
  const bestYear = years.reduce((a,b)=>byYear[a].profit>byYear[b].profit?a:b, years[0]||'N/A');
  const bySeg = groupBy(D,'Segment');
  const segs = Object.keys(bySeg);
  const bestSeg = segs.reduce((a,b)=>bySeg[a].sales>bySeg[b].sales?a:b, segs[0]||'N/A');

  document.getElementById('p1-insight').innerHTML = `
    <p style="margin: 0 0 8px 0; line-height: 1.5;">
      <strong>Analisis Tren Historis:</strong> Berdasarkan filter data aktif, Superstore berhasil membukukan total penjualan sebesar <strong>${fmtK(totalSales)}</strong> dengan keuntungan bersih mencapai <strong>${fmtK(totalProfit)}</strong>. Kinerja keuangan ini menghasilkan rata-rata profit margin keseluruhan sebesar <strong>${margin.toFixed(1)}%</strong> dari total <strong>${fmt(D.length)} transaksi</strong> yang terproses.
    </p>
    <p style="margin: 0; line-height: 1.5;">
      Apabila dibedah lebih dalam, tahun <strong>${bestYear}</strong> muncul sebagai periode paling menguntungkan dengan kontribusi profit tertinggi. Sementara itu, dari sisi segmentasi pasar, segmen <strong>${bestSeg}</strong> menjadi motor penggerak utama revenue dengan volume penjualan terbesar dibandingkan segmen lainnya. Ditinjau dari pergerakan kuartal ke kuartal, stabilitas margin perlu dijaga agar tidak terjadi penurunan tajam pada kuartal mendatang.
    </p>
  `;

  // Charts
  const qMap = {};
  D.forEach(r=>{ const k=r.Year+'-Q'+r.Quarter; if(!qMap[k])qMap[k]={sales:0,profit:0}; qMap[k].sales+=r.Sales; qMap[k].profit+=r.Profit; });
  const qKeys = Object.keys(qMap).sort();
  
  makeChart('ch-quarterly',{
    type:'bar',
    data:{ labels:qKeys,
      datasets:[
        {label:'Sales',data:qKeys.map(k=>qMap[k].sales),backgroundColor:'rgba(77,159,255,0.7)',borderRadius:4,order:2},
        {label:'Profit',data:qKeys.map(k=>qMap[k].profit),backgroundColor:'rgba(0,214,143,0.7)',borderRadius:4,order:2},
        {label:'Margin %',data:qKeys.map(k=>qMap[k].sales>0?+(qMap[k].profit/qMap[k].sales*100).toFixed(1):0),type:'line',borderColor:COLORS.amber,backgroundColor:'transparent',tension:.4,yAxisID:'y2',pointRadius:3,order:1}
      ]
    },
    options:{ ...chartDefaults, responsive:true,
      scales:{
        x:{ticks:{color:'#6b7d9e',font:{size:9}},grid:{color:'rgba(37,46,66,0.6)'}},
        y:{ticks:{color:'#6b7d9e',font:{size:10},callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}},
        y2:{position:'right',ticks:{color:COLORS.amber,font:{size:10},callback:v=>v+'%'},grid:{display:false}}
      }
    }
  });

  makeChart('ch-yearly',{
    type:'doughnut',
    data:{ labels:years, datasets:[{data:years.map(y=>byYear[y].sales), backgroundColor:['#4d9fff','#00d68f','#ffb830','#9b7fff'], borderWidth:0, hoverOffset:8 }] },
    options:{ responsive:true, cutout:'60%', plugins:{ legend:{ position:'bottom', labels:{ color:'#6b7d9e', font:{size:11}, padding:12 } } } }
  });

  makeChart('ch-segment',{
    type:'bar',
    data:{ labels:segs, datasets:[{label:'Sales',data:segs.map(s=>bySeg[s].sales),backgroundColor:segs.map((_,i)=>['#4d9fff','#9b7fff','#00c2c7'][i]),borderRadius:6}]},
    options:{ ...chartDefaults, responsive:true, indexAxis:'y', scales:{ x:{ticks:{color:'#6b7d9e',font:{size:10},callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e'},grid:{display:false}} } }
  });

  makeChart('ch-margin',{
    type:'line',
    data:{ labels:qKeys, datasets:[{label:'Profit Margin %',data:qKeys.map(k=>qMap[k].sales>0?+(qMap[k].profit/qMap[k].sales*100).toFixed(2):0),borderColor:COLORS.teal,backgroundColor:'rgba(0,194,199,0.08)',fill:true,tension:.4,pointRadius:4,pointBackgroundColor:COLORS.teal}] },
    options:{ ...chartDefaults, responsive:true, scales:{ x:{ticks:{color:'#6b7d9e',font:{size:9}},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e',callback:v=>v+'%'},grid:{color:'rgba(37,46,66,0.6)'}} } }
  });
}

// ═══════════════════════════════════════════════
// PAGE 2 — EVALUASI TARGET BULANAN
// ═══════════════════════════════════════════════
function render_p2(){
  const D = getFiltered();
  const mMap = {};
  for(let m=1;m<=12;m++) mMap[m]={sales:0,profit:0,qty:0,count:0};
  D.forEach(r=>{ const m=r.Month; mMap[m].sales+=r.Sales; mMap[m].profit+=r.Profit; mMap[m].qty+=r.Quantity; mMap[m].count++; });

  const mSales  = Object.values(mMap).map(m=>m.sales);
  const mProfit = Object.values(mMap).map(m=>m.profit);
  const avgSales  = mSales.reduce((a,b)=>a+b,0)/12;
  const avgProfit = mProfit.reduce((a,b)=>a+b,0)/12;
  const bestMonth = mSales.indexOf(Math.max(...mSales))+1;
  const worstMonth= mSales.indexOf(Math.min(...mSales))+1;
  const aboveAvgCount = mSales.filter(s=>s>avgSales).length;

  // KPI Render
  document.getElementById('p2-kpis').innerHTML = `
    <div class="kpi-card k-blue"><div class="kpi-label">Rata-rata Sales/Bulan</div><div class="kpi-val">${fmtK(avgSales)}</div><div class="kpi-sub">Target baseline</div></div>
    <div class="kpi-card k-green"><div class="kpi-label">Bulan Terbaik</div><div class="kpi-val">${MONTHS[bestMonth-1]}</div><div class="kpi-sub">Sales tertinggi</div></div>
    <div class="kpi-card k-red"><div class="kpi-label">Bulan Terlemah</div><div class="kpi-val">${MONTHS[worstMonth-1]}</div><div class="kpi-sub">Sales terendah</div></div>
    <div class="kpi-card k-amber"><div class="kpi-label">Bulan Di Atas Avg</div><div class="kpi-val">${aboveAvgCount}/12</div><div class="kpi-sub">Mencapai target</div></div>
  `;

  // Narasi Dinamis Paragraf Page 2
  document.getElementById('p2-insight').innerHTML = `
    <p style="margin: 0 0 8px 0; line-height: 1.5;">
      <strong>Analisis Pola Musiman:</strong> Data bulanan menunjukkan fluktuasi penjualan yang dipengaruhi oleh efek musiman (*seasonality*). Rata-rata target penjualan baseline berada di angka <strong>${fmtK(avgSales)}</strong> per bulan. Tercatat sebanyak <strong>${aboveAvgCount} dari 12 bulan</strong> performanya berhasil melampaui garis rata-rata nasional tersebut.
    </p>
    <p style="margin: 0; line-height: 1.5;">
      Lonjakan performa tertinggi (*peak season*) terjadi pada bulan <strong>${MONTHS[bestMonth-1]}</strong> yang mencatatkan sales terbesar. Sebaliknya, penurunan terdalam terlihat pada bulan <strong>${MONTHS[worstMonth-1]}</strong> sebagai titik performa terlemah. Kesenjangan yang lebar ini menuntut tim operasional untuk menyusun strategi promo khusus atau manajemen inventori yang lebih fleksibel di bulan-bulan sepi guna menyeimbangkan neraca profitabilitas.
    </p>
  `;

  // Charts
  makeChart('ch-monthly-bar',{
    type:'bar',
    data:{ labels:MONTHS, datasets:[{label:'Sales',data:mSales,backgroundColor:mSales.map(s=>s>=avgSales?'rgba(77,159,255,0.75)':'rgba(255,77,109,0.75)'),borderRadius:4}] },
    options:{ ...chartDefaults, responsive:true, scales:{ x:{ticks:{color:'#6b7d9e'},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}} } }
  });

  makeChart('ch-monthly-profit',{
    type:'line',
    data:{ labels:MONTHS, datasets:[
      {label:'Profit',data:mProfit,borderColor:COLORS.green,backgroundColor:'rgba(0,214,143,0.08)',fill:true,tension:.4,pointRadius:4,pointBackgroundColor:mProfit.map(p=>p<0?COLORS.red:COLORS.green)},
      {label:'Rata-rata',data:Array(12).fill(avgProfit),borderColor:COLORS.amber,borderDash:[6,3],borderWidth:1.5,pointRadius:0}
    ]},
    options:{ ...chartDefaults, responsive:true, scales:{ x:{ticks:{color:'#6b7d9e'},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}} } }
  });

  // Heatmap Matrix
  const years = [...new Set(D.map(r=>r.Year))].sort();
  const yrMoMap = {};
  years.forEach(y=>{ yrMoMap[y]={}; for(let m=1;m<=12;m++) yrMoMap[y][m]=0; });
  D.forEach(r=>{ if(yrMoMap[r.Year]) yrMoMap[r.Year][r.Month]+=r.Sales; });

  const allVals = Object.values(yrMoMap).flatMap(mo=>Object.values(mo));
  const maxVal  = Math.max(...allVals);
  let heatHtml = `<div style="display:grid;gap:3px">`;
  heatHtml += `<div style="display:grid;grid-template-columns:50px repeat(12,1fr);gap:3px;margin-bottom:2px"><div></div>`+MONTHS.map(m=>`<div style="text-align:center;font-size:.65rem;color:#6b7d9e">${m}</div>`).join('')+`</div>`;
  years.forEach(y=>{
    heatHtml += `<div style="display:grid;grid-template-columns:50px repeat(12,1fr);gap:3px"><div style="font-size:.7rem;color:#6b7d9e;display:flex;align-items:center">${y}</div>`;
    for(let m=1;m<=12;m++){
      const v = yrMoMap[y][m];
      const pct = maxVal>0?v/maxVal:0;
      heatHtml += `<div title="${MONTHS[m-1]} ${y}: ${fmtK(v)}" style="height:28px;background:rgba(77,159,255, ${(0.1+pct*0.85).toFixed(2)});border-radius:4px"></div>`;
    }
    heatHtml += `</div>`;
  });
  document.getElementById('heatmap-container').innerHTML = heatHtml + `</div>`;

  // Table
  let tblHtml = `<thead><tr><th>Bulan</th><th class="num">Sales</th><th class="num">Profit</th><th class="num">Qty</th><th class="num">Margin</th><th>Status</th></tr></thead><tbody>`;
  for(let m=1;m<=12;m++){
    const row = mMap[m]; const mg = row.sales>0?(row.profit/row.sales*100):0;
    tblHtml += `<tr><td>${MONTHS[m-1]}</td><td class="num">${fmtK(row.sales)}</td><td class="num ${row.profit<0?'neg':'pos'}">${fmtK(row.profit)}</td><td class="num">${fmt(row.qty)}</td><td class="num">${mg.toFixed(1)}%</td><td>${row.sales>=avgSales?'<span class="badge g">✔ On Track</span>':'<span class="badge r">✘ Under</span>'}</td></tr>`;
  }
  document.getElementById('tbl-monthly').innerHTML = tblHtml + `</tbody>`;
}

// ═══════════════════════════════════════════════
// PAGE 3 — AUDIT PROFITABILITAS KATEGORI
// ═══════════════════════════════════════════════
function render_p3(){
  const D = getFiltered();
  const byCat    = groupBy(D,'Category');
  const bySubCat = groupBy(D,'Sub-Category');

  const cats = Object.keys(byCat);
  const subs = Object.keys(bySubCat);

  const worstSub = subs.reduce((a,b)=>bySubCat[a].profit<bySubCat[b].profit?a:b, subs[0]||'N/A');
  const bestSub  = subs.reduce((a,b)=>bySubCat[a].profit>bySubCat[b].profit?a:b, subs[0]||'N/A');
  const negSubs  = subs.filter(s=>bySubCat[s].profit<0).length;
  const furnitureMargin = byCat['Furniture']?.sales>0?(byCat['Furniture'].profit/byCat['Furniture'].sales*100).toFixed(1):0;

  // KPI Render
  document.getElementById('p3-kpis').innerHTML = `
    <div class="kpi-card k-purple"><div class="kpi-label">Sub-Kategori Merugi</div><div class="kpi-val">${negSubs}</div><div class="kpi-sub">Profit negatif</div></div>
    <div class="kpi-card k-green"><div class="kpi-label">Sub-Kat. Terbaik</div><div class="kpi-val" style="font-size:1.1rem">${bestSub}</div><div class="kpi-sub">${fmtK(bySubCat[bestSub]?.profit||0)} profit</div></div>
    <div class="kpi-card k-red"><div class="kpi-label">Sub-Kat. Terburuk</div><div class="kpi-val" style="font-size:1.1rem">${worstSub}</div><div class="kpi-sub">${fmtK(bySubCat[worstSub]?.profit||0)} profit</div></div>
    <div class="kpi-card k-amber"><div class="kpi-label">Margin Furniture</div><div class="kpi-val">${furnitureMargin}%</div><div class="kpi-sub">Kategori rawan kerugian</div></div>
  `;

  // Narasi Dinamis Paragraf Page 3
  document.getElementById('p3-insight').innerHTML = `
    <p style="margin: 0 0 8px 0; line-height: 1.5;">
      <strong>Hasil Audit Profitabilitas:</strong> Peninjauan portofolio produk menunjukkan indikasi bocornya profit di beberapa lini bisnis. Saat ini terdeteksi sebanyak <strong style="color:${COLORS.red}">${negSubs} sub-kategori berada dalam kondisi merugi</strong>. Sub-kategori <strong>${worstSub}</strong> tercatat menguras kas perusahaan paling besar dengan kerugian total mencapai <strong>${fmtK(bySubCat[worstSub]?.profit||0)}</strong>, bertolak belakang dengan <strong>${bestSub}</strong> yang tampil sebagai penyumbang keuntungan terbesar.
    </p>
    <p style="margin: 0; line-height: 1.5;">
      Berdasarkan grafik dampak diskon, tingginya persentase potongan harga berkorelasi kuat dengan rusaknya margin operasional (khususnya kategori Furniture dengan margin kritis sebesar <strong>${furnitureMargin}%</strong>). Rekomendasi audit menyarankan pengetatan ambang batas (*threshold*) diskon maksimal dan evaluasi ulang harga jual untuk sub-kategori bernilai negatif kronis.
    </p>
  `;

  // Charts & Tables
  makeChart('ch-cat-profit',{
    type:'bar',
    data:{ labels:cats, datasets:[ {label:'Sales',data:cats.map(c=>byCat[c].sales),backgroundColor:cats.map(c=>CAT_COLOR[c]+'aa'),borderRadius:5}, {label:'Profit',data:cats.map(c=>byCat[c].profit),backgroundColor:cats.map(c=>CAT_COLOR[c]),borderRadius:5} ]},
    options:{ ...chartDefaults, responsive:true, scales:{ x:{ticks:{color:'#6b7d9e'},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}} } }
  });

  const bubbleData = subs.map(s=>({x:bySubCat[s].sales, y:bySubCat[s].profit, r:Math.min(Math.sqrt(bySubCat[s].count)*2.2,20), label:s}));
  makeChart('ch-subcat-bubble',{
    type:'bubble',
    data:{ datasets:bubbleData.map(b=>({label:b.label,data:[{x:b.x,y:b.y,r:b.r}],backgroundColor:b.y<0?'rgba(255,77,109,0.6)':'rgba(0,214,143,0.5)',borderColor:b.y<0?COLORS.red:COLORS.green,borderWidth:1})) },
    options:{ responsive:true, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>`${ctx.dataset.label}: Sales ${fmtK(ctx.raw.x)}, Profit ${fmtK(ctx.raw.y)}` } } }, scales:{ x:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}} } }
  });

  const sorted = [...subs].sort((a,b)=>bySubCat[a].profit-bySubCat[b].profit).slice(0,10);
  makeChart('ch-loss-subcat',{
    type:'bar',
    data:{ labels:sorted, datasets:[{label:'Profit',data:sorted.map(s=>bySubCat[s].profit),backgroundColor:sorted.map(s=>bySubCat[s].profit<0?'rgba(255,77,109,0.75)':'rgba(0,214,143,0.55)'),borderRadius:4}] },
    options:{ ...chartDefaults, responsive:true, indexAxis:'y', scales:{ x:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e'},grid:{display:false}} } }
  });

  const dBuckets = {'0%':[], '1-20%':[], '21-40%':[], '41-60%':[], '>60%':[]};
  D.forEach(r=>{ const d=r.Discount; let k='0%'; if(d>0&&d<=.2)k='1-20%'; else if(d>.2&&d<=.4)k='21-40%'; else if(d>.4&&d<=.6)k='41-60%'; else if(d>.6)k='>60%'; dBuckets[k].push(r); });
  const dKeys = Object.keys(dBuckets);
  const dAvgProfit = dKeys.map(k=>{ const arr=dBuckets[k]; return arr.length>0?arr.reduce((s,r)=>s+r.Profit,0)/arr.length:0; });
  makeChart('ch-discount-impact',{
    type:'bar',
    data:{ labels:dKeys, datasets:[{label:'Avg Profit',data:dAvgProfit,backgroundColor:dAvgProfit.map(v=>v<0?'rgba(255,77,109,0.75)':'rgba(0,214,143,0.65)'),borderRadius:5}] },
    options:{ ...chartDefaults, responsive:true, scales:{ x:{ticks:{color:'#6b7d9e'},grid:{color:'rgba(37,46,66,0.6)'}}, y:{ticks:{color:'#6b7d9e',callback:v=>`$${v.toFixed(0)}`},grid:{color:'rgba(37,46,66,0.6)'}} } }
  });

  let tbl = `<thead><tr><th>Sub-Kategori</th><th class="num">Sales</th><th class="num">Profit</th><th class="num">Margin</th><th>Status</th></tr></thead><tbody>`;
  [...subs].sort((a,b)=>bySubCat[a].profit-bySubCat[b].profit).forEach(s=>{
    const r=bySubCat[s]; const mg=r.sales>0?(r.profit/r.sales*100):0;
    tbl+=`<tr><td>${s}</td><td class="num">${fmtK(r.sales)}</td><td class="num ${r.profit<0?'neg':'pos'}">${fmtK(r.profit)}</td><td class="num">${mg.toFixed(1)}%</td><td>${mg<0?'<span class="badge r">⚠ Merugi</span>':mg<10?'<span class="badge a">△ Kritis</span>':'<span class="badge g">✔ Sehat</span>'}</td></tr>`;
  });
  document.getElementById('tbl-subcat').innerHTML = tbl + `</tbody>`;
}

// ═══════════════════════════════════════════════
// PAGE 4 — KINERJA REGIONAL & STRATEGI
// ═══════════════════════════════════════════════
function render_p4(){
  const D = getFiltered();
  const byRegion  = groupBy(D,'Region');
  const byManager = groupBy(D,'Manager');
  const regions   = ['West','East','South','Central'];
  const managers  = Object.keys(byManager);

  const bestReg  = regions.reduce((a,b)=>(byRegion[a]?.profit||0)>(byRegion[b]?.profit||0)?a:b, regions[0]);
  const worstReg = regions.reduce((a,b)=>(byRegion[a]?.profit||0)<(byRegion[b]?.profit||0)?a:b, regions[0]);
  const worstMgr = managers.reduce((a,b)=>(byManager[a]?.profit||0)<(byManager[b]?.profit||0)?a:b, managers[0]||'N/A');
  const worstMgMargin = byManager[worstMgr]?.sales>0?(byManager[worstMgr].profit/byManager[worstMgr].sales*100).toFixed(1):0;

  // KPI Render
  document.getElementById('p4-kpis').innerHTML = `
    <div class="kpi-card k-green"><div class="kpi-label">Region Terbaik</div><div class="kpi-val">${bestReg}</div><div class="kpi-sub">${fmtK(byRegion[bestReg]?.profit||0)} profit</div></div>
    <div class="kpi-card k-red"><div class="kpi-label">Region Kritis</div><div class="kpi-val">${worstReg}</div><div class="kpi-sub">${fmtK(byRegion[worstReg]?.profit||0)} profit</div></div>
    <div class="kpi-card k-amber"><div class="kpi-label">Manajer Kritis</div><div class="kpi-val" style="font-size:.85rem">${worstMgr}</div><div class="kpi-sub">Profit terendah</div></div>
    <div class="kpi-card k-blue"><div class="kpi-label">Region Aktif</div><div class="kpi-val">${regions.filter(r=>byRegion[r]).length}</div><div class="kpi-sub">Sesuai filter</div></div>
  `;

  // Narasi Dinamis Paragraf Page 4
  document.getElementById('p4-insight').innerHTML = `
    <p style="margin: 0 0 8px 0; line-height: 1.5;">
      <strong>Analisis Efisiensi Wilayah:</strong> Geografis sebaran data menunjukkan ketimpangan profitabilitas yang cukup mencolok antar wilayah kerja. Region <strong>${bestReg}</strong> mendominasi perolehan laba bersih secara nasional, membuktikan efektivitas taktik penjualan di sana. Sebaliknya, wilayah <strong style="color:${COLORS.red}">${worstReg}</strong> berada di zona kritis dan membutuhkan perhatian manajemen secepatnya.
    </p>
    <p style="margin: 0; line-height: 1.5;">
      Secara personal, performa manajer wilayah <strong>${worstMgr}</strong> tercatat paling rendah dengan capaian margin hanya sebesar <strong>${worstMgMargin}%</strong>, berada di bawah batas rata-rata nasional. Diperlukan peninjauan ulang struktur bauran logistik (Ship Mode) dan perbaikan model segmentasi pelanggan lokal agar efisiensi margin dapat kembali terdongkrak naik.
    </p>
  `;

  // Charts
  const regsAct = regions.filter(r=>byRegion[r]);
  makeChart('ch-region-profit',{
    type:'bar',
    data:{ labels:regsAct, datasets:[{label:'Profit',data:regsAct.map(r=>byRegion[r].profit),backgroundColor:regsAct.map(r=>byRegion[r].profit<0?'rgba(255,77,109,0.75)':'rgba(0,214,143,0.65)'),borderRadius:6}] },
    options:{ ...chartDefaults, responsive:true, indexAxis:'y', scales:{ x:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}}, y:{grid:{display:false}} } }
  });

  makeChart('ch-manager-sales',{
    type:'bar',
    data:{ labels:managers, datasets:[{label:'Sales',data:managers.map(m=>byManager[m].sales),backgroundColor:managers.map(m=>m===worstMgr?'rgba(255,184,48,0.7)':'rgba(77,159,255,0.65)'),borderRadius:6}] },
    options:{ ...chartDefaults, responsive:true, indexAxis:'y', scales:{ x:{ticks:{color:'#6b7d9e',callback:v=>fmtK(v)},grid:{color:'rgba(37,46,66,0.6)'}}, y:{grid:{display:false}} } }
  });

  const shipMap = {}; D.forEach(r=>{ if(!shipMap[r['Ship Mode']])shipMap[r['Ship Mode']]=0; shipMap[r['Ship Mode']]++; });
  const ships = Object.keys(shipMap);
  makeChart('ch-shipmode',{
    type:'doughnut',
    data:{ labels:ships, datasets:[{data:ships.map(s=>shipMap[s]),backgroundColor:['#4d9fff','#00d68f','#ffb830','#9b7fff'],borderWidth:0}] },
    options:{ responsive:true, cutout:'55%', plugins:{ legend:{ position:'bottom', labels:{ color:'#6b7d9e', font:{size:10} } } } }
  });

  const regSegMap = {}; regsAct.forEach(r=>{ regSegMap[r]={Consumer:0,Corporate:0,'Home Office':0}; });
  D.forEach(r=>{ if(regSegMap[r.Region]) regSegMap[r.Region][r.Segment]=(regSegMap[r.Region][r.Segment]||0)+r.Sales; });
  makeChart('ch-region-seg',{
    type:'bar',
    data:{ labels:regsAct, datasets:[ {label:'Consumer',data:regsAct.map(r=>regSegMap[r].Consumer),backgroundColor:'rgba(0,214,143,0.7)'}, {label:'Corporate',data:regsAct.map(r=>regSegMap[r].Corporate),backgroundColor:'rgba(77,159,255,0.7)'}, {label:'Home Office',data:regsAct.map(r=>regSegMap[r]['Home Office']),backgroundColor:'rgba(155,127,255,0.7)',borderRadius:4} ]},
    options:{ ...chartDefaults, responsive:true, scales:{ x:{stacked:true}, y:{stacked:true,ticks:{callback:v=>fmtK(v)}} } }
  });

  const avgMarginNational = D.length>0?sum(D,'Profit')/sum(D,'Sales')*100:0;
  makeChart('ch-region-margin',{
    type:'bar',
    data:{ labels:regsAct, datasets:[
      {label:'Margin Region',data:regsAct.map(r=>byRegion[r].sales>0?(byRegion[r].profit/byRegion[r].sales*100):0),backgroundColor:regsAct.map(r=>{ const m=byRegion[r].sales>0?byRegion[r].profit/byRegion[r].sales*100:0; return m<0?'rgba(255,77,109,0.7)':m<avgMarginNational?'rgba(255,184,48,0.7)':'rgba(0,214,143,0.7)'; }),borderRadius:6},
      {label:'Avg Nasional',data:Array(regsAct.length).fill(+avgMarginNational.toFixed(1)),type:'line',borderColor:COLORS.amber,borderDash:[5,3],pointRadius:0}
    ]},
    options:{ ...chartDefaults, responsive:true, scales:{ y:{ticks:{callback:v=>v.toFixed(1)+'%'}} } }
  });

  // Bagian Bawah Strategis Halaman 4
  document.getElementById('narr-strategic').innerHTML = `
    <h3>📌 Rekomendasi Strategis</h3>
    <p><strong>1. Intervensi Kritis — Region ${worstReg} (${worstMgr})</strong><br/>Region <span class="danger">${worstReg}</span> menunjukkan performa di bawah standar baseline nasional. Kebijakan pemberian nilai diskon harus dievaluasi ulang agar kebocoran profit tidak terulang kembali.</p>
    <p><strong>2. Duplikasi Keberhasilan — Region ${bestReg}</strong><br/>Gunakan model bauran taktis komersial dari region <span class="good">${bestReg}</span> sebagai acuan restrukturisasi bagi regional manager lainnya.</p>
  `;
}

// RUNAWAY INIT ON STARTUP
render_p1();
