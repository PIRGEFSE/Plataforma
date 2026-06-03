import { useEffect, useState, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'
import { useChartColors } from '../../hooks/useChartColors'

const RIESGO_COLORS = { 'Riesgo Bajo': '#10b981', 'Riesgo Moderado': '#f59e0b', 'Riesgo Alto': '#ef4444' }
const EF_COLORS = { Optimo: '#10b981', Moderado: '#f59e0b', Elevado: '#ef4444' }
const COLORS = ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16']
const ESTADO_LABELS = { 1: 'Funcionando', 2: 'Receso', 3: 'Cerrado' }
const ESTADO_COLORS = { 1: '#10b981', 2: '#f59e0b', 3: '#64748b' }

const ENS_MAP = {
  10:{label:'Parvularia',color:'#f472b6'},110:{label:'Básica',color:'#60a5fa'},
  310:{label:'Media H-C',color:'#34d399'},410:{label:'TP Comercial',color:'#fb923c'},
  510:{label:'TP Industrial',color:'#facc15'},610:{label:'TP Técnica',color:'#38bdf8'},
  710:{label:'TP Agrícola',color:'#86efac'},810:{label:'TP Marítima',color:'#67e8f9'},
  910:{label:'Media Artística',color:'#f9a8d4'},
}

// tt() se llama dentro de componentes que usan useChartColors — ver uso abajo

function KPICard({ icon, label, value, color='#6366f1', sub }) {
  return (
    <div className="kpi-card" style={{'--accent':color}}>
      <div className="kpi-icon" style={{background:`${color}20`}}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{color}}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

function getEnsenanzas(ee) {
  const claves = ['ens_01','ens_02','ens_03','ens_04','ens_05','ens_06','ens_07','ens_08','ens_09','ens_10','ens_11']
  const unicos = [...new Set(claves.map(k => Number(ee[k]??0)).filter(c=>c>0))]
  if (!unicos.length) return <span style={{color:'var(--text-disabled)'}}>—</span>
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:'0.2rem'}}>
      {unicos.map(cod => {
        const e = ENS_MAP[cod]; const lbl = e?.label??`Cod ${cod}`; const clr = e?.color??'var(--text-secondary)'
        return <span key={cod} style={{fontSize:'0.65rem',fontWeight:600,color:'#fff',background:clr,borderRadius:999,padding:'0.1rem 0.4rem'}}>{lbl}</span>
      })}
    </div>
  )
}

const SECTION_TITLES = {
  perfil:     { icon:'🏫', label:'Mi Establecimiento' },
  financiero: { icon:'💵', label:'Financiero — Serie Temporal' },
  eficiencia: { icon:'⚙️', label:'Eficiencia del Gasto — Serie Temporal' },
  riesgo:     { icon:'📊', label:'Riesgo — Acreditación de Saldos' },
  subvencion: { icon:'🏷️', label:'Subvenciones' },
}

export default function FichaEstablecimiento({ section='perfil' }) {
  const { user } = useAuth()
  const rbdId = user?.rbd_id || 2979

  const [perfil, setPerfil]           = useState(null)
  const [detalleData, setDetalleData] = useState(null)
  const [subvData, setSubvData]       = useState([])
  const [periodos, setPeriodos]       = useState([2020,2021,2022,2023,2024])
  const [periodo, setPeriodo]         = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    api.get(`/dashboard/ficha-rbd?rbd=${rbdId}&periodo=2024`).then(r => {
      setPerfil(r.data.perfil)
      if (r.data.periodos_disponibles?.length) setPeriodos(r.data.periodos_disponibles.sort((a,b)=>b-a))
    }).finally(() => setLoading(false))
  }, [rbdId])

  const fetchDetalle = useCallback(() => {
    api.get(`/dashboard/ficha-rbd/detalle?rbd=${rbdId}`).then(r => setDetalleData(r.data))
  }, [rbdId])

  useEffect(() => { fetchDetalle() }, [fetchDetalle])

  useEffect(() => {
    const p = periodo ? `&periodo=${periodo}` : ''
    api.get(`/dashboard/subvencion-rbd?rbd=${rbdId}${p}`).then(r => setSubvData(r.data))
  }, [rbdId, periodo])

  const sec = SECTION_TITLES[section] ?? SECTION_TITLES.perfil
  if (loading) return <div className="tab-page"><div className="loading-area"><div className="spinner"/></div></div>

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">{sec.icon} {perfil?.nom_rbd ?? `RBD ${rbdId}`}</h2>
          <p className="tab-subtitle">
            {sec.label} · RBD {rbdId}
            {perfil && ` · ${perfil.nombre_sostenedor ?? ''}`}
          </p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
          {section === 'subvencion' && (
            <>
              <span style={{color:'var(--text-muted)',fontSize:'0.82rem'}}>Año:</span>
              <select className="filter-select" value={periodo} onChange={e=>setPeriodo(e.target.value)} style={{minWidth:100}}>
                <option value="">Todos</option>
                {periodos.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </>
          )}
          {perfil && (
            <span style={{padding:'0.3rem 0.8rem',borderRadius:999,background:'var(--accent-dim)',color:'var(--accent-text)',border:'1px solid var(--line-strong)',fontSize:'0.78rem',fontWeight:600}}>
              🏫 RBD {rbdId}
            </span>
          )}
          {perfil?.rural_rbd && <span style={{padding:'0.3rem 0.8rem',borderRadius:999,background:'var(--warning-dim)',color:'var(--warning-text)',border:'1px solid var(--line-default)',fontSize:'0.78rem',fontWeight:600}}>🌿 Rural</span>}
          {perfil?.convenio_pie && <span style={{padding:'0.3rem 0.8rem',borderRadius:999,background:'var(--accent-dim)',color:'var(--accent-text)',border:'1px solid var(--line-default)',fontSize:'0.78rem',fontWeight:600}}>🔵 PIE</span>}
          {perfil?.pace && <span style={{padding:'0.3rem 0.8rem',borderRadius:999,background:'rgba(139,92,246,0.10)',color:'#a78bfa',border:'1px solid var(--line-default)',fontSize:'0.78rem',fontWeight:600}}>🎓 PACE</span>}
        </div>
      </div>

      {section === 'perfil'     && <TabPerfil perfil={perfil} detalleData={detalleData} />}
      {section === 'financiero' && <TabFinanciero detalleData={detalleData} />}
      {section === 'eficiencia' && <TabEficiencia detalleData={detalleData} />}
      {section === 'riesgo'     && <TabRiesgo detalleData={detalleData} />}
      {section === 'subvencion' && <TabSubvencion data={subvData} periodo={periodo} />}
    </div>
  )
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function TabPerfil({ perfil, detalleData }) {
  if (!perfil) return <div className="loading-area"><div className="spinner"/></div>
  const finUlt = detalleData?.financiero_serie?.slice(-1)[0]
  const estado = ESTADO_LABELS[perfil.estado_estab] ?? '—'
  const estadoColor = ESTADO_COLORS[perfil.estado_estab] ?? '#64748b'

  return (
    <>
      <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(perfil.mat_total)} color="#6366f1"/>
        <KPICard icon="📈" label="Último Ingreso" value={finUlt ? fmtMM(finUlt.ingreso) : '—'} color="#10b981" sub={finUlt ? `Año ${finUlt.periodo}` : ''}/>
        <KPICard icon="📉" label="Último Gasto" value={finUlt ? fmtMM(finUlt.gasto) : '—'} color="#ef4444" sub={finUlt ? `Año ${finUlt.periodo}` : ''}/>
        <KPICard icon="⚖️" label="Superávit" value={finUlt ? fmtMM(finUlt.superavit) : '—'} color={finUlt && finUlt.superavit>=0 ? '#10b981':'#ef4444'}/>
      </div>
      <div className="chart-card" style={{marginBottom:'1.5rem'}}>
        <h3 className="chart-title">Datos del Establecimiento</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'1rem',marginTop:'0.75rem'}}>
          {[
            {label:'RBD',val:perfil.rbd,icon:'🔢'},
            {label:'Nombre',val:perfil.nom_rbd,icon:'🏫'},
            {label:'Estado',val:<span style={{color:estadoColor,fontWeight:600}}>{estado}</span>,icon:'📌'},
            {label:'Matrícula Activa',val:perfil.matricula ? 'Sí' : 'No',icon:'✅'},
            {label:'Sostenedor',val:perfil.nombre_sostenedor,icon:'🏢'},
            {label:'RUT Sostenedor',val:perfil.rut_sostenedor,icon:'🔑'},
            {label:'Rural',val:perfil.rural_rbd?'Sí':'No',icon:'🌿'},
            {label:'Convenio PIE',val:perfil.convenio_pie?'Sí':'No',icon:'🔵'},
            {label:'PACE',val:perfil.pace?'Sí':'No',icon:'🎓'},
          ].map(({label,val,icon})=>(
            <div key={label} style={{background:'var(--surface-overlay)',borderRadius:'0.5rem',padding:'0.75rem',border:'1px solid var(--line-subtle)'}}>
              <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>{icon} {label}</div>
              <div style={{color:'var(--text-primary)',fontWeight:600,fontSize:'0.9rem'}}>{val||'—'}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:'1rem'}}>
          <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginBottom:'0.4rem'}}>🎓 Tipos de Enseñanza</div>
          {getEnsenanzas(perfil)}
        </div>
      </div>
      {detalleData?.financiero_serie?.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Resumen Financiero por Año</h3>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
              <thead>
                <tr style={{background:'var(--surface-overlay)'}}>
                  {['Año','Ingresos','Gastos','Superávit'].map(h=>(
                    <th key={h} style={{padding:'0.6rem 1rem',color:'var(--text-muted)',fontWeight:600,textAlign:'right',borderBottom:'1px solid var(--line-default)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...detalleData.financiero_serie].reverse().map((r,i)=>(
                  <tr key={r.periodo} style={{borderBottom:'1px solid var(--line-subtle)',background:i%2===0?'transparent':'var(--surface-overlay)'}}>
                    <td style={{padding:'0.5rem 1rem',color:'var(--text-secondary)',textAlign:'right'}}>{r.periodo}</td>
                    <td style={{padding:'0.5rem 1rem',color:'var(--success)',textAlign:'right'}}>{fmtMM(r.ingreso)}</td>
                    <td style={{padding:'0.5rem 1rem',color:'var(--danger)',textAlign:'right'}}>{fmtMM(r.gasto)}</td>
                    <td style={{padding:'0.5rem 1rem',textAlign:'right'}}>
                      <strong style={{color:Number(r.superavit)>=0?'var(--success)':'var(--danger)'}}>{fmtMM(r.superavit)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ── Tab: Financiero (serie temporal) ─────────────────────────────────────────
function TabFinanciero({ detalleData }) {
  if (!detalleData) return <div className="loading-area"><div className="spinner"/></div>
  const C = useChartColors()
  const { financiero_serie=[], remuneraciones_serie=[] } = detalleData
  const periodos = financiero_serie.map(d=>String(d.periodo))

  const barOption = {
    tooltip:{ trigger:'axis', axisPointer:{type:'shadow'}, ...C.tooltip,
      formatter: params => {
        const p = params[0]?.axisValue
        const d = financiero_serie.find(r=>String(r.periodo)===p)
        if(!d) return p
        return `<b>${p}</b><br/>📈 Ingreso: ${fmtMM(d.ingreso)}<br/>📉 Gasto: ${fmtMM(d.gasto)}<br/>⚖️ Superávit: <b>${fmtMM(d.superavit)}</b>`
      }
    },
    legend:{ data:['Ingreso','Gasto'], textStyle:{color:C.legend.color}, top:0 },
    grid:{ left:80, right:30, top:40, bottom:30 },
    xAxis:{ type:'category', data:periodos, axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', axisLabel:{color:C.axisLabel, formatter:v=>fmtMonedaCorto(v)}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[
      { name:'Ingreso', type:'bar', barMaxWidth:40, data:financiero_serie.map(d=>Number(d.ingreso)), itemStyle:{color:'#10b981',borderRadius:[4,4,0,0]} },
      { name:'Gasto',   type:'bar', barMaxWidth:40, data:financiero_serie.map(d=>Number(d.gasto)),   itemStyle:{color:'#ef4444',borderRadius:[4,4,0,0]} },
    ],
    backgroundColor:'transparent',
  }

  const superavitOption = {
    tooltip:{ trigger:'axis', ...C.tooltip, formatter:params=>{ const d=financiero_serie[params[0]?.dataIndex]; return d?`<b>${d.periodo}</b><br/>Superávit: <b>${fmtMM(d.superavit)}</b>`:'' } },
    grid:{ left:80, right:30, top:20, bottom:30 },
    xAxis:{ type:'category', data:periodos, axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', axisLabel:{color:C.axisLabel, formatter:v=>fmtMonedaCorto(v)}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[{ type:'bar', barMaxWidth:40,
      data:financiero_serie.map(d=>({ value:Number(d.superavit), itemStyle:{color:Number(d.superavit)>=0?'#10b981':'#ef4444',borderRadius:[4,4,0,0]} })),
      markLine:{ silent:true, data:[{xAxis:0,lineStyle:{color:'#475569',type:'dashed'}}] },
    }],
    backgroundColor:'transparent',
  }

  const remOption = remuneraciones_serie.length ? {
    tooltip:{ trigger:'axis', ...C.tooltip, formatter:params=>{ const d=remuneraciones_serie[params[0]?.dataIndex]; return d?`<b>${d.periodo}</b><br/>Funcionarios: ${fmtN(d.funcionarios)}<br/>Líq. Total: ${fmtMM(d.total_liquido)}<br/>Promedio: $${fmtN(d.promedio_liquido)}`:'' } },
    grid:{ left:80, right:30, top:20, bottom:30 },
    xAxis:{ type:'category', data:remuneraciones_serie.map(d=>String(d.periodo)), axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', axisLabel:{color:C.axisLabel, formatter:v=>fmtMonedaCorto(v)}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[{ type:'bar', barMaxWidth:40, data:remuneraciones_serie.map(d=>Number(d.total_liquido)), itemStyle:{color:'#f59e0b',borderRadius:[4,4,0,0]},
      label:{show:true, position:'top', formatter:p=>fmtMM(p.value), fontSize:10, color:'#fde68a'},
    }],
    backgroundColor:'transparent',
  } : null

  const ult = financiero_serie.slice(-1)[0]
  const totalIng = financiero_serie.reduce((s,d)=>s+Number(d.ingreso),0)
  const totalGas = financiero_serie.reduce((s,d)=>s+Number(d.gasto),0)

  return (
    <>
      <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
        <KPICard icon="📈" label="Total Ingresos (histórico)" value={fmtMM(totalIng)} color="#10b981"/>
        <KPICard icon="📉" label="Total Gastos (histórico)" value={fmtMM(totalGas)} color="#ef4444"/>
        <KPICard icon="⚖️" label="Superávit Acumulado" value={fmtMM(totalIng-totalGas)} color="#6366f1"/>
        <KPICard icon="📅" label={`Ingreso ${ult?.periodo??'—'}`} value={ult?fmtMM(ult.ingreso):'—'} color="#8b5cf6"/>
      </div>
      <div className="chart-card" style={{marginBottom:'1.25rem'}}>
        <h3 className="chart-title">Ingreso vs Gasto por Año (mM$)</h3>
        <ReactECharts option={barOption} style={{height:320}}/>
      </div>
      <div className="chart-card" style={{marginBottom:'1.25rem'}}>
        <h3 className="chart-title">Superávit / Déficit por Año (mM$)</h3>
        <ReactECharts option={superavitOption} style={{height:280}}/>
      </div>
      {remOption && (
        <div className="chart-card">
          <h3 className="chart-title">Remuneraciones Líquidas por Año (mM$)</h3>
          <ReactECharts option={remOption} style={{height:280}}/>
        </div>
      )}
    </>
  )
}

// ── Tab: Eficiencia (serie temporal) ─────────────────────────────────────────
function TabEficiencia({ detalleData }) {
  if (!detalleData) return <div className="loading-area"><div className="spinner"/></div>
  const C = useChartColors()
  const { eficiencia_serie=[] } = detalleData
  const periodos = eficiencia_serie.map(d=>String(d.periodo))

  const pct100Option = {
    tooltip:{ trigger:'axis', axisPointer:{type:'shadow'}, ...C.tooltip,
      formatter:params=>{
        const d=eficiencia_serie[params[0]?.dataIndex]
        if(!d) return ''
        return `<b>${d.periodo}</b><br/><span style="color:#10b981">■</span> Aula: ${d.pct_aula}%<br/><span style="color:#ef4444">■</span> Admin: <b>${d.pct_admin}%</b> — ${d.nivel_eficiencia}<br/><span style="color:#f59e0b">■</span> Otros: ${d.pct_otros}%`
      }
    },
    legend:{ data:['Gasto en Aula','Gasto Administrativo','Otros Gastos'], textStyle:{color:C.legend.color}, top:0 },
    grid:{ left:60, right:30, top:50, bottom:30 },
    xAxis:{ type:'category', data:periodos, axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', max:100, axisLabel:{color:C.axisLabel,formatter:v=>`${v}%`}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[
      { name:'Gasto en Aula',        type:'bar', stack:'pct', barMaxWidth:60, data:eficiencia_serie.map(d=>d.pct_aula),  itemStyle:{color:'#10b981'} },
      { name:'Gasto Administrativo', type:'bar', stack:'pct', barMaxWidth:60, data:eficiencia_serie.map(d=>d.pct_admin), itemStyle:{color:'#ef4444'} },
      { name:'Otros Gastos',         type:'bar', stack:'pct', barMaxWidth:60, data:eficiencia_serie.map(d=>d.pct_otros), itemStyle:{color:'#f59e0b'} },
    ],
    backgroundColor:'transparent',
  }

  const adminOption = {
    tooltip:{ trigger:'axis', ...C.tooltip, formatter:params=>{ const d=eficiencia_serie[params[0]?.dataIndex]; return d?`<b>${d.periodo}</b><br/>% Administrativo: <b>${d.pct_admin}%</b> — ${d.nivel_eficiencia}`:'' } },
    grid:{ left:60, right:30, top:20, bottom:30 },
    xAxis:{ type:'category', data:periodos, axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', max:100, axisLabel:{color:C.axisLabel,formatter:v=>`${v}%`}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[{ type:'bar', barMaxWidth:60,
      data:eficiencia_serie.map(d=>({ value:d.pct_admin, itemStyle:{color:EF_COLORS[d.nivel_eficiencia]??'#94a3b8',borderRadius:[4,4,0,0]} })),
      markLine:{ silent:true, data:[
        { yAxis:15, lineStyle:{color:'#10b981',type:'dashed'}, label:{formatter:'15% Óptimo',color:'#10b981',fontSize:10} },
        { yAxis:25, lineStyle:{color:'#f59e0b',type:'dashed'}, label:{formatter:'25% Límite',color:'#f59e0b',fontSize:10} },
      ]},
    }],
    backgroundColor:'transparent',
  }

  const promAdmin = eficiencia_serie.length ? eficiencia_serie.reduce((s,d)=>s+(d.pct_admin||0),0)/eficiencia_serie.length : 0
  const ult = eficiencia_serie.slice(-1)[0]

  return (
    <>
      <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
        <KPICard icon="📊" label="Prom. Gasto Admin (histórico)" value={`${promAdmin.toFixed(1)}%`} color={promAdmin<=15?'#10b981':promAdmin<=25?'#f59e0b':'#ef4444'}/>
        <KPICard icon="⚙️" label={`Gasto Admin ${ult?.periodo??'—'}`} value={ult?`${ult.pct_admin}%`:'—'} color={ult?EF_COLORS[ult.nivel_eficiencia]:'#94a3b8'} sub={ult?.nivel_eficiencia}/>
        <KPICard icon="🟢" label={`Gasto en Aula ${ult?.periodo??'—'}`} value={ult?`${ult.pct_aula}%`:'—'} color="#10b981"/>
        <KPICard icon="💰" label={`Total Gasto ${ult?.periodo??'—'}`} value={ult?fmtMM(ult.total_gasto):'—'} color="#8b5cf6"/>
      </div>
      <div className="chart-card" style={{marginBottom:'1.25rem'}}>
        <h3 className="chart-title">Distribución del Gasto por Categoría (%) por Año</h3>
        <p style={{color:'#64748b',fontSize:'0.78rem',marginBottom:'0.5rem'}}>
          <span style={{color:'#10b981'}}>■</span> Aula &nbsp;<span style={{color:'#ef4444'}}>■</span> Administrativo &nbsp;<span style={{color:'#f59e0b'}}>■</span> Otros
        </p>
        <ReactECharts option={pct100Option} style={{height:320}}/>
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Nivel de Gasto Administrativo por Año (%)</h3>
        <ReactECharts option={adminOption} style={{height:280}}/>
      </div>
    </>
  )
}

// ── Tab: Riesgo (serie temporal) ─────────────────────────────────────────────
function TabRiesgo({ detalleData }) {
  if (!detalleData) return <div className="loading-area"><div className="spinner"/></div>
  const C = useChartColors()
  const { acreditacion_serie=[] } = detalleData
  const periodos = acreditacion_serie.map(d=>String(d.periodo))

  const acredOption = {
    tooltip:{ trigger:'axis', axisPointer:{type:'shadow'}, ...C.tooltip,
      formatter:params=>{
        const d=acreditacion_serie[params[0]?.dataIndex]
        if(!d) return ''
        return `<b>${d.periodo}</b><br/>✅ Rendido: ${Number(d.pct_rendido).toFixed(1)}% (${fmtMM(d.monto_rendido)})<br/>❌ No rendido: ${Number(d.pct_no_rendido).toFixed(1)}% (${fmtMM(d.monto_no_rendido)})<br/>Docs: ${d.total_docs} — <b>${d.nivel_riesgo}</b>`
      }
    },
    legend:{ data:['% Rendido','% No Rendido'], textStyle:{color:C.legend.color}, top:0 },
    grid:{ left:60, right:30, top:50, bottom:30 },
    xAxis:{ type:'category', data:periodos, axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', max:100, axisLabel:{color:C.axisLabel,formatter:v=>`${v}%`}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[
      { name:'% Rendido',    type:'bar', stack:'pct', barMaxWidth:60, data:acreditacion_serie.map(d=>({ value:Number(d.pct_rendido), itemStyle:{color:RIESGO_COLORS[d.nivel_riesgo]??'#10b981'} })) },
      { name:'% No Rendido', type:'bar', stack:'pct', barMaxWidth:60, data:acreditacion_serie.map(d=>Number(d.pct_no_rendido)), itemStyle:{color:C.splitLine} },
    ],
    backgroundColor:'transparent',
  }

  const montoOption = {
    tooltip:{ trigger:'axis', ...C.tooltip, formatter:params=>{ const d=acreditacion_serie[params[0]?.dataIndex]; return d?`<b>${d.periodo}</b><br/>No rendido: <b style="color:#ef4444">${fmtMM(d.monto_no_rendido)}</b><br/>Total: ${fmtMM(d.monto_total)}`:'' } },
    grid:{ left:80, right:30, top:20, bottom:30 },
    xAxis:{ type:'category', data:periodos, axisLabel:{color:C.axisLabel} },
    yAxis:{ type:'value', axisLabel:{color:C.axisLabel,formatter:v=>fmtMonedaCorto(v)}, splitLine:{lineStyle:{color:C.splitLine}} },
    series:[{ type:'bar', barMaxWidth:60,
      data:acreditacion_serie.map(d=>({ value:Number(d.monto_no_rendido), itemStyle:{color:RIESGO_COLORS[d.nivel_riesgo]??'#ef4444',borderRadius:[4,4,0,0]} })),
      label:{show:true, position:'top', formatter:p=>fmtMM(p.value), fontSize:10},
    }],
    backgroundColor:'transparent',
  }

  const ult = acreditacion_serie.slice(-1)[0]
  const totalNR = acreditacion_serie.reduce((s,d)=>s+Number(d.monto_no_rendido),0)

  return (
    <>
      <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
        <KPICard icon="📊" label={`Nivel de Riesgo ${ult?.periodo??'—'}`} value={ult?.nivel_riesgo??'—'} color={ult?RIESGO_COLORS[ult.nivel_riesgo]:'#94a3b8'}/>
        <KPICard icon="✅" label={`% Rendido ${ult?.periodo??'—'}`} value={ult?`${Number(ult.pct_rendido).toFixed(1)}%`:'—'} color="#10b981"/>
        <KPICard icon="❌" label={`% No Rendido ${ult?.periodo??'—'}`} value={ult?`${Number(ult.pct_no_rendido).toFixed(1)}%`:'—'} color="#ef4444"/>
        <KPICard icon="💸" label="Total No Rendido (histórico)" value={fmtMM(totalNR)} color={totalNR>0?'#ef4444':'#10b981'}/>
      </div>
      <div className="chart-card" style={{marginBottom:'1.25rem'}}>
        <h3 className="chart-title">Acreditación de Saldos por Año (%)</h3>
        <p style={{color:'#64748b',fontSize:'0.78rem',marginBottom:'0.5rem'}}>
          <span style={{color:'#10b981'}}>■</span> Rendido &nbsp;<span style={{color:'#1e293b',border:'1px solid #334155',display:'inline-block',width:12,height:12}}></span> No rendido
        </p>
        <ReactECharts option={acredOption} style={{height:320}}/>
      </div>
      <div className="chart-card" style={{marginBottom:'1.25rem'}}>
        <h3 className="chart-title">Monto No Rendido por Año (mM$)</h3>
        <ReactECharts option={montoOption} style={{height:280}}/>
      </div>
      <div className="chart-card" style={{padding:0}}>
        <div style={{padding:'1rem 1.25rem 0.75rem',borderBottom:'1px solid var(--line-subtle)'}}>
          <h3 className="chart-title" style={{margin:0}}>Detalle por Año</h3>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
            <thead>
              <tr style={{background:'#0f172a'}}>
                {['Año','Nivel Riesgo','% Rendido','Monto Rendido','Monto No Rendido','Total','Docs'].map(h=>(
                  <th key={h} style={{padding:'0.6rem 1rem',color:'#64748b',fontWeight:600,textAlign:'right',borderBottom:'1px solid #1e293b'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...acreditacion_serie].reverse().map((r,i)=>(
                <tr key={r.periodo} style={{borderBottom:'1px solid var(--line-subtle)',background:i%2===0?'transparent':'var(--surface-overlay)'}}>
                  <td style={{padding:'0.5rem 1rem',color:'var(--text-secondary)',textAlign:'right'}}>{r.periodo}</td>
                  <td style={{padding:'0.5rem 1rem',textAlign:'right'}}>
                    <span style={{fontSize:'0.72rem',fontWeight:600,color:RIESGO_COLORS[r.nivel_riesgo],background:`${RIESGO_COLORS[r.nivel_riesgo]}22`,border:`1px solid ${RIESGO_COLORS[r.nivel_riesgo]}`,borderRadius:999,padding:'0.15rem 0.5rem'}}>{r.nivel_riesgo}</span>
                  </td>
                  <td style={{padding:'0.5rem 1rem',color:'var(--success)',textAlign:'right'}}>{Number(r.pct_rendido).toFixed(1)}%</td>
                  <td style={{padding:'0.5rem 1rem',color:'var(--success)',textAlign:'right'}}>{fmtMM(r.monto_rendido)}</td>
                  <td style={{padding:'0.5rem 1rem',color:'var(--danger)',textAlign:'right'}}>{fmtMM(r.monto_no_rendido)}</td>
                  <td style={{padding:'0.5rem 1rem',color:'var(--text-primary)',textAlign:'right'}}>{fmtMM(r.monto_total)}</td>
                  <td style={{padding:'0.5rem 1rem',color:'var(--text-secondary)',textAlign:'right'}}>{fmtN(r.total_docs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Tab: Subvenciones ─────────────────────────────────────────────────────────
function TabSubvencion({ data, periodo }) {
  if (!data) return null
  const C = useChartColors()
  const pieOption = {
    tooltip:{ trigger:'item', formatter:p=>`${p.name}<br/>${fmtMM(p.value)} (${p.percent}%)`, ...C.tooltip },
    legend:{ orient:'vertical', right:10, top:'center', textStyle:{color:C.legend.color}, formatter:n=>n.length>22?n.slice(0,20)+'...':n },
    series:[{ type:'pie', radius:['40%','70%'], center:['38%','50%'],
      data:data.map((d,i)=>({ name:d.subvencion_alias||'Sin subvención', value:d.monto_total, itemStyle:{color:COLORS[i%COLORS.length]} })),
      label:{show:false}, emphasis:{itemStyle:{shadowBlur:10,shadowOffsetX:0,shadowColor:'rgba(0,0,0,0.5)'}},
    }],
    backgroundColor:'transparent',
  }

  const barOption = {
    tooltip:{ trigger:'axis', formatter:p=>`${p[0].name}<br/>${fmtMM(p[0].value)}`, ...C.tooltip },
    grid:{ left:160, right:80, top:20, bottom:30 },
    xAxis:{ type:'value', axisLabel:{color:C.axisLabel,formatter:v=>fmtMonedaCorto(v)}, splitLine:{lineStyle:{color:C.splitLine}} },
    yAxis:{ type:'category', data:[...data].reverse().map(d=>d.subvencion_alias||'Sin subvención'), axisLabel:{color:C.axisLabel,width:150,overflow:'truncate'} },
    series:[{ type:'bar', barMaxWidth:30,
      data:[...data].reverse().map((d,i)=>({ value:d.monto_total, itemStyle:{color:COLORS[(data.length-1-i)%COLORS.length]} })),
      label:{show:true, position:'right', color:C.axisLabel, formatter:p=>fmtMM(p.value)},
    }],
    backgroundColor:'transparent',
  }

  const total = data.reduce((s,d)=>s+Number(d.monto_total),0)
  const totalDocs = data.reduce((s,d)=>s+Number(d.n_documentos),0)

  return (
    <>
      <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
        <KPICard icon="💰" label={`Monto Total${periodo?' '+periodo:' (histórico)'}`} value={fmtMM(total)} color="#6366f1"/>
        <KPICard icon="📄" label="Documentos" value={fmtN(totalDocs)} color="#10b981"/>
        <KPICard icon="🏷️" label="Tipos de Subvención" value={fmtN(data.length)} color="#f59e0b"/>
        <KPICard icon="🏆" label="Subvención Principal" value={data[0]?.subvencion_alias?.slice(0,20)??'—'} color="#8b5cf6" sub={data[0]?fmtMM(data[0].monto_total):''}/>
      </div>
      <div className="charts-grid-2">
        <div className="chart-card">
          <h3 className="chart-title">Distribución Porcentual</h3>
          <ReactECharts option={pieOption} style={{height:380}}/>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Monto por Subvención (mM$)</h3>
          <ReactECharts option={barOption} style={{height:380}}/>
        </div>
      </div>
    </>
  )
}
